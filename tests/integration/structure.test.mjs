import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";

test("monorepo contains required platform services", async () => {
  const required = [
    "apps/web/app/page.tsx",
    "apps/api/src/main.mjs",
    "apps/ai-services/app/main.py",
    "apps/worker/src/worker.mjs",
    "database/migrations/001_initial_schema.sql",
    "packages/sdk/src/index.ts"
  ];

  for (const file of required) {
    await access(file);
    assert.ok(true, file);
  }
});
