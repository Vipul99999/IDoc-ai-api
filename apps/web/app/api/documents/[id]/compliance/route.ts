import { getAuthorizedDocument } from "@/lib/auth/request";
import { json } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  return json({ compliance: document.compliance });
}
