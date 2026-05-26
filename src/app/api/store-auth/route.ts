import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { sampleData } from "@/lib/sample-data";
import type { AppData } from "@/lib/types";

type StoreRecord = {
  id: string;
  pin_hash: string;
  data: AppData;
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

function supabaseHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

async function fetchStore(storeId: string, config: { url: string; serviceKey: string }) {
  const response = await fetch(`${config.url}/rest/v1/app_stores?id=eq.${encodeURIComponent(storeId)}&select=id,pin_hash,data&limit=1`, {
    headers: supabaseHeaders(config.serviceKey),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("店舗データを確認できませんでした。");
  const rows = await response.json() as StoreRecord[];
  return rows[0] ?? null;
}

export async function POST(request: Request) {
  const config = supabaseConfig();
  if (!config) {
    return NextResponse.json({ ok: false, cloudConfigured: false });
  }

  const { mode, storeName, pin } = await request.json() as { mode?: string; storeName?: string; pin?: string };
  const id = String(storeName || "").trim();
  const pinCode = String(pin || "");
  if (!id || !/^\d{4}$/.test(pinCode)) {
    return NextResponse.json({ ok: false, error: "店舗名と4桁PINを入力してください。" }, { status: 400 });
  }

  const existing = await fetchStore(id, config);
  const pinHash = hashPin(pinCode);

  if (mode === "create") {
    if (existing) {
      return NextResponse.json({ ok: false, error: "同じ店舗名がすでにあります。ログインを選んでください。" }, { status: 409 });
    }
    const response = await fetch(`${config.url}/rest/v1/app_stores`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(config.serviceKey),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id,
        pin_hash: pinHash,
        data: sampleData,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: "店舗を作成できませんでした。" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, cloudConfigured: true, storeName: id, data: sampleData });
  }

  if (!existing) {
    return NextResponse.json({ ok: false, error: "この店舗名は登録されていません。新規作成を選んでください。" }, { status: 404 });
  }
  if (existing.pin_hash !== pinHash) {
    return NextResponse.json({ ok: false, error: "PINコードが違います。" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, cloudConfigured: true, storeName: id, data: existing.data || sampleData });
}
