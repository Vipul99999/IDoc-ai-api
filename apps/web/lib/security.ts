import crypto from "node:crypto";

const SUSPICIOUS_PATTERNS = [
  "eicar-standard-antivirus-test-file",
  "autoopen",
  "powershell -enc",
  "wscript.shell",
  "createobject("
];

export function scanForMalware(buffer: Buffer) {
  const text = buffer.toString("latin1").toLowerCase();
  const findings = SUSPICIOUS_PATTERNS.filter((pattern) => text.includes(pattern));
  return {
    status: findings.length > 0 ? ("blocked" as const) : ("clean" as const),
    engine: "local-signature-scan-v1",
    findings,
    scannedAt: new Date().toISOString()
  };
}

export function createSignedToken(documentId: string, expiresAt: string) {
  const secret = process.env.SIGNED_URL_SECRET ?? "local-development-secret";
  return crypto.createHmac("sha256", secret).update(`${documentId}:${expiresAt}`).digest("hex");
}

export function verifySignedToken(documentId: string, expiresAt: string, token: string) {
  if (Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) < Date.now()) return false;
  const expected = createSignedToken(documentId, expiresAt);
  const expectedBuffer = Buffer.from(expected, "hex");
  const tokenBuffer = Buffer.from(token, "hex");
  return expectedBuffer.length === tokenBuffer.length && crypto.timingSafeEqual(expectedBuffer, tokenBuffer);
}
