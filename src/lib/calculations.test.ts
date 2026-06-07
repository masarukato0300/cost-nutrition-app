import assert from "node:assert/strict";
import { calculateEventSimulation, calculateMonthlyTheoryCost, calculatePriceImpact, calculateProductCost, calculateProductLaborCost, calculateProductNutrition, calculateProductionRequirements, calculateSetProductCost, calculateWasteMonthlySummary, calculateWasteRecordAmounts, calculateWasteSummary, pricePerGram } from "./calculations";
import { sampleData } from "./sample-data";

const shortcake = sampleData.products.find((product) => product.id === "prd-shortcake");
const flour = sampleData.ingredients.find((ingredient) => ingredient.id === "ing-flour");
const cream = sampleData.ingredients.find((ingredient) => ingredient.id === "ing-cream");

assert(shortcake);
assert(flour);
assert(cream);

assert.equal(Math.round(pricePerGram(flour) * 10000) / 10000, 0.1848);
assert.equal(Math.round(pricePerGram(cream) * 10000) / 10000, 1.012);

const cost = calculateProductCost(shortcake, sampleData.ingredients, sampleData.recipeItems, sampleData.products);
assert.equal(Math.round(cost.totalRecipeWeightGram), 1158);
assert.equal(Math.round(cost.totalCost), 1408);
assert.equal(Math.round(cost.costPerPiece), 176);
assert.equal(Math.round(cost.costRate * 10) / 10, 33.8);
assert(cost.packagingCostPerPiece > 0);

const bakedIntermediateData = {
  ingredients: [{
    id: "test-flour",
    name: "テスト粉",
    type: "PURCHASED_INGREDIENT" as const,
    category: "粉類",
    supplier: "",
    packageName: "テスト粉 1kg",
    packageAmountGram: 1000,
    packageUnit: "g",
    gramPerUnit: 1,
    price: 1000,
    taxType: "税込" as const,
    caloriesPer100g: 0,
    proteinPer100g: 0,
    fatPer100g: 0,
    carbsPer100g: 0,
    saltPer100g: 0,
    allergens: [],
    otherAllergen: "",
    labelName: "テスト粉",
    memo: "",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  }],
  products: [
    {
      id: "test-intermediate",
      name: "焼成後半分になる中間材料",
      isIntermediateMaterial: true,
      category: "中間材料",
      sellingPrice: 0,
      taxType: "税込" as const,
      targetCostRate: 35,
      displayUnit: "100gあたり" as const,
      yieldCount: 1,
      beforeBakeWeightGram: 100,
      afterBakeWeightGram: 50,
      weightPerPieceGram: 50,
      status: "販売中" as const,
      memo: "",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    },
    {
      id: "test-product",
      name: "中間材料使用商品",
      isIntermediateMaterial: false,
      category: "商品",
      sellingPrice: 100,
      taxType: "税込" as const,
      targetCostRate: 35,
      displayUnit: "1個あたり" as const,
      yieldCount: 1,
      beforeBakeWeightGram: 10,
      afterBakeWeightGram: 10,
      weightPerPieceGram: 10,
      status: "販売中" as const,
      memo: "",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    },
  ],
  recipeItems: [
    {
      id: "test-rec-intermediate-flour",
      productId: "test-intermediate",
      ingredientId: "test-flour",
      itemType: "ingredient" as const,
      intermediateProductId: "",
      usageType: "gram" as const,
      amountGram: 100,
      baseAmountGram: 100,
      usedCount: 1,
      totalCount: 1,
      fractionDenominator: 1,
      lossRate: 0,
      memo: "",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    },
    {
      id: "test-rec-product-intermediate",
      productId: "test-product",
      ingredientId: "",
      itemType: "intermediate" as const,
      intermediateProductId: "test-intermediate",
      usageType: "gram" as const,
      amountGram: 10,
      baseAmountGram: 10,
      usedCount: 1,
      totalCount: 1,
      fractionDenominator: 1,
      lossRate: 0,
      memo: "",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    },
  ],
};
const bakedIntermediateCost = calculateProductCost(
  bakedIntermediateData.products[1],
  bakedIntermediateData.ingredients,
  bakedIntermediateData.recipeItems,
  bakedIntermediateData.products,
);
assert.equal(Math.round(bakedIntermediateCost.totalCost), 20);

const nutrition = calculateProductNutrition(shortcake, sampleData.ingredients, sampleData.recipeItems, sampleData.products);
assert.equal(Math.round(nutrition.totalNutrition.calories), 2982);
assert.equal(Math.round(nutrition.nutritionPerPiece.calories), 373);
assert.equal(Math.round(nutrition.nutritionPer100g.calories), 311);
assert.equal(nutrition.basisWeightGram, 960);

