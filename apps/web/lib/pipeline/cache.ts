import { v4 as uuidv4 } from "uuid";
import { DocumentRecord } from "@/lib/types";
import { listDocuments } from "@/lib/storage/db";

export async function findReusableAnalysis(document: DocumentRecord) {
  if (process.env.DISABLE_ANALYSIS_CACHE === "true") return null;
  const checksum = document.metadata.checksum;
  if (!checksum) return null;
  const documents = await listDocuments();
  return (
    documents.find(
      (candidate) =>
        candidate.id !== document.id &&
        candidate.status === "ready" &&
        candidate.metadata.checksum === checksum &&
        candidate.analysis &&
        candidate.ocr &&
        candidate.embedding
    ) ?? null
  );
}

export function reuseAnalysis(document: DocumentRecord, source: DocumentRecord): DocumentRecord {
  const now = new Date().toISOString();
  return {
    ...document,
    pageCount: source.pageCount,
    status: "ready",
    updatedAt: now,
    tags: [...new Set([...document.tags, ...source.tags, "analysis-cache-hit"])],
    metadata: {
      ...document.metadata,
      colorPercentage: source.metadata.colorPercentage,
      detectedCategory: source.metadata.detectedCategory
    },
    analysis: source.analysis
      ? {
          ...source.analysis,
          extractedMetadata: {
            ...source.analysis.extractedMetadata,
            reusedFromDocumentId: source.id,
            pipelineVersion: "cost-aware-cache-v1",
            costAvoided: "visual-ocr,classification,embedding,extraction"
          },
          analyzedAt: now
        }
      : undefined,
    ocr: source.ocr,
    embedding: source.embedding
      ? {
          ...source.embedding,
          vectorId: uuidv4(),
          createdAt: now
        }
      : undefined,
    compliance: source.compliance,
    extraction: source.extraction,
    validation: source.validation,
    translations: [],
    reformats: [],
    generated: {
      summaries: [],
      flashcards: [],
      studyGuides: [],
      answers: []
    },
    auditLog: [
      ...document.auditLog,
      {
        id: uuidv4(),
        type: "pipeline.cache_hit",
        message: `Reused trusted analysis from duplicate document ${source.id}; skipped OCR, classification, embedding, extraction, and validation work.`,
        createdAt: now
      }
    ]
  };
}
