import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/config";

export type AuthUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "analyst" | "viewer" | "api_client";
};

export function signSession(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, {
    expiresIn: "1h",
    issuer: "intellidoc-ai",
    audience: "intellidoc-users"
  });
}

export function verifySession(token: string) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: "intellidoc-ai",
    audience: "intellidoc-users"
  }) as AuthUser;
}

export function permissionsForRole(role: AuthUser["role"]) {
  const permissions = {
    owner: ["*"],
    admin: [
      "auth:read",
      "documents:*",
      "billing:*",
      "admin:*",
      "brand:write",
      "org:write",
      "review:*",
      "orders:*",
      "jobs:read",
      "search:read"
    ],
    analyst: ["documents:read", "documents:write", "analysis:run", "search:read", "review:read", "orders:read"],
    viewer: ["documents:read", "search:read"],
    api_client: ["documents:read", "documents:write", "analysis:run"]
  };
  return permissions[role];
}
