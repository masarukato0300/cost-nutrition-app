import assert from "node:assert/strict";
import { calculateEventSimulation, calculateMonthlyTheoryCost, calculatePriceImpact, calculateProductCost, calculateProductLaborCost, calculateProductNutrition, calculateProductionRequirements, calculateWasteRecordAmounts, calculateWasteSummary, pricePerGram } from "./calculations";
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

console.log("calculation tests passed");
