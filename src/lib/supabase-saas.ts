import { sampleData } from "./sample-data";
import type {
  ActualCostRecord,
  AppData,
  EventPlan,
  EventPlanItem,
  Ingredient,
  IngredientAlias,
  LaborCost,
  PriceHistory,
  Product,
  RecipeItem,
  SalesRecord,
  SetProductItem,
  WasteRecord,
} from "./types";

const authStorageKey = "cost-nutrition-saas-auth-v1";

export type SaaSPlan = "trial" | "free" | "standard" | "pro" | "setup_support";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "suspended";
export type UserRole = "owner" | "manager" | "staff" | "support_admin";

export type SaaSAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
  };
};

export type SaaSStore = {
  id: string;
  name: string;
  ownerUserId: string;
  plan: SaaSPlan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaaSUserProfile = {
  id: string;
  userId: string;
  storeId: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: {
    id?: string;
    email?: string;
  };
  id?: string;
  email?: string;
  session?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    user?: {
      id?: string;
      email?: string;
    };
  } | null;
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
}

function anonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function isSaaSSupabaseConfigured() {
  return Boolean(supabaseUrl() && anonKey());
}

function requireConfig() {
  const url = supabaseUrl();
  const key = anonKey();
  if (!url || !key) throw new Error("Supabase Authの環境変数が未設定です。");
  return { url, key };
}

