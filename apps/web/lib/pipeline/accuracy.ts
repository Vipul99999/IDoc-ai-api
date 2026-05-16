import { QualityIssue } from "@/lib/types";

export type TextFusionResult = {
  text: string;
  source: "embedded-text" | "ocr" | "hybrid" | "empty";
  embeddedLength: number;
  ocrLength: number;
  ocrConfidence: number;
  coverageScore: number;
  issues: QualityIssue[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAnalysisText(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenCount(text: string) {
  return normalizeAnalysisText(text).split(/\s+/).filter((token) => /[A-Za-z0-9]/.test(token)).length;
}

function alphaRatio(text: string) {
  const normalized = normalizeAnalysisText(text);
  if (!normalized) return 0;
  const alpha = normalized.replace(/[^A-Za-z0-9]/g, "").length;
  return alpha / Math.max(normalized.length, 1);
}

export function averageOcrConfidence(blocks: Array<{ confidence: number }>) {
  if (!blocks.length) return 0;
  return Number((blocks.reduce((total, block) => total + block.confidence, 0) / blocks.length).toFixed(2));
}

export function fuseTextSources(embeddedText: string, ocrText: string, ocrConfidence: number, pageCount: number): TextFusionResult {
  const embedded = normalizeAnalysisText(embeddedText);
  const ocr = normalizeAnalysisText(ocrText);
  const embeddedTokens = tokenCount(embedded);
  const ocrTokens = tokenCount(ocr);
  const embeddedLooksClean = alphaRatio(embedded) > 0.38 && embeddedTokens > 12;
  const ocrLooksClean = alphaRatio(ocr) > 0.34 && ocrTokens > 8;
  const issues: QualityIssue[] = [];

  let source: TextFusionResult["source"] = "empty";
  let text = "";

  if (embeddedLooksClean && ocrLooksClean && ocrTokens > embeddedTokens * 1.25 && ocrConfidence >= 0.45) {
    source = "hybrid";
    text = `${embedded}\n\n${ocr}`;
  } else if (ocrLooksClean && (ocrConfidence >= 0.5 || ocrTokens > embeddedTokens * 2)) {
    source = "ocr";
    text = ocr;
  } else if (embeddedLooksClean) {
    source = "embedded-text";
    text = embedded;
  } else if (ocr) {
    source = "ocr";
    text = ocr;
  }

  const coverageScore = clamp(Math.round((tokenCount(text) / Math.max(1, pageCount * 180)) * 100));
  if (!text) {
    issues.push({
      code: "NO_EXTRACTED_TEXT",
      severity: "high",
      title: "No reliable text extracted",
      detail: "The platform could not obtain enough embedded text or OCR text for high-confidence analysis."
    });
  } else if (coverageScore < 20) {
    issues.push({
      code: "LOW_TEXT_COVERAGE",
      severity: "medium",
      title: "Low text coverage",
      detail: "Only a small amount of reliable text was detected relative to the estimated page count."
    });
  }
  if (source === "ocr" && ocrConfidence > 0 && ocrConfidence < 0.55) {
    issues.push({
      code: "LOW_OCR_CONFIDENCE",
      severity: "medium",
      title: "Low OCR confidence",
      detail: "OCR confidence is below the production threshold; route this document to review before automation."
    });
  }

  return {
    text,
    source,
    embeddedLength: embedded.length,
    ocrLength: ocr.length,
    ocrConfidence,
    coverageScore,
    issues
  };
}

export function pipelineReliabilityScore(input: {
  qualityScore: number;
  ocrConfidence: number;
  coverageScore: number;
  extractionConfidence: number;
  issueCount: number;
}) {
  const weighted =
    input.qualityScore * 0.32 +
    input.ocrConfidence * 100 * 0.24 +
    input.coverageScore * 0.18 +
    input.extractionConfidence * 100 * 0.18 -
    input.issueCount * 4;
  return clamp(Math.round(weighted));
}
