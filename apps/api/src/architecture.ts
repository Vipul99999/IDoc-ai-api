export const apiModules = [
  "AuthModule",
  "OrganizationsModule",
  "DocumentsModule",
  "UploadsModule",
  "AnalysisModule",
  "RecommendationsModule",
  "OcrModule",
  "TranslationModule",
  "FormattingModule",
  "SearchModule",
  "BillingModule",
  "AdminModule",
  "AuditModule",
  "WebhooksModule"
];

export const crossCuttingConcerns = [
  "JWT authentication",
  "RBAC guards",
  "Zod/class-validator request validation",
  "tenant scoping",
  "rate limiting",
  "structured logging",
  "OpenAPI generation",
  "repository pattern",
  "queue event publishing"
];
