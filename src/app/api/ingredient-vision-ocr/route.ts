import { NextResponse } from "next/server";
import { billingPeriodKey, ocrAddonStats } from "@/lib/ocr-billing";
import { isPermanentUnlockEmail } from "@/lib/permanent-unlock";
import type { BillingSettings } from "@/lib/types";

type IngredientOcrResult = {
  name: string;
  packageName: string;
  supplier: string;
  packageAmount: number | null;
  packageUnit: string;
  price: number | null;
  memo: string;
  confidence: "high" | "medium" | "low";
};

type SupabaseUser = {
  id: string;
  email?: string;
};

type UserProfile = {
  store_id: string;
  role: string;
};

type StoreRow = {
  id: string;
  created_at?: string;
};

type BillingRow = {
  id?: string;
  ocr_used_month?: string;
  ocr_used_this_month?: number;
  base_monthly_price?: number;
  ocr_base_limit?: number;
  ocr_addon_packs?: number;
  ocr_addon_pack_size?: number;
  ocr_addon_price?: number;
  ocr_addon_history?: BillingSettings["ocrAddonHistory"];
};

const schema = {
  name: "ingredient_ocr_results",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      rawText: { type: "string", description: "画像内で読み取れた文字を、行ごとにできるだけそのまま転記" },
      memo: { type: "string", description: "読み取り根拠、注意点、曖昧な点" },
      ingredients: {
        type: "array",
        description: "画像から抽出した原材料候補。複数商品が写っている場合は順番にすべて入れる",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", description: "原材料名または包材名。画像内の品名・商品名・摘要にある短い名前を、推測で別商品へ言い換えず入れる。半角カタカナは全角カタカナとして読む。判読不能なら空文字" },
            packageName: { type: "string", description: "製品名または商品名。袋、ラベル、伝票の商品名欄・品名欄・規格欄の文字を略さず入れる。半角カタカナは全角カタカナとして読む。似た包材名へ補完しない。判読不能なら空文字" },
            supplier: { type: "string", description: "仕入先、メーカー、供給元。不明なら空文字" },
            packageAmount: { type: ["number", "null"], description: "内容量の数値部分。不明ならnull" },
            packageUnit: { type: "string", description: "内容量の単位。例: g, kg, ml, L, 個, 枚, 本。不明なら空文字" },
            price: { type: ["number", "null"], description: "単価、新価格、改定後価格、売単価を最優先した仕入価格。合計金額、小計、請求金額、税込合計は選ばない。不明ならnull" },
            memo: { type: "string", description: "この候補の読み取り根拠、注意点、曖昧な点" },
            confidence: { type: "string", enum: ["high", "medium", "low"], description: "読み取り信頼度" },
          },
          required: ["name", "packageName", "supplier", "packageAmount", "packageUnit", "price", "memo", "confidence"],
        },
      },
    },
    required: ["rawText", "memo", "ingredients"],
  },
} as const;

function supabaseServerConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.match(/^Bearer\s+(.+)$/i)?.[1] || "";
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: { message?: string }; message?: string; error_description?: string }).error?.message
      || (payload as { message?: string }).message
      || (payload as { error_description?: string }).error_description
      || fallbackMessage;
    throw new Error(message);
  }
  return payload as T;
}

async function requireLoggedInUser(request: Request) {
  const config = supabaseServerConfig();
  if (!config) throw new Error("Supabaseサーバー環境変数が未設定です。OCRは販売版ログイン確認ができる環境でのみ使えます。");
  const token = bearerToken(request);
  if (!token) throw new Error("AI OCRは販売版ログイン後に使えます。先にメールログインしてください。");
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("ログイン情報を確認できませんでした。もう一度ログインしてください。");
  const user = await response.json() as SupabaseUser;
  const profileResponse = await fetch(`${config.url}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=store_id,role&limit=1`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
    cache: "no-store",
  });
  const profiles = await readJson<UserProfile[]>(profileResponse, "店舗情報を確認できませんでした。");
  const profile = profiles[0];
  if (!profile?.store_id) throw new Error("このユーザーに紐づく店舗がありません。");
  return { config, user, storeId: profile.store_id };
}

function mapBilling(row: BillingRow | undefined, billingKey: string): BillingSettings {
  return {
    ocrUsedMonth: row?.ocr_used_month || billingKey,
    ocrUsedThisMonth: Number(row?.ocr_used_this_month) || 0,
    baseMonthlyPrice: Number(row?.base_monthly_price) || 1400,
    ocrBaseLimit: Number(row?.ocr_base_limit) || 30,
    ocrAddonPacks: Number(row?.ocr_addon_packs) || 0,
    ocrAddonPackSize: Number(row?.ocr_addon_pack_size) || 50,
    ocrAddonPrice: Number(row?.ocr_addon_price) || 550,
    ocrAddonHistory: Array.isArray(row?.ocr_addon_history) ? row.ocr_addon_history : [],
  };
}

