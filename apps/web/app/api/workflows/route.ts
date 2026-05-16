import { listDocuments } from "@/lib/storage/db";
import { workflowForDocument } from "@/lib/workflows";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  return json({ workflows: documents.map(workflowForDocument) });
}
