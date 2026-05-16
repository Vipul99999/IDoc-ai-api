import { readUsageRecords, requireV1Auth, summarizeUsage, v1Response } from "@/lib/v1";

export async function GET(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["billing:read"]);
  if (!principal) return response;
  const records = (await readUsageRecords()).filter((record) => record.tenantId === principal.tenantId);
  const usage = summarizeUsage(records);
  const pages = Number(usage.page_processed ?? 0) + Number(usage.ocr_page ?? 0);
  const storageMb = Number(usage.storage_mb_month ?? 0);
  const amountCents = Math.max(0, pages - 100) * 4 + Math.ceil(storageMb);
  return v1Response(request, principal.tenantId, {
    invoices: [
      {
        id: "draft-current",
        status: "draft",
        currency: "usd",
        amount_due_cents: amountCents,
        period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
        line_items: [
          { meter: "billable_pages", quantity: pages, included: 100, unit_price_cents: 4 },
          { meter: "storage_mb_month", quantity: storageMb, included: 0, unit_price_cents: 1 }
        ]
      }
    ]
  });
}
