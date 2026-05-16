import type {
  AppData,
  EventSimulationSummary,
  Ingredient,
  MonthlyTheorySummary,
  Nutrition,
  PriceImpactRow,
  Product,
  ProductCostSummary,
  ProductLaborCostSummary,
  ProductNutritionSummary,
  ProductionPlanInput,
  RecipeItem,
  RequirementRow,
  SalesRecord,
  SetProductCostSummary,
  WasteRecord,
  WasteSummary,
} from "./types";

export const TAX_RATE = 0.1;

const zeroNutrition: Nutrition = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  salt: 0,
};

export function priceWithTax(price: number, taxType: Ingredient["taxType"]): number {
  return taxType === "税抜" ? price * (1 + TAX_RATE) : price;
}

export function pricePerGram(ingredient: Ingredient): number {
  if (!ingredient.packageAmountGram) return 0;
  return priceWithTax(ingredient.price, ingredient.taxType) / ingredient.packageAmountGram;
}

export function ingredientUnitLabel(ingredient: Ingredient): string {
  return ingredient.packageUnit || "g";
}

export function amountToGram(ingredient: Ingredient, amount: number): number {
  const unit = ingredientUnitLabel(ingredient);
  if (unit === "g" || unit === "ml") return amount;
  return amount * (ingredient.gramPerUnit || 0);
}

export function ingredientCost(ingredient: Ingredient, amount: number): number {
  return pricePerGram(ingredient) * amount;
}

export function recipeItemAmountGram(item: RecipeItem): number {
  const lossMultiplier = 1 + Math.max(item.lossRate || 0, 0) / 100;
  if (item.usageType === "count") {
    if (!item.totalCount) return 0;
    return ((item.baseAmountGram * item.usedCount) / item.totalCount) * lossMultiplier;
  }
  if (item.usageType === "fraction") {
    if (!item.fractionDenominator) return 0;
    return (item.baseAmountGram / item.fractionDenominator) * lossMultiplier;
  }
  return item.amountGram * lossMultiplier;
}

export function isPackagingIngredient(ingredient: Ingredient): boolean {
  if (ingredient.type === "PACKAGING") return true;
  return /包材|包装|箱|袋|シール|台紙|カップ|トレー/.test(`${ingredient.category} ${ingredient.name}`);
}

export function getProductRecipeItems(recipeItems: RecipeItem[], productId: string): RecipeItem[] {
  return recipeItems.filter((item) => item.productId === productId);
}

export function totalRecipeWeight(recipeItems: RecipeItem[], productId: string, ingredients: Ingredient[]): number {
  return getProductRecipeItems(recipeItems, productId).reduce((sum, item) => {
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
    return ingredient ? sum + amountToGram(ingredient, recipeItemAmountGram(item)) : sum;
  }, 0);
}

function getIntermediateBasisWeight(product: Product, ingredients: Ingredient[], recipeItems: RecipeItem[], visited: Set<string>): number {
  return product.afterBakeWeightGram || totalRecipeWeightWithProducts(recipeItems, product.id, ingredients, [], visited) || 1;
}

function totalRecipeWeightWithProducts(
  recipeItems: RecipeItem[],
  productId: string,
  ingredients: Ingredient[],
  products: Product[],
  visited = new Set<string>(),
): number {
  if (visited.has(productId)) return 0;
  return getProductRecipeItems(recipeItems, productId).reduce((sum, item) => {
    const amount = recipeItemAmountGram(item);
    if (item.itemType === "intermediate") return sum + amount;
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
    return ingredient ? sum + amountToGram(ingredient, amount) : sum;
  }, 0);
}

function intermediateCostPerGram(
  product: Product,
  ingredients: Ingredient[],
  products: Product[],
  recipeItems: RecipeItem[],
  visited: Set<string>,
): number {
  if (visited.has(product.id)) return 0;
  const summary = calculateProductCostInternal(product, ingredients, products, recipeItems, new Set(visited).add(product.id));
  const basisWeight = getIntermediateBasisWeight(product, ingredients, recipeItems, visited);
  return basisWeight ? summary.totalCost / basisWeight : 0;
}

