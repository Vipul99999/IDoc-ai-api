import amqp from "amqplib";
import crypto from "node:crypto";
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
  payload?: Record<string, unknown>;
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
  if (!["document.full_pipeline", "document.ocr", "document.translate", "document.reformat"].includes(job.type)) return;
  updateLocalJob(job.id, { status: "running", progress: 20, message: "Local background worker started processing." });
  const [{ getDocument, saveDocument }, { readOriginalObject }, { runFullPipeline }] = await Promise.all([
    import("@/lib/storage/db"),
    import("@/lib/storage/object-store"),
    import("@/lib/pipeline/analyze")
  ]);
  const document = await getDocument(job.documentId);
  if (!document) throw new Error("Document not found for background job.");
  const buffer = await readOriginalObject(document.storagePath);
  if (job.type === "document.full_pipeline") {
    updateLocalJob(job.id, { progress: 55, message: "Running document intelligence pipeline." });
    const processed = await runFullPipeline({ ...document, status: "analyzing" }, buffer);
    await saveDocument(processed);
  } else if (job.type === "document.ocr") {
    const [{ extractReadableText }, { runOcr }] = await Promise.all([import("@/lib/pipeline/text"), import("@/lib/pipeline/ocr")]);
    updateLocalJob(job.id, { progress: 55, message: "Running OCR extraction." });
    const extractedText = extractReadableText(buffer, document.originalName);
    const ocr = await runOcr(document, extractedText, buffer);
    await saveDocument({ ...document, status: "ready", ocr, updatedAt: new Date().toISOString() });
  } else if (job.type === "document.translate") {
    const [{ translateDocumentAdvanced }, { writeOutput }] = await Promise.all([import("@/lib/pipeline/translate"), import("@/lib/storage/fs")]);
    const targetLanguage = typeof job.payload?.targetLanguage === "string" ? job.payload.targetLanguage : "hi";
    updateLocalJob(job.id, { progress: 55, message: "Running translation." });
    const translation = await translateDocumentAdvanced(document, {
      targetLanguage,
      sourceLanguage: typeof job.payload?.sourceLanguage === "string" ? job.payload.sourceLanguage : undefined,
      preserveLayout: job.payload?.preserveLayout !== false,
      glossary: typeof job.payload?.glossary === "object" && job.payload.glossary ? (job.payload.glossary as Record<string, string>) : {}
    });
    const outputPath = await writeOutput(document.id, `translation-${targetLanguage}.txt`, translation.translatedText);
    await saveDocument({
      ...document,
      status: "translated",
      translations: [
        {
          id: translation.id,
          sourceLanguage: translation.sourceLanguage,
          targetLanguage,
          translatedText: translation.translatedText,
          outputPath,
          engine: translation.engine,
          qualityScore: translation.qualityScore,
          warnings: translation.warnings,
          createdAt: new Date().toISOString()
        },
        ...document.translations
      ],
      updatedAt: new Date().toISOString()
    });
  } else if (job.type === "document.reformat") {
    const [{ buildFormattedText, layoutQuality }, { writeOutput }] = await Promise.all([import("@/lib/pipeline/format"), import("@/lib/storage/fs")]);
    const format = job.payload?.format === "docx" || job.payload?.format === "pptx" ? job.payload.format : "pdf";
    const sourceText = document.ocr?.extractedText ?? document.analysis?.summary ?? "";
    const quality = layoutQuality(document, sourceText);
    const outputPath = await writeOutput(document.id, `reformatted.${format}.txt`, buildFormattedText(document, sourceText));
    await saveDocument({
      ...document,
      status: "reformatted",
      reformats: [{ id: crypto.randomUUID(), format, outputPath, layoutQualityScore: quality.score, notes: quality.notes, createdAt: new Date().toISOString() }, ...document.reformats],
      updatedAt: new Date().toISOString()
    });
  }
  updateLocalJob(job.id, { status: "succeeded", progress: 100, message: "Background processing completed." });
}
