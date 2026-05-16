import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { effectiveUser } from "@/lib/auth/request";
import { MAX_UPLOAD_MB, RETENTION_DAYS, SUPPORTED_EXTENSIONS } from "@/lib/config";
import { detectedCategory } from "@/lib/format-support";
import { checksum, retentionDate } from "@/lib/pipeline/analyze";
import { canAcceptBackgroundJobs, enqueueJob } from "@/lib/queue/jobs";
import { scanForMalware } from "@/lib/security";
import { ensureStorage } from "@/lib/storage/fs";
import { saveDocument } from "@/lib/storage/db";
import { putOriginalObject } from "@/lib/storage/object-store";
import { badRequest, json, serviceUnavailable } from "@/lib/http";
import { DocumentRecord } from "@/lib/types";

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

export async function POST(request: Request) {
  const user = effectiveUser(request);
  if (!canAcceptBackgroundJobs()) {
    return serviceUnavailable("Background processing is not available. Configure RABBITMQ_URL before accepting uploads in production.");
  }
  await ensureStorage();
  const formData = await request.formData();
  const file = formData.get("file");
  const budget = formData.get("budget") === "premium" ? "premium" : formData.get("budget") === "economy" ? "economy" : "standard";
  const urgency = formData.get("urgency") === "express" ? "express" : "normal";

  if (!(file instanceof File)) return badRequest("Attach a document file using the `file` field.");
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return badRequest(`Upload limit is ${MAX_UPLOAD_MB} MB.`);

  const originalName = sanitizeFilename(file.name);
  const extension = path.extname(originalName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return badRequest(`Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`);
  }

  const id = uuidv4();
  const storedName = `${id}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const malwareScan = scanForMalware(buffer);
  if (malwareScan.status === "blocked") {
    return badRequest(`Upload blocked by malware scan: ${malwareScan.findings.join(", ")}`);
  }
  const storagePath = await putOriginalObject(id, extension, buffer);

  const now = new Date().toISOString();
  const document: DocumentRecord = {
    id,
    userId: user.id,
    filename: storedName,
    originalName,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    pageCount: 1,
    status: "analyzing",
    storagePath,
    createdAt: now,
    updatedAt: now,
    tags: ["uploaded", extension.replace(".", "")],
    metadata: {
      extension,
      checksum: checksum(buffer),
      retentionUntil: retentionDate(RETENTION_DAYS),
      colorPercentage: 0,
      budget,
      urgency,
      malwareScan,
      detectedCategory: detectedCategory(extension)
    },
    translations: [],
    reformats: [],
    versions: [
      {
        id: uuidv4(),
        version: 1,
        storagePath,
        checksum: checksum(buffer),
        createdAt: now,
        reason: "Initial upload"
      }
    ],
    generated: {
      summaries: [],
      flashcards: [],
      studyGuides: [],
      answers: []
    },
    compliance: {
      findings: [],
      riskScore: 0,
      policyTags: ["pending-analysis"],
      redactions: []
    },
    extraction: {
      entities: [],
      fields: {},
      tables: [],
      confidence: 0,
      extractedAt: now
    },
    validation: {
      readinessScore: 0,
      checks: [],
      validatedAt: now
    },
    auditLog: [
      {
        id: uuidv4(),
        type: "document.uploaded",
        message: "Original file scanned, stored, versioned, and queued for background AI document intelligence processing.",
        createdAt: now
      }
    ]
  };

  await saveDocument(document);
  await enqueueJob({
    id: uuidv4(),
    type: "document.full_pipeline",
    documentId: id,
    status: "queued",
    progress: 5,
    message: "Queued for background processing by the RabbitMQ worker.",
    attempts: 0,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now
  });

  return json({ document, processing: "queued" }, 202);
}
