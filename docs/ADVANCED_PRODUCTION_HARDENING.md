# Advanced Production Hardening

This pass closes the highest-risk production gaps for the document intelligence platform.

## Implemented

- Database-backed user repository with PostgreSQL support and local JSON fallback for development.
- JWT sessions with route-level RBAC enforced by Next.js middleware for all `/api/*` routes.
- Worker-only document processing: uploads now store files and queue jobs instead of running the pipeline inline.
- Internal worker endpoint guarded by `x-worker-secret`.
- Health and Prometheus-style metrics endpoints for production monitoring.
- Backup run endpoint that writes an application manifest and documents PostgreSQL, MinIO, and OpenSearch backup commands.
- Stripe Checkout and Razorpay order integration with local sandbox fallback.
- OCR benchmark API for scanned PDF/image datasets with confidence and character error rate metrics.
- Security audit API with a penetration testing checklist and production readiness scoring.
- Security headers for frame protection, content sniffing protection, referrer policy, permissions policy, and CSP.

## Production Position

The project is now positioned as an advanced MVP / early production candidate. It has the architecture and control surfaces expected in a real SaaS product: auth, RBAC, async jobs, storage adapters, observability, backups, payments, OCR evaluation, search, and security auditing.

Before handling regulated enterprise or government data, run a real external penetration test, configure production secrets, enable PostgreSQL/MinIO/RabbitMQ/OpenSearch in `docker-compose.production.yml`, seed production users, and execute restore drills for backups.

## Operational Commands

- Verify code: `npm run verify`
- Run security audit: `node scripts/security-audit.mjs`
- Run OCR benchmark: `node scripts/ocr-benchmark.mjs`
- Trigger backup: `POST /api/backups/run`
- Health check: `GET /api/monitoring/health`
- Metrics: `GET /api/monitoring/metrics`
