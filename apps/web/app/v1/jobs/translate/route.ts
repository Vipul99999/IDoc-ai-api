import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { canAcceptBackgroundJobs, enqueueJob } from "@/lib/queue/jobs";
import { getDocumentForTenant } from "@/lib/storage/db";
import { requireV1Auth, recordUsage, saveV1Job, v1Error, v1Response } from "@/lib/v1";

const schema = z.object({
  document_id: z.string().uuid(),
  target_language: z.string().min(2).max(8).default("hi"),
  source_language: z.string().min(2).max(8).optional(),
  preserve_layout: z.boolean().default(true),
  glossary: z.record(z.string()).default({})
});

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["jobs:write", "translation:write"]);
  if (!principal) return response;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return v1Error(request, principal.tenantId, 400, "invalid_request", "Invalid translation request.", body.error.flatten());
  const document = await getDocumentForTenant(body.data.document_id, principal.tenantId);
  if (!document) return v1Error(request, principal.tenantId, 404, "document_not_found", "Document not found.");
  if (!canAcceptBackgroundJobs()) return v1Error(request, principal.tenantId, 503, "queue_unavailable", "Background processing is not available.");

  const now = new Date().toISOString();
  const payload = {
    targetLanguage: body.data.target_language,
    sourceLanguage: body.data.source_language,
    preserveLayout: body.data.preserve_layout,
    glossary: body.data.glossary
  };
  const queueJob = await enqueueJob({
    id: uuidv4(),
    type: "document.translate",
    documentId: document.id,
    status: "queued",
    progress: 5,
    message: "Queued for asynchronous translation.",
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
    type: "translate",
    status: "queued",
    progress: 5,
    resultId: document.id,
    payload,
    createdAt: now,
    updatedAt: now
  });
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/jobs/translate", method: "POST" }, document.id);
  return v1Response(request, principal.tenantId, { job }, 202);
}
