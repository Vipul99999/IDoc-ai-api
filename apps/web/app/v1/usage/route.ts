import { readUsageRecords, requireV1Auth, summarizeUsage, v1Response } from "@/lib/v1";

export async function GET(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["usage:read"]);
  if (!principal) return response;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? 100)));
  const records = (await readUsageRecords()).filter((record) => record.tenantId === principal.tenantId);
  return v1Response(request, principal.tenantId, {
    totals: summarizeUsage(records),
    records: records.slice(0, limit)
  });
}
