import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "@/lib/config";
import { json } from "@/lib/http";
import { listDocuments } from "@/lib/storage/db";
import { log } from "@/lib/monitoring/logger";

export async function POST() {
  const documents = await listDocuments();
  const backupDir = path.join(DATA_ROOT, "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const filename = `backup-${createdAt.replace(/[:.]/g, "-")}.json`;
  const manifest = {
    createdAt,
    strategy: "application-manifest",
    documents,
    productionCommands: {
      postgres: "pg_dump --format=custom --no-owner --file=intellidoc.dump $DATABASE_URL",
      minio: "mc mirror --overwrite minio/documents ./backups/minio-documents",
      opensearch: "snapshot repository configured through OpenSearch snapshot API"
    }
  };
  const backupPath = path.join(backupDir, filename);
  await fs.writeFile(backupPath, JSON.stringify(manifest, null, 2));
  log("info", "backup.created", { backupPath, documents: documents.length });
  return json({ backupPath, documents: documents.length, createdAt });
}
