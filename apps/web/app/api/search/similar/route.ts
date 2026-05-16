import { json } from "@/lib/http";
import { similarDocuments } from "@/lib/search-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId") ?? "";
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 10;
  return json({ similar: await similarDocuments(documentId, limit) });
}
