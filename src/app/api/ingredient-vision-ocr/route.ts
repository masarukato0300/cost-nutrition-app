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
  name: "ingredient_ocr_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "原材料名。例: 全卵、薄力粉、グラニュー糖" },
      packageName: { type: "string", description: "製品名または商品名。例: 赤玉 Lサイズ 10個" },
      supplier: { type: "string", description: "仕入先、メーカー、供給元。不明なら空文字" },
      packageAmount: { type: ["number", "null"], description: "内容量の数値部分。不明ならnull" },
      packageUnit: { type: "string", description: "内容量の単位。例: g, kg, ml, L, 個, 枚, 本。不明なら空文字" },
      price: { type: ["number", "null"], description: "仕入価格または新価格。税込税抜は問わず数値のみ。不明ならnull" },
      memo: { type: "string", description: "読み取り根拠、注意点、曖昧な点" },
      confidence: { type: "string", enum: ["high", "medium", "low"], description: "読み取り信頼度" },
    },
    required: ["name", "packageName", "supplier", "packageAmount", "packageUnit", "price", "memo", "confidence"],
  },
} as const;

export async function POST(request: Request) {
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
            "あなたは洋菓子店・飲食店向けの原材料ラベル、納品書、価格改定通知を読むOCR補助です。画像から原材料登録に必要な情報だけを抽出してください。曖昧な項目は推測しすぎず空文字またはnullにしてください。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "この画像から原材料登録用の情報を抽出してください。価格が複数ある場合は、仕入価格または新価格として最も登録すべき価格をpriceに入れてください。返答は指定JSON schemaのみ。",
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
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `OpenAI Vision OCRに失敗しました。${errorText}` },
      { status: response.status },
    );
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: "OCR結果が空でした。" }, { status: 502 });
  }

  try {
    const result = JSON.parse(content) as IngredientOcrResult;
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "OCR結果JSONを解析できませんでした。", raw: content }, { status: 502 });
  }
}
