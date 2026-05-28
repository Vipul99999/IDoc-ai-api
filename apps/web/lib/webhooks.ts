import crypto from "node:crypto";
import { getPostgresPool, isPostgresEnabled } from "@/lib/storage/postgres";

export type WebhookEventType = "job.completed" | "job.failed" | "quota.threshold_reached" | "invoice.generated";

export type WebhookSubscriptionInput = {
  organizationId: string;
  url: string;
  events: WebhookEventType[];
  description?: string;
};

function encryptionKey() {
  const configured = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("WEBHOOK_SECRET_ENCRYPTION_KEY is required in production.");
  }
  return crypto.createHash("sha256").update(configured ?? "local-webhook-secret-encryption-key").digest();
}

function encryptSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value: string) {
  if (!value.startsWith("enc:v1:")) return value;
  const [, , iv, tag, encrypted] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export function validateWebhookTarget(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
    return { ok: false, reason: "Production webhooks must use HTTPS." };
  }
  const hostname = parsed.hostname.toLowerCase();
  const blockedHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
  if (blockedHosts.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { ok: false, reason: "Webhook target host is not allowed." };
  }
  if (/^(10|127)\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) || /^169\.254\./.test(hostname)) {
    return { ok: false, reason: "Webhook target cannot be a private network address." };
  }
  return { ok: true, reason: null };
}

export async function createWebhookSubscription(input: WebhookSubscriptionInput) {
  const validation = validateWebhookTarget(input.url);
  if (!validation.ok) throw new Error(validation.reason ?? "Invalid webhook target.");
  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
  if (!isPostgresEnabled()) {
    return {
      id: crypto.randomUUID(),
      tenant_id: input.organizationId,
      url: input.url,
      events: input.events,
      description: input.description ?? null,
      signing_secret: secret,
      enabled: true,
      retry_policy: { max_attempts: 8, backoff: "exponential" },
      created_at: new Date().toISOString()
    };
  }
  const db = getPostgresPool();
  if (!db) throw new Error("PostgreSQL is not configured.");
  const result = await db.query(
    `
    INSERT INTO webhook_subscriptions (organization_id, url, events, secret_hash, secret_ref)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, organization_id, url, events, enabled, retry_policy, created_at
    `,
    [input.organizationId, input.url, input.events, crypto.createHash("sha256").update(secret).digest("hex"), encryptSecret(secret)]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    tenant_id: row.organization_id,
    url: row.url,
    events: row.events,
    description: input.description ?? null,
    signing_secret: secret,
    enabled: row.enabled,
    retry_policy: row.retry_policy,
    created_at: row.created_at?.toISOString?.() ?? String(row.created_at)
  };
}

export async function enqueueWebhookEvent(input: {
  organizationId: string;
  eventType: WebhookEventType;
  resourceType: string;
  resourceId?: string;
  payload: Record<string, unknown>;
}) {
  if (!isPostgresEnabled()) return null;
  const db = getPostgresPool();
  if (!db) return null;
  const result = await db.query(
    `
    INSERT INTO webhook_events (organization_id, event_type, resource_type, resource_id, payload)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    `,
    [input.organizationId, input.eventType, input.resourceType, input.resourceId ?? null, input.payload]
  );
  return result.rows[0]?.id as string | undefined;
}

export async function dispatchPendingWebhookEvents(limit = 25) {
  if (!isPostgresEnabled()) return { dispatched: 0, skipped: true };
  const db = getPostgresPool();
  if (!db) return { dispatched: 0, skipped: true };
  const events = await db.query(
    `
    SELECT e.id, e.organization_id, e.event_type, e.payload
    FROM webhook_events e
    WHERE e.status IN ('pending','failed')
    ORDER BY e.created_at ASC
    LIMIT $1
    `,
    [limit]
  );
  let dispatched = 0;
  for (const event of events.rows) {
    const subscriptions = await db.query(
      `
      SELECT id, url, secret_ref, retry_policy
      FROM webhook_subscriptions
      WHERE organization_id = $1
        AND enabled = true
        AND $2 = ANY(events)
      `,
      [event.organization_id, event.event_type]
    );
    await db.query("UPDATE webhook_events SET status = 'delivering', updated_at = now() WHERE id = $1", [event.id]);
    let deliveredToAtLeastOne = false;
    for (const subscription of subscriptions.rows) {
      const payload = JSON.stringify({
        id: event.id,
        type: event.event_type,
        tenant_id: event.organization_id,
        created_at: new Date().toISOString(),
        data: event.payload
      });
      if (!subscription.secret_ref) continue;
      const signature = crypto.createHmac("sha256", decryptSecret(subscription.secret_ref)).update(payload).digest("hex");
      let status = "failed";
      let responseCode: number | null = null;
      let responseBody: string | null = null;
      try {
        const response = await fetch(subscription.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "IntelliDoc-Webhooks/1.0",
            "x-intellidoc-event": event.event_type,
            "x-intellidoc-signature": signature
          },
          body: payload
        });
        responseCode = response.status;
        responseBody = (await response.text()).slice(0, 2000);
        status = response.ok ? "delivered" : "failed";
      } catch (error) {
        responseBody = error instanceof Error ? error.message : String(error);
      }
      deliveredToAtLeastOne = deliveredToAtLeastOne || status === "delivered";
      await db.query(
        `
        INSERT INTO webhook_deliveries (subscription_id, event_id, event_type, payload, status, response_code, response_body)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [subscription.id, event.id, event.event_type, event.payload, status, responseCode, responseBody]
      );
    }
    await db.query("UPDATE webhook_events SET status = $2, updated_at = now() WHERE id = $1", [event.id, deliveredToAtLeastOne ? "delivered" : "failed"]);
    dispatched += 1;
  }
  return { dispatched, skipped: false };
}
