import { z } from "zod";
import { requireV1Auth, recordUsage, v1Error, v1Response } from "@/lib/v1";
import { createWebhookSubscription } from "@/lib/webhooks";

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
  let webhook;
  try {
    webhook = await createWebhookSubscription({
      organizationId: principal.tenantId,
      url: body.data.url,
      events: body.data.events,
      description: body.data.description
    });
  } catch (error) {
    return v1Error(request, principal.tenantId, 400, "invalid_webhook_target", error instanceof Error ? error.message : "Invalid webhook target.");
  }
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/webhooks", method: "POST" });
  return v1Response(request, principal.tenantId, { webhook }, 201);
}
