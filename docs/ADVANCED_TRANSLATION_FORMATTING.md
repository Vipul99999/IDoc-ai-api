# Advanced Translation and Formatting

This pass upgrades translation and layout reconstruction from draft placeholders into production-oriented features.

## Translation

- Layout-aware chunking: headings, paragraphs, lists, tables, and key-value rows are translated as separate chunks.
- Protected terms: emails, URLs, dates, amounts, and identifiers are preserved during translation.
- Glossary support: callers can pass custom terminology overrides per request.
- Provider hooks:
  - `AI_SERVICES_URL` for local/hosted AI translation service.
  - `LIBRETRANSLATE_URL` for open-source translation API.
  - deterministic local glossary fallback for low-cost deployments.
- Quality scoring with warnings for suspicious length changes or missing protected terms.
- Structured manifest output with chunks, engine, quality score, warnings, and protected terms.

## Formatting

- Layout block detection for title, metadata, headings, paragraphs, lists, and table-like rows.
- Table/key-value preservation instead of flattening everything into one paragraph.
- Layout quality scoring.
- Structured format manifest output for downstream PDF/DOCX/PPTX rendering.
- Accessibility-oriented reading order notes.

## APIs

- `POST /api/documents/:id/translate`
- `POST /api/documents/:id/reformat`

Both APIs now save human-readable output and structured JSON manifests.