async function checkOcrQuota(params: { config: { url: string; serviceKey: string }; user: SupabaseUser; storeId: string }) {
  if (isPermanentUnlockEmail(params.user.email)) return { allowed: true, billingKey: billingPeriodKey(), billing: null as BillingSettings | null };
  const headers = {
    apikey: params.config.serviceKey,
    Authorization: `Bearer ${params.config.serviceKey}`,
  };
  const storeResponse = await fetch(`${params.config.url}/rest/v1/stores?id=eq.${encodeURIComponent(params.storeId)}&select=id,created_at&limit=1`, {
    headers,
    cache: "no-store",
  });
  const stores = await readJson<StoreRow[]>(storeResponse, "店舗情報を確認できませんでした。");
  const billingKey = billingPeriodKey(stores[0]?.created_at);
  const billingResponse = await fetch(`${params.config.url}/rest/v1/billing_settings?store_id=eq.${encodeURIComponent(params.storeId)}&select=*&limit=1`, {
    headers,
    cache: "no-store",
  });
  const billingRows = await readJson<BillingRow[]>(billingResponse, "OCR利用状況を確認できませんでした。");
  const billing = mapBilling(billingRows[0], billingKey);
  const currentBilling = billing.ocrUsedMonth === billingKey
    ? billing
    : { ...billing, ocrUsedMonth: billingKey, ocrUsedThisMonth: 0, ocrAddonPacks: 0 };
  const addonStats = ocrAddonStats(currentBilling, billingKey);
  const limit = currentBilling.ocrBaseLimit + addonStats.addedLimit;
  if (currentBilling.ocrUsedThisMonth >= limit) {
    return { allowed: false, billingKey, billing: currentBilling, limit };
  }
  return { allowed: true, billingKey, billing: currentBilling, limit };
}

async function incrementOcrUsage(params: { config: { url: string; serviceKey: string }; storeId: string; billingKey: string; billing: BillingSettings | null }) {
  if (!params.billing) return null;
  const usedCountAfter = params.billing.ocrUsedThisMonth + 1;
  const nextBilling = {
    store_id: params.storeId,
    id: `${params.storeId}-billing`,
    ocr_used_month: params.billingKey,
    ocr_used_this_month: usedCountAfter,
    base_monthly_price: params.billing.baseMonthlyPrice,
    ocr_base_limit: params.billing.ocrBaseLimit,
    ocr_addon_packs: params.billing.ocrAddonPacks,
    ocr_addon_pack_size: params.billing.ocrAddonPackSize,
    ocr_addon_price: params.billing.ocrAddonPrice,
    ocr_addon_history: params.billing.ocrAddonHistory,
    updated_at: new Date().toISOString(),
  };
  await fetch(`${params.config.url}/rest/v1/billing_settings?on_conflict=store_id`, {
    method: "POST",
    headers: {
      apikey: params.config.serviceKey,
      Authorization: `Bearer ${params.config.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(nextBilling),
  }).catch((error) => {
    console.error("OCR利用回数の保存に失敗しました。", error);
  });
  await fetch(`${params.config.url}/rest/v1/ocr_usage_events`, {
    method: "POST",
    headers: {
      apikey: params.config.serviceKey,
      Authorization: `Bearer ${params.config.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      store_id: params.storeId,
      billing_month: params.billingKey,
      status: "success",
      used_count_after: usedCountAfter,
    }),
  }).catch((error) => {
    console.error("OCR利用イベントの保存に失敗しました。", error);
  });
  return {
    billingMonth: params.billingKey,
    ocrUsedThisMonth: usedCountAfter,
    ocrBaseLimit: params.billing.ocrBaseLimit,
    addedLimit: ocrAddonStats(params.billing, params.billingKey).addedLimit,
  };
}

