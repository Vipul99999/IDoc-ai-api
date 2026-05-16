import crypto from "node:crypto";
import { json } from "@/lib/http";
import { log } from "@/lib/monitoring/logger";

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
  log("info", "payment.webhook.received", {
    provider,
    bytes: payload.length,
    verified: validation.verified
  });
  return json({ received: true, provider });
}
