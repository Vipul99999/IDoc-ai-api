import { json } from "@/lib/http";
import { healthSnapshot } from "@/lib/monitoring/metrics";

export async function GET() {
  return json(await healthSnapshot());
}
