import { v4 as uuidv4 } from "uuid";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { generateFlashcards } from "@/lib/pipeline/generative";
import { saveDocument } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const createdAt = new Date().toISOString();
  const cards = generateFlashcards(document).map((card) => ({ id: uuidv4(), createdAt, ...card }));
  const updated = {
    ...document,
    generated: { ...document.generated, flashcards: [...cards, ...document.generated.flashcards] },
    updatedAt: createdAt
  };
  await saveDocument(updated);
  return json({ flashcards: cards, document: updated });
}
