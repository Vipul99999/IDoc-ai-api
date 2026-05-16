import { canAccessDocument, effectiveUser } from "@/lib/auth/request";
import { deleteDocument, getDocument } from "@/lib/storage/db";
import { json, notFound } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = effectiveUser(request);
  const { id } = await context.params;
  const document = await getDocument(id);
  if (!document) return notFound();
  if (!canAccessDocument(user, document.userId)) return json({ error: "Forbidden" }, 403);
  return json({ document });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = effectiveUser(request);
  const { id } = await context.params;
  const document = await getDocument(id);
  if (!document) return notFound();
  if (!canAccessDocument(user, document.userId)) return json({ error: "Forbidden" }, 403);
  const deleted = await deleteDocument(id);
  if (!deleted) return notFound();
  return json({ ok: true });
}
