import crypto from "node:crypto";
import { z } from "zod";
import { requireV1Auth, recordUsage, v1Error, v1Response } from "@/lib/v1";

const schema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(["job.completed", "job.failed", "quota.threshold_reached", "invoice.generated"])).default(["job.completed", "job.failed"]),
  description: z.string().optional()
});

export async function POST(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["webhooks:write"]);
  if (!principal) return response;
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return v1Error(request, principal.tenantId, 400, "invalid_request", "Invalid webhook configuration.", body.error.flatten());
  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
  const webhook = {
    id: crypto.randomUUID(),
    tenant_id: principal.tenantId,
    url: body.data.url,
    events: body.data.events,
    description: body.data.description ?? null,
    signing_secret: secret,
    enabled: true,
    retry_policy: { max_attempts: 8, backoff: "exponential" },
    created_at: new Date().toISOString()
  };
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/webhooks", method: "POST" });
  return v1Response(request, principal.tenantId, { webhook }, 201);
}
