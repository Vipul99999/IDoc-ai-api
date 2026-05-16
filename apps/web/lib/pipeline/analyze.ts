import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { DocumentRecord } from "@/lib/types";
import { complianceRiskScore, detectComplianceFindings, policyTags } from "@/lib/compliance";
import { extractStructuredData } from "@/lib/extraction";
import { averageOcrConfidence, fuseTextSources, pipelineReliabilityScore } from "@/lib/pipeline/accuracy";
import { findReusableAnalysis, reuseAnalysis } from "@/lib/pipeline/cache";
import { classifyDocumentDetailed } from "@/lib/pipeline/classify";
import { createEmbedding } from "@/lib/pipeline/embedding";
import { analyzeQuality, estimateColorPercentage, estimatePageCount } from "@/lib/pipeline/quality";
import { buildProcessingPolicy } from "@/lib/pipeline/optimization";
import { recommend } from "@/lib/pipeline/recommend";
import { detectLanguage, extractReadableTextAdvanced, summarizeText } from "@/lib/pipeline/text";
import { runOcr } from "@/lib/pipeline/ocr";
import { writeOutput } from "@/lib/storage/fs";
import { validateDocument } from "@/lib/validation";

export function checksum(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function retentionDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export async function runFullPipeline(document: DocumentRecord, buffer: Buffer) {
  const reusable = await findReusableAnalysis(document);
  if (reusable) return reuseAnalysis(document, reusable);

  const nativeParse = await extractReadableTextAdvanced(buffer, document.originalName);
  const embeddedText = nativeParse.text;
  const initialPageCount = estimatePageCount(document.mimeType, document.metadata.extension, document.size, embeddedText);
  const colorPercentage = estimateColorPercentage(document.metadata.extension, document.originalName, embeddedText);
  const prepared: DocumentRecord = {
    ...document,
    pageCount: initialPageCount,
    metadata: { ...document.metadata, colorPercentage }
  };
  const nativeCoverageEstimate = Math.min(100, Math.round((embeddedText.length / Math.max(1, initialPageCount * 400)) * 100));
  const initialPolicy = buildProcessingPolicy(prepared, nativeParse.confidence, nativeCoverageEstimate);
  const ocr = await runOcr(prepared, embeddedText, buffer, { visualOcr: initialPolicy.visualOcr });
  const ocrConfidence = averageOcrConfidence(ocr.blocks);
  const fusedText = fuseTextSources(embeddedText, ocr.extractedText, ocrConfidence, prepared.pageCount);
  const processingPolicy = buildProcessingPolicy(prepared, nativeParse.confidence, fusedText.coverageScore);
  const analysisText = fusedText.text;
  const classification = classifyDocumentDetailed(analysisText, prepared.originalName);
  const documentType = classification.type;
  const language = detectLanguage(analysisText);
  const qualityBase = analyzeQuality(prepared, analysisText);
  const quality = {
    ...qualityBase,
    issues: [...qualityBase.issues, ...fusedText.issues],
    qualityScore: Math.max(0, qualityBase.qualityScore - fusedText.issues.filter((issue) => issue.severity === "high").length * 10 - fusedText.issues.filter((issue) => issue.severity === "medium").length * 5)
  };
  const complianceFindings = detectComplianceFindings(analysisText);
  const riskScore = complianceRiskScore(complianceFindings);
  const recommendations = recommend(prepared, documentType, quality.qualityScore, riskScore);
  const summary = summarizeText(analysisText, prepared.originalName);
  const extractionBase = { ...prepared, analysis: { documentType, qualityScore: quality.qualityScore, orientation: quality.orientation, language, issues: quality.issues, pages: quality.pages, recommendations, summary, extractedMetadata: {}, processedOutputPath: "", analyzedAt: new Date().toISOString() }, ocr };
  const extraction = extractStructuredData(extractionBase);
  const reliabilityScore = pipelineReliabilityScore({
    qualityScore: quality.qualityScore,
    ocrConfidence,
    coverageScore: fusedText.coverageScore,
    extractionConfidence: extraction.confidence,
    issueCount: quality.issues.length
  });
  const validation = validateDocument({
    ...extractionBase,
    analysis: {
      ...extractionBase.analysis,
      extractedMetadata: {
        pipelineReliabilityScore: String(reliabilityScore)
      }
    },
    extraction,
    compliance: { findings: complianceFindings, riskScore, policyTags: policyTags(complianceFindings), redactions: prepared.compliance?.redactions ?? [] }
  });
  const vector = createEmbedding(`${prepared.originalName} ${analysisText} ${summary}`);
  const processedOutputPath = await writeOutput(
    prepared.id,
    "analysis-result.json",
    JSON.stringify({ documentType, language, quality, complianceFindings, recommendations, summary, classification, fusedText, reliabilityScore, processingPolicy }, null, 2)
  );

  return {
    ...prepared,
    status: "ready" as const,
    updatedAt: new Date().toISOString(),
    analysis: {
      documentType,
      qualityScore: quality.qualityScore,
      orientation: quality.orientation,
      language,
      issues: quality.issues,
      pages: quality.pages,
      recommendations,
      summary,
      extractedMetadata: {
        checksum: prepared.metadata.checksum,
        storageClass: "local-object-storage",
        detectedFormat: prepared.metadata.extension.replace(".", "").toUpperCase(),
        pipelineVersion: "accuracy-fused-pipeline-v2",
        processingTier: processingPolicy.tier,
        processingPolicy: JSON.stringify(processingPolicy),
        estimatedCostSavingsPercent: String(processingPolicy.expectedSavingsPercent),
        nativeParser: nativeParse.engine,
        nativeParseConfidence: String(nativeParse.confidence),
        nativeStructure: JSON.stringify(nativeParse.structure),
        textSource: fusedText.source,
        embeddedTextLength: String(fusedText.embeddedLength),
        ocrTextLength: String(fusedText.ocrLength),
        ocrConfidence: String(ocrConfidence),
        textCoverageScore: String(fusedText.coverageScore),
        classificationConfidence: String(classification.confidence),
        pipelineReliabilityScore: String(reliabilityScore)
      },
      processedOutputPath,
      analyzedAt: new Date().toISOString()
    },
    ocr,
    embedding: {
      vectorId: uuidv4(),
      vector,
      model: "local-hash-vector-v1",
      createdAt: new Date().toISOString()
    },
    compliance: {
      findings: complianceFindings,
      riskScore,
      policyTags: policyTags(complianceFindings),
      redactions: prepared.compliance?.redactions ?? []
    },
    extraction,
    validation,
    auditLog: [
      ...prepared.auditLog,
      {
        id: uuidv4(),
        type: "pipeline.completed",
        message: `Completed OCR-first accuracy pipeline with ${reliabilityScore}/100 reliability using ${fusedText.source} text.`,
        createdAt: new Date().toISOString()
      }
    ]
  };
}
