import { json } from "@/lib/http";
import { runSecurityAudit } from "@/lib/security-audit/audit";

export async function GET() {
  return json({ audit: await runSecurityAudit() });
}
