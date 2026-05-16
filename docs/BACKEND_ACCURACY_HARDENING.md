# Backend Accuracy Hardening

This backend pass upgrades the document intelligence pipeline from a text-first MVP to an OCR-first accuracy pipeline.

## What Changed

- OCR now runs before classification, quality analysis, compliance, extraction, validation, summaries, and embeddings.
- Embedded PDF/text extraction and OCR output are fused with a deterministic confidence policy.
- Weighted document classification now returns confidence, score, and matched hints.
- OCR can use the Python AI service through `AI_SERVICES_URL` before falling back to local Tesseract for images.
- Validation now checks OCR confidence and combined pipeline reliability before allowing automation.
- Each processed document records text source, OCR confidence, text coverage, classification confidence, and reliability score.
- New endpoint: `GET /api/documents/:id/accuracy`.
- RabbitMQ worker now retries transient failures and moves exhausted jobs to `document-jobs-dead`.

## Accuracy Signals

- `textSource`: embedded text, OCR, hybrid, or empty.
- `ocrConfidence`: average confidence across OCR blocks.
- `textCoverageScore`: rough text coverage relative to page count.
- `classificationConfidence`: confidence for detected document type.
- `pipelineReliabilityScore`: combined quality, OCR, coverage, extraction, and issue penalty score.
- `blockers`: failed validation checks that should stop automation.

## Production Recommendation

For highest accuracy, run the FastAPI AI service with PaddleOCR/Tesseract enabled and set:

```bash
AI_SERVICES_URL=http://ai-services:8000
RABBITMQ_URL=amqp://intellidoc:intellidoc@rabbitmq:5672
```

For scanned PDFs, add a PDF page renderer such as Poppler or PyMuPDF in the AI service so each page is OCRed as an image.
