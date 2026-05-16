import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("format support includes common real-world document and image extensions", async () => {
  const source = await readFile("apps/web/lib/config.ts", "utf8");
  for (const extension of [".pdf", ".jpg", ".png", ".tiff", ".webp", ".heic", ".docx", ".xlsx", ".pptx", ".csv", ".json"]) {
    assert.match(source, new RegExp(extension.replace(".", "\\.")));
  }
});

test("advanced native parsers cover office spreadsheet presentation and structured data", async () => {
  const parser = await readFile("apps/web/lib/pipeline/native-parse.ts", "utf8");
  for (const marker of ["mammoth", "xlsx", "pptx-xml-native", "odt-xml-native", "json-native", "html-native"]) {
    assert.match(parser, new RegExp(marker));
  }

  const aiService = await readFile("apps/ai-services/app/main.py", "utf8");
  assert.match(aiService, /fitz/);
  assert.match(aiService, /adaptiveThreshold/);
});
