import type { AppData, Ingredient, PriceHistorySourceType, Product, RecipeItem } from "./types";

const now = "2026-05-16T00:00:00.000Z";

function ingredient(partial: Omit<Ingredient, "createdAt" | "updatedAt" | "gramPerUnit" | "otherAllergen" | "memo"> & Partial<Pick<Ingredient, "gramPerUnit" | "otherAllergen" | "memo">>): Ingredient {
  return {
    gramPerUnit: 1,
    otherAllergen: "",
    memo: "",
    ...partial,
    createdAt: now,
    updatedAt: now,
  };
}

function product(partial: Omit<Product, "createdAt" | "updatedAt" | "memo" | "status"> & Partial<Pick<Product, "memo" | "status">>): Product {
  return {
    memo: "",
    status: "販売中",
    ...partial,
    createdAt: now,
    updatedAt: now,
  };
}

function recipe(partial: Omit<RecipeItem, "createdAt" | "updatedAt" | "usageType" | "baseAmountGram" | "usedCount" | "totalCount" | "fractionDenominator" | "lossRate" | "memo"> & Partial<Pick<RecipeItem, "usageType" | "baseAmountGram" | "usedCount" | "totalCount" | "fractionDenominator" | "lossRate" | "memo">>): RecipeItem {
  const amount = partial.amountGram;
  return {
    usageType: "gram",
    baseAmountGram: amount,
    usedCount: 1,
    totalCount: 1,
    fractionDenominator: 1,
    lossRate: 0,
    memo: "",
    ...partial,
    createdAt: now,
    updatedAt: now,
  };
}

function priceHistory(id: string, ingredientId: string, oldPrice: number, newPrice: number, supplier: string, sourceType: PriceHistorySourceType = "manual") {
  return {
    id,
    ingredientId,
    oldPrice,
    newPrice,
    changedAt: now,
    supplier,
    reason: "サンプル価格改定",
    sourceType,
    memo: "Phase 1動作確認用",
  };
}

