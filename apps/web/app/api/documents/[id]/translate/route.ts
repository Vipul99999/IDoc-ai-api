import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { languageName, translateDocumentAdvanced } from "@/lib/pipeline/translate";
import { writeOutput } from "@/lib/storage/fs";
import { saveDocument } from "@/lib/storage/db";
import { badRequest, json } from "@/lib/http";

const schema = z.object({
  targetLanguage: z.string().min(2).max(8).default("hi"),
  sourceLanguage: z.string().min(2).max(8).optional(),
  preserveLayout: z.boolean().default(true),
  glossary: z.record(z.string()).default({})
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Invalid translation request.");
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;

  const translation = await translateDocumentAdvanced(document, body.data);
  const outputPath = await writeOutput(id, `translation-${body.data.targetLanguage}.txt`, translation.translatedText);
  const manifestPath = await writeOutput(
    id,
    `translation-${body.data.targetLanguage}.json`,
    JSON.stringify(
      {
        engine: translation.engine,
        qualityScore: translation.qualityScore,
        warnings: translation.warnings,
        chunks: translation.chunks,
        protectedTerms: translation.protectedTerms
      },
      null,
      2
    )
  );
  const record = {
    id: translation.id,
    sourceLanguage: translation.sourceLanguage,
    targetLanguage: body.data.targetLanguage,
    translatedText: translation.translatedText,
    outputPath,
    manifestPath,
    engine: translation.engine,
    qualityScore: translation.qualityScore,
    warnings: translation.warnings,
    createdAt: new Date().toISOString()
  };

  const updated = {
    ...document,
    status: "translated" as const,
    translations: [record, ...document.translations],
    updatedAt: new Date().toISOString(),
    auditLog: [
      ...document.auditLog,
      {
        id: uuidv4(),
        type: "translation.completed",
        message: `Generated ${languageName(body.data.targetLanguage)} translation from ${languageName(translation.sourceLanguage)} source with ${translation.qualityScore}/100 quality using ${translation.engine}.`,
        createdAt: new Date().toISOString()
      }
    ]
  };
  await saveDocument(updated);
  return json({ translation: record, document: updated });
}
