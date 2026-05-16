import { z } from "zod";
import { badRequest, json } from "@/lib/http";
import { advancedSearch } from "@/lib/search-engine";

const schema = z.object({
  query: z.string().default(""),
  documentType: z.string().optional(),
  language: z.string().optional(),
  category: z.string().optional(),
  minQuality: z.number().optional(),
  maxComplianceRisk: z.number().optional(),
  hasSensitiveData: z.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional()
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Invalid advanced search request.");
  return json(await advancedSearch(body.data));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return json(
    await advancedSearch({
      query: searchParams.get("q") ?? "",
      documentType: searchParams.get("documentType") ?? undefined,
      language: searchParams.get("language") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      minQuality: searchParams.get("minQuality") ? Number(searchParams.get("minQuality")) : undefined,
      maxComplianceRisk: searchParams.get("maxComplianceRisk") ? Number(searchParams.get("maxComplianceRisk")) : undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined
    })
  );
}