export const sampleData: AppData = {
  ingredients: [
    ingredient({ id: "ing-flour", name: "薄力粉", type: "PURCHASED_INGREDIENT", category: "粉類", supplier: "東京製粉", packageName: "薄力粉 25kg", packageAmountGram: 25000, packageUnit: "g", price: 4200, taxType: "税抜", caloriesPer100g: 349, proteinPer100g: 8.3, fatPer100g: 1.5, carbsPer100g: 75.8, saltPer100g: 0, allergens: ["小麦"], labelName: "小麦粉" }),
    ingredient({ id: "ing-sugar", name: "グラニュー糖", type: "PURCHASED_INGREDIENT", category: "糖類", supplier: "東京製糖", packageName: "グラニュー糖 30kg", packageAmountGram: 30000, packageUnit: "g", price: 6200, taxType: "税抜", caloriesPer100g: 391, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 100, saltPer100g: 0, allergens: [], labelName: "砂糖" }),
    ingredient({ id: "ing-egg", name: "全卵", type: "PURCHASED_INGREDIENT", category: "卵", supplier: "山手鶏卵", packageName: "全卵 1kg", packageAmountGram: 1000, packageUnit: "g", price: 480, taxType: "税抜", caloriesPer100g: 142, proteinPer100g: 12.2, fatPer100g: 10.2, carbsPer100g: 0.4, saltPer100g: 0.36, allergens: ["卵"], labelName: "卵" }),
    ingredient({ id: "ing-butter", name: "無塩バター", type: "PURCHASED_INGREDIENT", category: "乳製品", supplier: "北海乳業", packageName: "無塩バター 450g", packageAmountGram: 450, packageUnit: "g", price: 780, taxType: "税抜", caloriesPer100g: 720, proteinPer100g: 0.5, fatPer100g: 83, carbsPer100g: 0.2, saltPer100g: 0.02, allergens: ["乳"], labelName: "バター" }),
    ingredient({ id: "ing-cream", name: "生クリーム35%", type: "PURCHASED_INGREDIENT", category: "乳製品", supplier: "山手デイリー", packageName: "生クリーム35% 1L", packageAmountGram: 1000, packageUnit: "g", price: 920, taxType: "税抜", caloriesPer100g: 342, proteinPer100g: 2.1, fatPer100g: 35, carbsPer100g: 3.1, saltPer100g: 0.08, allergens: ["乳"], labelName: "クリーム" }),
    ingredient({ id: "ing-strawberry", name: "苺", type: "PURCHASED_INGREDIENT", category: "果物", supplier: "青果市場", packageName: "苺 1パック", packageAmountGram: 300, packageUnit: "g", price: 780, taxType: "税込", caloriesPer100g: 31, proteinPer100g: 0.9, fatPer100g: 0.1, carbsPer100g: 8.5, saltPer100g: 0, allergens: [], labelName: "苺" }),
    ingredient({ id: "ing-milk", name: "牛乳", type: "PURCHASED_INGREDIENT", category: "乳製品", supplier: "山手デイリー", packageName: "牛乳 1L", packageAmountGram: 1000, packageUnit: "g", price: 250, taxType: "税抜", caloriesPer100g: 61, proteinPer100g: 3.3, fatPer100g: 3.8, carbsPer100g: 4.8, saltPer100g: 0.1, allergens: ["乳"], labelName: "牛乳" }),
    ingredient({ id: "ing-chocolate", name: "チョコレート", type: "PURCHASED_INGREDIENT", category: "チョコレート", supplier: "カカオ商会", packageName: "チョコレート 1kg", packageAmountGram: 1000, packageUnit: "g", price: 2200, taxType: "税抜", caloriesPer100g: 550, proteinPer100g: 7, fatPer100g: 35, carbsPer100g: 52, saltPer100g: 0.02, allergens: ["乳"], otherAllergen: "大豆", labelName: "チョコレート" }),
    ingredient({ id: "pkg-tray", name: "ケーキトレー", type: "PACKAGING", category: "包材", supplier: "包材センター", packageName: "ケーキトレー 100枚", packageAmountGram: 100, packageUnit: "枚", price: 900, taxType: "税抜", caloriesPer100g: 0, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0, allergens: [], labelName: "ケーキトレー" }),
    ingredient({ id: "pkg-box", name: "ケーキ箱", type: "PACKAGING", category: "包材", supplier: "包材センター", packageName: "ケーキ箱 50枚", packageAmountGram: 50, packageUnit: "枚", price: 2500, taxType: "税抜", caloriesPer100g: 0, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0, allergens: [], labelName: "ケーキ箱" }),
    ingredient({ id: "pkg-bag", name: "個包装袋", type: "PACKAGING", category: "包材", supplier: "包材センター", packageName: "個包装袋 100枚", packageAmountGram: 100, packageUnit: "枚", price: 600, taxType: "税抜", caloriesPer100g: 0, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0, allergens: [], labelName: "個包装袋" }),
    ingredient({ id: "pkg-oxygen", name: "脱酸素剤", type: "PACKAGING", category: "包材", supplier: "包材センター", packageName: "脱酸素剤 100個", packageAmountGram: 100, packageUnit: "個", price: 800, taxType: "税抜", caloriesPer100g: 0, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0, allergens: [], labelName: "脱酸素剤" }),
    ingredient({ id: "pkg-handbag", name: "手提げ袋", type: "PACKAGING", category: "包材", supplier: "包材センター", packageName: "手提げ袋 50枚", packageAmountGram: 50, packageUnit: "枚", price: 1500, taxType: "税抜", caloriesPer100g: 0, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0, allergens: [], labelName: "手提げ袋" }),
    ingredient({ id: "pkg-seal", name: "シール", type: "PACKAGING", category: "包材", supplier: "包材センター", packageName: "シール 500枚", packageAmountGram: 500, packageUnit: "枚", price: 1000, taxType: "税抜", caloriesPer100g: 0, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0, allergens: [], labelName: "シール" }),
    ingredient({ id: "pkg-ribbon", name: "リボン", type: "PACKAGING", category: "包材", supplier: "包材センター", packageName: "リボン 100本", packageAmountGram: 100, packageUnit: "本", price: 1200, taxType: "税抜", caloriesPer100g: 0, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0, allergens: [], labelName: "リボン" }),
  ],
  products: [
    product({ id: "int-genoise", name: "ジェノワーズ", isIntermediateMaterial: true, category: "仕込み材料", sellingPrice: 0, taxType: "税込", targetCostRate: 35, displayUnit: "100gあたり", yieldCount: 1, beforeBakeWeightGram: 1020, afterBakeWeightGram: 900, weightPerPieceGram: 900, memo: "ショートやロールに使う共通生地" }),
    product({ id: "int-syrup", name: "シロップ", isIntermediateMaterial: true, category: "仕込み材料", sellingPrice: 0, taxType: "税込", targetCostRate: 35, displayUnit: "100gあたり", yieldCount: 1, beforeBakeWeightGram: 1000, afterBakeWeightGram: 1000, weightPerPieceGram: 1000 }),
    product({ id: "int-chantilly", name: "クレームシャンティ", isIntermediateMaterial: true, category: "仕込み材料", sellingPrice: 0, taxType: "税込", targetCostRate: 35, displayUnit: "100gあたり", yieldCount: 1, beforeBakeWeightGram: 1100, afterBakeWeightGram: 1050, weightPerPieceGram: 1050 }),
    product({ id: "int-custard", name: "カスタードクリーム", isIntermediateMaterial: true, category: "仕込み材料", sellingPrice: 0, taxType: "税込", targetCostRate: 35, displayUnit: "100gあたり", yieldCount: 1, beforeBakeWeightGram: 1160, afterBakeWeightGram: 980, weightPerPieceGram: 980 }),
    product({ id: "prd-shortcake", name: "苺のショートケーキ", isIntermediateMaterial: false, category: "プティガトー", sellingPrice: 520, taxType: "税込", targetCostRate: 35, displayUnit: "1個あたり", yieldCount: 8, beforeBakeWeightGram: 1160, afterBakeWeightGram: 960, weightPerPieceGram: 120, memo: "8個取り" }),
    product({ id: "prd-roll", name: "蜂蜜玉子ロール", isIntermediateMaterial: false, category: "ロール", sellingPrice: 1200, taxType: "税込", targetCostRate: 35, displayUnit: "1本あたり", yieldCount: 1, beforeBakeWeightGram: 620, afterBakeWeightGram: 560, weightPerPieceGram: 560 }),
    product({ id: "prd-madeleine", name: "マドレーヌ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 220, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 20, beforeBakeWeightGram: 1280, afterBakeWeightGram: 1100, weightPerPieceGram: 55 }),
    product({ id: "prd-castella", name: "奈良カステラ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 980, taxType: "税込", targetCostRate: 35, displayUnit: "1本あたり", yieldCount: 2, beforeBakeWeightGram: 1320, afterBakeWeightGram: 1120, weightPerPieceGram: 560 }),
    product({ id: "prd-french-toast", name: "フレンチトースト", isIntermediateMaterial: false, category: "カフェ", sellingPrice: 680, taxType: "税込", targetCostRate: 35, displayUnit: "1個あたり", yieldCount: 6, beforeBakeWeightGram: 900, afterBakeWeightGram: 820, weightPerPieceGram: 135 }),
    product({ id: "prd-gift", name: "焼き菓子ギフト", isIntermediateMaterial: false, category: "ギフト", sellingPrice: 2000, taxType: "税込", targetCostRate: 35, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 420, afterBakeWeightGram: 420, weightPerPieceGram: 420 }),
  ],
  productCategories: ["プティガトー", "焼菓子", "ロール", "カフェ", "ギフト", "仕込み材料"],
  recipeItems: [
    recipe({ id: "rec-genoise-flour", productId: "int-genoise", ingredientId: "ing-flour", itemType: "ingredient", intermediateProductId: "", amountGram: 240 }),
    recipe({ id: "rec-genoise-sugar", productId: "int-genoise", ingredientId: "ing-sugar", itemType: "ingredient", intermediateProductId: "", amountGram: 240 }),
    recipe({ id: "rec-genoise-egg", productId: "int-genoise", ingredientId: "ing-egg", itemType: "ingredient", intermediateProductId: "", amountGram: 480, lossRate: 2 }),
    recipe({ id: "rec-genoise-butter", productId: "int-genoise", ingredientId: "ing-butter", itemType: "ingredient", intermediateProductId: "", amountGram: 60 }),
    recipe({ id: "rec-syrup-sugar", productId: "int-syrup", ingredientId: "ing-sugar", itemType: "ingredient", intermediateProductId: "", amountGram: 450 }),
    recipe({ id: "rec-syrup-water", productId: "int-syrup", ingredientId: "ing-milk", itemType: "ingredient", intermediateProductId: "", amountGram: 50, memo: "水の代用サンプル" }),
    recipe({ id: "rec-chantilly-cream", productId: "int-chantilly", ingredientId: "ing-cream", itemType: "ingredient", intermediateProductId: "", amountGram: 1000 }),
    recipe({ id: "rec-chantilly-sugar", productId: "int-chantilly", ingredientId: "ing-sugar", itemType: "ingredient", intermediateProductId: "", amountGram: 100 }),
    recipe({ id: "rec-custard-milk", productId: "int-custard", ingredientId: "ing-milk", itemType: "ingredient", intermediateProductId: "", amountGram: 700 }),
    recipe({ id: "rec-custard-egg", productId: "int-custard", ingredientId: "ing-egg", itemType: "ingredient", intermediateProductId: "", amountGram: 160 }),
    recipe({ id: "rec-custard-sugar", productId: "int-custard", ingredientId: "ing-sugar", itemType: "ingredient", intermediateProductId: "", amountGram: 180 }),
    recipe({ id: "rec-custard-flour", productId: "int-custard", ingredientId: "ing-flour", itemType: "ingredient", intermediateProductId: "", amountGram: 60 }),
    recipe({ id: "rec-short-genoise", productId: "prd-shortcake", ingredientId: "", itemType: "intermediate", intermediateProductId: "int-genoise", amountGram: 450 }),
    recipe({ id: "rec-short-syrup", productId: "prd-shortcake", ingredientId: "", itemType: "intermediate", intermediateProductId: "int-syrup", amountGram: 80 }),
    recipe({ id: "rec-short-cream", productId: "prd-shortcake", ingredientId: "", itemType: "intermediate", intermediateProductId: "int-chantilly", amountGram: 360 }),
    recipe({ id: "rec-short-strawberry", productId: "prd-shortcake", ingredientId: "ing-strawberry", itemType: "ingredient", intermediateProductId: "", amountGram: 240, lossRate: 8 }),
    recipe({ id: "rec-short-tray", productId: "prd-shortcake", ingredientId: "pkg-tray", itemType: "ingredient", intermediateProductId: "", amountGram: 8 }),
    recipe({ id: "rec-short-box", productId: "prd-shortcake", ingredientId: "pkg-box", itemType: "ingredient", intermediateProductId: "", amountGram: 1 }),
    recipe({ id: "rec-roll-genoise", productId: "prd-roll", ingredientId: "", itemType: "intermediate", intermediateProductId: "int-genoise", amountGram: 360 }),
    recipe({ id: "rec-roll-cream", productId: "prd-roll", ingredientId: "", itemType: "intermediate", intermediateProductId: "int-chantilly", amountGram: 220 }),
    recipe({ id: "rec-roll-box", productId: "prd-roll", ingredientId: "pkg-box", itemType: "ingredient", intermediateProductId: "", amountGram: 1 }),
    recipe({ id: "rec-madeleine-flour", productId: "prd-madeleine", ingredientId: "ing-flour", itemType: "ingredient", intermediateProductId: "", amountGram: 300 }),
    recipe({ id: "rec-madeleine-sugar", productId: "prd-madeleine", ingredientId: "ing-sugar", itemType: "ingredient", intermediateProductId: "", amountGram: 260 }),
    recipe({ id: "rec-madeleine-egg", productId: "prd-madeleine", ingredientId: "ing-egg", itemType: "ingredient", intermediateProductId: "", amountGram: 280 }),
    recipe({ id: "rec-madeleine-butter", productId: "prd-madeleine", ingredientId: "ing-butter", itemType: "ingredient", intermediateProductId: "", amountGram: 300 }),
    recipe({ id: "rec-madeleine-bag", productId: "prd-madeleine", ingredientId: "pkg-bag", itemType: "ingredient", intermediateProductId: "", amountGram: 20 }),
    recipe({ id: "rec-madeleine-oxygen", productId: "prd-madeleine", ingredientId: "pkg-oxygen", itemType: "ingredient", intermediateProductId: "", amountGram: 20 }),
    recipe({ id: "rec-castella-flour", productId: "prd-castella", ingredientId: "ing-flour", itemType: "ingredient", intermediateProductId: "", amountGram: 260 }),
    recipe({ id: "rec-castella-sugar", productId: "prd-castella", ingredientId: "ing-sugar", itemType: "ingredient", intermediateProductId: "", amountGram: 320 }),
    recipe({ id: "rec-castella-egg", productId: "prd-castella", ingredientId: "ing-egg", itemType: "ingredient", intermediateProductId: "", amountGram: 640 }),
    recipe({ id: "rec-castella-bag", productId: "prd-castella", ingredientId: "pkg-bag", itemType: "ingredient", intermediateProductId: "", amountGram: 2 }),
    recipe({ id: "rec-french-custard", productId: "prd-french-toast", ingredientId: "", itemType: "intermediate", intermediateProductId: "int-custard", amountGram: 420 }),
    recipe({ id: "rec-french-butter", productId: "prd-french-toast", ingredientId: "ing-butter", itemType: "ingredient", intermediateProductId: "", amountGram: 90 }),
    recipe({ id: "rec-gift-madeleine-core", productId: "prd-gift", ingredientId: "ing-butter", itemType: "ingredient", intermediateProductId: "", amountGram: 180 }),
    recipe({ id: "rec-gift-choco", productId: "prd-gift", ingredientId: "ing-chocolate", itemType: "ingredient", intermediateProductId: "", amountGram: 120 }),
    recipe({ id: "rec-gift-bag", productId: "prd-gift", ingredientId: "pkg-bag", itemType: "ingredient", intermediateProductId: "", amountGram: 5 }),
    recipe({ id: "rec-gift-oxygen", productId: "prd-gift", ingredientId: "pkg-oxygen", itemType: "ingredient", intermediateProductId: "", amountGram: 5 }),
    recipe({ id: "rec-gift-handbag", productId: "prd-gift", ingredientId: "pkg-handbag", itemType: "ingredient", intermediateProductId: "", amountGram: 1 }),
    recipe({ id: "rec-gift-seal", productId: "prd-gift", ingredientId: "pkg-seal", itemType: "ingredient", intermediateProductId: "", amountGram: 5 }),
    recipe({ id: "rec-gift-ribbon", productId: "prd-gift", ingredientId: "pkg-ribbon", itemType: "ingredient", intermediateProductId: "", amountGram: 1 }),
  ],
  priceHistories: [
    priceHistory("hist-butter", "ing-butter", 780, 850, "北海乳業"),
    priceHistory("hist-cream", "ing-cream", 920, 980, "山手デイリー"),
    priceHistory("hist-flour", "ing-flour", 4200, 4800, "東京製粉"),
    priceHistory("hist-sugar", "ing-sugar", 6200, 6750, "東京製糖"),
  ],
  ingredientAliases: [],
  wasteRecords: [],
  salesRecords: [
    { id: "sales-shortcake", month: "2026-05", productId: "prd-shortcake", quantity: 420, sellingPrice: 520, memo: "サンプル販売数", createdAt: now, updatedAt: now },
    { id: "sales-roll", month: "2026-05", productId: "prd-roll", quantity: 80, sellingPrice: 1200, memo: "サンプル販売数", createdAt: now, updatedAt: now },
    { id: "sales-madeleine", month: "2026-05", productId: "prd-madeleine", quantity: 650, sellingPrice: 220, memo: "サンプル販売数", createdAt: now, updatedAt: now },
    { id: "sales-castella", month: "2026-05", productId: "prd-castella", quantity: 110, sellingPrice: 980, memo: "サンプル販売数", createdAt: now, updatedAt: now },
    { id: "sales-gift", month: "2026-05", productId: "prd-gift", quantity: 55, sellingPrice: 2000, memo: "サンプル販売数", createdAt: now, updatedAt: now },
  ],
  actualCostRecords: [
    { id: "actual-cream", month: "2026-05", supplier: "山手デイリー", amount: 98000, memo: "サンプル実仕入", createdAt: now, updatedAt: now },
    { id: "actual-flour", month: "2026-05", supplier: "東京製粉", amount: 58000, memo: "サンプル実仕入", createdAt: now, updatedAt: now },
    { id: "actual-packaging", month: "2026-05", supplier: "包材センター", amount: 42000, memo: "サンプル実仕入", createdAt: now, updatedAt: now },
  ],
  eventPlans: [
    { id: "event-christmas-2026", name: "クリスマス2026", date: "2026-12-24", memo: "予約販売の原価シミュレーション", createdAt: now, updatedAt: now },
  ],
  eventPlanItems: [
    { id: "event-item-shortcake", eventPlanId: "event-christmas-2026", productId: "prd-shortcake", plannedQuantity: 300, sellingPrice: 680, memo: "クリスマス苺ショート相当", createdAt: now, updatedAt: now },
    { id: "event-item-roll", eventPlanId: "event-christmas-2026", productId: "prd-roll", plannedQuantity: 120, sellingPrice: 1380, memo: "予約ロール", createdAt: now, updatedAt: now },
    { id: "event-item-gift", eventPlanId: "event-christmas-2026", productId: "prd-gift", plannedQuantity: 180, sellingPrice: 2200, memo: "焼き菓子ギフト", createdAt: now, updatedAt: now },
  ],
  laborCosts: [
    { id: "labor-shortcake-slice", productId: "prd-shortcake", processName: "組み立て・カット", minutes: 35, workers: 1, hourlyWage: 1200, memo: "8個取り", createdAt: now, updatedAt: now },
    { id: "labor-shortcake-finish", productId: "prd-shortcake", processName: "仕上げ", minutes: 25, workers: 1, hourlyWage: 1200, memo: "ナッペ、苺飾り", createdAt: now, updatedAt: now },
    { id: "labor-madeleine", productId: "prd-madeleine", processName: "仕込み・袋詰め", minutes: 50, workers: 1, hourlyWage: 1100, memo: "20個分", createdAt: now, updatedAt: now },
    { id: "labor-gift", productId: "prd-gift", processName: "箱詰め・包装", minutes: 12, workers: 1, hourlyWage: 1100, memo: "1セット", createdAt: now, updatedAt: now },
  ],
  setProductItems: [
    { id: "set-gift-madeleine", setProductId: "prd-gift", childProductId: "prd-madeleine", quantity: 4, memo: "マドレーヌ4個", createdAt: now, updatedAt: now },
    { id: "set-gift-castella", setProductId: "prd-gift", childProductId: "prd-castella", quantity: 1, memo: "奈良カステラ1本", createdAt: now, updatedAt: now },
  ],
  inventoryRecords: [],
  inventoryInputSettings: [],
  packagingClassifications: [],
  onboardingSupport: {
    onboardingSupportEnabled: true,
    onboardingSupportStartDate: "2026-05-26",
    onboardingSupportEndDate: "2026-06-25",
    officialLineUrl: "https://lin.ee/sq52Q9d",
  },
  billing: {
    ocrUsedMonth: "2026-05",
    ocrUsedThisMonth: 12,
    baseMonthlyPrice: 1400,
    ocrBaseLimit: 30,
    ocrAddonPacks: 0,
    ocrAddonPackSize: 50,
    ocrAddonPrice: 550,
    ocrAddonHistory: [
      {
        id: "billing-sample-2026-05",
        billingMonth: "2026-05",
        agreedAt: "2026-05-26T00:00:00.000Z",
        addonPacksAfterPurchase: 0,
        addedLimit: 0,
        price: 0,
      },
    ],
  },
};
