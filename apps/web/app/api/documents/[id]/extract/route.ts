import { getAuthorizedDocument } from "@/lib/auth/request";
import { saveDocument } from "@/lib/storage/db";
import { extractStructuredData } from "@/lib/extraction";
import { json } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  return json({ extraction: document.extraction });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const extraction = extractStructuredData(document);
  const updated = { ...document, extraction, updatedAt: new Date().toISOString() };
  await saveDocument(updated);
  return json({ extraction, document: updated });
}
