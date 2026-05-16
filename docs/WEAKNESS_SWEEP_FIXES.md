# Weakness Sweep Fixes

This sweep reviewed the project across backend safety, multi-tenant behavior, payment handling, job observability, storage lifecycle, API documentation, and regression coverage.

## Weaknesses Fixed

- Upload ownership no longer uses a hardcoded `demo-user`; new uploads bind to the authenticated request user.
- Document list/detail/delete routes now apply basic owner/admin/user access filtering.
- RBAC is now method-aware for destructive document deletes and marketplace order reads/writes.
- Middleware now includes a lightweight API rate limiter with `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`.
- Payment webhooks now verify Stripe and Razorpay signatures when webhook secrets are configured.
- Job reporting no longer marks queued or analyzing documents as succeeded.
- Document deletion now removes original object storage and generated output directories, not just metadata.
- OpenAPI now documents newer production surfaces: accuracy, health, metrics, backups, payments, security audit, and OCR benchmarks.
- Regression tests were expanded for method-aware RBAC and payment webhook verification.

## Remaining Production Work

- Replace the development owner fallback with strict production-only database users after deployment secrets are configured.
- Add full organization-level database filtering in SQL queries once every table carries organization IDs in all payloads.
- Add distributed rate limiting through Redis for multi-instance deployments.
- Add real restore tests for PostgreSQL, MinIO, and OpenSearch backups.
