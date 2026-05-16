import { listDocuments } from "@/lib/storage/db";

function distance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const nextDiagonal = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = nextDiagonal;
    }
  }
  return previous[b.length];
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function runOcrBenchmark(groundTruth: Record<string, string> = {}) {
  const documents = await listDocuments();
  const candidates = documents.filter((document) => document.mimeType.includes("pdf") || document.mimeType.startsWith("image/"));
  const rows = candidates.map((document) => {
    const extracted = normalizeText(document.ocr?.extractedText ?? "");
    const expected = normalizeText(groundTruth[document.id] ?? "");
    const cer = expected ? distance(extracted, expected) / Math.max(expected.length, 1) : null;
    const blocks = document.ocr?.blocks ?? [];
    const avgConfidence = blocks.reduce((total, block) => total + block.confidence, 0) / Math.max(blocks.length, 1);
    return {
      documentId: document.id,
      filename: document.originalName,
      status: document.status,
      charactersExtracted: extracted.length,
      blocks: blocks.length,
      averageConfidence: Number(avgConfidence.toFixed(2)),
      characterErrorRate: cer === null ? null : Number(cer.toFixed(4)),
      searchablePdfGenerated: Boolean(document.ocr?.searchablePdfPath)
    };
  });

  const measured = rows.filter((row) => row.characterErrorRate !== null);
  return {
    datasetSize: candidates.length,
    measuredWithGroundTruth: measured.length,
    averageConfidence: Number((rows.reduce((total, row) => total + row.averageConfidence, 0) / Math.max(rows.length, 1)).toFixed(2)),
    averageCharacterErrorRate: measured.length
      ? Number((measured.reduce((total, row) => total + (row.characterErrorRate ?? 0), 0) / measured.length).toFixed(4))
      : null,
    rows,
    recommendations: [
      "Use 300 DPI scanned PDFs for production OCR evaluation.",
      "Maintain a golden dataset for invoices, handwritten notes, contracts, certificates, and thesis pages.",
      "Track character error rate, word error rate, confidence, and searchable PDF generation success before each release."
    ]
  };
}
