const baseUrl = process.env.WEB_URL ?? "http://localhost:3000";
const token = process.env.INTELLIDOC_TOKEN;

const response = await fetch(`${baseUrl}/api/security/audit`, {
  headers: token ? { authorization: `Bearer ${token}` } : {}
});

if (!response.ok) {
  console.error(`Security audit failed: ${response.status}`);
  process.exit(1);
}

const { audit } = await response.json();
console.log(JSON.stringify(audit, null, 2));
process.exit(audit.posture === "not-production-ready" ? 1 : 0);
