import { DocumentRecord, DocumentType, Recommendation } from "@/lib/types";

const docTypePaper: Record<DocumentType, Recommendation> = {
  resume: {
    category: "paper",
    title: "Premium 100 GSM matte paper",
    reason: "Resumes benefit from a crisp, professional hand-feel and sharp black text.",
    priority: "important",
    estimatedCostImpact: "medium"
  },
  thesis: {
    category: "binding",
    title: "Hard binding with laminated cover",
    reason: "Thesis submissions usually need durable binding, protected covers, and clean margins.",
    priority: "critical",
    estimatedCostImpact: "high"
  },
  notes: {
    category: "binding",
    title: "Spiral binding with economy paper",
    reason: "Notes are easiest to study when they lay flat and stay inexpensive.",
    priority: "standard",
    estimatedCostImpact: "low"
  },
  invoice: {
    category: "paper",
    title: "Economy black-and-white printing",
    reason: "Invoices rarely need color or premium stock unless branding is required.",
    priority: "standard",
    estimatedCostImpact: "low"
  },
  certificate: {
    category: "paper",
    title: "Glossy photo paper or 220 GSM card",
    reason: "Certificates need richer color reproduction and heavier stock.",
    priority: "important",
    estimatedCostImpact: "medium"
  },
  contract: {
    category: "workflow",
    title: "Searchable PDF with audit retention",
    reason: "Contracts should be searchable, versioned, and retained with access logs.",
    priority: "critical",
    estimatedCostImpact: "medium"
  },
  report: {
    category: "formatting",
    title: "Professional report cleanup",
    reason: "Reports often need consistent headings, page numbers, and export-ready structure.",
    priority: "important",
    estimatedCostImpact: "medium"
  },
  presentation: {
    category: "formatting",
    title: "Slide-safe layout reconstruction",
    reason: "Presentation files should preserve visual hierarchy and image alignment.",
    priority: "important",
    estimatedCostImpact: "medium"
  },
  "government-record": {
    category: "compliance",
    title: "Archive-grade OCR and metadata extraction",
    reason: "Government records require searchable scans, metadata, and retention controls.",
    priority: "critical",
    estimatedCostImpact: "high"
  },
  general: {
    category: "workflow",
    title: "Standard OCR and quality repair",
    reason: "A general document should be made searchable and checked before printing.",
    priority: "standard",
    estimatedCostImpact: "low"
  }
};

export function recommend(document: DocumentRecord, documentType: DocumentType, qualityScore: number, complianceRiskScore = 0): Recommendation[] {
  const recommendations: Recommendation[] = [docTypePaper[documentType]];

  if (document.metadata.colorPercentage > 30) {
    recommendations.push({
      category: "paper",
      title: "Use color print preview before checkout",
      reason: "The document appears to include meaningful color content.",
      priority: "important",
      estimatedCostImpact: "medium"
    });
  }

  if (qualityScore < 70) {
    recommendations.push({
      category: "formatting",
      title: "Run auto-cleanup before printing",
      reason: "Quality analysis found issues that may affect OCR or printed output.",
      priority: "critical",
      estimatedCostImpact: "low"
    });
  }

  if (document.pageCount > 80) {
    recommendations.push({
      category: "binding",
      title: "Prefer thermal or hard binding",
      reason: "Large documents need stronger binding than staples or simple folders.",
      priority: "important",
      estimatedCostImpact: "high"
    });
  }

  if (document.metadata.urgency === "express") {
    recommendations.push({
      category: "delivery",
      title: "Route to express print workflow",
      reason: "Urgent delivery should skip optional manual review unless quality is critical.",
      priority: "important",
      estimatedCostImpact: "medium"
    });
  }

  if (complianceRiskScore >= 45) {
    recommendations.push({
      category: "privacy",
      title: "Create a redacted sharing copy",
      reason: "Sensitive personal or regulated data was detected in the extracted text.",
      priority: "critical",
      estimatedCostImpact: "low"
    });
  }

  if (document.metadata.detectedCategory === "image" && qualityScore >= 80) {
    recommendations.push({
      category: "marketplace",
      title: "Offer photo-quality print vendors",
      reason: "The file is an image with acceptable quality for premium visual output.",
      priority: "standard",
      estimatedCostImpact: "medium"
    });
  }

  return recommendations;
}
