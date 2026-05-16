import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/config";
import { DocumentRecord } from "@/lib/types";

let pool: Pool | null = null;

export function getPostgresPool() {
  if (!DATABASE_URL) return null;
  pool ??= new Pool({ connectionString: DATABASE_URL });
  return pool;
}

export function isPostgresEnabled() {
  return Boolean(DATABASE_URL);
}

export async function saveDocumentPostgres(document: DocumentRecord) {
  const db = getPostgresPool();
  if (!db) return null;
  await db.query(
    `
    INSERT INTO documents (id, organization_id, uploaded_by, filename, mime_type, storage_key, status, page_count, checksum, created_at, updated_at, payload)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      storage_key = EXCLUDED.storage_key,
      status = EXCLUDED.status,
      page_count = EXCLUDED.page_count,
      checksum = EXCLUDED.checksum,
      updated_at = EXCLUDED.updated_at,
      payload = EXCLUDED.payload
    `,
    [
      document.id,
      "00000000-0000-0000-0000-000000000001",
      null,
      document.originalName,
      document.mimeType,
      document.storagePath,
      document.status,
      document.pageCount,
      document.metadata.checksum,
      document.createdAt,
      document.updatedAt,
      document
    ]
  );
  return document;
}

export async function getDocumentPostgres(id: string) {
  const db = getPostgresPool();
  if (!db) return null;
  const result = await db.query("SELECT payload FROM documents WHERE id = $1", [id]);
  return (result.rows[0]?.payload as DocumentRecord | undefined) ?? null;
}

export async function listDocumentsPostgres() {
  const db = getPostgresPool();
  if (!db) return null;
  const result = await db.query("SELECT payload FROM documents ORDER BY created_at DESC");
  return result.rows.map((row) => row.payload as DocumentRecord);
}

export async function deleteDocumentPostgres(id: string) {
  const db = getPostgresPool();
  if (!db) return null;
  await db.query("DELETE FROM documents WHERE id = $1", [id]);
  return true;
}
