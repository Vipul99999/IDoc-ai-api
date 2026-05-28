import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { DATA_ROOT } from "@/lib/config";
import { getPostgresPool, isPostgresEnabled } from "@/lib/storage/postgres";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export type ApiKeyRecord = {
  id: string;
  organizationId: string;
  name: string;
  prefix: string;
  hash: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
};

function filePath() {
  return path.join(DATA_ROOT, "settings", "api-keys.json");
}

async function readKeys(): Promise<ApiKeyRecord[]> {
  try {
    return JSON.parse(await fs.readFile(filePath(), "utf8")) as ApiKeyRecord[];
  } catch {
    return [];
  }
}

export async function verifyApiKey(secret: string) {
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const result = await db.query(
        `
        UPDATE api_keys
        SET last_used_at = now()
        WHERE hash = $1
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        RETURNING id, organization_id, name, prefix, hash, scopes, created_at, last_used_at, revoked_at, expires_at
        `,
        [hash]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        prefix: row.prefix,
        hash: row.hash,
        scopes: row.scopes ?? [],
        createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
        lastUsedAt: row.last_used_at?.toISOString?.() ?? undefined,
        revokedAt: row.revoked_at?.toISOString?.() ?? undefined,
        expiresAt: row.expires_at?.toISOString?.() ?? undefined
      } satisfies ApiKeyRecord;
    }
  }
  const keys = await readKeys();
  const key = keys.find((item) => item.hash === hash && !item.revokedAt && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()));
  if (!key) return null;
  key.lastUsedAt = new Date().toISOString();
  await writeKeys(keys);
  return key;
}

async function writeKeys(keys: ApiKeyRecord[]) {
  await fs.mkdir(path.dirname(filePath()), { recursive: true });
  await fs.writeFile(filePath(), JSON.stringify(keys, null, 2));
}

export async function listApiKeys(organizationId = DEFAULT_ORG_ID) {
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const result = await db.query(
        `
        SELECT id, organization_id, name, prefix, scopes, created_at, last_used_at, revoked_at, expires_at
        FROM api_keys
        WHERE organization_id = $1
        ORDER BY created_at DESC
        `,
        [organizationId]
      );
      return result.rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        prefix: row.prefix,
        scopes: row.scopes ?? [],
        createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
        lastUsedAt: row.last_used_at?.toISOString?.() ?? undefined,
        revokedAt: row.revoked_at?.toISOString?.() ?? undefined,
        expiresAt: row.expires_at?.toISOString?.() ?? undefined
      }));
    }
  }
  return (await readKeys()).filter((key) => key.organizationId === organizationId || !key.organizationId).map(({ hash, ...key }) => key);
}

export async function createApiKey(name: string, scopes: string[], organizationId = DEFAULT_ORG_ID, expiresAt?: string) {
  const secret = `idoc_${crypto.randomBytes(24).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const result = await db.query(
        `
        INSERT INTO api_keys (organization_id, name, prefix, hash, scopes, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, organization_id, name, prefix, scopes, created_at, last_used_at, revoked_at, expires_at
        `,
        [organizationId, name, secret.slice(0, 12), hash, scopes, expiresAt ?? null]
      );
      const row = result.rows[0];
      return {
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        prefix: row.prefix,
        scopes: row.scopes ?? [],
        createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
        lastUsedAt: undefined,
        revokedAt: undefined,
        expiresAt: row.expires_at?.toISOString?.() ?? undefined,
        secret
      };
    }
  }
  const record: ApiKeyRecord = {
    id: uuidv4(),
    organizationId,
    name,
    prefix: secret.slice(0, 12),
    hash,
    scopes,
    createdAt: new Date().toISOString(),
    expiresAt
  };
  const keys = await readKeys();
  await writeKeys([record, ...keys]);
  return { ...record, hash: undefined, secret };
}

export async function revokeApiKey(id: string, organizationId = DEFAULT_ORG_ID) {
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      await db.query("UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND organization_id = $2", [id, organizationId]);
      return true;
    }
  }
  const keys = await readKeys();
  await writeKeys(keys.map((key) => (key.id === id && (key.organizationId === organizationId || !key.organizationId) ? { ...key, revokedAt: new Date().toISOString() } : key)));
  return true;
}
