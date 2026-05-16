import { listDocuments } from "@/lib/storage/db";
import { reviewTasksForDocument } from "@/lib/review";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  return json({ tasks: documents.flatMap(reviewTasksForDocument) });
}
