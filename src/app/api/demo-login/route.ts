import { NextResponse } from "next/server";
import { createPatisseriePatisDemoData } from "@/lib/demo-data";
import type { AppData } from "@/lib/types";

const demoStoreId = "00000000-0000-4000-8000-000000000001";
const demoProfileId = "00000000-0000-4000-8000-000000000002";
const demoStoreName = "パティスリー・パティス";
const demoEmail = "demo@patisserie-management-navi.local";

type SupabaseSessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { id?: string; email?: string };
  error?: string;
  error_description?: string;
  message?: string;
};

type AdminUser = {
  id: string;
  email?: string;
};

function config() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const demoPassword = process.env.DEMO_USER_PASSWORD || "";
  if (!url || !serviceKey || !anonKey || !demoPassword) {
    throw new Error("DEMO_USER_PASSWORD、SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、NEXT_PUBLIC_SUPABASE_ANON_KEY をVercel環境変数に設定してください。");
  }
  return { url, serviceKey, anonKey, demoPassword };
}

function serviceHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

function anonHeaders(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as SupabaseSessionPayload).error_description
      || (payload as SupabaseSessionPayload).message
      || (payload as SupabaseSessionPayload).error
      || "Supabaseとの通信に失敗しました。";
    throw new Error(message);
  }
  return payload as T;
}

async function listUsers(url: string, serviceKey: string): Promise<AdminUser[]> {
  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: serviceHeaders(serviceKey),
    cache: "no-store",
  });
  const payload = await readJson<{ users?: AdminUser[] } | AdminUser[]>(response);
  return Array.isArray(payload) ? payload : payload.users || [];
}

async function ensureDemoAuthUser(url: string, serviceKey: string, demoPassword: string) {
  const existingUser = (await listUsers(url, serviceKey)).find((user) => user.email?.toLowerCase() === demoEmail);
  if (existingUser?.id) {
    await readJson<Record<string, unknown>>(await fetch(`${url}/auth/v1/admin/users/${existingUser.id}`, {
      method: "PUT",
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: { demo_store: true },
      }),
    }));
    return;
  }

  await readJson<Record<string, unknown>>(await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { demo_store: true },
    }),
  }));
}

async function signInDemoUser(url: string, anonKey: string, demoPassword: string) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: anonHeaders(anonKey),
    body: JSON.stringify({ email: demoEmail, password: demoPassword }),
  });
  const payload = await readJson<SupabaseSessionPayload>(response);
  if (!payload.access_token || !payload.user?.id) {
    throw new Error("デモユーザーのログインセッションを取得できませんでした。");
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || "",
    expiresAt: payload.expires_at || 0,
    user: {
      id: payload.user.id,
      email: payload.user.email || demoEmail,
    },
  };
}

async function upsertRows(url: string, serviceKey: string, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  await readJson<Record<string, unknown>>(await fetch(`${url}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      ...serviceHeaders(serviceKey),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  }));
}

async function clearDemoRows(url: string, serviceKey: string, table: string) {
  await readJson<Record<string, unknown>>(await fetch(`${url}/rest/v1/${table}?store_id=eq.${encodeURIComponent(demoStoreId)}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceKey),
  }));
}

function withStore(row: Record<string, unknown>) {
  return { store_id: demoStoreId, ...row };
}

