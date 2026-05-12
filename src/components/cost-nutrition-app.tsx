"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculatePriceImpact,
  calculateProductCost,
  calculateProductNutrition,
  collectAllergens,
  collectLabelNames,
  hasNutrition,
  ingredientUnitLabel,
  amountToGram,
  pricePerGram,
  recipeItemAmountGram,
} from "@/lib/calculations";
import { sampleData } from "@/lib/sample-data";
import type { AppData, Ingredient, Product, RecipeItem, RecipeUsageType } from "@/lib/types";

const defaultStoreId = "デモ店舗";
const legacyStorageKey = "cost-nutrition-label-mvp-v1";
const storesStorageKey = "cost-nutrition-label-mvp-stores-v1";
const currentStoreStorageKey = "cost-nutrition-label-mvp-current-store-v1";
const allergenOptions = ["卵", "乳", "小麦", "えび", "かに", "くるみ", "そば", "落花生"];
const pages = [
  { key: "top", label: "TOP" },
  { key: "ingredient", label: "原材料登録" },
  { key: "product", label: "商品登録" },
  { key: "recipe", label: "レシピ登録" },
  { key: "cost", label: "原価計算" },
  { key: "nutrition", label: "栄養成分計算" },
  { key: "impact", label: "影響分析" },
  { key: "ocr", label: "OCR反映" },
  { key: "label", label: "ラベル表示" },
  { key: "master", label: "原材料マスター" },
] as const;

type PageKey = (typeof pages)[number]["key"];
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
  memo: string;
  confidence: "high" | "medium" | "low";
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
    ingredients: parsed.ingredients.map((ingredient) => ({
      ...ingredient,
      category: ingredient.category || inferIngredientCategory(ingredient.name),
      packageUnit: ingredient.packageUnit || "g",
      gramPerUnit: ingredient.gramPerUnit ?? 1,
    })),
    recipeItems: parsed.recipeItems.map(normalizeRecipeItem),
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
    usageType: item.usageType || "gram",
    baseAmountGram: item.baseAmountGram || item.amountGram || 0,
    usedCount: item.usedCount || 1,
    totalCount: item.totalCount || 1,
    fractionDenominator: item.fractionDenominator || 1,
  };
}

function inferIngredientCategory(name: string) {
  if (/粉/.test(name)) return "粉類";
  if (/砂糖|糖/.test(name)) return "糖類";
  if (/卵/.test(name)) return "卵";
  if (/バター|クリーム|乳/.test(name)) return "乳製品";
  if (/苺|いちご|フルーツ|果/.test(name)) return "果物";
  return "未分類";
}

