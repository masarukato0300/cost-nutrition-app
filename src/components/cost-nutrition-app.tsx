"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateEventSimulation,
  calculatePriceImpact,
  calculateProductionRequirements,
  calculateProductCost,
  calculateProductNutrition,
  calculateWasteRecordAmounts,
  calculateWasteMonthlySummary,
  calculateWasteSummary,
  calculateMonthlyTheoryCost,
  collectAllergens,
  collectLabelNames,
  calculateProductLaborCost,
  calculateSetProductCost,
  hasNutrition,
  ingredientUnitLabel,
  amountToGram,
  pricePerGram,
  recipeItemAmountGram,
  upsertSalesRecord,
} from "@/lib/calculations";
import { sampleData } from "@/lib/sample-data";
import { standardNutritionFoods } from "@/lib/standard-nutrition";
import type { StandardNutritionFood } from "@/lib/standard-nutrition";
import type { ActualCostRecord, AppData, EventPlan, EventSimulationRow, Ingredient, IngredientAlias, LaborCost, MaterialType, MonthlyTheoryRow, Product, ProductLaborCostSummary, ProductStatus, RecipeItem, RecipeUsageType, RequirementRow, SalesRecord, SetProductCostSummary, SetProductItem, WasteItemType, WasteMonthlySummary, WasteReason, WasteRecord } from "@/lib/types";

const defaultStoreId = "デモ店舗";
const legacyStorageKey = "cost-nutrition-label-mvp-v1";
const storesStorageKey = "cost-nutrition-label-mvp-stores-v1";
const currentStoreStorageKey = "cost-nutrition-label-mvp-current-store-v1";
const allergenOptions = ["卵", "乳", "小麦", "えび", "かに", "くるみ", "そば", "落花生"];
const materialTypeLabels: Record<MaterialType, string> = {
  PURCHASED_INGREDIENT: "仕入原材料",
  INTERMEDIATE: "中間材料",
  PRODUCT: "販売商品",
  PACKAGING: "包材",
};
const materialTypeOptions: MaterialType[] = ["PURCHASED_INGREDIENT", "PACKAGING"];
const wasteReasons: WasteReason[] = ["売れ残り", "破損", "作りすぎ", "試作", "品質不良", "その他"];
const wasteCategories = [
  { key: "baked", label: "焼菓子" },
  { key: "fresh", label: "生菓子" },
  { key: "semi", label: "半生菓子" },
  { key: "packaging", label: "包材" },
  { key: "ingredient", label: "原材料" },
] as const;
const pages = [
  { key: "top", label: "TOP" },
  { key: "help", label: "使い方" },
  { key: "ingredient", label: "原材料登録" },
  { key: "product", label: "商品登録" },
  { key: "productList", label: "商品一覧" },
  { key: "productCategory", label: "商品カテゴリ" },
  { key: "recipe", label: "レシピ登録" },
  { key: "cost", label: "原価計算" },
  { key: "nutrition", label: "栄養成分計算" },
  { key: "allergen", label: "アレルゲン一覧" },
  { key: "production", label: "仕込み量逆算" },
  { key: "order", label: "発注リスト" },
  { key: "waste", label: "廃棄ロス" },
  { key: "monthly", label: "月間理論原価" },
  { key: "event", label: "イベント原価" },
  { key: "labor", label: "人件費原価" },
  { key: "set", label: "詰合せ商品" },
  { key: "impact", label: "影響分析" },
  { key: "label", label: "ラベル表示" },
  { key: "csv", label: "CSV出力" },
  { key: "master", label: "原材料マスター" },
] as const;

type PageNavKey = (typeof pages)[number]["key"];
type PageKey = PageNavKey | "ocr";
type WasteCategoryKey = (typeof wasteCategories)[number]["key"];
const mainNavPageKeys: PageNavKey[] = ["top", "help", "ingredient", "product", "recipe"];
const navGroups = [
  { key: "costs", label: "原価・値上げ", description: "原価計算、値上げ、イベント、人件費", pages: ["cost", "impact", "event", "labor", "set"] },
  { key: "display", label: "表示・ラベル", description: "栄養成分、アレルゲン、ラベル", pages: ["nutrition", "allergen", "label"] },
  { key: "operation", label: "現場管理", description: "仕込み、発注、廃棄、月間原価", pages: ["production", "order", "waste", "monthly"] },
  { key: "data", label: "データ管理", description: "商品一覧、カテゴリ、原材料一覧、CSV出力", pages: ["productList", "productCategory", "master", "csv"] },
] as const satisfies Array<{ key: string; label: string; description: string; pages: PageNavKey[] }>;
type NavGroupKey = (typeof navGroups)[number]["key"];
const pageTones: Record<PageNavKey, { navActive: string; navIdle: string; topCard: string; mark: string }> = {
  top: {
    navActive: "border-emerald-700 bg-emerald-600 text-white shadow-sm",
    navIdle: "border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
    topCard: "border-emerald-100 bg-emerald-50/70 hover:border-emerald-400",
    mark: "bg-emerald-500",
  },
  help: {
    navActive: "border-sky-700 bg-sky-600 text-white shadow-sm",
    navIdle: "border-sky-500 bg-sky-50 text-sky-900 hover:bg-sky-100",
    topCard: "border-sky-100 bg-sky-50/70 hover:border-sky-400",
    mark: "bg-sky-500",
  },
  ingredient: {
    navActive: "border-red-700 bg-red-600 text-white shadow-sm",
    navIdle: "border-red-500 bg-red-50 text-red-900 hover:bg-red-100",
    topCard: "border-rose-100 bg-rose-50/70 hover:border-rose-400",
    mark: "bg-rose-500",
  },
  product: {
    navActive: "border-amber-700 bg-amber-500 text-white shadow-sm",
    navIdle: "border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100",
    topCard: "border-amber-100 bg-amber-50/70 hover:border-amber-400",
    mark: "bg-amber-500",
  },
  productList: {
    navActive: "border-orange-700 bg-orange-500 text-white shadow-sm",
    navIdle: "border-orange-500 bg-orange-50 text-orange-900 hover:bg-orange-100",
    topCard: "border-orange-100 bg-orange-50/70 hover:border-orange-400",
    mark: "bg-orange-500",
  },
  productCategory: {
    navActive: "border-yellow-700 bg-yellow-500 text-white shadow-sm",
    navIdle: "border-yellow-500 bg-yellow-50 text-yellow-900 hover:bg-yellow-100",
    topCard: "border-yellow-100 bg-yellow-50/70 hover:border-yellow-400",
    mark: "bg-yellow-500",
  },
  recipe: {
    navActive: "border-teal-700 bg-teal-600 text-white shadow-sm",
    navIdle: "border-teal-500 bg-teal-50 text-teal-900 hover:bg-teal-100",
    topCard: "border-teal-100 bg-teal-50/70 hover:border-teal-400",
    mark: "bg-teal-500",
  },
  cost: {
    navActive: "border-orange-700 bg-orange-600 text-white shadow-sm",
    navIdle: "border-orange-500 bg-orange-50 text-orange-900 hover:bg-orange-100",
    topCard: "border-orange-100 bg-orange-50/70 hover:border-orange-400",
    mark: "bg-orange-500",
  },
  nutrition: {
    navActive: "border-lime-700 bg-lime-600 text-white shadow-sm",
    navIdle: "border-lime-500 bg-lime-50 text-lime-900 hover:bg-lime-100",
    topCard: "border-lime-100 bg-lime-50/70 hover:border-lime-400",
    mark: "bg-lime-500",
  },
  allergen: {
    navActive: "border-fuchsia-700 bg-fuchsia-600 text-white shadow-sm",
    navIdle: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100",
    topCard: "border-fuchsia-100 bg-fuchsia-50/70 hover:border-fuchsia-400",
    mark: "bg-fuchsia-500",
  },
  production: {
    navActive: "border-green-700 bg-green-600 text-white shadow-sm",
    navIdle: "border-green-500 bg-green-50 text-green-900 hover:bg-green-100",
    topCard: "border-emerald-100 bg-emerald-50/70 hover:border-emerald-400",
    mark: "bg-emerald-500",
  },
  order: {
    navActive: "border-yellow-700 bg-yellow-500 text-white shadow-sm",
    navIdle: "border-yellow-500 bg-yellow-50 text-yellow-900 hover:bg-yellow-100",
    topCard: "border-yellow-100 bg-yellow-50/70 hover:border-yellow-400",
    mark: "bg-yellow-500",
  },
  waste: {
    navActive: "border-pink-700 bg-pink-600 text-white shadow-sm",
    navIdle: "border-pink-500 bg-pink-50 text-pink-900 hover:bg-pink-100",
    topCard: "border-pink-100 bg-pink-50/70 hover:border-pink-400",
    mark: "bg-pink-500",
  },
  monthly: {
    navActive: "border-blue-700 bg-blue-600 text-white shadow-sm",
    navIdle: "border-blue-500 bg-blue-50 text-blue-900 hover:bg-blue-100",
    topCard: "border-blue-100 bg-blue-50/70 hover:border-blue-400",
    mark: "bg-blue-500",
  },
  event: {
    navActive: "border-rose-700 bg-rose-600 text-white shadow-sm",
    navIdle: "border-rose-500 bg-rose-50 text-rose-900 hover:bg-rose-100",
    topCard: "border-rose-100 bg-rose-50/70 hover:border-rose-400",
    mark: "bg-rose-500",
  },
  labor: {
    navActive: "border-zinc-800 bg-zinc-700 text-white shadow-sm",
    navIdle: "border-zinc-500 bg-zinc-50 text-zinc-900 hover:bg-zinc-100",
    topCard: "border-stone-100 bg-stone-50/70 hover:border-stone-400",
    mark: "bg-stone-500",
  },
  set: {
    navActive: "border-purple-700 bg-purple-600 text-white shadow-sm",
    navIdle: "border-purple-500 bg-purple-50 text-purple-900 hover:bg-purple-100",
    topCard: "border-purple-100 bg-purple-50/70 hover:border-purple-400",
    mark: "bg-purple-500",
  },
  impact: {
    navActive: "border-red-800 bg-red-700 text-white shadow-sm",
    navIdle: "border-red-500 bg-red-50 text-red-900 hover:bg-red-100",
    topCard: "border-red-100 bg-red-50/70 hover:border-red-400",
    mark: "bg-red-500",
  },
  label: {
    navActive: "border-violet-700 bg-violet-600 text-white shadow-sm",
    navIdle: "border-violet-500 bg-violet-50 text-violet-900 hover:bg-violet-100",
    topCard: "border-violet-100 bg-violet-50/70 hover:border-violet-400",
    mark: "bg-violet-500",
  },
  csv: {
    navActive: "border-indigo-700 bg-indigo-600 text-white shadow-sm",
    navIdle: "border-indigo-500 bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
    topCard: "border-indigo-100 bg-indigo-50/70 hover:border-indigo-400",
    mark: "bg-indigo-500",
  },
  master: {
    navActive: "border-cyan-700 bg-cyan-600 text-white shadow-sm",
    navIdle: "border-cyan-500 bg-cyan-50 text-cyan-900 hover:bg-cyan-100",
    topCard: "border-cyan-100 bg-cyan-50/70 hover:border-cyan-400",
    mark: "bg-cyan-500",
  },
};
type StoreAccount = {
  id: string;
  pin: string;
  createdAt: string;
  updatedAt: string;
};
type StoreModalMode = "switch" | "create";
type OcrPriceCandidate = {
  id: string;
  ingredientId: string;
  line: string;
  oldPrice: number;
  newPrice: number;
  confidence: "高" | "中";
};
type IngredientVisionOcrResult = {
  name: string;
  packageName: string;
  supplier: string;
  packageAmount: number | null;
  packageUnit: string;
  price: number | null;
  rawText?: string;
  memo: string;
  confidence: "high" | "medium" | "low";
};
type IngredientVisionOcrResponse = {
  rawText: string;
  memo: string;
  ingredients: IngredientVisionOcrResult[];
};

function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 1 }).format(value || 0);
}

function number(value: number, digits = 1) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits }).format(value || 0);
}

function percent(value: number) {
  return `${number(value, 1)}%`;
}

function now() {
  return new Date().toISOString();
}

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function storeDataKey(storeId: string) {
  return `cost-nutrition-label-mvp-data-v1:${encodeURIComponent(storeId)}`;
}

function loadStores(): StoreAccount[] {
  if (typeof window === "undefined") return [{ id: defaultStoreId, pin: "0000", createdAt: now(), updatedAt: now() }];
  const saved = window.localStorage.getItem(storesStorageKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as StoreAccount[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // Fall through to default store.
    }
  }
  const defaultStore = { id: defaultStoreId, pin: "0000", createdAt: now(), updatedAt: now() };
  window.localStorage.setItem(storesStorageKey, JSON.stringify([defaultStore]));
  return [defaultStore];
}

function saveStores(stores: StoreAccount[]) {
  window.localStorage.setItem(storesStorageKey, JSON.stringify(stores));
}

function loadCurrentStoreId(stores: StoreAccount[]) {
  if (typeof window === "undefined") return stores[0]?.id ?? defaultStoreId;
  const saved = window.localStorage.getItem(currentStoreStorageKey);
  return stores.some((store) => store.id === saved) ? saved || defaultStoreId : stores[0]?.id ?? defaultStoreId;
}

function normalizeData(parsed: AppData): AppData {
  return {
    ...parsed,
    products: parsed.products.map((product) => ({
      ...product,
      isIntermediateMaterial: Boolean(product.isIntermediateMaterial),
      category: product.category || (product.isIntermediateMaterial ? "仕込み材料" : "未分類"),
      status: product.status || "販売中",
    })),
    ingredients: parsed.ingredients.map((ingredient) => ({
      ...ingredient,
      type: ingredient.type || inferMaterialType(ingredient),
      category: ingredient.category || inferIngredientCategory(ingredient.name),
      packageUnit: ingredient.packageUnit || "g",
      gramPerUnit: ingredient.gramPerUnit ?? 1,
    })),
    productCategories: Array.from(new Set([
      ...(parsed.productCategories || []),
      ...parsed.products.map((product) => product.category || (product.isIntermediateMaterial ? "仕込み材料" : "未分類")),
    ].filter(Boolean))),
    recipeItems: parsed.recipeItems.map(normalizeRecipeItem),
    ingredientAliases: parsed.ingredientAliases || [],
    wasteRecords: parsed.wasteRecords || [],
    salesRecords: parsed.salesRecords || [],
    actualCostRecords: parsed.actualCostRecords || [],
    eventPlans: parsed.eventPlans || [],
    eventPlanItems: parsed.eventPlanItems || [],
    laborCosts: parsed.laborCosts || [],
    setProductItems: parsed.setProductItems || [],
  };
}

function loadData(storeId = defaultStoreId): AppData {
  if (typeof window === "undefined") return sampleData;
  const saved = window.localStorage.getItem(storeDataKey(storeId)) || window.localStorage.getItem(legacyStorageKey);
  if (!saved) return sampleData;
  try {
    return normalizeData(JSON.parse(saved) as AppData);
  } catch {
    return sampleData;
  }
}

function normalizeRecipeItem(item: RecipeItem): RecipeItem {
  return {
    ...item,
    itemType: item.itemType || "ingredient",
    intermediateProductId: item.intermediateProductId || "",
    usageType: item.usageType || "gram",
    baseAmountGram: item.baseAmountGram || item.amountGram || 0,
    usedCount: item.usedCount || 1,
    totalCount: item.totalCount || 1,
    fractionDenominator: item.fractionDenominator || 1,
    lossRate: item.lossRate || 0,
    memo: item.memo || "",
  };
}

function inferIngredientCategory(text: string) {
  if (/包材|包装|箱|袋|シール|台紙|カップ|トレー|紙|フィルム/.test(text)) return "包材";
  if (/粉|小麦/.test(text)) return "粉類";
  if (/砂糖|糖|グラニュー|上白/.test(text)) return "糖類";
  if (/卵|玉子|液卵/.test(text)) return "卵";
  if (/バター|クリーム|乳|チーズ|牛乳/.test(text)) return "乳製品";
  if (/苺|いちご|フルーツ|果|ベリー/.test(text)) return "果物";
  return "未分類";
}

function inferMaterialType(ingredient: Pick<Ingredient, "type" | "category" | "name">): MaterialType {
  if (ingredient.type) return ingredient.type;
  return /包材|包装|箱|袋|シール|台紙|カップ|トレー|紙|フィルム|保冷剤|リボン|脱酸素剤/.test(`${ingredient.category} ${ingredient.name}`)
    ? "PACKAGING"
    : "PURCHASED_INGREDIENT";
}

function ingredientOptionLabel(ingredient: Ingredient) {
  return ingredient.packageName && ingredient.packageName !== ingredient.name
    ? `${ingredient.packageName}（${ingredient.name}）`
    : ingredient.name;
}

function pageTone(pageKey: PageNavKey) {
  return pageTones[pageKey];
}

function pageLabel(pageKey: PageNavKey) {
  return pages.find((page) => page.key === pageKey)?.label ?? pageKey;
}

function NavPictogram({ pageKey }: { pageKey: PageNavKey }) {
  const common = "fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round";
  const icons: Record<PageNavKey, React.ReactNode> = {
    top: <><path className={common} d="M4 11 12 4l8 7" /><path className={common} d="M6.5 10.5V20h11v-9.5" /><path className={common} d="M10 20v-5h4v5" /></>,
    help: <><circle className={common} cx="12" cy="12" r="9" /><path className={common} d="M9.5 9a2.6 2.6 0 0 1 5 1.1c0 2.4-2.5 2.2-2.5 4.4" /><path className={common} d="M12 18h.01" /></>,
    ingredient: <><path className={common} d="M9 3h6" /><path className={common} d="M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3" /><path className={common} d="M8 15h8" /></>,
    product: <><path className={common} d="M4 8h16v12H4z" /><path className={common} d="M7 8a5 5 0 0 1 10 0" /><path className={common} d="M8 12h8" /></>,
    productList: <><path className={common} d="M5 5h14" /><path className={common} d="M5 12h14" /><path className={common} d="M5 19h14" /><path className={common} d="M8 3v4M8 10v4M8 17v4" /></>,
    productCategory: <><path className={common} d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" /></>,
    recipe: <><path className={common} d="M7 4h10v17H7z" /><path className={common} d="M9 8h6M9 12h6M9 16h4" /><path className={common} d="M10 3h4" /></>,
    cost: <><circle className={common} cx="12" cy="12" r="9" /><path className={common} d="M8 7l4 5 4-5M9 13h6M9 16h6" /></>,
    nutrition: <><path className={common} d="M5 13c0-5 4-8 11-8 0 7-3 11-8 11-2 0-3-1-3-3Z" /><path className={common} d="M8 16c2-4 5-6 8-8" /></>,
    allergen: <><path className={common} d="M12 3 22 20H2L12 3Z" /><path className={common} d="M12 9v5" /><path className={common} d="M12 18h.01" /></>,
    production: <><path className={common} d="M4 18h16" /><path className={common} d="M7 18V9l5-4 5 4v9" /><path className={common} d="M9 13h6" /></>,
    order: <><path className={common} d="M4 5h2l2 10h9l2-7H7" /><circle className={common} cx="10" cy="20" r="1" /><circle className={common} cx="17" cy="20" r="1" /></>,
    waste: <><path className={common} d="M5 7h14" /><path className={common} d="M9 7V4h6v3" /><path className={common} d="M8 10v10h8V10" /><path className={common} d="M11 11v7M14 11v7" /></>,
    monthly: <><path className={common} d="M4 20h16" /><path className={common} d="M6 16v-4M12 16V7M18 16v-8" /></>,
    event: <><path className={common} d="M5 5h14v15H5z" /><path className={common} d="M8 3v4M16 3v4M5 10h14" /><path className={common} d="m12 13 1 2 2 .2-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 15.2l2-.2 1-2Z" /></>,
    labor: <><circle className={common} cx="12" cy="8" r="3" /><path className={common} d="M5 21c1-5 4-8 7-8s6 3 7 8" /><path className={common} d="M17 4h4v4" /></>,
    set: <><path className={common} d="M4 7h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7z" /><path className={common} d="M7.5 7V5M16.5 13v-2" /></>,
    impact: <><path className={common} d="M4 18h16" /><path className={common} d="M7 15 12 9l3 3 4-6" /><path className={common} d="M16 6h3v3" /></>,
    label: <><path className={common} d="M4 5h10l6 6-9 9-7-7V5Z" /><circle className={common} cx="9" cy="10" r="1" /></>,
    csv: <><path className={common} d="M6 3h9l3 3v15H6z" /><path className={common} d="M15 3v4h4" /><path className={common} d="M8 14h8M8 17h8M8 11h4" /></>,
    master: <><ellipse className={common} cx="12" cy="6" rx="7" ry="3" /><path className={common} d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path className={common} d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
  };

  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24">
      {icons[pageKey]}
    </svg>
  );
}

function isNutritionEmpty(ingredient: Ingredient) {
  return [
    ingredient.caloriesPer100g,
    ingredient.proteinPer100g,
    ingredient.fatPer100g,
    ingredient.carbsPer100g,
    ingredient.saltPer100g,
  ].every((value) => !value);
}

function ingredientSearchTerms(ingredient: Ingredient) {
  const text = normalizeText(`${ingredient.name} ${ingredient.packageName} ${ingredient.labelName}`);
  const terms = [ingredient.name, ingredient.packageName, ingredient.labelName]
    .map((value) => normalizeText(value || ""))
    .filter(Boolean);
  if (/グラニュー|上白|砂糖|糖/.test(text)) terms.push("砂糖", "糖");
  if (/生クリーム|クリーム|乳脂肪/.test(text)) terms.push("生クリーム", "クリーム", "乳");
  if (/バター/.test(text)) terms.push("バター", "乳");
  if (/全卵|卵|玉子|液卵/.test(text)) terms.push("卵", "全卵");
  if (/薄力粉|小麦粉|粉/.test(text)) terms.push("薄力粉", "小麦粉", "粉");
  if (/苺|いちご|ストロベリー/.test(text)) terms.push("苺", "いちご");
  return Array.from(new Set(terms.filter((term) => term.length >= 1)));
}

function findNutritionCandidate(target: Ingredient, ingredients: Ingredient[]) {
  const targetTerms = ingredientSearchTerms(target);
  return ingredients
    .filter((ingredient) => ingredient.id !== target.id && hasNutrition(ingredient))
    .map((ingredient) => {
      const terms = ingredientSearchTerms(ingredient);
      const termScore = targetTerms.reduce((score, targetTerm) => (
        score + terms.reduce((innerScore, term) => (
          targetTerm.includes(term) || term.includes(targetTerm) ? innerScore + Math.min(targetTerm.length, term.length) : innerScore
        ), 0)
      ), 0);
      const categoryScore = target.category && target.category !== "未分類" && ingredient.category === target.category ? 2 : 0;
      return { ingredient, score: termScore + categoryScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.ingredient;
}

function copyNutrition(target: Ingredient, source: Ingredient): Ingredient {
  return {
    ...target,
    caloriesPer100g: source.caloriesPer100g,
    proteinPer100g: source.proteinPer100g,
    fatPer100g: source.fatPer100g,
    carbsPer100g: source.carbsPer100g,
    saltPer100g: source.saltPer100g,
  };
}

function findDuplicateIngredients(target: Ingredient, ingredients: Ingredient[]) {
  const targetNames = [target.name, target.packageName, target.labelName].map((value) => normalizeText(value || "")).filter(Boolean);
  if (targetNames.length === 0) return [];
  return ingredients
    .map((ingredient) => {
      if (ingredient.id && ingredient.id === target.id) return { ingredient, score: 0 };
      const names = [ingredient.name, ingredient.packageName, ingredient.labelName].map((value) => normalizeText(value || "")).filter(Boolean);
      const score = targetNames.reduce((maxScore, targetName) => Math.max(
        maxScore,
        ...names.map((name) => ingredientNameMatchScore(targetName, name)),
      ), 0);
      const supplierScore = target.supplier && ingredient.supplier && normalizeText(target.supplier) === normalizeText(ingredient.supplier) ? 8 : 0;
      return { ingredient, score: score + supplierScore };
    })
    .filter((item) => item.score >= 16)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.ingredient);
}

function ingredientNameMatchScore(targetName: string, name: string) {
  if (!targetName || !name) return 0;
  if (targetName === name) return 100;
  if (targetName.length >= 3 && name.includes(targetName)) return 70 + targetName.length;
  if (name.length >= 3 && targetName.includes(name)) return 60 + name.length;
  const targetChars = Array.from(new Set(targetName.split("")));
  const nameChars = Array.from(new Set(name.split("")));
  const commonChars = targetChars.filter((char) => nameChars.includes(char)).length;
  const overlap = commonChars / Math.max(targetChars.length, nameChars.length, 1);
  const targetBigrams = bigrams(targetName);
  const nameBigrams = bigrams(name);
  const commonBigrams = targetBigrams.filter((gram) => nameBigrams.includes(gram)).length;
  const bigramOverlap = commonBigrams / Math.max(targetBigrams.length, nameBigrams.length, 1);
  return Math.round(overlap * 22 + bigramOverlap * 36);
}

function bigrams(value: string) {
  if (value.length <= 1) return [value];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}

function aliasSourceTexts(ingredient: Ingredient) {
  return Array.from(new Set([
    ingredient.name,
    ingredient.packageName,
    ingredient.labelName,
    `${ingredient.supplier} ${ingredient.packageName}`,
    `${ingredient.name} ${ingredient.packageName}`,
  ].map((value) => value.trim()).filter(Boolean)));
}

function ingredientAliasFromIngredient(ingredient: Ingredient, sourceText: string, existing?: IngredientAlias): IngredientAlias {
  const timestamp = now();
  return {
    id: existing?.id || createId("alias"),
    sourceText,
    normalizedSourceText: normalizeText(sourceText),
    name: ingredient.name,
    packageName: ingredient.packageName,
    supplier: ingredient.supplier,
    category: ingredient.category,
    labelName: ingredient.labelName || ingredient.name,
    caloriesPer100g: ingredient.caloriesPer100g,
    proteinPer100g: ingredient.proteinPer100g,
    fatPer100g: ingredient.fatPer100g,
    carbsPer100g: ingredient.carbsPer100g,
    saltPer100g: ingredient.saltPer100g,
    useCount: (existing?.useCount || 0) + 1,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function learnIngredientAliases(aliases: IngredientAlias[], ingredient: Ingredient) {
  return aliasSourceTexts(ingredient).reduce((nextAliases, sourceText) => {
    const normalizedSourceText = normalizeText(sourceText);
    const existing = nextAliases.find((alias) => alias.normalizedSourceText === normalizedSourceText);
    const learned = ingredientAliasFromIngredient(ingredient, sourceText, existing);
    return existing
      ? nextAliases.map((alias) => (alias.id === existing.id ? learned : alias))
      : [...nextAliases, learned];
  }, aliases);
}

function findIngredientAlias(target: Ingredient, aliases: IngredientAlias[]) {
  const targetTerms = [target.name, target.packageName, target.labelName]
    .map((value) => normalizeText(value || ""))
    .filter(Boolean);
  if (targetTerms.length === 0) return null;
  return aliases
    .map((alias) => {
      const aliasText = alias.normalizedSourceText;
      const score = targetTerms.reduce((sum, term) => {
        if (aliasText === term) return sum + 100;
        if (aliasText.includes(term)) return sum + term.length + 20;
        if (term.includes(aliasText)) return sum + aliasText.length + 10;
        return sum;
      }, alias.useCount);
      return { alias, score };
    })
    .filter((item) => item.score >= 10)
    .sort((a, b) => b.score - a.score)[0]?.alias ?? null;
}

function applyIngredientAlias(target: Ingredient, alias: IngredientAlias) {
  return {
    ...target,
    name: alias.name || target.name,
    packageName: alias.packageName || target.packageName,
    supplier: alias.supplier || target.supplier,
    category: alias.category || target.category,
    labelName: alias.labelName || target.labelName,
    caloriesPer100g: alias.caloriesPer100g ?? target.caloriesPer100g,
    proteinPer100g: alias.proteinPer100g ?? target.proteinPer100g,
    fatPer100g: alias.fatPer100g ?? target.fatPer100g,
    carbsPer100g: alias.carbsPer100g ?? target.carbsPer100g,
    saltPer100g: alias.saltPer100g ?? target.saltPer100g,
    memo: [target.memo, `登録履歴から反映: ${alias.sourceText}`].filter(Boolean).join("\n"),
  };
}

function standardNutritionScore(food: StandardNutritionFood, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;
  const normalizedName = normalizeText(food.name);
  if (normalizedName.includes(normalizedQuery)) return normalizedQuery.length + 20;
  if (normalizedQuery.includes(normalizedName)) return normalizedName.length + 10;
  return ingredientSearchTerms({
    ...emptyIngredient(),
    name: query,
    packageName: query,
  }).reduce((score, term) => (
    normalizedName.includes(term) ? score + term.length : score
  ), 0);
}

function searchStandardNutritionFoods(query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];
  return standardNutritionFoods
    .map((food) => ({ food, score: standardNutritionScore(food, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, 20)
    .map((item) => item.food);
}

function topPageDescription(pageKey: PageKey) {
  const descriptions: Record<PageKey, string> = {
    top: "各機能への入口",
    help: "初めて使う方向けの操作ガイド",
    ingredient: "原材料、製品名、価格、栄養成分を登録",
    product: "商品名、売価、出来上がり個数を登録",
    productList: "登録済み商品をカテゴリ別に確認",
    productCategory: "商品カテゴリを追加・削除",
    recipe: "製品名から材料を選び、使用量を入力",
    cost: "材料原価と包材込み原価を確認",
    nutrition: "レシピから栄養成分表示を計算",
    allergen: "商品ごとのアレルゲンを一覧確認",
    production: "予定数から必要材料を逆算",
    order: "必要材料を仕入先別に確認",
    waste: "廃棄や試作ロスを記録",
    monthly: "販売数から理論原価を確認",
    event: "イベント販売の粗利を試算",
    labor: "作業時間から実質原価を確認",
    set: "ギフトや詰め合わせの原価を計算",
    impact: "価格変更時の影響商品を確認",
    ocr: "OCR読み取り結果から価格更新候補を作成",
    label: "確認用ラベルテキストを作成",
    csv: "原材料や商品原価をCSVで出力",
    master: "登録済み原材料を一覧確認",
  };
  return descriptions[pageKey];
}

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[・･\s\-ーｰ]/g, "");
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function downloadCsv(fileName: string, rows: Array<Array<string | number | null | undefined>>) {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function wasteRecordItemName(record: WasteRecord, data: AppData) {
  if (record.itemType === "INGREDIENT") {
    return data.ingredients.find((ingredient) => ingredient.id === record.itemId)?.name ?? "削除済み原材料";
  }
  return data.products.find((product) => product.id === record.itemId)?.name ?? "削除済み商品";
}

function productBelongsToWasteCategory(product: Product, category: WasteCategoryKey) {
  const text = `${product.category} ${product.name}`;
  if (product.isIntermediateMaterial) return false;
  if (category === "baked") return /焼菓子|ギフト|詰合せ|カステラ|マドレーヌ|クッキー|サブレ|フィナンシェ/.test(text);
  if (category === "fresh") return /生菓子|プティガトー|ケーキ|ショート|ロール|カフェ|フレンチ/.test(text);
  if (category === "semi") return /半生|パウンド|ダックワーズ|ブッセ|常温/.test(text);
  return false;
}

function wasteCategoryRows(data: AppData, category: WasteCategoryKey) {
  if (category === "packaging") {
    return data.ingredients
      .filter((ingredient) => ingredient.type === "PACKAGING")
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.packageName || ingredient.name,
        subName: ingredient.packageName && ingredient.packageName !== ingredient.name ? ingredient.name : ingredient.supplier,
        itemType: "INGREDIENT" as WasteItemType,
        unit: ingredientUnitLabel(ingredient),
        step: 1,
      }));
  }
  if (category === "ingredient") {
    return data.ingredients
      .filter((ingredient) => ingredient.type !== "PACKAGING")
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.packageName || ingredient.name,
        subName: ingredient.packageName && ingredient.packageName !== ingredient.name ? ingredient.name : ingredient.supplier,
        itemType: "INGREDIENT" as WasteItemType,
        unit: ingredientUnitLabel(ingredient),
        step: ingredientUnitLabel(ingredient) === "g" || ingredientUnitLabel(ingredient) === "ml" ? 100 : 1,
      }));
  }
  return data.products
    .filter((product) => productBelongsToWasteCategory(product, category))
    .map((product) => ({
      id: product.id,
      name: product.name,
      subName: product.category,
      itemType: "PRODUCT" as WasteItemType,
      unit: "個",
      step: 1,
    }));
}

