import crypto from "node:crypto";
import { json } from "@/lib/http";
import { log } from "@/lib/monitoring/logger";
import { getPostgresPool, isPostgresEnabled } from "@/lib/storage/postgres";
import { enqueueWebhookEvent } from "@/lib/webhooks";

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validateStripe(payload: string, signature: string | null) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return { ok: true, verified: false };
  if (!signature) return { ok: false, verified: false };
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=") as [string, string]));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return { ok: false, verified: false };
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return { ok: false, verified: false };
  const expected = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
  return { ok: timingSafeEqual(expected, v1), verified: true };
}

function validateRazorpay(payload: string, signature: string | null) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return { ok: true, verified: false };
  if (!signature) return { ok: false, verified: false };
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest("hex");
  return { ok: timingSafeEqual(expected, signature), verified: true };
}

export async function POST(request: Request) {
  const provider = request.headers.get("stripe-signature") ? "stripe" : request.headers.get("x-razorpay-signature") ? "razorpay" : "local";
  const payload = await request.text();
  const validation =
    provider === "stripe"
      ? validateStripe(payload, request.headers.get("stripe-signature"))
      : provider === "razorpay"
        ? validateRazorpay(payload, request.headers.get("x-razorpay-signature"))
        : { ok: !process.env.REQUIRE_PAYMENT_WEBHOOK_SIGNATURE, verified: false };
  if (!validation.ok) {
    log("warn", "payment.webhook.rejected", { provider, bytes: payload.length });
    return json({ error: "Invalid webhook signature" }, 401);
  }
  const parsed = (() => {
    try {
      return JSON.parse(payload || "{}");
    } catch {
      return {};
    }
  })();
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    const organizationId =
      parsed?.data?.object?.metadata?.organization_id ??
      parsed?.payload?.payment?.entity?.notes?.organization_id ??
      parsed?.metadata?.organization_id ??
      "00000000-0000-0000-0000-000000000001";
    const invoiceId = parsed?.data?.object?.metadata?.invoice_id ?? parsed?.payload?.payment?.entity?.notes?.invoice_id ?? parsed?.metadata?.invoice_id ?? null;
    const amountCents = Number(parsed?.data?.object?.amount_total ?? parsed?.payload?.payment?.entity?.amount ?? parsed?.amount ?? 0);
    const currency = String(parsed?.data?.object?.currency ?? parsed?.payload?.payment?.entity?.currency ?? parsed?.currency ?? "usd").toLowerCase();
    const paymentId = parsed?.data?.object?.id ?? parsed?.payload?.payment?.entity?.id ?? parsed?.id ?? null;
    const status = parsed?.data?.object?.payment_status ?? parsed?.payload?.payment?.entity?.status ?? parsed?.status ?? "received";
    if (db && amountCents > 0) {
      await db.query(
        `
        INSERT INTO payments (organization_id, invoice_id, provider, provider_payment_id, status, amount_cents, currency, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        `,
        [organizationId, invoiceId, provider, paymentId, status, amountCents, currency, parsed]
      );
      if (invoiceId && ["paid", "captured", "succeeded"].includes(String(status))) {
        await db.query("UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1 AND organization_id = $2", [invoiceId, organizationId]);
      }
      await enqueueWebhookEvent({
        organizationId,
        eventType: "invoice.generated",
        resourceType: "payment",
        payload: { provider, payment_id: paymentId, invoice_id: invoiceId, status, amount_cents: amountCents, currency }
      });
    }
  }
  log("info", "payment.webhook.received", {
    provider,
    bytes: payload.length,
    verified: validation.verified
  });
  return json({ received: true, provider });
}
