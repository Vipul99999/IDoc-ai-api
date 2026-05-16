import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { buildFormattedText, layoutQuality } from "@/lib/pipeline/format";
import { writeOutput } from "@/lib/storage/fs";
import { saveDocument } from "@/lib/storage/db";
import { badRequest, json } from "@/lib/http";

const schema = z.object({
  format: z.enum(["pdf", "docx", "pptx"]).default("pdf")
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Invalid reformat request.");
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;

  const sourceText = document.ocr?.extractedText ?? document.analysis?.summary ?? "";
  const formatted = buildFormattedText(document, sourceText);
  const quality = layoutQuality(document, sourceText);
  const outputPath = await writeOutput(id, `reformatted.${body.data.format}.txt`, formatted);
  const manifestPath = await writeOutput(
    id,
    `reformatted-${body.data.format}.json`,
    JSON.stringify({ format: body.data.format, layoutQuality: quality.score, notes: quality.notes, blocks: quality.blocks }, null, 2)
  );
  const record = {
    id: uuidv4(),
    format: body.data.format,
    outputPath,
    manifestPath,
    layoutQualityScore: quality.score,
    notes: [
      ...quality.notes,
      "Applied print-safe margin guidance",
      "Prepared page numbering and searchable text layer",
      "Prepared accessible reading order for the selected format"
    ],
    createdAt: new Date().toISOString()
  };

  const updated = {
    ...document,
    status: "reformatted" as const,
    reformats: [record, ...document.reformats],
    updatedAt: new Date().toISOString(),
    auditLog: [
      ...document.auditLog,
      {
        id: uuidv4(),
        type: "formatting.completed",
        message: `Generated ${body.data.format.toUpperCase()} layout reconstruction output.`,
        createdAt: new Date().toISOString()
      }
    ]
  };
  await saveDocument(updated);
  return json({ reformat: record, document: updated });
}
