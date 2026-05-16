import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { answerQuestion } from "@/lib/pipeline/generative";
import { saveDocument } from "@/lib/storage/db";
import { badRequest, json } from "@/lib/http";

const schema = z.object({ question: z.string().min(3) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Question is required.");
  const { document, response } = await getAuthorizedDocument(request, id);
  if (!document) return response;
  const record = {
    id: uuidv4(),
    question: body.data.question,
    answer: answerQuestion(document, body.data.question),
    createdAt: new Date().toISOString()
  };
  const updated = {
    ...document,
    generated: { ...document.generated, answers: [record, ...document.generated.answers] },
    updatedAt: new Date().toISOString()
  };
  await saveDocument(updated);
  return json({ answer: record, document: updated });
}
