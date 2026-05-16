import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { DATA_ROOT } from "@/lib/config";

type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  hash: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
};

function filePath() {
  return path.join(DATA_ROOT, "settings", "api-keys.json");
}

async function readKeys(): Promise<ApiKeyRecord[]> {
  try {
    return JSON.parse(await fs.readFile(filePath(), "utf8")) as ApiKeyRecord[];
  } catch {
    return [];
  }
}

export async function verifyApiKey(secret: string) {
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  const keys = await readKeys();
  const key = keys.find((item) => item.hash === hash);
  if (!key) return null;
  key.lastUsedAt = new Date().toISOString();
  await writeKeys(keys);
  return key;
}

async function writeKeys(keys: ApiKeyRecord[]) {
  await fs.mkdir(path.dirname(filePath()), { recursive: true });
  await fs.writeFile(filePath(), JSON.stringify(keys, null, 2));
}

export async function listApiKeys() {
  return (await readKeys()).map(({ hash, ...key }) => key);
}

export async function createApiKey(name: string, scopes: string[]) {
  const secret = `idoc_${crypto.randomBytes(24).toString("hex")}`;
  const record: ApiKeyRecord = {
    id: uuidv4(),
    name,
    prefix: secret.slice(0, 12),
    hash: crypto.createHash("sha256").update(secret).digest("hex"),
    scopes,
    createdAt: new Date().toISOString()
  };
  const keys = await readKeys();
  await writeKeys([record, ...keys]);
  return { ...record, hash: undefined, secret };
}

export async function revokeApiKey(id: string) {
  const keys = await readKeys();
  await writeKeys(keys.filter((key) => key.id !== id));
  return true;
}
