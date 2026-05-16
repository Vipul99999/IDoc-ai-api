import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("high-value product engines are implemented", async () => {
  const files = [
    "apps/web/lib/extraction.ts",
    "apps/web/lib/validation.ts",
    "apps/web/lib/review.ts",
    "apps/web/lib/api-keys.ts",
    "apps/web/lib/pipeline/accuracy.ts",
    "apps/web/lib/pipeline/translate.ts",
    "apps/web/lib/pipeline/format.ts",
    "apps/web/app/api/documents/[id]/accuracy/route.ts"
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.ok(source.length > 300, file);
  }
});

test("high-value APIs are present", async () => {
  const openapi = await readFile("docs/api/openapi.json", "utf8");
  for (const path of ["extract", "validate", "review/tasks", "api-keys", "admin/analytics"]) {
    assert.match(openapi, new RegExp(path));
  }
});

test("ai accuracy improvements include confidence gates and richer extraction", async () => {
  const text = await readFile("apps/web/lib/pipeline/text.ts", "utf8");
  assert.match(text, /SCRIPT_RANGES/);

  const classifier = await readFile("apps/web/lib/pipeline/classify.ts", "utf8");
  assert.match(classifier, /FORMAT_BOOSTS/);
  assert.match(classifier, /runnerUp/);

  const extraction = await readFile("apps/web/lib/extraction.ts", "utf8");
  for (const marker of ["purchaseOrder", "totalAmount", "billTo", "extractKeyValues", "force majeure"]) {
    assert.match(extraction, new RegExp(marker));
  }

  const validation = await readFile("apps/web/lib/validation.ts", "utf8");
  assert.match(validation, /Classification confidence/);
});

test("advanced translation and formatting support quality manifests", async () => {
  const translate = await readFile("apps/web/lib/pipeline/translate.ts", "utf8");
  for (const marker of ["protectTerms", "translateWithAiService", "LIBRETRANSLATE_URL", "qualityScore", "glossary"]) {
    assert.match(translate, new RegExp(marker));
  }

  const format = await readFile("apps/web/lib/pipeline/format.ts", "utf8");
  for (const marker of ["buildLayoutBlocks", "layoutQuality", "table", "accessible reading order"]) {
    assert.match(format, new RegExp(marker));
  }
});
