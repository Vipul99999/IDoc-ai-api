import { z } from "zod";
import { json, badRequest } from "@/lib/http";
import { RETENTION_DAYS } from "@/lib/config";

let policy = {
  defaultRetentionDays: RETENTION_DAYS,
  autoDeleteEnabled: false,
  legalHoldTags: ["restricted-sharing", "identity-data", "health-privacy"],
  exportBeforeDelete: true
};

const schema = z.object({
  defaultRetentionDays: z.number().int().min(1).max(3650).optional(),
  autoDeleteEnabled: z.boolean().optional(),
  legalHoldTags: z.array(z.string()).optional(),
  exportBeforeDelete: z.boolean().optional()
});

export async function GET() {
  return json({ policy });
}

export async function PATCH(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Invalid retention policy.");
  policy = { ...policy, ...body.data };
  return json({ policy });
}
