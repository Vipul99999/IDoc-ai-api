import { z } from "zod";
import { badRequest, json } from "@/lib/http";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";
import { effectiveUser } from "@/lib/auth/request";

const createSchema = z.object({
  name: z.string().min(2),
  scopes: z.array(z.string()).default(["documents:read", "documents:write", "search:read"])
});

export async function GET(request: Request) {
  const user = effectiveUser(request);
  return json({ apiKeys: await listApiKeys(user.organizationId) });
}

export async function POST(request: Request) {
  const user = effectiveUser(request);
  const body = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Name and scopes are required.");
  return json({ apiKey: await createApiKey(body.data.name, body.data.scopes, user.organizationId) }, 201);
}

export async function DELETE(request: Request) {
  const user = effectiveUser(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id is required.");
  await revokeApiKey(id, user.organizationId);
  return json({ ok: true });
}
