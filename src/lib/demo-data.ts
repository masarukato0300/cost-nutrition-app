import type { AppData, Ingredient, PriceHistory, Product, RecipeItem, SalesRecord, WasteRecord } from "./types";

const now = "2026-06-01T00:00:00.000Z";

function ingredient(partial: Omit<Ingredient, "createdAt" | "updatedAt" | "otherAllergen" | "memo"> & Partial<Pick<Ingredient, "otherAllergen" | "memo">>): Ingredient {
  return {
    otherAllergen: "",
    memo: "",
    ...partial,
    createdAt: now,
    updatedAt: now,
  };
}

function food(id: string, name: string, category: string, supplier: string, packageName: string, amount: number, unit: string, price: number, nutrition: Partial<Pick<Ingredient, "caloriesPer100g" | "proteinPer100g" | "fatPer100g" | "carbsPer100g" | "saltPer100g" | "allergens" | "labelName" | "otherAllergen">> = {}): Ingredient {
  return ingredient({
    id,
    name,
    type: "PURCHASED_INGREDIENT",
    category,
    supplier,
    packageName,
    packageAmountGram: amount,
    packageUnit: unit,
    gramPerUnit: unit === "個" || unit === "枚" || unit === "本" ? 1 : 1,
    price,
    taxType: "税抜",
    caloriesPer100g: nutrition.caloriesPer100g ?? 0,
    proteinPer100g: nutrition.proteinPer100g ?? 0,
    fatPer100g: nutrition.fatPer100g ?? 0,
    carbsPer100g: nutrition.carbsPer100g ?? 0,
    saltPer100g: nutrition.saltPer100g ?? 0,
    allergens: nutrition.allergens ?? [],
    labelName: nutrition.labelName ?? name,
    otherAllergen: nutrition.otherAllergen ?? "",
  });
}

function packaging(id: string, name: string, packageName: string, count: number, price: number): Ingredient {
  return ingredient({
    id,
    name,
    type: "PACKAGING",
    category: "包材",
    supplier: "パッケージサプライ",
    packageName,
    packageAmountGram: count,
    packageUnit: "枚",
    gramPerUnit: 1,
    price,
    taxType: "税抜",
    caloriesPer100g: null,
    proteinPer100g: null,
    fatPer100g: null,
    carbsPer100g: null,
    saltPer100g: null,
    allergens: [],
    labelName: name,
  });
}

function product(partial: Omit<Product, "createdAt" | "updatedAt" | "status" | "memo"> & Partial<Pick<Product, "status" | "memo">>): Product {
  return {
    status: "販売中",
    memo: "",
    ...partial,
    createdAt: now,
    updatedAt: now,
  };
}

function recipe(id: string, productId: string, ingredientId: string, amountGram: number, memo = ""): RecipeItem {
  return {
    id,
    productId,
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
    memo,
    createdAt: now,
    updatedAt: now,
  };
}

function intermediate(id: string, productId: string, intermediateProductId: string, amountGram: number, memo = ""): RecipeItem {
  return {
    id,
    productId,
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
    memo,
    createdAt: now,
    updatedAt: now,
  };
}

function sale(id: string, month: string, productId: string, quantity: number, sellingPrice: number, memo: string): SalesRecord {
  return { id, month, productId, quantity, sellingPrice, memo, createdAt: now, updatedAt: now };
}

function waste(id: string, date: string, productId: string, quantity: number, costAmount: number, salesEquivalentAmount: number, memo: string): WasteRecord {
  return {
    id,
    date,
    itemType: "PRODUCT",
    itemId: productId,
    quantity,
    costAmount,
    salesEquivalentAmount,
    reason: "売れ残り",
    memo,
    createdAt: now,
    updatedAt: now,
  };
}

function history(id: string, ingredientId: string, oldPrice: number, newPrice: number, supplier: string): PriceHistory {
  return {
    id,
    ingredientId,
    oldPrice,
    newPrice,
    changedAt: "2026-06-01T00:00:00.000Z",
    supplier,
    reason: "デモ価格改定",
    sourceType: "manual",
    memo: "値上げ影響分析を見せるためのデモ履歴",
  };
}

