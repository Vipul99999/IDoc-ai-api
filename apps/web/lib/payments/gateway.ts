export type CheckoutInput = {
  amountCents: number;
  currency: string;
  description: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
};

export async function createCheckoutSession(input: CheckoutInput) {
  if (process.env.STRIPE_SECRET_KEY) {
    const body = new URLSearchParams({
      mode: "payment",
      success_url: input.successUrl ?? "http://localhost:3000?payment=success",
      cancel_url: input.cancelUrl ?? "http://localhost:3000?payment=cancelled",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(input.amountCents),
      "line_items[0][price_data][product_data][name]": input.description
    });
    Object.entries(input.metadata ?? {}).forEach(([key, value]) => body.set(`metadata[${key}]`, value));
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (!response.ok) throw new Error(`Stripe checkout failed: ${response.status}`);
    const session = (await response.json()) as { id: string; url: string };
    return { provider: "stripe", id: session.id, url: session.url };
  }

  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency.toUpperCase(),
        notes: input.metadata
      })
    });
    if (!response.ok) throw new Error(`Razorpay order failed: ${response.status}`);
    const order = (await response.json()) as { id: string };
    return { provider: "razorpay", id: order.id, url: null };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Configure STRIPE_SECRET_KEY or RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET before accepting production payments.");
  }

  return {
    provider: "local-sandbox",
    id: `local_${Date.now()}`,
    url: input.successUrl ?? "http://localhost:3000?payment=sandbox"
  };
}
