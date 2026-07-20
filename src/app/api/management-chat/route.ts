import { NextResponse } from "next/server";
import { isPermanentUnlockEmail } from "@/lib/permanent-unlock";

type SupabaseUser = {
  id: string;
  email?: string;
};

type UserProfile = {
  store_id: string;
  role: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ManagementChatRequest = {
  messages?: ChatMessage[];
  summary?: unknown;
  diagnosisAnswers?: Record<string, string | string[]>;
};

function envConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabaseサーバー環境変数が未設定です。");
  if (!openaiApiKey) throw new Error("OPENAI_API_KEYが未設定です。");
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceRoleKey, openaiApiKey };
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("AI相談は販売版ログイン後に使えます。先にログインしてください。");
  return match[1];
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(fallbackMessage, payload);
    const message = (payload as { error?: { message?: string }; message?: string; error_description?: string }).error?.message
      || (payload as { message?: string }).message
      || (payload as { error_description?: string }).error_description
      || fallbackMessage;
    throw new Error(message);
  }
  return payload as T;
}

async function getSupabaseUser(supabaseUrl: string, serviceRoleKey: string, accessToken: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  return readJson<SupabaseUser>(response, "ログインユーザーを確認できませんでした。");
}

async function getUserStore(supabaseUrl: string, serviceRoleKey: string, user: SupabaseUser) {
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=store_id,role&limit=1`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });
  const profiles = await readJson<UserProfile[]>(profileResponse, "店舗メンバー情報を確認できませんでした。");
  const profile = profiles[0];
  if (!profile?.store_id) throw new Error("このユーザーに紐づく店舗がありません。");
  if (!isPermanentUnlockEmail(user.email) && !["owner", "manager", "staff"].includes(profile.role)) {
    throw new Error("AI相談を実行できる権限がありません。");
  }
  return { storeId: profile.store_id, role: profile.role };
}

function cleanMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => ["user", "assistant"].includes(message.role) && message.content.trim())
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1400),
    }));
}

async function writeAiUsageLog(
  supabaseUrl: string,
  serviceRoleKey: string,
  params: {
    storeId: string;
    userId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  },
) {
  await fetch(`${supabaseUrl}/rest/v1/ai_usage_logs`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      store_id: params.storeId,
      user_id: params.userId,
      feature_name: "management_chat",
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost: 0,
    }),
  }).catch((error) => {
    console.error("AI相談の利用ログ保存に失敗しました。", error);
  });
}

export async function POST(request: Request) {
  try {
    const { supabaseUrl, serviceRoleKey, openaiApiKey } = envConfig();
    const accessToken = bearerToken(request);
    const user = await getSupabaseUser(supabaseUrl, serviceRoleKey, accessToken);
    const store = await getUserStore(supabaseUrl, serviceRoleKey, user);
    const body = await request.json() as ManagementChatRequest;
    const messages = cleanMessages(body.messages || []);
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) throw new Error("相談内容を入力してください。");

    const model = process.env.OPENAI_MANAGEMENT_CHAT_MODEL || process.env.OPENAI_MANAGEMENT_MODEL || "gpt-4o-mini";
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: [
              "あなたは、洋菓子店・ケーキ屋・パン屋など小規模店舗に特化した経営相談AIです。",
              "原価、売上、粗利、廃棄、商品別原価、包材、予約商品、季節イベント、商圏、店主の負担を分けて考えてください。",
              "数字の計算はアプリ側の集計済みデータを前提にし、AI側で勝手に再計算しないでください。",
              "ケーキ、焼菓子、ギフト、予約商品、季節商品、生菓子の廃棄、原材料高騰、箱・保冷剤コストを重視してください。",
              "値下げや商品数追加を安易に勧めず、値上げ、限定化、予約導線、焼菓子ギフト強化、製造数調整、包材見直しも選択肢にしてください。",
              "クリスマス、母の日、バレンタイン、帰省、法人手土産などイベント需要も必要に応じて考慮してください。",
              "回答は日本語で、最初に結論を1つ置き、その後に理由、今週試せる一手、見るべき数字を短く示してください。",
              "財務・税務・法律・医療の断定は避け、必要なら専門家確認を促してください。",
              "レシピ全文、顧客個人情報、CSV全文は要求しないでください。",
            ].join("\n"),
          },
          {
            role: "user",
            content: `店舗ID: ${store.storeId}\n現在の店舗データ要約です。\n${JSON.stringify({
              summary: body.summary,
              diagnosisAnswers: body.diagnosisAnswers || {},
            })}`,
          },
          ...messages,
        ],
      }),
    });

    const payload = await readJson<{
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    }>(openaiResponse, "AI相談の回答を作成できませんでした。");

    await writeAiUsageLog(supabaseUrl, serviceRoleKey, {
      storeId: store.storeId,
      userId: user.id,
      model,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
    });

    return NextResponse.json({
      ok: true,
      answer: payload.choices?.[0]?.message?.content || "回答を作成できませんでした。",
      usage: payload.usage || null,
      model,
    });
  } catch (error) {
    console.error("management-chat failed", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "AI相談に失敗しました。",
    }, { status: 400 });
  }
}
