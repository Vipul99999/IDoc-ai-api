import { json } from "@/lib/http";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { averageOcrConfidence } from "@/lib/pipeline/accuracy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;

  const metadata = document.analysis?.extractedMetadata ?? {};
  const ocrConfidence = averageOcrConfidence(document.ocr?.blocks ?? []);
  return json({
    accuracy: {
      documentId: document.id,
      status: document.status,
      pipelineVersion: metadata.pipelineVersion ?? "pending",
      textSource: metadata.textSource ?? "pending",
      ocrConfidence,
      textCoverageScore: Number(metadata.textCoverageScore ?? 0),
      classificationConfidence: Number(metadata.classificationConfidence ?? 0),
      pipelineReliabilityScore: Number(metadata.pipelineReliabilityScore ?? 0),
      extractionConfidence: document.extraction?.confidence ?? 0,
      qualityScore: document.analysis?.qualityScore ?? 0,
      readinessScore: document.validation?.readinessScore ?? 0,
      blockers: document.validation?.checks.filter((check) => check.status === "fail") ?? []
    }
  });
}
