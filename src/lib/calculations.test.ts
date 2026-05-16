import assert from "node:assert/strict";
import { calculatePriceImpact, calculateProductCost, calculateProductNutrition, calculateProductionRequirements, pricePerGram } from "./calculations";
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

console.log("calculation tests passed");
