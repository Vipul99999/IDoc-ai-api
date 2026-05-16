import { canAccessDocument, getRequestUser } from "@/lib/auth/request";
import { verifySignedToken } from "@/lib/security";
import { getDocument } from "@/lib/storage/db";
import { json, notFound } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const document = await getDocument(id);
  if (!document) return notFound();
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expiresAt = url.searchParams.get("expiresAt");
  const signedAccess = Boolean(token && expiresAt && verifySignedToken(id, expiresAt, token));
  const user = getRequestUser(request);
  const userAccess = user ? canAccessDocument(user, document.userId) : false;
  if (!signedAccess && !userAccess) return json({ error: "Forbidden" }, 403);
  return json({ text: document.ocr?.extractedText ?? "" });
}
