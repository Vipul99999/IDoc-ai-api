import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { canAcceptBackgroundJobs, enqueueJob } from "@/lib/queue/jobs";
import { getDocument } from "@/lib/storage/db";
import { requireV1Auth, recordUsage, saveV1Job, v1Error, v1Response } from "@/lib/v1";

const schema = z.object({ document_id: z.string().uuid() });

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["jobs:write"]);
  if (!principal) return response;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return v1Error(request, principal.tenantId, 400, "invalid_request", "document_id is required.", body.error.flatten());
  const document = await getDocument(body.data.document_id);
  if (!document) return v1Error(request, principal.tenantId, 404, "document_not_found", "Document not found.");
  if (!canAcceptBackgroundJobs()) return v1Error(request, principal.tenantId, 503, "queue_unavailable", "Background processing is not available.");

  const now = new Date().toISOString();
  const queueJob = await enqueueJob({
    id: uuidv4(),
    type: "document.full_pipeline",
    documentId: document.id,
    status: "queued",
    progress: 5,
    message: "Queued for quality, classification, OCR, recommendations, extraction, and search indexing.",
    attempts: 0,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now
  });
  const job = await saveV1Job({
    id: queueJob.id,
    tenantId: principal.tenantId,
    documentId: document.id,
    type: "analyze",
    status: "queued",
    progress: 5,
    resultId: document.id,
    payload: {},
    createdAt: now,
    updatedAt: now
  });
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/jobs/analyze", method: "POST" }, document.id);
  await recordUsage(principal, "page_processed", document.pageCount, { job_type: "analyze" }, document.id);
  return v1Response(request, principal.tenantId, { job }, 202);
}
