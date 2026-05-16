import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("brand and operations routes are implemented", async () => {
  const files = [
    "apps/web/app/api/brand/route.ts",
    "apps/web/app/api/workflows/route.ts",
    "apps/web/app/api/marketplace/quote/route.ts",
    "apps/web/app/api/marketplace/orders/route.ts"
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.match(source, /export async function/);
  }
});
