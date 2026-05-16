import { json } from "@/lib/http";
import { searchSuggestions } from "@/lib/search-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return json({ suggestions: await searchSuggestions(searchParams.get("q") ?? "") });
}
