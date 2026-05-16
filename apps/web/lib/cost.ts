import { DocumentRecord } from "@/lib/types";

export type CostEstimate = {
  documentId?: string;
  currency: "INR" | "USD";
  processing: {
    ocr: number;
    translation: number;
    formatting: number;
    searchIndexing: number;
    storageMonthly: number;
  };
  print: {
    paper: number;
    color: number;
    binding: number;
    delivery: number;
  };
  infrastructureMonthly: {
    appServer: number;
    database: number;
    objectStorage: number;
    queue: number;
    search: number;
    aiCompute: number;
  };
  totals: {
    documentProcessing: number;
    printOrder: number;
    infrastructureMonthly: number;
  };
  optimizations: Array<{
    title: string;
    saving: number;
    impact: "low" | "medium" | "high";
    tradeoff: string;
  }>;
};

export function estimateDocumentCost(document?: DocumentRecord): CostEstimate {
  const pageCount = document?.pageCount ?? 25;
  const colorPercentage = document?.metadata.colorPercentage ?? 15;
  const quality = document?.analysis?.qualityScore ?? 80;
  const complianceRisk = document?.compliance?.riskScore ?? 0;
  const isColorHeavy = colorPercentage > 25;
  const needsReview = quality < 70 || complianceRisk > 35;

  const processing = {
    ocr: round(pageCount * 0.08),
    translation: round((document?.translations.length ?? 0) * pageCount * 0.18),
    formatting: round((document?.reformats.length ? 1 : 0) * Math.max(3, pageCount * 0.04)),
    searchIndexing: round(pageCount * 0.015),
    storageMonthly: round((document?.size ?? 2_000_000) / 1024 / 1024 * 0.002)
  };

  const print = {
    paper: round(pageCount * (document?.metadata.budget === "premium" ? 2.8 : 1.2)),
    color: round(pageCount * (isColorHeavy ? 4.5 : 0.4)),
    binding: pageCount > 80 ? 320 : pageCount > 25 ? 70 : 15,
    delivery: document?.metadata.urgency === "express" ? 90 : 35
  };

  const infrastructureMonthly = {
    appServer: 650,
    database: 0,
    objectStorage: 0,
    queue: 0,
    search: 0,
    aiCompute: 0
  };

  const optimizations = [
    {
      title: "Use local PostgreSQL + pgvector before managed vector databases",
      saving: 2500,
      impact: "high" as const,
      tradeoff: "Requires database backup discipline and basic ops ownership."
    },
    {
      title: "Use MinIO on the same VM for early storage",
      saving: 800,
      impact: "medium" as const,
      tradeoff: "Move to S3-compatible managed storage when backups or scale require it."
    },
    {
      title: "Run OCR on CPU queue workers first",
      saving: 6000,
      impact: "high" as const,
      tradeoff: "Longer processing time for large scanned PDFs."
    },
    {
      title: "Use local BM25 search until corpus exceeds single-node limits",
      saving: 3500,
      impact: "high" as const,
      tradeoff: "OpenSearch gives better observability and scale later."
    },
    {
      title: "Prefer black-and-white print when color content is under 20%",
      saving: isColorHeavy ? 0 : round(pageCount * 3.5),
      impact: "medium" as const,
      tradeoff: "Not suitable for certificates, portfolios, or color-coded notes."
    },
    {
      title: "Skip human review when readiness is high and compliance risk is low",
      saving: needsReview ? 0 : 120,
      impact: "low" as const,
      tradeoff: "Keep review for legal, health, identity, or low-quality documents."
    }
  ].filter((item) => item.saving > 0);

  return {
    documentId: document?.id,
    currency: "INR",
    processing,
    print,
    infrastructureMonthly,
    totals: {
      documentProcessing: round(sum(processing)),
      printOrder: round(sum(print)),
      infrastructureMonthly: round(sum(infrastructureMonthly))
    },
    optimizations
  };
}

export function estimatePortfolioCost(documents: DocumentRecord[]) {
  const estimates = documents.map((document) => estimateDocumentCost(document));
  const processingTotal = estimates.reduce((sumValue, estimate) => sumValue + estimate.totals.documentProcessing, 0);
  const printTotal = estimates.reduce((sumValue, estimate) => sumValue + estimate.totals.printOrder, 0);
  const possibleSavings = estimates.reduce(
    (sumValue, estimate) => sumValue + estimate.optimizations.reduce((inner, item) => inner + item.saving, 0),
    0
  );
  return {
    currency: "INR" as const,
    documents: documents.length,
    processingTotal: round(processingTotal),
    printTotal: round(printTotal),
    baselineInfrastructureMonthly: 13450,
    optimizedInfrastructureMonthly: 650,
    possibleSavings: round(possibleSavings + 12800),
    recommendedProfile: "single-vm-cpu-first",
    notes: [
      "Use Docker Compose on one VM for early production.",
      "Keep OpenSearch optional until search volume grows.",
      "Use pgvector before a separate vector database.",
      "Batch OCR jobs overnight for lower compute pressure.",
      "Use MinIO locally, then migrate to managed S3 when backups and durability require it."
    ]
  };
}

function sum(values: Record<string, number>) {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
