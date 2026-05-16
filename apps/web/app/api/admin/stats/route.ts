import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  const totalPages = documents.reduce((sum, document) => sum + document.pageCount, 0);
  const averageQuality =
    documents.length === 0
      ? 0
      : Math.round(documents.reduce((sum, document) => sum + (document.analysis?.qualityScore ?? 0), 0) / documents.length);
  const byType = documents.reduce<Record<string, number>>((acc, document) => {
    const type = document.analysis?.documentType ?? "unknown";
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  return json({
    stats: {
      documents: documents.length,
      totalPages,
      averageQuality,
      searchableDocuments: documents.filter((document) => document.ocr?.extractedText).length,
      translatedDocuments: documents.filter((document) => document.translations.length > 0).length,
      reformattedDocuments: documents.filter((document) => document.reformats.length > 0).length,
      byType
    }
  });
}
