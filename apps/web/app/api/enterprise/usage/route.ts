import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  const ocrCredits = documents.reduce((sum, document) => sum + document.pageCount, 0);
  const translationCredits = documents.reduce((sum, document) => sum + document.translations.length * Math.max(1, document.pageCount), 0);

  return json({
    account: {
      plan: "developer-sandbox",
      apiBillingEnabled: true,
      ssoReady: false,
      retentionDays: Number(process.env.RETENTION_DAYS ?? 30)
    },
    usage: {
      documents: documents.length,
      ocrCredits,
      translationCredits,
      storageBytes: documents.reduce((sum, document) => sum + document.size, 0)
    }
  });
}
