import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { buildFormattedText, layoutQuality } from "@/lib/pipeline/format";
import { getDocument, saveDocument } from "@/lib/storage/db";
import { writeOutput } from "@/lib/storage/fs";
import { requireV1Auth, recordUsage, saveV1Job, v1Error, v1Response } from "@/lib/v1";

const schema = z.object({
  document_id: z.string().uuid(),
  format: z.enum(["pdf", "docx", "pptx"]).default("pdf")
});

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["jobs:write", "formatting:write"]);
  if (!principal) return response;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return v1Error(request, principal.tenantId, 400, "invalid_request", "Invalid reformat request.", body.error.flatten());
  const document = await getDocument(body.data.document_id);
  if (!document) return v1Error(request, principal.tenantId, 404, "document_not_found", "Document not found.");

  const now = new Date().toISOString();
  const sourceText = document.ocr?.extractedText ?? document.analysis?.summary ?? "";
  const quality = layoutQuality(document, sourceText);
  const outputPath = await writeOutput(document.id, `reformatted.${body.data.format}.txt`, buildFormattedText(document, sourceText));
  const record = {
    id: uuidv4(),
    format: body.data.format,
    outputPath,
    layoutQualityScore: quality.score,
    notes: quality.notes,
    createdAt: now
  };
  await saveDocument({
    ...document,
    status: "reformatted",
    reformats: [record, ...document.reformats],
    updatedAt: new Date().toISOString(),
    auditLog: [...document.auditLog, { id: uuidv4(), type: "formatting.completed", message: "Generated layout cleanup output through the v1 API.", createdAt: now }]
  });
  const job = await saveV1Job({
    id: uuidv4(),
    tenantId: principal.tenantId,
    documentId: document.id,
    type: "reformat",
    status: "succeeded",
    progress: 100,
    resultId: document.id,
    payload: { format: body.data.format },
    createdAt: now,
    updatedAt: new Date().toISOString()
  });
  await recordUsage(principal, "page_processed", document.pageCount, { job_type: "reformat", format: body.data.format }, document.id);
  return v1Response(request, principal.tenantId, { job }, 202);
}
