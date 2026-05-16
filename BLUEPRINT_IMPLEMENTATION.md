# IntelliDoc AI Master Prompt Implementation Map

This repository implements the corrected master prompt as a production-oriented monorepo with a runnable local product and enterprise expansion boundaries.

## Runtime Apps

- `apps/web`: Next.js dashboard plus local API routes for the fully runnable MVP.
- `apps/api`: API gateway boundary with rate limiting, auth boundary, OpenAPI serving, and NestJS module map.
- `apps/ai-services`: FastAPI service boundary for OCR, CV, classification, translation, embeddings, and summarization.
- `apps/worker`: queue worker boundary for asynchronous processing.

## Shared Packages

- `packages/shared-types`: product and API contracts.
- `packages/ui-components`: shared UI primitives.
- `packages/config`: environment and product configuration.
- `packages/sdk`: customer SDK for upload, document retrieval, search, and translation.

## Phase Coverage

1. Product planning and PRD: `docs/PRD.md`
2. Monorepo and infrastructure: root workspaces, `Dockerfile`, `docker-compose.yml`, `infrastructure/`
3. Authentication and upload: API auth boundary, upload validation, retention metadata
4. Preprocessing and preview: `apps/web/lib/pipeline/text.ts`, document dashboard
5. Quality analysis: `apps/web/lib/pipeline/quality.ts`
6. Recommendation engine: `apps/web/lib/pipeline/recommend.ts`
7. OCR and searchable PDFs: `apps/web/lib/pipeline/ocr.ts`
8. Full-text search: `apps/web/lib/search.ts`
9. Translation: `apps/web/lib/pipeline/translate.ts`
10. Formatting: `apps/web/lib/pipeline/format.ts`
11. Semantic search and embeddings: `apps/web/lib/pipeline/embedding.ts`
12. Generative AI features: summaries, study-ready extraction hooks, AI service boundary
13. Billing and monetization: `GET /api/enterprise/usage`, billing schema
14. Enterprise and government features: audit logs, retention, admin stats, compliance docs

## Production Swap Points

- Replace JSON records in `apps/web/lib/storage/db.ts` with PostgreSQL repositories using `database/migrations/001_initial_schema.sql`.
- Replace filesystem uploads with MinIO/S3 in `apps/web/lib/storage/fs.ts`.
- Replace local OCR simulation with Tesseract/PaddleOCR/FastAPI OCR in `apps/web/lib/pipeline/ocr.ts`.
- Replace hash embeddings with sentence transformers and pgvector/Qdrant in `apps/web/lib/pipeline/embedding.ts`.
- Replace translation stubs with NLLB, MarianMT, mBART, or a translation API in `apps/web/lib/pipeline/translate.ts`.

## Verification

```powershell
npm run test
npm run build
```
