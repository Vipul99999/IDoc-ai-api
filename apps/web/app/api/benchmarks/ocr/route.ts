import { json } from "@/lib/http";
import { runOcrBenchmark } from "@/lib/benchmark/ocr";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { groundTruth?: Record<string, string> };
  return json({ benchmark: await runOcrBenchmark(body.groundTruth ?? {}) });
}

export async function GET() {
  return json({ benchmark: await runOcrBenchmark() });
}
