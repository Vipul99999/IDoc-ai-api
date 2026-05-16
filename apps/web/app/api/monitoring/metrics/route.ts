import { collectMetrics, toPrometheus } from "@/lib/monitoring/metrics";

export async function GET(request: Request) {
  const metrics = await collectMetrics();
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return Response.json({ metrics, collectedAt: new Date().toISOString() });
  }
  return new Response(`${toPrometheus(metrics)}\n`, {
    headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" }
  });
}
