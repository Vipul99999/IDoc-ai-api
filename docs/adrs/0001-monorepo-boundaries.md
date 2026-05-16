# ADR 0001: Monorepo Boundaries

## Decision

Use a monorepo with `apps` for runtime services and `packages` for shared contracts, SDKs, UI, and config.

## Context

The product must scale from a student MVP to enterprise and government deployments. A monorepo keeps early iteration fast while preserving clear service boundaries.

## Consequences

- Local development is simpler.
- Shared types reduce API drift.
- Services can be split into independent deployment pipelines later.
