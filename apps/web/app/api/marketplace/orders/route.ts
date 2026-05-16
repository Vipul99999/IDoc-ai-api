import { promises as fs } from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { DATA_ROOT } from "@/lib/config";
import { canAccessDocument, effectiveUser, getAuthorizedDocument } from "@/lib/auth/request";
import { buildPrintQuote } from "@/lib/marketplace";
import { getDocument } from "@/lib/storage/db";
import { badRequest, json } from "@/lib/http";

const schema = z.object({
  documentId: z.string().min(1),
  vendorId: z.string().default("campus-fastprint"),
  copies: z.number().int().min(1).max(500).default(1),
  deliveryMode: z.enum(["pickup", "courier"]).default("pickup")
});

function ordersDir() {
  return path.join(DATA_ROOT, "orders");
}

export async function GET(request: Request) {
  const user = effectiveUser(request);
  await fs.mkdir(ordersDir(), { recursive: true });
  const files = await fs.readdir(ordersDir());
  const ordersRaw = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await fs.readFile(path.join(ordersDir(), file), "utf8")))
  );
  const orders = [];
  for (const order of ordersRaw) {
    const document = await getDocument(order.documentId);
    if (document && canAccessDocument(user, document.userId)) orders.push(order);
  }
  return json({ orders: orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Invalid order request.");
  const { document, response } = await getAuthorizedDocument(request, body.data.documentId);
  if (!document) return response;
  const quote = buildPrintQuote(document, body.data.vendorId, body.data.copies);
  const order = {
    id: uuidv4(),
    quote,
    documentId: document.id,
    documentName: document.originalName,
    deliveryMode: body.data.deliveryMode,
    status: document.compliance.riskScore >= 45 ? "held_for_privacy_review" : "submitted",
    createdAt: new Date().toISOString()
  };
  await fs.mkdir(ordersDir(), { recursive: true });
  await fs.writeFile(path.join(ordersDir(), `${order.id}.json`), JSON.stringify(order, null, 2));
  return json({ order }, 201);
}
