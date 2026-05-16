import amqp from "amqplib";
import { RABBITMQ_URL } from "@/lib/config";

export type QueueJob = {
  id: string;
  type: "document.full_pipeline" | "document.ocr" | "document.translate" | "document.reformat";
  documentId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  attempts?: number;
  maxAttempts?: number;
  createdAt: string;
  updatedAt: string;
};

const localJobs = new Map<string, QueueJob>();

export class QueueUnavailableError extends Error {
  constructor() {
    super("Background queue is unavailable. Configure RABBITMQ_URL in production, or enable local background processing for development.");
  }
}

export function isRabbitEnabled() {
  return Boolean(RABBITMQ_URL);
}

export function queueMode() {
  if (RABBITMQ_URL) return "rabbitmq";
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_BACKGROUND_QUEUE === "true") return "local-background";
  return "unavailable";
}

export function canAcceptBackgroundJobs() {
  return queueMode() !== "unavailable";
}

export async function enqueueJob(job: QueueJob) {
  if (!canAcceptBackgroundJobs()) throw new QueueUnavailableError();
  localJobs.set(job.id, job);
  if (!RABBITMQ_URL) {
    scheduleLocalBackgroundJob(job);
    return job;
  }
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue("document-jobs", { durable: true });
  channel.sendToQueue("document-jobs", Buffer.from(JSON.stringify(job)), { persistent: true });
  await channel.close();
  await connection.close();
  return job;
}

export function updateLocalJob(id: string, patch: Partial<QueueJob>) {
  const current = localJobs.get(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  localJobs.set(id, next);
  return next;
}

export function listLocalJobs() {
  return [...localJobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function scheduleLocalBackgroundJob(job: QueueJob) {
  setTimeout(() => {
    processLocalBackgroundJob(job).catch((error) => {
      updateLocalJob(job.id, {
        status: "failed",
        progress: 100,
        message: error instanceof Error ? error.message : "Local background processing failed."
      });
    });
  }, 25);
}

async function processLocalBackgroundJob(job: QueueJob) {
  if (job.type !== "document.full_pipeline" && job.type !== "document.ocr") return;
  updateLocalJob(job.id, { status: "running", progress: 20, message: "Local background worker started processing." });
  const [{ getDocument, saveDocument }, { readOriginalObject }, { runFullPipeline }] = await Promise.all([
    import("@/lib/storage/db"),
    import("@/lib/storage/object-store"),
    import("@/lib/pipeline/analyze")
  ]);
  const document = await getDocument(job.documentId);
  if (!document) throw new Error("Document not found for background job.");
  const buffer = await readOriginalObject(document.storagePath);
  updateLocalJob(job.id, { progress: 55, message: "Running document intelligence pipeline." });
  const processed = await runFullPipeline({ ...document, status: "analyzing" }, buffer);
  await saveDocument(processed);
  updateLocalJob(job.id, { status: "succeeded", progress: 100, message: "Background processing completed." });
}
