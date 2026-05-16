import { promises as fs } from "node:fs";
import path from "node:path";
import { Client } from "minio";
import { MINIO_CONFIG, UPLOAD_DIR } from "@/lib/config";

let client: Client | null = null;

export function isMinioEnabled() {
  return process.env.OBJECT_STORAGE === "minio" || Boolean(process.env.MINIO_ENDPOINT);
}

function minio() {
  client ??= new Client({
    endPoint: MINIO_CONFIG.endPoint,
    port: MINIO_CONFIG.port,
    useSSL: MINIO_CONFIG.useSSL,
    accessKey: MINIO_CONFIG.accessKey,
    secretKey: MINIO_CONFIG.secretKey
  });
  return client;
}

export async function putOriginalObject(id: string, extension: string, buffer: Buffer) {
  const objectName = `${id}${extension}`;
  if (!isMinioEnabled()) {
    const storagePath = path.join(UPLOAD_DIR, objectName);
    await fs.writeFile(storagePath, buffer);
    return storagePath;
  }

  const client = minio();
  const exists = await client.bucketExists(MINIO_CONFIG.bucket).catch(() => false);
  if (!exists) await client.makeBucket(MINIO_CONFIG.bucket);
  await client.putObject(MINIO_CONFIG.bucket, objectName, buffer);
  return `minio://${MINIO_CONFIG.bucket}/${objectName}`;
}

export async function readOriginalObject(storagePath: string) {
  if (!storagePath.startsWith("minio://")) return fs.readFile(storagePath);
  const [, rest] = storagePath.split("minio://");
  const [bucket, ...parts] = rest.split("/");
  const objectName = parts.join("/");
  const stream = await minio().getObject(bucket, objectName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function deleteOriginalObject(storagePath: string) {
  if (!storagePath.startsWith("minio://")) {
    await fs.unlink(storagePath).catch(() => undefined);
    return true;
  }
  const [, rest] = storagePath.split("minio://");
  const [bucket, ...parts] = rest.split("/");
  await minio().removeObject(bucket, parts.join("/")).catch(() => undefined);
  return true;
}

export async function signedObjectUrl(storagePath: string, expirySeconds = 900) {
  if (!storagePath.startsWith("minio://")) return null;
  const [, rest] = storagePath.split("minio://");
  const [bucket, ...parts] = rest.split("/");
  return minio().presignedGetObject(bucket, parts.join("/"), expirySeconds);
}
