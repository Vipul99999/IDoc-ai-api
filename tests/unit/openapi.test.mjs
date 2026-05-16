import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("openapi document declares required API groups", async () => {
  const openapi = JSON.parse(await readFile("docs/api/openapi.json", "utf8"));
  assert.equal(openapi.openapi, "3.1.0");
  assert.ok(openapi.paths["/api/documents/upload"]);
  assert.ok(openapi.paths["/api/documents/{id}/accuracy"]);
  assert.ok(openapi.paths["/api/search"]);
  assert.ok(openapi.paths["/api/monitoring/health"]);
  assert.ok(openapi.paths["/api/payments/checkout"]);
  assert.ok(openapi.paths["/api/security/audit"]);
  assert.ok(openapi.paths["/api/enterprise/usage"]);
});
