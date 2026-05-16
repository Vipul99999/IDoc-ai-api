import { listDocuments } from "@/lib/storage/db";
import { isRabbitEnabled, listLocalJobs, queueMode } from "@/lib/queue/jobs";
import { isPostgresEnabled } from "@/lib/storage/postgres";
import { isMinioEnabled } from "@/lib/storage/object-store";
import { isOpenSearchEnabled } from "@/lib/opensearch-adapter";

export async function healthSnapshot() {
  return {
    status: "ok",
    service: "intellidoc-ai",
    checkedAt: new Date().toISOString(),
    dependencies: {
      database: isPostgresEnabled() ? "postgres-configured" : "local-json-store",
      objectStorage: isMinioEnabled() ? "minio-configured" : "local-filesystem",
      queue: queueMode(),
      search: isOpenSearchEnabled() ? "opensearch-configured" : "local-bm25"
    }
  };
}

export async function collectMetrics() {
  const documents = await listDocuments();
  const jobs = listLocalJobs();
  const ready = documents.filter((document) => document.status === "ready").length;
  const failed = documents.filter((document) => document.status === "failed").length;
  const analyzing = documents.filter((document) => document.status === "analyzing").length;
  const avgQuality =
    documents.reduce((total, document) => total + (document.analysis?.qualityScore ?? 0), 0) / Math.max(documents.filter((document) => document.analysis).length, 1);

  return {
    documentsTotal: documents.length,
    documentsReady: ready,
    documentsFailed: failed,
    documentsAnalyzing: analyzing,
    jobsTotal: jobs.length,
    jobsQueued: jobs.filter((job) => job.status === "queued").length,
    jobsFailed: jobs.filter((job) => job.status === "failed").length,
    averageQualityScore: Number(avgQuality.toFixed(2))
  };
}

export function toPrometheus(metrics: Awaited<ReturnType<typeof collectMetrics>>) {
  return [
    "# HELP intellidoc_documents_total Total uploaded documents",
    "# TYPE intellidoc_documents_total gauge",
    `intellidoc_documents_total ${metrics.documentsTotal}`,
    "# HELP intellidoc_documents_ready Ready documents",
    "# TYPE intellidoc_documents_ready gauge",
    `intellidoc_documents_ready ${metrics.documentsReady}`,
    "# HELP intellidoc_documents_failed Failed documents",
    "# TYPE intellidoc_documents_failed gauge",
    `intellidoc_documents_failed ${metrics.documentsFailed}`,
    "# HELP intellidoc_jobs_queued Queued background jobs",
    "# TYPE intellidoc_jobs_queued gauge",
    `intellidoc_jobs_queued ${metrics.jobsQueued}`,
    "# HELP intellidoc_average_quality_score Average analyzed quality score",
    "# TYPE intellidoc_average_quality_score gauge",
    `intellidoc_average_quality_score ${metrics.averageQualityScore}`
  ].join("\n");
}
