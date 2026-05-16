# ADR 0002: Local-First AI Pipeline

## Decision

Start with deterministic, CPU-friendly processing and explicit swap points for Tesseract, PaddleOCR, LayoutLM, Donut, NLLB, MarianMT, and sentence transformers.

## Context

The target early infrastructure cost is under USD 50/month.

## Consequences

- The platform is usable immediately without GPUs or paid APIs.
- Accuracy improves as real models are connected.
- API contracts remain stable while internals evolve.
