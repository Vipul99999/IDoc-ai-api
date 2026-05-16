import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api-keys";
import { DATA_ROOT } from "@/lib/config";
import { getBearerToken, getRequestUser, LOCAL_ORG_ID, LOCAL_OWNER_ID } from "@/lib/auth/request";

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
        tenantId: LOCAL_ORG_ID,
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

export async function recordUsage(principal: V1Principal, meter: UsageMeter, quantity: number, metadata: Record<string, unknown> = {}, resourceId?: string) {
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

export async function readUsageRecords() {
  return readJsonFile<UsageRecord[]>(usagePath(), []);
}

export async function saveV1Job(job: V1Job) {
  const jobs = await readV1Jobs();
  const withoutCurrent = jobs.filter((item) => item.id !== job.id);
  await writeJsonFile(jobsPath(), [job, ...withoutCurrent].slice(0, 1000));
  return job;
}

export async function readV1Jobs() {
  return readJsonFile<V1Job[]>(jobsPath(), []);
}

export async function findV1Job(id: string) {
  return (await readV1Jobs()).find((job) => job.id === id) ?? null;
}

export function summarizeUsage(records: UsageRecord[]) {
  return records.reduce<Record<string, number>>((totals, record) => {
    totals[record.meter] = (totals[record.meter] ?? 0) + record.quantity;
    return totals;
  }, {});
}
