import { getAuthorizedDocument } from "@/lib/auth/request";
import { json } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  return json({
    quality: {
      score: document.analysis?.qualityScore ?? null,
      orientation: document.analysis?.orientation ?? null,
      issues: document.analysis?.issues ?? [],
      pages: document.analysis?.pages ?? []
    }
  });
}
