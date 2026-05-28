import { readUsageRecords, requireV1Auth, summarizeUsage, v1Response } from "@/lib/v1";
import { getPostgresPool, isPostgresEnabled } from "@/lib/storage/postgres";

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
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const [plansResult, subscriptionResult] = await Promise.all([
        db.query("SELECT id, name, price_monthly_cents, included_pages, included_storage_mb, overage_page_cents, features FROM plans ORDER BY price_monthly_cents NULLS LAST"),
        db.query(
          `
          SELECT s.id, s.plan_id, s.status, s.current_period_start, s.current_period_end, s.provider, p.name AS plan_name
          FROM subscriptions s
          JOIN plans p ON p.id = s.plan_id
          WHERE s.organization_id = $1
          ORDER BY s.created_at DESC
          LIMIT 1
          `,
          [principal.tenantId]
        )
      ]);
      const subscription = subscriptionResult.rows[0];
      return v1Response(request, principal.tenantId, {
        subscription: subscription
          ? {
              id: subscription.id,
              plan_id: subscription.plan_id,
              plan_name: subscription.plan_name,
              status: subscription.status,
              provider: subscription.provider,
              current_period_start: subscription.current_period_start?.toISOString?.() ?? String(subscription.current_period_start),
              current_period_end: subscription.current_period_end?.toISOString?.() ?? String(subscription.current_period_end),
              usage
            }
          : {
              plan_id: "free",
              status: "active",
              current_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
              current_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
              usage
            },
        plans: plansResult.rows.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price_monthly_usd: plan.price_monthly_cents == null ? null : Number(plan.price_monthly_cents) / 100,
          included_pages: plan.included_pages,
          included_storage_mb: plan.included_storage_mb,
          overage_page_cents: plan.overage_page_cents,
          features: plan.features ?? []
        }))
      });
    }
  }
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
