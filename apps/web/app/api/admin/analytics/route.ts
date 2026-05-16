import { listDocuments } from "@/lib/storage/db";
import { reviewTasksForDocument } from "@/lib/review";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  const tasks = documents.flatMap(reviewTasksForDocument);
  const revenuePotential = documents.reduce((sum, document) => {
    const colorMultiplier = document.metadata.colorPercentage > 20 ? 4 : 1.5;
    return sum + document.pageCount * colorMultiplier + (document.pageCount > 80 ? 320 : 40);
  }, 0);

  return json({
    analytics: {
      documents: documents.length,
      pages: documents.reduce((sum, document) => sum + document.pageCount, 0),
      averageQuality: documents.length ? Math.round(documents.reduce((sum, document) => sum + (document.analysis?.qualityScore ?? 0), 0) / documents.length) : 0,
      averageReadiness: documents.length ? Math.round(documents.reduce((sum, document) => sum + (document.validation?.readinessScore ?? 0), 0) / documents.length) : 0,
      highRiskDocuments: documents.filter((document) => (document.compliance?.riskScore ?? 0) >= 45).length,
      extractionAutomationReady: documents.filter((document) => (document.extraction?.confidence ?? 0) >= 0.75).length,
      openReviewTasks: tasks.length,
      revenuePotential: Math.round(revenuePotential),
      topDocumentTypes: documents.reduce<Record<string, number>>((acc, document) => {
        const type = document.analysis?.documentType ?? "unknown";
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
      }, {})
    }
  });
}
