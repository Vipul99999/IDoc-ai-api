import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { canAcceptBackgroundJobs, enqueueJob } from "@/lib/queue/jobs";
import { getDocumentForTenant } from "@/lib/storage/db";
import { checkQuota, requireV1Auth, recordUsage, saveV1Job, v1Error, v1Response } from "@/lib/v1";

const schema = z.object({
  document_id: z.string().uuid(),
  format: z.enum(["pdf", "docx", "pptx"]).default("pdf")
});

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["jobs:write", "formatting:write"]);
  if (!principal) return response;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return v1Error(request, principal.tenantId, 400, "invalid_request", "Invalid reformat request.", body.error.flatten());
  const document = await getDocumentForTenant(body.data.document_id, principal.tenantId);
  if (!document) return v1Error(request, principal.tenantId, 404, "document_not_found", "Document not found.");
  if (!canAcceptBackgroundJobs()) return v1Error(request, principal.tenantId, 503, "queue_unavailable", "Background processing is not available.");
  const quota = await checkQuota(principal, "page_processed", document.pageCount);
  if (!quota.ok) return v1Error(request, principal.tenantId, 429, "quota_exceeded", "Monthly page quota exceeded.", quota);

  const now = new Date().toISOString();
  const payload = { format: body.data.format };
  const queueJob = await enqueueJob({
    id: uuidv4(),
    type: "document.reformat",
    documentId: document.id,
    status: "queued",
    progress: 5,
    message: "Queued for asynchronous layout cleanup.",
    attempts: 0,
    maxAttempts: 3,
    payload,
    createdAt: now,
    updatedAt: now
  });
  const job = await saveV1Job({
    id: queueJob.id,
    tenantId: principal.tenantId,
    documentId: document.id,
    type: "reformat",
    status: "queued",
    progress: 5,
    resultId: document.id,
    payload,
    createdAt: now,
    updatedAt: now
  });
  await recordUsage(principal, "page_processed", document.pageCount, { job_type: "reformat", format: body.data.format }, document.id);
  return v1Response(request, principal.tenantId, { job }, 202);
}
