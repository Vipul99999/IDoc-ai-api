import { searchDocuments } from "@/lib/search";
import { requireV1Auth, recordUsage, v1Response } from "@/lib/v1";

export async function GET(request: Request) {
  const { principal, response } = await requireV1Auth(request, ["search:read"]);
  if (!principal) return response;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const hits = await searchDocuments(query);
  await recordUsage(principal, "search_query", 1, { q: query });
  return v1Response(request, principal.tenantId, { hits, query });
}
