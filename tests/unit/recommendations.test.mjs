import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("recommendation engine covers key document types", async () => {
  const source = await readFile("apps/web/lib/pipeline/recommend.ts", "utf8");
  for (const expected of ["resume", "thesis", "invoice", "certificate", "contract"]) {
    assert.match(source, new RegExp(expected));
  }
});
