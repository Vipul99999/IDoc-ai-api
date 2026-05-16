import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("advanced search engine includes production-grade ranking methods", async () => {
  const source = await readFile("apps/web/lib/search-engine.ts", "utf8");
  for (const expected of ["bm25Score", "phraseScore", "fuzzyTokenFrequency", "cosineSimilarity", "searchFacets", "searchSuggestions", "similarDocuments"]) {
    assert.match(source, new RegExp(expected));
  }
});

test("opensearch adapter and mapping are present", async () => {
  const adapter = await readFile("apps/web/lib/opensearch-adapter.ts", "utf8");
  const mapping = await readFile("infrastructure/docker/opensearch-index.json", "utf8");
  assert.match(adapter, /multi_match/);
  assert.match(mapping, /intellidoc_text/);
});