function recipeItemCost(
  item: RecipeItem,
  ingredients: Ingredient[],
  products: Product[],
  recipeItems: RecipeItem[],
  visited: Set<string>,
) {
  const amount = recipeItemAmountGram(item);
  if (item.itemType === "intermediate") {
    const product = products.find((candidate) => candidate.id === item.intermediateProductId);
    return product ? intermediateCostPerGram(product, ingredients, products, recipeItems, visited) * amount : 0;
  }
  const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
  return ingredient ? ingredientCost(ingredient, amount) : 0;
}

function calculateProductCostInternal(
  product: Product,
  ingredients: Ingredient[],
  products: Product[],
  recipeItems: RecipeItem[],
  visited: Set<string>,
): ProductCostSummary {
  const productItems = getProductRecipeItems(recipeItems, product.id);
  const materialTotalCost = productItems.reduce((sum, item) => {
    if (item.itemType === "intermediate") return sum + recipeItemCost(item, ingredients, products, recipeItems, visited);
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
    if (!ingredient || isPackagingIngredient(ingredient)) return sum;
    return sum + ingredientCost(ingredient, recipeItemAmountGram(item));
  }, 0);
  const packagingTotalCost = productItems.reduce((sum, item) => {
    if (item.itemType === "intermediate") return sum;
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
    if (!ingredient || !isPackagingIngredient(ingredient)) return sum;
    return sum + ingredientCost(ingredient, recipeItemAmountGram(item));
  }, 0);
  const totalCost = materialTotalCost + packagingTotalCost;
  const materialCostPerPiece = product.yieldCount ? materialTotalCost / product.yieldCount : 0;
  const packagingCostPerPiece = product.yieldCount ? packagingTotalCost / product.yieldCount : 0;
  const costPerPiece = product.yieldCount ? totalCost / product.yieldCount : 0;
  const sellingPrice = priceWithTax(product.sellingPrice, product.taxType);
  const materialCostRate = sellingPrice ? (materialCostPerPiece / sellingPrice) * 100 : 0;
  const packagingCostRate = sellingPrice ? (packagingCostPerPiece / sellingPrice) * 100 : 0;
  const costRate = sellingPrice ? (costPerPiece / sellingPrice) * 100 : 0;

  return {
    product,
    materialTotalCost,
    packagingTotalCost,
    totalCost,
    materialCostPerPiece,
    packagingCostPerPiece,
    costPerPiece,
    materialCostRate,
    packagingCostRate,
    costRate,
    totalRecipeWeightGram: totalRecipeWeightWithProducts(recipeItems, product.id, ingredients, products, visited),
  };
}

export function recommendedPrice(costPerPiece: number, targetCostRate: number): number {
  return targetCostRate ? costPerPiece / (targetCostRate / 100) : 0;
}

export function roundedPriceCandidates(costPerPiece: number, targetCostRate: number) {
  const basePrice = recommendedPrice(costPerPiece, targetCostRate);
  return [10, 50, 100].map((unit) => {
    const price = Math.ceil(basePrice / unit) * unit;
    return {
      unit,
      price,
      costRate: price ? (costPerPiece / price) * 100 : 0,
    };
  });
}

export function calculateProductCost(
  product: Product,
  ingredients: Ingredient[],
  recipeItems: RecipeItem[],
  products: Product[] = [],
): ProductCostSummary {
  return calculateProductCostInternal(product, ingredients, products, recipeItems, new Set<string>());
}

function addRequirement(
  requirements: Map<string, RequirementRow>,
  ingredient: Ingredient,
  amount: number,
) {
  const current = requirements.get(ingredient.id);
  const requiredAmount = (current?.requiredAmount ?? 0) + amount;
  requirements.set(ingredient.id, {
    ingredient,
    requiredAmount,
    unit: ingredientUnitLabel(ingredient),
    cost: ingredientCost(ingredient, requiredAmount),
    supplier: ingredient.supplier,
    isPackaging: isPackagingIngredient(ingredient),
  });
}

