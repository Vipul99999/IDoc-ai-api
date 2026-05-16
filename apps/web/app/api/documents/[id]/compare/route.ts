import { z } from "zod";
import { canAccessDocument, effectiveUser, getAuthorizedDocument } from "@/lib/auth/request";
import { cosineSimilarity } from "@/lib/pipeline/embedding";
import { getDocument } from "@/lib/storage/db";
import { badRequest, json, notFound } from "@/lib/http";

const schema = z.object({ targetDocumentId: z.string().min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("targetDocumentId is required.");
  const user = effectiveUser(request);
  const { document: source, response } = await getAuthorizedDocument(request, id);
  if (!source) return response;
  const target = await getDocument(body.data.targetDocumentId);
  if (!target) return notFound("One of the documents was not found.");
  if (!canAccessDocument(user, target.userId)) return json({ error: "Forbidden" }, 403);

  const sourceWords = new Set((source.ocr?.extractedText ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const targetWords = new Set((target.ocr?.extractedText ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const onlyInSource = [...sourceWords].filter((word) => !targetWords.has(word)).slice(0, 25);
  const onlyInTarget = [...targetWords].filter((word) => !sourceWords.has(word)).slice(0, 25);
  const semanticSimilarity =
    source.embedding && target.embedding ? Number((cosineSimilarity(source.embedding.vector, target.embedding.vector) * 100).toFixed(1)) : 0;

  return json({
    comparison: {
      source: { id: source.id, filename: source.originalName },
      target: { id: target.id, filename: target.originalName },
      semanticSimilarity,
      sameChecksum: source.metadata.checksum === target.metadata.checksum,
      onlyInSource,
      onlyInTarget,
      recommendation:
        semanticSimilarity > 90 ? "Treat as a possible duplicate or near-duplicate." : "Documents appear meaningfully different."
    }
  });
}
