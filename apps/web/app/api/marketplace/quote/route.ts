import { z } from "zod";
import { getAuthorizedDocument } from "@/lib/auth/request";
import { buildPrintQuote } from "@/lib/marketplace";
import { badRequest, json } from "@/lib/http";

const schema = z.object({
  documentId: z.string().min(1),
  vendorId: z.string().default("campus-fastprint"),
  copies: z.number().int().min(1).max(500).default(1)
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("documentId, vendorId, and copies are required.");
  const { document, response } = await getAuthorizedDocument(request, body.data.documentId);
  if (!document) return response;
  return json({ quote: buildPrintQuote(document, body.data.vendorId, body.data.copies) });
}
