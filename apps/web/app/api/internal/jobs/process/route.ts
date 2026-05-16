import { v4 as uuidv4 } from "uuid";
import { badRequest, json } from "@/lib/http";
import { runFullPipeline } from "@/lib/pipeline/analyze";
import { getDocument, saveDocument } from "@/lib/storage/db";
import { readOriginalObject } from "@/lib/storage/object-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { documentId?: string };
  if (!body.documentId) return badRequest("documentId is required.");

  const document = await getDocument(body.documentId);
  if (!document) return json({ error: "Document not found" }, 404);

  const startedAt = new Date().toISOString();
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
    const processed = await runFullPipeline(document, buffer);
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
    return json({ error: "Processing failed" }, 500);
  }
}
