import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production adapters are present", async () => {
  const files = [
    "apps/web/lib/storage/postgres.ts",
    "apps/web/lib/storage/object-store.ts",
    "apps/web/lib/queue/jobs.ts",
    "apps/web/lib/auth/jwt.ts",
    "apps/web/lib/pipeline/real-ocr.ts"
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.ok(source.length > 100, file);
  }
});

test("production compose includes postgres minio rabbitmq and opensearch", async () => {
  const compose = await readFile("docker-compose.production.yml", "utf8");
  for (const service of ["pgvector/pgvector", "minio/minio", "rabbitmq", "opensearchproject/opensearch"]) {
    assert.match(compose, new RegExp(service.replace("/", "\\/")));
  }
});

test("advanced production hardening surfaces are implemented", async () => {
  const files = [
    "apps/web/middleware.ts",
    "apps/web/lib/auth/users.ts",
    "apps/web/app/api/internal/jobs/process/route.ts",
    "apps/web/app/api/monitoring/metrics/route.ts",
    "apps/web/app/api/backups/run/route.ts",
    "apps/web/app/api/payments/checkout/route.ts",
    "apps/web/app/api/benchmarks/ocr/route.ts",
    "apps/web/app/api/security/audit/route.ts"
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.ok(source.length > 100, file);
  }

  const uploadRoute = await readFile("apps/web/app/api/documents/upload/route.ts", "utf8");
  assert.doesNotMatch(uploadRoute, /runFullPipeline/);
  assert.match(uploadRoute, /Queued for background processing/);

  const analyzeRoute = await readFile("apps/web/app/api/documents/[id]/analyze/route.ts", "utf8");
  assert.doesNotMatch(analyzeRoute, /runFullPipeline/);
  assert.match(analyzeRoute, /enqueueJob/);

  const worker = await readFile("apps/worker/src/worker.mjs", "utf8");
  assert.match(worker, /document-jobs-dead/);
  assert.match(worker, /maxAttempts/);

  const policy = await readFile("apps/web/lib/auth/policy.ts", "utf8");
  assert.match(policy, /permissionForRequest/);
  assert.match(policy, /DELETE/);

  const paymentWebhook = await readFile("apps/web/app/api/payments/webhook/route.ts", "utf8");
  assert.match(paymentWebhook, /timingSafeEqual/);
  assert.match(paymentWebhook, /STRIPE_WEBHOOK_SECRET/);
});

test("google oauth and cost-aware processing are wired", async () => {
  const google = await readFile("apps/web/lib/auth/google.ts", "utf8");
  assert.match(google, /code_challenge_method/);
  assert.match(google, /GOOGLE_ALLOWED_DOMAINS/);

  const startRoute = await readFile("apps/web/app/api/auth/google/start/route.ts", "utf8");
  const callbackRoute = await readFile("apps/web/app/api/auth/google/callback/route.ts", "utf8");
  assert.match(startRoute, /google_oauth_state/);
  assert.match(callbackRoute, /upsertOAuthUser/);
  assert.match(callbackRoute, /intellidoc_session/);

  const users = await readFile("apps/web/lib/auth/users.ts", "utf8");
  assert.match(users, /upsertOAuthUser/);
  assert.match(users, /oauthSubject/);

  const pipeline = await readFile("apps/web/lib/pipeline/analyze.ts", "utf8");
  assert.match(pipeline, /findReusableAnalysis/);
  assert.match(pipeline, /buildProcessingPolicy/);

  const policy = await readFile("apps/web/lib/pipeline/optimization.ts", "utf8");
  assert.match(policy, /expectedSavingsPercent/);
  assert.match(policy, /accuracy-first/);
});
