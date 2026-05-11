export type TaxType = "税込" | "税抜";
export type DisplayUnit = "1個あたり" | "100gあたり" | "1袋あたり" | "1本あたり";
export type RecipeUsageType = "gram" | "count" | "fraction";

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
  sellingPrice: number;
  taxType: TaxType;
  targetCostRate: number;
  displayUnit: DisplayUnit;
  yieldCount: number;
  beforeBakeWeightGram: number;
  afterBakeWeightGram: number | null;
  weightPerPieceGram: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type RecipeItem = {
  id: string;
  productId: string;
  ingredientId: string;
  usageType: RecipeUsageType;
  amountGram: number;
  baseAmountGram: number;
  usedCount: number;
  totalCount: number;
  fractionDenominator: number;
  createdAt: string;
  updatedAt: string;
};

export type PriceHistory = {
  id: string;
  ingredientId: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  memo: string;
};

export type AppData = {
  ingredients: Ingredient[];
  products: Product[];
  recipeItems: RecipeItem[];
  priceHistories: PriceHistory[];
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
};
