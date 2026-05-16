import { estimateDocumentCost, estimatePortfolioCost } from "@/lib/cost";
import { getDocument, listDocuments } from "@/lib/storage/db";
import { json, notFound } from "@/lib/http";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  if (documentId) {
    const document = await getDocument(documentId);
    if (!document) return notFound();
    return json({ estimate: estimateDocumentCost(document) });
  }
  const documents = await listDocuments();
  return json({ estimate: estimatePortfolioCost(documents) });
}
