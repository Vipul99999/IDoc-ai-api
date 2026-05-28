import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { MAX_UPLOAD_MB, RETENTION_DAYS, SUPPORTED_EXTENSIONS } from "@/lib/config";
import { detectedCategory } from "@/lib/format-support";
import { checksum, retentionDate } from "@/lib/pipeline/analyze";
import { canAcceptBackgroundJobs, enqueueJob } from "@/lib/queue/jobs";
import { scanForMalware } from "@/lib/security";
import { saveDocument, listDocumentsForTenant } from "@/lib/storage/db";
import { ensureStorage } from "@/lib/storage/fs";
import { putOriginalObject } from "@/lib/storage/object-store";
import { DocumentRecord } from "@/lib/types";
import { checkQuota, requireV1Auth, recordUsage, v1Error, v1Response } from "@/lib/v1";

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

export async function GET(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["documents:read"]);
  if (!principal) return response;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const documents = await listDocumentsForTenant(principal.tenantId);
  const start = (page - 1) * limit;
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/documents", method: "GET" });
  return v1Response(
    request,
    principal.tenantId,
    { documents: documents.slice(start, start + limit) },
    200,
    { page, limit, total: documents.length, has_more: start + limit < documents.length }
  );
}

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["documents:write"]);
  if (!principal) return response;
  if (!canAcceptBackgroundJobs()) return v1Error(request, principal.tenantId, 503, "queue_unavailable", "Background processing is not available.");

  await ensureStorage();
  const formData = await request.formData();
  const file = formData.get("file");
  const budget = formData.get("budget") === "premium" ? "premium" : formData.get("budget") === "economy" ? "economy" : "standard";
  const urgency = formData.get("urgency") === "express" ? "express" : "normal";
  if (!(file instanceof File)) return v1Error(request, principal.tenantId, 400, "missing_file", "Attach a document file using the file field.");
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return v1Error(request, principal.tenantId, 413, "upload_too_large", `Upload limit is ${MAX_UPLOAD_MB} MB.`);
  const storageMb = Number((file.size / 1024 / 1024).toFixed(4));
  const storageQuota = await checkQuota(principal, "storage_mb_month", storageMb);
  if (!storageQuota.ok) return v1Error(request, principal.tenantId, 429, "quota_exceeded", "Storage quota exceeded.", storageQuota);

  const originalName = sanitizeFilename(file.name);
  const extension = path.extname(originalName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return v1Error(request, principal.tenantId, 415, "unsupported_file_type", `Unsupported file type: ${extension}.`);
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const buffer = Buffer.from(await file.arrayBuffer());
  const malwareScan = scanForMalware(buffer);
  if (malwareScan.status === "blocked") return v1Error(request, principal.tenantId, 400, "malware_detected", "Upload blocked by malware scan.", malwareScan.findings);
  const storagePath = await putOriginalObject(id, extension, buffer);
  const fileChecksum = checksum(buffer);
  const document: DocumentRecord = {
    id,
    organizationId: principal.tenantId,
    userId: principal.userId,
    filename: `${id}${extension}`,
    originalName,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    pageCount: 1,
    status: "analyzing",
    storagePath,
    createdAt: now,
    updatedAt: now,
    tags: ["v1-upload", extension.replace(".", "")],
    metadata: {
      extension,
      checksum: fileChecksum,
      retentionUntil: retentionDate(RETENTION_DAYS),
      colorPercentage: 0,
      budget,
      urgency,
      malwareScan,
      detectedCategory: detectedCategory(extension)
    },
    translations: [],
    reformats: [],
    versions: [{ id: uuidv4(), version: 1, storagePath, checksum: fileChecksum, createdAt: now, reason: "Initial v1 API upload" }],
    generated: { summaries: [], flashcards: [], studyGuides: [], answers: [] },
    compliance: { findings: [], riskScore: 0, policyTags: ["pending-analysis"], redactions: [] },
    extraction: { entities: [], fields: {}, tables: [], confidence: 0, extractedAt: now },
    validation: { readinessScore: 0, checks: [], validatedAt: now },
    auditLog: [{ id: uuidv4(), type: "document.uploaded", message: "Uploaded through the commercial v1 API.", createdAt: now }]
  };

  await saveDocument(document);
  const job = await enqueueJob({
    id: uuidv4(),
    type: "document.full_pipeline",
    documentId: id,
    status: "queued",
    progress: 5,
    message: "Queued for background document intelligence processing.",
    attempts: 0,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now
  });
  await recordUsage(principal, "document_upload", 1, { filename: originalName, bytes: file.size }, id);
  await recordUsage(principal, "storage_mb_month", storageMb, {}, id);
  return v1Response(request, principal.tenantId, { document, job }, 202);
}
