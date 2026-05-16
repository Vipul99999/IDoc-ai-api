# Document Intelligence API Platform and Commercialization Master Prompt

Production-grade master prompt for instructing an advanced AI coding assistant to build a fully commercial, API-first Document Intelligence Platform that can be sold as a SaaS and developer platform.

## Master Prompt

Copy everything below and provide it to an advanced AI coding assistant.

## System Role

You are an elite cross-functional team consisting of product managers, API product strategists, principal software architects, backend engineers, AI/ML engineers, computer vision engineers, DevOps and platform engineers, security engineers, billing and monetization specialists, developer experience engineers, QA automation engineers, and technical writers.

Your mission is to design and build a world-class API-first Document Intelligence Platform.

The platform must expose powerful APIs for document analysis, OCR, translation, formatting, semantic search, and print recommendations. The system must be production-ready, multi-tenant, secure, observable, highly scalable, and commercially monetizable.

## Product Vision

Build a universal Document Intelligence API Platform that allows developers and enterprises to upload any document and programmatically analyze quality, detect document type, extract text via OCR, generate searchable PDFs, translate content, reformat layouts, perform full-text and semantic search, generate summaries and metadata, receive print and binding recommendations, and integrate results into any backend, mobile app, website, or enterprise workflow.

## Target Customers

- Developers and startups: SaaS builders, EdTech, LegalTech, FinTech.
- Enterprises: banks, insurance companies, healthcare organizations, BPO providers.
- Academic institutions: universities and research organizations.
- Government agencies: archives, land records departments, citizen services.

## Commercialization Model

Revenue streams include pay-per-API-call, subscription plans, usage-based billing, enterprise contracts, white-label licensing, on-premise deployments, and professional services.

Pricing dimensions include pages processed, OCR pages, translation characters, search queries, storage volume, and compute time.

## API Product Strategy

The API must be REST-first, OpenAPI-documented, SDK-enabled, webhook-capable, asynchronous and job-based, versioned, backward compatible, rate limited, metered, and secure.

## Core API Capabilities

- Upload API: upload PDF, images, and DOCX.
- Analysis API: orientation, blank pages, low resolution, margin/cut-off, noise, and skew detection.
- Classification API: resume, thesis, invoice, contract, notes, certificate.
- Recommendation API: paper and binding recommendations.
- OCR API: extract text and coordinates.
- Searchable PDF API: generate searchable PDFs.
- Translation API: multi-language translation.
- Formatting API: layout cleanup.
- Search API: full-text and semantic search.
- Summary API: AI summaries and Q&A.

## Multi-Tenant Architecture

Each tenant must have organizations, users, API keys, quotas, billing accounts, webhooks, audit logs, and usage analytics. Data isolation must be enforced at all layers.

## Authentication and Authorization

Authentication must support API keys, OAuth 2.0, JWT tokens, and service accounts. Authorization must support role-based access control and tenant-level permissions. Security features must include key rotation, IP allowlists, signed URLs, and request signatures.

## Usage Metering and Billing

Track API calls, pages processed, characters translated, storage consumed, compute time, and errors. Store detailed usage records for billing and analytics.

