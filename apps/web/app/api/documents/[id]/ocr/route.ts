import { promises as fs } from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { extractReadableText } from "@/lib/pipeline/text";
import { runOcr } from "@/lib/pipeline/ocr";
import { saveDocument } from "@/lib/storage/db";
import { readOriginalObject } from "@/lib/storage/object-store";
import { json } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const buffer = document.storagePath.startsWith("minio://") ? await readOriginalObject(document.storagePath) : await fs.readFile(document.storagePath);
  const extractedText = extractReadableText(buffer, document.originalName);
  const ocr = await runOcr(document, extractedText, buffer);
  const updated = {
    ...document,
    status: "ready" as const,
    ocr,
    updatedAt: new Date().toISOString(),
    auditLog: [
      ...document.auditLog,
      {
        id: uuidv4(),
        type: "ocr.completed",
        message: "OCR text layer and structured blocks regenerated.",
        createdAt: new Date().toISOString()
      }
    ]
  };
  await saveDocument(updated);
  return json({ ocr });
}