export async function POST(request: Request) {
  let quotaContext: Awaited<ReturnType<typeof requireLoggedInUser>> | null = null;
  let quota: Awaited<ReturnType<typeof checkOcrQuota>> | null = null;
  try {
    quotaContext = await requireLoggedInUser(request);
    quota = await checkOcrQuota(quotaContext);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `OCR上限に達しました。現在 ${quota.billing?.ocrUsedThisMonth || 0}/${quota.limit || 0}枚です。追加パックを購入してください。`, code: "OCR_LIMIT_REACHED" },
        { status: 402 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ログイン情報を確認できませんでした。" },
      { status: 401 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません。Vercelまたは.env.localに設定してください。" },
      { status: 500 },
    );
  }

  const { imageDataUrl } = await request.json();
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "画像データを読み取れませんでした。" }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "あなたは洋菓子店・飲食店向けの原材料ラベル、納品書、価格表、価格改定通知を読むOCR補助です。まず画像内の文字をできるだけ読み取り、その中から原材料登録に必要な情報を抽出してください。原材料名・包材名・製品名は、画像に写っている文字を最優先し、食品カテゴリ名や一般名や似た商品名へ勝手に言い換えないでください。半角カタカナは全角カタカナとして慎重に読んでください。例: 「ﾌﾚｯｼｭｸﾘｰﾑ35」は「フレッシュクリーム35」、「ｸﾞﾗﾆｭｰ糖」は「グラニュー糖」、「ｶｽﾀｰﾄﾞ」は「カスタード」、「ﾊﾟﾃｨｽﾘｰｹｰｷﾋﾟｯｸ」は「パティスリーケーキピック」として扱います。包材名の「ピック」「トレー」「箱」「袋」「シール」「フィルム」「ボックス」は別物です。たとえば「ケーキピック」を「ギフトボックス」や「ディスプレイギフトボックス」に置き換えてはいけません。例: 「フレッシュクリーム35」「特宝笠」「赤玉L」などはその表記を維持します。判読できない文字は推測で補完しすぎず、空文字または低信頼度にしてmemoに曖昧な点を書いてください。複数の原材料・商品行が写っている場合は、先頭だけでなく読み取れる候補を順番にすべてingredientsへ入れてください。価格は単価、新価格、改定後価格、売単価、単価(税込)の列を最優先し、数量×単価の合計金額、小計、請求金額、伝票合計はpriceに入れないでください。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "この画像から原材料登録用の情報を抽出してください。rawTextには見える文字を行ごとにできるだけ原文どおり転記してください。ingredientsには、価格表や納品書の各行、複数ラベル、複数商品をできるだけ分けて入れてください。nameには商品行の主語になる短い品名を入れてください。packageNameには袋や伝票の商品名・品名・規格・摘要に書かれた製品名を入れてください。半角カタカナの商品名は全角カタカナへ直して読んでください。特に濁点・半濁点・小さいッャュョ・長音ーを落とさないでください。包材は意味で推測せず、行にある文字だけを読んでください。「ピック」と「ボックス」、「トレー」と「袋」、「フィルム」と「箱」は別商品です。画像に「ケーキピック」と読める場合は、絶対に「ディスプレイギフトボックス」にしないでください。原材料名と製品名は、似た別の商品名へ補正しないでください。仕入先名、日付、合計行、伝票番号はname/packageNameにしないでください。priceは必ず単価、新価格、改定後価格、売単価、単価(税込)の列や近くの数値を優先してください。合計、金額、小計、請求金額、伝票合計、総額、数量×単価の結果はpriceに使わないでください。価格が複数ある場合は、新価格または改定後価格を選び、迷った理由をmemoに書いてください。返答は指定JSON schemaのみ。",
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 1800,
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `OpenAI Vision OCRに失敗しました。${shortenError(errorText)}` },
      { status: response.status },
    );
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: "OCR結果が空でした。" }, { status: 502 });
  }

  try {
    const result = JSON.parse(content) as { rawText: string; memo: string; ingredients: IngredientOcrResult[] };
    let ocrUsage: Awaited<ReturnType<typeof incrementOcrUsage>> = null;
    if (quotaContext && quota?.billing) {
      ocrUsage = await incrementOcrUsage({
        config: quotaContext.config,
        storeId: quotaContext.storeId,
        billingKey: quota.billingKey,
        billing: quota.billing,
      });
    }
    return NextResponse.json({ result: normalizeIngredientOcrResult(result), ocrUsage });
  } catch {
    return NextResponse.json({ error: "OCR結果JSONを解析できませんでした。", raw: content }, { status: 502 });
  }
}

function normalizeIngredientOcrResult(result: { rawText: string; memo: string; ingredients: IngredientOcrResult[] }) {
  return {
    ...result,
    ingredients: result.ingredients.map((ingredient) => ({
      ...ingredient,
      name: normalizeOcrField(ingredient.name),
      packageName: normalizeOcrField(ingredient.packageName),
      supplier: normalizeOcrField(ingredient.supplier),
      packageUnit: normalizeOcrField(ingredient.packageUnit),
    })),
  };
}

function normalizeOcrField(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function shortenError(errorText: string) {
  try {
    const json = JSON.parse(errorText);
    return json.error?.message || errorText.slice(0, 500);
  } catch {
    return errorText.slice(0, 500);
  }
}