export function createPatisseriePatisDemoData(): AppData {
  const ingredients: Ingredient[] = [
    food("demo-cream45", "生クリーム45%", "乳製品", "関東デイリー", "生クリーム45% 1L", 1000, "g", 1180, { caloriesPer100g: 433, proteinPer100g: 1.9, fatPer100g: 45, carbsPer100g: 3.2, saltPer100g: 0.08, allergens: ["乳"], labelName: "クリーム" }),
    food("demo-cream35", "生クリーム35%", "乳製品", "関東デイリー", "生クリーム35% 1L", 1000, "g", 980, { caloriesPer100g: 342, proteinPer100g: 2.1, fatPer100g: 35, carbsPer100g: 3.1, saltPer100g: 0.08, allergens: ["乳"], labelName: "クリーム" }),
    food("demo-butter", "無塩バター", "乳製品", "北海乳業", "無塩バター 450g", 450, "g", 880, { caloriesPer100g: 720, proteinPer100g: 0.5, fatPer100g: 83, carbsPer100g: 0.2, saltPer100g: 0.02, allergens: ["乳"], labelName: "バター" }),
    food("demo-fermented-butter", "発酵バター", "乳製品", "北海乳業", "発酵バター 450g", 450, "g", 1080, { caloriesPer100g: 745, proteinPer100g: 0.6, fatPer100g: 83, carbsPer100g: 0.4, saltPer100g: 0.03, allergens: ["乳"], labelName: "発酵バター" }),
    food("demo-milk", "牛乳", "乳製品", "関東デイリー", "牛乳 1L", 1000, "g", 280, { caloriesPer100g: 61, proteinPer100g: 3.3, fatPer100g: 3.8, carbsPer100g: 4.8, saltPer100g: 0.1, allergens: ["乳"], labelName: "牛乳" }),
    food("demo-cream-cheese", "クリームチーズ", "乳製品", "関東デイリー", "クリームチーズ 1kg", 1000, "g", 1680, { caloriesPer100g: 313, proteinPer100g: 8.2, fatPer100g: 33, carbsPer100g: 2.3, saltPer100g: 0.7, allergens: ["乳"], labelName: "クリームチーズ" }),
    food("demo-whole-egg", "全卵", "卵", "武蔵野鶏卵", "全卵 10kg", 7200, "g", 6500, { caloriesPer100g: 142, proteinPer100g: 12.2, fatPer100g: 10.2, carbsPer100g: 0.4, saltPer100g: 0.36, allergens: ["卵"], labelName: "卵" }),
    food("demo-yolk", "卵黄", "卵", "武蔵野鶏卵", "卵黄 1kg", 1000, "g", 1280, { caloriesPer100g: 336, proteinPer100g: 16.5, fatPer100g: 33.5, carbsPer100g: 0.1, saltPer100g: 0.13, allergens: ["卵"], labelName: "卵黄" }),
    food("demo-white", "卵白", "卵", "武蔵野鶏卵", "卵白 1kg", 1000, "g", 420, { caloriesPer100g: 44, proteinPer100g: 10.5, fatPer100g: 0, carbsPer100g: 0.4, saltPer100g: 0.46, allergens: ["卵"], labelName: "卵白" }),
    food("demo-cake-flour", "薄力粉", "粉類", "東都製粉", "薄力粉 25kg", 25000, "g", 4800, { caloriesPer100g: 349, proteinPer100g: 8.3, fatPer100g: 1.5, carbsPer100g: 75.8, saltPer100g: 0, allergens: ["小麦"], labelName: "小麦粉" }),
    food("demo-bread-flour", "強力粉", "粉類", "東都製粉", "強力粉 25kg", 25000, "g", 5200, { caloriesPer100g: 337, proteinPer100g: 11.8, fatPer100g: 1.5, carbsPer100g: 71.7, saltPer100g: 0, allergens: ["小麦"], labelName: "小麦粉" }),
    food("demo-almond-powder", "アーモンドプードル", "粉類", "ナッツ商会", "アーモンドプードル 1kg", 1000, "g", 1980, { caloriesPer100g: 608, proteinPer100g: 20.3, fatPer100g: 54, carbsPer100g: 20, saltPer100g: 0, otherAllergen: "アーモンド", labelName: "アーモンド" }),
    food("demo-cocoa", "ココアパウダー", "粉類", "カカオ商会", "ココアパウダー 1kg", 1000, "g", 1680, { caloriesPer100g: 395, proteinPer100g: 18.5, fatPer100g: 21.6, carbsPer100g: 42.4, saltPer100g: 0.01, labelName: "ココア" }),
    food("demo-matcha", "抹茶パウダー", "粉類", "宇治茶舗", "抹茶パウダー 500g", 500, "g", 3600, { caloriesPer100g: 324, proteinPer100g: 29.6, fatPer100g: 5.3, carbsPer100g: 39.5, saltPer100g: 0, labelName: "抹茶" }),
    food("demo-sugar", "グラニュー糖", "糖類", "東都製糖", "グラニュー糖 30kg", 30000, "g", 6750, { caloriesPer100g: 391, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 100, saltPer100g: 0, labelName: "砂糖" }),
    food("demo-powdered-sugar", "粉糖", "糖類", "東都製糖", "粉糖 10kg", 10000, "g", 3600, { caloriesPer100g: 389, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 99.7, saltPer100g: 0, labelName: "砂糖" }),
    food("demo-starch-syrup", "水あめ", "糖類", "東都製糖", "水あめ 1kg", 1000, "g", 420, { caloriesPer100g: 328, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 85, saltPer100g: 0, labelName: "水あめ" }),
    food("demo-honey", "はちみつ", "糖類", "蜂蜜問屋", "はちみつ 1kg", 1000, "g", 1450, { caloriesPer100g: 329, proteinPer100g: 0.3, fatPer100g: 0, carbsPer100g: 81.9, saltPer100g: 0, labelName: "はちみつ" }),
    food("demo-trehalose", "トレハロース", "糖類", "製菓材料問屋", "トレハロース 10kg", 10000, "g", 5200, { caloriesPer100g: 361, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 90, saltPer100g: 0, labelName: "トレハロース" }),
    food("demo-sweet-choco", "スイートチョコ", "チョコレート", "カカオ商会", "スイートチョコ 1kg", 1000, "g", 2600, { caloriesPer100g: 550, proteinPer100g: 6.8, fatPer100g: 36, carbsPer100g: 50, saltPer100g: 0.02, allergens: ["乳"], otherAllergen: "大豆", labelName: "チョコレート" }),
    food("demo-milk-choco", "ミルクチョコ", "チョコレート", "カカオ商会", "ミルクチョコ 1kg", 1000, "g", 2450, { caloriesPer100g: 558, proteinPer100g: 7.5, fatPer100g: 34, carbsPer100g: 55, saltPer100g: 0.18, allergens: ["乳"], otherAllergen: "大豆", labelName: "チョコレート" }),
    food("demo-white-choco", "ホワイトチョコ", "チョコレート", "カカオ商会", "ホワイトチョコ 1kg", 1000, "g", 2400, { caloriesPer100g: 588, proteinPer100g: 7.1, fatPer100g: 39, carbsPer100g: 53, saltPer100g: 0.2, allergens: ["乳"], otherAllergen: "大豆", labelName: "チョコレート" }),
    food("demo-coating-choco", "コーティングチョコ", "チョコレート", "カカオ商会", "コーティングチョコ 1kg", 1000, "g", 1850, { caloriesPer100g: 570, proteinPer100g: 5, fatPer100g: 38, carbsPer100g: 54, saltPer100g: 0.1, allergens: ["乳"], otherAllergen: "大豆", labelName: "チョコレート" }),
    food("demo-strawberry", "苺", "果物・ピューレ", "青果市場", "苺 1パック", 300, "g", 920, { caloriesPer100g: 31, proteinPer100g: 0.9, fatPer100g: 0.1, carbsPer100g: 8.5, saltPer100g: 0, labelName: "苺" }),
    food("demo-raspberry", "冷凍フランボワーズ", "果物・ピューレ", "青果市場", "冷凍フランボワーズ 1kg", 1000, "g", 1980, { caloriesPer100g: 41, proteinPer100g: 1.1, fatPer100g: 0.1, carbsPer100g: 10.2, saltPer100g: 0, labelName: "フランボワーズ" }),
    food("demo-lemon", "レモン果汁", "果物・ピューレ", "青果市場", "レモン果汁 1L", 1000, "g", 720, { caloriesPer100g: 26, proteinPer100g: 0.4, fatPer100g: 0.2, carbsPer100g: 8.6, saltPer100g: 0, labelName: "レモン果汁" }),
    food("demo-orange-puree", "オレンジピューレ", "果物・ピューレ", "ピューレ商会", "オレンジピューレ 1kg", 1000, "g", 1420, { caloriesPer100g: 54, proteinPer100g: 0.7, fatPer100g: 0.1, carbsPer100g: 12, saltPer100g: 0, labelName: "オレンジ" }),
    food("demo-marron", "マロンペースト", "果物・ピューレ", "製菓材料問屋", "マロンペースト 1kg", 1000, "g", 2680, { caloriesPer100g: 245, proteinPer100g: 2.2, fatPer100g: 1.4, carbsPer100g: 56, saltPer100g: 0.02, labelName: "栗" }),
    food("demo-almond-slice", "アーモンドスライス", "ナッツ", "ナッツ商会", "アーモンドスライス 1kg", 1000, "g", 2100, { caloriesPer100g: 608, proteinPer100g: 20, fatPer100g: 54, carbsPer100g: 20, saltPer100g: 0, otherAllergen: "アーモンド", labelName: "アーモンド" }),
    food("demo-walnut", "くるみ", "ナッツ", "ナッツ商会", "くるみ 1kg", 1000, "g", 1850, { caloriesPer100g: 674, proteinPer100g: 14.6, fatPer100g: 68.8, carbsPer100g: 11.7, saltPer100g: 0, allergens: ["くるみ"], labelName: "くるみ" }),
    food("demo-pistachio", "ピスタチオ", "ナッツ", "ナッツ商会", "ピスタチオ 500g", 500, "g", 2980, { caloriesPer100g: 617, proteinPer100g: 17.4, fatPer100g: 56.1, carbsPer100g: 20.9, saltPer100g: 0, labelName: "ピスタチオ" }),
    food("demo-gelatin", "ゼラチン", "その他", "製菓材料問屋", "ゼラチン 500g", 500, "g", 1400, { caloriesPer100g: 344, proteinPer100g: 87.6, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0.7, otherAllergen: "ゼラチン", labelName: "ゼラチン" }),
    food("demo-bp", "ベーキングパウダー", "その他", "製菓材料問屋", "ベーキングパウダー 1kg", 1000, "g", 900, { caloriesPer100g: 127, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 31, saltPer100g: 18, labelName: "膨張剤" }),
    food("demo-vanilla", "バニラ", "その他", "製菓材料問屋", "バニラ 100g", 100, "g", 1800, { caloriesPer100g: 288, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 13, saltPer100g: 0, labelName: "バニラ" }),
    food("demo-salt", "塩", "その他", "製菓材料問屋", "塩 1kg", 1000, "g", 220, { caloriesPer100g: 0, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 99, labelName: "食塩" }),
    food("demo-rum", "洋酒", "その他", "リカー問屋", "ラム酒 700ml", 700, "g", 1650, { caloriesPer100g: 240, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 0, saltPer100g: 0, labelName: "洋酒" }),
    packaging("demo-pkg-cakebox4", "ケーキ箱 4号", "ケーキ箱4号 50枚", 50, 2400),
    packaging("demo-pkg-cakebox5", "ケーキ箱 5号", "ケーキ箱5号 50枚", 50, 2850),
    packaging("demo-pkg-cutbox", "カットケーキ箱", "カットケーキ箱 100枚", 100, 2200),
    packaging("demo-pkg-bag", "焼菓子個包装袋", "焼菓子個包装袋 100枚", 100, 720),
    packaging("demo-pkg-oxygen", "脱酸素剤", "脱酸素剤 100個", 100, 900),
    packaging("demo-pkg-dry", "乾燥剤", "乾燥剤 100個", 100, 650),
    packaging("demo-pkg-gift-s", "ギフト箱 小", "ギフト箱 小 50箱", 50, 5000),
    packaging("demo-pkg-gift-m", "ギフト箱 中", "ギフト箱 中 50箱", 50, 6500),
    packaging("demo-pkg-gift-l", "ギフト箱 大", "ギフト箱 大 30箱", 30, 5400),
    packaging("demo-pkg-handbag", "手提げ袋", "手提げ袋 50枚", 50, 1650),
    packaging("demo-pkg-ice", "保冷剤", "保冷剤 100個", 100, 1200),
    packaging("demo-pkg-label", "ラベルシール", "ラベルシール 500枚", 500, 1300),
  ];

  const products: Product[] = [
    product({ id: "demo-int-genoise", name: "ジェノワーズ", isIntermediateMaterial: true, category: "中間材料", sellingPrice: 0, taxType: "税込", targetCostRate: 35, displayUnit: "100gあたり", yieldCount: 1, beforeBakeWeightGram: 1050, afterBakeWeightGram: 880, weightPerPieceGram: 880 }),
    product({ id: "demo-int-chantilly", name: "クレームシャンティ", isIntermediateMaterial: true, category: "中間材料", sellingPrice: 0, taxType: "税込", targetCostRate: 35, displayUnit: "100gあたり", yieldCount: 1, beforeBakeWeightGram: 1120, afterBakeWeightGram: 1080, weightPerPieceGram: 1080 }),
    product({ id: "demo-int-custard", name: "カスタードクリーム", isIntermediateMaterial: true, category: "中間材料", sellingPrice: 0, taxType: "税込", targetCostRate: 35, displayUnit: "100gあたり", yieldCount: 1, beforeBakeWeightGram: 1150, afterBakeWeightGram: 980, weightPerPieceGram: 980 }),
    product({ id: "demo-int-tart", name: "タルト台", isIntermediateMaterial: true, category: "中間材料", sellingPrice: 0, taxType: "税込", targetCostRate: 35, displayUnit: "100gあたり", yieldCount: 1, beforeBakeWeightGram: 900, afterBakeWeightGram: 760, weightPerPieceGram: 760 }),
    product({ id: "demo-prd-shortcake", name: "苺ショート", isIntermediateMaterial: false, category: "生菓子", sellingPrice: 620, taxType: "税込", targetCostRate: 35, displayUnit: "1個あたり", yieldCount: 8, beforeBakeWeightGram: 1160, afterBakeWeightGram: 980, weightPerPieceGram: 122, memo: "売上上位だが苺・生クリーム値上げの影響を受けやすい" }),
    product({ id: "demo-prd-choco-cake", name: "チョコレートケーキ", isIntermediateMaterial: false, category: "生菓子", sellingPrice: 580, taxType: "税込", targetCostRate: 35, displayUnit: "1個あたり", yieldCount: 10, beforeBakeWeightGram: 1050, afterBakeWeightGram: 900, weightPerPieceGram: 90 }),
    product({ id: "demo-prd-montblanc", name: "モンブラン", isIntermediateMaterial: false, category: "生菓子", sellingPrice: 720, taxType: "税込", targetCostRate: 35, displayUnit: "1個あたり", yieldCount: 8, beforeBakeWeightGram: 980, afterBakeWeightGram: 840, weightPerPieceGram: 105, memo: "季節限定化候補" }),
    product({ id: "demo-prd-fruit-tart", name: "フルーツタルト", isIntermediateMaterial: false, category: "生菓子", sellingPrice: 680, taxType: "税込", targetCostRate: 35, displayUnit: "1個あたり", yieldCount: 8, beforeBakeWeightGram: 1120, afterBakeWeightGram: 900, weightPerPieceGram: 112 }),
    product({ id: "demo-prd-pudding", name: "プリン", isIntermediateMaterial: false, category: "生菓子", sellingPrice: 320, taxType: "税込", targetCostRate: 35, displayUnit: "1個あたり", yieldCount: 12, beforeBakeWeightGram: 1260, afterBakeWeightGram: 1140, weightPerPieceGram: 95 }),
    product({ id: "demo-prd-chou", name: "シュークリーム", isIntermediateMaterial: false, category: "生菓子", sellingPrice: 280, taxType: "税込", targetCostRate: 35, displayUnit: "1個あたり", yieldCount: 16, beforeBakeWeightGram: 1500, afterBakeWeightGram: 1280, weightPerPieceGram: 80, memo: "売れるが単価が低く作業負担が大きい" }),
    product({ id: "demo-prd-financier", name: "フィナンシェ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 260, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 24, beforeBakeWeightGram: 1320, afterBakeWeightGram: 1120, weightPerPieceGram: 46, memo: "粗利率が高く日持ちする主力候補" }),
    product({ id: "demo-prd-madeleine", name: "マドレーヌ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 240, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 24, beforeBakeWeightGram: 1320, afterBakeWeightGram: 1140, weightPerPieceGram: 47 }),
    product({ id: "demo-prd-galette", name: "ガレットブルトンヌ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 320, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 20, beforeBakeWeightGram: 1100, afterBakeWeightGram: 920, weightPerPieceGram: 46 }),
    product({ id: "demo-prd-cookie", name: "ディアマンクッキー", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 180, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 40, beforeBakeWeightGram: 980, afterBakeWeightGram: 820, weightPerPieceGram: 20 }),
    product({ id: "demo-prd-pound", name: "パウンドケーキ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 1680, taxType: "税込", targetCostRate: 32, displayUnit: "1本あたり", yieldCount: 2, beforeBakeWeightGram: 1400, afterBakeWeightGram: 1180, weightPerPieceGram: 590 }),
    product({ id: "demo-prd-florentin", name: "フロランタン", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 280, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 24, beforeBakeWeightGram: 1200, afterBakeWeightGram: 980, weightPerPieceGram: 41 }),
    product({ id: "demo-prd-lemoncake", name: "レモンケーキ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 300, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 20, beforeBakeWeightGram: 1180, afterBakeWeightGram: 980, weightPerPieceGram: 49 }),
    product({ id: "demo-prd-brownie", name: "ブラウニー", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 340, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 18, beforeBakeWeightGram: 1260, afterBakeWeightGram: 1080, weightPerPieceGram: 60 }),
    product({ id: "demo-prd-dacquoise", name: "ダックワーズ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 280, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 20, beforeBakeWeightGram: 920, afterBakeWeightGram: 760, weightPerPieceGram: 38 }),
    product({ id: "demo-prd-donut", name: "焼きドーナツ", isIntermediateMaterial: false, category: "焼菓子", sellingPrice: 260, taxType: "税込", targetCostRate: 32, displayUnit: "1個あたり", yieldCount: 24, beforeBakeWeightGram: 1300, afterBakeWeightGram: 1120, weightPerPieceGram: 46 }),
    product({ id: "demo-prd-gift5", name: "焼菓子5個入り", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 1550, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 260, afterBakeWeightGram: 260, weightPerPieceGram: 260 }),
    product({ id: "demo-prd-gift10", name: "焼菓子10個入り", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 3100, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 520, afterBakeWeightGram: 520, weightPerPieceGram: 520, memo: "客単価と粗利貢献が大きい" }),
    product({ id: "demo-prd-gift15", name: "焼菓子15個入り", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 4650, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 780, afterBakeWeightGram: 780, weightPerPieceGram: 780 }),
    product({ id: "demo-prd-season-s", name: "季節のギフトS", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 2300, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 420, afterBakeWeightGram: 420, weightPerPieceGram: 420 }),
    product({ id: "demo-prd-season-m", name: "季節のギフトM", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 3800, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 690, afterBakeWeightGram: 690, weightPerPieceGram: 690 }),
    product({ id: "demo-prd-season-l", name: "季節のギフトL", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 5600, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 980, afterBakeWeightGram: 980, weightPerPieceGram: 980 }),
    product({ id: "demo-prd-corporate", name: "法人手土産セット", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 6800, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 1150, afterBakeWeightGram: 1150, weightPerPieceGram: 1150, memo: "販売数は少ないが売上・粗利が大きい" }),
    product({ id: "demo-prd-uchiiwai", name: "内祝いギフト", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 4800, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 820, afterBakeWeightGram: 820, weightPerPieceGram: 820 }),
    product({ id: "demo-prd-osonae", name: "お供えギフト", isIntermediateMaterial: false, category: "進物・ギフト", sellingPrice: 4200, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 760, afterBakeWeightGram: 760, weightPerPieceGram: 760 }),
    product({ id: "demo-prd-deco4", name: "4号生デコ", isIntermediateMaterial: false, category: "ホール・予約商品", sellingPrice: 3200, taxType: "税込", targetCostRate: 35, displayUnit: "1台あたり", yieldCount: 1, beforeBakeWeightGram: 650, afterBakeWeightGram: 580, weightPerPieceGram: 580 }),
    product({ id: "demo-prd-deco5", name: "5号生デコ", isIntermediateMaterial: false, category: "ホール・予約商品", sellingPrice: 4200, taxType: "税込", targetCostRate: 35, displayUnit: "1台あたり", yieldCount: 1, beforeBakeWeightGram: 950, afterBakeWeightGram: 850, weightPerPieceGram: 850 }),
    product({ id: "demo-prd-deco6", name: "6号生デコ", isIntermediateMaterial: false, category: "ホール・予約商品", sellingPrice: 5600, taxType: "税込", targetCostRate: 35, displayUnit: "1台あたり", yieldCount: 1, beforeBakeWeightGram: 1380, afterBakeWeightGram: 1220, weightPerPieceGram: 1220 }),
    product({ id: "demo-prd-tartwhole", name: "季節のフルーツタルトホール", isIntermediateMaterial: false, category: "ホール・予約商品", sellingPrice: 4800, taxType: "税込", targetCostRate: 35, displayUnit: "1台あたり", yieldCount: 1, beforeBakeWeightGram: 980, afterBakeWeightGram: 880, weightPerPieceGram: 880 }),
    product({ id: "demo-prd-gift-reserve", name: "焼菓子詰め合わせ予約", isIntermediateMaterial: false, category: "ホール・予約商品", sellingPrice: 7500, taxType: "税込", targetCostRate: 34, displayUnit: "1袋あたり", yieldCount: 1, beforeBakeWeightGram: 1320, afterBakeWeightGram: 1320, weightPerPieceGram: 1320 }),
  ];

  const recipeItems: RecipeItem[] = [
    recipe("demo-rec-genoise-flour", "demo-int-genoise", "demo-cake-flour", 260),
    recipe("demo-rec-genoise-sugar", "demo-int-genoise", "demo-sugar", 260),
    recipe("demo-rec-genoise-egg", "demo-int-genoise", "demo-whole-egg", 520),
    recipe("demo-rec-genoise-butter", "demo-int-genoise", "demo-butter", 70),
    recipe("demo-rec-chantilly-cream45", "demo-int-chantilly", "demo-cream45", 800),
    recipe("demo-rec-chantilly-cream35", "demo-int-chantilly", "demo-cream35", 220),
    recipe("demo-rec-chantilly-sugar", "demo-int-chantilly", "demo-sugar", 90),
    recipe("demo-rec-custard-milk", "demo-int-custard", "demo-milk", 700),
    recipe("demo-rec-custard-yolk", "demo-int-custard", "demo-yolk", 180),
    recipe("demo-rec-custard-sugar", "demo-int-custard", "demo-sugar", 170),
    recipe("demo-rec-custard-flour", "demo-int-custard", "demo-cake-flour", 45),
    recipe("demo-rec-tart-flour", "demo-int-tart", "demo-cake-flour", 360),
    recipe("demo-rec-tart-butter", "demo-int-tart", "demo-butter", 220),
    recipe("demo-rec-tart-sugar", "demo-int-tart", "demo-powdered-sugar", 140),
    recipe("demo-rec-tart-egg", "demo-int-tart", "demo-whole-egg", 90),
    intermediate("demo-rec-short-genoise", "demo-prd-shortcake", "demo-int-genoise", 460),
    intermediate("demo-rec-short-cream", "demo-prd-shortcake", "demo-int-chantilly", 390),
    recipe("demo-rec-short-strawberry", "demo-prd-shortcake", "demo-strawberry", 290),
    recipe("demo-rec-short-cutbox", "demo-prd-shortcake", "demo-pkg-cutbox", 8),
    intermediate("demo-rec-choco-genoise", "demo-prd-choco-cake", "demo-int-genoise", 380),
    recipe("demo-rec-choco-sweet", "demo-prd-choco-cake", "demo-sweet-choco", 240),
    recipe("demo-rec-choco-cream", "demo-prd-choco-cake", "demo-cream35", 260),
    recipe("demo-rec-choco-cutbox", "demo-prd-choco-cake", "demo-pkg-cutbox", 10),
    intermediate("demo-rec-mont-genoise", "demo-prd-montblanc", "demo-int-genoise", 280),
    recipe("demo-rec-mont-marron", "demo-prd-montblanc", "demo-marron", 420),
    recipe("demo-rec-mont-cream", "demo-prd-montblanc", "demo-cream35", 240),
    recipe("demo-rec-mont-cutbox", "demo-prd-montblanc", "demo-pkg-cutbox", 8),
    intermediate("demo-rec-fruit-tart", "demo-prd-fruit-tart", "demo-int-tart", 520),
    intermediate("demo-rec-fruit-custard", "demo-prd-fruit-tart", "demo-int-custard", 260),
    recipe("demo-rec-fruit-strawberry", "demo-prd-fruit-tart", "demo-strawberry", 250),
    recipe("demo-rec-fruit-rasp", "demo-prd-fruit-tart", "demo-raspberry", 80),
    recipe("demo-rec-pudding-milk", "demo-prd-pudding", "demo-milk", 760),
    recipe("demo-rec-pudding-egg", "demo-prd-pudding", "demo-whole-egg", 300),
    recipe("demo-rec-pudding-yolk", "demo-prd-pudding", "demo-yolk", 80),
    recipe("demo-rec-pudding-sugar", "demo-prd-pudding", "demo-sugar", 160),
    recipe("demo-rec-pudding-cup", "demo-prd-pudding", "demo-pkg-cutbox", 12, "プリンカップ代用"),
    recipe("demo-rec-chou-flour", "demo-prd-chou", "demo-cake-flour", 180),
    recipe("demo-rec-chou-butter", "demo-prd-chou", "demo-butter", 150),
    recipe("demo-rec-chou-egg", "demo-prd-chou", "demo-whole-egg", 360),
    intermediate("demo-rec-chou-custard", "demo-prd-chou", "demo-int-custard", 600),
    recipe("demo-rec-chou-cutbox", "demo-prd-chou", "demo-pkg-cutbox", 16),
  ];

  const bakedRecipes: Array<[string, string, number, string, number, string, number, string, number, string, number, number]> = [
    ["demo-prd-financier", "demo-almond-powder", 360, "demo-powdered-sugar", 330, "demo-white", 360, "demo-fermented-butter", 360, "demo-cake-flour", 120, 24],
    ["demo-prd-madeleine", "demo-cake-flour", 340, "demo-sugar", 300, "demo-whole-egg", 320, "demo-butter", 330, "demo-lemon", 30, 24],
    ["demo-prd-galette", "demo-cake-flour", 360, "demo-fermented-butter", 360, "demo-powdered-sugar", 170, "demo-yolk", 90, "demo-salt", 6, 20],
    ["demo-prd-cookie", "demo-cake-flour", 420, "demo-butter", 260, "demo-powdered-sugar", 180, "demo-almond-powder", 120, "demo-vanilla", 6, 40],
    ["demo-prd-pound", "demo-cake-flour", 360, "demo-butter", 360, "demo-sugar", 340, "demo-whole-egg", 360, "demo-rum", 30, 2],
    ["demo-prd-florentin", "demo-almond-slice", 360, "demo-sugar", 260, "demo-butter", 220, "demo-cream35", 160, "demo-honey", 70, 24],
    ["demo-prd-lemoncake", "demo-cake-flour", 320, "demo-butter", 280, "demo-sugar", 280, "demo-whole-egg", 300, "demo-lemon", 120, 20],
    ["demo-prd-brownie", "demo-sweet-choco", 360, "demo-butter", 220, "demo-sugar", 220, "demo-whole-egg", 260, "demo-cake-flour", 160, 18],
    ["demo-prd-dacquoise", "demo-almond-powder", 280, "demo-powdered-sugar", 220, "demo-white", 300, "demo-sugar", 120, "demo-butter", 80, 20],
    ["demo-prd-donut", "demo-cake-flour", 420, "demo-sugar", 260, "demo-whole-egg", 300, "demo-butter", 220, "demo-bp", 18, 24],
  ];
  bakedRecipes.forEach(([productId, a, av, b, bv, c, cv, d, dv, e, ev, packCount]) => {
    recipeItems.push(recipe(`demo-rec-${productId}-a`, productId, a, av));
    recipeItems.push(recipe(`demo-rec-${productId}-b`, productId, b, bv));
    recipeItems.push(recipe(`demo-rec-${productId}-c`, productId, c, cv));
    recipeItems.push(recipe(`demo-rec-${productId}-d`, productId, d, dv));
    recipeItems.push(recipe(`demo-rec-${productId}-e`, productId, e, ev));
    recipeItems.push(recipe(`demo-rec-${productId}-bag`, productId, "demo-pkg-bag", packCount));
    recipeItems.push(recipe(`demo-rec-${productId}-oxygen`, productId, "demo-pkg-oxygen", packCount));
    recipeItems.push(recipe(`demo-rec-${productId}-label`, productId, "demo-pkg-label", packCount));
  });

  const giftComponents: Array<[string, number, string]> = [
    ["demo-prd-gift5", 5, "demo-pkg-gift-s"],
    ["demo-prd-gift10", 10, "demo-pkg-gift-m"],
    ["demo-prd-gift15", 15, "demo-pkg-gift-l"],
    ["demo-prd-season-s", 7, "demo-pkg-gift-s"],
    ["demo-prd-season-m", 12, "demo-pkg-gift-m"],
    ["demo-prd-season-l", 18, "demo-pkg-gift-l"],
    ["demo-prd-corporate", 22, "demo-pkg-gift-l"],
    ["demo-prd-uchiiwai", 15, "demo-pkg-gift-m"],
    ["demo-prd-osonae", 13, "demo-pkg-gift-m"],
    ["demo-prd-gift-reserve", 26, "demo-pkg-gift-l"],
  ];
  giftComponents.forEach(([productId, count, boxId]) => {
    recipeItems.push(recipe(`demo-rec-${productId}-financier`, productId, "demo-fermented-butter", count * 12));
    recipeItems.push(recipe(`demo-rec-${productId}-madeleine`, productId, "demo-cake-flour", count * 10));
    recipeItems.push(recipe(`demo-rec-${productId}-choco`, productId, "demo-sweet-choco", count * 6));
    recipeItems.push(recipe(`demo-rec-${productId}-nuts`, productId, "demo-almond-powder", count * 6));
    recipeItems.push(recipe(`demo-rec-${productId}-bags`, productId, "demo-pkg-bag", count));
    recipeItems.push(recipe(`demo-rec-${productId}-oxygen`, productId, "demo-pkg-oxygen", count));
    recipeItems.push(recipe(`demo-rec-${productId}-box`, productId, boxId, 1));
    recipeItems.push(recipe(`demo-rec-${productId}-handbag`, productId, "demo-pkg-handbag", 1));
    recipeItems.push(recipe(`demo-rec-${productId}-label`, productId, "demo-pkg-label", count));
  });

  ["demo-prd-deco4", "demo-prd-deco5", "demo-prd-deco6", "demo-prd-tartwhole"].forEach((productId, index) => {
    const sizeScale = index + 1;
    recipeItems.push(intermediate(`demo-rec-${productId}-genoise`, productId, "demo-int-genoise", 300 + sizeScale * 160));
    recipeItems.push(intermediate(`demo-rec-${productId}-cream`, productId, "demo-int-chantilly", 260 + sizeScale * 170));
    recipeItems.push(recipe(`demo-rec-${productId}-strawberry`, productId, "demo-strawberry", 180 + sizeScale * 140));
    recipeItems.push(recipe(`demo-rec-${productId}-box`, productId, index < 1 ? "demo-pkg-cakebox4" : "demo-pkg-cakebox5", 1));
    recipeItems.push(recipe(`demo-rec-${productId}-ice`, productId, "demo-pkg-ice", 1 + sizeScale));
  });

  const salesRecords: SalesRecord[] = [
    sale("demo-sale-apr-short", "2026-04", "demo-prd-shortcake", 420, 620, "4月: 生菓子上位、平日は控えめ"),
    sale("demo-sale-apr-chou", "2026-04", "demo-prd-chou", 520, 280, "4月: 販売数は多いが利益薄い"),
    sale("demo-sale-apr-pudding", "2026-04", "demo-prd-pudding", 390, 320, "4月: 平日需要"),
    sale("demo-sale-apr-financier", "2026-04", "demo-prd-financier", 760, 260, "4月: 焼菓子主力"),
    sale("demo-sale-apr-madeleine", "2026-04", "demo-prd-madeleine", 690, 240, "4月: 焼菓子主力"),
    sale("demo-sale-apr-gift10", "2026-04", "demo-prd-gift10", 86, 3100, "4月: 手土産需要"),
    sale("demo-sale-apr-seasonm", "2026-04", "demo-prd-season-m", 44, 3800, "4月: 進物需要"),
    sale("demo-sale-apr-corp", "2026-04", "demo-prd-corporate", 18, 6800, "4月: 法人手土産"),
    sale("demo-sale-may-short", "2026-05", "demo-prd-shortcake", 460, 620, "5月: 記念日需要"),
    sale("demo-sale-may-mont", "2026-05", "demo-prd-montblanc", 140, 720, "5月: 廃棄リスクあり"),
    sale("demo-sale-may-chou", "2026-05", "demo-prd-chou", 560, 280, "5月: 当日販売依存"),
    sale("demo-sale-may-pudding", "2026-05", "demo-prd-pudding", 420, 320, "5月: 単価低め"),
    sale("demo-sale-may-financier", "2026-05", "demo-prd-financier", 860, 260, "5月: 伸ばす候補"),
    sale("demo-sale-may-madeleine", "2026-05", "demo-prd-madeleine", 790, 240, "5月: 伸ばす候補"),
    sale("demo-sale-may-lemon", "2026-05", "demo-prd-lemoncake", 360, 300, "5月: 初夏商品"),
    sale("demo-sale-may-gift10", "2026-05", "demo-prd-gift10", 112, 3100, "5月: 粗利貢献大"),
    sale("demo-sale-may-seasonm", "2026-05", "demo-prd-season-m", 62, 3800, "5月: 進物強い"),
    sale("demo-sale-may-corp", "2026-05", "demo-prd-corporate", 24, 6800, "5月: 法人ギフト"),
    sale("demo-sale-may-deco5", "2026-05", "demo-prd-deco5", 48, 4200, "5月: 土日予約"),
    sale("demo-sale-jun-short", "2026-06", "demo-prd-shortcake", 430, 620, "6月: 値上げ候補"),
    sale("demo-sale-jun-mont", "2026-06", "demo-prd-montblanc", 120, 720, "6月: 季節限定化候補"),
    sale("demo-sale-jun-chou", "2026-06", "demo-prd-chou", 590, 280, "6月: 販売数はあるが利益薄い"),
    sale("demo-sale-jun-pudding", "2026-06", "demo-prd-pudding", 450, 320, "6月: 卵・包材影響"),
    sale("demo-sale-jun-financier", "2026-06", "demo-prd-financier", 920, 260, "6月: 伸ばす候補"),
    sale("demo-sale-jun-madeleine", "2026-06", "demo-prd-madeleine", 850, 240, "6月: 伸ばす候補"),
    sale("demo-sale-jun-galette", "2026-06", "demo-prd-galette", 330, 320, "6月: 進物向き"),
    sale("demo-sale-jun-lemon", "2026-06", "demo-prd-lemoncake", 390, 300, "6月: 季節商品"),
    sale("demo-sale-jun-gift5", "2026-06", "demo-prd-gift5", 130, 1550, "6月: 平日手土産"),
    sale("demo-sale-jun-gift10", "2026-06", "demo-prd-gift10", 124, 3100, "6月: 粗利貢献大"),
    sale("demo-sale-jun-seasonm", "2026-06", "demo-prd-season-m", 74, 3800, "6月: 伸ばす候補"),
    sale("demo-sale-jun-corp", "2026-06", "demo-prd-corporate", 28, 6800, "6月: 法人手土産"),
    sale("demo-sale-jun-uchiiwai", "2026-06", "demo-prd-uchiiwai", 34, 4800, "6月: 内祝い"),
    sale("demo-sale-jun-osonae", "2026-06", "demo-prd-osonae", 30, 4200, "6月: お供え"),
    sale("demo-sale-jun-deco5", "2026-06", "demo-prd-deco5", 54, 4200, "6月: 土日祝で伸びる"),
    sale("demo-sale-jun-tartwhole", "2026-06", "demo-prd-tartwhole", 22, 4800, "6月: 予約商品"),
  ];

  const wasteRecords: WasteRecord[] = [
    waste("demo-waste-short-rain", "2026-06-04", "demo-prd-shortcake", 6, 1260, 3720, "雨の日で生菓子残り"),
    waste("demo-waste-chou-rain", "2026-06-04", "demo-prd-chou", 10, 900, 2800, "雨の日で当日販売が弱い"),
    waste("demo-waste-pudding-weekday", "2026-06-05", "demo-prd-pudding", 7, 700, 2240, "平日夕方の売れ残り"),
    waste("demo-waste-mont-hot", "2026-06-11", "demo-prd-montblanc", 4, 1080, 2880, "暑い日で生菓子が弱い"),
    waste("demo-waste-short-weekday", "2026-06-12", "demo-prd-shortcake", 5, 1050, 3100, "平日の製造数過多"),
    waste("demo-waste-financier", "2026-06-18", "demo-prd-financier", 2, 90, 520, "焼菓子は廃棄少なめ"),
  ];

  return {
    ingredients,
    products,
    productCategories: ["生菓子", "焼菓子", "進物・ギフト", "ホール・予約商品", "中間材料", "包材"],
    recipeItems,
    priceHistories: [
      history("demo-hist-strawberry", "demo-strawberry", 780, 920, "青果市場"),
      history("demo-hist-cream45", "demo-cream45", 1020, 1180, "関東デイリー"),
      history("demo-hist-butter", "demo-butter", 780, 880, "北海乳業"),
      history("demo-hist-egg", "demo-whole-egg", 5800, 6500, "武蔵野鶏卵"),
    ],
    ingredientAliases: [],
    wasteRecords,
    salesRecords,
    actualCostRecords: [
      { id: "demo-actual-dairy", month: "2026-06", supplier: "関東デイリー", amount: 210000, memo: "デモ実仕入", createdAt: now, updatedAt: now },
      { id: "demo-actual-flour", month: "2026-06", supplier: "東都製粉", amount: 88000, memo: "デモ実仕入", createdAt: now, updatedAt: now },
      { id: "demo-actual-packaging", month: "2026-06", supplier: "パッケージサプライ", amount: 146000, memo: "ギフト包材が多い", createdAt: now, updatedAt: now },
    ],
    eventPlans: [{ id: "demo-event-summer-gift", name: "夏の帰省ギフト", date: "2026-08-10", memo: "帰省・法人手土産の原価シミュレーション", createdAt: now, updatedAt: now }],
    eventPlanItems: [
      { id: "demo-event-gift10", eventPlanId: "demo-event-summer-gift", productId: "demo-prd-gift10", plannedQuantity: 180, sellingPrice: 3100, memo: "帰省手土産", createdAt: now, updatedAt: now },
      { id: "demo-event-seasonm", eventPlanId: "demo-event-summer-gift", productId: "demo-prd-season-m", plannedQuantity: 120, sellingPrice: 3800, memo: "季節ギフト", createdAt: now, updatedAt: now },
      { id: "demo-event-corp", eventPlanId: "demo-event-summer-gift", productId: "demo-prd-corporate", plannedQuantity: 45, sellingPrice: 6800, memo: "法人手土産", createdAt: now, updatedAt: now },
    ],
    laborCosts: [
      { id: "demo-labor-short", productId: "demo-prd-shortcake", processName: "ナッペ・カット・苺仕上げ", minutes: 55, workers: 1, hourlyWage: 1300, memo: "8個取り", createdAt: now, updatedAt: now },
      { id: "demo-labor-chou", productId: "demo-prd-chou", processName: "皮焼成・クリーム詰め", minutes: 65, workers: 1, hourlyWage: 1300, memo: "16個分", createdAt: now, updatedAt: now },
      { id: "demo-labor-financier", productId: "demo-prd-financier", processName: "焼成・袋詰め", minutes: 45, workers: 1, hourlyWage: 1200, memo: "24個分", createdAt: now, updatedAt: now },
      { id: "demo-labor-gift10", productId: "demo-prd-gift10", processName: "箱詰め・包装", minutes: 10, workers: 1, hourlyWage: 1200, memo: "1箱", createdAt: now, updatedAt: now },
      { id: "demo-labor-corporate", productId: "demo-prd-corporate", processName: "法人ギフト包装・熨斗確認", minutes: 18, workers: 1, hourlyWage: 1200, memo: "1箱", createdAt: now, updatedAt: now },
    ],
    setProductItems: [],
    inventoryRecords: [],
    packagingClassifications: [],
    onboardingSupport: {
      onboardingSupportEnabled: false,
      onboardingSupportStartDate: "2026-06-01",
      onboardingSupportEndDate: "2026-06-30",
      officialLineUrl: "https://lin.ee/sq52Q9d",
    },
    billing: {
      ocrUsedMonth: "2026-06",
      ocrUsedThisMonth: 8,
      baseMonthlyPrice: 1400,
      ocrBaseLimit: 30,
      ocrAddonPacks: 0,
      ocrAddonPackSize: 50,
      ocrAddonPrice: 500,
      ocrAddonHistory: [],
    },
  };
}
