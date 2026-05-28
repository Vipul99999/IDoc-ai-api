import { json } from "@/lib/http";
import { dispatchPendingWebhookEvents } from "@/lib/webhooks";

export async function POST(request: Request) {
  const expected = process.env.INTERNAL_WORKER_SECRET;
  if (!expected && process.env.NODE_ENV === "production") return json({ error: "Worker secret is not configured" }, 503);
  if (!expected && request.headers.get("x-worker-secret") === "local-worker-secret") {
    const result = await dispatchPendingWebhookEvents();
    return json(result);
  }
  if (request.headers.get("x-worker-secret") !== expected) return json({ error: "Forbidden internal route" }, 403);
  const result = await dispatchPendingWebhookEvents();
  return json(result);
}
