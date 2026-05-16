import { searchDocuments } from "@/lib/search";
import { json } from "@/lib/http";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const hits = await searchDocuments(query);
  return json({ hits });
}
