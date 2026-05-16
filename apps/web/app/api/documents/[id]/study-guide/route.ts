import { v4 as uuidv4 } from "uuid";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { generateStudyGuide } from "@/lib/pipeline/generative";
import { saveDocument } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const record = { id: uuidv4(), sections: generateStudyGuide(document), createdAt: new Date().toISOString() };
  const updated = {
    ...document,
    generated: { ...document.generated, studyGuides: [record, ...document.generated.studyGuides] },
    updatedAt: record.createdAt
  };
  await saveDocument(updated);
  return json({ studyGuide: record, document: updated });
}
