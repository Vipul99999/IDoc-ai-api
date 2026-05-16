import { v4 as uuidv4 } from "uuid";
import { DocumentRecord, ValidationCheck } from "@/lib/types";

function check(category: ValidationCheck["category"], status: ValidationCheck["status"], title: string, detail: string, fix: string): ValidationCheck {
  return { id: uuidv4(), category, status, title, detail, fix };
}

export function validateDocument(document: DocumentRecord) {
  const checks: ValidationCheck[] = [];
  const quality = document.analysis?.qualityScore ?? 0;
  const complianceRisk = document.compliance?.riskScore ?? 0;
  const extractionConfidence = document.extraction?.confidence ?? 0;
  const ocrBlocks = document.ocr?.blocks.length ?? 0;
  const ocrConfidence = document.ocr?.blocks.length
    ? document.ocr.blocks.reduce((total, block) => total + block.confidence, 0) / document.ocr.blocks.length
    : 0;
  const reliabilityScore = Number(document.analysis?.extractedMetadata.pipelineReliabilityScore ?? 0);
  const classificationConfidence = Number(document.analysis?.extractedMetadata.classificationConfidence ?? 0);

  checks.push(
    check(
      "print",
      quality >= 80 ? "pass" : quality >= 65 ? "warning" : "fail",
      "Print readiness",
      `Quality score is ${quality}/100.`,
      quality >= 80 ? "Ready for standard print workflow." : "Run cleanup or request a better scan before premium printing."
    )
  );

  checks.push(
    check(
      "privacy",
      complianceRisk >= 70 ? "fail" : complianceRisk >= 35 ? "warning" : "pass",
      "Privacy risk",
      `Compliance risk is ${complianceRisk}/100.`,
      complianceRisk >= 35 ? "Create a redacted copy or require privacy approval before sharing." : "Standard sharing controls are acceptable."
    )
  );

  checks.push(
    check(
      "ocr",
      ocrBlocks > 0 && ocrConfidence >= 0.65 ? "pass" : ocrBlocks > 0 ? "warning" : "fail",
      "OCR coverage",
      `${ocrBlocks} text blocks were extracted with ${Math.round(ocrConfidence * 100)}% average confidence.`,
      ocrBlocks > 0 && ocrConfidence >= 0.65 ? "Search and QA are available." : "Route low-confidence OCR to human review or rerun with higher-quality scans."
    )
  );

  checks.push(
    check(
      "workflow",
      reliabilityScore >= 75 ? "pass" : reliabilityScore >= 55 ? "warning" : "fail",
      "Pipeline reliability",
      `Combined pipeline reliability is ${reliabilityScore}/100.`,
      reliabilityScore >= 75 ? "Automation can proceed." : "Require review before automated downstream decisions."
    )
  );

  checks.push(
    check(
      "workflow",
      classificationConfidence >= 0.72 ? "pass" : classificationConfidence >= 0.55 ? "warning" : "fail",
      "Classification confidence",
      `Document type confidence is ${Math.round(classificationConfidence * 100)}%.`,
      classificationConfidence >= 0.72 ? "Document-specific routing can proceed." : "Ask for review before applying document-type-specific automation."
    )
  );

  checks.push(
    check(
      "business",
      extractionConfidence >= 0.75 ? "pass" : extractionConfidence >= 0.55 ? "warning" : "fail",
      "Structured extraction confidence",
      `Extraction confidence is ${Math.round(extractionConfidence * 100)}%.`,
      extractionConfidence >= 0.75 ? "Ready for automation." : "Route to human review before using in billing, legal, or compliance workflows."
    )
  );

  checks.push(
    check(
      "workflow",
      document.metadata.malwareScan.status === "clean" ? "pass" : "fail",
      "Malware scan",
      `Scan status: ${document.metadata.malwareScan.status}.`,
      document.metadata.malwareScan.status === "clean" ? "File can proceed." : "Block export and vendor handoff."
    )
  );

  const readinessScore = Math.max(0, Math.min(100, Math.round(100 - checks.reduce((sum, item) => sum + (item.status === "fail" ? 22 : item.status === "warning" ? 9 : 0), 0))));
  return { readinessScore, checks, validatedAt: new Date().toISOString() };
}
