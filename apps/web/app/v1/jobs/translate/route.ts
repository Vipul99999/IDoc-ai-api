import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { languageName, translateDocumentAdvanced } from "@/lib/pipeline/translate";
import { getDocument, saveDocument } from "@/lib/storage/db";
import { writeOutput } from "@/lib/storage/fs";
import { requireV1Auth, recordUsage, saveV1Job, v1Error, v1Response } from "@/lib/v1";

const schema = z.object({
  document_id: z.string().uuid(),
  target_language: z.string().min(2).max(8).default("hi"),
  source_language: z.string().min(2).max(8).optional(),
  preserve_layout: z.boolean().default(true),
  glossary: z.record(z.string()).default({})
});

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["jobs:write", "translation:write"]);
  if (!principal) return response;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return v1Error(request, principal.tenantId, 400, "invalid_request", "Invalid translation request.", body.error.flatten());
  const document = await getDocument(body.data.document_id);
  if (!document) return v1Error(request, principal.tenantId, 404, "document_not_found", "Document not found.");

  const now = new Date().toISOString();
  const translation = await translateDocumentAdvanced(document, {
    targetLanguage: body.data.target_language,
    sourceLanguage: body.data.source_language,
    preserveLayout: body.data.preserve_layout,
    glossary: body.data.glossary
  });
  const outputPath = await writeOutput(document.id, `translation-${body.data.target_language}.txt`, translation.translatedText);
  const record = {
    id: translation.id,
    sourceLanguage: translation.sourceLanguage,
    targetLanguage: body.data.target_language,
    translatedText: translation.translatedText,
    outputPath,
    engine: translation.engine,
    qualityScore: translation.qualityScore,
    warnings: translation.warnings,
    createdAt: now
  };
  await saveDocument({
    ...document,
    status: "translated",
    translations: [record, ...document.translations],
    updatedAt: new Date().toISOString(),
    auditLog: [
      ...document.auditLog,
      {
        id: uuidv4(),
        type: "translation.completed",
        message: `Generated ${languageName(body.data.target_language)} translation through the v1 API.`,
        createdAt: now
      }
    ]
  });
  const job = await saveV1Job({
    id: uuidv4(),
    tenantId: principal.tenantId,
    documentId: document.id,
    type: "translate",
    status: "succeeded",
    progress: 100,
    resultId: document.id,
    payload: { target_language: body.data.target_language },
    createdAt: now,
    updatedAt: new Date().toISOString()
  });
  await recordUsage(principal, "translation_character", translation.translatedText.length, { target_language: body.data.target_language }, document.id);
  return v1Response(request, principal.tenantId, { job }, 202);
}
