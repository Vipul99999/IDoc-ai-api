import { canAccessDocument, effectiveUser, getAuthorizedDocument } from "@/lib/auth/request";
import { cosineSimilarity } from "@/lib/pipeline/embedding";
import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = effectiveUser(request);
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const documents = await listDocuments();
  const duplicates = documents
    .filter((candidate) => candidate.id !== id && canAccessDocument(user, candidate.userId))
    .map((candidate) => {
      const checksumMatch = candidate.metadata.checksum === document.metadata.checksum;
      const similarity =
        candidate.embedding && document.embedding ? cosineSimilarity(candidate.embedding.vector, document.embedding.vector) : 0;
      return {
        id: candidate.id,
        filename: candidate.originalName,
        checksumMatch,
        similarity: Number((similarity * 100).toFixed(1)),
        likelyDuplicate: checksumMatch || similarity > 0.92
      };
    })
    .filter((candidate) => candidate.likelyDuplicate || candidate.similarity > 55)
    .sort((a, b) => Number(b.likelyDuplicate) - Number(a.likelyDuplicate) || b.similarity - a.similarity);
  return json({ duplicates });
}
