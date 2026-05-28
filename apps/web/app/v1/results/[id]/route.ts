import { getDocumentForTenant } from "@/lib/storage/db";
import { findV1Job, requireV1Auth, recordUsage, v1Error, v1Response } from "@/lib/v1";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { principal, response } = await requireV1Auth(request, ["results:read"]);
  if (!principal) return response;
  const { id } = await context.params;
  const job = await findV1Job(id);
  if (job && job.tenantId !== principal.tenantId) return v1Error(request, principal.tenantId, 404, "result_not_found", "Result not found.");
  const document = await getDocumentForTenant(job?.resultId ?? id, principal.tenantId);
  if (!document) return v1Error(request, principal.tenantId, 404, "result_not_found", "Result not found.");
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/results/{id}", method: "GET" }, document.id);
  return v1Response(request, principal.tenantId, {
    result: {
      id: document.id,
      document_id: document.id,
      status: document.status,
      analysis: document.analysis ?? null,
      ocr: document.ocr ?? null,
      translations: document.translations,
      reformats: document.reformats,
      extraction: document.extraction,
      validation: document.validation,
      compliance: document.compliance,
      generated: document.generated
    }
  });
}
