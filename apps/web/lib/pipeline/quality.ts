import { DocumentRecord, PageAnalysis, QualityIssue } from "@/lib/types";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function estimatePageCount(mimeType: string, extension: string, size: number, text: string) {
  const pageMarkers = text.match(/\bpage\s+\d+\b/gi)?.length ?? 0;
  if (pageMarkers > 1) return Math.min(250, pageMarkers);
  if (extension === ".pdf") return Math.max(1, Math.min(250, Math.round(size / 180000)));
  if (extension === ".docx" || mimeType.includes("word")) return Math.max(1, Math.round(text.length / 2800));
  return 1;
}

export function estimateColorPercentage(extension: string, filename: string, text: string) {
  const lower = `${filename} ${text}`.toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".tiff"].includes(extension)) return lower.includes("black") ? 12 : 58;
  if (lower.includes("certificate") || lower.includes("presentation")) return 44;
  if (lower.includes("invoice") || lower.includes("contract")) return 6;
  return 18;
}

export function analyzeQuality(document: DocumentRecord, text: string) {
  const extension = document.metadata.extension;
  const isImage = [".png", ".jpg", ".jpeg", ".tiff"].includes(extension);
  const densityScore = clamp(Math.round((text.length / Math.max(1, document.pageCount * 1000)) * 35 + 45));
  const sizePerPage = document.size / Math.max(1, document.pageCount);
  const dpi = isImage ? (sizePerPage < 120000 ? 140 : sizePerPage < 500000 ? 220 : 320) : 300;
  const contrastScore = clamp(isImage ? 74 + Math.round(sizePerPage / 90000) : 92);
  const noiseScore = clamp(isImage ? 42 - Math.round(sizePerPage / 130000) : 8);
  const marginRisk = clamp(text.toLowerCase().includes("cropped") ? 84 : isImage ? 31 : 13);
  const blankProbability = clamp(text.length < 30 ? 78 : Math.max(2, 24 - text.length / 500));
  const skewAngle = isImage ? Number(((document.size % 17) / 10).toFixed(1)) : 0;
  const orientation: 0 | 90 | 180 | 270 = document.originalName.toLowerCase().includes("rotated") ? 90 : 0;

  const pages: PageAnalysis[] = Array.from({ length: document.pageCount }, (_, index) => ({
    pageNumber: index + 1,
    dpi,
    orientation,
    blankProbability: index === document.pageCount - 1 && text.length < 150 ? Math.max(blankProbability, 62) : blankProbability,
    skewAngle,
    contrastScore,
    noiseScore,
    marginRisk
  }));

  const issues: QualityIssue[] = [];
  if (dpi < 150) {
    issues.push({
      code: "LOW_DPI",
      severity: "high",
      title: "Low resolution",
      detail: "Estimated DPI is below 150, so print output may look soft or pixelated."
    });
  } else if (dpi < 300) {
    issues.push({
      code: "MEDIUM_DPI",
      severity: "medium",
      title: "Acceptable but not premium resolution",
      detail: "Estimated DPI is printable, but premium documents should be rescanned above 300 DPI."
    });
  }
  if (orientation !== 0) {
    issues.push({
      code: "ROTATION",
      severity: "high",
      title: "Page rotation detected",
      detail: "One or more pages appear rotated and should be corrected before printing or OCR."
    });
  }
  if (blankProbability > 55) {
    issues.push({
      code: "BLANK_PAGE",
      severity: "medium",
      title: "Possible blank page",
      detail: "Very low text or pixel density suggests a blank or near-blank page."
    });
  }
  if (marginRisk > 60) {
    issues.push({
      code: "MARGIN_CUTOFF",
      severity: "high",
      title: "Margin cut-off risk",
      detail: "Content may sit too close to page edges and should be fitted before binding."
    });
  }
  if (contrastScore < 65) {
    issues.push({
      code: "LOW_CONTRAST",
      severity: "medium",
      title: "Low contrast",
      detail: "Foreground and background separation may reduce readability."
    });
  }

  const penalties = issues.reduce((sum, issue) => sum + (issue.severity === "high" ? 16 : issue.severity === "medium" ? 9 : 4), 0);
  const qualityScore = clamp(Math.round((densityScore + contrastScore + dpi / 4) / 3 - penalties));

  return { pages, issues, qualityScore, orientation };
}
