import { v4 as uuidv4 } from "uuid";
import { badRequest, json } from "@/lib/http";
import { buildFormattedText, layoutQuality } from "@/lib/pipeline/format";
import { runFullPipeline } from "@/lib/pipeline/analyze";
import { runOcr } from "@/lib/pipeline/ocr";
import { extractReadableText } from "@/lib/pipeline/text";
import { translateDocumentAdvanced } from "@/lib/pipeline/translate";
import { getDocument, saveDocument } from "@/lib/storage/db";
import { writeOutput } from "@/lib/storage/fs";
import { readOriginalObject } from "@/lib/storage/object-store";
import { updateV1Job } from "@/lib/v1";
import { enqueueWebhookEvent } from "@/lib/webhooks";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { documentId?: string; jobId?: string; jobType?: string; payload?: Record<string, unknown> };
  if (!body.documentId) return badRequest("documentId is required.");

  const document = await getDocument(body.documentId);
  if (!document) return json({ error: "Document not found" }, 404);

  const startedAt = new Date().toISOString();
  if (body.jobId) await updateV1Job(body.jobId, { status: "running", progress: 20 });
  await saveDocument({
    ...document,
    status: "analyzing",
    updatedAt: startedAt,
    auditLog: [
      ...document.auditLog,
      {
        id: uuidv4(),
        type: "document.processing_started",
        message: "Background worker started the full document intelligence pipeline.",
        createdAt: startedAt
      }
    ]
  });

  try {
    const buffer = await readOriginalObject(document.storagePath);
    const jobType = body.jobType ?? "document.full_pipeline";
    let processed = document;
    if (jobType === "document.ocr") {
      const extractedText = extractReadableText(buffer, document.originalName);
      const ocr = await runOcr(document, extractedText, buffer);
      processed = { ...document, status: "ready", ocr, updatedAt: new Date().toISOString() };
    } else if (jobType === "document.translate") {
      const targetLanguage = typeof body.payload?.targetLanguage === "string" ? body.payload.targetLanguage : "hi";
      const translation = await translateDocumentAdvanced(document, {
        targetLanguage,
        sourceLanguage: typeof body.payload?.sourceLanguage === "string" ? body.payload.sourceLanguage : undefined,
        preserveLayout: body.payload?.preserveLayout !== false,
        glossary: typeof body.payload?.glossary === "object" && body.payload.glossary ? (body.payload.glossary as Record<string, string>) : {}
      });
      const outputPath = await writeOutput(document.id, `translation-${targetLanguage}.txt`, translation.translatedText);
      processed = {
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
      };
    } else if (jobType === "document.reformat") {
      const format = body.payload?.format === "docx" || body.payload?.format === "pptx" ? body.payload.format : "pdf";
      const sourceText = document.ocr?.extractedText ?? document.analysis?.summary ?? "";
      const quality = layoutQuality(document, sourceText);
      const outputPath = await writeOutput(document.id, `reformatted.${format}.txt`, buildFormattedText(document, sourceText));
      processed = {
        ...document,
        status: "reformatted",
        reformats: [{ id: uuidv4(), format, outputPath, layoutQualityScore: quality.score, notes: quality.notes, createdAt: new Date().toISOString() }, ...document.reformats],
        updatedAt: new Date().toISOString()
      };
    } else {
      processed = await runFullPipeline(document, buffer);
    }
    const finished = {
      ...processed,
      auditLog: [
        ...processed.auditLog,
        {
          id: uuidv4(),
          type: "document.processing_completed",
          message: "Background worker completed analysis, OCR, recommendations, search embedding, extraction, compliance, and validation.",
          createdAt: new Date().toISOString()
        }
      ]
    };
    await saveDocument(finished);
    if (body.jobId) await updateV1Job(body.jobId, { status: "succeeded", progress: 100, resultId: finished.id });
    await enqueueWebhookEvent({
      organizationId: finished.organizationId ?? "00000000-0000-0000-0000-000000000001",
      eventType: "job.completed",
      resourceType: "job",
      resourceId: body.jobId,
      payload: { job_id: body.jobId, document_id: finished.id, status: "succeeded", job_type: body.jobType ?? "document.full_pipeline" }
    });
    return json({ document: finished });
  } catch (error) {
    const failedAt = new Date().toISOString();
    await saveDocument({
      ...document,
      status: "failed",
      updatedAt: failedAt,
      auditLog: [
        ...document.auditLog,
        {
          id: uuidv4(),
          type: "document.processing_failed",
          message: error instanceof Error ? error.message : "Background processing failed.",
          createdAt: failedAt
        }
      ]
    });
    if (body.jobId) {
      await updateV1Job(body.jobId, {
        status: "failed",
        progress: 100,
        error: error instanceof Error ? error.message : "Background processing failed."
      });
    }
    await enqueueWebhookEvent({
      organizationId: document.organizationId ?? "00000000-0000-0000-0000-000000000001",
      eventType: "job.failed",
      resourceType: "job",
      resourceId: body.jobId,
      payload: {
        job_id: body.jobId,
        document_id: document.id,
        status: "failed",
        job_type: body.jobType ?? "document.full_pipeline",
        error: error instanceof Error ? error.message : "Background processing failed."
      }
    });
    return json({ error: "Processing failed" }, 500);
  }
}
