import { readUsageRecords, requireV1Auth, summarizeUsage, v1Response } from "@/lib/v1";
import { getPostgresPool, isPostgresEnabled } from "@/lib/storage/postgres";

export async function GET(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["billing:read"]);
  if (!principal) return response;
  const records = (await readUsageRecords()).filter((record) => record.tenantId === principal.tenantId);
  const usage = summarizeUsage(records);
  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (db) {
      const result = await db.query(
        `
        SELECT i.id, i.status, i.currency, i.subtotal_cents, i.tax_cents, i.total_cents, i.due_at, i.issued_at, i.paid_at, i.created_at,
          COALESCE(json_agg(json_build_object(
            'id', li.id,
            'meter', li.meter,
            'description', li.description,
            'quantity', li.quantity,
            'unit_price_cents', li.unit_price_cents,
            'total_cents', li.total_cents
          )) FILTER (WHERE li.id IS NOT NULL), '[]') AS line_items
        FROM invoices i
        LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
        WHERE i.organization_id = $1
        GROUP BY i.id
        ORDER BY i.created_at DESC
        LIMIT 100
        `,
        [principal.tenantId]
      );
      if (result.rows.length > 0) {
        return v1Response(request, principal.tenantId, {
          invoices: result.rows.map((invoice) => ({
            id: invoice.id,
            status: invoice.status,
            currency: invoice.currency,
            subtotal_cents: invoice.subtotal_cents,
            tax_cents: invoice.tax_cents,
            total_cents: invoice.total_cents,
            due_at: invoice.due_at?.toISOString?.() ?? null,
            issued_at: invoice.issued_at?.toISOString?.() ?? null,
            paid_at: invoice.paid_at?.toISOString?.() ?? null,
            created_at: invoice.created_at?.toISOString?.() ?? String(invoice.created_at),
            line_items: invoice.line_items
          }))
        });
      }
    }
  }
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
