import { promises as fs } from "node:fs";
import { DocumentRecord } from "@/lib/types";
import { detectedCategory } from "@/lib/format-support";
import { outputPath, documentPath, ensureStorage, safeRemoveDir, safeUnlink } from "@/lib/storage/fs";
import { deleteOriginalObject } from "@/lib/storage/object-store";
import {
  deleteDocumentPostgres,
  getDocumentForTenantPostgres,
  getDocumentPostgres,
  isPostgresEnabled,
  listDocumentsForTenantPostgres,
  listDocumentsPostgres,
  saveDocumentPostgres
} from "@/lib/storage/postgres";

function normalizeDocument(document: DocumentRecord): DocumentRecord {
  return {
    ...document,
    versions: document.versions ?? [],
    generated: document.generated ?? {
      summaries: [],
      flashcards: [],
      studyGuides: [],
      answers: []
    },
    compliance: document.compliance ?? {
      findings: [],
      riskScore: 0,
      policyTags: ["standard-retention"],
      redactions: []
    },
    extraction: document.extraction ?? {
      entities: [],
      fields: {},
      tables: [],
      confidence: 0,
      extractedAt: document.createdAt
    },
    validation: document.validation ?? {
      readinessScore: document.analysis?.qualityScore ?? 0,
      checks: [],
      validatedAt: document.updatedAt
    },
    metadata: {
      ...document.metadata,
      malwareScan: document.metadata.malwareScan ?? {
        status: "clean",
        engine: "legacy-import",
        findings: [],
        scannedAt: document.createdAt
      },
      detectedCategory: document.metadata.detectedCategory ?? detectedCategory(document.metadata.extension)
    }
  };
}

export async function saveDocument(document: DocumentRecord) {
  if (isPostgresEnabled()) {
    await saveDocumentPostgres(normalizeDocument(document));
    return document;
  }
  await ensureStorage();
  await fs.writeFile(documentPath(document.id), JSON.stringify(document, null, 2));
  return document;
}

export async function getDocument(id: string) {
  if (isPostgresEnabled()) {
    const document = await getDocumentPostgres(id);
    return document ? normalizeDocument(document) : null;
  }
  await ensureStorage();
  try {
    const raw = await fs.readFile(documentPath(id), "utf8");
    return normalizeDocument(JSON.parse(raw) as DocumentRecord);
  } catch {
    return null;
  }
}

export async function listDocuments() {
  if (isPostgresEnabled()) {
    const documents = await listDocumentsPostgres();
    if (documents) return documents.map(normalizeDocument);
  }
  await ensureStorage();
  const files = await fs.readdir(documentPath("").replace(".json", ""));
  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => normalizeDocument(JSON.parse(await fs.readFile(documentPath(file.replace(".json", "")), "utf8")) as DocumentRecord))
  );
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDocumentForTenant(id: string, organizationId: string) {
  if (isPostgresEnabled()) {
    const document = await getDocumentForTenantPostgres(id, organizationId);
    return document ? normalizeDocument(document) : null;
  }
  const document = await getDocument(id);
  if (!document) return null;
  return document.organizationId === organizationId || !document.organizationId ? document : null;
}

export async function listDocumentsForTenant(organizationId: string) {
  if (isPostgresEnabled()) {
    const documents = await listDocumentsForTenantPostgres(organizationId);
    if (documents) return documents.map(normalizeDocument);
  }
  const documents = await listDocuments();
  return documents.filter((document) => document.organizationId === organizationId || !document.organizationId);
}

export async function updateDocument(id: string, updater: (document: DocumentRecord) => DocumentRecord | Promise<DocumentRecord>) {
  const document = await getDocument(id);
  if (!document) return null;
  const next = await updater({ ...document, updatedAt: new Date().toISOString() });
  return saveDocument(next);
}

export async function deleteDocument(id: string) {
  const document = await getDocument(id);
  if (!document) return false;
  await deleteOriginalObject(document.storagePath);
  await safeRemoveDir(outputPath(id, "").replace(/[\\/]$/, ""));
  if (isPostgresEnabled()) {
    await deleteDocumentPostgres(id);
    return true;
  }
  await safeUnlink(documentPath(id));
  return true;
}
