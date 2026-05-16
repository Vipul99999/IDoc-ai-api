import { v4 as uuidv4 } from "uuid";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { canAcceptBackgroundJobs, enqueueJob } from "@/lib/queue/jobs";
import { saveDocument } from "@/lib/storage/db";
import { json, serviceUnavailable } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  if (!canAcceptBackgroundJobs()) {
    return serviceUnavailable("Background processing is not available. Configure RABBITMQ_URL before running analysis in production.");
  }

  const now = new Date().toISOString();
  const queued = {
    ...document,
    status: "analyzing" as const,
    updatedAt: now,
    auditLog: [
      ...document.auditLog,
      {
        id: uuidv4(),
        type: "document.analysis_queued",
        message: "Manual analysis request was queued for background processing.",
        createdAt: now
      }
    ]
  };
  await saveDocument(queued);
  await enqueueJob({
    id: uuidv4(),
    type: "document.full_pipeline",
    documentId: id,
    status: "queued",
    progress: 5,
    message: "Queued manual analysis for background processing.",
    attempts: 0,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now
  });
  return json({ document: queued, processing: "queued" }, 202);
}