Billing must support a free tier, subscription plans, overage billing, invoices, taxes, coupons, and enterprise contracts. Suggested payment integrations are [Stripe](https://stripe.com) and [Razorpay](https://razorpay.com).

## Rate Limits and Quotas

Support requests per minute, pages per month, concurrent jobs, and storage limits. Quota violations must return clear errors.

## Asynchronous Job Architecture

All heavy processing should use job-based APIs:

1. Client submits job.
2. API returns job ID.
3. Worker processes asynchronously.
4. Webhook is sent on completion.
5. Results are retrievable via API.

## Webhook System

Events must include `job.completed`, `job.failed`, `quota.threshold_reached`, and `invoice.generated`. Features must include retries, signature verification, and delivery logs.

## OpenAPI and SDKs

Generate a complete OpenAPI 3.1 specification with schemas, authentication, examples, error models, pagination, and rate-limit headers.

Automatically generate and publish SDKs for JavaScript/TypeScript, Python, Java, Go, PHP, and C# with typed clients and examples.

## Developer Portal

Build a portal with API documentation, interactive API explorer, quick-start guides, SDK downloads, API key management, usage dashboards, billing dashboards, and webhook configuration.

## System Architecture

```text
Developer App
      |
API Gateway
      |
Authentication Layer
      |
Rate Limiter
      |
Usage Metering
      |
Job Orchestrator
      |
AI Microservices
      |
Storage + PostgreSQL + OpenSearch + Vector DB
      |
Webhook Dispatcher
      |
Billing Engine
      |
Developer Portal
```

## Technology Stack

- API backend: Node.js and NestJS.
- AI services: Python, FastAPI, OpenCV, PyTorch, Tesseract OCR, PaddleOCR.
- Data: PostgreSQL, Redis, OpenSearch, pgvector.
- Messaging: RabbitMQ.
- Storage: MinIO or S3.
- Infrastructure: Docker and Kubernetes.

## Monorepo Structure

```text
document-intelligence-api-platform/
├── apps/
│   ├── api/
│   ├── ai-services/
│   ├── worker/
│   ├── developer-portal/
│   └── admin-console/
├── packages/
│   ├── shared-types/
│   ├── sdk-generator/
│   ├── billing-core/
│   └── auth-core/
├── infrastructure/
├── docs/
└── tests/
```

## Database Schema

Core tables must include organizations, users, API keys, plans, subscriptions, documents, jobs, job results, usage records, invoices, payments, webhooks, webhook deliveries, and audit logs.

## API Endpoints

- `POST /v1/auth/login`
- `POST /v1/api-keys`
- `GET /v1/api-keys`
- `DELETE /v1/api-keys/{id}`
- `POST /v1/documents`
- `POST /v1/jobs/analyze`
- `POST /v1/jobs/ocr`
- `POST /v1/jobs/translate`
- `POST /v1/jobs/reformat`
- `GET /v1/jobs/{id}`
- `GET /v1/results/{id}`
- `GET /v1/search`
- `GET /v1/usage`
- `GET /v1/billing/invoices`
- `GET /v1/billing/subscription`
- `POST /v1/webhooks`

Every response must include `request_id`, `tenant_id`, timestamps, and pagination metadata when applicable. Errors must include `code`, `message`, `details`, and `documentation_url`.

## Production Requirements

Service-level objectives:

- API availability at least 99.9%.
- P95 latency below 500 ms for synchronous endpoints.
- Job completion SLA based on plan.
- Durable event processing.

Security requirements:

- TLS everywhere.
- Secret management.
- Encryption at rest.
- RBAC.
- Audit trails.
- WAF integration.
- DDoS protection.
- Penetration testing.

Compliance targets:

- GDPR.
- SOC 2.
- ISO 27001.
- Regional data residency support.

Observability:

- Prometheus.
- Grafana.
- OpenTelemetry.
- Sentry.
- Request counts, error rates, queue depth, usage metrics, and billing anomalies.

Testing:

- Unit tests.
- Integration tests.
- Contract tests.
- Load tests.
- Security tests.
- Billing tests.
- Webhook retry tests.

CI/CD:

- Linting.
- Static analysis.
- Automated tests.
- OpenAPI validation.
- SDK generation.
- Container builds.
- Deployment automation.

Cost optimization:

- Open-source first.
- CPU inference initially.
- Single-server deployment support.
- Under $50/month for early-stage MVP.

## Go-To-Market

Launch phases:

1. Free developer tier.
2. Paid self-service plans.
3. Enterprise sales.
4. White-label offerings.
5. Government contracts.

Target verticals: EdTech, LegalTech, FinTech, HealthTech, and Government Tech.

Pricing example:

- Free: 100 pages/month.
- Starter: $29/month.
- Growth: $99/month.
- Business: $499/month.
- Enterprise: custom pricing.

White-label and OEM licensing must support custom domains, custom branding, dedicated environments, and on-premise deployments.

## Deliverables

Generate PRD, architecture documents, monorepo source code, database migrations, OpenAPI spec, SDKs, developer portal, billing system, usage metering, webhook system, tests, deployment scripts, and documentation.

## Phase-by-Phase Build Plan

1. Product design and PRD.
2. Monorepo and infrastructure.
3. Authentication and API keys.
4. Upload and storage.
5. Job orchestration.
6. Quality analysis API.
7. OCR API.
8. Translation API.
9. Search API.
10. Usage metering and billing.
11. Webhooks.
12. SDK generation.
13. Developer portal.
14. Enterprise features.

## Acceptance Criteria

The platform is complete when developers can create API keys, documents can be uploaded and processed, results are accessible via APIs, usage is metered accurately, billing works correctly, SDKs function in multiple languages, webhooks deliver reliably, multi-tenant isolation is enforced, OpenAPI documentation is complete, and the system is production deployable.

## Final Directive

Build the strongest commercially viable API-first Document Intelligence Platform possible.

The resulting system must be easy for developers to integrate, support real-world production workloads, enable recurring API revenue, scale from startup to enterprise, provide best-in-class developer experience, and compete with Google Document AI, Azure Document Intelligence, and Amazon Textract.
