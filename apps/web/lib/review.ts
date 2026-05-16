import { v4 as uuidv4 } from "uuid";
import { DocumentRecord, ReviewTask } from "@/lib/types";

export function reviewTasksForDocument(document: DocumentRecord): ReviewTask[] {
  const tasks: ReviewTask[] = [];
  const createdAt = new Date().toISOString();

  if ((document.compliance?.riskScore ?? 0) >= 35) {
    tasks.push({
      id: uuidv4(),
      documentId: document.id,
      title: "Review sensitive data before sharing or print handoff",
      priority: document.compliance.riskScore >= 70 ? "critical" : "high",
      status: "open",
      owner: "privacy",
      createdAt
    });
  }

  if ((document.validation?.readinessScore ?? document.analysis?.qualityScore ?? 0) < 75) {
    tasks.push({
      id: uuidv4(),
      documentId: document.id,
      title: "Resolve print readiness and OCR quality warnings",
      priority: "medium",
      status: "open",
      owner: "print",
      createdAt
    });
  }

  if ((document.extraction?.confidence ?? 1) < 0.7) {
    tasks.push({
      id: uuidv4(),
      documentId: document.id,
      title: "Verify structured extraction fields",
      priority: "medium",
      status: "open",
      owner: "extraction",
      createdAt
    });
  }

  return tasks;
}
