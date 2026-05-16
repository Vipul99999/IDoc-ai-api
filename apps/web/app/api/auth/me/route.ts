import { permissionsForRole, verifySession } from "@/lib/auth/jwt";
import { json } from "@/lib/http";

export async function GET(request: Request) {
  const cookieToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("intellidoc_session="))
    ?.split("=")[1];
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? cookieToken;
  if (token) {
    try {
      const user = verifySession(token);
      return json({ user: { ...user, permissions: permissionsForRole(user.role) } });
    } catch {
      return json({ error: "Invalid session" }, 401);
    }
  }
  return json({
    user: {
      id: "00000000-0000-0000-0000-000000000002",
      organizationId: "00000000-0000-0000-0000-000000000001",
      email: "owner@intellidoc.local",
      name: "Demo Owner",
      role: "owner",
      permissions: [
        "documents:read",
        "documents:write",
        "analysis:run",
        "billing:read",
        "admin:read"
      ]
    }
  });
}
