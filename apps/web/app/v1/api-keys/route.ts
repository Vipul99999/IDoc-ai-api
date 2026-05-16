import { z } from "zod";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";
import { requireV1Auth, recordUsage, v1Error, v1Response } from "@/lib/v1";

const createSchema = z.object({
  name: z.string().min(2),
  scopes: z.array(z.string()).default(["documents:read", "documents:write", "jobs:write", "search:read", "usage:read"])
});

export async function GET(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["api_keys:read"]);
  if (!principal) return response;
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/api-keys", method: "GET" });
  return v1Response(request, principal.tenantId, { api_keys: await listApiKeys() });
}

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["api_keys:write"]);
  if (!principal) return response;
  const body = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return v1Error(request, principal.tenantId, 400, "invalid_request", "name and scopes are required.", body.error.flatten());
  const apiKey = await createApiKey(body.data.name, body.data.scopes);
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/api-keys", method: "POST" });
  return v1Response(request, principal.tenantId, { api_key: apiKey }, 201);
}

export async function DELETE(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["api_keys:write"]);
  if (!principal) return response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return v1Error(request, principal.tenantId, 400, "invalid_request", "id is required.");
  await revokeApiKey(id);
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/api-keys", method: "DELETE" });
  return v1Response(request, principal.tenantId, { revoked: true });
}