function collectProductRequirements(
  product: Product,
  multiplier: number,
  data: AppData,
  requirements: Map<string, RequirementRow>,
  visited: Set<string>,
) {
  if (visited.has(product.id)) return;
  const nextVisited = new Set(visited).add(product.id);
  getProductRecipeItems(data.recipeItems, product.id).forEach((item) => {
    const amount = recipeItemAmountGram(item) * multiplier;
    if (item.itemType === "intermediate") {
      const intermediate = data.products.find((candidate) => candidate.id === item.intermediateProductId);
      if (!intermediate) return;
      const basisWeight = getIntermediateBasisWeight(intermediate, data.ingredients, data.recipeItems, nextVisited);
      collectProductRequirements(intermediate, basisWeight ? amount / basisWeight : 0, data, requirements, nextVisited);
      return;
    }
    const ingredient = data.ingredients.find((candidate) => candidate.id === item.ingredientId);
    if (ingredient) addRequirement(requirements, ingredient, amount);
  });
}

export function calculateProductionRequirements(data: AppData, planItems: ProductionPlanInput[]): RequirementRow[] {
  const requirements = new Map<string, RequirementRow>();
  planItems
    .filter((item) => item.quantity > 0)
    .forEach((item) => {
      const product = data.products.find((candidate) => candidate.id === item.productId);
      if (!product) return;
      const multiplier = product.yieldCount ? item.quantity / product.yieldCount : item.quantity;
      collectProductRequirements(product, multiplier, data, requirements, new Set<string>());
    });
  return [...requirements.values()].sort((a, b) => Number(a.isPackaging) - Number(b.isPackaging) || a.supplier.localeCompare(b.supplier, "ja") || a.ingredient.name.localeCompare(b.ingredient.name, "ja"));
}

export function calculateWasteRecordAmounts(
  data: AppData,
  itemType: WasteRecord["itemType"],
  itemId: string,
  quantity: number,
) {
  if (itemType === "PRODUCT" || itemType === "INTERMEDIATE") {
    const product = data.products.find((item) => item.id === itemId);
    if (!product) return { costAmount: 0, salesEquivalentAmount: 0 };
    const summary = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
    const costAmount = summary.costPerPiece * quantity;
    const salesEquivalentAmount = itemType === "PRODUCT" ? priceWithTax(product.sellingPrice, product.taxType) * quantity : 0;
    return { costAmount, salesEquivalentAmount };
  }

  const ingredient = data.ingredients.find((item) => item.id === itemId);
  if (!ingredient) return { costAmount: 0, salesEquivalentAmount: 0 };
  return {
    costAmount: ingredientCost(ingredient, quantity),
    salesEquivalentAmount: 0,
  };
}

export function calculateWasteSummary(data: AppData): WasteSummary {
  const topMap = new Map<string, WasteSummary["topRows"][number]>();
  data.wasteRecords.forEach((record) => {
    const product = data.products.find((item) => item.id === record.itemId);
    const ingredient = data.ingredients.find((item) => item.id === record.itemId);
    const itemName = product?.name || ingredient?.name || "削除済み";
    const key = `${record.itemType}:${record.itemId}`;
    const current = topMap.get(key);
    topMap.set(key, {
      itemName,
      itemType: record.itemType,
      quantity: (current?.quantity ?? 0) + record.quantity,
      costAmount: (current?.costAmount ?? 0) + record.costAmount,
      salesEquivalentAmount: (current?.salesEquivalentAmount ?? 0) + record.salesEquivalentAmount,
    });
  });

  return {
    totalCostAmount: data.wasteRecords.reduce((sum, record) => sum + record.costAmount, 0),
    totalSalesEquivalentAmount: data.wasteRecords.reduce((sum, record) => sum + record.salesEquivalentAmount, 0),
    topRows: [...topMap.values()].sort((a, b) => b.costAmount - a.costAmount).slice(0, 10),
  };
}

