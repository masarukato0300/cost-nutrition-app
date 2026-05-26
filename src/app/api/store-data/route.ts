import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { AppData } from "@/lib/types";

type StoreRecord = {
  id: string;
  pin_hash: string;
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

function isMasterKey(pin: string) {
  const masterKey = process.env.STORE_MASTER_KEY || process.env.ADMIN_MASTER_KEY;
  return Boolean(masterKey && pin && pin === masterKey);
}

function supabaseHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

export async function POST(request: Request) {
  const config = supabaseConfig();
  if (!config) return NextResponse.json({ ok: false, cloudConfigured: false });

  const { storeName, pin, data } = await request.json() as { storeName?: string; pin?: string; data?: AppData };
  const id = String(storeName || "").trim();
  const pinCode = String(pin || "");
  if (!id || !pinCode || !data) {
    return NextResponse.json({ ok: false, error: "保存に必要な情報が不足しています。" }, { status: 400 });
  }

  const getResponse = await fetch(`${config.url}/rest/v1/app_stores?id=eq.${encodeURIComponent(id)}&select=id,pin_hash&limit=1`, {
    headers: supabaseHeaders(config.serviceKey),
    cache: "no-store",
  });
  if (!getResponse.ok) return NextResponse.json({ ok: false, error: "店舗を確認できませんでした。" }, { status: 500 });
  const rows = await getResponse.json() as StoreRecord[];
  const store = rows[0];
  if (!store) return NextResponse.json({ ok: false, error: "店舗が見つかりません。" }, { status: 404 });
  if (store.pin_hash !== hashPin(pinCode) && !isMasterKey(pinCode)) return NextResponse.json({ ok: false, error: "PINコードが違います。" }, { status: 401 });

  const updateResponse = await fetch(`${config.url}/rest/v1/app_stores?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: supabaseHeaders(config.serviceKey),
    body: JSON.stringify({
      data,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!updateResponse.ok) return NextResponse.json({ ok: false, error: "クラウド保存に失敗しました。" }, { status: 500 });
  return NextResponse.json({ ok: true, cloudConfigured: true });
}
