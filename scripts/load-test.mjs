const baseUrl = process.env.WEB_URL ?? "http://localhost:3000";
const apiKey = process.env.INTELLIDOC_API_KEY;
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 10);
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 100);

async function call(index) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/v1/billing/subscription`, {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {}
  });
  const latencyMs = performance.now() - started;
  return { index, ok: response.ok, status: response.status, latencyMs };
}

const queue = Array.from({ length: requests }, (_, index) => index);
const results = [];

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const index = queue.shift();
      if (index === undefined) return;
      results.push(await call(index).catch((error) => ({ index, ok: false, status: 0, latencyMs: 0, error: error.message })));
    }
  })
);

const sorted = results.map((result) => result.latencyMs).sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
const failures = results.filter((result) => !result.ok);

const summary = {
  baseUrl,
  requests,
  concurrency,
  success: results.length - failures.length,
  failures: failures.length,
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
  passed: failures.length === 0 && percentile(0.95) < 500
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exit(1);
