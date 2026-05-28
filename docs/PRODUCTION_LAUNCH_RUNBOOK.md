# Production Launch Runbook

## Required Before Real Users

- Apply `database/migrations/*.sql` to PostgreSQL with pgvector enabled.
- Set production secrets through the deployment secret manager, not Git or compose defaults.
- Configure `JWT_SECRET`, `INTERNAL_WORKER_SECRET`, `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, MinIO/S3 credentials, payment webhook secrets, and Redis REST credentials.
- Run the web app, worker, PostgreSQL, object storage, RabbitMQ, and optional OpenSearch as separate services.
- Put TLS and WAF/rate-limit protection in front of the web service.
- Configure backups for PostgreSQL, object storage, and RabbitMQ metadata.

## Staging Verification

```powershell
npm run test
npm run build
node scripts/load-test.mjs
node scripts/ocr-benchmark.mjs
```

## Release Gates

- Unit/integration tests pass.
- Next.js production build passes.
- P95 latency for `/v1/billing/subscription` is below 500 ms under the configured load test.
- OCR benchmark release gate passes on the golden dataset.
- Payment webhooks verify signatures and create payment records.
- Worker completes `analyze`, `ocr`, `translate`, and `reformat` jobs asynchronously.
- Webhook dispatcher records delivery attempts and HMAC-signs payloads.
- Tenant A cannot read Tenant B documents, jobs, usage, invoices, API keys, or webhooks.

## Operational Checks

- Confirm queue depth and dead-letter queue are monitored.
- Confirm `/api/monitoring/health` and `/api/monitoring/metrics` are scraped.
- Perform a restore drill before launch.
- Rotate API keys and verify revoked keys fail immediately.
- Test quota exceedance responses for page, OCR, API call, and storage meters.
