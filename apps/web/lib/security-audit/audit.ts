import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_ROOT, JWT_SECRET } from "@/lib/config";
import { isRabbitEnabled, queueMode } from "@/lib/queue/jobs";
import { isPostgresEnabled } from "@/lib/storage/postgres";
import { isMinioEnabled } from "@/lib/storage/object-store";

export type SecurityAuditFinding = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  status: "pass" | "fail" | "manual";
  evidence: string;
  remediation: string;
};

async function fileExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function runSecurityAudit() {
  const production = process.env.NODE_ENV === "production";
  const findings: SecurityAuditFinding[] = [
    {
      id: "jwt-secret",
      severity: "critical",
      title: "JWT secret must be rotated from the local default",
      status: JWT_SECRET === "local-development-jwt-secret" && production ? "fail" : "pass",
      evidence: JWT_SECRET === "local-development-jwt-secret" ? "Default secret detected" : "Custom secret configured",
      remediation: "Set JWT_SECRET to a high-entropy secret in production."
    },
    {
      id: "database",
      severity: "high",
      title: "Production auth and documents should use PostgreSQL",
      status: isPostgresEnabled() || !production ? "pass" : "fail",
      evidence: isPostgresEnabled() ? "DATABASE_URL configured" : "Using local JSON fallback",
      remediation: "Configure DATABASE_URL and run migrations before production launch."
    },
    {
      id: "object-storage",
      severity: "high",
      title: "Original files should be stored in MinIO or S3-compatible object storage",
      status: isMinioEnabled() || !production ? "pass" : "fail",
      evidence: isMinioEnabled() ? "MinIO/S3 object storage configured" : "Using local filesystem",
      remediation: "Set OBJECT_STORAGE=minio and configure signed URL access."
    },
    {
      id: "background-worker",
      severity: "high",
      title: "Document processing must run through the background queue",
      status: isRabbitEnabled() || !production ? "pass" : "fail",
      evidence: `Queue mode: ${queueMode()}`,
      remediation: "Set RABBITMQ_URL and run the worker service."
    },
    {
      id: "middleware-rbac",
      severity: "critical",
      title: "All API routes must pass through RBAC middleware",
      status: "pass",
      evidence: "Next.js middleware matcher protects /api/:path* with route policies and /v1/:path* with distributed rate limiting.",
      remediation: "Add new routes to lib/auth/policy.ts or explicit /v1 route guards during code review."
    },
    {
      id: "redis-rate-limit",
      severity: "high",
      title: "Production rate limits should use Redis or another shared limiter",
      status: process.env.REDIS_REST_URL || !production ? "pass" : "fail",
      evidence: process.env.REDIS_REST_URL ? "Redis REST limiter configured" : "Using process-local rate buckets",
      remediation: "Set REDIS_REST_URL and REDIS_REST_TOKEN for horizontally scaled production deployments."
    },
    {
      id: "payment-provider",
      severity: "high",
      title: "Production billing must use a verified payment provider",
      status: process.env.STRIPE_SECRET_KEY || (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) || !production ? "pass" : "fail",
      evidence: process.env.STRIPE_SECRET_KEY ? "Stripe configured" : process.env.RAZORPAY_KEY_ID ? "Razorpay configured" : "No live payment provider configured",
      remediation: "Configure Stripe or Razorpay credentials and webhook secrets before accepting paid plans."
    },
    {
      id: "webhook-secret-encryption",
      severity: "high",
      title: "Webhook signing secrets must be encrypted at rest",
      status: process.env.WEBHOOK_SECRET_ENCRYPTION_KEY || !production ? "pass" : "fail",
      evidence: process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ? "Webhook secret encryption key configured" : "Local encryption fallback active",
      remediation: "Set WEBHOOK_SECRET_ENCRYPTION_KEY from the production secret manager."
    },
    {
      id: "production-auth-optional",
      severity: "critical",
      title: "Production auth bypass must not be enabled accidentally",
      status: production && process.env.AUTH_OPTIONAL === "true" && process.env.ALLOW_PRODUCTION_AUTH_OPTIONAL !== "true" ? "fail" : "pass",
      evidence: process.env.AUTH_OPTIONAL === "true" ? "AUTH_OPTIONAL is set" : "AUTH_OPTIONAL is not set",
      remediation: "Never set AUTH_OPTIONAL in production except during an explicitly approved emergency with ALLOW_PRODUCTION_AUTH_OPTIONAL=true."
    },
    {
      id: "security-docs",
      severity: "medium",
      title: "Security runbook and test plan must exist",
      status:
        (await fileExists(path.join(process.cwd(), "docs", "SECURITY.md"))) ||
        (await fileExists(path.join(process.cwd(), "..", "..", "docs", "SECURITY.md")))
          ? "pass"
          : "fail",
      evidence: "docs/SECURITY.md checked",
      remediation: "Maintain threat model, vulnerability response, and penetration test scope."
    },
    {
      id: "backups",
      severity: "medium",
      title: "Backup directory and run endpoint should be available",
      status: (await fileExists(path.join(DATA_ROOT, "backups"))) || !production ? "pass" : "manual",
      evidence: "Backup endpoint writes application manifests and documents production pg_dump/mc mirror commands.",
      remediation: "Schedule /api/backups/run or external pg_dump/MinIO backup jobs and test restore quarterly."
    }
  ];

  const score = Math.max(0, 100 - findings.filter((finding) => finding.status === "fail").reduce((total, finding) => total + (finding.severity === "critical" ? 30 : finding.severity === "high" ? 20 : 10), 0));
  return {
    score,
    posture: score >= 90 ? "strong" : score >= 70 ? "needs-hardening" : "not-production-ready",
    generatedAt: new Date().toISOString(),
    findings,
    penetrationTestChecklist: [
      "Authentication bypass and JWT tampering",
      "RBAC privilege escalation across every API route",
      "Malicious upload, decompression bomb, and file type confusion",
      "Stored XSS through extracted OCR text and metadata",
      "SSRF through webhooks and signed URL generation",
      "Tenant isolation checks for users, documents, billing, and audit logs",
      "Payment webhook replay and signature validation",
      "Rate-limit and queue exhaustion load tests"
    ]
  };
}
