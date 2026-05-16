import { promises as fs } from "node:fs";
import path from "node:path";
import { DOCUMENT_DIR, OUTPUT_DIR, UPLOAD_DIR } from "@/lib/config";

export async function ensureStorage() {
  await Promise.all([
    fs.mkdir(UPLOAD_DIR, { recursive: true }),
    fs.mkdir(OUTPUT_DIR, { recursive: true }),
    fs.mkdir(DOCUMENT_DIR, { recursive: true })
  ]);
}

export function documentPath(id: string) {
  return path.join(DOCUMENT_DIR, `${id}.json`);
}

export function outputPath(id: string, filename: string) {
  return path.join(OUTPUT_DIR, id, filename);
}

export async function writeOutput(id: string, filename: string, content: string | Buffer) {
  const dir = path.join(OUTPUT_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, filename);
  await fs.writeFile(target, content);
  return target;
}

export async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // File may already be gone after manual cleanup.
  }
}

export async function safeRemoveDir(dirPath: string) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Directory may already be gone after retention cleanup.
  }
}
