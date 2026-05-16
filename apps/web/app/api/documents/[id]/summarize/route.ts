import { v4 as uuidv4 } from "uuid";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { generateExecutiveSummary } from "@/lib/pipeline/generative";
import { saveDocument } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const record = { id: uuidv4(), text: generateExecutiveSummary(document), createdAt: new Date().toISOString() };
  const updated = {
    ...document,
    generated: { ...document.generated, summaries: [record, ...document.generated.summaries] },
    updatedAt: new Date().toISOString()
  };
  await saveDocument(updated);
  return json({ summary: record, document: updated });
}