export function calculateMonthlyTheoryCost(data: AppData, month: string): MonthlyTheorySummary {
  const monthSales = data.salesRecords.filter((record) => record.month === month);
  const rows = monthSales
    .map((record) => {
      const product = data.products.find((item) => item.id === record.productId);
      if (!product) return null;
      const cost = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
      const salesAmount = priceWithTax(record.sellingPrice, product.taxType) * record.quantity;
      const theoryCostAmount = cost.costPerPiece * record.quantity;
      return {
        product,
        quantity: record.quantity,
        salesAmount,
        theoryCostAmount,
        grossProfit: salesAmount - theoryCostAmount,
        theoryCostRate: salesAmount ? (theoryCostAmount / salesAmount) * 100 : 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const totalSalesAmount = rows.reduce((sum, row) => sum + row.salesAmount, 0);
  const totalTheoryCostAmount = rows.reduce((sum, row) => sum + row.theoryCostAmount, 0);
  const actualCostAmount = data.actualCostRecords
    .filter((record) => record.month === month)
    .reduce((sum, record) => sum + record.amount, 0);

  return {
    month,
    rows,
    totalSalesAmount,
    totalTheoryCostAmount,
    totalGrossProfit: totalSalesAmount - totalTheoryCostAmount,
    theoryCostRate: totalSalesAmount ? (totalTheoryCostAmount / totalSalesAmount) * 100 : 0,
    actualCostAmount,
    differenceAmount: actualCostAmount - totalTheoryCostAmount,
  };
}

export function upsertSalesRecord(records: SalesRecord[], nextRecord: SalesRecord): SalesRecord[] {
  const existing = records.find((record) => record.month === nextRecord.month && record.productId === nextRecord.productId);
  if (!existing) return [nextRecord, ...records];
  return records.map((record) => (
    record.id === existing.id
      ? { ...record, quantity: nextRecord.quantity, sellingPrice: nextRecord.sellingPrice, memo: nextRecord.memo, updatedAt: nextRecord.updatedAt }
      : record
  ));
}

export function calculateEventSimulation(
  data: AppData,
  eventPlanId: string,
  priceOverrides: Record<string, number> = {},
): EventSimulationSummary {
  const eventPlan = data.eventPlans.find((event) => event.id === eventPlanId) ?? null;
  const simulatedIngredients = data.ingredients.map((ingredient) => (
    priceOverrides[ingredient.id] !== undefined ? { ...ingredient, price: priceOverrides[ingredient.id] } : ingredient
  ));
  const rows = data.eventPlanItems
    .filter((item) => item.eventPlanId === eventPlanId && item.plannedQuantity > 0)
    .map((item) => {
      const product = data.products.find((candidate) => candidate.id === item.productId);
      if (!product) return null;
      const currentCost = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
      const simulatedCost = calculateProductCost(product, simulatedIngredients, data.recipeItems, data.products);
      const sellingPrice = priceWithTax(item.sellingPrice, product.taxType);
      const salesAmount = sellingPrice * item.plannedQuantity;
      const currentTotalCost = currentCost.costPerPiece * item.plannedQuantity;
      const simulatedTotalCost = simulatedCost.costPerPiece * item.plannedQuantity;
      return {
        product,
        plannedQuantity: item.plannedQuantity,
        sellingPrice,
        salesAmount,
        currentUnitCost: currentCost.costPerPiece,
        simulatedUnitCost: simulatedCost.costPerPiece,
        currentGrossProfit: salesAmount - currentTotalCost,
        simulatedGrossProfit: salesAmount - simulatedTotalCost,
        profitDecrease: simulatedTotalCost - currentTotalCost,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const totalSalesAmount = rows.reduce((sum, row) => sum + row.salesAmount, 0);
  const totalCurrentCost = rows.reduce((sum, row) => sum + row.currentUnitCost * row.plannedQuantity, 0);
  const totalSimulatedCost = rows.reduce((sum, row) => sum + row.simulatedUnitCost * row.plannedQuantity, 0);

  return {
    eventPlan,
    rows,
    totalSalesAmount,
    totalCurrentCost,
    totalSimulatedCost,
    totalCurrentGrossProfit: rows.reduce((sum, row) => sum + row.currentGrossProfit, 0),
    totalSimulatedGrossProfit: rows.reduce((sum, row) => sum + row.simulatedGrossProfit, 0),
    totalProfitDecrease: totalSimulatedCost - totalCurrentCost,
  };
}

export function calculateLaborCostAmount(minutes: number, workers: number, hourlyWage: number): number {
  return (Math.max(minutes, 0) / 60) * Math.max(workers, 0) * Math.max(hourlyWage, 0);
}

export function calculateProductLaborCost(data: AppData, product: Product): ProductLaborCostSummary {
  const cost = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
  const laborRows = data.laborCosts
    .filter((row) => row.productId === product.id)
    .map((row) => ({
      ...row,
      costAmount: calculateLaborCostAmount(row.minutes, row.workers, row.hourlyWage),
    }));
  const laborTotalCost = laborRows.reduce((sum, row) => sum + row.costAmount, 0);
  const laborCostPerPiece = product.yieldCount ? laborTotalCost / product.yieldCount : 0;
  const effectiveCostPerPiece = cost.costPerPiece + laborCostPerPiece;
  const sellingPrice = priceWithTax(product.sellingPrice, product.taxType);

  return {
    product,
    laborRows,
    materialAndPackagingCostPerPiece: cost.costPerPiece,
    laborTotalCost,
    laborCostPerPiece,
    effectiveCostPerPiece,
    laborCostRate: sellingPrice ? (laborCostPerPiece / sellingPrice) * 100 : 0,
    effectiveCostRate: sellingPrice ? (effectiveCostPerPiece / sellingPrice) * 100 : 0,
  };
}

export function calculateSetProductCost(data: AppData, setProduct: Product): SetProductCostSummary {
  const childRows = data.setProductItems
    .filter((item) => item.setProductId === setProduct.id && item.quantity > 0)
    .map((item) => {
      const childProduct = data.products.find((product) => product.id === item.childProductId);
      if (!childProduct) return null;
      const cost = calculateProductCost(childProduct, data.ingredients, data.recipeItems, data.products);
      return {
        item,
        childProduct,
        unitCost: cost.costPerPiece,
        quantity: item.quantity,
        totalCost: cost.costPerPiece * item.quantity,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const ownRecipeCost = calculateProductCost(setProduct, data.ingredients, data.recipeItems, data.products);
  const childProductsCost = childRows.reduce((sum, row) => sum + row.totalCost, 0);
  const totalCost = childProductsCost + ownRecipeCost.packagingTotalCost;
  const sellingPrice = priceWithTax(setProduct.sellingPrice, setProduct.taxType);
  const targetRecommendedPrice = recommendedPrice(totalCost, setProduct.targetCostRate);

  return {
    setProduct,
    childRows,
    childProductsCost,
    packagingCost: ownRecipeCost.packagingTotalCost,
    totalCost,
    sellingPrice,
    costRate: sellingPrice ? (totalCost / sellingPrice) * 100 : 0,
    recommendedPrice: targetRecommendedPrice,
  };
}

export function nutritionForAmount(ingredient: Ingredient, amountGram: number): Nutrition {
  return {
    calories: ((ingredient.caloriesPer100g ?? 0) * amountGram) / 100,
    protein: ((ingredient.proteinPer100g ?? 0) * amountGram) / 100,
    fat: ((ingredient.fatPer100g ?? 0) * amountGram) / 100,
    carbs: ((ingredient.carbsPer100g ?? 0) * amountGram) / 100,
    salt: ((ingredient.saltPer100g ?? 0) * amountGram) / 100,
  };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    salt: a.salt + b.salt,
  };
}

export function divideNutrition(nutrition: Nutrition, divisor: number): Nutrition {
  if (!divisor) return { ...zeroNutrition };
  return {
    calories: nutrition.calories / divisor,
    protein: nutrition.protein / divisor,
    fat: nutrition.fat / divisor,
    carbs: nutrition.carbs / divisor,
    salt: nutrition.salt / divisor,
  };
}

export function multiplyNutrition(nutrition: Nutrition, multiplier: number): Nutrition {
  return {
    calories: nutrition.calories * multiplier,
    protein: nutrition.protein * multiplier,
    fat: nutrition.fat * multiplier,
    carbs: nutrition.carbs * multiplier,
    salt: nutrition.salt * multiplier,
  };
}

export function hasNutrition(ingredient: Ingredient): boolean {
  return [
    ingredient.caloriesPer100g,
    ingredient.proteinPer100g,
    ingredient.fatPer100g,
    ingredient.carbsPer100g,
    ingredient.saltPer100g,
  ].every((value) => value !== null && Number.isFinite(value));
}

export function calculateProductNutrition(
  product: Product,
  ingredients: Ingredient[],
  recipeItems: RecipeItem[],
  products: Product[] = [],
): ProductNutritionSummary {
  const productItems = getProductRecipeItems(recipeItems, product.id);
  const totalNutrition = productItems.reduce((sum, item) => {
    if (item.itemType === "intermediate") {
      const intermediate = products.find((candidate) => candidate.id === item.intermediateProductId);
      if (!intermediate) return sum;
      const intermediateNutrition = calculateProductNutrition(intermediate, ingredients, recipeItems, products).totalNutrition;
      const basisWeight = getIntermediateBasisWeight(intermediate, ingredients, recipeItems, new Set([product.id]));
      return addNutrition(sum, multiplyNutrition(divideNutrition(intermediateNutrition, basisWeight), recipeItemAmountGram(item)));
    }
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
    if (!ingredient || isPackagingIngredient(ingredient)) return sum;
    return addNutrition(sum, nutritionForAmount(ingredient, amountToGram(ingredient, recipeItemAmountGram(item))));
  }, zeroNutrition);
  const basisWeightGram = product.afterBakeWeightGram || totalRecipeWeightWithProducts(recipeItems, product.id, ingredients, products);
  const nutritionPerPiece = divideNutrition(totalNutrition, product.yieldCount);
  const nutritionPer100g = multiplyNutrition(divideNutrition(totalNutrition, basisWeightGram), 100);
  const missingNutritionIngredientIds = productItems
    .filter((item) => item.itemType !== "intermediate")
    .map((item) => ingredients.find((ingredient) => ingredient.id === item.ingredientId))
    .filter((ingredient): ingredient is Ingredient => Boolean(ingredient))
    .filter((ingredient) => !hasNutrition(ingredient))
    .map((ingredient) => ingredient.id);

  return {
    product,
    totalNutrition,
    nutritionPerPiece,
    nutritionPer100g,
    basisWeightGram,
    missingNutritionIngredientIds,
  };
}

export function calculatePriceImpact(
  data: AppData,
  ingredientId: string,
  newPrice: number,
): PriceImpactRow[] {
  const ingredient = data.ingredients.find((item) => item.id === ingredientId);
  if (!ingredient) return [];

  const newIngredients = data.ingredients.map((item) => (item.id === ingredientId ? { ...item, price: newPrice } : item));

  return data.products
    .map((product) => {
      const oldCost = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
      const newCost = calculateProductCost(product, newIngredients, data.recipeItems, data.products);
      const price = recommendedPrice(newCost.costPerPiece, product.targetCostRate);
      return {
        product,
        oldCost: oldCost.costPerPiece,
        newCost: newCost.costPerPiece,
        increase: newCost.costPerPiece - oldCost.costPerPiece,
        oldCostRate: oldCost.costRate,
        newCostRate: newCost.costRate,
        costRateIncreasePoint: newCost.costRate - oldCost.costRate,
        recommendedPrice: price,
        priceCandidates: roundedPriceCandidates(newCost.costPerPiece, product.targetCostRate),
        needsPriceReview: newCost.costRate >= product.targetCostRate || newCost.costRate >= 35,
      };
    })
    .filter((row) => Math.abs(row.increase) > 0.0001)
    .sort((a, b) => b.increase - a.increase);
}

export function collectAllergens(productId: string, ingredients: Ingredient[], recipeItems: RecipeItem[], products: Product[] = []): string[] {
  const allergens = getProductRecipeItems(recipeItems, productId).flatMap((item) => {
    if (item.itemType === "intermediate") {
      const intermediate = products.find((product) => product.id === item.intermediateProductId);
      return intermediate ? collectAllergens(intermediate.id, ingredients, recipeItems, products) : [];
    }
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
    return ingredient ? [...ingredient.allergens, ingredient.otherAllergen].filter(Boolean) : [];
  });
  return [...new Set(allergens)].sort();
}

export function collectLabelNames(productId: string, ingredients: Ingredient[], recipeItems: RecipeItem[], products: Product[] = []): string[] {
  return getProductRecipeItems(recipeItems, productId)
    .flatMap((item) => {
      if (item.itemType === "intermediate") {
        const intermediate = products.find((product) => product.id === item.intermediateProductId);
        return intermediate ? collectLabelNames(intermediate.id, ingredients, recipeItems, products) : [];
      }
      const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
      return ingredient ? [ingredient.labelName || ingredient.name] : [];
    })
    .filter(Boolean);
}
