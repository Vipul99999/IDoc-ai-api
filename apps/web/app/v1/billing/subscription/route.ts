import { readUsageRecords, requireV1Auth, summarizeUsage, v1Response } from "@/lib/v1";

const plans = [
  { id: "free", name: "Free", price_monthly_usd: 0, included_pages: 100, overage_page_cents: 4 },
  { id: "starter", name: "Starter", price_monthly_usd: 29, included_pages: 1000, overage_page_cents: 3 },
  { id: "growth", name: "Growth", price_monthly_usd: 99, included_pages: 5000, overage_page_cents: 2 },
  { id: "business", name: "Business", price_monthly_usd: 499, included_pages: 30000, overage_page_cents: 1 },
  { id: "enterprise", name: "Enterprise", price_monthly_usd: null, included_pages: null, overage_page_cents: null }
];

export async function GET(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["billing:read"]);
  if (!principal) return response;
  const usage = summarizeUsage((await readUsageRecords()).filter((record) => record.tenantId === principal.tenantId));
  return v1Response(request, principal.tenantId, {
    subscription: {
      plan_id: "free",
      status: "active",
      current_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      current_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      usage
    },
    plans
  });
}
