import { z } from "zod";
import { json, badRequest } from "@/lib/http";
import { permissionsForRole } from "@/lib/auth/jwt";
import { createAuthUser, listAuthUsers, publicUser } from "@/lib/auth/users";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["owner", "admin", "analyst", "viewer", "api_client"]).default("viewer")
});

export async function GET() {
  const members = await listAuthUsers();
  return json({
    members: members.map((member) => ({
      ...publicUser(member),
      permissions: permissionsForRole(member.role)
    }))
  });
}

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Valid member details are required.");
  const member = await createAuthUser({
    organizationId: "00000000-0000-0000-0000-000000000001",
    ...body.data
  });
  return json({ member: { ...publicUser(member), permissions: permissionsForRole(member.role) } }, 201);
}
