import { z } from "zod";
import { badRequest, json } from "@/lib/http";
import { createCheckoutSession } from "@/lib/payments/gateway";

const schema = z.object({
  amountCents: z.number().int().positive().max(5000000),
  currency: z.string().min(3).max(3).default("usd"),
  description: z.string().min(1).max(120).default("IntelliDoc credits"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.string()).optional()
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Valid payment checkout details are required.");
  const session = await createCheckoutSession(body.data);
  return json({ session });
}
