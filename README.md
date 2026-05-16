# IntelliDoc AI

Production-oriented AI document intelligence platform for uploading, analyzing, searching, translating, formatting, validating, and monetizing real-world documents.

The product supports PDFs, scanned images, Office files, spreadsheets, presentations, text files, structured data, and common image formats. It is designed to start as a low-cost single-server deployment and grow into an enterprise/government document intelligence system.

## Current Product Position

**Score: 84/100 - advanced production-grade MVP / early beta.**

What is strong:

- Modern Next.js dashboard with document operations, search, commerce, billing, security, and admin views.
- Database-backed JWT auth, Google OAuth2 flow, organization/team-ready user model, RBAC middleware, API route policies, and centralized object-level document authorization.
- Upload validation, malware heuristics, version metadata, retention metadata, signed URL support, and audit logs.
- Background-only document processing through RabbitMQ in production, with local asynchronous background processing for low-cost development.
- OCR/text extraction across PDFs, images, Office documents, spreadsheets, presentations, text, XML, JSON, HTML, CSV, and TSV.
- Quality analysis, classification, recommendations, extraction, compliance findings, validation, summaries, flashcards, study guides, translation, reformatting, full-text search, semantic search, and duplicate discovery.
- PostgreSQL, MinIO, RabbitMQ, OpenSearch, pgvector, Docker Compose, Kubernetes, Terraform, monitoring, backup, payment, and security-audit surfaces.
- Cost-aware processing policy with duplicate-analysis reuse to avoid repeated OCR, classification, embedding, extraction, and validation work.

What remains before a high-confidence public launch:

- Apply real production secrets and migrations in a deployed PostgreSQL environment.
- Configure Google OAuth credentials, allowed domains, and final default roles.
- Run OCR benchmarks on a representative scanned document dataset.
- Complete external penetration testing and restore drills.
- Connect real Stripe/Razorpay credentials and verify live webhook events.
- Decide whether OpenSearch is needed at launch or whether local BM25 plus pgvector is enough for the first customer base.

## Cost Position

OpenAPI documentation itself has no runtime cost here. The API contract is a static JSON file in `docs/api/openapi.json`.

Cost reduction already built in:

- Local BM25 search first; OpenSearch is optional until corpus/search volume justifies it.
- PostgreSQL plus pgvector before separate paid vector databases.
- MinIO/local S3-compatible storage before managed object storage.
- CPU OCR workers first; GPU workers only for high-volume scanned workloads.
- Duplicate checksum analysis reuse to skip repeated OCR and AI processing.
- Cost-aware processing tiers: `low-cost`, `balanced`, and `accuracy-first`.
- Local asynchronous background processing in development, while production requires RabbitMQ.

Recommended low-cost early deployment:

- One VM running Docker Compose.
- PostgreSQL/pgvector, MinIO, RabbitMQ, and the web app.
- Defer OpenSearch and GPU workers until needed.

## Supported Formats

- Documents: `.pdf`, `.doc`, `.docx`, `.odt`, `.rtf`
- Images/scans: `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`, `.heic`, `.heif`
- Spreadsheets/data: `.xls`, `.xlsx`, `.csv`, `.tsv`, `.json`, `.xml`
- Presentations: `.ppt`, `.pptx`
- Text/web: `.txt`, `.md`, `.html`

## Architecture

```text
Next.js Web/API
    |
    | upload/auth/search/billing/admin APIs
    v
PostgreSQL or local JSON records
MinIO or local object storage
RabbitMQ or local async background queue
    |
    v
Document Intelligence Pipeline
    - native parsing
    - OCR/searchable PDF generation
    - quality analysis
    - classification
    - recommendation engine
    - extraction/compliance/validation
    - translation/reformatting
    - embedding/search indexing
```

## Monorepo Structure

```text
apps/
  web/          Next.js dashboard and API routes
  api/          API gateway boundary
  ai-services/ FastAPI AI/ML service boundary
  worker/       RabbitMQ worker
packages/
  shared-types/
  ui-components/
  config/
  sdk/
database/
  migrations/
docs/
infrastructure/
tests/
```

## Quick Start

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

Default local login:

```text
owner@intellidoc.local
password
```

## Commercial `/v1` Developer API

The external API-first surface is available under `/v1` and uses standardized response envelopes with `request_id`, `tenant_id`, `timestamp`, rate-limit headers, and structured errors.

Core routes:

- `POST /v1/auth/login`
- `GET|POST|DELETE /v1/api-keys`
- `GET|POST /v1/documents`
- `POST /v1/jobs/analyze`
- `POST /v1/jobs/ocr`
- `POST /v1/jobs/translate`
- `POST /v1/jobs/reformat`
- `GET /v1/jobs/{id}`
- `GET /v1/results/{id}`
- `GET /v1/search`
- `GET /v1/usage`
- `GET /v1/billing/subscription`
- `GET /v1/billing/invoices`
- `POST /v1/webhooks`

API clients can authenticate with `Authorization: Bearer idoc_...`, `x-api-key`, or a JWT session token. Local development still supports the demo owner identity for fast iteration.

## Verify

```powershell
npm run verify
```

This runs unit/integration checks and the production Next.js build.

## Google OAuth2

Configure these environment variables:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
APP_BASE_URL=http://localhost:3000
```

Optional:

```env
GOOGLE_ALLOWED_DOMAINS=example.edu,company.com
GOOGLE_DEFAULT_ROLE=analyst
```

Routes:

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`

## Production Environment

Minimum production variables:

```env
NODE_ENV=production
JWT_SECRET=replace-with-high-entropy-secret
DATABASE_URL=postgres://...
OBJECT_STORAGE=minio
MINIO_ENDPOINT=minio
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=documents
RABBITMQ_URL=amqp://...
INTERNAL_WORKER_SECRET=replace-with-worker-secret
APP_BASE_URL=https://your-domain.com
```

Cost controls:

```env
PROCESSING_COST_PROFILE=low-cost
DISABLE_ANALYSIS_CACHE=false
```

Production uploads and manual analysis require a background queue. If `RABBITMQ_URL` is missing in production, the API returns `503` instead of accepting work that cannot be processed.

Signed text-share links require a valid HMAC token and expiry timestamp. Normal unauthenticated document text access remains blocked.

## Deployment

Full production stack:

```powershell
docker compose -f docker-compose.production.yml up --build
```

Low-cost profile:

```powershell
docker compose --profile low-cost up --build intellidoc-low-cost
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Production Deployment](docs/PRODUCTION_DEPLOYMENT.md)
- [Backend Accuracy Hardening](docs/BACKEND_ACCURACY_HARDENING.md)
- [Google OAuth and Cost Policy](docs/GOOGLE_OAUTH_AND_COST_POLICY.md)
- [OpenAPI](docs/api/openapi.json)

## Product Score Breakdown

| Area | Score |
| --- | ---: |
| Product value and differentiation | 88 |
| Frontend/user experience | 84 |
| Backend architecture | 84 |
| OCR/extraction breadth | 78 |
| Search and retrieval | 82 |
| Security and compliance readiness | 82 |
| Cost optimization | 90 |
| Production operations | 76 |

Overall: **84/100**.
