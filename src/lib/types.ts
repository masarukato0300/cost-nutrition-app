export type TaxType = "税込" | "税抜";
export type DisplayUnit = "1個あたり" | "100gあたり" | "1袋あたり" | "1本あたり" | "1台あたり";
export type MaterialType = "PURCHASED_INGREDIENT" | "INTERMEDIATE" | "PRODUCT" | "PACKAGING";
export type RecipeUsageType = "gram" | "count" | "fraction";
export type RecipeItemType = "ingredient" | "intermediate";
export type ProductStatus = "販売中" | "休止中";
export type PriceHistorySourceType = "manual" | "ocr" | "csv";

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
