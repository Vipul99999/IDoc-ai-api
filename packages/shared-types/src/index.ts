export type TenantRole = "owner" | "admin" | "analyst" | "viewer" | "api_client";

export type DocumentKind =
  | "resume"
  | "thesis"
  | "invoice"
  | "contract"
  | "notes"
  | "certificate"
  | "passport"
  | "legal_document"
  | "government_record"
  | "general";

export type JobType =
  | "preprocess"
  | "classify"
  | "quality"
  | "ocr"
  | "translate"
  | "format"
  | "embed"
  | "summarize"
  | "bill";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface ApiEnvelope<T> {
  data: T;
  request_id: string;
  tenant_id: string;
  timestamp: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

export interface ApiErrorEnvelope {
  request_id: string;
  tenant_id: string | null;
  timestamp: string;
  error: {
    code: string;
    message: string;
    details: unknown;
    documentation_url: string;
  };
}

export interface ApiJob {
  id: string;
  tenantId: string;
  documentId: string;
  type: "analyze" | "ocr" | "translate" | "reformat";
  status: JobStatus;
  progress: number;
  resultId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualitySignal {
  code: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  pageNumber?: number;
}

export interface DocumentAnalysisResult {
  documentId: string;
  kind: DocumentKind;
  qualityScore: number;
  language: string;
  summary: string;
  signals: QualitySignal[];
  recommendations: Array<{
    category: "paper" | "binding" | "color" | "workflow" | "compliance";
    title: string;
    reason: string;
  }>;
}
