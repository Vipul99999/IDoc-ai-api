import { createSignedToken } from "@/lib/security";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { saveDocument } from "@/lib/storage/db";
import { signedObjectUrl } from "@/lib/storage/object-store";
import { json } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const objectUrl = await signedObjectUrl(document.storagePath);
  if (objectUrl) return json({ url: objectUrl, expiresAt });
  const token = createSignedToken(id, expiresAt);
  const updated = {
    ...document,
    metadata: { ...document.metadata, signedUrlExpiresAt: expiresAt },
    updatedAt: new Date().toISOString()
  };
  await saveDocument(updated);
  return json({
    url: `/api/documents/${id}/text?token=${token}&expiresAt=${encodeURIComponent(expiresAt)}`,
    expiresAt
  });
}
