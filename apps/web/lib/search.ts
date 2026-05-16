import { advancedSearch } from "@/lib/search-engine";
import { SearchHit } from "@/lib/types";

export async function searchDocuments(query: string): Promise<SearchHit[]> {
  return (await advancedSearch({ query })).hits;
}