function authHeaders(token?: string) {
  const { key } = requireConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${token || key}`,
    "Content-Type": "application/json",
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Supabase request failed", { status: response.status, payload });
    const message = (payload as AuthResponse).error_description
      || (payload as AuthResponse).message
      || (payload as AuthResponse).msg
      || (payload as AuthResponse).error
      || "Supabaseとの通信に失敗しました。";
    throw new Error(message);
  }
  return payload as T;
}

function toSession(payload: AuthResponse): SaaSAuthSession {
  const accessToken = payload.access_token || payload.session?.access_token;
  const refreshToken = payload.refresh_token || payload.session?.refresh_token || "";
  const expiresAt = payload.expires_at || payload.session?.expires_at || 0;
  const user = payload.user || payload.session?.user || { id: payload.id, email: payload.email };
  if (!accessToken || !user?.id) {
    console.error("Supabase Auth returned no usable session", payload);
    const hasUser = Boolean(user?.id);
    const detail = JSON.stringify({
      hasAccessToken: Boolean(accessToken),
      hasUser,
      email: user?.email || payload.email || "",
      message: payload.message || payload.msg || payload.error_description || payload.error || "",
    });
    if (hasUser && !accessToken) {
      throw new Error(`Supabase Authでユーザーは作成されましたが、ログイン用セッションが返っていません。メール確認がONになっている可能性が高いです。SupabaseのAuthentication > Providers > Emailで「Confirm email」をOFFにしてください。詳細: ${detail}`);
    }
    throw new Error(`Supabase Authのログイン情報を取得できませんでした。詳細: ${detail}`);
  }
  return {
    accessToken,
    refreshToken,
    expiresAt,
    user: {
      id: user.id,
      email: user.email || "",
    },
  };
}

export function saveSaaSAuthSession(session: SaaSAuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(authStorageKey, JSON.stringify(session));
}

export function loadSaaSAuthSession() {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(authStorageKey);
    if (!saved) return null;
    return JSON.parse(saved) as SaaSAuthSession;
  } catch {
    return null;
  }
}

export function clearSaaSAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(authStorageKey);
}

export async function signUpWithEmail(email: string, password: string) {
  const { url } = requireConfig();
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const payload = await readJson<AuthResponse>(response);
  console.info("Supabase signup response", {
    hasAccessToken: Boolean(payload.access_token || payload.session?.access_token),
    hasUser: Boolean(payload.user?.id || payload.id || payload.session?.user?.id),
    email: payload.user?.email || payload.email || payload.session?.user?.email || email,
    message: payload.message || payload.msg || payload.error_description || payload.error || "",
  });
  if (payload.access_token || payload.session?.access_token) return toSession(payload);
  try {
    return await signInWithEmail(email, password);
  } catch (error) {
    console.error("Supabase signup succeeded but immediate signin failed", { payload, error });
    const reason = error instanceof Error ? error.message : "自動ログインに失敗しました。";
    throw new Error(`新規登録は受け付けられましたが、自動ログインできませんでした。${reason}`);
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { url } = requireConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const payload = await readJson<AuthResponse>(response);
  console.info("Supabase signin response", {
    hasAccessToken: Boolean(payload.access_token || payload.session?.access_token),
    hasUser: Boolean(payload.user?.id || payload.id || payload.session?.user?.id),
    email: payload.user?.email || payload.email || payload.session?.user?.email || email,
    message: payload.message || payload.msg || payload.error_description || payload.error || "",
  });
  return toSession(payload);
}

export async function sendPasswordReset(email: string) {
  const { url } = requireConfig();
  const response = await fetch(`${url}/auth/v1/recover`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  await readJson<Record<string, unknown>>(response);
}

export async function signOutSaaS(session: SaaSAuthSession) {
  const { url } = requireConfig();
  await fetch(`${url}/auth/v1/logout`, {
    method: "POST",
    headers: authHeaders(session.accessToken),
  });
  clearSaaSAuthSession();
}

function mapStore(row: Record<string, unknown>): SaaSStore {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    ownerUserId: String(row.owner_user_id || ""),
    plan: (row.plan as SaaSPlan) || "trial",
    subscriptionStatus: (row.subscription_status as SubscriptionStatus) || "trialing",
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapProfile(row: Record<string, unknown>): SaaSUserProfile {
  return {
    id: String(row.id || ""),
    userId: String(row.user_id || ""),
    storeId: String(row.store_id || ""),
    name: String(row.name || ""),
    role: (row.role as UserRole) || "owner",
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function ensureStoreForUser(session: SaaSAuthSession, storeName: string) {
  const { url } = requireConfig();
  const profileResponse = await fetch(`${url}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(session.user.id)}&select=*&limit=1`, {
    headers: authHeaders(session.accessToken),
    cache: "no-store",
  });
  const profiles = await readJson<Record<string, unknown>[]>(profileResponse);
  if (profiles[0]) {
    const profile = mapProfile(profiles[0]);
    const storeResponse = await fetch(`${url}/rest/v1/stores?id=eq.${encodeURIComponent(profile.storeId)}&select=*&limit=1`, {
      headers: authHeaders(session.accessToken),
      cache: "no-store",
    });
    const stores = await readJson<Record<string, unknown>[]>(storeResponse);
    return { profile, store: mapStore(stores[0] || {}) };
  }

  const storeResponse = await fetch(`${url}/rest/v1/stores`, {
    method: "POST",
    headers: { ...authHeaders(session.accessToken), Prefer: "return=representation" },
    body: JSON.stringify({
      name: storeName || session.user.email || "店舗",
      owner_user_id: session.user.id,
      plan: "trial",
      subscription_status: "trialing",
      trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }),
  });
  const stores = await readJson<Record<string, unknown>[]>(storeResponse);
  const store = mapStore(stores[0] || {});
  const userProfileResponse = await fetch(`${url}/rest/v1/user_profiles`, {
    method: "POST",
    headers: { ...authHeaders(session.accessToken), Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: session.user.id,
      store_id: store.id,
      name: session.user.email,
      role: "owner",
    }),
  });
  const newProfiles = await readJson<Record<string, unknown>[]>(userProfileResponse);
  return { profile: mapProfile(newProfiles[0] || {}), store };
}

export async function ensureManagementShopForUser(session: SaaSAuthSession, shopName: string) {
  const { url } = requireConfig();
  const memberResponse = await fetch(`${url}/rest/v1/shop_members?user_id=eq.${encodeURIComponent(session.user.id)}&select=shop_id,role&limit=1`, {
    headers: authHeaders(session.accessToken),
    cache: "no-store",
  });
  const existingMembers = await readJson<Array<{ shop_id: string; role: string }>>(memberResponse);
  if (existingMembers[0]?.shop_id) return existingMembers[0].shop_id;

  const shopResponse = await fetch(`${url}/rest/v1/shops`, {
    method: "POST",
    headers: { ...authHeaders(session.accessToken), Prefer: "return=representation" },
    body: JSON.stringify({
      name: shopName || session.user.email || "店舗",
      plan: "trial",
    }),
  });
  const shops = await readJson<Array<{ id: string }>>(shopResponse);
  const shopId = shops[0]?.id;
  if (!shopId) throw new Error("AI経営判断用の店舗を作成できませんでした。");

  const shopMemberResponse = await fetch(`${url}/rest/v1/shop_members`, {
    method: "POST",
    headers: { ...authHeaders(session.accessToken), Prefer: "return=minimal" },
    body: JSON.stringify({
      shop_id: shopId,
      user_id: session.user.id,
      role: "owner",
    }),
  });
  await readJson<Record<string, unknown>>(shopMemberResponse);
  return shopId;
}

async function fetchTable<T>(session: SaaSAuthSession, table: string, storeId: string, mapper: (row: Record<string, unknown>) => T) {
  const { url } = requireConfig();
  const response = await fetch(`${url}/rest/v1/${table}?store_id=eq.${encodeURIComponent(storeId)}&select=*`, {
    headers: authHeaders(session.accessToken),
    cache: "no-store",
  });
  const rows = await readJson<Record<string, unknown>[]>(response);
  return rows.map(mapper);
}

function rowString(row: Record<string, unknown>, key: string) {
  return String(row[key] || "");
}

function rowNumber(row: Record<string, unknown>, key: string) {
  return Number(row[key] || 0);
}

function postgrestListValue(value: unknown) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function mapIngredient(row: Record<string, unknown>): Ingredient {
  return {
    id: rowString(row, "id"),
    name: rowString(row, "name"),
    type: row.type as Ingredient["type"],
    category: rowString(row, "category"),
    supplier: rowString(row, "supplier"),
    packageName: rowString(row, "package_name"),
    packageAmountGram: rowNumber(row, "package_amount_gram"),
    packageUnit: rowString(row, "package_unit") || "g",
    gramPerUnit: rowNumber(row, "gram_per_unit") || 1,
    price: rowNumber(row, "price"),
    taxType: row.tax_type as Ingredient["taxType"],
    caloriesPer100g: row.calories_per100g === null ? null : rowNumber(row, "calories_per100g"),
    proteinPer100g: row.protein_per100g === null ? null : rowNumber(row, "protein_per100g"),
    fatPer100g: row.fat_per100g === null ? null : rowNumber(row, "fat_per100g"),
    carbsPer100g: row.carbs_per100g === null ? null : rowNumber(row, "carbs_per100g"),
    saltPer100g: row.salt_per100g === null ? null : rowNumber(row, "salt_per100g"),
    allergens: Array.isArray(row.allergens) ? row.allergens.map(String) : [],
    otherAllergen: rowString(row, "other_allergen"),
    labelName: rowString(row, "label_name"),
    memo: rowString(row, "memo"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: rowString(row, "id"),
    name: rowString(row, "name"),
    isIntermediateMaterial: Boolean(row.is_intermediate_material),
    category: rowString(row, "category"),
    sellingPrice: rowNumber(row, "selling_price"),
    taxType: row.tax_type as Product["taxType"],
    targetCostRate: rowNumber(row, "target_cost_rate"),
    displayUnit: row.display_unit as Product["displayUnit"],
    yieldCount: rowNumber(row, "yield_count"),
    beforeBakeWeightGram: rowNumber(row, "before_bake_weight_gram"),
    afterBakeWeightGram: row.after_bake_weight_gram === null ? null : rowNumber(row, "after_bake_weight_gram"),
    weightPerPieceGram: rowNumber(row, "weight_per_piece_gram"),
    status: row.status as Product["status"],
    memo: rowString(row, "memo"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapRecipeItem(row: Record<string, unknown>): RecipeItem {
  return {
    id: rowString(row, "id"),
    productId: rowString(row, "product_id"),
    ingredientId: rowString(row, "ingredient_id"),
    itemType: row.item_type as RecipeItem["itemType"],
    intermediateProductId: rowString(row, "intermediate_product_id"),
    usageType: row.usage_type as RecipeItem["usageType"],
    amountGram: rowNumber(row, "amount_gram"),
    baseAmountGram: rowNumber(row, "base_amount_gram"),
    usedCount: rowNumber(row, "used_count"),
    totalCount: rowNumber(row, "total_count"),
    fractionDenominator: rowNumber(row, "fraction_denominator"),
    lossRate: rowNumber(row, "loss_rate"),
    memo: rowString(row, "memo"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

export async function loadAppDataFromSupabase(session: SaaSAuthSession, storeId: string): Promise<AppData | null> {
  const [
    ingredients,
    products,
    recipeItems,
    priceHistories,
    ingredientAliases,
    productCategories,
    wasteRecords,
    salesRecords,
    actualCostRecords,
    eventPlans,
    eventPlanItems,
    laborCosts,
    setProductItems,
    supportRows,
    billingRows,
  ] = await Promise.all([
    fetchTable(session, "ingredients", storeId, mapIngredient),
    fetchTable(session, "products", storeId, mapProduct),
    fetchTable(session, "recipe_items", storeId, mapRecipeItem),
    fetchTable(session, "price_histories", storeId, (row): PriceHistory => ({
      id: rowString(row, "id"),
      ingredientId: rowString(row, "ingredient_id"),
      oldPrice: rowNumber(row, "old_price"),
      newPrice: rowNumber(row, "new_price"),
      changedAt: rowString(row, "changed_at"),
      supplier: rowString(row, "supplier"),
      reason: rowString(row, "reason"),
      sourceType: row.source_type as PriceHistory["sourceType"],
      memo: rowString(row, "memo"),
    })),
    fetchTable(session, "ingredient_aliases", storeId, (row): IngredientAlias => ({
      id: rowString(row, "id"),
      sourceText: rowString(row, "source_text"),
      normalizedSourceText: rowString(row, "normalized_source_text"),
      name: rowString(row, "name"),
      packageName: rowString(row, "package_name"),
      supplier: rowString(row, "supplier"),
      category: rowString(row, "category"),
      labelName: rowString(row, "label_name"),
      caloriesPer100g: row.calories_per100g === null ? null : rowNumber(row, "calories_per100g"),
      proteinPer100g: row.protein_per100g === null ? null : rowNumber(row, "protein_per100g"),
      fatPer100g: row.fat_per100g === null ? null : rowNumber(row, "fat_per100g"),
      carbsPer100g: row.carbs_per100g === null ? null : rowNumber(row, "carbs_per100g"),
      saltPer100g: row.salt_per100g === null ? null : rowNumber(row, "salt_per100g"),
      useCount: rowNumber(row, "use_count"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
    fetchTable(session, "product_categories", storeId, (row) => rowString(row, "name")),
    fetchTable(session, "waste_records", storeId, (row): WasteRecord => ({
      id: rowString(row, "id"),
      date: rowString(row, "date"),
      itemType: row.item_type as WasteRecord["itemType"],
      itemId: rowString(row, "item_id"),
      quantity: rowNumber(row, "quantity"),
      costAmount: rowNumber(row, "cost_amount"),
      salesEquivalentAmount: rowNumber(row, "sales_equivalent_amount"),
      reason: row.reason as WasteRecord["reason"],
      memo: rowString(row, "memo"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
    fetchTable(session, "sales_records", storeId, (row): SalesRecord => ({
      id: rowString(row, "id"),
      month: rowString(row, "month"),
      productId: rowString(row, "product_id"),
      quantity: rowNumber(row, "quantity"),
      sellingPrice: rowNumber(row, "selling_price"),
      memo: rowString(row, "memo"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
    fetchTable(session, "actual_cost_records", storeId, (row): ActualCostRecord => ({
      id: rowString(row, "id"),
      month: rowString(row, "month"),
      supplier: rowString(row, "supplier"),
      amount: rowNumber(row, "amount"),
      memo: rowString(row, "memo"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
    fetchTable(session, "event_plans", storeId, (row): EventPlan => ({
      id: rowString(row, "id"),
      name: rowString(row, "name"),
      date: rowString(row, "date"),
      memo: rowString(row, "memo"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
    fetchTable(session, "event_plan_items", storeId, (row): EventPlanItem => ({
      id: rowString(row, "id"),
      eventPlanId: rowString(row, "event_plan_id"),
      productId: rowString(row, "product_id"),
      plannedQuantity: rowNumber(row, "planned_quantity"),
      sellingPrice: rowNumber(row, "selling_price"),
      memo: rowString(row, "memo"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
    fetchTable(session, "labor_costs", storeId, (row): LaborCost => ({
      id: rowString(row, "id"),
      productId: rowString(row, "product_id"),
      processName: rowString(row, "process_name"),
      minutes: rowNumber(row, "minutes"),
      workers: rowNumber(row, "workers"),
      hourlyWage: rowNumber(row, "hourly_wage"),
      memo: rowString(row, "memo"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
    fetchTable(session, "set_product_items", storeId, (row): SetProductItem => ({
      id: rowString(row, "id"),
      setProductId: rowString(row, "set_product_id"),
      childProductId: rowString(row, "child_product_id"),
      quantity: rowNumber(row, "quantity"),
      memo: rowString(row, "memo"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
    fetchTable(session, "onboarding_support_settings", storeId, (row) => row),
    fetchTable(session, "billing_settings", storeId, (row) => row),
  ]);

  if (!ingredients.length && !products.length && !recipeItems.length) return null;
  const support = supportRows[0] || {};
  const billing = billingRows[0] || {};
  return {
    ...sampleData,
    ingredients,
    products,
    recipeItems,
    priceHistories,
    ingredientAliases,
    productCategories,
    wasteRecords,
    salesRecords,
    actualCostRecords,
    eventPlans,
    eventPlanItems,
    laborCosts,
    setProductItems,
    inventoryRecords: [],
    onboardingSupport: {
      onboardingSupportEnabled: Boolean(support.enabled),
      onboardingSupportStartDate: rowString(support, "support_start_date"),
      onboardingSupportEndDate: rowString(support, "support_end_date"),
      officialLineUrl: rowString(support, "official_line_url"),
    },
    billing: {
      ocrUsedMonth: rowString(billing, "ocr_used_month"),
      ocrUsedThisMonth: rowNumber(billing, "ocr_used_this_month"),
      baseMonthlyPrice: rowNumber(billing, "base_monthly_price") || 1400,
      ocrBaseLimit: rowNumber(billing, "ocr_base_limit") || 30,
      ocrAddonPacks: rowNumber(billing, "ocr_addon_packs"),
      ocrAddonPackSize: rowNumber(billing, "ocr_addon_pack_size") || 50,
      ocrAddonPrice: rowNumber(billing, "ocr_addon_price") || 500,
      ocrAddonHistory: Array.isArray(billing.ocr_addon_history) ? billing.ocr_addon_history as AppData["billing"]["ocrAddonHistory"] : [],
    },
  };
}

async function replaceTableRows(session: SaaSAuthSession, table: string, storeId: string, rows: Record<string, unknown>[]) {
  const { url } = requireConfig();

  if (!rows.length) {
    console.warn(`Skipped empty cloud overwrite for ${table}. This prevents accidental data loss.`);
    return;
  }

  await readJson<Record<string, unknown>>(await fetch(`${url}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: { ...authHeaders(session.accessToken), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  }));

  const rowIds = rows.map((row) => row.id).filter((id) => id !== undefined && id !== null && String(id).trim());
  if (!rowIds.length) return;

  const staleFilter = `id=not.in.(${rowIds.map(postgrestListValue).join(",")})`;
  try {
    await readJson<Record<string, unknown>>(await fetch(`${url}/rest/v1/${table}?store_id=eq.${encodeURIComponent(storeId)}&${staleFilter}`, {
      method: "DELETE",
      headers: authHeaders(session.accessToken),
    }));
  } catch (error) {
    console.warn(`Cloud stale-row cleanup failed for ${table}. Saved rows were kept.`, error);
  }
}

