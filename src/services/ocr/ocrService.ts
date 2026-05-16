export type OcrServiceResult = {
  rawText: string;
};

export async function readPriceRevisionDocumentMock(rawText: string): Promise<OcrServiceResult> {
  return { rawText };
}