function ingredientOptionLabel(ingredient: Ingredient) {
  return ingredient.packageName && ingredient.packageName !== ingredient.name
    ? `${ingredient.packageName}（${ingredient.name}）`
    : ingredient.name;
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

function findNutritionCandidate(target: Ingredient, ingredients: Ingredient[]) {
  return ingredients.find((ingredient) =>
    ingredient.id !== target.id
    && hasNutrition(ingredient)
    && (
      ingredient.name.includes(target.name)
      || target.name.includes(ingredient.name)
      || Boolean(target.category && target.category !== "未分類" && ingredient.category === target.category)
    ),
  );
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

function topPageDescription(pageKey: PageKey) {
  const descriptions: Record<PageKey, string> = {
    top: "各機能への入口",
    ingredient: "原材料、製品名、価格、栄養成分を登録",
    product: "商品名、売価、出来上がり個数を登録",
    recipe: "製品名から材料を選び、使用量を入力",
    cost: "材料原価と包材込み原価を確認",
    nutrition: "レシピから栄養成分表示を計算",
    impact: "価格変更時の影響商品を確認",
    ocr: "OCR読み取り結果から価格更新候補を作成",
    label: "確認用ラベルテキストを作成",
    master: "登録済み原材料を一覧確認",
  };
  return descriptions[pageKey];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s/g, "");
}

function extractPriceNumbers(line: string) {
  return Array.from(line.matchAll(/\d[\d,]*(?:\.\d+)?/g))
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 10);
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
  const allPrices = extractPriceNumbers(text);
  const price = allPrices.length > 0 ? allPrices[allPrices.length - 1] : base.price;
  const name = findOcrValue(text, [/^原材料名\s*[:：]?/, /^材料名\s*[:：]?/, /^品名\s*[:：]?/]) || lines[0] || base.name;
  const packageName = findOcrValue(text, [/^製品名\s*[:：]?/, /^商品名\s*[:：]?/]) || base.packageName || name;
  const supplier = findOcrValue(text, [/^仕入先\s*[:：]?/, /^メーカー\s*[:：]?/, /^供給元\s*[:：]?/]) || base.supplier;
  const amountText = findOcrValue(text, [/^内容量\s*[:：]?/, /^容量\s*[:：]?/, /^入数\s*[:：]?/]);
  const amountMatch = amountText.match(/\d[\d,]*(?:\.\d+)?/);
  const unitMatch = amountText.match(/[a-zA-Zぁ-んァ-ヶ一-龠枚個本袋箱mLmlLkgｇg]+$/);
  return {
    ...base,
    name,
    packageName,
    supplier,
    packageAmountGram: amountMatch ? Number(amountMatch[0].replace(/,/g, "")) : base.packageAmountGram,
    packageUnit: unitMatch?.[0] || base.packageUnit,
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

async function preprocessImageForOcr(file: File): Promise<string> {
  const dataUrl = await fileToImageDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxSize = 1800;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return dataUrl;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrasted = gray > 175 ? 255 : gray < 95 ? 0 : gray * 1.35 - 45;
    const value = Math.max(0, Math.min(255, contrasted));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function ingredientFromVisionResult(result: IngredientVisionOcrResult, base: Ingredient): Ingredient {
  const generatedText = [
    result.name ? `原材料名: ${result.name}` : "",
    result.packageName ? `製品名: ${result.packageName}` : "",
    result.supplier ? `仕入先: ${result.supplier}` : "",
    result.packageAmount ? `内容量: ${result.packageAmount}${result.packageUnit}` : "",
    result.price ? `仕入価格: ${result.price}円` : "",
  ].filter(Boolean).join("\n");
  return {
    ...parseIngredientOcrText(generatedText, base),
    memo: [base.memo, result.memo, `AI OCR信頼度: ${result.confidence}`].filter(Boolean).join("\n"),
  };
}

const emptyIngredient = (): Ingredient => ({
  id: "",
  name: "",
  category: "未分類",
  supplier: "",
  packageName: "",
  packageAmountGram: 1000,
  packageUnit: "g",
  gramPerUnit: 1,
  price: 0,
  taxType: "税込",
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
  sellingPrice: 0,
  taxType: "税込",
  targetCostRate: 32,
  displayUnit: "1個あたり",
  yieldCount: 1,
  beforeBakeWeightGram: 0,
  afterBakeWeightGram: null,
  weightPerPieceGram: 0,
  memo: "",
  createdAt: now(),
  updatedAt: now(),
});

export function CostNutritionApp() {
  const [activePage, setActivePage] = useState<PageKey>("top");
  const [stores, setStores] = useState<StoreAccount[]>([{ id: defaultStoreId, pin: "0000", createdAt: now(), updatedAt: now() }]);
  const [currentStoreId, setCurrentStoreId] = useState(defaultStoreId);
  const [data, setData] = useState<AppData>(sampleData);
  const [selectedProductId, setSelectedProductId] = useState(sampleData.products[0]?.id ?? "");
  const [ingredientForm, setIngredientForm] = useState<Ingredient>(() => emptyIngredient());
  const [productForm, setProductForm] = useState<Product>(() => emptyProduct());
  const [recipeProductName, setRecipeProductName] = useState("");
  const [recipeIngredientId, setRecipeIngredientId] = useState(data.ingredients[0]?.id ?? "");
  const [recipeAmountGram, setRecipeAmountGram] = useState(0);
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
  const [ingredientOcrText, setIngredientOcrText] = useState("原材料名: 全卵\n製品名: 赤玉 Lサイズ 10個\n仕入先: 山手鶏卵\n内容量: 10個\n仕入価格: 420円");
  const [ingredientOcrImageName, setIngredientOcrImageName] = useState("");
  const [ingredientOcrImage, setIngredientOcrImage] = useState<File | null>(null);
  const [ingredientOcrStatus, setIngredientOcrStatus] = useState("");
  const [isIngredientOcrReading, setIsIngredientOcrReading] = useState(false);
  const [ingredientOcrCandidate, setIngredientOcrCandidate] = useState<Ingredient | null>(null);

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
      setRecipeIngredientId(loadedData.ingredients[0]?.id ?? "");
      setImpactIngredientId(loadedData.ingredients[4]?.id ?? loadedData.ingredients[0]?.id ?? "");
      setImpactNewPrice(loadedData.ingredients[4]?.price + 100 || 0);
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
    setRecipeIngredientId(nextData.ingredients[0]?.id ?? "");
    setImpactIngredientId(nextData.ingredients[4]?.id ?? nextData.ingredients[0]?.id ?? "");
    setImpactNewPrice(nextData.ingredients[4]?.price + 100 || 0);
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

  function analyzeIngredientOcr() {
    const candidate = parseIngredientOcrText(ingredientOcrText, ingredientForm);
    setIngredientOcrCandidate(candidate);
  }

  async function readIngredientImageWithOcr() {
    if (!ingredientOcrImage) {
      alert("撮影画像を選択してください。");
      return;
    }
    setIsIngredientOcrReading(true);
    setIngredientOcrStatus("画像を圧縮中...");
    try {
      const preprocessedImage = await preprocessImageForOcr(ingredientOcrImage);
      setIngredientOcrStatus("OpenAI Visionで読み取り中... 撮影1回につき1リクエストです。");
      const response = await fetch("/api/ingredient-vision-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: preprocessedImage }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "OpenAI Vision OCRに失敗しました。");
      }

      const result = json.result as IngredientVisionOcrResult;
      const text = [
        result.name ? `原材料名: ${result.name}` : "",
        result.packageName ? `製品名: ${result.packageName}` : "",
        result.supplier ? `仕入先: ${result.supplier}` : "",
        result.packageAmount ? `内容量: ${result.packageAmount}${result.packageUnit}` : "",
        result.price ? `仕入価格: ${result.price}円` : "",
        result.memo ? `メモ: ${result.memo}` : "",
      ].filter(Boolean).join("\n");

      if (!result.name && !result.packageName && !result.price) {
        setIngredientOcrText(text);
        setIngredientOcrCandidate(null);
        setIngredientOcrStatus("登録に必要な情報を抽出できませんでした。画像を撮り直すか、読み取り結果を手直ししてください。");
        return;
      }
      setIngredientOcrText(text);
      setIngredientOcrCandidate(ingredientFromVisionResult(result, ingredientForm));
      setIngredientOcrStatus("読み取り完了。確認画面で内容を確認してください。");
    } catch (error) {
      setIngredientOcrStatus(error instanceof Error ? error.message : "OCR読み取りに失敗しました。");
    } finally {
      setIsIngredientOcrReading(false);
    }
  }

  function applyIngredientOcrCandidate() {
    if (!ingredientOcrCandidate) return;
    setIngredientForm(ingredientOcrCandidate);
    setIngredientOcrCandidate(null);
  }

  const selectedProduct = data.products.find((product) => product.id === selectedProductId) ?? data.products[0];
  const selectedRecipeIngredient = data.ingredients.find((ingredient) => ingredient.id === recipeIngredientId);
  const costSummary = selectedProduct
    ? calculateProductCost(selectedProduct, data.ingredients, data.recipeItems)
    : null;
  const nutritionSummary = selectedProduct
    ? calculateProductNutrition(selectedProduct, data.ingredients, data.recipeItems)
    : null;
  const impactRows = calculatePriceImpact(data, impactIngredientId, impactNewPrice);
  const ingredientCategories = useMemo(
    () => ["すべて", ...Array.from(new Set(data.ingredients.map((ingredient) => ingredient.category || "未分類")))],
    [data.ingredients],
  );
  const filteredIngredients = activeIngredientCategory === "すべて"
    ? data.ingredients
    : data.ingredients.filter((ingredient) => (ingredient.category || "未分類") === activeIngredientCategory);

  const dashboard = useMemo(() => {
    const productCosts = data.products.map((product) => calculateProductCost(product, data.ingredients, data.recipeItems));
    return {
      productCount: data.products.length,
      highCostCount: productCosts.filter((item) => item.costRate >= 35).length,
      dangerousCostCount: productCosts.filter((item) => item.costRate >= 40).length,
      affectedCount: impactRows.length,
      missingNutritionCount: data.ingredients.filter((ingredient) => !hasNutrition(ingredient)).length,
    };
  }, [data, impactRows.length]);

  function saveIngredient() {
    if (!ingredientForm.name.trim()) return;
    const isEdit = Boolean(ingredientForm.id);
    let ingredient: Ingredient = {
      ...ingredientForm,
      labelName: ingredientForm.labelName || ingredientForm.name,
      packageUnit: ingredientForm.packageUnit || "g",
      gramPerUnit: ingredientForm.gramPerUnit || 0,
      id: ingredientForm.id || createId("ing"),
      createdAt: ingredientForm.createdAt || now(),
      updatedAt: now(),
    };
    const nutritionCandidate = findNutritionCandidate(ingredient, data.ingredients);
    if (isNutritionEmpty(ingredient) && nutritionCandidate) {
      const shouldCopy = confirm(
        `栄養成分が未入力です。\n「${nutritionCandidate.name}」の栄養成分を反映して登録しますか？\n\n反映後も原材料登録画面で修正できます。`,
      );
      if (shouldCopy) {
        ingredient = copyNutrition(ingredient, nutritionCandidate);
      }
    }
    commit({
      ...data,
      ingredients: isEdit
        ? data.ingredients.map((item) => (item.id === ingredient.id ? ingredient : item))
        : [...data.ingredients, ingredient],
    });
    setIngredientForm(emptyIngredient());
    if (!recipeIngredientId) setRecipeIngredientId(ingredient.id);
  }

  function saveProduct() {
    if (!productForm.name.trim()) return;
    const isEdit = Boolean(productForm.id);
    const product: Product = {
      ...productForm,
      id: productForm.id || createId("prd"),
      createdAt: productForm.createdAt || now(),
      updatedAt: now(),
    };
    commit({
      ...data,
      products: isEdit ? data.products.map((item) => (item.id === product.id ? product : item)) : [...data.products, product],
    });
    setProductForm(emptyProduct());
    setSelectedProductId(product.id);
    setRecipeProductName("");
  }

  function updateRecipeProductName(value: string) {
    setRecipeProductName(value);
    setProductForm((current) => ({ ...current, name: value }));
  }

  function addProductFromRecipeName() {
    const name = recipeProductName.trim();
    if (!name) return;

    const existingProduct = data.products.find((product) => product.name === name);
    if (existingProduct) {
      setSelectedProductId(existingProduct.id);
      setProductForm(existingProduct);
      setRecipeProductName("");
      return;
    }

    const product: Product = {
      ...emptyProduct(),
      name,
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
      createdAt: now(),
      updatedAt: now(),
    };

    commit({ ...data, products: [...data.products, product] });
    setSelectedProductId(product.id);
    setProductForm(product);
    setRecipeProductName("");
  }

  function addRecipeItem() {
    addRecipeItemForIngredient(recipeIngredientId, recipeAmountGram);
  }

  function addRecipeItemForIngredient(ingredientId: string, amountGram: number) {
    if (!selectedProduct || !ingredientId) return;
    const item: RecipeItem = {
      id: createId("rec"),
      productId: selectedProduct.id,
      ingredientId,
      usageType: "gram",
      amountGram,
      baseAmountGram: amountGram,
      usedCount: 1,
      totalCount: 1,
      fractionDenominator: 1,
      createdAt: now(),
      updatedAt: now(),
    };
    commit({ ...data, recipeItems: [...data.recipeItems, item] });
    setRecipeIngredientId(ingredientId);
    setRecipeAmountGram(0);
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
        const nextItem = normalizeRecipeItem({ ...item, ...patch, updatedAt: now() });
        return { ...nextItem, amountGram: recipeItemAmountGram(nextItem) };
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
    const ingredientId = event.dataTransfer.getData("text/plain");
    if (!ingredientId) return;
    addRecipeItemForIngredient(ingredientId, recipeAmountGram || 0);
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
            memo: `OCR反映: ${candidate.line}`,
          };
        }),
      ],
    });
    setImpactIngredientId(validCandidates[0]?.ingredientId ?? impactIngredientId);
    setImpactNewPrice(validCandidates[0]?.newPrice ?? impactNewPrice);
    setActivePage("impact");
  }

  function resetSample() {
    if (!confirm("サンプルデータに戻しますか？")) return;
    commit(sampleData);
    setSelectedProductId(sampleData.products[0]?.id ?? "");
    setImpactIngredientId("ing-cream");
    setImpactNewPrice(860);
  }

  const labelText = selectedProduct && costSummary && nutritionSummary
    ? buildLabelText(selectedProduct, costSummary.materialCostPerPiece, costSummary.costPerPiece, costSummary.costRate, nutritionSummary, data)
    : "";

  const recipeRows = data.recipeItems.filter((item) => item.productId === selectedProduct?.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 text-sm text-neutral-900 md:p-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-teal-700">洋菓子店・飲食店向け MVP</p>
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

      <nav className="sticky top-0 z-10 grid grid-cols-2 gap-2 rounded-md border border-neutral-200 bg-white/95 p-2 shadow-sm backdrop-blur md:grid-cols-4 lg:grid-cols-6">
        {pages.map((page) => (
          <button
            key={page.key}
            className={`min-h-11 rounded-md border px-2 py-2 font-bold ${
              activePage === page.key
                ? "border-teal-700 bg-teal-50 text-teal-800"
                : "border-neutral-200 bg-white text-neutral-700"
            }`}
            onClick={() => setActivePage(page.key)}
          >
            {page.label}
          </button>
        ))}
      </nav>

      <section className="grid grid-cols-4 gap-1 md:gap-2">
        <Metric label="登録商品数" value={`${dashboard.productCount}品`} compact />
        <Metric label="原価率35%以上" value={`${dashboard.highCostCount}品`} tone="warn" compact />
        <Metric label="影響商品数" value={`${dashboard.affectedCount}品`} compact />
        <Metric label="栄養未登録材料" value={`${dashboard.missingNutritionCount}件`} compact />
      </section>

      {activePage === "top" && (
        <Panel title="TOP">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pages.filter((page) => page.key !== "top").map((page) => (
              <button
                key={page.key}
                className="min-h-24 rounded-md border border-neutral-200 bg-white p-4 text-left shadow-sm hover:border-teal-600 hover:bg-teal-50"
                onClick={() => setActivePage(page.key)}
              >
                <span className="block text-lg font-black text-neutral-900">{page.label}</span>
                <span className="mt-2 block text-xs font-bold text-neutral-500">{topPageDescription(page.key)}</span>
              </button>
            ))}
          </div>
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

      {ingredientOcrCandidate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3">
          <section className="w-full max-w-xl rounded-md border border-neutral-200 bg-white p-4 shadow-xl">
            <h2 className="text-lg font-black">OCR読み込み確認</h2>
            <p className="mt-1 text-xs font-bold text-neutral-500">内容が合っているか確認してから原材料登録フォームへ反映します。</p>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-2 text-sm">
              <dt className="font-bold text-neutral-500">原材料名</dt><dd>{ingredientOcrCandidate.name || "-"}</dd>
              <dt className="font-bold text-neutral-500">製品名</dt><dd>{ingredientOcrCandidate.packageName || "-"}</dd>
              <dt className="font-bold text-neutral-500">仕入先</dt><dd>{ingredientOcrCandidate.supplier || "-"}</dd>
              <dt className="font-bold text-neutral-500">内容量</dt><dd>{number(ingredientOcrCandidate.packageAmountGram)}{ingredientOcrCandidate.packageUnit}</dd>
              <dt className="font-bold text-neutral-500">仕入価格</dt><dd>{yen(ingredientOcrCandidate.price)}</dd>
            </dl>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="rounded-md border border-neutral-300 bg-white px-4 py-2 font-bold text-neutral-700" onClick={() => setIngredientOcrCandidate(null)}>
                戻る
              </button>
              <button className="rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={applyIngredientOcrCandidate}>
                合っているので反映
              </button>
            </div>
          </section>
        </div>
      )}

      {activePage === "ingredient" && (
        <Panel title="原材料登録">
          <section className="mb-4 rounded-md border border-teal-200 bg-teal-50 p-3">
            <h3 className="font-black text-teal-900">カメラ / OCRから読み込み</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-[280px_1fr_160px]">
              <label className="grid gap-1 font-bold text-neutral-600">
                <span>撮影画像</span>
                <input
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setIngredientOcrImage(file);
                    setIngredientOcrImageName(file?.name ?? "");
                    setIngredientOcrStatus("");
                  }}
                />
                <span className="text-xs font-bold text-neutral-500">
                  {ingredientOcrImageName ? `選択中: ${ingredientOcrImageName}` : "iPadではここからカメラ撮影できます。"}
                </span>
              </label>
              <label className="grid gap-1 font-bold text-neutral-600">
                <span>OCR読み取り結果</span>
                <textarea
                  className="h-32 rounded-md border border-neutral-300 bg-white p-3 font-mono text-xs text-neutral-900"
                  value={ingredientOcrText}
                  onChange={(event) => setIngredientOcrText(event.target.value)}
                />
              </label>
              <div className="grid gap-2 self-end">
                <button
                  className="rounded-md bg-teal-700 px-4 py-2 font-bold text-white disabled:bg-neutral-300"
                  disabled={isIngredientOcrReading}
                  onClick={readIngredientImageWithOcr}
                >
                  {isIngredientOcrReading ? "AI読み取り中" : "AIで画像読み取り"}
                </button>
                <button className="rounded-md border border-neutral-300 bg-white px-4 py-2 font-bold text-neutral-700" onClick={analyzeIngredientOcr}>
                  読み込み確認
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs font-bold text-teal-900">
              {ingredientOcrStatus || "画像を圧縮し、gpt-4oで1回だけ読み取ります。確認POPUPで内容を確認してからフォームへ反映します。"}
            </p>
          </section>
          <div className="grid gap-3 md:grid-cols-3">
            <TextInput label="原材料名" value={ingredientForm.name} onChange={(value) => setIngredientForm({ ...ingredientForm, name: value })} />
            <TextInput label="カテゴリ" value={ingredientForm.category} onChange={(value) => setIngredientForm({ ...ingredientForm, category: value })} />
            <TextInput label="仕入先" value={ingredientForm.supplier} onChange={(value) => setIngredientForm({ ...ingredientForm, supplier: value })} />
            <TextInput label="製品名" value={ingredientForm.packageName} onChange={(value) => setIngredientForm({ ...ingredientForm, packageName: value })} />
            <NumberInput label="内容量" value={ingredientForm.packageAmountGram} onChange={(value) => setIngredientForm({ ...ingredientForm, packageAmountGram: value })} />
            <TextInput label="単位" value={ingredientForm.packageUnit} onChange={(value) => setIngredientForm({ ...ingredientForm, packageUnit: value })} />
            <NumberInput label="1単位あたりg" value={ingredientForm.gramPerUnit} onChange={(value) => setIngredientForm({ ...ingredientForm, gramPerUnit: value })} />
            <NumberInput label="仕入価格" value={ingredientForm.price} onChange={(value) => setIngredientForm({ ...ingredientForm, price: value })} />
            <SelectInput label="税込/税抜" value={ingredientForm.taxType} options={["税込", "税抜"]} onChange={(value) => setIngredientForm({ ...ingredientForm, taxType: value as Ingredient["taxType"] })} />
            <NumberInput label="エネルギー kcal/100g" value={ingredientForm.caloriesPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, caloriesPer100g: value })} />
            <NumberInput label="たんぱく質 g/100g" value={ingredientForm.proteinPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, proteinPer100g: value })} />
            <NumberInput label="脂質 g/100g" value={ingredientForm.fatPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, fatPer100g: value })} />
            <NumberInput label="炭水化物 g/100g" value={ingredientForm.carbsPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, carbsPer100g: value })} />
            <NumberInput label="食塩相当量 g/100g" value={ingredientForm.saltPer100g ?? 0} onChange={(value) => setIngredientForm({ ...ingredientForm, saltPer100g: value })} />
            <TextInput label="原材料表示名" value={ingredientForm.labelName} onChange={(value) => setIngredientForm({ ...ingredientForm, labelName: value })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {allergenOptions.map((allergen) => (
              <label key={allergen} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
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
          <button className="mt-3 rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={saveIngredient}>
            原材料を保存
          </button>
        </Panel>
      )}

      {activePage === "product" && (
        <Panel title="商品登録">
          <div className="grid gap-3 md:grid-cols-3">
            <TextInput label="商品名" value={productForm.name} onChange={(value) => setProductForm({ ...productForm, name: value })} />
            <NumberInput label="販売価格" value={productForm.sellingPrice} onChange={(value) => setProductForm({ ...productForm, sellingPrice: value })} />
            <SelectInput label="税込/税抜" value={productForm.taxType} options={["税込", "税抜"]} onChange={(value) => setProductForm({ ...productForm, taxType: value as Product["taxType"] })} />
            <NumberInput label="目標原価率%" value={productForm.targetCostRate} onChange={(value) => setProductForm({ ...productForm, targetCostRate: value })} />
            <SelectInput label="表示単位" value={productForm.displayUnit} options={["1個あたり", "100gあたり", "1袋あたり", "1本あたり"]} onChange={(value) => setProductForm({ ...productForm, displayUnit: value as Product["displayUnit"] })} />
            <NumberInput label="出来上がり個数" value={productForm.yieldCount} onChange={(value) => setProductForm({ ...productForm, yieldCount: value })} />
            <NumberInput label="焼成前総重量g" value={productForm.beforeBakeWeightGram} onChange={(value) => setProductForm({ ...productForm, beforeBakeWeightGram: value })} />
            <NumberInput label="焼成後総重量g" value={productForm.afterBakeWeightGram ?? 0} onChange={(value) => setProductForm({ ...productForm, afterBakeWeightGram: value || null })} />
            <NumberInput label="1個あたり重量g" value={productForm.weightPerPieceGram} onChange={(value) => setProductForm({ ...productForm, weightPerPieceGram: value })} />
          </div>
          <button className="mt-3 rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={saveProduct}>
            商品を保存
          </button>
        </Panel>
      )}

      {activePage === "recipe" && (
        <Panel title="レシピ登録">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px]">
            <TextInput
              label="新しい商品名"
              value={recipeProductName}
              onChange={updateRecipeProductName}
              onEnter={addProductFromRecipeName}
            />
            <div className="self-end rounded-md border border-teal-200 bg-teal-50 p-3 text-xs font-bold text-teal-900">
              入力した商品名は商品登録にも反映されます。
            </div>
            <button className="self-end rounded-md bg-teal-700 px-4 py-2 font-bold text-white" onClick={addProductFromRecipeName}>
              商品追加
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <SelectInput label="商品" value={selectedProduct?.id ?? ""} options={data.products.map((product) => product.id)} optionLabels={Object.fromEntries(data.products.map((product) => [product.id, product.name]))} onChange={setSelectedProductId} />
            <SelectInput
              label="原材料（製品名）"
              value={recipeIngredientId}
              options={data.ingredients.map((ingredient) => ingredient.id)}
              optionLabels={Object.fromEntries(data.ingredients.map((ingredient) => [ingredient.id, ingredientOptionLabel(ingredient)]))}
              onChange={setRecipeIngredientId}
            />
            <NumberInput label={`使用量${selectedRecipeIngredient ? `（${ingredientUnitLabel(selectedRecipeIngredient)}）` : ""}`} value={recipeAmountGram} onChange={setRecipeAmountGram} />
            <button className="self-end rounded-md bg-neutral-900 px-4 py-2 font-bold text-white" onClick={addRecipeItem}>
              選択中の材料を追加
            </button>
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
                {filteredIngredients.map((ingredient) => (
                  <button
                    key={ingredient.id}
                    draggable
                    className={`min-h-20 rounded-md border bg-white p-2 text-left ${
                      recipeIngredientId === ingredient.id ? "border-teal-700 ring-2 ring-teal-100" : "border-neutral-200"
                    }`}
                    onClick={() => setRecipeIngredientId(ingredient.id)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", ingredient.id);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                  >
                    <span className="block font-black">{ingredient.packageName || ingredient.name}</span>
                    {ingredient.packageName && ingredient.packageName !== ingredient.name && (
                      <span className="block text-[11px] font-bold text-neutral-500">{ingredient.name}</span>
                    )}
                    <span className="mt-1 inline-block rounded bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600">
                      {ingredient.category || "未分類"}
                    </span>
                    <span className="mt-1 block text-xs text-neutral-500">{yen(pricePerGram(ingredient))} / {ingredientUnitLabel(ingredient)}</span>
                  </button>
                ))}
              </div>
            </aside>

            <div
              className="rounded-md border-2 border-dashed border-teal-200 bg-white p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={dropRecipeIngredient}
            >
              <div className="mb-3 rounded-md bg-teal-50 p-3 text-sm font-bold text-teal-900">
                左の原材料カードをここへドラッグすると、レシピ行に追加されます。追加後、使用量は表の中で直接入力できます。
              </div>
              <RecipeTable
                rows={recipeRows}
                ingredients={data.ingredients}
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
            </div>
          )}
          <RecipeTable rows={recipeRows} ingredients={data.ingredients} onDelete={deleteRecipeItem} />
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
                  <strong>{row.product.name}</strong>
                  <span>{yen(row.oldCost)} → {yen(row.newCost)}</span>
                </div>
                <p className="text-neutral-600">上昇額 {yen(row.increase)} / 原価率 {percent(row.oldCostRate)} → {percent(row.newCostRate)} / +{number(row.costRateIncreasePoint)}pt</p>
                <p className="font-bold text-teal-800">推奨販売価格 {yen(row.recommendedPrice)}</p>
              </div>
            ))}
          </div>
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

      {activePage === "master" && (
        <Panel title="原材料マスター">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {data.ingredients.map((ingredient) => (
              <button key={ingredient.id} className="rounded-md border border-neutral-200 bg-white p-3 text-left" onClick={() => {
                setIngredientForm(ingredient);
                setActivePage("ingredient");
              }}>
              <strong>{ingredient.packageName || ingredient.name}</strong>
                {ingredient.packageName && ingredient.packageName !== ingredient.name && <p className="text-xs font-bold text-neutral-500">{ingredient.name}</p>}
                <p className="text-neutral-600">{ingredient.category || "未分類"} / {number(ingredient.packageAmountGram)}{ingredientUnitLabel(ingredient)} / {yen(ingredient.price)} / {yen(pricePerGram(ingredient))} per {ingredientUnitLabel(ingredient)}</p>
                <p className="text-xs text-neutral-500">栄養: {hasNutrition(ingredient) ? "登録済み" : "未登録"} / アレルゲン: {ingredient.allergens.join("、") || "なし"}</p>
              </button>
            ))}
          </div>
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
  const allergens = collectAllergens(product.id, data.ingredients, data.recipeItems);
  const labelNames = collectLabelNames(product.id, data.ingredients, data.recipeItems);
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
    <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-black">{title}</h2>
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
  const toneClass = tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-neutral-200 bg-white";
  return (
    <div className={`rounded-md border ${compact ? "px-2 py-2 md:px-3" : "p-4"} ${toneClass}`}>
      <p className={`${compact ? "text-[10px] leading-tight md:text-xs" : "text-xs"} font-bold text-neutral-500`}>{label}</p>
      <strong className={`${compact ? "text-sm leading-tight md:text-base" : "text-xl"}`}>{value}</strong>
    </div>
  );
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
        className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.();
        }}
      />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 font-bold text-neutral-600">
      <span>{label}</span>
      <input className="rounded-md border border-neutral-300 px-3 py-2 text-right text-neutral-900" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function PinInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 font-bold text-neutral-600">
      <span>{label}</span>
      <input
        className="rounded-md border border-neutral-300 px-3 py-2 text-center tracking-[0.2em] text-neutral-900"
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
      <select className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900" value={value} onChange={(event) => onChange(event.target.value)}>
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
  onDelete,
  onAmountChange,
  onItemChange,
}: {
  rows: RecipeItem[];
  ingredients: Ingredient[];
  onDelete: (recipeItemId: string) => void;
  onAmountChange?: (recipeItemId: string, amountGram: number) => void;
  onItemChange?: (recipeItemId: string, patch: Partial<RecipeItem>) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[860px] border-collapse bg-white text-left">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-3">製品名 / 原材料名</th>
            <th className="p-3">入力方法</th>
            <th className="p-3 text-right">使用量</th>
            <th className="p-3 text-right">栄養換算g</th>
            <th className="p-3 text-right">単価</th>
            <th className="p-3 text-right">原価</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
            const normalizedItem = normalizeRecipeItem(item);
            const amount = recipeItemAmountGram(normalizedItem);
            const unit = ingredient ? ingredientUnitLabel(ingredient) : "";
            const nutritionGram = ingredient ? amountToGram(ingredient, amount) : 0;
            return (
              <tr key={item.id} className="border-t border-neutral-200">
                <td className="p-3">
                  <strong>{ingredient?.packageName || ingredient?.name}</strong>
                  {ingredient?.packageName && ingredient.packageName !== ingredient.name && (
                    <span className="ml-2 text-[11px] font-bold text-neutral-500">{ingredient.name}</span>
                  )}
                  <span className="ml-2 rounded bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600">
                    {ingredient?.category || "未分類"}
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
                    <RecipeAmountEditor item={normalizedItem} onAmountChange={onAmountChange} onItemChange={onItemChange} />
                  ) : (
                    usageDescription(normalizedItem)
                  )}
                </td>
                <td className="p-3 text-right">{number(nutritionGram)}g</td>
                <td className="p-3 text-right">{ingredient ? `${yen(pricePerGram(ingredient))} / ${unit}` : "-"}</td>
                <td className="p-3 text-right">{ingredient ? yen(pricePerGram(ingredient) * amount) : "-"}</td>
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
  onAmountChange,
  onItemChange,
}: {
  item: RecipeItem;
  onAmountChange: (recipeItemId: string, amountGram: number) => void;
  onItemChange?: (recipeItemId: string, patch: Partial<RecipeItem>) => void;
}) {
  if (item.usageType === "count") {
    return (
      <div className="flex justify-end gap-1">
        <SmallNumberInput label="元量" value={item.baseAmountGram} onChange={(value) => onItemChange?.(item.id, { baseAmountGram: value })} />
        <SmallNumberInput label="全" value={item.totalCount} onChange={(value) => onItemChange?.(item.id, { totalCount: value })} />
        <SmallNumberInput label="使" value={item.usedCount} onChange={(value) => onItemChange?.(item.id, { usedCount: value })} />
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