function extractPriceNumbers(line: string) {
  return Array.from(line.matchAll(/\d[\d,]*(?:\.\d+)?/g))
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 10);
}

function normalizePackageAmount(amount: number, unit: string) {
  const normalizedUnit = unit.trim().replace("Ｋ", "K").replace("ｋ", "k").replace("Ｇ", "G").replace("ｇ", "g").replace("Ｌ", "L").replace("ｌ", "l");
  const lowerUnit = normalizedUnit.toLowerCase();
  if (lowerUnit === "kg" || normalizedUnit === "キロ") return { amount: amount * 1000, unit: "g", gramPerUnit: 1 };
  if (lowerUnit === "l" || normalizedUnit === "リットル") return { amount: amount * 1000, unit: "g", gramPerUnit: 1 };
  if (lowerUnit === "ml" || normalizedUnit === "ｍｌ") return { amount, unit: "g", gramPerUnit: 1 };
  if (lowerUnit === "g") return { amount, unit: "g", gramPerUnit: 1 };
  return { amount, unit: normalizedUnit || "g", gramPerUnit: 1 };
}

function extractPreferredPrice(text: string, fallbackPrice: number) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const preferredLine = lines.find((line) => /単価|新価格|改定後|売単価|価格改定後|新単価/.test(line) && !/合計|小計|請求|総額|伝票合計/.test(line));
  const preferredPrices = preferredLine ? extractPriceNumbers(preferredLine) : [];
  if (preferredPrices.length > 0) return preferredPrices[preferredPrices.length - 1];
  const filteredLines = lines.filter((line) => !/合計|小計|請求|総額|伝票合計|税込合計|金額合計/.test(line));
  const prices = extractPriceNumbers(filteredLines.join("\n"));
  return prices.length > 0 ? prices[prices.length - 1] : fallbackPrice;
}

function matchIngredientFromLine(line: string, ingredients: Ingredient[]) {
  const normalizedLine = normalizeText(line);
  return ingredients
    .map((ingredient) => {
      const names = [ingredient.packageName, ingredient.name, ingredient.labelName].filter(Boolean);
      const score = names.reduce((maxScore, name) => {
        const normalizedName = normalizeText(name);
        if (!normalizedName) return maxScore;
        if (normalizedLine.includes(normalizedName)) return Math.max(maxScore, normalizedName.length + 10);
        if (normalizedName.includes(normalizedLine)) return Math.max(maxScore, normalizedLine.length);
        return maxScore;
      }, 0);
      return { ingredient, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.ingredient;
}

function parseOcrPriceCandidates(text: string, ingredients: Ingredient[]): OcrPriceCandidate[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const ingredient = matchIngredientFromLine(line, ingredients);
      const prices = extractPriceNumbers(line);
      if (!ingredient || prices.length === 0) return [];
      const newPrice = prices[prices.length - 1];
      const oldPrice = prices.length >= 2 ? prices[prices.length - 2] : ingredient.price;
      if (!newPrice || newPrice === ingredient.price) return [];
      return [{
        id: `${ingredient.id}-${line}`,
        ingredientId: ingredient.id,
        line,
        oldPrice,
        newPrice,
        confidence: line.includes(ingredient.packageName || ingredient.name) ? "高" : "中",
      }];
    });
}

function findOcrValue(text: string, patterns: RegExp[]) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const pattern of patterns) {
    const matchedLine = lines.find((line) => pattern.test(line));
    if (matchedLine) {
      return matchedLine
        .replace(pattern, "")
        .replace(/[:：]/g, "")
        .trim();
    }
  }
  return "";
}

function parseIngredientOcrText(text: string, base: Ingredient): Ingredient {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const price = extractPreferredPrice(text, base.price);
  const name = findOcrValue(text, [/^原材料名\s*[:：]?/, /^材料名\s*[:：]?/, /^品名\s*[:：]?/]) || lines[0] || base.name;
  const packageName = findOcrValue(text, [/^製品名\s*[:：]?/, /^商品名\s*[:：]?/]) || base.packageName || name;
  const supplier = findOcrValue(text, [/^仕入先\s*[:：]?/, /^メーカー\s*[:：]?/, /^供給元\s*[:：]?/]) || base.supplier;
  const amountText = findOcrValue(text, [/^内容量\s*[:：]?/, /^容量\s*[:：]?/, /^入数\s*[:：]?/]);
  const amountMatch = amountText.match(/\d[\d,]*(?:\.\d+)?/);
  const unitMatch = amountText.match(/[a-zA-Zぁ-んァ-ヶ一-龠枚個本袋箱mLmlLkgｇg]+$/);
  const normalizedAmount = normalizePackageAmount(
    amountMatch ? Number(amountMatch[0].replace(/,/g, "")) : base.packageAmountGram,
    unitMatch?.[0] || base.packageUnit,
  );
  const category = base.category && base.category !== "未分類" ? base.category : inferIngredientCategory(`${name} ${packageName}`);
  return {
    ...base,
    name,
    category,
    packageName,
    supplier,
    packageAmountGram: normalizedAmount.amount,
    packageUnit: normalizedAmount.unit,
    gramPerUnit: normalizedAmount.gramPerUnit,
    price,
  };
}

function fileToImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。JPGまたはPNGで試してください。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像形式を読み込めませんでした。iPad設定で「互換性優先」にしてJPGで撮影してください。"));
    image.src = src;
  });
}

type OcrCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OcrCandidateStatus = "未処理" | "反映済み" | "スキップ";

const defaultOcrCrop: OcrCrop = { x: 4, y: 5, width: 92, height: 88 };

async function preprocessImageForOcr(dataUrl: string, crop: OcrCrop = defaultOcrCrop): Promise<string> {
  const image = await loadImage(dataUrl);
  const maxSize = 3200;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const sourceX = Math.max(0, Math.round((image.naturalWidth * crop.x) / 100));
  const sourceY = Math.max(0, Math.round((image.naturalHeight * crop.y) / 100));
  const sourceWidth = Math.max(1, Math.round((image.naturalWidth * crop.width) / 100));
  const sourceHeight = Math.max(1, Math.round((image.naturalHeight * crop.height) / 100));
  const croppedWidth = Math.min(sourceWidth, image.naturalWidth - sourceX);
  const croppedHeight = Math.min(sourceHeight, image.naturalHeight - sourceY);
  const croppedMax = Math.max(croppedWidth, croppedHeight);
  const croppedScale = Math.min(1, maxSize / croppedMax);
  const outputWidth = Math.max(1, Math.round(croppedWidth * croppedScale));
  const outputHeight = Math.max(1, Math.round(croppedHeight * croppedScale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth || width;
  canvas.height = outputHeight || height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, sourceX, sourceY, croppedWidth, croppedHeight, 0, 0, canvas.width, canvas.height);
  enhanceCanvasForOcr(context, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.95);
}

async function autoDetectOcrCrop(dataUrl: string): Promise<OcrCrop> {
  const image = await loadImage(dataUrl);
  const maxScanWidth = 900;
  const scale = Math.min(1, maxScanWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return defaultOcrCrop;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      const gray = imageData[index] * 0.299 + imageData[index + 1] * 0.587 + imageData[index + 2] * 0.114;
      if (gray < 210) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (minX >= maxX || minY >= maxY) return defaultOcrCrop;
  const padX = width * 0.03;
  const padY = height * 0.04;
  const x = Math.max(0, ((minX - padX) / width) * 100);
  const y = Math.max(0, ((minY - padY) / height) * 100);
  const right = Math.min(100, ((maxX + padX) / width) * 100);
  const bottom = Math.min(100, ((maxY + padY) / height) * 100);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(20, Math.round(right - x)),
    height: Math.max(20, Math.round(bottom - y)),
  };
}

async function splitOcrImageIntoRows(dataUrl: string): Promise<string[]> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return [dataUrl];
  context.drawImage(image, 0, 0);
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height).data;
  const darkRows: number[] = [];
  for (let y = 0; y < height; y += 1) {
    let darkPixels = 0;
    for (let x = 0; x < width; x += 6) {
      const index = (y * width + x) * 4;
      if (imageData[index] < 175) darkPixels += 1;
    }
    if (darkPixels > width / 180) darkRows.push(y);
  }
  const bands: Array<{ start: number; end: number }> = [];
  let start = -1;
  let previous = -1;
  for (const row of darkRows) {
    if (start === -1) start = row;
    if (previous !== -1 && row - previous > 18) {
      bands.push({ start, end: previous });
      start = row;
    }
    previous = row;
  }
  if (start !== -1) bands.push({ start, end: previous });
  const rowBands = bands
    .map((band) => ({ start: Math.max(0, band.start - 34), end: Math.min(height, band.end + 34) }))
    .filter((band) => band.end - band.start >= 48);
  if (rowBands.length > 10) return [dataUrl];
  if (rowBands.length < 2) return [dataUrl];
  return rowBands.map((band) => {
    const rowCanvas = document.createElement("canvas");
    rowCanvas.width = width;
    rowCanvas.height = Math.max(140, band.end - band.start);
    const rowContext = rowCanvas.getContext("2d");
    if (!rowContext) return dataUrl;
    rowContext.fillStyle = "#ffffff";
    rowContext.fillRect(0, 0, rowCanvas.width, rowCanvas.height);
    const drawTop = Math.max(0, Math.round((rowCanvas.height - (band.end - band.start)) / 2));
    rowContext.drawImage(canvas, 0, band.start, width, band.end - band.start, 0, drawTop, width, band.end - band.start);
    return rowCanvas.toDataURL("image/jpeg", 0.95);
  });
}

function enhanceCanvasForOcr(context: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(imageData.data);
  const data = imageData.data;
  const contrast = 1.35;
  const brightness = 8;

  for (let index = 0; index < data.length; index += 4) {
    const gray = source[index] * 0.299 + source[index + 1] * 0.587 + source[index + 2] * 0.114;
    const boosted = Math.max(0, Math.min(255, (gray - 128) * contrast + 128 + brightness));
    data[index] = boosted;
    data[index + 1] = boosted;
    data[index + 2] = boosted;
  }

  const sharpened = new Uint8ClampedArray(data);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      let sum = 0;
      let kernelIndex = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const neighborIndex = ((y + ky) * width + x + kx) * 4;
          sum += sharpened[neighborIndex] * kernel[kernelIndex];
          kernelIndex += 1;
        }
      }
      const value = Math.max(0, Math.min(255, sum));
      data[pixelIndex] = value;
      data[pixelIndex + 1] = value;
      data[pixelIndex + 2] = value;
    }
  }
  context.putImageData(imageData, 0, 0);
}

function ingredientFromVisionResult(result: IngredientVisionOcrResult, base: Ingredient): Ingredient {
  const exactName = result.name.trim();
  const exactPackageName = result.packageName.trim();
  const exactSupplier = result.supplier.trim();
  const generatedText = [
    exactName ? `原材料名: ${exactName}` : "",
    exactPackageName ? `製品名: ${exactPackageName}` : "",
    exactSupplier ? `仕入先: ${exactSupplier}` : "",
    result.packageAmount ? `内容量: ${result.packageAmount}${result.packageUnit}` : "",
    result.price ? `単価: ${result.price}円` : "",
    result.rawText ? `読み取り文字:\n${result.rawText}` : "",
  ].filter(Boolean).join("\n");
  const parsed = parseIngredientOcrText(generatedText, base);
  return {
    ...parsed,
    name: exactName || parsed.name,
    packageName: exactPackageName || parsed.packageName || exactName || parsed.name,
    supplier: exactSupplier || parsed.supplier,
    labelName: exactName || base.labelName || parsed.labelName,
    memo: [base.memo, result.memo, `AI OCR信頼度: ${result.confidence}`].filter(Boolean).join("\n"),
  };
}

const emptyIngredient = (): Ingredient => ({
  id: "",
  name: "",
  type: "PURCHASED_INGREDIENT",
  category: "未分類",
  supplier: "",
  packageName: "",
  packageAmountGram: 1000,
  packageUnit: "g",
  gramPerUnit: 1,
  price: 0,
  taxType: "税抜",
  caloriesPer100g: 0,
  proteinPer100g: 0,
  fatPer100g: 0,
  carbsPer100g: 0,
  saltPer100g: 0,
  allergens: [],
  otherAllergen: "",
  labelName: "",
  memo: "",
  createdAt: now(),
  updatedAt: now(),
});

const emptyProduct = (): Product => ({
  id: "",
  name: "",
  isIntermediateMaterial: false,
  category: "未分類",
  sellingPrice: 0,
  taxType: "税込",
  targetCostRate: 32,
  displayUnit: "1個あたり",
  yieldCount: 1,
  beforeBakeWeightGram: 0,
  afterBakeWeightGram: null,
  weightPerPieceGram: 0,
  status: "販売中",
  memo: "",
  createdAt: now(),
  updatedAt: now(),
});

const currentMonth = () => new Date().toISOString().slice(0, 7);

const emptyActualCostRecord = (): ActualCostRecord => ({
  id: "",
  month: currentMonth(),
  supplier: "",
  amount: 0,
  memo: "",
  createdAt: now(),
  updatedAt: now(),
});

const emptyEventPlan = (): EventPlan => ({
  id: "",
  name: "",
  date: new Date().toISOString().slice(0, 10),
  memo: "",
  createdAt: now(),
  updatedAt: now(),
});

const emptyLaborCost = (productId = ""): LaborCost => ({
  id: "",
  productId,
  processName: "",
  minutes: 0,
  workers: 1,
  hourlyWage: 1200,
  memo: "",
  createdAt: now(),
  updatedAt: now(),
});

const emptySetProductItem = (setProductId = "", childProductId = ""): SetProductItem => ({
  id: "",
  setProductId,
  childProductId,
  quantity: 1,
  memo: "",
  createdAt: now(),
  updatedAt: now(),
});

