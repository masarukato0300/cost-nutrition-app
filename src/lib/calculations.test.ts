import assert from "node:assert/strict";
import { calculatePriceImpact, calculateProductCost, calculateProductNutrition, pricePerGram } from "./calculations";
import { sampleData } from "./sample-data";

const shortcake = sampleData.products[0];
const flour = sampleData.ingredients.find((ingredient) => ingredient.id === "ing-flour");
const cream = sampleData.ingredients.find((ingredient) => ingredient.id === "ing-cream");

assert(flour);
assert(cream);

assert.equal(Math.round(pricePerGram(flour) * 10000) / 10000, 0.2288);
assert.equal(Math.round(pricePerGram(cream) * 10000) / 10000, 0.76);

const cost = calculateProductCost(shortcake, sampleData.ingredients, sampleData.recipeItems);
assert.equal(Math.round(cost.totalRecipeWeightGram), 1155);
assert.equal(Math.round(cost.totalCost), 1100);
assert.equal(Math.round(cost.costPerPiece), 137);
assert.equal(Math.round(cost.costRate * 10) / 10, 22.2);

const nutrition = calculateProductNutrition(shortcake, sampleData.ingredients, sampleData.recipeItems);
assert.equal(Math.round(nutrition.totalNutrition.calories), 3191);
assert.equal(Math.round(nutrition.nutritionPerPiece.calories), 399);
assert.equal(Math.round(nutrition.nutritionPer100g.calories), 332);
assert.equal(nutrition.basisWeightGram, 960);

const impact = calculatePriceImpact(sampleData, "ing-cream", 860);
assert.equal(impact.length, 1);
assert.equal(impact[0]?.product.name, "苺のショートケーキ");
assert(impact[0]?.increase > 0);

console.log("calculation tests passed");
