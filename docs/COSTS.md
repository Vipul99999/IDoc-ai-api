# Cost Model

## Early-Stage Target

Target: under USD 50/month for a student or early prototype.

## Suggested Single-Server Stack

- Hetzner or DigitalOcean VM: USD 6-18/month.
- Docker Compose deployment.
- Local MinIO storage.
- PostgreSQL with pgvector.
- Tesseract/PaddleOCR CPU inference.
- No paid translation API by default.

## Lowest-Cost Runtime Profile

Run the app without external infrastructure first:

```powershell
docker compose --profile low-cost up --build intellidoc-low-cost
```

This uses:

- Local filesystem storage.
- JSON-backed records.
- Local BM25 + semantic hash-vector search.
- CPU OCR.
- No managed services.

Estimated early cost: one small VM, usually USD 6-18/month.

## Cost Controls Implemented

- `/api/cost/estimate` estimates document and portfolio processing costs.
- `/api/cost/optimize` recommends infrastructure and per-document savings.
- OpenSearch is optional; local search is the default.
- pgvector is preferred before a separate paid vector database.
- MinIO can run on the same VM before moving to managed object storage.
- GPU inference is deferred until OCR/translation volume justifies it.
- Print recommendations prefer black-and-white when color is not useful.

## Scale Triggers

- Add managed object storage when local disk backup becomes risky.
- Add OpenSearch when full-text corpus exceeds PostgreSQL comfort.
- Add GPU only when OCR/translation latency blocks paid workflows.
- Add managed Kubernetes only after operational complexity is justified.