const impact = calculatePriceImpact(sampleData, "ing-cream", 980);
assert(impact.some((row) => row.product.name === "苺のショートケーキ"));
assert(impact.some((row) => row.product.name === "クレームシャンティ"));
assert(impact[0]?.increase > 0);
assert(impact[0]?.priceCandidates.length === 3);

const requirements = calculateProductionRequirements(sampleData, [
  { productId: "prd-shortcake", quantity: 50 },
  { productId: "prd-madeleine", quantity: 100 },
  { productId: "prd-castella", quantity: 30 },
]);
const requiredFlour = requirements.find((row) => row.ingredient.id === "ing-flour");
const requiredTray = requirements.find((row) => row.ingredient.id === "pkg-tray");
assert(requiredFlour && requiredFlour.requiredAmount > 0);
assert(requiredTray && Math.round(requiredTray.requiredAmount) === 50);
assert(requirements.some((row) => row.isPackaging));
assert(requirements.reduce((sum, row) => sum + row.cost, 0) > 0);

const wasteAmounts = calculateWasteRecordAmounts(sampleData, "PRODUCT", "prd-shortcake", 3);
assert(Math.round(wasteAmounts.costAmount) > 0);
assert.equal(Math.round(wasteAmounts.salesEquivalentAmount), 1560);
const wasteSummary = calculateWasteSummary({
  ...sampleData,
  wasteRecords: [{
    id: "waste-test",
    date: "2026-05-16",
    itemType: "PRODUCT",
    itemId: "prd-shortcake",
    quantity: 3,
    costAmount: wasteAmounts.costAmount,
    salesEquivalentAmount: wasteAmounts.salesEquivalentAmount,
    reason: "売れ残り",
    memo: "",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
  }],
});
assert.equal(Math.round(wasteSummary.totalSalesEquivalentAmount), 1560);
assert.equal(wasteSummary.topRows[0]?.itemName, "苺のショートケーキ");
const wasteMonthlySummary = calculateWasteMonthlySummary({
  ...sampleData,
  wasteRecords: [{
    id: "waste-test",
    date: "2026-05-16",
    itemType: "PRODUCT",
    itemId: "prd-shortcake",
    quantity: 3,
    costAmount: wasteAmounts.costAmount,
    salesEquivalentAmount: wasteAmounts.salesEquivalentAmount,
    reason: "売れ残り",
    memo: "",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
  }],
}, "2026-05");
assert.equal(Math.round(wasteMonthlySummary.totalSalesEquivalentAmount), 1560);
assert.equal(wasteMonthlySummary.categoryRows[0]?.categoryName, "プティガトー");
assert.equal(wasteMonthlySummary.reasonRows[0]?.reason, "売れ残り");
assert.equal(wasteMonthlySummary.itemRows[0]?.itemName, "苺のショートケーキ");

const monthlyTheory = calculateMonthlyTheoryCost(sampleData, "2026-05");
assert(monthlyTheory.totalSalesAmount > 0);
assert(monthlyTheory.totalTheoryCostAmount > 0);
assert(monthlyTheory.actualCostAmount > 0);
assert(monthlyTheory.differenceAmount !== 0);
assert(monthlyTheory.rows.some((row) => row.product.name === "苺のショートケーキ"));

const eventSimulation = calculateEventSimulation(sampleData, "event-christmas-2026");
assert(eventSimulation.totalSalesAmount > 0);
assert(eventSimulation.totalCurrentGrossProfit > 0);
assert(eventSimulation.rows.some((row) => row.product.name === "苺のショートケーキ"));
const eventButterImpact = calculateEventSimulation(sampleData, "event-christmas-2026", { "ing-butter": 850 });
assert(eventButterImpact.totalProfitDecrease > 0);

const laborCost = calculateProductLaborCost(sampleData, shortcake);
assert(laborCost.laborTotalCost > 0);
assert(laborCost.laborCostPerPiece > 0);
assert(laborCost.effectiveCostPerPiece > cost.costPerPiece);
assert(laborCost.effectiveCostRate > cost.costRate);

const gift = sampleData.products.find((product) => product.id === "prd-gift");
assert(gift);
const setCost = calculateSetProductCost(sampleData, gift);
assert.equal(setCost.childRows.length, 2);
assert(setCost.childProductsCost > 0);
assert(setCost.packagingCost > 0);
assert(setCost.totalCost > setCost.packagingCost);
assert(setCost.costRate > 0);

console.log("calculation tests passed");
