import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api-keys";
import { DATA_ROOT } from "@/lib/config";
import { getBearerToken, getRequestUser, LOCAL_ORG_ID, LOCAL_OWNER_ID } from "@/lib/auth/request";
import { getPostgresPool, isPostgresEnabled } from "@/lib/storage/postgres";

export type V1Principal = {
  tenantId: string;
  userId: string;
  role: "owner" | "admin" | "analyst" | "viewer" | "api_client";
  scopes: string[];
  apiKeyId?: string;
};

export type UsageMeter =
  | "api_call"
  | "document_upload"
  | "page_processed"
  | "ocr_page"
  | "translation_character"
  | "search_query"
  | "storage_mb_month"
  | "compute_second"
  | "webhook_delivery";

export type UsageRecord = {
  id: string;
  tenantId: string;
  userId?: string;
  apiKeyId?: string;
  meter: UsageMeter;
  quantity: number;
  resourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type V1Job = {
  id: string;
  tenantId: string;
  documentId: string;
  type: "analyze" | "ocr" | "translate" | "reformat";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  resultId?: string;
  error?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function requestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

function usagePath() {
  return path.join(DATA_ROOT, "settings", "usage-records.json");
}

function jobsPath() {
  return path.join(DATA_ROOT, "settings", "v1-jobs.json");
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

export function v1Response(request: Request, tenantId: string, data: unknown, status = 200, pagination?: Record<string, unknown>) {
  const id = requestId(request);
  return NextResponse.json(
    {
      request_id: id,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
      data,
      ...(pagination ? { pagination } : {})
    },
    {
      status,
      headers: {
        "x-request-id": id,
        "x-ratelimit-limit": "120",
        "x-ratelimit-remaining": "119",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60)
      }
    }
  );
}

export function v1Error(request: Request, tenantId: string | null, status: number, code: string, message: string, details?: unknown) {
  const id = requestId(request);
  return NextResponse.json(
    {
      request_id: id,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
      error: {
        code,
        message,
        details: details ?? null,
        documentation_url: "/docs/api/openapi.json"
      }
    },
    { status, headers: { "x-request-id": id } }
  );
}

export async function requireV1Auth(request: Request, requiredScopes: string[] = []) {
  const bearer = getBearerToken(request);
  const explicitKey = request.headers.get("x-api-key");
  const secret = explicitKey ?? (bearer?.startsWith("idoc_") ? bearer : null);

  if (secret) {
    const apiKey = await verifyApiKey(secret);
    if (!apiKey) return { principal: null, response: v1Error(request, null, 401, "invalid_api_key", "The API key is invalid or revoked.") };
    const missing = requiredScopes.filter((scope) => !apiKey.scopes.includes(scope) && !apiKey.scopes.includes("*"));
    if (missing.length > 0) {
      return {
        principal: null,
        response: v1Error(request, LOCAL_ORG_ID, 403, "insufficient_scope", "The API key does not include the required scope.", { missing })
      };
    }
    return {
      principal: {
        tenantId: apiKey.organizationId,
        userId: LOCAL_OWNER_ID,
        role: "api_client" as const,
        scopes: apiKey.scopes,
        apiKeyId: apiKey.id
      },
      response: null
    };
  }

  const user = getRequestUser(request);
  if (user) {
    return {
      principal: {
        tenantId: user.organizationId,
        userId: user.id,
        role: user.role,
        scopes: ["*"]
      },
      response: null
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return {
      principal: {
        tenantId: LOCAL_ORG_ID,
        userId: LOCAL_OWNER_ID,
        role: "owner" as const,
        scopes: ["*"]
      },
      response: null
    };
  }

  return { principal: null, response: v1Error(request, null, 401, "authentication_required", "Provide a Bearer API key, x-api-key, or JWT session token.") };
}

export async function recordUsage(principal: V1Principal, meter: UsageMeter, quantity: number, metadata: Record<string, unknown> = {}, resourceId?: string): Promise<UsageRecord> {
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const result = await db.query(
        `
        INSERT INTO usage_records (organization_id, user_id, api_key_id, document_id, meter, quantity, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, organization_id, user_id, api_key_id, document_id, meter, quantity, metadata, created_at
        `,
        [principal.tenantId, principal.userId, principal.apiKeyId ?? null, resourceId ?? null, meter, quantity, metadata]
      );
      const row = result.rows[0];
      return {
        id: row.id,
        tenantId: row.organization_id,
        userId: row.user_id ?? undefined,
        apiKeyId: row.api_key_id ?? undefined,
        meter: row.meter,
        quantity: Number(row.quantity),
        resourceId: row.document_id ?? undefined,
        metadata: row.metadata ?? {},
        createdAt: row.created_at?.toISOString?.() ?? String(row.created_at)
      } satisfies UsageRecord;
    }
  }
  const records = await readUsageRecords();
  const record: UsageRecord = {
    id: crypto.randomUUID(),
    tenantId: principal.tenantId,
    userId: principal.userId,
    apiKeyId: principal.apiKeyId,
    meter,
    quantity,
    resourceId,
    metadata,
    createdAt: new Date().toISOString()
  };
  records.unshift(record);
  await writeJsonFile(usagePath(), records.slice(0, 5000));
  return record;
}

export async function checkQuota(principal: V1Principal, meter: UsageMeter, quantity: number, period: "minute" | "day" | "month" = "month") {
  const windowStart = new Date();
  if (period === "minute") windowStart.setSeconds(0, 0);
  if (period === "day") windowStart.setHours(0, 0, 0, 0);
  if (period === "month") {
    windowStart.setDate(1);
    windowStart.setHours(0, 0, 0, 0);
  }

  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const limitResult = await db.query(
        "SELECT limit_value FROM quota_limits WHERE organization_id = $1 AND meter = $2 AND period = $3 LIMIT 1",
        [principal.tenantId, meter, period]
      );
      const limit = limitResult.rows[0]?.limit_value == null ? null : Number(limitResult.rows[0].limit_value);
      if (limit == null) return { ok: true, limit: null, used: 0, remaining: null };
      const usageResult = await db.query(
        "SELECT COALESCE(SUM(quantity), 0) AS used FROM usage_records WHERE organization_id = $1 AND meter = $2 AND created_at >= $3",
        [principal.tenantId, meter, windowStart.toISOString()]
      );
      const used = Number(usageResult.rows[0]?.used ?? 0);
      return { ok: used + quantity <= limit, limit, used, remaining: Math.max(0, limit - used) };
    }
  }

  const records = (await readUsageRecords()).filter((record) => record.tenantId === principal.tenantId && record.meter === meter && Date.parse(record.createdAt) >= windowStart.getTime());
  const used = records.reduce((sum, record) => sum + record.quantity, 0);
  const localDefaults: Partial<Record<UsageMeter, number>> = { page_processed: 100, ocr_page: 100, storage_mb_month: 100 };
  const limit = localDefaults[meter] ?? null;
  return limit == null ? { ok: true, limit, used, remaining: null } : { ok: used + quantity <= limit, limit, used, remaining: Math.max(0, limit - used) };
}

