import type { Ingredient } from "@/lib/types";
import { normalizeOcrText } from "./parsePriceRevisionText";

export function matchIngredientByOcrText(rawText: string, ingredients: Ingredient[]) {
  const normalizedRawText = normalizeOcrText(rawText);
  return ingredients
    .map((ingredient) => {
      const candidates = [ingredient.name, ingredient.packageName, ingredient.labelName, `${ingredient.supplier}${ingredient.packageName}`]
        .filter(Boolean)
        .map(normalizeOcrText);
      const score = candidates.reduce((best, candidate) => {
        if (!candidate) return best;
        if (normalizedRawText === candidate) return Math.max(best, 1);
        if (normalizedRawText.includes(candidate) || candidate.includes(normalizedRawText)) return Math.max(best, 0.75);
        return best;
      }, 0);
      return { ingredient, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0] ?? null;
}
