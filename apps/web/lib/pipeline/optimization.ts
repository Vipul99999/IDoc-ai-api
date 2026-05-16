import { DocumentRecord } from "@/lib/types";

export type ProcessingPolicy = {
  tier: "low-cost" | "balanced" | "accuracy-first";
  nativeParsing: boolean;
  visualOcr: boolean;
  aiServiceFallback: boolean;
  embeddings: boolean;
  expectedSavingsPercent: number;
  reasons: string[];
};

export function buildProcessingPolicy(document: DocumentRecord, nativeConfidence: number, textCoverageScore = 0): ProcessingPolicy {
  const category = document.metadata.detectedCategory;
  const imageLike = category === "image" || document.metadata.extension === ".pdf";
  const strongNativeText = nativeConfidence >= 0.78 && textCoverageScore >= 72;
  const lowValueVisualPass = category === "office" || category === "text" || category === "data";
  const budgetConstrained = document.metadata.budget === "economy" || process.env.PROCESSING_COST_PROFILE === "low-cost";
  const accuracyFirst = process.env.PROCESSING_COST_PROFILE === "accuracy-first" || document.metadata.urgency === "express";

  const visualOcr = accuracyFirst || (imageLike && !strongNativeText);
  const aiServiceFallback = accuracyFirst || (!budgetConstrained && visualOcr);
  const tier = accuracyFirst ? "accuracy-first" : budgetConstrained || lowValueVisualPass ? "low-cost" : "balanced";
  const expectedSavingsPercent = visualOcr ? (aiServiceFallback ? 10 : 24) : 55;
  const reasons = [
    `format:${category}`,
    `native-confidence:${nativeConfidence.toFixed(2)}`,
    `coverage:${Math.round(textCoverageScore)}`,
    `budget:${document.metadata.budget}`,
    `urgency:${document.metadata.urgency}`
  ];
  if (!visualOcr) reasons.push("skipped-visual-ocr-strong-native-extraction");
  if (!aiServiceFallback) reasons.push("deferred-paid-ai-fallback");

  return {
    tier,
    nativeParsing: true,
    visualOcr,
    aiServiceFallback,
    embeddings: true,
    expectedSavingsPercent,
    reasons
  };
}
