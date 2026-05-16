# Remaining Gaps Closed

This pass added the platform areas that were still mostly represented as boundaries:

- Authentication APIs: local login and current-user endpoint.
- Billing APIs: plans and metered billing records.
- Job API: processing job visibility.
- Webhook API: test delivery simulation.
- Security: local malware signature scanning, scan metadata, signed URL token generation.
- Governance: document version records and version listing.
- Generative AI: summary, document Q&A, flashcards, and study-guide generation.
- Data model: document versions, generated outputs, webhook endpoints, webhook deliveries.
- Infrastructure: API, AI services, and worker Kubernetes manifests.
- CI: GitHub Actions workflow running tests and production build.

Additional real-world product additions:

- Broad format support: PDF, JPEG, PNG, TIFF, WebP, BMP, GIF, HEIC/HEIF, DOC/DOCX, ODT, RTF, XLS/XLSX, PPT/PPTX, CSV, TSV, TXT, Markdown, HTML, XML, and JSON.
- Batch upload and processing.
- PII/compliance detection with policy tags and risk score.
- Redacted sharing-copy generation.
- Duplicate and near-duplicate discovery.
- Document comparison.
- Print vendor marketplace recommendations.
- Export inventory API for OCR, translation, formatted, and redacted outputs.

Brand and operations additions:

- White-label brand settings API and dashboard brand studio.
- Brandable product name, logo text, tagline, support email, and marketplace label.
- Workflow queue API with privacy review, print approval, and vendor handoff states.
- Print quote API using document signals, paper, binding, color mode, copies, ETA, and fees.
- Print order API with privacy-review holds when sensitive data is detected.
- Database migration coverage for brand settings, print orders, and workflow runs.

Search additions:

- BM25-style local ranking with field boosts.
- Phrase and fuzzy matching.
- Semantic reranking.
- Filters for document type, language, format category, quality, compliance risk, and date.
- Facets, suggestions, and similar-document discovery.
- OpenSearch Docker profile, index mapping, and adapter.
- Search analytics and saved-search schema.

Production integration additions:

- Real OCR through `pdf-parse`, `tesseract.js`, and searchable PDF generation with `pdf-lib`.
- FastAPI `/ocr` endpoint with PaddleOCR and pytesseract integration path.
- PostgreSQL adapter for document records through `DATABASE_URL`.
- MinIO object storage adapter and presigned URLs.
- RabbitMQ job enqueueing and worker consumption.
- JWT sessions with bcrypt-backed password verification and role permissions.
- Organization member API for team/RBAC groundwork.
- Production Docker Compose stack with app, PostgreSQL/pgvector, MinIO, RabbitMQ, and OpenSearch.

High-impact product additions:

- Structured extraction for emails, phones, dates, amounts, invoice numbers, tax IDs, skills, parties, clauses, and simple tables.
- Document validation/readiness checks across print, privacy, OCR, workflow, and business automation.
- Human review task generation for privacy, print quality, and extraction confidence.
- API key management with hashed secrets and scopes.
- Retention policy and retention dry-run APIs.
- Admin analytics for readiness, risk, extraction automation, review work, and revenue potential.

Cost optimization additions:

- Cost estimate API for document and portfolio processing.
- Cost optimizer API for infrastructure and document-level savings.
- Low-cost Docker Compose profile.
- Local search remains default; OpenSearch is optional.
- CPU-first OCR and same-VM MinIO/Postgres guidance.

The implementation remains cost-conscious and local-first. Heavy production engines such as PaddleOCR, Tesseract, sentence transformers, NLLB, OpenSearch, MinIO, RabbitMQ, and PostgreSQL are represented by clean swap points and deployment artifacts.
