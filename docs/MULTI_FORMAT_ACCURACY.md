# Multi-Format Accuracy Upgrade

The document intelligence backend is not PDF-only. This upgrade improves extraction accuracy across scanned documents, image files, Office files, spreadsheets, presentations, text, and structured data.

## Native Parsing

- PDF: embedded text extraction with `pdf-parse`; scanned PDFs are routed to visual OCR through the AI service when configured.
- DOCX: native Word text extraction with `mammoth`.
- XLS/XLSX: workbook parsing with sheet names and CSV-style sheet text through `xlsx`.
- CSV/TSV: native structured text parsing.
- PPTX: slide XML extraction from the presentation package.
- ODT: `content.xml` extraction.
- HTML/XML/JSON/RTF/TXT/MD: format-specific text normalization instead of raw byte scraping.

## Visual OCR

- Images and scanned PDFs use OCR-first processing.
- If `AI_SERVICES_URL` is configured, the backend sends visual files to the FastAPI AI service.
- The AI service now renders PDF pages with PyMuPDF and OCRs rendered pages with PaddleOCR or Tesseract.
- Tesseract fallback applies denoising, contrast enhancement, and adaptive thresholding through OpenCV.

## Accuracy Signals

Each processed document can expose:

- Native parser engine and confidence.
- OCR engine and confidence.
- Fused text source: embedded, OCR, hybrid, or empty.
- Classification confidence.
- Text coverage score.
- Pipeline reliability score.
- Validation blockers.

Use `GET /api/documents/:id/accuracy` to inspect these signals.
