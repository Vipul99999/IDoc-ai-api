import { AuthUser, verifySession } from "@/lib/auth/jwt";
import { json, notFound } from "@/lib/http";
import { getDocument } from "@/lib/storage/db";

export const LOCAL_OWNER_ID = "00000000-0000-0000-0000-000000000002";
export const LOCAL_ORG_ID = "00000000-0000-0000-0000-000000000001";

export function getBearerToken(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  const cookieToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("intellidoc_session="))
    ?.split("=")[1];
  return cookieToken ? decodeURIComponent(cookieToken) : null;
}

export function getRequestUser(request: Request): AuthUser | null {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    return verifySession(token);
  } catch {
    return null;
  }
}

export function effectiveUser(request: Request): AuthUser {
  return (
    getRequestUser(request) ?? {
      id: LOCAL_OWNER_ID,
      organizationId: LOCAL_ORG_ID,
      email: "owner@intellidoc.local",
      name: "Demo Owner",
      role: "owner"
    }
  );
}

export function canAccessDocument(user: AuthUser, documentUserId: string) {
  return user.role === "owner" || user.role === "admin" || documentUserId === user.id || documentUserId === "demo-user";
}

export async function getAuthorizedDocument(request: Request, id: string) {
  const user = effectiveUser(request);
  const document = await getDocument(id);
  if (!document) return { document: null, response: notFound() };
  if (!canAccessDocument(user, document.userId)) return { document: null, response: json({ error: "Forbidden" }, 403) };
  return { document, response: null };
}
