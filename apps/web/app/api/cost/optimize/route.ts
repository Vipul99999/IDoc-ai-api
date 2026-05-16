import { estimateDocumentCost, estimatePortfolioCost } from "@/lib/cost";
import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  const portfolio = estimatePortfolioCost(documents);
  const documentOptimizations = documents
    .map((document) => ({
      id: document.id,
      filename: document.originalName,
      optimizations: estimateDocumentCost(document).optimizations
    }))
    .filter((item) => item.optimizations.length > 0);

  return json({
    profile: portfolio.recommendedProfile,
    possibleSavings: portfolio.possibleSavings,
    infrastructure: {
      currentRecommendation: "single VM with app, Postgres/pgvector, MinIO, RabbitMQ, optional OpenSearch",
      monthlyEstimateInr: portfolio.optimizedInfrastructureMonthly,
      deferUntilNeeded: ["GPU workers", "managed OpenSearch", "managed vector DB", "multi-node Kubernetes"]
    },
    documentOptimizations
  });
}
