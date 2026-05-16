import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const port = Number(process.env.PORT ?? 4000);
const rateLimits = new Map();

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "x-request-id": body.requestId ?? randomUUID()
  });
  res.end(JSON.stringify(body, null, 2));
}

function authorize(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  return token || process.env.NODE_ENV !== "production";
}

function rateLimit(req) {
  const key = req.socket.remoteAddress ?? "local";
  const now = Date.now();
  const windowMs = 60_000;
  const current = rateLimits.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (current.resetAt < now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  rateLimits.set(key, current);
  return current.count <= 120;
}

createServer(async (req, res) => {
  const requestId = randomUUID();
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (!rateLimit(req)) return json(res, 429, { requestId, error: "Rate limit exceeded" });
  if (url.pathname !== "/health" && url.pathname !== "/openapi.json" && !authorize(req)) {
    return json(res, 401, { requestId, error: "Unauthorized" });
  }

  if (url.pathname === "/health") {
    return json(res, 200, {
      requestId,
      data: {
        service: "api-gateway",
        status: "ok",
        modules: ["auth", "upload", "analysis", "ocr", "translation", "search", "billing", "admin"]
      }
    });
  }

  if (url.pathname === "/openapi.json") {
    const openapi = await readFile(join(process.cwd(), "docs", "api", "openapi.json"), "utf8").catch(() => "{}");
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(openapi);
  }

  return json(res, 200, {
    requestId,
    data: {
      message: "NestJS-ready API gateway boundary. The web app currently exposes the runnable local APIs.",
      nextStep: "Swap this lightweight gateway for Nest controllers using the documented modules."
    }
  });
}).listen(port, () => {
  console.log(`IntelliDoc API gateway listening on http://localhost:${port}`);
});