export function CostNutritionApp() {
  const ingredientCameraInputRef = useRef<HTMLInputElement | null>(null);
  const ingredientPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [activePage, setActivePage] = useState<PageKey>("top");
  const [openNavGroup, setOpenNavGroup] = useState<NavGroupKey | null>(null);
  const [stores, setStores] = useState<StoreAccount[]>([{ id: defaultStoreId, pin: "0000", createdAt: now(), updatedAt: now() }]);
  const [currentStoreId, setCurrentStoreId] = useState(defaultStoreId);
  const [data, setData] = useState<AppData>(sampleData);
  const [selectedProductId, setSelectedProductId] = useState(sampleData.products[0]?.id ?? "");
  const [ingredientForm, setIngredientForm] = useState<Ingredient>(() => emptyIngredient());
  const [showIngredientUnitConversion, setShowIngredientUnitConversion] = useState(false);
  const [productForm, setProductForm] = useState<Product>(() => emptyProduct());
  const [productCategoryForm, setProductCategoryForm] = useState("");
  const [activeProductCategory, setActiveProductCategory] = useState("すべて");
  const [recipeProductName, setRecipeProductName] = useState("");
  const [recipeProductSelectId, setRecipeProductSelectId] = useState("");
  const [recipeIngredientId, setRecipeIngredientId] = useState(data.ingredients[0]?.id ?? "");
  const [recipeProductIsIntermediate, setRecipeProductIsIntermediate] = useState(false);
  const [activeIngredientCategory, setActiveIngredientCategory] = useState("すべて");
  const [impactIngredientId, setImpactIngredientId] = useState(data.ingredients[4]?.id ?? data.ingredients[0]?.id ?? "");
  const [impactNewPrice, setImpactNewPrice] = useState(data.ingredients[4]?.price + 100 || 0);
  const [ocrText, setOcrText] = useState("価格改定のお知らせ\n乳脂肪42% 1L　760円 → 860円\nグラニュー糖 30kg　6,100円 → 6,800円");
  const [ocrCandidates, setOcrCandidates] = useState<OcrPriceCandidate[]>([]);
  const [ocrImageName, setOcrImageName] = useState("");
  const [newStoreId, setNewStoreId] = useState("");
  const [newStorePin, setNewStorePin] = useState("");
  const [switchStoreId, setSwitchStoreId] = useState(defaultStoreId);
  const [switchStorePin, setSwitchStorePin] = useState("");
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [storeModalMode, setStoreModalMode] = useState<StoreModalMode>("switch");
  const [ingredientOcrImageName, setIngredientOcrImageName] = useState("");
  const [ingredientOcrStatus, setIngredientOcrStatus] = useState("");
  const [isIngredientOcrReading, setIsIngredientOcrReading] = useState(false);
  const [pendingIngredientOcrImage, setPendingIngredientOcrImage] = useState("");
  const [pendingIngredientOcrImageName, setPendingIngredientOcrImageName] = useState("");
  const [ingredientOcrCrop, setIngredientOcrCrop] = useState<OcrCrop>(defaultOcrCrop);
  const [splitIngredientOcrByRows, setSplitIngredientOcrByRows] = useState(true);
  const [ingredientOcrCandidate, setIngredientOcrCandidate] = useState<Ingredient | null>(null);
  const [ingredientOcrCandidates, setIngredientOcrCandidates] = useState<Ingredient[]>([]);
  const [ingredientOcrCandidateIndex, setIngredientOcrCandidateIndex] = useState(0);
  const [ingredientOcrCandidateStatuses, setIngredientOcrCandidateStatuses] = useState<Record<number, OcrCandidateStatus>>({});
  const [isIngredientOcrListOpen, setIsIngredientOcrListOpen] = useState(false);
  const [selectedOcrDuplicateIngredientId, setSelectedOcrDuplicateIngredientId] = useState("");
  const [nutritionSearchText, setNutritionSearchText] = useState("");
  const [selectedStandardNutritionId, setSelectedStandardNutritionId] = useState("");
  const [appliedStandardNutritionId, setAppliedStandardNutritionId] = useState("");
  const [activeWasteCategory, setActiveWasteCategory] = useState<WasteCategoryKey>("baked");
  const [wasteDate, setWasteDate] = useState(todayDate());
  const [wasteReason, setWasteReason] = useState<WasteReason>("売れ残り");
  const [wasteSummaryMonth, setWasteSummaryMonth] = useState(currentMonth());
  const [monthlyTargetMonth, setMonthlyTargetMonth] = useState("2026-05");
  const [actualCostForm, setActualCostForm] = useState<ActualCostRecord>(() => ({ ...emptyActualCostRecord(), month: "2026-05" }));
  const [eventPlanForm, setEventPlanForm] = useState<EventPlan>(() => emptyEventPlan());
  const [selectedEventPlanId, setSelectedEventPlanId] = useState(sampleData.eventPlans[0]?.id ?? "");
  const [eventImpactIngredientId, setEventImpactIngredientId] = useState(sampleData.ingredients.find((ingredient) => ingredient.id === "ing-butter")?.id ?? sampleData.ingredients[0]?.id ?? "");
  const [eventImpactNewPrice, setEventImpactNewPrice] = useState(sampleData.ingredients.find((ingredient) => ingredient.id === "ing-butter")?.price ?? 0);
  const [laborForm, setLaborForm] = useState<LaborCost>(() => emptyLaborCost(sampleData.products.find((product) => !product.isIntermediateMaterial)?.id ?? ""));
  const [selectedSetProductId, setSelectedSetProductId] = useState(sampleData.products.find((product) => product.id === "prd-gift")?.id ?? sampleData.products.find((product) => !product.isIntermediateMaterial)?.id ?? "");
  const [setProductItemForm, setSetProductItemForm] = useState<SetProductItem>(() => emptySetProductItem(sampleData.products.find((product) => product.id === "prd-gift")?.id ?? "", sampleData.products.find((product) => product.id === "prd-madeleine")?.id ?? ""));
  const [productionPlan, setProductionPlan] = useState<Record<string, number>>({
    "prd-shortcake": 50,
    "prd-madeleine": 100,
    "prd-castella": 30,
  });

  useEffect(() => {
    queueMicrotask(() => {
      const loadedStores = loadStores();
      const loadedStoreId = loadCurrentStoreId(loadedStores);
      const loadedData = loadData(loadedStoreId);
    setStores(loadedStores);
      setCurrentStoreId(loadedStoreId);
      setSwitchStoreId(loadedStoreId);
      setData(loadedData);
      setSelectedProductId(loadedData.products[0]?.id ?? "");
      setRecipeProductSelectId("");
      setRecipeIngredientId(loadedData.ingredients[0]?.id ?? "");
      setImpactIngredientId(loadedData.ingredients[4]?.id ?? loadedData.ingredients[0]?.id ?? "");
      setImpactNewPrice(loadedData.ingredients[4]?.price + 100 || 0);
      setSelectedEventPlanId(loadedData.eventPlans[0]?.id ?? "");
      setEventImpactIngredientId(loadedData.ingredients.find((ingredient) => ingredient.id === "ing-butter")?.id ?? loadedData.ingredients[0]?.id ?? "");
      setEventImpactNewPrice(loadedData.ingredients.find((ingredient) => ingredient.id === "ing-butter")?.price ?? loadedData.ingredients[0]?.price ?? 0);
      setLaborForm(emptyLaborCost(loadedData.products.find((product) => !product.isIntermediateMaterial)?.id ?? ""));
      setSelectedSetProductId(loadedData.products.find((product) => product.category === "ギフト")?.id ?? loadedData.products.find((product) => !product.isIntermediateMaterial)?.id ?? "");
      setSetProductItemForm(emptySetProductItem(loadedData.products.find((product) => product.category === "ギフト")?.id ?? "", loadedData.products.find((product) => !product.isIntermediateMaterial && product.category !== "ギフト")?.id ?? ""));
    });
  }, []);

  function commit(nextData: AppData) {
    setData(nextData);
    window.localStorage.setItem(storeDataKey(currentStoreId), JSON.stringify(nextData));
  }

  function loadStoreData(storeId: string) {
    const nextData = loadData(storeId);
    setCurrentStoreId(storeId);
    window.localStorage.setItem(currentStoreStorageKey, storeId);
    setData(nextData);
    setSelectedProductId(nextData.products[0]?.id ?? "");
    setRecipeProductSelectId("");
    setRecipeIngredientId(nextData.ingredients[0]?.id ?? "");
    setImpactIngredientId(nextData.ingredients[4]?.id ?? nextData.ingredients[0]?.id ?? "");
    setImpactNewPrice(nextData.ingredients[4]?.price + 100 || 0);
    setSelectedEventPlanId(nextData.eventPlans[0]?.id ?? "");
    setEventImpactIngredientId(nextData.ingredients.find((ingredient) => ingredient.id === "ing-butter")?.id ?? nextData.ingredients[0]?.id ?? "");
    setEventImpactNewPrice(nextData.ingredients.find((ingredient) => ingredient.id === "ing-butter")?.price ?? nextData.ingredients[0]?.price ?? 0);
    setLaborForm(emptyLaborCost(nextData.products.find((product) => !product.isIntermediateMaterial)?.id ?? ""));
    setSelectedSetProductId(nextData.products.find((product) => product.category === "ギフト")?.id ?? nextData.products.find((product) => !product.isIntermediateMaterial)?.id ?? "");
    setSetProductItemForm(emptySetProductItem(nextData.products.find((product) => product.category === "ギフト")?.id ?? "", nextData.products.find((product) => !product.isIntermediateMaterial && product.category !== "ギフト")?.id ?? ""));
    setSwitchStoreId(storeId);
    setSwitchStorePin("");
    setActivePage("top");
    setIsStoreModalOpen(false);
    setStoreModalMode("switch");
  }

  function createStore() {
    const id = newStoreId.trim();
    if (!id) {
      alert("店舗IDを入力してください。");
      return;
    }
    if (!/^\d{4}$/.test(newStorePin)) {
      alert("PINコードは4桁の数字で入力してください。");
      return;
    }
    if (stores.some((store) => store.id === id)) {
      alert("同じ店舗IDがすでに登録されています。");
      return;
    }
    const nextStore: StoreAccount = { id, pin: newStorePin, createdAt: now(), updatedAt: now() };
    const nextStores = [...stores, nextStore];
    setStores(nextStores);
    saveStores(nextStores);
    window.localStorage.setItem(storeDataKey(id), JSON.stringify(sampleData));
    setNewStoreId("");
    setNewStorePin("");
    loadStoreData(id);
  }

  function openStoreModal() {
    setStoreModalMode("switch");
    setIsStoreModalOpen(true);
  }

  function switchStore() {
    const store = stores.find((item) => item.id === switchStoreId);
    if (!store) return;
    if (store.pin !== switchStorePin) {
      alert("PINコードが違います。");
      return;
    }
    loadStoreData(store.id);
  }

  function updateStorePin(storeId: string, nextPin: string) {
    if (!/^\d{4}$/.test(nextPin)) {
      alert("PINコードは4桁の数字で入力してください。");
      return;
    }
    const nextStores = stores.map((store) => (
      store.id === storeId ? { ...store, pin: nextPin, updatedAt: now() } : store
    ));
    setStores(nextStores);
    saveStores(nextStores);
  }

  async function readIngredientImageWithOcr(imageDataUrl: string, imageName: string) {
    setIngredientOcrImageName(imageName);
    setIsIngredientOcrReading(true);
    setIngredientOcrStatus("画像を圧縮中...");
    try {
      const preprocessedImage = await preprocessImageForOcr(imageDataUrl, ingredientOcrCrop);
      const rowImages = splitIngredientOcrByRows ? await splitOcrImageIntoRows(preprocessedImage) : [preprocessedImage];
      setIngredientOcrStatus(
        rowImages.length > 1
          ? `文字範囲を${rowImages.length}行に分けてAI解析中...`
          : "OpenAI Visionで読み取り中...",
      );
      let parsedResults = await fetchIngredientOcrImages(rowImages);
      if (parsedResults.length === 0 && rowImages.length > 1) {
        setIngredientOcrStatus("行ごとの解析に失敗したため、1枚全体で再解析しています...");
        parsedResults = await fetchIngredientOcrImages([preprocessedImage]);
      }
      const rawText = parsedResults.map((result) => ("ingredients" in result ? result.rawText : result.rawText || "")).filter(Boolean).join("\n");
      const results = parsedResults.flatMap((result) => ("ingredients" in result ? result.ingredients : [result]));
      const validResults = results.filter((item) => item.name || item.packageName || item.price);

      if (validResults.length === 0) {
        setIngredientOcrCandidate(null);
        setIngredientOcrCandidates([]);
        setIngredientOcrCandidateIndex(0);
        setIngredientOcrCandidateStatuses({});
        setIngredientOcrStatus(rawText ? "文字は一部読めましたが、登録項目に分けられませんでした。読み取り結果を手直しして「読み込み確認」を押してください。" : "登録に必要な情報を抽出できませんでした。明るい場所で、紙を画面いっぱいに入れて撮り直してください。");
        return;
      }
      const candidates = validResults.map((item) => {
        const candidate = ingredientFromVisionResult({ ...item, rawText }, ingredientForm);
        const learnedAlias = findIngredientAlias(candidate, data.ingredientAliases);
        const reflectedCandidate = learnedAlias ? applyIngredientAlias(candidate, learnedAlias) : candidate;
        return {
          ...reflectedCandidate,
          labelName: reflectedCandidate.name || candidate.name || reflectedCandidate.labelName,
        };
      });
      setIngredientOcrCandidates(candidates);
      setIngredientOcrCandidateIndex(0);
      setIngredientOcrCandidate(candidates[0]);
      setIngredientOcrCandidateStatuses({});
      setIsIngredientOcrListOpen(candidates.length > 1);
      setSelectedOcrDuplicateIngredientId("");
      setIngredientOcrStatus(`読み取り完了。${candidates.length}件の候補があります。確認画面で1件ずつ反映してください。`);
    } catch (error) {
      setIngredientOcrStatus(error instanceof Error ? error.message : "OCR読み取りに失敗しました。");
    } finally {
      setIsIngredientOcrReading(false);
    }
  }

  async function fetchIngredientOcrImages(imageDataUrls: string[]) {
    const settledResults = await Promise.allSettled(imageDataUrls.map((imageDataUrl) => fetchIngredientOcr(imageDataUrl)));
    const successfulResults = settledResults
      .filter((result): result is PromiseFulfilledResult<IngredientVisionOcrResponse | IngredientVisionOcrResult> => result.status === "fulfilled")
      .map((result) => result.value);
    const failedCount = settledResults.length - successfulResults.length;
    if (failedCount > 0 && successfulResults.length > 0) {
      setIngredientOcrStatus(`${successfulResults.length}件を解析できました。${failedCount}件は文字が少ないためスキップしました。`);
    }
    if (successfulResults.length === 0 && settledResults[0]?.status === "rejected") {
      throw settledResults[0].reason instanceof Error ? settledResults[0].reason : new Error("OCR解析に失敗しました。");
    }
    return successfulResults;
  }

  async function fetchIngredientOcr(imageDataUrl: string) {
    const response = await fetch("/api/ingredient-vision-ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || "OpenAI Vision OCRに失敗しました。");
    }
    return json.result as IngredientVisionOcrResponse | IngredientVisionOcrResult;
  }

  function handleIngredientOcrFile(file: File | null) {
    if (!file) return;
    void prepareIngredientOcrImage(file);
  }

  async function prepareIngredientOcrImage(file: File) {
    setIngredientOcrImageName(file.name);
    setIngredientOcrStatus("撮影画像から文字範囲を探しています...");
    try {
      const dataUrl = await fileToImageDataUrl(file);
      const detectedCrop = await autoDetectOcrCrop(dataUrl);
      setPendingIngredientOcrImage(dataUrl);
      setPendingIngredientOcrImageName(file.name);
      setIngredientOcrCrop(detectedCrop);
      setIngredientOcrStatus("文字範囲を確認してからAI解析してください。");
    } catch (error) {
      setIngredientOcrStatus(error instanceof Error ? error.message : "画像を読み込めませんでした。");
    }
  }

  function runPreparedIngredientOcr() {
    if (!pendingIngredientOcrImage) return;
    const image = pendingIngredientOcrImage;
    const name = pendingIngredientOcrImageName || ingredientOcrImageName || "撮影画像";
    setPendingIngredientOcrImage("");
    setPendingIngredientOcrImageName("");
    void readIngredientImageWithOcr(image, name);
  }

  function openIngredientOcrCandidateFromList(index: number) {
    const candidate = ingredientOcrCandidates[index];
    if (!candidate) return;
    setIngredientOcrCandidateIndex(index);
    setIngredientOcrCandidate(candidate);
    setSelectedOcrDuplicateIngredientId("");
    setIsIngredientOcrListOpen(false);
    setIngredientOcrStatus(`${index + 1}件目を確認しています。`);
  }

  function applyIngredientOcrCandidate() {
    if (!ingredientOcrCandidate) return;
    const currentIndex = ingredientOcrCandidateIndex;
    const reflectedIngredient = selectedOcrDuplicateIngredient
      ? {
        ...selectedOcrDuplicateIngredient,
        packageName: ingredientOcrCandidate.packageName || selectedOcrDuplicateIngredient.packageName,
        supplier: ingredientOcrCandidate.supplier || selectedOcrDuplicateIngredient.supplier,
        packageAmountGram: ingredientOcrCandidate.packageAmountGram || selectedOcrDuplicateIngredient.packageAmountGram,
        packageUnit: ingredientOcrCandidate.packageUnit || selectedOcrDuplicateIngredient.packageUnit,
        gramPerUnit: ingredientOcrCandidate.gramPerUnit || selectedOcrDuplicateIngredient.gramPerUnit,
        price: ingredientOcrCandidate.price || selectedOcrDuplicateIngredient.price,
        labelName: selectedOcrDuplicateIngredient.labelName || selectedOcrDuplicateIngredient.name,
        memo: [
          selectedOcrDuplicateIngredient.memo,
          ingredientOcrCandidate.memo,
          `AI OCR重複候補から反映: ${ingredientOptionLabel(selectedOcrDuplicateIngredient)}`,
        ].filter(Boolean).join("\n"),
        updatedAt: now(),
      }
      : ingredientOcrCandidate;
    setIngredientForm(reflectedIngredient);
    setAppliedStandardNutritionId("");
    setSelectedStandardNutritionId("");
    const nextIndex = ingredientOcrCandidateIndex + 1;
    setIngredientOcrCandidateIndex(nextIndex);
    setIngredientOcrCandidateStatuses((statuses) => ({ ...statuses, [currentIndex]: "反映済み" }));
    setSelectedOcrDuplicateIngredientId("");
    setIngredientOcrCandidate(null);
    setIngredientOcrStatus(
      nextIndex < ingredientOcrCandidates.length
        ? selectedOcrDuplicateIngredient
          ? `${ingredientOcrCandidateIndex + 1}件目を登録済み候補へ反映しました。保存すると既存データを更新します。`
          : `${ingredientOcrCandidateIndex + 1}件目をフォームへ反映しました。保存すると次の商品を自動表示します。`
        : "最後の候補をフォームへ反映しました。内容を確認して保存してください。",
    );
  }

  function showNextIngredientOcrCandidateSoon(nextIndex: number) {
    const nextCandidate = ingredientOcrCandidates[nextIndex];
    if (!nextCandidate) return;
    window.setTimeout(() => {
      setIngredientOcrCandidateIndex(nextIndex);
      setIngredientOcrCandidate(nextCandidate);
      setSelectedOcrDuplicateIngredientId("");
      setIngredientOcrStatus(`${nextIndex + 1}件目を確認してください。`);
    }, 250);
  }

  function skipIngredientOcrCandidate() {
    const nextIndex = ingredientOcrCandidateIndex + 1;
    const currentIndex = ingredientOcrCandidateIndex;
    setIngredientOcrCandidateIndex(nextIndex);
    setIngredientOcrCandidateStatuses((statuses) => ({ ...statuses, [currentIndex]: "スキップ" }));
    setSelectedOcrDuplicateIngredientId("");
    setIngredientOcrCandidate(null);
    setIngredientOcrStatus(
      nextIndex < ingredientOcrCandidates.length
        ? `${ingredientOcrCandidateIndex + 1}件目をスキップしました。次の候補を表示します。`
        : "最後の候補をスキップしました。",
    );
    showNextIngredientOcrCandidateSoon(nextIndex);
  }

  const selectedProduct = data.products.find((product) => product.id === selectedProductId) ?? data.products[0];
  const costSummary = selectedProduct
    ? calculateProductCost(selectedProduct, data.ingredients, data.recipeItems, data.products)
    : null;
  const effectiveCostSummary = selectedProduct
    ? calculateProductLaborCost(data, selectedProduct)
    : null;
  const nutritionSummary = selectedProduct
    ? calculateProductNutrition(selectedProduct, data.ingredients, data.recipeItems, data.products)
    : null;
  const impactRows = calculatePriceImpact(data, impactIngredientId, impactNewPrice);
  const ingredientCategories = useMemo(
    () => ["すべて", "中間材料", ...Array.from(new Set(data.ingredients.map((ingredient) => ingredient.category || "未分類")))],
    [data.ingredients],
  );
  const editableIngredientCategories = useMemo(
    () => ingredientCategories.filter((category) => category !== "すべて"),
    [ingredientCategories],
  );
  const filteredIngredients = activeIngredientCategory === "すべて"
    ? data.ingredients
    : activeIngredientCategory === "中間材料"
      ? []
    : data.ingredients.filter((ingredient) => (ingredient.category || "未分類") === activeIngredientCategory);
  const masterIngredientGroups = useMemo(() => {
    const rows = activeIngredientCategory === "すべて"
      ? data.ingredients
      : data.ingredients.filter((ingredient) => (ingredient.category || "未分類") === activeIngredientCategory);
    const categories = Array.from(new Set(rows.map((ingredient) => ingredient.category || "未分類"))).sort((a, b) => a.localeCompare(b, "ja"));
    return categories.map((category) => ({
      category,
      ingredients: rows
        .filter((ingredient) => (ingredient.category || "未分類") === category)
        .sort((a, b) => (a.packageName || a.name).localeCompare(b.packageName || b.name, "ja")),
    }));
  }, [activeIngredientCategory, data.ingredients]);
  const intermediateProducts = useMemo(
    () => data.products.filter((product) => product.isIntermediateMaterial && product.id !== selectedProduct?.id),
    [data.products, selectedProduct?.id],
  );
  const visibleIntermediateProducts = activeIngredientCategory === "すべて" || activeIngredientCategory === "中間材料"
    ? intermediateProducts
    : [];
  const possibleDuplicateIngredients = useMemo(
    () => findDuplicateIngredients(ingredientForm, data.ingredients).slice(0, 3),
    [data.ingredients, ingredientForm],
  );
  const possibleOcrDuplicateIngredients = useMemo(
    () => ingredientOcrCandidate ? findDuplicateIngredients(ingredientOcrCandidate, data.ingredients).slice(0, 3) : [],
    [data.ingredients, ingredientOcrCandidate],
  );
  const selectedOcrDuplicateIngredient = possibleOcrDuplicateIngredients.find((ingredient) => ingredient.id === selectedOcrDuplicateIngredientId) ?? null;
  const learnedIngredientAlias = useMemo(
    () => findIngredientAlias(ingredientForm, data.ingredientAliases),
    [data.ingredientAliases, ingredientForm],
  );
  const standardNutritionMatches = useMemo(
    () => searchStandardNutritionFoods(nutritionSearchText || `${ingredientForm.name} ${ingredientForm.packageName}`),
    [ingredientForm.name, ingredientForm.packageName, nutritionSearchText],
  );
  const selectedStandardNutrition = standardNutritionFoods.find((food) => food.id === selectedStandardNutritionId) ?? standardNutritionMatches[0];
  const appliedStandardNutrition = standardNutritionFoods.find((food) => food.id === appliedStandardNutritionId) ?? null;
  const isPackagingForm = ingredientForm.type === "PACKAGING";
  const usesIngredientUnitConversion = showIngredientUnitConversion || (ingredientForm.gramPerUnit || 1) > 1;
  const ingredientUnitCount = usesIngredientUnitConversion && ingredientForm.gramPerUnit
    ? Math.round((ingredientForm.packageAmountGram || 0) / ingredientForm.gramPerUnit)
    : 0;
  const productCategoryOptions = useMemo(
    () => Array.from(new Set([...(data.productCategories || []), ...data.products.map((product) => product.category || "未分類")].filter(Boolean))),
    [data.productCategories, data.products],
  );
  const productCategoryFilterOptions = ["すべて", ...productCategoryOptions];
  const filteredProductList = useMemo(
    () => data.products
      .filter((product) => activeProductCategory === "すべて" || (product.category || "未分類") === activeProductCategory)
      .sort((a, b) => Number(a.isIntermediateMaterial) - Number(b.isIntermediateMaterial) || a.category.localeCompare(b.category, "ja") || a.name.localeCompare(b.name, "ja")),
    [activeProductCategory, data.products],
  );
  const productionPlanItems = useMemo(
    () => Object.entries(productionPlan).map(([productId, quantity]) => ({ productId, quantity: Number(quantity) || 0 })),
    [productionPlan],
  );
  const productionRequirements = useMemo(
    () => calculateProductionRequirements(data, productionPlanItems),
    [data, productionPlanItems],
  );
  const productionMaterialRequirements = productionRequirements.filter((row) => !row.isPackaging);
  const productionPackagingRequirements = productionRequirements.filter((row) => row.isPackaging);
  const productionTotalCost = productionRequirements.reduce((sum, row) => sum + row.cost, 0);
  const wasteSummary = useMemo(() => calculateWasteSummary(data), [data]);
  const wasteMonthlySummary = useMemo(
    () => calculateWasteMonthlySummary(data, wasteSummaryMonth),
    [data, wasteSummaryMonth],
  );
  const activeWasteRows = useMemo(
    () => wasteCategoryRows(data, activeWasteCategory),
    [activeWasteCategory, data],
  );
  const monthlyTheory = useMemo(
    () => calculateMonthlyTheoryCost(data, monthlyTargetMonth),
    [data, monthlyTargetMonth],
  );
  const selectedEventPlan = data.eventPlans.find((eventPlan) => eventPlan.id === selectedEventPlanId) ?? data.eventPlans[0] ?? null;
  const eventSimulation = useMemo(
    () => calculateEventSimulation(data, selectedEventPlan?.id ?? "", {}),
    [data, selectedEventPlan?.id],
  );
  const eventImpactSimulation = useMemo(
    () => calculateEventSimulation(data, selectedEventPlan?.id ?? "", eventImpactIngredientId ? { [eventImpactIngredientId]: eventImpactNewPrice } : {}),
    [data, eventImpactIngredientId, eventImpactNewPrice, selectedEventPlan?.id],
  );
  const selectedLaborProduct = data.products.find((product) => product.id === laborForm.productId) ?? data.products.find((product) => !product.isIntermediateMaterial) ?? data.products[0];
  const selectedLaborSummary = selectedLaborProduct ? calculateProductLaborCost(data, selectedLaborProduct) : null;
  const laborSummaries = useMemo(
    () => data.products
      .filter((product) => !product.isIntermediateMaterial)
      .map((product) => calculateProductLaborCost(data, product))
      .sort((a, b) => b.effectiveCostRate - a.effectiveCostRate),
    [data],
  );
  const selectedSetProduct = data.products.find((product) => product.id === selectedSetProductId) ?? data.products.find((product) => product.category === "ギフト") ?? data.products.find((product) => !product.isIntermediateMaterial) ?? data.products[0];
  const setProductSummaries = useMemo(
    () => data.products
      .filter((product) => !product.isIntermediateMaterial)
      .map((product) => calculateSetProductCost(data, product))
      .filter((summary) => summary.childRows.length > 0)
      .sort((a, b) => b.costRate - a.costRate),
    [data],
  );
  const selectedSetSummary = selectedSetProduct ? calculateSetProductCost(data, selectedSetProduct) : null;

  const dashboard = useMemo(() => {
    const productCosts = data.products.map((product) => calculateProductCost(product, data.ingredients, data.recipeItems, data.products));
    const sellableProductCosts = productCosts.filter((item) => !item.product.isIntermediateMaterial);
    return {
      productCount: data.products.length,
      highCostCount: productCosts.filter((item) => item.costRate >= 35).length,
      dangerousCostCount: productCosts.filter((item) => item.costRate >= 40).length,
      affectedCount: impactRows.length,
      missingNutritionCount: data.ingredients.filter((ingredient) => !hasNutrition(ingredient)).length,
      highCostTop: sellableProductCosts.slice().sort((a, b) => b.costRate - a.costRate).slice(0, 10),
      priceReviewTop: sellableProductCosts.filter((item) => item.costRate >= item.product.targetCostRate || item.costRate >= 35).sort((a, b) => b.costRate - a.costRate).slice(0, 10),
    };
  }, [data, impactRows.length]);

  function saveIngredient() {
    if (!ingredientForm.name.trim()) return;
    const isEdit = Boolean(ingredientForm.id);
    const inferredCategory = inferIngredientCategory(`${ingredientForm.name} ${ingredientForm.packageName}`);
    const normalizedAmount = normalizePackageAmount(ingredientForm.packageAmountGram, ingredientForm.packageUnit || "g");
    let ingredient: Ingredient = {
      ...ingredientForm,
      category: ingredientForm.category && ingredientForm.category !== "未分類" ? ingredientForm.category : inferredCategory,
      type: ingredientForm.type || inferMaterialType(ingredientForm),
      labelName: ingredientForm.labelName || ingredientForm.name,
      packageAmountGram: normalizedAmount.amount,
      packageUnit: normalizedAmount.unit,
      gramPerUnit: (ingredientForm.gramPerUnit || 1) > 1 ? ingredientForm.gramPerUnit : normalizedAmount.gramPerUnit || 1,
      id: ingredientForm.id || createId("ing"),
      createdAt: ingredientForm.createdAt || now(),
      updatedAt: now(),
    };
    if (ingredient.type === "PACKAGING") {
      ingredient = {
        ...ingredient,
        caloriesPer100g: 0,
        proteinPer100g: 0,
        fatPer100g: 0,
        carbsPer100g: 0,
        saltPer100g: 0,
        allergens: [],
        otherAllergen: "",
      };
    }
    const nutritionCandidate = findNutritionCandidate(ingredient, data.ingredients);
    if (ingredient.type !== "PACKAGING" && isNutritionEmpty(ingredient) && nutritionCandidate) {
      const shouldCopy = confirm(
        `栄養成分が未入力です。\n「${nutritionCandidate.name}」の栄養成分を反映して登録しますか？\n\n反映後も原材料登録画面で修正できます。`,
      );
      if (shouldCopy) {
        ingredient = copyNutrition(ingredient, nutritionCandidate);
      }
    }
    if (ingredient.type !== "PACKAGING" && isNutritionEmpty(ingredient) && selectedStandardNutrition) {
      const shouldCopyFromDb = confirm(
        `栄養成分が未入力です。\n食品成分表の「${selectedStandardNutrition.name}」を反映して登録しますか？\n\n反映後も原材料登録画面で修正できます。`,
      );
      if (shouldCopyFromDb) {
        ingredient = {
          ...ingredient,
          caloriesPer100g: selectedStandardNutrition.caloriesPer100g,
          proteinPer100g: selectedStandardNutrition.proteinPer100g,
          fatPer100g: selectedStandardNutrition.fatPer100g,
          carbsPer100g: selectedStandardNutrition.carbsPer100g,
          saltPer100g: selectedStandardNutrition.saltPer100g,
          memo: [ingredient.memo, `栄養成分参照: 日本食品標準成分表 ${selectedStandardNutrition.foodNumber} ${selectedStandardNutrition.name}`].filter(Boolean).join("\n"),
        };
      }
    }
    const nextAliases = learnIngredientAliases(data.ingredientAliases, ingredient);
    commit({
      ...data,
      ingredients: isEdit
        ? data.ingredients.map((item) => (item.id === ingredient.id ? ingredient : item))
        : [...data.ingredients, ingredient],
      ingredientAliases: nextAliases,
    });
    setIngredientForm(emptyIngredient());
    setShowIngredientUnitConversion(false);
    setAppliedStandardNutritionId("");
    setSelectedStandardNutritionId("");
    if (!recipeIngredientId) setRecipeIngredientId(ingredient.id);
    if (ingredientOcrCandidateIndex < ingredientOcrCandidates.length) {
      setIngredientOcrStatus("保存しました。次の商品を表示します。");
      showNextIngredientOcrCandidateSoon(ingredientOcrCandidateIndex);
    }
  }

  function skipIngredientForm() {
    setIngredientForm(emptyIngredient());
    setShowIngredientUnitConversion(false);
    setAppliedStandardNutritionId("");
    setSelectedStandardNutritionId("");
    if (ingredientOcrCandidateIndex < ingredientOcrCandidates.length) {
      setIngredientOcrStatus("この候補をスキップしました。次の候補を確認できます。");
    } else {
      setIngredientOcrStatus("この候補をスキップしました。");
    }
  }

  function applyStandardNutrition(food = selectedStandardNutrition) {
    if (!food) return;
    setSelectedStandardNutritionId(food.id);
    setAppliedStandardNutritionId(food.id);
    setIngredientForm({
      ...ingredientForm,
      caloriesPer100g: food.caloriesPer100g,
      proteinPer100g: food.proteinPer100g,
      fatPer100g: food.fatPer100g,
      carbsPer100g: food.carbsPer100g,
      saltPer100g: food.saltPer100g,
      memo: [ingredientForm.memo, `栄養成分参照: 日本食品標準成分表 ${food.foodNumber} ${food.name}`].filter(Boolean).join("\n"),
    });
  }

  function applyLearnedIngredientAlias() {
    if (!learnedIngredientAlias) return;
    setIngredientForm(applyIngredientAlias(ingredientForm, learnedIngredientAlias));
  }

  function saveProduct() {
    if (!productForm.name.trim()) return;
    const isEdit = Boolean(productForm.id);
    const category = productForm.category || (productForm.isIntermediateMaterial ? "仕込み材料" : productCategoryOptions[0] || "未分類");
    const product: Product = {
      ...productForm,
      isIntermediateMaterial: productForm.isIntermediateMaterial,
      category,
      status: productForm.status || "販売中",
      id: productForm.id || createId("prd"),
      createdAt: productForm.createdAt || now(),
      updatedAt: now(),
    };
    commit({
      ...data,
      productCategories: Array.from(new Set([...(data.productCategories || []), category].filter(Boolean))),
      products: isEdit ? data.products.map((item) => (item.id === product.id ? product : item)) : [...data.products, product],
    });
    setProductForm(emptyProduct());
    setSelectedProductId(product.id);
    setRecipeProductSelectId(product.id);
    setRecipeProductName("");
  }

  function deleteProductFromForm() {
    if (!productForm.id) return;
    const recipeUseCount = data.recipeItems.filter((item) => item.productId === productForm.id || item.intermediateProductId === productForm.id).length;
    const message = recipeUseCount > 0
      ? `${productForm.name} を削除しますか？\n\nこの商品は ${recipeUseCount} 件のレシピ行で使われています。削除すると関連するレシピ行も外れます。`
      : `${productForm.name} を削除しますか？`;
    if (!confirm(message)) return;
    commit({
      ...data,
      products: data.products.filter((product) => product.id !== productForm.id),
      recipeItems: data.recipeItems.filter((item) => item.productId !== productForm.id && item.intermediateProductId !== productForm.id),
      setProductItems: data.setProductItems.filter((item) => item.setProductId !== productForm.id && item.childProductId !== productForm.id),
    });
    const nextProductId = data.products.find((product) => product.id !== productForm.id)?.id ?? "";
    setSelectedProductId(nextProductId);
    setRecipeProductSelectId("");
    setProductForm(emptyProduct());
  }

  function saveProductCategory() {
    const category = productCategoryForm.trim();
    if (!category) return;
    commit({
      ...data,
      productCategories: Array.from(new Set([...(data.productCategories || []), category])),
    });
    setProductCategoryForm("");
    setActiveProductCategory(category);
  }

  function deleteProductCategory(category: string) {
    if (!confirm(`商品カテゴリ「${category}」を削除しますか？\nこのカテゴリの商品は「未分類」に変更されます。`)) return;
    commit({
      ...data,
      productCategories: (data.productCategories || []).filter((item) => item !== category),
      products: data.products.map((product) => product.category === category ? { ...product, category: "未分類", updatedAt: now() } : product),
    });
    if (activeProductCategory === category) setActiveProductCategory("すべて");
    if (productForm.category === category) setProductForm({ ...productForm, category: "未分類" });
  }

  function editProductFromList(product: Product) {
    setProductForm(product);
    setSelectedProductId(product.id);
    setActivePage("product");
  }

  function updateRecipeProductName(value: string) {
    setRecipeProductName(value);
    if (value.trim()) setRecipeProductSelectId("");
    setProductForm((current) => ({ ...current, name: value, isIntermediateMaterial: recipeProductIsIntermediate }));
  }

  function addProductFromRecipeName() {
    const name = recipeProductName.trim();
    if (!name) return;

    const existingProduct = data.products.find((product) => product.name === name);
    if (existingProduct) {
      setSelectedProductId(existingProduct.id);
      setProductForm(existingProduct);
      setRecipeProductIsIntermediate(existingProduct.isIntermediateMaterial);
      setRecipeProductSelectId(existingProduct.id);
      setRecipeProductName("");
      return;
    }

    const product: Product = {
      ...emptyProduct(),
      name,
      isIntermediateMaterial: recipeProductIsIntermediate,
      category: recipeProductIsIntermediate ? "仕込み材料" : productForm.category || productCategoryOptions[0] || "未分類",
      id: createId("prd"),
      sellingPrice: productForm.sellingPrice || 0,
      taxType: productForm.taxType,
      targetCostRate: productForm.targetCostRate || 32,
      displayUnit: productForm.displayUnit,
      yieldCount: productForm.yieldCount || 1,
      beforeBakeWeightGram: productForm.beforeBakeWeightGram || 0,
      afterBakeWeightGram: productForm.afterBakeWeightGram,
      weightPerPieceGram: productForm.weightPerPieceGram || 0,
      memo: productForm.memo,
      status: productForm.status || "販売中",
      createdAt: now(),
      updatedAt: now(),
    };

    commit({
      ...data,
      productCategories: Array.from(new Set([...(data.productCategories || []), product.category].filter(Boolean))),
      products: [...data.products, product],
    });
    setSelectedProductId(product.id);
    setRecipeProductSelectId(product.id);
    setProductForm(product);
    setRecipeProductIsIntermediate(false);
    setRecipeProductName("");
  }

  function resolveRecipeTarget(nextRecipeItems: RecipeItem[]) {
    const name = recipeProductName.trim();
    if (!name) {
      return {
        productId: selectedProduct?.id ?? "",
        products: data.products,
        productCategories: data.productCategories,
        recipeItems: nextRecipeItems,
      };
    }
    const existingProduct = data.products.find((product) => product.name === name);
    if (existingProduct) {
      setSelectedProductId(existingProduct.id);
      setRecipeProductSelectId(existingProduct.id);
      setProductForm(existingProduct);
      setRecipeProductIsIntermediate(existingProduct.isIntermediateMaterial);
      setRecipeProductName("");
      return {
        productId: existingProduct.id,
        products: data.products,
        productCategories: data.productCategories,
        recipeItems: nextRecipeItems,
      };
    }
    const category = recipeProductIsIntermediate ? "仕込み材料" : productForm.category || productCategoryOptions[0] || "未分類";
    const product: Product = {
      ...emptyProduct(),
      name,
      isIntermediateMaterial: recipeProductIsIntermediate,
      category,
      id: createId("prd"),
      sellingPrice: productForm.sellingPrice || 0,
      taxType: productForm.taxType,
      targetCostRate: productForm.targetCostRate || 32,
      displayUnit: productForm.displayUnit,
      yieldCount: productForm.yieldCount || 1,
      beforeBakeWeightGram: productForm.beforeBakeWeightGram || 0,
      afterBakeWeightGram: productForm.afterBakeWeightGram,
      weightPerPieceGram: productForm.weightPerPieceGram || 0,
      memo: productForm.memo,
      status: productForm.status || "販売中",
      createdAt: now(),
      updatedAt: now(),
    };
    setSelectedProductId(product.id);
    setRecipeProductSelectId(product.id);
    setProductForm(product);
    setRecipeProductIsIntermediate(false);
    setRecipeProductName("");
    return {
      productId: product.id,
      products: [...data.products, product],
      productCategories: Array.from(new Set([...(data.productCategories || []), category].filter(Boolean))),
      recipeItems: nextRecipeItems,
    };
  }

  function addRecipeItemForIngredient(ingredientId: string, amountGram: number) {
    if (!ingredientId) return;
    const target = resolveRecipeTarget([]);
    if (!target.productId) return;
    const item: RecipeItem = {
      id: createId("rec"),
      productId: target.productId,
      ingredientId,
      itemType: "ingredient",
      intermediateProductId: "",
      usageType: "gram",
      amountGram,
      baseAmountGram: amountGram,
      usedCount: 1,
      totalCount: 1,
      fractionDenominator: 1,
      lossRate: 0,
      memo: "",
      createdAt: now(),
      updatedAt: now(),
    };
    commit({ ...data, products: target.products, productCategories: target.productCategories, recipeItems: [...data.recipeItems, item] });
    setRecipeIngredientId(ingredientId);
  }

  function addRecipeItemForIntermediate(intermediateProductId: string, amountGram: number) {
    if (!intermediateProductId || intermediateProductId === selectedProduct?.id) return;
    const target = resolveRecipeTarget([]);
    if (!target.productId || intermediateProductId === target.productId) return;
    const item: RecipeItem = {
      id: createId("rec"),
      productId: target.productId,
      ingredientId: "",
      itemType: "intermediate",
      intermediateProductId,
      usageType: "gram",
      amountGram,
      baseAmountGram: amountGram,
      usedCount: 1,
      totalCount: 1,
      fractionDenominator: 1,
      lossRate: 0,
      memo: "",
      createdAt: now(),
      updatedAt: now(),
    };
    commit({ ...data, products: target.products, productCategories: target.productCategories, recipeItems: [...data.recipeItems, item] });
  }

  function updateRecipeItemAmount(recipeItemId: string, amountGram: number) {
    commit({
      ...data,
      recipeItems: data.recipeItems.map((item) =>
        item.id === recipeItemId
          ? normalizeRecipeItem({ ...item, usageType: "gram", amountGram, baseAmountGram: amountGram, updatedAt: now() })
          : item,
      ),
    });
  }

  function updateRecipeItem(recipeItemId: string, patch: Partial<RecipeItem>) {
    commit({
      ...data,
      recipeItems: data.recipeItems.map((item) => {
        if (item.id !== recipeItemId) return item;
        const ingredient = data.ingredients.find((candidate) => candidate.id === item.ingredientId);
        const countPatch = patch.usageType === "count" && ingredient && (ingredient.gramPerUnit || 1) > 1
          ? {
            baseAmountGram: ingredient.packageAmountGram,
            totalCount: Math.max(1, Math.round(ingredient.packageAmountGram / ingredient.gramPerUnit)),
            usedCount: patch.usedCount || item.usedCount || 1,
          }
          : {};
        const nextItem = normalizeRecipeItem({ ...item, ...patch, ...countPatch, updatedAt: now() });
        return nextItem;
      }),
    });
  }

  function updateSelectedProductSellingPrice(sellingPrice: number) {
    if (!selectedProduct) return;
    const nextProduct = { ...selectedProduct, sellingPrice, updatedAt: now() };
    commit({
      ...data,
      products: data.products.map((product) => (product.id === nextProduct.id ? nextProduct : product)),
    });
    setProductForm((current) => (current.id === nextProduct.id || current.name === nextProduct.name ? nextProduct : current));
  }

  function dropRecipeIngredient(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { type: "ingredient" | "intermediate"; id: string };
      if (payload.type === "intermediate") addRecipeItemForIntermediate(payload.id, 0);
      else addRecipeItemForIngredient(payload.id, 0);
    } catch {
      addRecipeItemForIngredient(raw, 0);
    }
  }

  function deletePaletteItem(type: "ingredient" | "intermediate", id: string) {
    const label = type === "ingredient"
      ? data.ingredients.find((ingredient) => ingredient.id === id)?.name
      : data.products.find((product) => product.id === id)?.name;
    if (!label || !confirm(`${label} を削除しますか？関連するレシピ行からも外れます。`)) return;
    if (type === "ingredient") {
      commit({
        ...data,
        ingredients: data.ingredients.filter((ingredient) => ingredient.id !== id),
        recipeItems: data.recipeItems.filter((item) => item.ingredientId !== id),
      });
      return;
    }
    commit({
      ...data,
      products: data.products.filter((product) => product.id !== id),
      recipeItems: data.recipeItems.filter((item) => item.productId !== id && item.intermediateProductId !== id),
    });
    if (selectedProductId === id) setSelectedProductId(data.products.find((product) => product.id !== id)?.id ?? "");
  }

  function editIngredientFromMaster(ingredient: Ingredient) {
    setIngredientForm(ingredient);
    setActivePage("ingredient");
  }

  function deleteIngredientFromMaster(ingredient: Ingredient) {
    const recipeUseCount = data.recipeItems.filter((item) => item.ingredientId === ingredient.id).length;
    const message = recipeUseCount > 0
      ? `${ingredientOptionLabel(ingredient)} を削除しますか？\n\nこの原材料は ${recipeUseCount} 件のレシピで使われています。削除すると、そのレシピ行も外れます。`
      : `${ingredientOptionLabel(ingredient)} を削除しますか？`;
    if (!confirm(message)) return;
    commit({
      ...data,
      ingredients: data.ingredients.filter((item) => item.id !== ingredient.id),
      recipeItems: data.recipeItems.filter((item) => item.ingredientId !== ingredient.id),
    });
    if (ingredientForm.id === ingredient.id) setIngredientForm(emptyIngredient());
  }

  function dropPaletteItemToTrash(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;
    const payload = JSON.parse(raw) as { type: "ingredient" | "intermediate"; id: string };
    deletePaletteItem(payload.type, payload.id);
  }

  function deleteRecipeItem(recipeItemId: string) {
    if (!confirm("このレシピ行を削除しますか？")) return;
    commit({ ...data, recipeItems: data.recipeItems.filter((item) => item.id !== recipeItemId) });
  }

  function changeIngredientPrice() {
    const ingredient = data.ingredients.find((item) => item.id === impactIngredientId);
    if (!ingredient) return;
    commit({
      ...data,
      ingredients: data.ingredients.map((item) =>
        item.id === impactIngredientId ? { ...item, price: impactNewPrice, updatedAt: now() } : item,
      ),
      priceHistories: [
        ...data.priceHistories,
        {
          id: createId("hist"),
          ingredientId: impactIngredientId,
          oldPrice: ingredient.price,
          newPrice: impactNewPrice,
          changedAt: now(),
          supplier: ingredient.supplier,
          reason: "価格改定",
          sourceType: "manual" as const,
          memo: "手入力による価格変更",
        },
      ],
    });
  }

  function analyzeOcrText() {
    setOcrCandidates(parseOcrPriceCandidates(ocrText, data.ingredients));
  }

  function updateOcrCandidate(candidateId: string, patch: Partial<OcrPriceCandidate>) {
    setOcrCandidates((current) => current.map((candidate) => (
      candidate.id === candidateId ? { ...candidate, ...patch } : candidate
    )));
  }

  function applyOcrCandidates() {
    const validCandidates = ocrCandidates.filter((candidate) => candidate.ingredientId && candidate.newPrice > 0);
    if (validCandidates.length === 0) return;
    if (!confirm(`${validCandidates.length}件の価格を原材料マスターに反映しますか？`)) return;
    const changedAt = now();
    commit({
      ...data,
      ingredients: data.ingredients.map((ingredient) => {
        const candidate = validCandidates.find((item) => item.ingredientId === ingredient.id);
        return candidate ? { ...ingredient, price: candidate.newPrice, updatedAt: changedAt } : ingredient;
      }),
      priceHistories: [
        ...data.priceHistories,
        ...validCandidates.map((candidate) => {
          const ingredient = data.ingredients.find((item) => item.id === candidate.ingredientId);
          return {
            id: createId("hist"),
            ingredientId: candidate.ingredientId,
            oldPrice: ingredient?.price ?? candidate.oldPrice,
            newPrice: candidate.newPrice,
            changedAt,
            supplier: ingredient?.supplier ?? "",
            reason: "価格改定",
            sourceType: "ocr" as const,
            memo: `OCR反映: ${candidate.line}`,
          };
        }),
      ],
    });
    setImpactIngredientId(validCandidates[0]?.ingredientId ?? impactIngredientId);
    setImpactNewPrice(validCandidates[0]?.newPrice ?? impactNewPrice);
    setActivePage("impact");
  }

  function exportIngredientsCsv() {
    downloadCsv("ingredients.csv", [
      ["材料タイプ", "原材料名", "製品名", "カテゴリ", "仕入先", "内容量", "単位", "仕入価格", "税込/税抜", "単価", "アレルゲン", "表示名"],
      ...data.ingredients.map((ingredient) => [
        materialTypeLabels[ingredient.type],
        ingredient.name,
        ingredient.packageName,
        ingredient.category,
        ingredient.supplier,
        ingredient.packageAmountGram,
        ingredientUnitLabel(ingredient),
        ingredient.price,
        ingredient.taxType,
        pricePerGram(ingredient),
        [...ingredient.allergens, ingredient.otherAllergen].filter(Boolean).join("、"),
        ingredient.labelName,
      ]),
    ]);
  }

  function exportProductCostsCsv() {
    downloadCsv("product-costs.csv", [
      ["商品名", "カテゴリ", "販売価格", "目標原価率", "材料原価/個", "包材原価/個", "合計原価/個", "原価率", "推奨販売価格", "アレルゲン"],
      ...data.products.filter((product) => !product.isIntermediateMaterial).map((product) => {
        const summary = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
        return [
          product.name,
          product.category,
          product.sellingPrice,
          product.targetCostRate,
          summary.materialCostPerPiece,
          summary.packagingCostPerPiece,
          summary.costPerPiece,
          summary.costRate,
          product.targetCostRate ? summary.costPerPiece / (product.targetCostRate / 100) : 0,
          collectAllergens(product.id, data.ingredients, data.recipeItems, data.products).join("、"),
        ];
      }),
    ]);
  }

  function exportPriceHistoriesCsv() {
    downloadCsv("price-histories.csv", [
      ["変更日", "原材料名", "製品名", "仕入先", "旧価格", "新価格", "変更理由", "反映方法", "メモ"],
      ...data.priceHistories.map((history) => {
        const ingredient = data.ingredients.find((item) => item.id === history.ingredientId);
        return [
          new Date(history.changedAt).toLocaleDateString("ja-JP"),
          ingredient?.name ?? "",
          ingredient?.packageName ?? "",
          history.supplier,
          history.oldPrice,
          history.newPrice,
          history.reason,
          history.sourceType,
          history.memo,
        ];
      }),
    ]);
  }

  function updateProductionPlan(productId: string, quantity: number) {
    setProductionPlan((current) => ({ ...current, [productId]: quantity }));
  }

  function exportProductionRequirementsCsv() {
    downloadCsv("production-requirements.csv", [
      ["種別", "原材料名", "製品名", "仕入先", "必要量", "単位", "概算原価"],
      ...productionRequirements.map((row) => [
        row.isPackaging ? "包材" : "原材料",
        row.ingredient.name,
        row.ingredient.packageName,
        row.supplier,
        row.requiredAmount,
        row.unit,
        row.cost,
      ]),
    ]);
  }

  function wasteQuickRecord(itemType: WasteItemType, itemId: string) {
    return data.wasteRecords.find((record) => (
      record.date === wasteDate &&
      record.reason === wasteReason &&
      record.itemType === itemType &&
      record.itemId === itemId
    ));
  }

  function upsertWasteQuantity(itemType: WasteItemType, itemId: string, quantity: number) {
    const normalizedQuantity = Math.max(0, quantity);
    const existing = wasteQuickRecord(itemType, itemId);
    if (normalizedQuantity === 0) {
      if (!existing) return;
      commit({ ...data, wasteRecords: data.wasteRecords.filter((record) => record.id !== existing.id) });
      return;
    }
    const amounts = calculateWasteRecordAmounts(data, itemType, itemId, normalizedQuantity);
    const record: WasteRecord = {
      id: existing?.id || createId("waste"),
      date: wasteDate,
      itemType,
      itemId,
      quantity: normalizedQuantity,
      ...amounts,
      reason: wasteReason,
      memo: "",
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    };
    commit({
      ...data,
      wasteRecords: existing
        ? data.wasteRecords.map((item) => (item.id === existing.id ? record : item))
        : [record, ...data.wasteRecords],
    });
  }

  function incrementWasteQuantity(itemType: WasteItemType, itemId: string, step: number) {
    const currentQuantity = wasteQuickRecord(itemType, itemId)?.quantity ?? 0;
    upsertWasteQuantity(itemType, itemId, currentQuantity + step);
  }

  function clearWasteQuantity(itemType: WasteItemType, itemId: string) {
    const existing = wasteQuickRecord(itemType, itemId);
    if (!existing) return;
    commit({ ...data, wasteRecords: data.wasteRecords.filter((record) => record.id !== existing.id) });
  }

  function deleteWasteRecord(recordId: string) {
    if (!confirm("この廃棄記録を削除しますか？")) return;
    commit({ ...data, wasteRecords: data.wasteRecords.filter((record) => record.id !== recordId) });
  }

  function exportWasteCsv() {
    downloadCsv("waste-records.csv", [
      ["日付", "種別", "品目", "数量", "廃棄原価", "販売価格換算", "理由", "メモ"],
      ...data.wasteRecords.map((record) => [
        record.date,
        record.itemType === "PRODUCT" ? "商品" : record.itemType === "INTERMEDIATE" ? "中間材料" : "原材料",
        wasteRecordItemName(record, data),
        record.quantity,
        record.costAmount,
        record.salesEquivalentAmount,
        record.reason,
        record.memo,
      ]),
    ]);
  }

  function exportWasteMonthlyCsv() {
    downloadCsv(`waste-monthly-${wasteSummaryMonth}.csv`, [
      ["月", "区分", "名称", "数量", "廃棄原価", "販売価格換算"],
      ...wasteMonthlySummary.categoryRows.map((row) => [
        wasteSummaryMonth,
        "カテゴリ",
        row.categoryName,
        row.quantity,
        row.costAmount,
        row.salesEquivalentAmount,
      ]),
      ...wasteMonthlySummary.reasonRows.map((row) => [
        wasteSummaryMonth,
        "理由",
        row.reason,
        row.quantity,
        row.costAmount,
        row.salesEquivalentAmount,
      ]),
      ...wasteMonthlySummary.itemRows.map((row) => [
        wasteSummaryMonth,
        "品目",
        row.itemName,
        row.quantity,
        row.costAmount,
        row.salesEquivalentAmount,
      ]),
    ]);
  }

  function updateMonthlySales(product: Product, quantity: number) {
    const nextRecord: SalesRecord = {
      id: createId("sales"),
      month: monthlyTargetMonth,
      productId: product.id,
      quantity,
      sellingPrice: product.sellingPrice,
      memo: "",
      createdAt: now(),
      updatedAt: now(),
    };
    commit({ ...data, salesRecords: upsertSalesRecord(data.salesRecords, nextRecord) });
  }

  function saveActualCostRecord() {
    if (!actualCostForm.supplier.trim() || actualCostForm.amount <= 0) return;
    const record: ActualCostRecord = {
      ...actualCostForm,
      id: actualCostForm.id || createId("actual"),
      month: monthlyTargetMonth,
      createdAt: actualCostForm.createdAt || now(),
      updatedAt: now(),
    };
    commit({
      ...data,
      actualCostRecords: actualCostForm.id
        ? data.actualCostRecords.map((item) => (item.id === record.id ? record : item))
        : [record, ...data.actualCostRecords],
    });
    setActualCostForm({ ...emptyActualCostRecord(), month: monthlyTargetMonth });
  }

  function deleteActualCostRecord(recordId: string) {
    if (!confirm("この実仕入額を削除しますか？")) return;
    commit({ ...data, actualCostRecords: data.actualCostRecords.filter((record) => record.id !== recordId) });
  }

  function exportMonthlyTheoryCsv() {
    downloadCsv(`monthly-theory-${monthlyTargetMonth}.csv`, [
      ["月", "商品名", "販売数", "売上", "理論原価", "理論原価率", "粗利"],
      ...monthlyTheory.rows.map((row) => [
        monthlyTargetMonth,
        row.product.name,
        row.quantity,
        row.salesAmount,
        row.theoryCostAmount,
        row.theoryCostRate,
        row.grossProfit,
      ]),
      ["合計", "", "", monthlyTheory.totalSalesAmount, monthlyTheory.totalTheoryCostAmount, monthlyTheory.theoryCostRate, monthlyTheory.totalGrossProfit],
      ["実原価", "", "", "", monthlyTheory.actualCostAmount, "", ""],
      ["差額", "", "", "", monthlyTheory.differenceAmount, "", ""],
    ]);
  }

  function saveEventPlan() {
    if (!eventPlanForm.name.trim()) return;
    const plan: EventPlan = {
      ...eventPlanForm,
      id: eventPlanForm.id || createId("event"),
      createdAt: eventPlanForm.createdAt || now(),
      updatedAt: now(),
    };
    commit({
      ...data,
      eventPlans: eventPlanForm.id
        ? data.eventPlans.map((item) => (item.id === plan.id ? plan : item))
        : [plan, ...data.eventPlans],
    });
    setSelectedEventPlanId(plan.id);
    setEventPlanForm(emptyEventPlan());
  }

  function updateEventPlanItem(product: Product, patch: { plannedQuantity?: number; sellingPrice?: number }) {
    if (!selectedEventPlan) return;
    const existing = data.eventPlanItems.find((item) => item.eventPlanId === selectedEventPlan.id && item.productId === product.id);
    const nextItem = {
      id: existing?.id || createId("event-item"),
      eventPlanId: selectedEventPlan.id,
      productId: product.id,
      plannedQuantity: patch.plannedQuantity ?? existing?.plannedQuantity ?? 0,
      sellingPrice: patch.sellingPrice ?? existing?.sellingPrice ?? product.sellingPrice,
      memo: existing?.memo ?? "",
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    };
    commit({
      ...data,
      eventPlanItems: existing
        ? data.eventPlanItems.map((item) => (item.id === existing.id ? nextItem : item))
        : [nextItem, ...data.eventPlanItems],
    });
  }

  function exportEventCsv() {
    downloadCsv(`event-${selectedEventPlan?.name || "simulation"}.csv`, [
      ["イベント", "商品名", "予定販売数", "販売価格", "売上", "現在原価/個", "粗利", "値上げ後原価/個", "値上げ後粗利", "利益減少"],
      ...eventImpactSimulation.rows.map((row) => [
        selectedEventPlan?.name ?? "",
        row.product.name,
        row.plannedQuantity,
        row.sellingPrice,
        row.salesAmount,
        row.currentUnitCost,
        row.currentGrossProfit,
        row.simulatedUnitCost,
        row.simulatedGrossProfit,
        row.profitDecrease,
      ]),
      ["合計", "", "", "", eventImpactSimulation.totalSalesAmount, eventImpactSimulation.totalCurrentCost, eventImpactSimulation.totalCurrentGrossProfit, eventImpactSimulation.totalSimulatedCost, eventImpactSimulation.totalSimulatedGrossProfit, eventImpactSimulation.totalProfitDecrease],
    ]);
  }

  function saveLaborCost() {
    if (!laborForm.productId || !laborForm.processName.trim()) return;
    const record: LaborCost = {
      ...laborForm,
      id: laborForm.id || createId("labor"),
      workers: laborForm.workers || 1,
      createdAt: laborForm.createdAt || now(),
      updatedAt: now(),
    };
    commit({
      ...data,
      laborCosts: laborForm.id
        ? data.laborCosts.map((item) => (item.id === record.id ? record : item))
        : [record, ...data.laborCosts],
    });
    setLaborForm(emptyLaborCost(record.productId));
  }

  function editLaborCost(record: LaborCost) {
    setLaborForm(record);
  }

  function deleteLaborCost(recordId: string) {
    if (!confirm("この作業時間を削除しますか？")) return;
    commit({ ...data, laborCosts: data.laborCosts.filter((record) => record.id !== recordId) });
  }

  function exportLaborCsv() {
    downloadCsv("labor-costs.csv", [
      ["商品名", "工程", "分数", "人数", "時給", "作業原価", "人件費/個", "材料包材原価/個", "実質原価/個", "実質原価率"],
      ...laborSummaries.flatMap((summary) => (
        summary.laborRows.length > 0
          ? summary.laborRows.map((row) => [
            summary.product.name,
            row.processName,
            row.minutes,
            row.workers,
            row.hourlyWage,
            row.costAmount,
            summary.laborCostPerPiece,
            summary.materialAndPackagingCostPerPiece,
            summary.effectiveCostPerPiece,
            summary.effectiveCostRate,
          ])
          : [[summary.product.name, "", "", "", "", 0, 0, summary.materialAndPackagingCostPerPiece, summary.effectiveCostPerPiece, summary.effectiveCostRate]]
      )),
    ]);
  }

  function saveSetProductItem() {
    if (!setProductItemForm.setProductId || !setProductItemForm.childProductId || setProductItemForm.quantity <= 0) return;
    if (setProductItemForm.setProductId === setProductItemForm.childProductId) {
      alert("詰合せ商品自身は中身に追加できません。");
      return;
    }
    const record: SetProductItem = {
      ...setProductItemForm,
      id: setProductItemForm.id || createId("set-item"),
      createdAt: setProductItemForm.createdAt || now(),
      updatedAt: now(),
    };
    commit({
      ...data,
      setProductItems: setProductItemForm.id
        ? data.setProductItems.map((item) => (item.id === record.id ? record : item))
        : [record, ...data.setProductItems],
    });
    setSelectedSetProductId(record.setProductId);
    setSetProductItemForm(emptySetProductItem(record.setProductId, record.childProductId));
  }

  function editSetProductItem(record: SetProductItem) {
    setSetProductItemForm(record);
    setSelectedSetProductId(record.setProductId);
  }

  function deleteSetProductItem(recordId: string) {
    if (!confirm("この詰合せ内容を削除しますか？")) return;
    commit({ ...data, setProductItems: data.setProductItems.filter((record) => record.id !== recordId) });
  }

  function updateSelectedSetProductSellingPrice(sellingPrice: number) {
    if (!selectedSetProduct) return;
    const nextProduct = { ...selectedSetProduct, sellingPrice, updatedAt: now() };
    commit({
      ...data,
      products: data.products.map((product) => (product.id === nextProduct.id ? nextProduct : product)),
    });
  }

  function exportSetProductCsv() {
    downloadCsv("set-products.csv", [
      ["詰合せ商品", "販売価格", "中に入れる商品", "数量", "商品原価/個", "商品原価計", "包材原価", "詰合せ原価", "原価率", "推奨販売価格"],
      ...setProductSummaries.flatMap((summary) => (
        summary.childRows.map((row) => [
          summary.setProduct.name,
          summary.sellingPrice,
          row.childProduct.name,
          row.quantity,
          row.unitCost,
          row.totalCost,
          summary.packagingCost,
          summary.totalCost,
          summary.costRate,
          summary.recommendedPrice,
        ])
      )),
    ]);
  }

  function resetSample() {
    if (!confirm("サンプルデータに戻しますか？")) return;
    commit(sampleData);
    setSelectedProductId(sampleData.products[0]?.id ?? "");
    setImpactIngredientId("ing-cream");
    setImpactNewPrice(860);
    setLaborForm(emptyLaborCost(sampleData.products.find((product) => !product.isIntermediateMaterial)?.id ?? ""));
    setSelectedSetProductId(sampleData.products.find((product) => product.id === "prd-gift")?.id ?? "");
    setSetProductItemForm(emptySetProductItem("prd-gift", "prd-madeleine"));
  }

  const labelText = selectedProduct && costSummary && nutritionSummary
    ? buildLabelText(selectedProduct, costSummary.materialCostPerPiece, costSummary.costPerPiece, costSummary.costRate, nutritionSummary, data)
    : "";

  const recipeRows = data.recipeItems.filter((item) => item.productId === selectedProduct?.id);
  const currentTone = activePage === "ocr" ? pageTones.ingredient : pageTone(activePage);
  const activeNavGroup = activePage === "ocr" ? null : navGroups.find((group) => (group.pages as readonly PageNavKey[]).includes(activePage)) ?? null;
  const visibleNavGroup = openNavGroup
    ? navGroups.find((group) => group.key === openNavGroup) ?? activeNavGroup
    : activeNavGroup;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 text-sm text-neutral-900 md:p-5">
      <header className="flex flex-col gap-3 rounded-md border border-white/80 bg-white/85 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 font-bold text-teal-700">
            <span className={`h-3 w-3 rounded-full ${currentTone.mark}`} />
            洋菓子店・飲食店向け MVP
          </p>
          <h1 className="text-2xl font-black md:text-3xl">原価計算＋栄養成分表示</h1>
          <p className="mt-1 text-xs font-bold text-neutral-500">現在の店舗: {currentStoreId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-teal-200 bg-teal-50 px-4 py-2 font-bold text-teal-800" onClick={openStoreModal}>
            店舗切替
          </button>
          <button className="rounded-md border border-red-200 bg-red-50 px-4 py-2 font-bold text-red-700" onClick={resetSample}>
            サンプルデータに戻す
          </button>
        </div>
      </header>

      <nav className="sticky top-0 z-10 rounded-md border border-white/80 bg-white/95 p-2 shadow-sm backdrop-blur">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {mainNavPageKeys.map((pageKey) => {
            const tone = pageTone(pageKey);
            const isActive = activePage === pageKey;
            return (
              <button
                key={pageKey}
                className={`flex min-h-12 items-center gap-2 rounded-md border-2 px-2 py-2 text-left font-black transition-colors ${
                  isActive ? tone.navActive : tone.navIdle
                }`}
                onClick={() => {
                  setOpenNavGroup(null);
                  setActivePage(pageKey);
                }}
              >
                <span className={`flex h-9 min-w-9 items-center justify-center rounded-md border ${
                  isActive ? "border-white/70 bg-white/20 text-white" : "border-current bg-white/70"
                }`}>
                  <NavPictogram pageKey={pageKey} />
                </span>
                <span className="leading-tight">{pageLabel(pageKey)}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {navGroups.map((group) => {
            const firstPage = group.pages[0];
            const tone = pageTone(firstPage);
            const isActive = activeNavGroup?.key === group.key || openNavGroup === group.key;
            return (
              <button
                key={group.key}
                className={`rounded-md border-2 px-3 py-2 text-left transition-colors ${
                  isActive ? tone.navActive : tone.navIdle
                }`}
                onClick={() => setOpenNavGroup(openNavGroup === group.key ? null : group.key)}
              >
                <span className="block text-sm font-black">{group.label}</span>
                <span className={`mt-1 block text-[11px] font-bold ${isActive ? "text-white/85" : "text-neutral-600"}`}>{group.description}</span>
              </button>
            );
          })}
        </div>
        {visibleNavGroup && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-neutral-100 bg-neutral-50 p-2 md:grid-cols-3 lg:grid-cols-5">
            {visibleNavGroup.pages.map((pageKey) => {
              const tone = pageTone(pageKey);
              const isActive = activePage === pageKey;
              return (
                <button
                  key={pageKey}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-2 py-2 text-left text-sm font-black transition-colors ${
                    isActive ? tone.navActive : tone.navIdle
                  }`}
                  onClick={() => {
                    setOpenNavGroup(null);
                    setActivePage(pageKey);
                  }}
                >
                  <span className={`flex h-8 min-w-8 items-center justify-center rounded-md border ${
                    isActive ? "border-white/70 bg-white/20 text-white" : "border-current bg-white/70"
                  }`}>
                    <NavPictogram pageKey={pageKey} />
                  </span>
                  <span className="leading-tight">{pageLabel(pageKey)}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <section className="grid grid-cols-4 gap-1 md:gap-2">
        <Metric label="登録商品数" value={`${dashboard.productCount}品`} compact />
        <Metric label="原価率35%以上" value={`${dashboard.highCostCount}品`} tone="warn" compact />
        <Metric label="影響商品数" value={`${dashboard.affectedCount}品`} compact />
        <Metric label="栄養未登録材料" value={`${dashboard.missingNutritionCount}件`} compact />
      </section>

      {activePage === "top" && (
        <Panel title="TOP">
          <section className="rounded-md border border-teal-100 bg-teal-50 p-3">
            <h3 className="font-black text-teal-950">まず使うページ</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {(["ingredient", "product", "recipe", "cost"] as PageNavKey[]).map((pageKey) => {
                const tone = pageTone(pageKey);
                return (
                  <button
                    key={pageKey}
                    className={`min-h-24 rounded-md border p-4 text-left shadow-sm transition-colors ${tone.topCard}`}
                    onClick={() => setActivePage(pageKey)}
                  >
                    <span className="flex items-center gap-2 text-lg font-black text-neutral-900">
                      <span className={`grid h-10 w-10 place-items-center rounded-md ${tone.mark} text-white`}>
                        <NavPictogram pageKey={pageKey} />
                      </span>
                      {pageLabel(pageKey)}
                    </span>
                    <span className="mt-2 block text-xs font-bold text-neutral-500">{topPageDescription(pageKey)}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {navGroups.map((group) => {
              const tone = pageTone(group.pages[0]);
              return (
                <section key={group.key} className={`rounded-md border p-4 shadow-sm ${tone.topCard}`}>
                  <h3 className="text-lg font-black text-neutral-950">{group.label}</h3>
                  <p className="mt-1 text-xs font-bold text-neutral-500">{group.description}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {group.pages.map((pageKey) => (
                      <button
                        key={pageKey}
                        className="flex min-h-12 items-center gap-2 rounded-md border border-white bg-white px-3 py-2 text-left text-sm font-black text-neutral-900 shadow-sm"
                        onClick={() => setActivePage(pageKey)}
                      >
                        <span className={`grid h-8 w-8 place-items-center rounded-md ${pageTone(pageKey).mark} text-white`}>
                          <NavPictogram pageKey={pageKey} />
                        </span>
                        <span>{pageLabel(pageKey)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <section className="rounded-md border border-red-100 bg-red-50 p-3">
              <h3 className="font-black text-red-950">値上げ検討商品TOP10</h3>
              <div className="mt-2 grid gap-2">
                {dashboard.priceReviewTop.map((summary) => (
                  <div key={summary.product.id} className="flex justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm font-bold">
                    <span>{summary.product.name}</span>
                    <span>{percent(summary.costRate)} / 推奨 {yen(summary.costPerPiece / (summary.product.targetCostRate / 100))}</span>
                  </div>
                ))}
                {dashboard.priceReviewTop.length === 0 && <p className="text-sm font-bold text-red-800">現在、強い値上げ候補はありません。</p>}
              </div>
            </section>
            <section className="rounded-md border border-amber-100 bg-amber-50 p-3">
              <h3 className="font-black text-amber-950">原価率が高い商品TOP10</h3>
              <div className="mt-2 grid gap-2">
                {dashboard.highCostTop.map((summary) => (
                  <div key={summary.product.id} className="flex justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm font-bold">
                    <span>{summary.product.name}</span>
                    <span>{yen(summary.costPerPiece)} / {percent(summary.costRate)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Panel>
      )}

      {activePage === "help" && (
        <Panel title="使い方">
          <HelpGuide onNavigate={setActivePage} />
        </Panel>
      )}

      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3">
          <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md border border-neutral-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">店舗管理</h2>
                <p className="text-xs font-bold text-neutral-500">現在の店舗: {currentStoreId}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 font-bold text-teal-800" onClick={() => setIsStoreModalOpen(false)}>
                  戻る
                </button>
                <button className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-bold text-neutral-700" onClick={() => setIsStoreModalOpen(false)}>
                  閉じる
                </button>
              </div>
            </div>

            {storeModalMode === "switch" ? (
              <section className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <h3 className="font-black">店舗切替</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_120px]">
                  <SelectInput
                    label="店舗ID"
                    value={switchStoreId}
                    options={stores.map((store) => store.id)}
                    onChange={(value) => {
                      setSwitchStoreId(value);
                      setSwitchStorePin("");
                    }}
                  />
                  <PinInput label="4桁PIN" value={switchStorePin} onChange={setSwitchStorePin} />
                  <button className="self-end rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={switchStore}>
                    切替
                  </button>
                </div>
                <button className="mt-3 rounded-md bg-neutral-900 px-4 py-2 font-bold text-white" onClick={() => setStoreModalMode("create")}>
                  店舗作成
                </button>
              </section>
            ) : (
              <section className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black">店舗作成</h3>
                  <button className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-bold text-neutral-700" onClick={() => setStoreModalMode("switch")}>
                    店舗切替へ戻る
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_120px]">
                  <TextInput label="店舗ID" value={newStoreId} onChange={setNewStoreId} />
                  <PinInput label="4桁PIN" value={newStorePin} onChange={setNewStorePin} />
                  <button className="self-end rounded-md bg-neutral-900 px-4 py-2 font-bold text-white" onClick={createStore}>
                    作成
                  </button>
                </div>
                <p className="mt-2 text-xs font-bold text-neutral-500">
                  店舗IDは日本語、英語、数字、記号をそのまま使えます。
                </p>
              </section>
            )}

            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => (
                <div key={store.id} className={`rounded-md border p-3 ${store.id === currentStoreId ? "border-teal-600 bg-teal-50" : "border-neutral-200 bg-white"}`}>
                  <strong>{store.id}</strong>
                  <p className="text-xs font-bold text-neutral-500">PIN: **** / {store.id === currentStoreId ? "現在選択中" : "未選択"}</p>
                  <button
                    className="mt-2 rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-bold text-neutral-700"
                    onClick={() => {
                      const nextPin = prompt(`${store.id} の新しい4桁PINを入力してください。`);
                      if (nextPin) updateStorePin(store.id, nextPin);
                    }}
                  >
                    PIN変更
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {pendingIngredientOcrImage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-md border border-neutral-200 bg-white p-4 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">文字範囲を確認</h2>
                <p className="mt-1 text-xs font-bold text-neutral-500">
                  赤枠の中だけをAI解析します。伝票の余白や机が多い時は、ここで文字部分に寄せてください。
                </p>
              </div>
              <button
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
                onClick={() => {
                  setPendingIngredientOcrImage("");
                  setPendingIngredientOcrImageName("");
                  setIngredientOcrStatus("OCRをキャンセルしました。");
                }}
              >
                閉じる
              </button>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="relative overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingIngredientOcrImage} alt="OCR読み取り範囲" className="max-h-[52vh] w-full object-contain" />
                <div
                  className="pointer-events-none absolute border-4 border-red-500 bg-red-500/10"
                  style={{
                    left: `${ingredientOcrCrop.x}%`,
                    top: `${ingredientOcrCrop.y}%`,
                    width: `${ingredientOcrCrop.width}%`,
                    height: `${ingredientOcrCrop.height}%`,
                  }}
                />
              </div>
              <div className="grid content-start gap-3">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                  文字が小さい伝票は、赤枠を商品行の表だけに寄せると読み取り精度が上がります。
                </div>
                <button
                  className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700"
                  onClick={() => {
                    void autoDetectOcrCrop(pendingIngredientOcrImage).then(setIngredientOcrCrop);
                  }}
                >
                  文字範囲を自動調整
                </button>
                {([
                  ["左", "x"],
                  ["上", "y"],
                  ["幅", "width"],
                  ["高さ", "height"],
                ] as Array<[string, keyof OcrCrop]>).map(([label, key]) => (
                  <label key={key} className="grid gap-1 text-sm font-bold text-neutral-700">
                    {label}: {ingredientOcrCrop[key]}%
                    <input
                      type="range"
                      min={key === "width" || key === "height" ? 20 : 0}
                      max={key === "width" || key === "height" ? 100 : 80}
                      value={ingredientOcrCrop[key]}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setIngredientOcrCrop((crop) => ({
                          ...crop,
                          [key]: value,
                        }));
                      }}
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm font-bold text-neutral-700">
                  <input
                    type="checkbox"
                    checked={splitIngredientOcrByRows}
                    onChange={(event) => setSplitIngredientOcrByRows(event.target.checked)}
                  />
                  表を行ごと・商品ごとに分けてAI解析する
                </label>
                <button
                  className="rounded-md bg-red-600 px-5 py-3 text-base font-black text-white"
                  disabled={isIngredientOcrReading}
                  onClick={runPreparedIngredientOcr}
                >
                  この範囲でAI解析
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {isIngredientOcrListOpen && ingredientOcrCandidates.length > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-md border border-neutral-200 bg-white p-4 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">OCR読み取り候補一覧</h2>
                <p className="mt-1 text-xs font-bold text-neutral-500">
                  読み取った行を一覧で確認できます。残っている行は「開く」から再表示できます。
                </p>
              </div>
              <button className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700" onClick={() => setIsIngredientOcrListOpen(false)}>
                閉じる
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {ingredientOcrCandidates.map((candidate, index) => {
                const status = ingredientOcrCandidateStatuses[index] || "未処理";
                const statusClass = status === "未処理"
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : status === "反映済み"
                    ? "border-teal-300 bg-teal-50 text-teal-900"
                    : "border-neutral-300 bg-neutral-50 text-neutral-600";
                return (
                  <div key={`${candidate.name}-${candidate.packageName}-${index}`} className="grid gap-2 rounded-md border border-neutral-200 p-3 md:grid-cols-[88px_1fr_100px] md:items-center">
                    <span className={`rounded-md border px-2 py-1 text-center text-xs font-black ${statusClass}`}>
                      {status}
                    </span>
                    <div>
                      <p className="font-black text-neutral-900">
                        {index + 1}. {candidate.packageName || candidate.name || "名称未取得"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-neutral-500">
                        原材料名: {candidate.name || "-"} / 内容量: {number(candidate.packageAmountGram)}{candidate.packageUnit} / 価格: {yen(candidate.price)}
                      </p>
                    </div>
                    <button
                      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                      onClick={() => openIngredientOcrCandidateFromList(index)}
                    >
                      開く
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {ingredientOcrCandidate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3">
          <section className="w-full max-w-xl rounded-md border border-neutral-200 bg-white p-4 shadow-xl">
            <h2 className="text-lg font-black">OCR読み込み確認</h2>
            <p className="mt-1 text-xs font-bold text-neutral-500">
              内容が合っているか確認してから原材料登録フォームへ反映します。
              {ingredientOcrCandidates.length > 1 ? ` ${ingredientOcrCandidateIndex + 1}/${ingredientOcrCandidates.length}件目` : ""}
            </p>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-2 text-sm">
              <dt className="font-bold text-neutral-500">原材料名</dt><dd>{ingredientOcrCandidate.name || "-"}</dd>
              <dt className="font-bold text-neutral-500">製品名</dt><dd>{ingredientOcrCandidate.packageName || "-"}</dd>
              <dt className="font-bold text-neutral-500">仕入先</dt><dd>{ingredientOcrCandidate.supplier || "-"}</dd>
              <dt className="font-bold text-neutral-500">内容量</dt><dd>{number(ingredientOcrCandidate.packageAmountGram)}{ingredientOcrCandidate.packageUnit}</dd>
              <dt className="font-bold text-neutral-500">仕入価格</dt><dd>{yen(ingredientOcrCandidate.price)}</dd>
            </dl>
            {possibleOcrDuplicateIngredients.length > 0 && (
              <div className="mt-4 rounded-md border-2 border-red-500 bg-red-50 p-3 text-sm text-red-900">
                <p className="animate-pulse text-base font-black">重複してる可能性があります</p>
                <p className="mt-1 text-xs font-bold">同じ商品に近い登録済みデータが見つかりました。更新したい候補があればチェックしてください。</p>
                <div className="mt-3 grid gap-2">
                  {possibleOcrDuplicateIngredients.map((ingredient) => (
                    <label
                      key={ingredient.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                        selectedOcrDuplicateIngredientId === ingredient.id ? "border-red-500 bg-white" : "border-red-200 bg-red-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5"
                        checked={selectedOcrDuplicateIngredientId === ingredient.id}
                        onChange={(event) => setSelectedOcrDuplicateIngredientId(event.target.checked ? ingredient.id : "")}
                      />
                      <span>
                        <span className="block font-black">{ingredient.packageName || ingredient.name}</span>
                        <span className="mt-1 block text-xs font-bold text-red-800">
                          原材料名: {ingredient.name || "-"} / 仕入先: {ingredient.supplier || "-"} / 内容量:
                          {number(ingredient.packageAmountGram)}{ingredient.packageUnit} / 現在価格: {yen(ingredient.price)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {selectedOcrDuplicateIngredient && (
                  <p className="mt-2 rounded-md bg-white px-3 py-2 text-xs font-black text-red-800">
                    選択中: {ingredientOptionLabel(selectedOcrDuplicateIngredient)}。反映後に保存すると、この登録済みデータを更新します。
                  </p>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {ingredientOcrCandidates.length > 1 && (
                <button className="rounded-md border border-neutral-300 bg-white px-4 py-2 font-bold text-neutral-700" onClick={() => setIsIngredientOcrListOpen(true)}>
                  候補一覧
                </button>
              )}
              <button className="rounded-md border border-neutral-300 bg-white px-4 py-2 font-bold text-neutral-700" onClick={() => setIngredientOcrCandidate(null)}>
                戻る
              </button>
              <button className="rounded-md border-2 border-amber-500 bg-white px-5 py-3 font-black text-amber-800" onClick={skipIngredientOcrCandidate}>
                スキップする
              </button>
              <button className="rounded-md bg-teal-700 px-5 py-3 font-black text-white" onClick={applyIngredientOcrCandidate}>
                反映させる
              </button>
            </div>
          </section>
        </div>
      )}

      {activePage === "ingredient" && (
        <Panel title="原材料登録">
          <section className="mb-4 rounded-md border border-teal-200 bg-teal-50 p-3">
            <h3 className="font-black text-teal-900">カメラ / OCRから読み込み</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-[260px_1fr]">
              <div className="grid place-items-center gap-2 rounded-md border border-red-100 bg-white p-3">
                <input
                  ref={ingredientCameraInputRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.currentTarget.value = "";
                    handleIngredientOcrFile(file);
                  }}
                />
                <input
                  ref={ingredientPhotoInputRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.currentTarget.value = "";
                    handleIngredientOcrFile(file);
                  }}
                />
                <button
                  className="grid h-28 w-28 place-items-center rounded-full bg-red-600 px-4 text-center text-lg font-black leading-tight text-white shadow-lg disabled:bg-neutral-300"
                  disabled={isIngredientOcrReading}
                  onClick={() => ingredientCameraInputRef.current?.click()}
                >
                  カメラ<br />起動
                </button>
                <button
                  className="rounded-md border border-neutral-300 bg-white px-5 py-2 font-bold text-neutral-800 disabled:bg-neutral-100"
                  disabled={isIngredientOcrReading}
                  onClick={() => ingredientPhotoInputRef.current?.click()}
                >
                  写真
                </button>
                <span className="text-xs font-bold text-neutral-500">
                  {ingredientOcrImageName ? `選択中: ${ingredientOcrImageName}` : "撮影・選択後に文字範囲を確認します。"}
                </span>
              </div>
              <div className="grid content-center gap-2 rounded-md border border-teal-200 bg-white p-4">
                <p className="text-lg font-black text-teal-900">
                  {isIngredientOcrReading ? "AI読み取り中" : "撮影後に範囲確認して読み取ります"}
                </p>
                <p className="text-sm font-bold text-neutral-600">
                  文字部分だけ切り抜き、表は行ごとに分けて解析できます。読み取り後は確認POPUPで反映します。
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs font-bold text-teal-900">
              {ingredientOcrStatus || "文字範囲を確認し、必要に応じて行ごと・商品ごとに分けてAI読み取りします。"}
            </p>
            {ingredientOcrCandidates.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-black text-white"
                  onClick={() => setIsIngredientOcrListOpen(true)}
                >
                  OCR候補一覧を開く
                </button>
                <span className="text-xs font-bold text-neutral-600">
                  未処理 {ingredientOcrCandidates.filter((_, index) => (ingredientOcrCandidateStatuses[index] || "未処理") === "未処理").length}件 /
                  全{ingredientOcrCandidates.length}件
                </span>
              </div>
            )}
          </section>
          <section className="rounded-md border border-neutral-200 bg-white p-4">
            <h3 className="font-black text-neutral-900">基本情報</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <TextInput
                label="原材料名"
                value={ingredientForm.name}
                onChange={(value) =>
                  setIngredientForm({
                    ...ingredientForm,
                    name: value,
                    labelName: value,
                  })
                }
              />
              <TextInput label="製品名" value={ingredientForm.packageName} onChange={(value) => setIngredientForm({ ...ingredientForm, packageName: value })} />
              <SelectInput
                label="材料タイプ"
                value={ingredientForm.type}
                options={materialTypeOptions}
                optionLabels={materialTypeLabels}
                onChange={(value) => {
                  const nextType = value as MaterialType;
                  setIngredientForm({
                    ...ingredientForm,
                    type: nextType,
                    category: nextType === "PACKAGING" ? "包材" : ingredientForm.category,
                    caloriesPer100g: nextType === "PACKAGING" ? 0 : ingredientForm.caloriesPer100g,
                    proteinPer100g: nextType === "PACKAGING" ? 0 : ingredientForm.proteinPer100g,
                    fatPer100g: nextType === "PACKAGING" ? 0 : ingredientForm.fatPer100g,
                    carbsPer100g: nextType === "PACKAGING" ? 0 : ingredientForm.carbsPer100g,
                    saltPer100g: nextType === "PACKAGING" ? 0 : ingredientForm.saltPer100g,
                    allergens: nextType === "PACKAGING" ? [] : ingredientForm.allergens,
                    otherAllergen: nextType === "PACKAGING" ? "" : ingredientForm.otherAllergen,
                  });
                }}
              />
              <CategoryInput
                label="カテゴリ"
                value={ingredientForm.category}
                categories={editableIngredientCategories}
                onChange={(value) => setIngredientForm({ ...ingredientForm, category: value })}
              />
              <TextInput label="仕入先" value={ingredientForm.supplier} onChange={(value) => setIngredientForm({ ...ingredientForm, supplier: value })} />
            </div>
          </section>

          <section className="mt-4 rounded-md border border-neutral-200 bg-white p-5">
            <h3 className="border-b border-neutral-100 pb-2 text-lg font-black text-neutral-900">価格・内容量</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <NumberInput label="内容量" value={ingredientForm.packageAmountGram} onChange={(value) => setIngredientForm({ ...ingredientForm, packageAmountGram: value })} />
              <TextInput label="単位" value={ingredientForm.packageUnit} onChange={(value) => setIngredientForm({ ...ingredientForm, packageUnit: value })} />
              <NumberInput label="仕入価格" value={ingredientForm.price} onChange={(value) => setIngredientForm({ ...ingredientForm, price: value })} />
              <SelectInput label="税込/税抜" value={ingredientForm.taxType} options={["税抜", "税込"]} onChange={(value) => setIngredientForm({ ...ingredientForm, taxType: value as Ingredient["taxType"] })} />
            </div>
            <p className="mt-2 text-xs font-bold text-neutral-500">kgは保存時にgへ変換されます。税抜が標準です。</p>
            {!isPackagingForm && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                <label className="flex items-center gap-2 text-sm font-black text-amber-950">
                  <input
                    type="checkbox"
                    checked={usesIngredientUnitConversion}
                    onChange={(event) => {
                      setShowIngredientUnitConversion(event.target.checked);
                      if (!event.target.checked) {
                        setIngredientForm({ ...ingredientForm, gramPerUnit: 1 });
                      }
                    }}
                  />
                  個数でもgでも使う材料として登録する
                </label>
                {usesIngredientUnitConversion && (
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <NumberInput
                      label="可食・使用可能量g"
                      value={ingredientForm.packageAmountGram}
                      onChange={(value) => {
                        const count = ingredientUnitCount || 1;
                        setIngredientForm({
                          ...ingredientForm,
                          packageAmountGram: value,
                          packageUnit: "g",
                          gramPerUnit: count ? value / count : ingredientForm.gramPerUnit,
                        });
                      }}
                    />
                    <NumberInput
                      label="仕入個数"
                      value={ingredientUnitCount || 1}
                      onChange={(value) =>
                        setIngredientForm({
                          ...ingredientForm,
                          packageUnit: "g",
                          gramPerUnit: value ? ingredientForm.packageAmountGram / value : 1,
                        })
                      }
                    />
                    <div className="rounded-md border border-amber-200 bg-white p-3 text-sm font-black text-amber-950">
                      1個あたり {number(ingredientForm.gramPerUnit || 0)}g
                      <span className="mt-1 block text-xs font-bold text-amber-800">
                        例: 玉子 144個 / 可食量7200g / 6500円なら、1個50gで計算します。
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {!isPackagingForm && (
            <section className="mt-5 rounded-md border border-neutral-200 bg-white p-5">
              <h3 className="border-b border-neutral-100 pb-2 text-lg font-black text-neutral-900">栄養成分 100gあたり</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <NumberInput label="エネルギー kcal" value={ingredientForm.caloriesPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, caloriesPer100g: value })} />
                <NumberInput label="たんぱく質 g" value={ingredientForm.proteinPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, proteinPer100g: value })} />
                <NumberInput label="脂質 g" value={ingredientForm.fatPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, fatPer100g: value })} />
                <NumberInput label="炭水化物 g" value={ingredientForm.carbsPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, carbsPer100g: value })} />
                <NumberInput label="食塩相当量 g" value={ingredientForm.saltPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, saltPer100g: value })} />
              </div>
            </section>
          )}
          {learnedIngredientAlias && (
            <section className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-black text-emerald-950">登録履歴から候補があります</h3>
                  <p className="text-xs font-bold text-emerald-900">
                    {learnedIngredientAlias.sourceText} → {learnedIngredientAlias.packageName || learnedIngredientAlias.name}
                  </p>
                </div>
                <button className="rounded-md bg-emerald-700 px-4 py-2 font-bold text-white" onClick={applyLearnedIngredientAlias}>
                  登録履歴を反映
                </button>
              </div>
            </section>
          )}
          {!isPackagingForm && (
            <section className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3">
              <h3 className="font-black text-sky-950">栄養成分データベースから反映</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_160px]">
                <TextInput
                  label="食品名検索"
                  value={nutritionSearchText}
                  onChange={(value) => {
                    setNutritionSearchText(value);
                    setSelectedStandardNutritionId("");
                    setAppliedStandardNutritionId("");
                  }}
                />
                <SelectInput
                  label="候補"
                  value={selectedStandardNutrition?.id ?? ""}
                  options={standardNutritionMatches.map((food) => food.id)}
                  optionLabels={Object.fromEntries(standardNutritionMatches.map((food) => [food.id, `${food.name}（${food.foodNumber}）`]))}
                  onChange={(value) => {
                    setSelectedStandardNutritionId(value);
                    setAppliedStandardNutritionId("");
                  }}
                />
                <button
                  className="self-end rounded-md bg-sky-700 px-4 py-2 font-bold text-white disabled:bg-neutral-300"
                  disabled={!selectedStandardNutrition}
                  onClick={() => applyStandardNutrition()}
                >
                  栄養を反映
                </button>
              </div>
              {appliedStandardNutrition && (
                <div className="mt-3 rounded-md border border-sky-300 bg-white px-3 py-2 text-xs font-black text-sky-950">
                  現在、この原材料には「{appliedStandardNutrition.name}（{appliedStandardNutrition.foodNumber}）」の栄養成分を反映しています。
                  もう一度「栄養を反映」を押すと、同じ候補の数値を再反映します。
                </div>
              )}
              {selectedStandardNutrition && (
                <p className="mt-2 text-xs font-bold text-sky-950">
                  {selectedStandardNutrition.name}: {number(selectedStandardNutrition.caloriesPer100g, 0)}kcal /
                  P {number(selectedStandardNutrition.proteinPer100g)}g /
                  F {number(selectedStandardNutrition.fatPer100g)}g /
                  C {number(selectedStandardNutrition.carbsPer100g)}g /
                  食塩 {number(selectedStandardNutrition.saltPer100g, 2)}g
                </p>
              )}
              <p className="mt-1 text-xs font-bold text-sky-900">
                文科省食品成分表Excelから取り込んだ100gあたり値です。正式表示では原材料仕様書などで最終確認してください。
              </p>
            </section>
          )}
          <section className="mt-3 rounded-md border border-neutral-200 bg-white p-4">
            <h3 className="font-black text-neutral-900">{isPackagingForm ? "表示名" : "表示・アレルゲン"}</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <TextInput label="原材料表示名" value={ingredientForm.labelName} onChange={(value) => setIngredientForm({ ...ingredientForm, labelName: value })} />
              {!isPackagingForm && <TextInput label="その他アレルゲン" value={ingredientForm.otherAllergen} onChange={(value) => setIngredientForm({ ...ingredientForm, otherAllergen: value })} />}
            </div>
            {isPackagingForm ? (
              <p className="mt-2 text-xs font-bold text-neutral-500">包材は栄養成分・アレルゲン入力を省略します。</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {allergenOptions.map((allergen) => (
                  <label key={allergen} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-bold text-neutral-700">
                    <input
                      type="checkbox"
                      checked={ingredientForm.allergens.includes(allergen)}
                      onChange={(event) =>
                        setIngredientForm({
                          ...ingredientForm,
                          allergens: event.target.checked
                            ? [...ingredientForm.allergens, allergen]
                            : ingredientForm.allergens.filter((item) => item !== allergen),
                        })
                      }
                    />
                    {allergen}
                  </label>
                ))}
              </div>
            )}
          </section>
          {possibleDuplicateIngredients.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              <p>重複の可能性があります。</p>
              <p className="mt-1 text-xs">
                {possibleDuplicateIngredients.map((ingredient) => ingredientOptionLabel(ingredient)).join(" / ")}
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={saveIngredient}>
              原材料を保存
            </button>
            {possibleDuplicateIngredients.length > 0 && (
              <button className="rounded-md border border-amber-300 bg-white px-4 py-2 font-bold text-amber-800" onClick={skipIngredientForm}>
                重複の恐れがあるのでスキップ
              </button>
            )}
          </div>
        </Panel>
      )}

      {activePage === "product" && (
        <Panel title="商品登録">
          <div className="grid gap-3 md:grid-cols-3">
            <TextInput label="商品名" value={productForm.name} onChange={(value) => setProductForm({ ...productForm, name: value })} />
            <SelectInput
              label="商品カテゴリ"
              value={productForm.category || productCategoryOptions[0] || ""}
              options={productCategoryOptions.length > 0 ? productCategoryOptions : ["未分類"]}
              onChange={(value) => setProductForm({ ...productForm, category: value })}
            />
            <NumberInput label="販売価格" value={productForm.sellingPrice} onChange={(value) => setProductForm({ ...productForm, sellingPrice: value })} />
            <SelectInput label="税込/税抜" value={productForm.taxType} options={["税込", "税抜"]} onChange={(value) => setProductForm({ ...productForm, taxType: value as Product["taxType"] })} />
            <NumberInput label="目標原価率%" value={productForm.targetCostRate} onChange={(value) => setProductForm({ ...productForm, targetCostRate: value })} />
            <SelectInput label="表示単位" value={productForm.displayUnit} options={["1個あたり", "100gあたり", "1袋あたり", "1本あたり", "1台あたり"]} onChange={(value) => setProductForm({ ...productForm, displayUnit: value as Product["displayUnit"] })} />
            <NumberInput label="出来上がり個数" value={productForm.yieldCount} onChange={(value) => setProductForm({ ...productForm, yieldCount: value })} />
            <NumberInput label="焼成前総重量g" value={productForm.beforeBakeWeightGram} onChange={(value) => setProductForm({ ...productForm, beforeBakeWeightGram: value })} />
            <NumberInput label="焼成後総重量g" value={productForm.afterBakeWeightGram ?? 0} onChange={(value) => setProductForm({ ...productForm, afterBakeWeightGram: value || null })} />
            <NumberInput label="1個あたり重量g" value={productForm.weightPerPieceGram} onChange={(value) => setProductForm({ ...productForm, weightPerPieceGram: value })} />
            <SelectInput label="販売状態" value={productForm.status} options={["販売中", "休止中"]} onChange={(value) => setProductForm({ ...productForm, status: value as ProductStatus })} />
          </div>
          <button className="mt-3 rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={saveProduct}>
            商品を保存
          </button>
          {productForm.id && (
            <button className="ml-2 mt-3 rounded-md border border-red-300 bg-red-50 px-4 py-2 font-bold text-red-700" onClick={deleteProductFromForm}>
              この商品を削除
            </button>
          )}
          <button className="ml-2 mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 font-bold text-amber-900" onClick={() => setActivePage("productCategory")}>
            商品カテゴリを管理
          </button>
          <button className="ml-2 mt-3 rounded-md border border-orange-300 bg-orange-50 px-4 py-2 font-bold text-orange-900" onClick={() => setActivePage("productList")}>
            商品一覧を見る
          </button>
          <label className="mt-3 flex w-fit items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 font-bold text-neutral-700">
            <input
              type="checkbox"
              checked={productForm.isIntermediateMaterial}
              onChange={(event) => setProductForm({ ...productForm, isIntermediateMaterial: event.target.checked })}
            />
            中間材料として使う
          </label>
        </Panel>
      )}

      {activePage === "productCategory" && (
        <Panel title="商品カテゴリ">
          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <TextInput label="新しい商品カテゴリ" value={productCategoryForm} onChange={setProductCategoryForm} onEnter={saveProductCategory} />
            <button className="self-end rounded-md bg-yellow-600 px-4 py-2 font-bold text-white" onClick={saveProductCategory}>
              カテゴリ追加
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {productCategoryOptions.map((category) => (
              <div key={category} className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
                <span className="font-black text-yellow-950">{category}</span>
                <span className="text-xs font-bold text-yellow-800">
                  {data.products.filter((product) => product.category === category).length}件
                </span>
                <button className="rounded bg-white px-2 py-1 text-xs font-bold text-red-700" onClick={() => deleteProductCategory(category)}>
                  削除
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold text-neutral-500">
            商品登録では、ここで作成したカテゴリをプルダウンから選びます。
          </p>
        </Panel>
      )}

      {activePage === "productList" && (
        <Panel title="商品一覧">
          <div className="flex flex-wrap gap-2">
            {productCategoryFilterOptions.map((category) => (
              <button
                key={category}
                className={`rounded-md border px-3 py-2 text-sm font-black ${
                  activeProductCategory === category
                    ? "border-orange-600 bg-orange-500 text-white"
                    : "border-orange-200 bg-orange-50 text-orange-900"
                }`}
                onClick={() => setActiveProductCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-orange-50 text-orange-950">
                <tr>
                  <th className="p-3">商品名</th>
                  <th className="p-3">カテゴリ</th>
                  <th className="p-3 text-right">販売価格</th>
                  <th className="p-3 text-right">原価/個</th>
                  <th className="p-3 text-right">原価率</th>
                  <th className="p-3">状態</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProductList.map((product) => {
                  const summary = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
                  return (
                    <tr key={product.id} className="border-t border-neutral-200">
                      <td className="p-3 font-black">
                        {product.name}
                        {product.isIntermediateMaterial && <span className="ml-2 rounded bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">中間材料</span>}
                      </td>
                      <td className="p-3">{product.category || "未分類"}</td>
                      <td className="p-3 text-right">{yen(product.sellingPrice)}</td>
                      <td className="p-3 text-right">{yen(summary.costPerPiece)}</td>
                      <td className={`p-3 text-right font-black ${summary.costRate >= 40 ? "text-red-700" : summary.costRate >= 35 ? "text-amber-700" : "text-neutral-800"}`}>
                        {number(summary.costRate)}%
                      </td>
                      <td className="p-3">{product.status}</td>
                      <td className="p-3 text-right">
                        <button className="rounded-md bg-orange-600 px-3 py-2 text-xs font-bold text-white" onClick={() => editProductFromList(product)}>
                          編集
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProductList.length === 0 && (
            <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm font-bold text-neutral-600">
              このカテゴリの商品はまだありません。
            </p>
          )}
        </Panel>
      )}

      {activePage === "recipe" && (
        <Panel title="レシピ登録">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_140px]">
            <TextInput
              label="新しい商品名"
              value={recipeProductName}
              onChange={updateRecipeProductName}
              onEnter={addProductFromRecipeName}
            />
            <label className="self-end flex min-h-10 items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-900">
              <input
                type="checkbox"
                checked={recipeProductIsIntermediate}
                onChange={(event) => {
                  setRecipeProductIsIntermediate(event.target.checked);
                  setProductForm((current) => ({ ...current, isIntermediateMaterial: event.target.checked }));
                }}
              />
              中間材料
            </label>
            <button className="self-end rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={addProductFromRecipeName}>
              商品追加
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
            <SelectInput
              label="商品"
              value={recipeProductSelectId}
              options={["", ...data.products.map((product) => product.id)]}
              optionLabels={{ "": "以下の一覧からも選べます", ...Object.fromEntries(data.products.map((product) => [product.id, product.name])) }}
              onChange={(value) => {
                setRecipeProductSelectId(value);
                if (!value) return;
                setRecipeProductName("");
                setSelectedProductId(value);
              }}
            />
            <div className="self-end rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs font-bold text-neutral-600">
              新しい商品名が入力されている場合は、その名前の商品登録を優先します。既存商品に追加する場合は一覧から選んでください。
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
            <aside className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <h3 className="font-black">製品名パレット</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {ingredientCategories.map((category) => (
                  <button
                    key={category}
                    className={`rounded-md border px-3 py-2 text-xs font-bold ${
                      activeIngredientCategory === category
                        ? "border-teal-700 bg-teal-50 text-teal-800"
                        : "border-neutral-200 bg-white text-neutral-700"
                    }`}
                    onClick={() => setActiveIngredientCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {visibleIntermediateProducts.map((product) => {
                  const summary = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
                  const unitCost = summary.totalRecipeWeightGram ? summary.totalCost / summary.totalRecipeWeightGram : 0;
                  return (
                    <button
                      key={product.id}
                      draggable
                      className="relative min-h-20 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-left"
                      onClick={() => setSelectedProductId(product.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("application/json", JSON.stringify({ type: "intermediate", id: product.id }));
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                    >
                      <span className="block pr-8 font-black">{product.name}</span>
                      <span className="mt-1 inline-block rounded bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">中間材料</span>
                      <span className="mt-1 block text-xs text-neutral-500">{yen(unitCost)} / g</span>
                      <span
                        role="button"
                        tabIndex={0}
                        title="削除"
                        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-red-50 text-sm font-black text-red-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          deletePaletteItem("intermediate", product.id);
                        }}
                      >
                        ×
                      </span>
                    </button>
                  );
                })}
                {filteredIngredients.map((ingredient) => (
                  <button
                    key={ingredient.id}
                    draggable
                    className={`relative min-h-20 rounded-md border bg-white p-2 text-left ${
                      recipeIngredientId === ingredient.id ? "border-teal-700 ring-2 ring-teal-100" : "border-neutral-200"
                    }`}
                    onClick={() => setRecipeIngredientId(ingredient.id)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/json", JSON.stringify({ type: "ingredient", id: ingredient.id }));
                      event.dataTransfer.setData("text/plain", ingredient.id);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                  >
                    <span className="block pr-8 font-black">{ingredient.packageName || ingredient.name}</span>
                    {ingredient.packageName && ingredient.packageName !== ingredient.name && (
                      <span className="block text-[11px] font-bold text-neutral-500">{ingredient.name}</span>
                    )}
                    <span className="mt-1 inline-block rounded bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600">
                      {ingredient.category || "未分類"}
                    </span>
                    <span className="mt-1 block text-xs text-neutral-500">{yen(pricePerGram(ingredient))} / {ingredientUnitLabel(ingredient)}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="削除"
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-red-50 text-sm font-black text-red-700"
                      onClick={(event) => {
                        event.stopPropagation();
                        deletePaletteItem("ingredient", ingredient.id);
                      }}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
              <div
                className="mt-3 rounded-md border-2 border-dashed border-red-300 bg-red-50 p-3 text-center text-sm font-black text-red-700"
                onDragOver={(event) => event.preventDefault()}
                onDrop={dropPaletteItemToTrash}
              >
                ゴミ箱へドラッグして削除
              </div>
            </aside>

            <div
              className="rounded-md border-2 border-dashed border-teal-200 bg-white p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={dropRecipeIngredient}
            >
              <div className="mb-3 rounded-md bg-teal-50 p-3 text-sm font-bold text-teal-900">
                左のカードをここへドラッグすると、レシピ行に追加されます。中間材料も同じように追加できます。
              </div>
              <RecipeTable
                rows={recipeRows}
                ingredients={data.ingredients}
                products={data.products}
                recipeItems={data.recipeItems}
                onDelete={deleteRecipeItem}
                onAmountChange={updateRecipeItemAmount}
                onItemChange={updateRecipeItem}
              />
            </div>
          </div>
        </Panel>
      )}

      {activePage === "cost" && (
        <Panel title="原価計算">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectInput label="商品" value={selectedProduct?.id ?? ""} options={data.products.map((product) => product.id)} optionLabels={Object.fromEntries(data.products.map((product) => [product.id, product.name]))} onChange={setSelectedProductId} />
            <NumberInput label="売価" value={selectedProduct?.sellingPrice ?? 0} onChange={updateSelectedProductSellingPrice} />
            <div className="self-end rounded-md border border-teal-200 bg-teal-50 p-3 text-xs font-bold text-teal-900">
              ここで売価を変えると商品登録にも反映されます。
            </div>
          </div>
          {costSummary && (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Metric label="材料原価/個" value={yen(costSummary.materialCostPerPiece)} />
              <Metric label="材料原価率" value={percent(costSummary.materialCostRate)} tone={costSummary.materialCostRate >= 40 ? "danger" : costSummary.materialCostRate >= 35 ? "warn" : "normal"} />
              <Metric label="包材込み原価/個" value={yen(costSummary.costPerPiece)} />
              <Metric label="包材込み原価率" value={percent(costSummary.costRate)} tone={costSummary.costRate >= 40 ? "danger" : costSummary.costRate >= 35 ? "warn" : "normal"} />
              <Metric label="材料合計原価" value={yen(costSummary.materialTotalCost)} />
              <Metric label="包材合計原価" value={yen(costSummary.packagingTotalCost)} />
              <Metric label="包材原価/個" value={yen(costSummary.packagingCostPerPiece)} />
              <Metric label="レシピ重量" value={`${number(costSummary.totalRecipeWeightGram)}g`} />
              {effectiveCostSummary && (
                <>
                  <Metric label="人件費/個" value={yen(effectiveCostSummary.laborCostPerPiece)} />
                  <Metric label="実質原価/個" value={yen(effectiveCostSummary.effectiveCostPerPiece)} />
                  <Metric label="実質原価率" value={percent(effectiveCostSummary.effectiveCostRate)} tone={effectiveCostSummary.effectiveCostRate >= 50 ? "danger" : effectiveCostSummary.effectiveCostRate >= 40 ? "warn" : "normal"} />
                </>
              )}
            </div>
          )}
          <RecipeTable rows={recipeRows} ingredients={data.ingredients} products={data.products} recipeItems={data.recipeItems} onDelete={deleteRecipeItem} />
        </Panel>
      )}

      {activePage === "nutrition" && (
        <Panel title="栄養成分計算">
          <section className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            栄養成分表示は登録値をもとにした計算上の目安です。正式な食品表示として使用する場合は、必ず最終確認を行ってください。
          </section>
          <SelectInput label="商品" value={selectedProduct?.id ?? ""} options={data.products.map((product) => product.id)} optionLabels={Object.fromEntries(data.products.map((product) => [product.id, product.name]))} onChange={setSelectedProductId} />
          {nutritionSummary && (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <NutritionBlock title="1商品全体" nutrition={nutritionSummary.totalNutrition} />
              <NutritionBlock title="1個あたり" nutrition={nutritionSummary.nutritionPerPiece} />
              <NutritionBlock title="100gあたり" nutrition={nutritionSummary.nutritionPer100g} />
              <p className="text-xs text-neutral-500 lg:col-span-3">100gあたりの基準重量: {number(nutritionSummary.basisWeightGram)}g</p>
            </div>
          )}
        </Panel>
      )}

      {activePage === "allergen" && (
        <Panel title="アレルゲン一覧">
          <section className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
            この一覧は登録された原材料とレシピから自動集計した確認用です。正式な表示前には、原材料規格書などで最終確認してください。
          </section>
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="w-full min-w-[760px] border-collapse bg-white text-left">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="p-3">商品名</th>
                  <th className="p-3">カテゴリ</th>
                  <th className="p-3">アレルゲン</th>
                  <th className="p-3">原材料表示名のたたき台</th>
                </tr>
              </thead>
              <tbody>
                {data.products.filter((product) => !product.isIntermediateMaterial).map((product) => {
                  const allergens = collectAllergens(product.id, data.ingredients, data.recipeItems, data.products);
                  const labelNames = collectLabelNames(product.id, data.ingredients, data.recipeItems, data.products);
                  return (
                    <tr key={product.id} className="border-t border-neutral-200">
                      <td className="p-3 font-black">{product.name}</td>
                      <td className="p-3">{product.category || "未分類"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {allergens.length > 0 ? allergens.map((allergen) => (
                            <span key={allergen} className="rounded-md bg-fuchsia-50 px-2 py-1 text-xs font-bold text-fuchsia-800">{allergen}</span>
                          )) : <span className="text-neutral-500">なし</span>}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-neutral-700">{labelNames.join("、") || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activePage === "production" && (
        <Panel title="仕込み量逆算">
          <section className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
            作りたい販売数を入力すると、中間材料のレシピまで展開して必要な原材料と包材を計算します。
          </section>
          <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <h3 className="font-black">製造予定数</h3>
              <div className="mt-3 grid gap-2">
                {data.products.filter((product) => !product.isIntermediateMaterial).map((product) => (
                  <label key={product.id} className="grid grid-cols-[1fr_110px] items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50 p-2 font-bold">
                    <span>{product.name}</span>
                    <input
                      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-right"
                      type="number"
                      value={productionPlan[product.id] ?? 0}
                      onChange={(event) => updateProductionPlan(product.id, Number(event.target.value))}
                    />
                  </label>
                ))}
              </div>
            </section>
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black">必要材料</h3>
                <button className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-bold text-white" onClick={exportProductionRequirementsCsv}>
                  CSV出力
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Metric label="必要原材料数" value={`${productionMaterialRequirements.length}件`} />
                <Metric label="必要包材数" value={`${productionPackagingRequirements.length}件`} />
                <Metric label="概算原価合計" value={yen(productionTotalCost)} />
              </div>
              <RequirementTable rows={productionRequirements} />
            </section>
          </div>
        </Panel>
      )}

      {activePage === "order" && (
        <Panel title="発注リスト">
          <section className="mb-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm font-bold text-yellow-900">
            在庫機能は次の段階で追加予定です。まずは仕込み量逆算から「必要材料リスト」として確認できます。
          </section>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="rounded-md bg-yellow-700 px-3 py-2 text-sm font-bold text-white" onClick={exportProductionRequirementsCsv}>
              発注リストCSV
            </button>
          </div>
          <div className="mt-3 grid gap-3">
            {Array.from(new Set(productionRequirements.map((row) => row.supplier || "仕入先未登録"))).map((supplier) => {
              const rows = productionRequirements.filter((row) => (row.supplier || "仕入先未登録") === supplier);
              return (
                <section key={supplier} className="rounded-md border border-neutral-200 bg-white p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="font-black">{supplier}</h3>
                    <span className="text-sm font-bold text-neutral-600">概算 {yen(rows.reduce((sum, row) => sum + row.cost, 0))}</span>
                  </div>
                  <RequirementTable rows={rows} compact />
                </section>
              );
            })}
          </div>
        </Panel>
      )}

      {activePage === "waste" && (
        <Panel title="廃棄ロス記録">
          <section className="mb-3 rounded-md border border-pink-200 bg-pink-50 p-3 text-sm font-bold text-pink-900">
            種別を選ぶと品目が一覧表示されます。数量をタップで増やすだけで、廃棄原価と販売価格換算の損失を自動計算します。
          </section>
          <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="grid gap-3 md:grid-cols-[160px_180px_1fr]">
                <TextInput label="日付" value={wasteDate} onChange={setWasteDate} />
                <SelectInput label="理由" value={wasteReason} options={wasteReasons} onChange={(value) => setWasteReason(value as WasteReason)} />
                <div>
                  <p className="mb-1 text-xs font-bold text-neutral-500">種別</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    {wasteCategories.map((category) => (
                      <button
                        key={category.key}
                        className={`rounded-md border-2 px-3 py-2 font-black ${
                          activeWasteCategory === category.key
                            ? "border-pink-700 bg-pink-600 text-white"
                            : "border-pink-200 bg-pink-50 text-pink-900"
                        }`}
                        onClick={() => setActiveWasteCategory(category.key)}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
                <table className="w-full min-w-[760px] border-collapse bg-white text-left">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="p-3">品目</th>
                      <th className="p-3 text-right">数量</th>
                      <th className="p-3 text-center">入力</th>
                      <th className="p-3 text-right">廃棄原価</th>
                      <th className="p-3 text-right">販売換算</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeWasteRows.map((row) => {
                      const record = wasteQuickRecord(row.itemType, row.id);
                      const quantity = record?.quantity ?? 0;
                      const amounts = calculateWasteRecordAmounts(data, row.itemType, row.id, quantity);
                      return (
                        <tr key={`${row.itemType}-${row.id}`} className="border-t border-neutral-200">
                          <td className="p-3">
                            <strong>{row.name}</strong>
                            <span className="ml-2 text-xs font-bold text-neutral-500">{row.subName}</span>
                          </td>
                          <td className="p-3 text-right font-black">
                            {number(quantity, row.itemType === "INGREDIENT" && row.unit !== "個" && row.unit !== "枚" ? 1 : 0)}{row.unit}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <button className="grid h-10 w-10 place-items-center rounded-md bg-pink-600 text-xl font-black text-white" onClick={() => incrementWasteQuantity(row.itemType, row.id, row.step)}>
                                +
                              </button>
                              <input
                                className="h-10 w-24 rounded-md border border-neutral-300 px-2 text-right font-black"
                                type="number"
                                value={quantity}
                                onChange={(event) => upsertWasteQuantity(row.itemType, row.id, Number(event.target.value))}
                              />
                            </div>
                          </td>
                          <td className="p-3 text-right">{yen(amounts.costAmount)}</td>
                          <td className="p-3 text-right">{yen(amounts.salesEquivalentAmount)}</td>
                          <td className="p-3 text-right">
                            <button className="rounded-md bg-red-50 px-3 py-2 font-bold text-red-700" onClick={() => clearWasteQuantity(row.itemType, row.id)}>
                              削除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {activeWasteRows.length === 0 && (
                      <tr>
                        <td className="p-3 text-neutral-500" colSpan={6}>この種別に表示できる品目がありません。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black">廃棄ロス集計</h3>
                <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-bold text-white" onClick={exportWasteCsv}>
                  CSV出力
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Metric label="廃棄原価合計" value={yen(wasteSummary.totalCostAmount)} tone={wasteSummary.totalCostAmount > 0 ? "warn" : "normal"} />
                <Metric label="販売価格換算" value={yen(wasteSummary.totalSalesEquivalentAmount)} tone={wasteSummary.totalSalesEquivalentAmount > 0 ? "warn" : "normal"} />
                <Metric label="記録件数" value={`${data.wasteRecords.length}件`} />
              </div>
              <section className="mt-4 rounded-md border border-pink-200 bg-pink-50 p-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <TextInput label="月別集計" value={wasteSummaryMonth} onChange={setWasteSummaryMonth} />
                  <button className="rounded-md bg-pink-700 px-3 py-2 text-sm font-bold text-white" onClick={exportWasteMonthlyCsv}>
                    月別CSV
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Metric label="月間廃棄原価" value={yen(wasteMonthlySummary.totalCostAmount)} tone={wasteMonthlySummary.totalCostAmount > 0 ? "warn" : "normal"} />
                  <Metric label="月間販売換算" value={yen(wasteMonthlySummary.totalSalesEquivalentAmount)} tone={wasteMonthlySummary.totalSalesEquivalentAmount > 0 ? "warn" : "normal"} />
                  <Metric label="月間記録件数" value={`${wasteMonthlySummary.recordCount}件`} />
                </div>
                <WasteMonthlySummaryView summary={wasteMonthlySummary} />
              </section>
              <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
                <table className="w-full min-w-[860px] border-collapse bg-white text-left">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="p-3">日付</th>
                      <th className="p-3">品目</th>
                      <th className="p-3">理由</th>
                      <th className="p-3 text-right">数量</th>
                      <th className="p-3 text-right">廃棄原価</th>
                      <th className="p-3 text-right">販売価格換算</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.wasteRecords.map((record) => (
                      <tr key={record.id} className="border-t border-neutral-200">
                        <td className="p-3">{record.date}</td>
                        <td className="p-3 font-bold">{wasteRecordItemName(record, data)}</td>
                        <td className="p-3">{record.reason}</td>
                        <td className="p-3 text-right">{number(record.quantity, record.itemType === "INGREDIENT" ? 1 : 0)}{record.itemType === "INGREDIENT" ? "g" : ""}</td>
                        <td className="p-3 text-right">{yen(record.costAmount)}</td>
                        <td className="p-3 text-right">{yen(record.salesEquivalentAmount)}</td>
                        <td className="p-3 text-right">
                          <button className="rounded-md bg-red-50 px-3 py-1 font-bold text-red-700" onClick={() => deleteWasteRecord(record.id)}>
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                    {data.wasteRecords.length === 0 && (
                      <tr>
                        <td className="p-3 text-neutral-500" colSpan={7}>まだ廃棄ロス記録はありません。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <section className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <h4 className="font-black">廃棄が多い品目TOP10</h4>
                <div className="mt-2 grid gap-2">
                  {wasteSummary.topRows.map((row) => (
                    <div key={`${row.itemType}-${row.itemName}`} className="flex flex-wrap justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold">
                      <span>{row.itemName}</span>
                      <span>{yen(row.costAmount)} / 販売換算 {yen(row.salesEquivalentAmount)}</span>
                    </div>
                  ))}
                  {wasteSummary.topRows.length === 0 && <p className="text-sm font-bold text-neutral-500">記録するとここに集計されます。</p>}
                </div>
              </section>
            </section>
          </div>
        </Panel>
      )}

      {activePage === "monthly" && (
        <Panel title="月間理論原価">
          <section className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900">
            月ごとの販売数を入力すると、売上・理論原価・理論原価率を計算します。実際の仕入額も入れると差額を確認できます。
          </section>
          <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <h3 className="font-black">販売数入力</h3>
              <div className="mt-3 grid gap-3">
                <TextInput
                  label="対象月"
                  value={monthlyTargetMonth}
                  onChange={(value) => {
                    setMonthlyTargetMonth(value);
                    setActualCostForm((current) => ({ ...current, month: value }));
                  }}
                />
                {data.products.filter((product) => !product.isIntermediateMaterial).map((product) => {
                  const record = data.salesRecords.find((item) => item.month === monthlyTargetMonth && item.productId === product.id);
                  return (
                    <label key={product.id} className="grid grid-cols-[1fr_110px] items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50 p-2 font-bold">
                      <span>{product.name}</span>
                      <input
                        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-right"
                        type="number"
                        value={record?.quantity ?? 0}
                        onChange={(event) => updateMonthlySales(product, Number(event.target.value))}
                      />
                    </label>
                  );
                })}
              </div>
              <section className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <h3 className="font-black">実際仕入額</h3>
                <div className="mt-3 grid gap-2">
                  <TextInput label="仕入先" value={actualCostForm.supplier} onChange={(value) => setActualCostForm({ ...actualCostForm, supplier: value })} />
                  <NumberInput label="金額" value={actualCostForm.amount} onChange={(value) => setActualCostForm({ ...actualCostForm, amount: value })} />
                  <TextInput label="メモ" value={actualCostForm.memo} onChange={(value) => setActualCostForm({ ...actualCostForm, memo: value })} />
                  <button className="rounded-md bg-blue-700 px-4 py-2 font-bold text-white" onClick={saveActualCostRecord}>
                    実仕入額を保存
                  </button>
                </div>
              </section>
            </section>
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black">理論原価結果</h3>
                <button className="rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white" onClick={exportMonthlyTheoryCsv}>
                  CSV出力
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Metric label="月間売上" value={yen(monthlyTheory.totalSalesAmount)} />
                <Metric label="月間理論原価" value={yen(monthlyTheory.totalTheoryCostAmount)} />
                <Metric label="理論原価率" value={percent(monthlyTheory.theoryCostRate)} tone={monthlyTheory.theoryCostRate >= 40 ? "danger" : monthlyTheory.theoryCostRate >= 35 ? "warn" : "normal"} />
                <Metric label="実際仕入額" value={yen(monthlyTheory.actualCostAmount)} />
                <Metric label="理論との差額" value={yen(monthlyTheory.differenceAmount)} tone={monthlyTheory.differenceAmount > 0 ? "warn" : "normal"} />
                <Metric label="理論粗利" value={yen(monthlyTheory.totalGrossProfit)} />
              </div>
              <MonthlyTheoryTable rows={monthlyTheory.rows} />
              <section className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                <h4 className="font-black">差額が大きい時の確認ポイント</h4>
                <p className="mt-2">廃棄、試作、仕込み量の作りすぎ、原材料単価の更新漏れ、レシピ入力漏れ、棚卸差異を確認してください。</p>
              </section>
              <section className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <h4 className="font-black">実仕入額の内訳</h4>
                <div className="mt-2 grid gap-2">
                  {data.actualCostRecords.filter((record) => record.month === monthlyTargetMonth).map((record) => (
                    <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold">
                      <span>{record.supplier} / {record.memo || "メモなし"}</span>
                      <span>{yen(record.amount)}</span>
                      <button className="rounded-md bg-red-50 px-2 py-1 text-red-700" onClick={() => deleteActualCostRecord(record.id)}>
                        削除
                      </button>
                    </div>
                  ))}
                  {data.actualCostRecords.filter((record) => record.month === monthlyTargetMonth).length === 0 && (
                    <p className="text-sm font-bold text-neutral-500">実仕入額はまだ登録されていません。</p>
                  )}
                </div>
              </section>
            </section>
          </div>
        </Panel>
      )}

      {activePage === "event" && (
        <Panel title="イベント・クリスマス原価シミュレーション">
          <section className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900">
            イベント名、予定販売数、イベント販売価格を入れると、売上・原価・粗利を計算します。原材料値上げ時の利益減少も確認できます。
          </section>
          <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <h3 className="font-black">イベント作成・選択</h3>
              <div className="mt-3 grid gap-3">
                <SelectInput
                  label="イベント"
                  value={selectedEventPlan?.id ?? ""}
                  options={data.eventPlans.map((event) => event.id)}
                  optionLabels={Object.fromEntries(data.eventPlans.map((event) => [event.id, event.name]))}
                  onChange={setSelectedEventPlanId}
                />
                <TextInput label="イベント名" value={eventPlanForm.name} onChange={(value) => setEventPlanForm({ ...eventPlanForm, name: value })} />
                <TextInput label="日付" value={eventPlanForm.date} onChange={(value) => setEventPlanForm({ ...eventPlanForm, date: value })} />
                <TextInput label="メモ" value={eventPlanForm.memo} onChange={(value) => setEventPlanForm({ ...eventPlanForm, memo: value })} />
                <button className="rounded-md bg-rose-700 px-4 py-2 font-bold text-white" onClick={saveEventPlan}>
                  イベントを保存
                </button>
              </div>
              <section className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <h3 className="font-black">値上げ影響を見る</h3>
                <div className="mt-3 grid gap-3">
                  <SelectInput
                    label="原材料"
                    value={eventImpactIngredientId}
                    options={data.ingredients.map((ingredient) => ingredient.id)}
                    optionLabels={Object.fromEntries(data.ingredients.map((ingredient) => [ingredient.id, ingredientOptionLabel(ingredient)]))}
                    onChange={(value) => {
                      setEventImpactIngredientId(value);
                      setEventImpactNewPrice(data.ingredients.find((ingredient) => ingredient.id === value)?.price ?? 0);
                    }}
                  />
                  <NumberInput label="新価格" value={eventImpactNewPrice} onChange={setEventImpactNewPrice} />
                </div>
              </section>
            </section>
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black">{selectedEventPlan?.name || "イベント未選択"}</h3>
                <button className="rounded-md bg-rose-700 px-3 py-2 text-sm font-bold text-white" onClick={exportEventCsv}>
                  CSV出力
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Metric label="予定売上" value={yen(eventSimulation.totalSalesAmount)} />
                <Metric label="現在粗利" value={yen(eventSimulation.totalCurrentGrossProfit)} />
                <Metric label="値上げ後粗利" value={yen(eventImpactSimulation.totalSimulatedGrossProfit)} />
                <Metric label="現在原価" value={yen(eventSimulation.totalCurrentCost)} />
                <Metric label="値上げ後原価" value={yen(eventImpactSimulation.totalSimulatedCost)} />
                <Metric label="利益減少" value={yen(eventImpactSimulation.totalProfitDecrease)} tone={eventImpactSimulation.totalProfitDecrease > 0 ? "warn" : "normal"} />
              </div>
              <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <h4 className="font-black">予定販売数とイベント販売価格</h4>
                <div className="mt-3 grid gap-2">
                  {data.products.filter((product) => !product.isIntermediateMaterial).map((product) => {
                    const item = data.eventPlanItems.find((candidate) => candidate.eventPlanId === selectedEventPlan?.id && candidate.productId === product.id);
                    return (
                      <div key={product.id} className="grid gap-2 rounded-md bg-white p-2 font-bold md:grid-cols-[1fr_110px_130px] md:items-center">
                        <span>{product.name}</span>
                        <input
                          className="rounded-md border border-neutral-200 px-2 py-1 text-right"
                          type="number"
                          value={item?.plannedQuantity ?? 0}
                          onChange={(event) => updateEventPlanItem(product, { plannedQuantity: Number(event.target.value) })}
                        />
                        <input
                          className="rounded-md border border-neutral-200 px-2 py-1 text-right"
                          type="number"
                          value={item?.sellingPrice ?? product.sellingPrice}
                          onChange={(event) => updateEventPlanItem(product, { sellingPrice: Number(event.target.value) })}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <EventSimulationTable rows={eventImpactSimulation.rows} />
            </section>
          </div>
        </Panel>
      )}

      {activePage === "labor" && (
        <Panel title="作業時間・人件費原価">
          <section className="mb-3 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm font-bold text-stone-900">
            商品ごとに工程、作業時間、人数、時給を入れると、材料原価に人件費を足した実質原価を計算します。
          </section>
          <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <h3 className="font-black">作業時間を登録</h3>
              <div className="mt-3 grid gap-3">
                <SelectInput
                  label="商品"
                  value={laborForm.productId || selectedLaborProduct?.id || ""}
                  options={data.products.filter((product) => !product.isIntermediateMaterial).map((product) => product.id)}
                  optionLabels={Object.fromEntries(data.products.filter((product) => !product.isIntermediateMaterial).map((product) => [product.id, product.name]))}
                  onChange={(value) => setLaborForm(emptyLaborCost(value))}
                />
                <TextInput label="工程名" value={laborForm.processName} onChange={(value) => setLaborForm({ ...laborForm, processName: value })} />
                <NumberInput label="作業時間 分" value={laborForm.minutes} onChange={(value) => setLaborForm({ ...laborForm, minutes: value })} />
                <NumberInput label="人数" value={laborForm.workers} onChange={(value) => setLaborForm({ ...laborForm, workers: value })} />
                <NumberInput label="時給" value={laborForm.hourlyWage} onChange={(value) => setLaborForm({ ...laborForm, hourlyWage: value })} />
                <TextInput label="メモ" value={laborForm.memo} onChange={(value) => setLaborForm({ ...laborForm, memo: value })} />
                <button className="rounded-md bg-stone-800 px-4 py-2 font-bold text-white" onClick={saveLaborCost}>
                  作業時間を保存
                </button>
              </div>
            </section>
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black">実質原価</h3>
                <button className="rounded-md bg-stone-800 px-3 py-2 text-sm font-bold text-white" onClick={exportLaborCsv}>
                  CSV出力
                </button>
              </div>
              {selectedLaborSummary && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Metric label="材料＋包材/個" value={yen(selectedLaborSummary.materialAndPackagingCostPerPiece)} />
                  <Metric label="人件費/個" value={yen(selectedLaborSummary.laborCostPerPiece)} />
                  <Metric label="実質原価/個" value={yen(selectedLaborSummary.effectiveCostPerPiece)} />
                  <Metric label="人件費率" value={percent(selectedLaborSummary.laborCostRate)} tone={selectedLaborSummary.laborCostRate >= 20 ? "warn" : "normal"} />
                  <Metric label="実質原価率" value={percent(selectedLaborSummary.effectiveCostRate)} tone={selectedLaborSummary.effectiveCostRate >= 50 ? "danger" : selectedLaborSummary.effectiveCostRate >= 40 ? "warn" : "normal"} />
                  <Metric label="作業原価合計" value={yen(selectedLaborSummary.laborTotalCost)} />
                </div>
              )}
              <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <h4 className="font-black">登録済み工程</h4>
                <div className="mt-2 grid gap-2">
                  {(selectedLaborSummary?.laborRows ?? []).map((row) => (
                    <div key={row.id} className="grid gap-2 rounded-md bg-white p-2 text-sm font-bold md:grid-cols-[1fr_80px_70px_90px_100px_120px] md:items-center">
                      <span>{row.processName}</span>
                      <span className="text-right">{number(row.minutes, 0)}分</span>
                      <span className="text-right">{number(row.workers, 0)}人</span>
                      <span className="text-right">{yen(row.hourlyWage)}</span>
                      <span className="text-right">{yen(row.costAmount)}</span>
                      <span className="flex justify-end gap-2">
                        <button className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-700" onClick={() => editLaborCost(row)}>編集</button>
                        <button className="rounded-md bg-red-50 px-2 py-1 text-red-700" onClick={() => deleteLaborCost(row.id)}>削除</button>
                      </span>
                    </div>
                  ))}
                  {(selectedLaborSummary?.laborRows.length ?? 0) === 0 && (
                    <p className="text-sm font-bold text-neutral-500">作業時間を登録するとここに表示されます。</p>
                  )}
                </div>
              </div>
              <LaborSummaryTable rows={laborSummaries} />
            </section>
          </div>
        </Panel>
      )}

      {activePage === "set" && (
        <Panel title="詰合せ商品・ギフト原価計算">
          <section className="mb-3 rounded-md border border-purple-200 bg-purple-50 p-3 text-sm font-bold text-purple-900">
            焼き菓子ギフトのように、単品商品を組み合わせた詰合せ商品の原価を計算します。箱・リボンなどの包材は、詰合せ商品のレシピに登録した包材原価を使います。
          </section>
          <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <h3 className="font-black">詰合せ内容を登録</h3>
              <div className="mt-3 grid gap-3">
                <SelectInput
                  label="詰合せ商品"
                  value={selectedSetProduct?.id ?? ""}
                  options={data.products.filter((product) => !product.isIntermediateMaterial).map((product) => product.id)}
                  optionLabels={Object.fromEntries(data.products.filter((product) => !product.isIntermediateMaterial).map((product) => [product.id, product.name]))}
                  onChange={(value) => {
                    setSelectedSetProductId(value);
                    setSetProductItemForm(emptySetProductItem(value, data.products.find((product) => !product.isIntermediateMaterial && product.id !== value)?.id ?? ""));
                  }}
                />
                <NumberInput label="詰合せ販売価格" value={selectedSetProduct?.sellingPrice ?? 0} onChange={updateSelectedSetProductSellingPrice} />
                <SelectInput
                  label="中に入れる商品"
                  value={setProductItemForm.childProductId}
                  options={data.products.filter((product) => !product.isIntermediateMaterial && product.id !== selectedSetProduct?.id).map((product) => product.id)}
                  optionLabels={Object.fromEntries(data.products.filter((product) => !product.isIntermediateMaterial && product.id !== selectedSetProduct?.id).map((product) => [product.id, product.name]))}
                  onChange={(value) => setSetProductItemForm({ ...setProductItemForm, setProductId: selectedSetProduct?.id ?? setProductItemForm.setProductId, childProductId: value })}
                />
                <NumberInput label="数量" value={setProductItemForm.quantity} onChange={(value) => setSetProductItemForm({ ...setProductItemForm, setProductId: selectedSetProduct?.id ?? setProductItemForm.setProductId, quantity: value })} />
                <TextInput label="メモ" value={setProductItemForm.memo} onChange={(value) => setSetProductItemForm({ ...setProductItemForm, memo: value })} />
                <button className="rounded-md bg-purple-700 px-4 py-2 font-bold text-white" onClick={saveSetProductItem}>
                  詰合せ内容を保存
                </button>
              </div>
            </section>
            <section className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black">{selectedSetProduct?.name || "詰合せ商品未選択"}</h3>
                <button className="rounded-md bg-purple-700 px-3 py-2 text-sm font-bold text-white" onClick={exportSetProductCsv}>
                  CSV出力
                </button>
              </div>
              {selectedSetSummary && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Metric label="中身の商品原価" value={yen(selectedSetSummary.childProductsCost)} />
                  <Metric label="包材原価" value={yen(selectedSetSummary.packagingCost)} />
                  <Metric label="詰合せ原価" value={yen(selectedSetSummary.totalCost)} />
                  <Metric label="販売価格" value={yen(selectedSetSummary.sellingPrice)} />
                  <Metric label="詰合せ原価率" value={percent(selectedSetSummary.costRate)} tone={selectedSetSummary.costRate >= 40 ? "danger" : selectedSetSummary.costRate >= 35 ? "warn" : "normal"} />
                  <Metric label="推奨販売価格" value={yen(selectedSetSummary.recommendedPrice)} />
                </div>
              )}
              <SetProductTable summary={selectedSetSummary} onEdit={editSetProductItem} onDelete={deleteSetProductItem} />
              <section className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <h4 className="font-black">登録済み詰合せ商品</h4>
                <SetProductSummaryTable rows={setProductSummaries} />
              </section>
            </section>
          </div>
        </Panel>
      )}

      {activePage === "impact" && (
        <Panel title="影響分析">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectInput label="原材料" value={impactIngredientId} options={data.ingredients.map((ingredient) => ingredient.id)} optionLabels={Object.fromEntries(data.ingredients.map((ingredient) => [ingredient.id, ingredientOptionLabel(ingredient)]))} onChange={(value) => {
              setImpactIngredientId(value);
              setImpactNewPrice(data.ingredients.find((ingredient) => ingredient.id === value)?.price ?? 0);
            }} />
            <NumberInput label="新価格" value={impactNewPrice} onChange={setImpactNewPrice} />
            <button className="self-end rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={changeIngredientPrice}>価格を反映</button>
          </div>
          <div className="mt-4 grid gap-2">
            {impactRows.map((row) => (
              <div key={row.product.id} className="rounded-md border border-neutral-200 bg-white p-3">
                <div className="flex justify-between gap-3">
                  <strong>{row.product.name}{row.product.isIntermediateMaterial ? "（中間材料）" : ""}</strong>
                  <span>{yen(row.oldCost)} → {yen(row.newCost)}</span>
                </div>
                <p className="text-neutral-600">上昇額 {yen(row.increase)} / 原価率 {percent(row.oldCostRate)} → {percent(row.newCostRate)} / +{number(row.costRateIncreasePoint)}pt</p>
                <p className="font-bold text-teal-800">推奨販売価格 {yen(row.recommendedPrice)} {row.needsPriceReview ? " / 値上げ検討" : ""}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  {row.priceCandidates.map((candidate) => (
                    <span key={candidate.unit} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
                      {candidate.unit}円単位: {yen(candidate.price)}（{percent(candidate.costRate)}）
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <section className="mt-4 rounded-md border border-neutral-200 bg-white p-3">
            <h3 className="font-black">価格改定履歴</h3>
            <div className="mt-2 grid gap-2">
              {data.priceHistories.filter((history) => history.ingredientId === impactIngredientId).slice().reverse().map((history) => (
                <div key={history.id} className="rounded-md bg-neutral-50 p-2 text-sm font-bold text-neutral-700">
                  {new Date(history.changedAt).toLocaleDateString("ja-JP")} / {history.supplier || "仕入先未登録"} / {yen(history.oldPrice)} → {yen(history.newPrice)} / {history.sourceType || "manual"}
                </div>
              ))}
            </div>
          </section>
        </Panel>
      )}

      {activePage === "ocr" && (
        <Panel title="OCR反映">
          <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            撮影OCRの読み取り結果を貼り付けて、原材料名・製品名と価格を照合します。反映前に必ず候補を確認してください。
          </section>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div>
              <label className="mb-3 grid gap-1 font-bold text-neutral-600">
                <span>撮影画像</span>
                <input
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => setOcrImageName(event.target.files?.[0]?.name ?? "")}
                />
                <span className="text-xs font-bold text-neutral-500">
                  {ocrImageName ? `選択中: ${ocrImageName}` : "今は画像選択の入口です。文字認識結果を下に貼り付けて解析します。"}
                </span>
              </label>
              <label className="grid gap-1 font-bold text-neutral-600">
                <span>OCR読み取り結果</span>
                <textarea
                  className="h-64 rounded-md border border-neutral-300 bg-white p-3 font-mono text-xs text-neutral-900"
                  value={ocrText}
                  onChange={(event) => setOcrText(event.target.value)}
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md bg-neutral-900 px-4 py-2 font-bold text-white" onClick={analyzeOcrText}>
                  OCR結果を解析
                </button>
                <button className="rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={applyOcrCandidates}>
                  確認して価格反映
                </button>
              </div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-3">
              <h3 className="font-black">反映候補</h3>
              <div className="mt-3 grid gap-2">
                {ocrCandidates.length === 0 && (
                  <p className="text-neutral-500">解析すると、ここに原材料と新価格の候補が表示されます。</p>
                )}
                {ocrCandidates.map((candidate) => {
                  const ingredient = data.ingredients.find((item) => item.id === candidate.ingredientId);
                  return (
                    <div key={candidate.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                      <p className="text-xs font-bold text-neutral-500">読み取り行: {candidate.line}</p>
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_120px_120px]">
                        <SelectInput
                          label="照合原材料"
                          value={candidate.ingredientId}
                          options={data.ingredients.map((item) => item.id)}
                          optionLabels={Object.fromEntries(data.ingredients.map((item) => [item.id, ingredientOptionLabel(item)]))}
                          onChange={(value) => updateOcrCandidate(candidate.id, { ingredientId: value, oldPrice: data.ingredients.find((item) => item.id === value)?.price ?? candidate.oldPrice })}
                        />
                        <NumberInput label="現在価格" value={ingredient?.price ?? candidate.oldPrice} onChange={(value) => updateOcrCandidate(candidate.id, { oldPrice: value })} />
                        <NumberInput label="新価格" value={candidate.newPrice} onChange={(value) => updateOcrCandidate(candidate.id, { newPrice: value })} />
                      </div>
                      <p className="mt-2 text-xs font-bold text-teal-800">照合精度: {candidate.confidence}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {activePage === "label" && (
        <Panel title="ラベル表示用テキスト">
          <SelectInput label="商品" value={selectedProduct?.id ?? ""} options={data.products.map((product) => product.id)} optionLabels={Object.fromEntries(data.products.map((product) => [product.id, product.name]))} onChange={setSelectedProductId} />
          <LabelPreview text={labelText} />
          <textarea className="mt-3 h-40 w-full rounded-md border border-neutral-300 bg-white p-3 font-mono text-xs" readOnly value={labelText} />
        </Panel>
      )}

      {activePage === "csv" && (
        <Panel title="CSV出力">
          <section className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm font-bold text-indigo-900">
            まずはCSV出力から対応しています。ダウンロードしたCSVはExcelやスプレッドシートで開けます。
          </section>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button className="rounded-md border border-indigo-200 bg-white p-4 text-left shadow-sm hover:bg-indigo-50" onClick={exportIngredientsCsv}>
              <strong className="block text-lg text-indigo-950">原材料一覧CSV</strong>
              <span className="mt-2 block text-xs font-bold text-neutral-500">材料タイプ、仕入先、価格、アレルゲンを出力</span>
            </button>
            <button className="rounded-md border border-teal-200 bg-white p-4 text-left shadow-sm hover:bg-teal-50" onClick={exportProductCostsCsv}>
              <strong className="block text-lg text-teal-950">商品原価CSV</strong>
              <span className="mt-2 block text-xs font-bold text-neutral-500">材料原価、包材原価、原価率、推奨価格を出力</span>
            </button>
            <button className="rounded-md border border-amber-200 bg-white p-4 text-left shadow-sm hover:bg-amber-50" onClick={exportPriceHistoriesCsv}>
              <strong className="block text-lg text-amber-950">価格改定履歴CSV</strong>
              <span className="mt-2 block text-xs font-bold text-neutral-500">旧価格、新価格、仕入先、反映方法を出力</span>
            </button>
          </div>
        </Panel>
      )}

      {activePage === "master" && (
        <Panel title="原材料マスター">
          <div className="mb-4 flex flex-wrap gap-2">
            {ingredientCategories.filter((category) => category !== "中間材料").map((category) => (
              <button
                key={category}
                className={`rounded-md border px-3 py-2 text-sm font-black ${
                  activeIngredientCategory === category
                    ? "border-cyan-700 bg-cyan-600 text-white"
                    : "border-cyan-200 bg-cyan-50 text-cyan-900"
                }`}
                onClick={() => setActiveIngredientCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="grid gap-5">
            {masterIngredientGroups.map((group) => (
              <section key={group.category} className="rounded-md border border-cyan-100 bg-cyan-50/50 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-black text-cyan-950">{group.category}</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-800">{group.ingredients.length}件</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {group.ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="rounded-md border border-neutral-200 bg-white p-3 text-left">
                      <button className="w-full text-left" onClick={() => editIngredientFromMaster(ingredient)}>
                        <strong>{ingredient.packageName || ingredient.name}</strong>
                        {ingredient.packageName && ingredient.packageName !== ingredient.name && <p className="text-xs font-bold text-neutral-500">{ingredient.name}</p>}
                        <p className="text-neutral-600">{number(ingredient.packageAmountGram)}{ingredientUnitLabel(ingredient)} / {yen(ingredient.price)} / {yen(pricePerGram(ingredient))} per {ingredientUnitLabel(ingredient)}</p>
                        <p className="text-xs text-neutral-500">栄養: {hasNutrition(ingredient) ? "登録済み" : "未登録"} / アレルゲン: {ingredient.allergens.join("、") || "なし"}</p>
                      </button>
                      <button
                        className="mt-3 w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700"
                        onClick={() => deleteIngredientFromMaster(ingredient)}
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {masterIngredientGroups.length === 0 && (
            <p className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm font-bold text-neutral-600">このカテゴリの原材料はまだありません。</p>
          )}
        </Panel>
      )}
    </main>
  );
}

function buildLabelText(
  product: Product,
  materialCostPerPiece: number,
  costPerPiece: number,
  costRate: number,
  nutritionSummary: NonNullable<ReturnType<typeof calculateProductNutrition>>,
  data: AppData,
) {
  const allergens = collectAllergens(product.id, data.ingredients, data.recipeItems, data.products);
  const labelNames = collectLabelNames(product.id, data.ingredients, data.recipeItems, data.products);
  return [
    product.name,
    "",
    `栄養成分表示 ${product.displayUnit}`,
    `エネルギー ${number(nutritionSummary.nutritionPerPiece.calories, 0)}kcal`,
    `たんぱく質 ${number(nutritionSummary.nutritionPerPiece.protein)}g`,
    `脂質 ${number(nutritionSummary.nutritionPerPiece.fat)}g`,
    `炭水化物 ${number(nutritionSummary.nutritionPerPiece.carbs)}g`,
    `食塩相当量 ${number(nutritionSummary.nutritionPerPiece.salt, 2)}g`,
    "※この表示値は、目安です。",
    "",
    `アレルゲン: ${allergens.join("、") || "なし"}`,
    `原材料名: ${labelNames.join("、")}`,
    `材料原価: ${yen(materialCostPerPiece)}`,
    `包材込み原価: ${yen(costPerPiece)}`,
    `包材込み原価率: ${percent(costRate)}`,
    "",
    "正式な食品表示として保証するものではありません。確認用のたたき台です。",
  ].join("\n");
}

function LabelPreview({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="mt-3 max-w-sm rounded-md border-2 border-neutral-900 bg-white p-2 text-[11px] leading-tight text-neutral-950 shadow-sm">
      {lines.map((line, index) => (
        <div
          key={`${line}-${index}`}
          className={`min-h-5 border border-neutral-400 px-2 py-1 ${line ? "" : "bg-neutral-50"}`}
        >
          {line || "\u00a0"}
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-white/80 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-neutral-950">
        <span className="h-6 w-1.5 rounded-full bg-teal-500" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "normal",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "normal" | "warn" | "danger";
  compact?: boolean;
}) {
  const toneClass = tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-100 bg-sky-50 text-sky-900";
  return (
    <div className={`rounded-md border shadow-sm ${compact ? "px-2 py-2 md:px-3" : "p-4"} ${toneClass}`}>
      <p className={`${compact ? "text-[10px] leading-tight md:text-xs" : "text-xs"} font-bold opacity-70`}>{label}</p>
      <strong className={`${compact ? "text-sm leading-tight md:text-base" : "text-xl"}`}>{value}</strong>
    </div>
  );
}

function HelpGuide({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const steps = [
    { title: "1. 原材料を登録", body: "カメラ起動、写真、または手入力で材料名・製品名・価格・栄養成分を登録します。", page: "ingredient" as PageKey },
    { title: "2. 商品を登録", body: "販売価格、出来上がり個数、表示単位を登録します。中間材料として使う商品もここで管理できます。", page: "product" as PageKey },
    { title: "3. レシピを作る", body: "製品名パレットから材料をドラッグし、使用量を表の中で入力します。", page: "recipe" as PageKey },
    { title: "4. 原価と栄養を確認", body: "原価率、栄養成分表示、ラベル用テキスト、価格変更の影響を確認します。", page: "cost" as PageKey },
  ];
  const buttonGuides = [
    ["TOP", "各画面へ移動する入口です。迷ったらここへ戻ります。"],
    ["原材料登録", "原材料名、製品名、仕入価格、内容量、栄養成分、アレルゲンを登録します。"],
    ["カメラ起動", "iPadのカメラで伝票やラベルを撮影し、自動でAI読み取りを始めます。"],
    ["写真", "写真ライブラリから画像を選び、自動でAI読み取りを始めます。"],
    ["栄養を反映", "食品成分表データベースから近い食品を選び、栄養成分を入力欄へ入れます。"],
    ["原材料を保存", "入力した原材料をマスターへ保存します。保存後、登録履歴として次回候補にも使われます。"],
    ["商品登録", "商品名、販売価格、出来上がり個数、焼成後重量などを登録します。"],
    ["中間材料", "仕込んだクリームやキャラメルのように、別レシピで材料として使うものにチェックします。"],
    ["レシピ登録", "商品を選び、製品名パレットから材料や中間材料をドラッグしてレシピを作ります。"],
    ["ゴミ箱", "パレットの材料をドラッグして削除できます。削除前に確認が出ます。"],
    ["原価計算", "売価、材料原価、包材込み原価、原価率を確認します。売価もここで編集できます。"],
    ["栄養成分計算", "レシピから1個あたり、100gあたりの栄養成分を計算します。"],
    ["影響分析", "原材料価格を変更した時、どの商品にどれだけ影響するか確認します。"],
    ["ラベル表示", "商品名、栄養成分、アレルゲン、原材料表示名を確認用テキストにします。"],
    ["原材料マスター", "登録済み原材料を一覧で確認し、タップで編集、削除ボタンで削除できます。"],
  ];
  const ocrVideoSteps = [
    {
      title: "1. 価格表を明るく置く",
      body: "紙が斜めになりすぎないように、原材料名と価格が画面いっぱいに入るようにします。",
      label: "準備",
    },
    {
      title: "2. カメラ起動を押す",
      body: "赤いカメラ起動ボタンから撮影します。写真から読む時は写真ボタンを使います。",
      label: "撮影",
    },
    {
      title: "3. 自動でAI読み取り",
      body: "撮影後は自動で読み取りが始まります。複数商品がある時は候補が順番に出ます。",
      label: "読取",
    },
    {
      title: "4. 確認して保存",
      body: "原材料名、製品名、内容量、価格を確認して、合っていれば保存します。重複候補はスキップできます。",
      label: "確認",
    },
  ];

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-teal-200 bg-teal-50 p-4">
        <h3 className="text-lg font-black text-teal-950">最初に覚える流れ</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="relative rounded-md border border-teal-200 bg-white p-3">
              <strong className="block text-teal-900">{step.title}</strong>
              <p className="mt-2 text-sm font-bold text-neutral-600">{step.body}</p>
              <button className="mt-3 rounded-md bg-teal-700 px-3 py-2 text-sm font-bold text-white" onClick={() => onNavigate(step.page)}>
                開く
              </button>
              {index < steps.length - 1 && (
                <span className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-teal-700 text-center font-black text-white lg:block">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-black text-neutral-900">動画ガイド: OCRで原材料を登録する流れ</h3>
            <p className="mt-1 text-sm font-bold text-neutral-500">初めてのスタッフでも、撮影から保存までの流れがわかる説明です。</p>
          </div>
          <button className="rounded-md bg-rose-700 px-4 py-2 text-sm font-bold text-white" onClick={() => onNavigate("ingredient")}>
            原材料登録を開く
          </button>
        </div>
        <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-950 p-3 text-white shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
            <OcrPhoneFrame />
            <div className="grid gap-3">
              <div className="rounded-md bg-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-rose-200">OCR GUIDE</span>
                  <span className="rounded bg-white/10 px-2 py-1 text-[11px] font-bold">約1分</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full w-3/4 rounded-full bg-rose-400" />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {ocrVideoSteps.map((step, index) => (
                  <div key={step.title} className="rounded-md border border-white/10 bg-white/10 p-3">
                    <span className="rounded bg-rose-400 px-2 py-1 text-[11px] font-black text-neutral-950">{step.label}</span>
                    <strong className="mt-3 block text-base">{step.title}</strong>
                    <p className="mt-2 text-sm font-bold text-white/75">{step.body}</p>
                    <div className="mt-3 flex gap-1">
                      {ocrVideoSteps.map((_, dotIndex) => (
                        <span key={dotIndex} className={`h-1.5 flex-1 rounded-full ${dotIndex <= index ? "bg-rose-300" : "bg-white/20"}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-amber-300/40 bg-amber-300/10 p-3 text-sm font-bold text-amber-100">
                読み取り結果はそのまま保存せず、必ず確認画面で人が確認してから登録します。価格や内容量が違う場合は手直しできます。
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-black text-neutral-900">図解: OCR登録</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_40px_1fr_40px_1fr]">
          <HelpBox title="カメラ起動 / 写真" body="伝票、ラベル、価格表を撮影または選択" />
          <HelpArrow />
          <HelpBox title="AI読み取り" body="原材料名、製品名、内容量、単価を候補化" />
          <HelpArrow />
          <HelpBox title="確認POPUP" body="合っていれば反映、重複ならスキップも可能" />
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-black text-neutral-900">図解: レシピ登録</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_40px_1fr_40px_1fr]">
          <HelpBox title="商品を選ぶ" body="苺ショート、焼菓子、中間材料などを選択" />
          <HelpArrow />
          <HelpBox title="ドラッグ" body="製品名パレットから材料をレシピへ移動" />
          <HelpArrow />
          <HelpBox title="使用量を入力" body="g、何個中何個、何分の1で入力" />
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-black text-neutral-900">各ボタンの説明</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {buttonGuides.map(([label, body]) => (
            <div key={label} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <strong className="block text-neutral-900">{label}</strong>
              <p className="mt-1 text-sm font-bold text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-black text-amber-950">正式表示に使う前の注意</h3>
        <p className="mt-2 text-sm font-bold text-amber-900">
          栄養成分は計算上の目安です。食品表示として使う場合は、原材料規格書、メーカー資料、専門家確認などで最終確認してください。
        </p>
      </section>
    </div>
  );
}

function HelpBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-center">
      <strong className="block text-neutral-900">{title}</strong>
      <p className="mt-2 text-sm font-bold text-neutral-600">{body}</p>
    </div>
  );
}

function OcrPhoneFrame() {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[28px] border-4 border-white/20 bg-neutral-900 p-3 shadow-xl">
      <div className="rounded-[20px] bg-neutral-100 p-3 text-neutral-900">
        <div className="flex items-center justify-between text-[11px] font-black text-neutral-500">
          <span>原材料登録</span>
          <span>OCR</span>
        </div>
        <div className="mt-3 rounded-md border-2 border-dashed border-rose-400 bg-white p-3">
          <div className="rounded-md bg-neutral-100 p-2">
            <div className="h-3 w-3/4 rounded bg-neutral-300" />
            <div className="mt-2 h-3 w-5/6 rounded bg-neutral-300" />
            <div className="mt-2 grid grid-cols-[1fr_70px] gap-2">
              <div className="h-3 rounded bg-neutral-300" />
              <div className="h-3 rounded bg-rose-300" />
            </div>
            <div className="mt-2 grid grid-cols-[1fr_70px] gap-2">
              <div className="h-3 rounded bg-neutral-300" />
              <div className="h-3 rounded bg-rose-300" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-rose-600 px-2 py-2 text-center text-xs font-black text-white">カメラ起動</div>
            <div className="rounded-md bg-neutral-800 px-2 py-2 text-center text-xs font-black text-white">写真</div>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 p-2">
          <div className="text-xs font-black text-teal-900">確認POPUP</div>
          <div className="mt-2 grid gap-1">
            <div className="h-3 rounded bg-teal-200" />
            <div className="h-3 rounded bg-teal-200" />
            <div className="h-3 w-2/3 rounded bg-teal-200" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-black">
            <div className="rounded bg-teal-700 py-1 text-center text-white">反映</div>
            <div className="rounded bg-white py-1 text-center text-teal-800">スキップ</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpArrow() {
  return <div className="grid place-items-center text-2xl font-black text-teal-700">→</div>;
}

function TextInput({
  label,
  value,
  onChange,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}) {
  return (
    <label className="grid gap-1 font-bold text-neutral-600">
      <span>{label}</span>
      <input
        className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.();
        }}
      />
    </label>
  );
}

function CategoryInput({
  label,
  value,
  categories,
  onChange,
}: {
  label: string;
  value: string;
  categories: string[];
  onChange: (value: string) => void;
}) {
  const normalizedCategories = Array.from(new Set([...categories, "未分類"].filter(Boolean)));
  const isExisting = normalizedCategories.includes(value);
  return (
    <label className="grid gap-1 font-bold text-neutral-600">
      <span>{label}</span>
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <select
          className="rounded-md border border-neutral-200 bg-white px-2 py-2 text-neutral-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          value={isExisting ? value : "__custom"}
          onChange={(event) => {
            if (event.target.value !== "__custom") onChange(event.target.value);
          }}
        >
          {normalizedCategories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
          <option value="__custom">新規入力</option>
        </select>
        <input
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          placeholder="パレットにないカテゴリ"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 font-bold text-neutral-600">
      <span>{label}</span>
      <input className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-right text-neutral-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function PinInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 font-bold text-neutral-600">
      <span>{label}</span>
      <input
        className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-center tracking-[0.2em] text-neutral-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  optionLabels = {},
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 font-bold text-neutral-600">
      <span>{label}</span>
      <select className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{optionLabels[option] ?? option}</option>
        ))}
      </select>
    </label>
  );
}

function RecipeTable({
  rows,
  ingredients,
  products,
  recipeItems,
  onDelete,
  onAmountChange,
  onItemChange,
}: {
  rows: RecipeItem[];
  ingredients: Ingredient[];
  products: Product[];
  recipeItems: RecipeItem[];
  onDelete: (recipeItemId: string) => void;
  onAmountChange?: (recipeItemId: string, amountGram: number) => void;
  onItemChange?: (recipeItemId: string, patch: Partial<RecipeItem>) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[980px] border-collapse bg-white text-left">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-3">製品名 / 原材料名</th>
            <th className="p-3">入力方法</th>
            <th className="p-3 text-right">使用量</th>
            <th className="p-3 text-right">ロス率</th>
            <th className="p-3 text-right">栄養換算g</th>
            <th className="p-3 text-right">単価</th>
            <th className="p-3 text-right">原価</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
            const intermediate = products.find((candidate) => candidate.id === item.intermediateProductId);
            const normalizedItem = normalizeRecipeItem(item);
            const amount = recipeItemAmountGram(normalizedItem);
            const unit = ingredient ? ingredientUnitLabel(ingredient) : "";
            const intermediateSummary = intermediate ? calculateProductCost(intermediate, ingredients, recipeItems, products) : null;
            const intermediateUnitCost = intermediateSummary?.totalRecipeWeightGram ? intermediateSummary.totalCost / intermediateSummary.totalRecipeWeightGram : 0;
            const nutritionGram = ingredient ? amountToGram(ingredient, amount) : amount;
            return (
              <tr key={item.id} className="border-t border-neutral-200">
                <td className="p-3">
                  <strong>{item.itemType === "intermediate" ? intermediate?.name : ingredient?.packageName || ingredient?.name}</strong>
                  {ingredient?.packageName && ingredient.packageName !== ingredient.name && (
                    <span className="ml-2 text-[11px] font-bold text-neutral-500">{ingredient.name}</span>
                  )}
                  <span className="ml-2 rounded bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600">
                    {item.itemType === "intermediate" ? "中間材料" : ingredient?.category || "未分類"}
                  </span>
                </td>
                <td className="p-3">
                  {onItemChange ? (
                    <select
                      className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-neutral-900"
                      value={normalizedItem.usageType}
                      onChange={(event) => onItemChange(item.id, { usageType: event.target.value as RecipeUsageType })}
                    >
                      <option value="gram">g</option>
                      <option value="count">何個中何個</option>
                      <option value="fraction">何分の1</option>
                    </select>
                  ) : (
                    usageTypeLabel(normalizedItem.usageType)
                  )}
                </td>
                <td className="p-3 text-right">
                  {onAmountChange ? (
                    <RecipeAmountEditor item={normalizedItem} ingredient={ingredient} onAmountChange={onAmountChange} onItemChange={onItemChange} />
                  ) : (
                    usageDescription(normalizedItem)
                  )}
                </td>
                <td className="p-3 text-right">
                  {onItemChange ? (
                    <SmallNumberInput label="%" value={normalizedItem.lossRate} onChange={(value) => onItemChange(item.id, { lossRate: value })} />
                  ) : (
                    `${number(normalizedItem.lossRate)}%`
                  )}
                </td>
                <td className="p-3 text-right">{number(nutritionGram)}g</td>
                <td className="p-3 text-right">
                  {item.itemType === "intermediate" ? `${yen(intermediateUnitCost)} / g` : ingredient ? `${yen(pricePerGram(ingredient))} / ${unit}` : "-"}
                </td>
                <td className="p-3 text-right">
                  {item.itemType === "intermediate" ? yen(intermediateUnitCost * amount) : ingredient ? yen(pricePerGram(ingredient) * amount) : "-"}
                </td>
                <td className="p-3 text-right">
                  <button className="rounded-md bg-red-50 px-3 py-1 font-bold text-red-700" onClick={() => onDelete(item.id)}>
                    削除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecipeAmountEditor({
  item,
  ingredient,
  onAmountChange,
  onItemChange,
}: {
  item: RecipeItem;
  ingredient?: Ingredient;
  onAmountChange: (recipeItemId: string, amountGram: number) => void;
  onItemChange?: (recipeItemId: string, patch: Partial<RecipeItem>) => void;
}) {
  if (item.usageType === "count") {
    const unitGram = ingredient?.gramPerUnit || 0;
    return (
      <div className="grid justify-items-end gap-1">
        {unitGram > 1 && (
          <span className="text-[11px] font-bold text-amber-700">1個={number(unitGram)}g</span>
        )}
        <div className="flex justify-end gap-1">
          <SmallNumberInput label="元量" value={item.baseAmountGram} onChange={(value) => onItemChange?.(item.id, { baseAmountGram: value })} />
          <SmallNumberInput label="全" value={item.totalCount} onChange={(value) => onItemChange?.(item.id, { totalCount: value })} />
          <SmallNumberInput label="使" value={item.usedCount} onChange={(value) => onItemChange?.(item.id, { usedCount: value })} />
        </div>
      </div>
    );
  }

  if (item.usageType === "fraction") {
    return (
      <div className="flex justify-end gap-1">
        <SmallNumberInput label="元量" value={item.baseAmountGram} onChange={(value) => onItemChange?.(item.id, { baseAmountGram: value })} />
        <SmallNumberInput label="1/" value={item.fractionDenominator} onChange={(value) => onItemChange?.(item.id, { fractionDenominator: value })} />
      </div>
    );
  }

  return (
    <input
      className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-right"
      type="number"
      value={item.amountGram}
      onChange={(event) => onAmountChange(item.id, Number(event.target.value))}
    />
  );
}

function SmallNumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid w-16 gap-1 text-[10px] font-bold text-neutral-500">
      <span>{label}</span>
      <input
        className="rounded-md border border-neutral-300 px-1 py-1 text-right text-xs text-neutral-900"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function usageTypeLabel(usageType: RecipeUsageType) {
  if (usageType === "count") return "何個中何個";
  if (usageType === "fraction") return "何分の1";
  return "g";
}

function usageDescription(item: RecipeItem) {
  if (item.usageType === "count") return `${number(item.baseAmountGram)}の${number(item.totalCount, 0)}個中${number(item.usedCount, 0)}個`;
  if (item.usageType === "fraction") return `${number(item.baseAmountGram)}の1/${number(item.fractionDenominator, 0)}`;
  return number(item.amountGram);
}

function RequirementTable({ rows, compact = false }: { rows: RequirementRow[]; compact?: boolean }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[720px] border-collapse bg-white text-left">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-3">種別</th>
            <th className="p-3">原材料</th>
            <th className="p-3">仕入先</th>
            <th className="p-3 text-right">必要量</th>
            <th className="p-3 text-right">概算原価</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ingredient.id} className="border-t border-neutral-200">
              <td className="p-3">
                <span className={`rounded-md px-2 py-1 text-xs font-bold ${row.isPackaging ? "bg-yellow-50 text-yellow-800" : "bg-emerald-50 text-emerald-800"}`}>
                  {row.isPackaging ? "包材" : "原材料"}
                </span>
              </td>
              <td className="p-3">
                <strong>{row.ingredient.packageName || row.ingredient.name}</strong>
                {!compact && row.ingredient.packageName !== row.ingredient.name && <span className="ml-2 text-xs font-bold text-neutral-500">{row.ingredient.name}</span>}
              </td>
              <td className="p-3">{row.supplier || "未登録"}</td>
              <td className="p-3 text-right">{number(row.requiredAmount, row.isPackaging ? 0 : 1)}{row.unit}</td>
              <td className="p-3 text-right">{yen(row.cost)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-3 text-neutral-500" colSpan={5}>製造予定数を入力すると表示されます。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function WasteMonthlySummaryView({ summary }: { summary: WasteMonthlySummary }) {
  return (
    <div className="mt-3 grid gap-3">
      <section className="rounded-md border border-white/80 bg-white p-3">
        <h4 className="font-black">カテゴリ別</h4>
        <div className="mt-2 grid gap-2">
          {summary.categoryRows.map((row) => (
            <div key={row.categoryName} className="grid grid-cols-[1fr_90px_110px] gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm font-bold">
              <span>{row.categoryName}</span>
              <span className="text-right">{number(row.quantity, 1)}</span>
              <span className="text-right">{yen(row.costAmount)}</span>
            </div>
          ))}
          {summary.categoryRows.length === 0 && <p className="text-sm font-bold text-neutral-500">この月の記録はありません。</p>}
        </div>
      </section>
      <section className="rounded-md border border-white/80 bg-white p-3">
        <h4 className="font-black">理由別</h4>
        <div className="mt-2 grid gap-2">
          {summary.reasonRows.map((row) => (
            <div key={row.reason} className="grid grid-cols-[1fr_90px_110px] gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm font-bold">
              <span>{row.reason}</span>
              <span className="text-right">{number(row.quantity, 1)}</span>
              <span className="text-right">{yen(row.costAmount)}</span>
            </div>
          ))}
          {summary.reasonRows.length === 0 && <p className="text-sm font-bold text-neutral-500">この月の記録はありません。</p>}
        </div>
      </section>
      <section className="rounded-md border border-white/80 bg-white p-3">
        <h4 className="font-black">品目別TOP20</h4>
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-neutral-100">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="p-2">品目</th>
                <th className="p-2">カテゴリ</th>
                <th className="p-2 text-right">数量</th>
                <th className="p-2 text-right">廃棄原価</th>
              </tr>
            </thead>
            <tbody>
              {summary.itemRows.map((row) => (
                <tr key={`${row.itemType}-${row.itemName}-${row.categoryName}`} className="border-t border-neutral-100 bg-white">
                  <td className="p-2 font-bold">{row.itemName}</td>
                  <td className="p-2">{row.categoryName}</td>
                  <td className="p-2 text-right">{number(row.quantity, 1)}</td>
                  <td className="p-2 text-right">{yen(row.costAmount)}</td>
                </tr>
              ))}
              {summary.itemRows.length === 0 && (
                <tr>
                  <td className="p-2 text-neutral-500" colSpan={4}>この月の記録はありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MonthlyTheoryTable({ rows }: { rows: MonthlyTheoryRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[860px] border-collapse bg-white text-left">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-3">商品</th>
            <th className="p-3 text-right">販売数</th>
            <th className="p-3 text-right">売上</th>
            <th className="p-3 text-right">理論原価</th>
            <th className="p-3 text-right">理論原価率</th>
            <th className="p-3 text-right">粗利</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.product.id} className="border-t border-neutral-200">
              <td className="p-3 font-bold">{row.product.name}</td>
              <td className="p-3 text-right">{number(row.quantity, 0)}</td>
              <td className="p-3 text-right">{yen(row.salesAmount)}</td>
              <td className="p-3 text-right">{yen(row.theoryCostAmount)}</td>
              <td className="p-3 text-right">{percent(row.theoryCostRate)}</td>
              <td className="p-3 text-right">{yen(row.grossProfit)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-3 text-neutral-500" colSpan={6}>販売数を入力すると表示されます。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EventSimulationTable({ rows }: { rows: EventSimulationRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[980px] border-collapse bg-white text-left">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-3">商品</th>
            <th className="p-3 text-right">予定数</th>
            <th className="p-3 text-right">販売価格</th>
            <th className="p-3 text-right">売上</th>
            <th className="p-3 text-right">現在原価/個</th>
            <th className="p-3 text-right">値上げ後原価/個</th>
            <th className="p-3 text-right">現在粗利</th>
            <th className="p-3 text-right">利益減少</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.product.id} className="border-t border-neutral-200">
              <td className="p-3 font-bold">{row.product.name}</td>
              <td className="p-3 text-right">{number(row.plannedQuantity, 0)}</td>
              <td className="p-3 text-right">{yen(row.sellingPrice)}</td>
              <td className="p-3 text-right">{yen(row.salesAmount)}</td>
              <td className="p-3 text-right">{yen(row.currentUnitCost)}</td>
              <td className="p-3 text-right">{yen(row.simulatedUnitCost)}</td>
              <td className="p-3 text-right">{yen(row.currentGrossProfit)}</td>
              <td className="p-3 text-right">{yen(row.profitDecrease)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-3 text-neutral-500" colSpan={8}>予定販売数を入力すると表示されます。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LaborSummaryTable({ rows }: { rows: ProductLaborCostSummary[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[900px] border-collapse bg-white text-left">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-3">商品</th>
            <th className="p-3 text-right">材料＋包材/個</th>
            <th className="p-3 text-right">人件費/個</th>
            <th className="p-3 text-right">実質原価/個</th>
            <th className="p-3 text-right">人件費率</th>
            <th className="p-3 text-right">実質原価率</th>
            <th className="p-3 text-right">工程数</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.product.id} className="border-t border-neutral-200">
              <td className="p-3 font-bold">{row.product.name}</td>
              <td className="p-3 text-right">{yen(row.materialAndPackagingCostPerPiece)}</td>
              <td className="p-3 text-right">{yen(row.laborCostPerPiece)}</td>
              <td className="p-3 text-right">{yen(row.effectiveCostPerPiece)}</td>
              <td className="p-3 text-right">{percent(row.laborCostRate)}</td>
              <td className={`p-3 text-right font-black ${row.effectiveCostRate >= 50 ? "text-red-700" : row.effectiveCostRate >= 40 ? "text-amber-700" : "text-neutral-900"}`}>
                {percent(row.effectiveCostRate)}
              </td>
              <td className="p-3 text-right">{row.laborRows.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SetProductTable({
  summary,
  onEdit,
  onDelete,
}: {
  summary: SetProductCostSummary | null;
  onEdit: (item: SetProductItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[760px] border-collapse bg-white text-left">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-3">中に入れる商品</th>
            <th className="p-3 text-right">数量</th>
            <th className="p-3 text-right">原価/個</th>
            <th className="p-3 text-right">原価計</th>
            <th className="p-3">メモ</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {(summary?.childRows ?? []).map((row) => (
            <tr key={row.item.id} className="border-t border-neutral-200">
              <td className="p-3 font-bold">{row.childProduct.name}</td>
              <td className="p-3 text-right">{number(row.quantity, 0)}</td>
              <td className="p-3 text-right">{yen(row.unitCost)}</td>
              <td className="p-3 text-right">{yen(row.totalCost)}</td>
              <td className="p-3">{row.item.memo || "-"}</td>
              <td className="p-3 text-right">
                <button className="mr-2 rounded-md bg-neutral-100 px-2 py-1 font-bold text-neutral-700" onClick={() => onEdit(row.item)}>
                  編集
                </button>
                <button className="rounded-md bg-red-50 px-2 py-1 font-bold text-red-700" onClick={() => onDelete(row.item.id)}>
                  削除
                </button>
              </td>
            </tr>
          ))}
          {(summary?.childRows.length ?? 0) === 0 && (
            <tr>
              <td className="p-3 text-neutral-500" colSpan={6}>詰合せ内容を登録すると表示されます。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SetProductSummaryTable({ rows }: { rows: SetProductCostSummary[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[760px] border-collapse bg-white text-left">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-3">詰合せ商品</th>
            <th className="p-3 text-right">品目数</th>
            <th className="p-3 text-right">詰合せ原価</th>
            <th className="p-3 text-right">販売価格</th>
            <th className="p-3 text-right">原価率</th>
            <th className="p-3 text-right">推奨販売価格</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.setProduct.id} className="border-t border-neutral-200">
              <td className="p-3 font-bold">{row.setProduct.name}</td>
              <td className="p-3 text-right">{row.childRows.length}</td>
              <td className="p-3 text-right">{yen(row.totalCost)}</td>
              <td className="p-3 text-right">{yen(row.sellingPrice)}</td>
              <td className={`p-3 text-right font-black ${row.costRate >= 40 ? "text-red-700" : row.costRate >= 35 ? "text-amber-700" : "text-neutral-900"}`}>
                {percent(row.costRate)}
              </td>
              <td className="p-3 text-right">{yen(row.recommendedPrice)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-3 text-neutral-500" colSpan={6}>詰合せ商品を登録すると表示されます。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function NutritionBlock({ title, nutrition }: { title: string; nutrition: { calories: number; protein: number; fat: number; carbs: number; salt: number } }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <strong>{title}</strong>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        <dt>エネルギー</dt><dd className="text-right">{number(nutrition.calories, 0)}kcal</dd>
        <dt>たんぱく質</dt><dd className="text-right">{number(nutrition.protein)}g</dd>
        <dt>脂質</dt><dd className="text-right">{number(nutrition.fat)}g</dd>
        <dt>炭水化物</dt><dd className="text-right">{number(nutrition.carbs)}g</dd>
        <dt>食塩相当量</dt><dd className="text-right">{number(nutrition.salt, 2)}g</dd>
      </dl>
    </div>
  );
}
