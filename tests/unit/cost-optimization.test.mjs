import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cost optimization engine and APIs are implemented", async () => {
  const engine = await readFile("apps/web/lib/cost.ts", "utf8");
  const estimateRoute = await readFile("apps/web/app/api/cost/estimate/route.ts", "utf8");
  const optimizeRoute = await readFile("apps/web/app/api/cost/optimize/route.ts", "utf8");
  assert.match(engine, /single-vm-cpu-first/);
  assert.match(estimateRoute, /estimatePortfolioCost/);
  assert.match(optimizeRoute, /possibleSavings/);
});

test("low-cost compose profile exists", async () => {
  const compose = await readFile("docker-compose.yml", "utf8");
  assert.match(compose, /low-cost/);
  assert.match(compose, /SEARCH_MODE: local/);
});