export async function readUsageRecords(): Promise<UsageRecord[]> {
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const result = await db.query(
        `
        SELECT id, organization_id, user_id, api_key_id, document_id, meter, quantity, metadata, created_at
        FROM usage_records
        ORDER BY created_at DESC
        LIMIT 5000
        `
      );
      return result.rows.map(
        (row) =>
          ({
            id: row.id,
            tenantId: row.organization_id,
            userId: row.user_id ?? undefined,
            apiKeyId: row.api_key_id ?? undefined,
            meter: row.meter,
            quantity: Number(row.quantity),
            resourceId: row.document_id ?? undefined,
            metadata: row.metadata ?? {},
            createdAt: row.created_at?.toISOString?.() ?? String(row.created_at)
          }) satisfies UsageRecord
      );
    }
  }
  return readJsonFile<UsageRecord[]>(usagePath(), []);
}

export async function saveV1Job(job: V1Job): Promise<V1Job> {
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      await db.query(
        `
        INSERT INTO jobs (id, organization_id, document_id, type, status, progress, result_id, payload, error, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          progress = EXCLUDED.progress,
          result_id = EXCLUDED.result_id,
          payload = EXCLUDED.payload,
          error = EXCLUDED.error,
          updated_at = EXCLUDED.updated_at
        `,
        [job.id, job.tenantId, job.documentId, job.type, job.status, job.progress, job.resultId ?? null, job.payload, job.error ?? null, job.createdAt, job.updatedAt]
      );
      return job;
    }
  }
  const jobs = await readV1Jobs();
  const withoutCurrent = jobs.filter((item) => item.id !== job.id);
  await writeJsonFile(jobsPath(), [job, ...withoutCurrent].slice(0, 1000));
  return job;
}

export async function readV1Jobs(): Promise<V1Job[]> {
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const result = await db.query(
        `
        SELECT id, organization_id, document_id, type, status, progress, result_id, payload, error, created_at, updated_at
        FROM jobs
        ORDER BY created_at DESC
        LIMIT 1000
        `
      );
      return result.rows.map(rowToV1Job);
    }
  }
  return readJsonFile<V1Job[]>(jobsPath(), []);
}

export async function findV1Job(id: string): Promise<V1Job | null> {
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const result = await db.query(
        `
        SELECT id, organization_id, document_id, type, status, progress, result_id, payload, error, created_at, updated_at
        FROM jobs
        WHERE id = $1
        `,
        [id]
      );
      return result.rows[0] ? rowToV1Job(result.rows[0]) : null;
    }
  }
  return (await readV1Jobs()).find((job) => job.id === id) ?? null;
}

export async function updateV1Job(id: string, patch: Partial<V1Job>) {
  const current = await findV1Job(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  return saveV1Job(next);
}

function rowToV1Job(row: Record<string, any>): V1Job {
  return {
    id: row.id,
    tenantId: row.organization_id,
    documentId: row.document_id,
    type: row.type,
    status: row.status,
    progress: Number(row.progress ?? 0),
    resultId: row.result_id ?? undefined,
    error: row.error ?? undefined,
    payload: row.payload ?? {},
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
    updatedAt: row.updated_at?.toISOString?.() ?? String(row.updated_at)
  };
}

export function summarizeUsage(records: UsageRecord[]) {
  return records.reduce<Record<string, number>>((totals, record) => {
    totals[record.meter] = (totals[record.meter] ?? 0) + record.quantity;
    return totals;
  }, {});
}
