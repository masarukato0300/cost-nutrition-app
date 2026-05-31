import { NextResponse } from "next/server";

type SupabaseUser = {
  id: string;
  email?: string;
};

type ShopMember = {
  shop_id: string;
  role: string;
};

type ManagementAiRequest = {
  featureName?: string;
  summary?: unknown;
  diagnosisAnswers?: Record<string, string>;
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
  if (!match) throw new Error("ログイン情報がありません。");
  return match[1];
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(fallbackMessage, payload);
    throw new Error((payload as { message?: string; error_description?: string }).message || (payload as { error_description?: string }).error_description || fallbackMessage);
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

async function getUserShop(supabaseUrl: string, serviceRoleKey: string, userId: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/shop_members?user_id=eq.${encodeURIComponent(userId)}&select=shop_id,role&limit=1`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });
  const rows = await readJson<ShopMember[]>(response, "店舗メンバー情報を確認できませんでした。");
  const member = rows[0];
  if (!member) throw new Error("このユーザーに紐づく店舗がありません。");
  if (!["owner", "manager"].includes(member.role)) throw new Error("AI経営判断を実行できる権限がありません。");
  return member;
}

function compactPayload(body: ManagementAiRequest) {
  return {
    summary: body.summary,
    diagnosisAnswers: body.diagnosisAnswers || {},
  };
}

async function writeAiUsageLog(
  supabaseUrl: string,
  serviceRoleKey: string,
  params: {
    shopId: string;
    userId: string;
    featureName: string;
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
      shop_id: params.shopId,
      user_id: params.userId,
      feature_name: params.featureName,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost: 0,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const { supabaseUrl, serviceRoleKey, openaiApiKey } = envConfig();
    const accessToken = bearerToken(request);
    const user = await getSupabaseUser(supabaseUrl, serviceRoleKey, accessToken);
    const member = await getUserShop(supabaseUrl, serviceRoleKey, user.id);
    const body = await request.json() as ManagementAiRequest;
    const model = process.env.OPENAI_MANAGEMENT_MODEL || "gpt-4o-mini";
    const featureName = body.featureName || "management_decision_comment";
    const payload = compactPayload(body);

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "あなたは洋菓子店・小規模飲食店向けの経営判断アシスタントです。",
              "数値計算はアプリ側で完了済みです。AIは分類、要約、説明、施策提案だけを行ってください。",
              "他店舗との比較や断定的な財務保証は避け、確認すべき観点を明確にしてください。",
              "JSONで summary, price_actions, growth_actions, waste_actions, diagnosis_comment, next_steps を返してください。",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    });
    const openaiPayload = await readJson<{
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    }>(openaiResponse, "AI経営コメントを作成できませんでした。");

    await writeAiUsageLog(supabaseUrl, serviceRoleKey, {
      shopId: member.shop_id,
      userId: user.id,
      featureName,
      model,
      inputTokens: openaiPayload.usage?.prompt_tokens || 0,
      outputTokens: openaiPayload.usage?.completion_tokens || 0,
    });

    const content = openaiPayload.choices?.[0]?.message?.content || "{}";
    return NextResponse.json({ ok: true, shopId: member.shop_id, result: JSON.parse(content) });
  } catch (error) {
    console.error("management-ai-comment failed", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "AI経営判断に失敗しました。",
    }, { status: 400 });
  }
}
