export type DocumentStatus =
  | "uploaded"
  | "analyzing"
  | "ready"
  | "translated"
  | "reformatted"
  | "failed";

export type DocumentType =
  | "resume"
  | "thesis"
  | "notes"
  | "invoice"
  | "certificate"
  | "contract"
  | "report"
  | "presentation"
  | "government-record"
  | "general";

export type QualityIssue = {
  code: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
};

export type PageAnalysis = {
  pageNumber: number;
  dpi: number;
  orientation: 0 | 90 | 180 | 270;
  blankProbability: number;
  skewAngle: number;
  contrastScore: number;
  noiseScore: number;
  marginRisk: number;
  thumbnailPath?: string;
};

export type Recommendation = {
  category: "paper" | "binding" | "formatting" | "workflow" | "delivery" | "compliance" | "privacy" | "marketplace";
  title: string;
  reason: string;
  priority: "standard" | "important" | "critical";
  estimatedCostImpact: "low" | "medium" | "high";
};

export type TranslationRecord = {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  outputPath: string;
  manifestPath?: string;
  engine?: string;
  qualityScore?: number;
  warnings?: string[];
  createdAt: string;
};

export type ReformatRecord = {
  id: string;
  format: "pdf" | "docx" | "pptx";
  outputPath: string;
  manifestPath?: string;
  layoutQualityScore?: number;
  notes: string[];
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

export type DocumentVersion = {
  id: string;
  version: number;
  storagePath: string;
  checksum: string;
  createdAt: string;
  reason: string;
};

export type ComplianceFinding = {
  id: string;
  type: "email" | "phone" | "payment_card" | "tax_id" | "passport" | "health" | "address" | "confidential";
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  sample: string;
  count: number;
  recommendation: string;
};

export type RedactionRecord = {
  id: string;
  outputPath: string;
  redactedTypes: string[];
  createdAt: string;
};

export type ExtractedEntity = {
  id: string;
  type: "person" | "organization" | "email" | "phone" | "date" | "amount" | "invoice_number" | "tax_id" | "skill" | "clause" | "table" | "custom";
  label: string;
  value: string;
  confidence: number;
  source: "text" | "ocr" | "layout" | "rule" | "model";
};

export type ValidationCheck = {
  id: string;
  category: "print" | "privacy" | "ocr" | "format" | "workflow" | "business";
  status: "pass" | "warning" | "fail";
  title: string;
  detail: string;
  fix: string;
};

export type ReviewTask = {
  id: string;
  documentId: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_review" | "resolved";
  owner: "operations" | "privacy" | "extraction" | "print" | "admin";
  createdAt: string;
};

export type DocumentRecord = {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  pageCount: number;
  status: DocumentStatus;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata: {
    extension: string;
    checksum: string;
    retentionUntil: string;
    colorPercentage: number;
    budget: "economy" | "standard" | "premium";
    urgency: "normal" | "express";
    malwareScan: {
      status: "clean" | "suspicious" | "blocked";
      engine: string;
      findings: string[];
      scannedAt: string;
    };
    signedUrlExpiresAt?: string;
    detectedCategory: "pdf" | "image" | "office" | "text" | "data" | "unknown";
  };
  analysis?: {
    documentType: DocumentType;
    qualityScore: number;
    orientation: 0 | 90 | 180 | 270;
    language: string;
    issues: QualityIssue[];
    pages: PageAnalysis[];
    recommendations: Recommendation[];
    summary: string;
    extractedMetadata: Record<string, string>;
    processedOutputPath: string;
    analyzedAt: string;
  };
  ocr?: {
    extractedText: string;
    blocks: Array<{ page: number; text: string; confidence: number; bbox: [number, number, number, number] }>;
    searchablePdfPath: string;
    jsonPath: string;
    createdAt: string;
  };
  embedding?: {
    vectorId: string;
    vector: number[];
    model: string;
    createdAt: string;
  };
  translations: TranslationRecord[];
  reformats: ReformatRecord[];
  versions: DocumentVersion[];
  generated: {
    summaries: Array<{ id: string; text: string; createdAt: string }>;
    flashcards: Array<{ id: string; front: string; back: string; createdAt: string }>;
    studyGuides: Array<{ id: string; sections: string[]; createdAt: string }>;
    answers: Array<{ id: string; question: string; answer: string; createdAt: string }>;
  };
  compliance: {
    findings: ComplianceFinding[];
    riskScore: number;
    policyTags: string[];
    redactions: RedactionRecord[];
  };
  extraction: {
    entities: ExtractedEntity[];
    fields: Record<string, string>;
    tables: Array<{ id: string; headers: string[]; rows: string[][] }>;
    confidence: number;
    extractedAt: string;
  };
  validation: {
    readinessScore: number;
    checks: ValidationCheck[];
    validatedAt: string;
  };
  auditLog: AuditEvent[];
};

export type SearchHit = {
  id: string;
  filename: string;
  documentType: DocumentType | "unknown";
  score: number;
  snippet: string;
  tags: string[];
  language?: string;
  qualityScore?: number;
  complianceRisk?: number;
  matchedFields?: string[];
  rankSignals?: {
    bm25: number;
    semantic: number;
    phrase: number;
    freshness: number;
  };
};
