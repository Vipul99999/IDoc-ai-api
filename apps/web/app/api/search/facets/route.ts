import { json } from "@/lib/http";
import { searchFacets } from "@/lib/search-engine";

export async function GET() {
  return json({ facets: await searchFacets() });
}
