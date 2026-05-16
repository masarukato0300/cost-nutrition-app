export type TaxType = "税込" | "税抜";
export type DisplayUnit = "1個あたり" | "100gあたり" | "1袋あたり" | "1本あたり" | "1台あたり";
export type MaterialType = "PURCHASED_INGREDIENT" | "INTERMEDIATE" | "PRODUCT" | "PACKAGING";
export type RecipeUsageType = "gram" | "count" | "fraction";
export type RecipeItemType = "ingredient" | "intermediate";
export type ProductStatus = "販売中" | "休止中";
export type PriceHistorySourceType = "manual" | "ocr" | "csv";
export type WasteItemType = "PRODUCT" | "INGREDIENT" | "INTERMEDIATE";
export type WasteReason = "売れ残り" | "破損" | "作りすぎ" | "試作" | "品質不良" | "その他";

export type Nutrition = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  salt: number;
};

export type Ingredient = {
  id: string;
  name: string;
  type: MaterialType;
  category: string;
  supplier: string;
  packageName: string;
  packageAmountGram: number;
  packageUnit: string;
  gramPerUnit: number;
  price: number;
  taxType: TaxType;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  saltPer100g: number | null;
  allergens: string[];
  otherAllergen: string;
  labelName: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  isIntermediateMaterial: boolean;
  category: string;
  sellingPrice: number;
  taxType: TaxType;
  targetCostRate: number;
  displayUnit: DisplayUnit;
  yieldCount: number;
  beforeBakeWeightGram: number;
  afterBakeWeightGram: number | null;
  weightPerPieceGram: number;
  status: ProductStatus;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type RecipeItem = {
  id: string;
  productId: string;
  ingredientId: string;
  itemType: RecipeItemType;
  intermediateProductId: string;
  usageType: RecipeUsageType;
  amountGram: number;
  baseAmountGram: number;
  usedCount: number;
  totalCount: number;
  fractionDenominator: number;
  lossRate: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type PriceHistory = {
  id: string;
  ingredientId: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  supplier: string;
  reason: string;
  sourceType: PriceHistorySourceType;
  memo: string;
};

export type IngredientAlias = {
  id: string;
  sourceText: string;
  normalizedSourceText: string;
  name: string;
  packageName: string;
  supplier: string;
  category: string;
  labelName: string;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  saltPer100g: number | null;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  ingredients: Ingredient[];
  products: Product[];
  recipeItems: RecipeItem[];
  priceHistories: PriceHistory[];
  ingredientAliases: IngredientAlias[];
  wasteRecords: WasteRecord[];
  salesRecords: SalesRecord[];
  actualCostRecords: ActualCostRecord[];
  eventPlans: EventPlan[];
  eventPlanItems: EventPlanItem[];
  laborCosts: LaborCost[];
  setProductItems: SetProductItem[];
};

export type ProductCostSummary = {
  product: Product;
  materialTotalCost: number;
  packagingTotalCost: number;
  totalCost: number;
  materialCostPerPiece: number;
  packagingCostPerPiece: number;
  costPerPiece: number;
  materialCostRate: number;
  packagingCostRate: number;
  costRate: number;
  totalRecipeWeightGram: number;
};

export type ProductNutritionSummary = {
  product: Product;
  totalNutrition: Nutrition;
  nutritionPerPiece: Nutrition;
  nutritionPer100g: Nutrition;
  basisWeightGram: number;
  missingNutritionIngredientIds: string[];
};

export type PriceImpactRow = {
  product: Product;
  oldCost: number;
  newCost: number;
  increase: number;
  oldCostRate: number;
  newCostRate: number;
  costRateIncreasePoint: number;
  recommendedPrice: number;
  priceCandidates: Array<{ unit: number; price: number; costRate: number }>;
  needsPriceReview: boolean;
};

export type ProductionPlanInput = {
  productId: string;
  quantity: number;
};

export type RequirementRow = {
  ingredient: Ingredient;
  requiredAmount: number;
  unit: string;
  cost: number;
  supplier: string;
  isPackaging: boolean;
};

export type WasteRecord = {
  id: string;
  date: string;
  itemType: WasteItemType;
  itemId: string;
  quantity: number;
  costAmount: number;
  salesEquivalentAmount: number;
  reason: WasteReason;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type WasteSummary = {
  totalCostAmount: number;
  totalSalesEquivalentAmount: number;
  topRows: Array<{
    itemName: string;
    itemType: WasteItemType;
    quantity: number;
    costAmount: number;
    salesEquivalentAmount: number;
  }>;
};

export type WasteMonthlySummary = {
  month: string;
  totalCostAmount: number;
  totalSalesEquivalentAmount: number;
  recordCount: number;
  categoryRows: Array<{
    categoryName: string;
    quantity: number;
    costAmount: number;
    salesEquivalentAmount: number;
  }>;
  reasonRows: Array<{
    reason: WasteReason;
    quantity: number;
    costAmount: number;
    salesEquivalentAmount: number;
  }>;
  itemRows: Array<{
    itemName: string;
    itemType: WasteItemType;
    categoryName: string;
    quantity: number;
    costAmount: number;
    salesEquivalentAmount: number;
  }>;
};

export type SalesRecord = {
  id: string;
  month: string;
  productId: string;
  quantity: number;
  sellingPrice: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type ActualCostRecord = {
  id: string;
  month: string;
  supplier: string;
  amount: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyTheoryRow = {
  product: Product;
  quantity: number;
  salesAmount: number;
  theoryCostAmount: number;
  grossProfit: number;
  theoryCostRate: number;
};

export type MonthlyTheorySummary = {
  month: string;
  rows: MonthlyTheoryRow[];
  totalSalesAmount: number;
  totalTheoryCostAmount: number;
  totalGrossProfit: number;
  theoryCostRate: number;
  actualCostAmount: number;
  differenceAmount: number;
};

export type EventPlan = {
  id: string;
  name: string;
  date: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type EventPlanItem = {
  id: string;
  eventPlanId: string;
  productId: string;
  plannedQuantity: number;
  sellingPrice: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type EventSimulationRow = {
  product: Product;
  plannedQuantity: number;
  sellingPrice: number;
  salesAmount: number;
  currentUnitCost: number;
  simulatedUnitCost: number;
  currentGrossProfit: number;
  simulatedGrossProfit: number;
  profitDecrease: number;
};

export type EventSimulationSummary = {
  eventPlan: EventPlan | null;
  rows: EventSimulationRow[];
  totalSalesAmount: number;
  totalCurrentCost: number;
  totalSimulatedCost: number;
  totalCurrentGrossProfit: number;
  totalSimulatedGrossProfit: number;
  totalProfitDecrease: number;
};

export type LaborCost = {
  id: string;
  productId: string;
  processName: string;
  minutes: number;
  workers: number;
  hourlyWage: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductLaborCostSummary = {
  product: Product;
  laborRows: Array<LaborCost & { costAmount: number }>;
  materialAndPackagingCostPerPiece: number;
  laborTotalCost: number;
  laborCostPerPiece: number;
  effectiveCostPerPiece: number;
  laborCostRate: number;
  effectiveCostRate: number;
};

export type SetProductItem = {
  id: string;
  setProductId: string;
  childProductId: string;
  quantity: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type SetProductCostRow = {
  item: SetProductItem;
  childProduct: Product;
  unitCost: number;
  quantity: number;
  totalCost: number;
};

export type SetProductCostSummary = {
  setProduct: Product;
  childRows: SetProductCostRow[];
  childProductsCost: number;
  packagingCost: number;
  totalCost: number;
  sellingPrice: number;
  costRate: number;
  recommendedPrice: number;
};
