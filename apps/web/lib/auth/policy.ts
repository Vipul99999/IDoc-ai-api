export type RoutePolicy = {
  pattern: RegExp;
  permission: string;
  public?: boolean;
};

export const PUBLIC_API_PATHS = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/google\/start$/,
  /^\/api\/auth\/google\/callback$/,
  /^\/api\/monitoring\/health$/,
  /^\/api\/payments\/webhook$/,
  /^\/api\/webhooks\/test$/
];

export const INTERNAL_API_PATHS = [/^\/api\/internal\//];

export const ROUTE_POLICIES: RoutePolicy[] = [
  { pattern: /^\/api\/admin\//, permission: "admin:read" },
  { pattern: /^\/api\/api-keys/, permission: "admin:write" },
  { pattern: /^\/api\/auth\/me/, permission: "auth:read" },
  { pattern: /^\/api\/backups\//, permission: "admin:write" },
  { pattern: /^\/api\/benchmarks\//, permission: "admin:read" },
  { pattern: /^\/api\/billing\//, permission: "billing:read" },
  { pattern: /^\/api\/brand/, permission: "brand:write" },
  { pattern: /^\/api\/cost\//, permission: "admin:read" },
  { pattern: /^\/api\/documents\/upload/, permission: "documents:write" },
  { pattern: /^\/api\/documents\/batch-upload/, permission: "documents:write" },
  { pattern: /^\/api\/documents\/[^/]+\/(analyze|ocr|translate|reformat|redact|extract|validate|summarize|ask|flashcards|study-guide)/, permission: "analysis:run" },
  { pattern: /^\/api\/documents/, permission: "documents:read" },
  { pattern: /^\/api\/enterprise\//, permission: "billing:read" },
  { pattern: /^\/api\/exports/, permission: "documents:read" },
  { pattern: /^\/api\/jobs/, permission: "jobs:read" },
  { pattern: /^\/api\/marketplace\/orders/, permission: "orders:write" },
  { pattern: /^\/api\/marketplace\//, permission: "orders:read" },
  { pattern: /^\/api\/monitoring\/metrics/, permission: "admin:read" },
  { pattern: /^\/api\/organizations\//, permission: "org:write" },
  { pattern: /^\/api\/payments\/checkout/, permission: "billing:write" },
  { pattern: /^\/api\/retention\//, permission: "admin:write" },
  { pattern: /^\/api\/review\//, permission: "review:read" },
  { pattern: /^\/api\/search/, permission: "search:read" },
  { pattern: /^\/api\/security\//, permission: "admin:read" },
  { pattern: /^\/api\/workflows/, permission: "review:read" }
];

export function permissionForPath(pathname: string) {
  if (PUBLIC_API_PATHS.some((pattern) => pattern.test(pathname))) return null;
  if (INTERNAL_API_PATHS.some((pattern) => pattern.test(pathname))) return "internal:worker";
  return ROUTE_POLICIES.find((policy) => policy.pattern.test(pathname))?.permission ?? "authenticated";
}

export function permissionForRequest(pathname: string, method: string) {
  if (/^\/api\/documents\/[^/]+$/.test(pathname) && method === "DELETE") return "documents:write";
  if (/^\/api\/documents\/[^/]+\/text$/.test(pathname) && method === "GET") return null;
  if (/^\/api\/marketplace\/orders/.test(pathname) && method === "GET") return "orders:read";
  if (/^\/api\/marketplace\/orders/.test(pathname) && method === "POST") return "orders:write";
  if (/^\/api\/webhooks\/test$/.test(pathname) && method !== "POST") return "admin:write";
  return permissionForPath(pathname);
}
