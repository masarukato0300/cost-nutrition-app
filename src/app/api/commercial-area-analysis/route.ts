import { NextResponse } from "next/server";

type GoogleGeocodeResult = {
  formatted_address?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodeResult[];
};

type GooglePlace = {
  place_id?: string;
  name?: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
};

type GooglePlacesResponse = {
  status?: string;
  error_message?: string;
  results?: GooglePlace[];
};

type SearchGroup = {
  key: "cakeShops" | "bakeries" | "cafes";
  label: string;
  type: string;
  keyword: string;
};

const searchGroups: SearchGroup[] = [
  { key: "cakeShops", label: "ケーキ屋・洋菓子店", type: "bakery", keyword: "ケーキ 洋菓子 パティスリー" },
  { key: "bakeries", label: "パン屋", type: "bakery", keyword: "パン ベーカリー" },
  { key: "cafes", label: "カフェ", type: "cafe", keyword: "カフェ" },
];

function googleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
}

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
  if (!config) throw new Error("Supabaseサーバー環境変数が未設定です。商圏分析は販売版ログイン確認ができる環境でのみ使えます。");
  const token = bearerToken(request);
  if (!token) throw new Error("商圏分析は販売版ログイン後に使えます。先にメールログインしてください。");
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("ログイン情報を確認できませんでした。もう一度ログインしてください。");
}

async function readGoogleJson<T extends { status?: string; error_message?: string }>(response: Response, label: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label}に失敗しました。`);
  const status = (payload as T).status;
  if (status && !["OK", "ZERO_RESULTS"].includes(status)) {
    throw new Error((payload as T).error_message || `${label}に失敗しました。Google status: ${status}`);
  }
  return payload as T;
}

async function geocodeAddress(address: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("language", "ja");
  url.searchParams.set("region", "jp");
  url.searchParams.set("key", apiKey);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await readGoogleJson<GoogleGeocodeResponse>(response, "住所検索");
  const first = payload.results?.[0];
  const lat = first?.geometry?.location?.lat;
  const lng = first?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("住所から位置情報を取得できませんでした。住所を少し詳しく入力してください。");
  }
  return {
    formattedAddress: first?.formatted_address || address,
    lat,
    lng,
  };
}

async function searchNearbyPlaces(params: {
  lat: number;
  lng: number;
  radiusMeters: number;
  group: SearchGroup;
  apiKey: string;
}) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${params.lat},${params.lng}`);
  url.searchParams.set("radius", String(params.radiusMeters));
  url.searchParams.set("type", params.group.type);
  url.searchParams.set("keyword", params.group.keyword);
  url.searchParams.set("language", "ja");
  url.searchParams.set("key", params.apiKey);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await readGoogleJson<GooglePlacesResponse>(response, params.group.label);
  const unique = new Map<string, GooglePlace>();
  (payload.results || [])
    .filter((place) => place.business_status !== "CLOSED_PERMANENTLY")
    .forEach((place) => {
      const id = place.place_id || place.name || "";
      if (id) unique.set(id, place);
    });
  return Array.from(unique.values()).map((place) => ({
    id: place.place_id || place.name || crypto.randomUUID(),
    name: place.name || "名称不明",
    address: place.vicinity || "",
    rating: place.rating || null,
    reviewCount: place.user_ratings_total || 0,
  }));
}

export async function POST(request: Request) {
  try {
    await requireLoggedInUser(request);
    const apiKey = googleMapsApiKey();
    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        configured: false,
        error: "GOOGLE_MAPS_API_KEY が未設定です。VercelのEnvironment Variablesに設定してください。",
      }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as { address?: string; radiusKm?: number };
    const address = (body.address || "").trim();
    const radiusKm = Math.min(Math.max(Number(body.radiusKm) || 5, 1), 10);
    if (!address) {
      return NextResponse.json({ ok: false, error: "住所を入力してください。" }, { status: 400 });
    }

    const location = await geocodeAddress(address, apiKey);
    const radiusMeters = Math.round(radiusKm * 1000);
    const groups = await Promise.all(searchGroups.map(async (group) => ({
      key: group.key,
      label: group.label,
      places: await searchNearbyPlaces({
        lat: location.lat,
        lng: location.lng,
        radiusMeters,
        group,
        apiKey,
      }),
    })));

    return NextResponse.json({
      ok: true,
      configured: true,
      address,
      formattedAddress: location.formattedAddress,
      latitude: location.lat,
      longitude: location.lng,
      radiusKm,
      groups,
      note: "Google Placesの1回の検索結果は最大20件程度です。多い地域では実数より少なく出る場合があります。",
    });
  } catch (error) {
    console.error("commercial-area-analysis failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "商圏分析に失敗しました。",
    }, { status: 400 });
  }
}
