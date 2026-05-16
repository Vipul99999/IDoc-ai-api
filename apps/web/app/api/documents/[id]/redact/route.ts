import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { redactText } from "@/lib/compliance";
import { writeOutput } from "@/lib/storage/fs";
import { saveDocument } from "@/lib/storage/db";
import { json } from "@/lib/http";

const schema = z.object({
  types: z.array(z.string()).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;

  const selectedTypes = body.success ? body.data.types : undefined;
  const redactedText = redactText(document.ocr?.extractedText ?? document.analysis?.summary ?? "", selectedTypes);
  const outputPath = await writeOutput(id, "redacted-copy.txt", redactedText);
  const record = {
    id: uuidv4(),
    outputPath,
    redactedTypes: selectedTypes ?? document.compliance.findings.map((finding) => finding.type),
    createdAt: new Date().toISOString()
  };
  const updated = {
    ...document,
    compliance: {
      ...document.compliance,
      redactions: [record, ...document.compliance.redactions]
    },
    updatedAt: record.createdAt,
    auditLog: [
      ...document.auditLog,
      { id: uuidv4(), type: "privacy.redaction_created", message: "Generated a redacted sharing copy.", createdAt: record.createdAt }
    ]
  };
  await saveDocument(updated);
  return json({ redaction: record, document: updated });
}
