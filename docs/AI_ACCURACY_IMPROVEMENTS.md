# AI Accuracy Improvements

This pass improves deterministic AI accuracy in the document intelligence backend.

## Improved

- Language detection is now script-aware for Hindi/Devanagari, Urdu/Arabic, Bengali, Tamil, and Telugu, with fallback transliteration hints.
- Document classification uses weighted repeated signals, filename/format boosts, confidence, matched hints, and runner-up margin.
- Structured extraction now captures richer business fields:
  - invoice number
  - purchase order
  - invoice date
  - due date
  - subtotal
  - tax amount
  - total amount
  - bill-to/customer
  - issuer/vendor/seller
  - tax or identity IDs
  - emails, phones, dates, amounts, skills, parties, and clauses
- Table extraction now supports CSV, TSV, pipe tables, and whitespace-aligned tables.
- Key-value extraction captures common form fields from real-world documents.
- Validation now includes a classification confidence gate so low-confidence document routing requires review.

## Accuracy Philosophy

The platform now avoids pretending every result is equally reliable. It surfaces confidence, reliability, text coverage, OCR quality, extraction quality, and validation blockers so automation can be used where it is safe and human review can be routed where the AI is uncertain.
