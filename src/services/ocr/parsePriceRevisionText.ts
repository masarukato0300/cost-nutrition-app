export type ParsedPriceRevisionItem = {
  rawText: string;
  rawIngredientName: string;
  rawPackageName: string;
  parsedOldPrice: number | null;
  parsedNewPrice: number | null;
};

export function normalizeOcrText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/グラム/g, "g")
    .replace(/キロ/g, "kg")
    .replace(/リットル/g, "L")
    .replace(/パーセント/g, "%");
}

export function parsePriceRevisionText(text: string): ParsedPriceRevisionItem[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const prices = [...line.matchAll(/(\d[\d,]*)\s*円/g)].map((match) => Number(match[1].replace(/,/g, "")));
      const name = line.replace(/(\d[\d,]*)\s*円.*$/, "").trim();
      return {
        rawText: line,
        rawIngredientName: name,
        rawPackageName: name,
        parsedOldPrice: prices.length >= 2 ? prices[0] : null,
        parsedNewPrice: prices.length >= 2 ? prices[1] : prices[0] ?? null,
      };
    })
    .filter((item) => item.parsedNewPrice !== null);
}