export async function saveAppDataToSupabase(session: SaaSAuthSession, storeId: string, data: AppData) {
  const withStore = (row: Record<string, unknown>) => ({ store_id: storeId, ...row });
  await Promise.all([
    replaceTableRows(session, "ingredients", storeId, data.ingredients.map((item) => withStore({
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
    }))),
    replaceTableRows(session, "products", storeId, data.products.map((item) => withStore({
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
    }))),
    replaceTableRows(session, "recipe_items", storeId, data.recipeItems.map((item) => withStore({
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
    }))),
    replaceTableRows(session, "price_histories", storeId, data.priceHistories.map((item) => withStore({
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
    replaceTableRows(session, "product_categories", storeId, data.productCategories.map((name) => withStore({ id: `${storeId}-${name}`, name }))),
    replaceTableRows(session, "onboarding_support_settings", storeId, [withStore({
      id: `${storeId}-onboarding`,
      enabled: data.onboardingSupport.onboardingSupportEnabled,
      official_line_url: data.onboardingSupport.officialLineUrl,
      support_start_date: data.onboardingSupport.onboardingSupportStartDate || null,
      support_end_date: data.onboardingSupport.onboardingSupportEndDate || null,
      support_status: data.onboardingSupport.onboardingSupportEnabled ? "active" : "disabled",
    })]),
    replaceTableRows(session, "billing_settings", storeId, [withStore({
      id: `${storeId}-billing`,
      ocr_used_month: data.billing.ocrUsedMonth,
      ocr_used_this_month: data.billing.ocrUsedThisMonth,
      base_monthly_price: data.billing.baseMonthlyPrice,
      ocr_base_limit: data.billing.ocrBaseLimit,
      ocr_addon_packs: data.billing.ocrAddonPacks,
      ocr_addon_pack_size: data.billing.ocrAddonPackSize,
      ocr_addon_price: data.billing.ocrAddonPrice,
      ocr_addon_history: data.billing.ocrAddonHistory,
    })]),
    replaceTableRows(session, "ingredient_aliases", storeId, data.ingredientAliases.map((item) => withStore({
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
    replaceTableRows(session, "waste_records", storeId, data.wasteRecords.map((item) => withStore({
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
    replaceTableRows(session, "sales_records", storeId, data.salesRecords.map((item) => withStore({
      id: item.id,
      month: item.month,
      product_id: item.productId,
      quantity: item.quantity,
      selling_price: item.sellingPrice,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    replaceTableRows(session, "actual_cost_records", storeId, data.actualCostRecords.map((item) => withStore({
      id: item.id,
      month: item.month,
      supplier: item.supplier,
      amount: item.amount,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    replaceTableRows(session, "event_plans", storeId, data.eventPlans.map((item) => withStore({
      id: item.id,
      name: item.name,
      date: item.date,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    replaceTableRows(session, "event_plan_items", storeId, data.eventPlanItems.map((item) => withStore({
      id: item.id,
      event_plan_id: item.eventPlanId,
      product_id: item.productId,
      planned_quantity: item.plannedQuantity,
      selling_price: item.sellingPrice,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
    replaceTableRows(session, "labor_costs", storeId, data.laborCosts.map((item) => withStore({
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
    replaceTableRows(session, "set_product_items", storeId, data.setProductItems.map((item) => withStore({
      id: item.id,
      set_product_id: item.setProductId,
      child_product_id: item.childProductId,
      quantity: item.quantity,
      memo: item.memo,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))),
  ]);
}
