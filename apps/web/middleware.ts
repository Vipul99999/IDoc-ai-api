import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { permissionForRequest } from "@/lib/auth/policy";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function hasPermission(grants: string[], permission: string) {
  return grants.includes("*") || grants.includes(permission) || grants.some((grant) => grant.endsWith(":*") && permission.startsWith(grant.slice(0, -1)));
}

async function hashApiKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function grantsForRole(role: string) {
  if (role === "owner") return ["*"];
  if (role === "admin") {
    return ["auth:read", "documents:*", "billing:*", "admin:*", "brand:write", "org:write", "review:*", "orders:*", "jobs:read", "search:read"];
  }
  if (role === "analyst") return ["documents:read", "documents:write", "analysis:run", "search:read", "review:read", "orders:read"];
  if (role === "api_client") return ["documents:read", "documents:write", "analysis:run"];
  return ["auth:read", "documents:read", "search:read"];
}

function rateLimit(request: NextRequest) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000);
  const max = Number(process.env.RATE_LIMIT_MAX ?? 240);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const key = `${ip}:${request.nextUrl.pathname.split("/").slice(0, 3).join("/")}`;
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count > max) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "retry-after": String(Math.ceil((current.resetAt - now) / 1000)) } });
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  const required = permissionForRequest(pathname, request.method);
  if (!required) return NextResponse.next();

  const limited = rateLimit(request);
  if (limited) return limited;

  if (required === "internal:worker") {
    const expected = process.env.INTERNAL_WORKER_SECRET ?? "local-worker-secret";
    if (request.headers.get("x-worker-secret") === expected) return NextResponse.next();
    return NextResponse.json({ error: "Forbidden internal route" }, { status: 403 });
  }

  const configuredApiKeyHash = process.env.MASTER_API_KEY_HASH;
  const apiKey = request.headers.get("x-api-key");
  if (configuredApiKeyHash && apiKey && (await hashApiKey(apiKey)) === configuredApiKeyHash) return NextResponse.next();

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : request.cookies.get("intellidoc_session")?.value ?? null;
  if (bearer) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "local-development-jwt-secret");
      const { payload } = await jwtVerify(bearer, secret, {
        issuer: "intellidoc-ai",
        audience: "intellidoc-users"
      });
      const grants = grantsForRole(typeof payload.role === "string" ? payload.role : "viewer");
      if (hasPermission(grants, required) || required === "authenticated") return NextResponse.next();
      return NextResponse.json({ error: `Forbidden: missing ${required}` }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  if (process.env.NODE_ENV !== "production" || process.env.AUTH_OPTIONAL === "true") return NextResponse.next();
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"]
};
