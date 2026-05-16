import { canAccessDocument, effectiveUser } from "@/lib/auth/request";
import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function GET(request: Request) {
  const user = effectiveUser(request);
  const documents = await listDocuments();
  return json({ documents: documents.filter((document) => canAccessDocument(user, document.userId)) });
}