async function seedDemoData(url: string, serviceKey: string, userId: string, data: AppData) {
  await upsertRows(url, serviceKey, "stores", [{
    id: demoStoreId,
    name: demoStoreName,
    owner_user_id: userId,
    plan: "standard",
    subscription_status: "active",
    trial_ends_at: null,
    updated_at: new Date().toISOString(),
  }]);
  await upsertRows(url, serviceKey, "user_profiles", [{
    id: demoProfileId,
    user_id: userId,
    store_id: demoStoreId,
    name: "デモ店舗ユーザー",
    role: "owner",
    updated_at: new Date().toISOString(),
  }]);

  const tablesToReset = [
    "set_product_items",
    "labor_costs",
    "event_plan_items",
    "event_plans",
    "actual_cost_records",
    "sales_records",
    "waste_records",
    "ingredient_aliases",
    "billing_settings",
    "onboarding_support_settings",
    "product_categories",
    "price_histories",
    "recipe_items",
    "products",
    "ingredients",
  ];
  for (const table of tablesToReset) {
    await clearDemoRows(url, serviceKey, table);
  }

  await upsertRows(url, serviceKey, "ingredients", data.ingredients.map((item) => withStore({
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    supplier: item.supplier,
    package_name: item.packageName,
    package_amount_gram: item.packageAmountGram,
    package_unit: item.packageUnit,
    gram_per_unit: item.gramPerUnit,
    price: item.price,
    tax_type: item.taxType,
    calories_per100g: item.caloriesPer100g,
    protein_per100g: item.proteinPer100g,
    fat_per100g: item.fatPer100g,
    carbs_per100g: item.carbsPer100g,
    salt_per100g: item.saltPer100g,
    allergens: item.allergens,
    other_allergen: item.otherAllergen,
    label_name: item.labelName,
    memo: item.memo,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  })));

  await upsertRows(url, serviceKey, "products", data.products.map((item) => withStore({
    id: item.id,
    name: item.name,
    is_intermediate_material: item.isIntermediateMaterial,
    category: item.category,
    selling_price: item.sellingPrice,
    tax_type: item.taxType,
    target_cost_rate: item.targetCostRate,
    display_unit: item.displayUnit,
    yield_count: item.yieldCount,
    before_bake_weight_gram: item.beforeBakeWeightGram,
    after_bake_weight_gram: item.afterBakeWeightGram,
    weight_per_piece_gram: item.weightPerPieceGram,
    status: item.status,
    memo: item.memo,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  })));

  await upsertRows(url, serviceKey, "recipe_items", data.recipeItems.map((item) => withStore({
    id: item.id,
    product_id: item.productId,
    ingredient_id: item.ingredientId,
    item_type: item.itemType,
    intermediate_product_id: item.intermediateProductId,
    usage_type: item.usageType,
    amount_gram: item.amountGram,
    base_amount_gram: item.baseAmountGram,
    used_count: item.usedCount,
    total_count: item.totalCount,
    fraction_denominator: item.fractionDenominator,
    loss_rate: item.lossRate,
    memo: item.memo,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  })));

  await Promise.all([
    upsertRows(url, serviceKey, "price_histories", data.priceHistories.map((item) => withStore({
      id: item.id,
      ingredient_id: item.ingredientId,
      old_price: item.oldPrice,
      new_price: item.newPrice,
      changed_at: item.changedAt,
      supplier: item.supplier,
      reason: item.reason,
      source_type: item.sourceType,
      memo: item.memo,
    }))),
    upsertRows(url, serviceKey, "product_categories", data.productCategories.map((name) => withStore({ id: `${demoStoreId}-${name}`, name }))),
    upsertRows(url, serviceKey, "ingredient_aliases", data.ingredientAliases.map((item) => withStore({
      id: item.id,
      source_text: item.sourceText,
      normalized_source_text: item.normalizedSourceText,
      name: item.name,
      package_name: item.packageName,
      supplier: item.supplier,
      category: item.category,
      label_name: item.labelName,
      calories_per100g: item.caloriesPer100g,
      protein_per100g: item.proteinPer100g,
      fat_per100g: item.fatPer100g,
      carbs_per100g: item.carbsPer100g,
      salt_per100g: item.saltPer100g,
      use_count: item.useCount,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    upsertRows(url, serviceKey, "waste_records", data.wasteRecords.map((item) => withStore({
      id: item.id,
      date: item.date,
      item_type: item.itemType,
      item_id: item.itemId,
      quantity: item.quantity,
      cost_amount: item.costAmount,
      sales_equivalent_amount: item.salesEquivalentAmount,
      reason: item.reason,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    upsertRows(url, serviceKey, "sales_records", data.salesRecords.map((item) => withStore({
      id: item.id,
      month: item.month,
      product_id: item.productId,
      quantity: item.quantity,
      selling_price: item.sellingPrice,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    upsertRows(url, serviceKey, "actual_cost_records", data.actualCostRecords.map((item) => withStore({
      id: item.id,
      month: item.month,
      supplier: item.supplier,
      amount: item.amount,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    upsertRows(url, serviceKey, "event_plans", data.eventPlans.map((item) => withStore({
      id: item.id,
      name: item.name,
      date: item.date,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    upsertRows(url, serviceKey, "event_plan_items", data.eventPlanItems.map((item) => withStore({
      id: item.id,
      event_plan_id: item.eventPlanId,
      product_id: item.productId,
      planned_quantity: item.plannedQuantity,
      selling_price: item.sellingPrice,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    upsertRows(url, serviceKey, "labor_costs", data.laborCosts.map((item) => withStore({
      id: item.id,
      product_id: item.productId,
      process_name: item.processName,
      minutes: item.minutes,
      workers: item.workers,
      hourly_wage: item.hourlyWage,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    upsertRows(url, serviceKey, "set_product_items", data.setProductItems.map((item) => withStore({
      id: item.id,
      set_product_id: item.setProductId,
      child_product_id: item.childProductId,
      quantity: item.quantity,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    upsertRows(url, serviceKey, "onboarding_support_settings", [withStore({
      id: `${demoStoreId}-onboarding`,
      enabled: data.onboardingSupport.onboardingSupportEnabled,
      official_line_url: data.onboardingSupport.officialLineUrl,
      support_start_date: data.onboardingSupport.onboardingSupportStartDate || null,
      support_end_date: data.onboardingSupport.onboardingSupportEndDate || null,
      support_status: data.onboardingSupport.onboardingSupportEnabled ? "active" : "disabled",
    })]),
    upsertRows(url, serviceKey, "billing_settings", [withStore({
      id: `${demoStoreId}-billing`,
      ocr_used_month: data.billing.ocrUsedMonth,
      ocr_used_this_month: data.billing.ocrUsedThisMonth,
      base_monthly_price: data.billing.baseMonthlyPrice,
      ocr_base_limit: data.billing.ocrBaseLimit,
      ocr_addon_packs: data.billing.ocrAddonPacks,
      ocr_addon_pack_size: data.billing.ocrAddonPackSize,
      ocr_addon_price: data.billing.ocrAddonPrice,
      ocr_addon_history: data.billing.ocrAddonHistory,
    })]),
  ]);
}

export async function POST() {
  try {
    const { url, serviceKey, anonKey, demoPassword } = config();
    const data = createPatisseriePatisDemoData();
    await ensureDemoAuthUser(url, serviceKey, demoPassword);
    const session = await signInDemoUser(url, anonKey, demoPassword);
    await seedDemoData(url, serviceKey, session.user.id, data);

    return NextResponse.json({
      ok: true,
      session,
      store: {
        id: demoStoreId,
        name: demoStoreName,
        ownerUserId: session.user.id,
        plan: "standard",
        subscriptionStatus: "active",
        trialEndsAt: null,
        createdAt: "",
        updatedAt: new Date().toISOString(),
      },
      profile: {
        id: demoProfileId,
        userId: session.user.id,
        storeId: demoStoreId,
        name: "デモ店舗ユーザー",
        role: "owner",
        createdAt: "",
        updatedAt: new Date().toISOString(),
      },
      data,
      demoStoreSlug: "demo-sales-store",
    });
  } catch (error) {
    console.error("Demo login failed", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "デモ店舗の準備に失敗しました。",
    }, { status: 500 });
  }
}
