# Production Deployment

## Included Services

`docker-compose.production.yml` runs:

- Next.js web/API app
- PostgreSQL with pgvector
- MinIO object storage
- RabbitMQ queue and management UI
- OpenSearch

For the cheapest useful deployment, run the low-cost profile first:

```powershell
docker compose --profile low-cost up --build intellidoc-low-cost
```

Use the full production stack when you need persistent Postgres, MinIO, RabbitMQ, and OpenSearch.

## Start Production Stack

```powershell
docker compose -f docker-compose.production.yml up --build
```

## Service URLs

- App: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- MinIO: `http://localhost:9001`
- RabbitMQ management: `http://localhost:15672`
- OpenSearch: `http://localhost:9200`

## Real OCR

The web app now uses:

- `pdf-parse` for digital PDFs.
- `tesseract.js` for image OCR.
- `pdf-lib` for searchable PDF output.

The FastAPI service includes `/ocr` with:

- PaddleOCR first when available.
- pytesseract fallback.

For scanned PDFs at high quality, route PDF page rendering through the FastAPI worker and OCR each rendered page.

## Storage

When `DATABASE_URL` is set, document records are saved to PostgreSQL in `documents.payload`.

When `OBJECT_STORAGE=minio` or `MINIO_ENDPOINT` is set, original files are stored in MinIO and signed URLs use MinIO presigned URLs.

## Queue

When `RABBITMQ_URL` is set, uploads and manual analysis requests enqueue `document.full_pipeline` jobs to the durable `document-jobs` queue. The worker consumes the queue and calls the internal processing endpoint.

In development, the web app can run a local asynchronous background queue to keep costs low. In production, uploads return `503` when `RABBITMQ_URL` is missing, so the API does not silently accept documents that cannot be processed.

## Auth

Login now returns a signed JWT. `/api/auth/me` verifies bearer tokens and returns role permissions.

Demo passwords accepted locally:

- `password`
- `demo`

Before production, rotate `JWT_SECRET`, replace demo users with database-backed users, and enforce RBAC guards on all mutating endpoints.
