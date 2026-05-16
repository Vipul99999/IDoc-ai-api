import { DocumentRecord } from "@/lib/types";

export function workflowForDocument(document: DocumentRecord) {
  const steps = [
    {
      id: "intake",
      label: "Secure intake",
      status: "complete",
      owner: "Upload Service"
    },
    {
      id: "analysis",
      label: "AI analysis",
      status: document.analysis ? "complete" : "pending",
      owner: "AI Pipeline"
    },
    {
      id: "privacy-review",
      label: "Privacy review",
      status: document.compliance?.riskScore >= 45 ? "needs_review" : "complete",
      owner: "Compliance"
    },
    {
      id: "print-approval",
      label: "Print approval",
      status: (document.analysis?.qualityScore ?? 0) < 70 ? "needs_review" : "ready",
      owner: "Operations"
    },
    {
      id: "delivery",
      label: "Vendor handoff",
      status: "ready",
      owner: "Marketplace"
    }
  ];

  return {
    documentId: document.id,
    status: steps.some((step) => step.status === "needs_review") ? "needs_review" : "ready",
    steps
  };
}
