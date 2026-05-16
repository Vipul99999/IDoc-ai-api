import { promises as fs } from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { extractReadableText } from "@/lib/pipeline/text";
import { runOcr } from "@/lib/pipeline/ocr";
import { getDocument, saveDocument } from "@/lib/storage/db";
import { readOriginalObject } from "@/lib/storage/object-store";
import { requireV1Auth, recordUsage, saveV1Job, v1Error, v1Response } from "@/lib/v1";

const schema = z.object({ document_id: z.string().uuid() });

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["jobs:write", "ocr:write"]);
  if (!principal) return response;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return v1Error(request, principal.tenantId, 400, "invalid_request", "document_id is required.", body.error.flatten());
  const document = await getDocument(body.data.document_id);
  if (!document) return v1Error(request, principal.tenantId, 404, "document_not_found", "Document not found.");

  const now = new Date().toISOString();
  const buffer = document.storagePath.startsWith("minio://") ? await readOriginalObject(document.storagePath) : await fs.readFile(document.storagePath);
  const extractedText = extractReadableText(buffer, document.originalName);
  const ocr = await runOcr(document, extractedText, buffer);
  const updated = {
    ...document,
    status: "ready" as const,
    ocr,
    updatedAt: new Date().toISOString(),
    auditLog: [...document.auditLog, { id: uuidv4(), type: "ocr.completed", message: "OCR regenerated through the v1 API.", createdAt: now }]
  };
  await saveDocument(updated);
  const job = await saveV1Job({
    id: uuidv4(),
    tenantId: principal.tenantId,
    documentId: document.id,
    type: "ocr",
    status: "succeeded",
    progress: 100,
    resultId: document.id,
    payload: {},
    createdAt: now,
    updatedAt: new Date().toISOString()
  });
  await recordUsage(principal, "ocr_page", document.pageCount, { job_type: "ocr" }, document.id);
  return v1Response(request, principal.tenantId, { job }, 202);
}
