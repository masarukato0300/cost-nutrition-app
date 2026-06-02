import { calculateProductCost, calculateWasteSummary } from "./calculations";
import type { AppData, Product } from "./types";

export type ProductManagementMetric = {
  productId: string;
  name: string;
  category: string;
  sellingPrice: number;
  unitCost: number;
  targetCostRate: number;
  recommendedPrice: number;
  costRate: number;
  salesQuantity: number;
  salesAmount: number;
  grossProfit: number;
  grossProfitRate: number;
  wasteQuantity: number;
  wasteCostAmount: number;
  recommendationHint: "値上げ候補" | "伸ばす候補" | "廃棄注意" | "様子見";
};

export type ManagementDecisionSummary = {
  month: string;
  totalSalesAmount: number;
  totalGrossProfit: number;
  averageCostRate: number;
  wasteCostAmount: number;
  priceIncreaseCandidates: ProductManagementMetric[];
  growthCandidates: ProductManagementMetric[];
  wasteRiskProducts: ProductManagementMetric[];
  allRows: ProductManagementMetric[];
};

function productSales(data: AppData, product: Product, month: string) {
  const record = data.salesRecords.find((item) => item.month === month && item.productId === product.id);
  return {
    quantity: record?.quantity || 0,
    sellingPrice: record?.sellingPrice || product.sellingPrice || 0,
  };
}

function productWasteQuantity(data: AppData, product: Product, month: string) {
  return data.wasteRecords
    .filter((record) => record.itemType === "PRODUCT" && record.itemId === product.id && record.date.startsWith(month))
    .reduce((sum, record) => sum + record.quantity, 0);
}

function recommendationHint(row: Omit<ProductManagementMetric, "recommendationHint">): ProductManagementMetric["recommendationHint"] {
  if (row.costRate >= 38 && row.salesQuantity > 0) return "値上げ候補";
  if (row.grossProfit > 0 && row.costRate < 35 && row.salesQuantity > 0) return "伸ばす候補";
  if (row.wasteQuantity > 0 && row.salesQuantity <= row.wasteQuantity * 3) return "廃棄注意";
  return "様子見";
}

export function buildManagementDecisionSummary(data: AppData, month: string): ManagementDecisionSummary {
  const rows = data.products
    .filter((product) => !product.isIntermediateMaterial && product.status !== "休止中")
    .map((product) => {
      const cost = calculateProductCost(product, data.ingredients, data.recipeItems, data.products);
      const sales = productSales(data, product, month);
      const salesAmount = sales.quantity * sales.sellingPrice;
      const grossProfit = salesAmount - sales.quantity * cost.costPerPiece;
      const grossProfitRate = salesAmount ? (grossProfit / salesAmount) * 100 : 0;
      const recommendedPrice = product.targetCostRate > 0 ? cost.costPerPiece / (product.targetCostRate / 100) : 0;
      const wasteQuantity = productWasteQuantity(data, product, month);
      const rowWithoutHint = {
        productId: product.id,
        name: product.name,
        category: product.category,
        sellingPrice: sales.sellingPrice,
        unitCost: cost.costPerPiece,
        targetCostRate: product.targetCostRate,
        recommendedPrice,
        costRate: cost.costRate,
        salesQuantity: sales.quantity,
        salesAmount,
        grossProfit,
        grossProfitRate,
        wasteQuantity,
        wasteCostAmount: wasteQuantity * cost.costPerPiece,
      };
      return {
        ...rowWithoutHint,
        recommendationHint: recommendationHint(rowWithoutHint),
      };
    });

  const totalSalesAmount = rows.reduce((sum, row) => sum + row.salesAmount, 0);
  const totalGrossProfit = rows.reduce((sum, row) => sum + row.grossProfit, 0);
  const totalCostAmount = totalSalesAmount - totalGrossProfit;
  const wasteSummary = calculateWasteSummary(data);

  return {
    month,
    totalSalesAmount,
    totalGrossProfit,
    averageCostRate: totalSalesAmount ? (totalCostAmount / totalSalesAmount) * 100 : 0,
    wasteCostAmount: wasteSummary.totalCostAmount,
    priceIncreaseCandidates: rows
      .filter((row) => row.recommendationHint === "値上げ候補")
      .sort((a, b) => b.costRate - a.costRate)
      .slice(0, 10),
    growthCandidates: rows
      .filter((row) => row.recommendationHint === "伸ばす候補")
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, 10),
    wasteRiskProducts: rows
      .filter((row) => row.recommendationHint === "廃棄注意")
      .sort((a, b) => b.wasteQuantity - a.wasteQuantity)
      .slice(0, 10),
    allRows: rows,
  };
}
