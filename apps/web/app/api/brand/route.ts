import { z } from "zod";
import { getBrandSettings, saveBrandSettings } from "@/lib/brand";
import { badRequest, json } from "@/lib/http";

const schema = z.object({
  name: z.string().min(2).optional(),
  tagline: z.string().min(8).optional(),
  logoText: z.string().min(1).max(4).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  supportEmail: z.string().email().optional(),
  marketplaceName: z.string().min(2).optional(),
  domainHint: z.string().min(3).optional(),
  enabledModules: z.array(z.string()).optional()
});

export async function GET() {
  return json({ brand: await getBrandSettings() });
}

export async function PATCH(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Invalid brand settings.");
  return json({ brand: await saveBrandSettings(body.data) });
}
