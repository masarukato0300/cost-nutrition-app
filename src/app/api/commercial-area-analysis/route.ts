import { NextResponse } from "next/server";

type ManualCommercialAreaGroup = {
  key: "cakeShops" | "bakeries" | "cafes";
  label: string;
  count: number;
};

const manualGroups: Array<Omit<ManualCommercialAreaGroup, "count"> & { bodyKey: string }> = [
  { key: "cakeShops", label: "洋菓子店・ケーキ屋", bodyKey: "cakeShopCount" },
  { key: "bakeries", label: "パン屋", bodyKey: "bakeryCount" },
  { key: "cafes", label: "カフェ", bodyKey: "cafeCount" },
];

function safeCount(value: unknown) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

function manualPlaces(prefix: string, label: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `manual-${prefix}-${index + 1}`,
    name: `${label} ${index + 1}`,
    address: "手入力の競合数",
    rating: null,
    reviewCount: 0,
  }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const locationType = String(body.locationType || "未設定").trim() || "未設定";
  const memo = String(body.memo || "").trim();
  const regionalFeatures = String(body.regionalFeatures || "").trim();
  const groups = manualGroups.map((group) => {
    const count = safeCount(body[group.bodyKey]);
    return {
      key: group.key,
      label: group.label,
      places: manualPlaces(group.key, group.label, count),
    };
  });

  return NextResponse.json({
    ok: true,
    configured: true,
    sourceType: "manual",
    formattedAddress: locationType,
    latitude: 0,
    longitude: 0,
    radiusKm: 0,
    locationType,
    memo,
    regionalFeatures,
    groups,
    note: "外部地図検索は使わず、入力された競合数・立地タイプ・商圏メモ・地域特徴をAI判断に反映します。",
  });
}
