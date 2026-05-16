import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  const records = documents.flatMap((document) => [
    {
      id: `${document.id}-ocr`,
      documentId: document.id,
      meter: "ocr_page",
      quantity: document.pageCount,
      unitPriceCents: 2,
      totalCents: document.pageCount * 2,
      createdAt: document.createdAt
    },
    {
      id: `${document.id}-storage`,
      documentId: document.id,
      meter: "storage_mb_month",
      quantity: Number((document.size / 1024 / 1024).toFixed(3)),
      unitPriceCents: 1,
      totalCents: Math.ceil(document.size / 1024 / 1024),
      createdAt: document.createdAt
    }
  ]);
  return json({ records });
}
