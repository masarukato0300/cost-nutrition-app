import { NextResponse } from "next/server";

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
}

export async function POST(request: Request) {
  try {
    await requireLoggedInUser(request);
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
    return NextResponse.json({ result: normalizeIngredientOcrResult(result) });
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
