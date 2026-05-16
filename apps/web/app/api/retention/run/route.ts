import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function POST() {
  const documents = await listDocuments();
  const now = new Date().toISOString();
  const candidates = documents
    .filter((document) => document.metadata.retentionUntil < now)
    .filter((document) => !(document.compliance?.policyTags ?? []).some((tag) => ["restricted-sharing", "identity-data", "health-privacy"].includes(tag)));

  return json({
    dryRun: true,
    candidates: candidates.map((document) => ({
      id: document.id,
      filename: document.originalName,
      retentionUntil: document.metadata.retentionUntil
    })),
    message: "Dry run only. Enable deletion after external backup and legal-hold review."
  });
}
