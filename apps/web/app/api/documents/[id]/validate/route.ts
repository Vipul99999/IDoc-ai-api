import { getAuthorizedDocument } from "@/lib/auth/request";
import { saveDocument } from "@/lib/storage/db";
import { json } from "@/lib/http";
import { validateDocument } from "@/lib/validation";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  return json({ validation: document.validation });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const validation = validateDocument(document);
  const updated = { ...document, validation, updatedAt: new Date().toISOString() };
  await saveDocument(updated);
  return json({ validation, document: updated });
}
