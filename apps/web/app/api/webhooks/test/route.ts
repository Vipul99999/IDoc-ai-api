import { v4 as uuidv4 } from "uuid";
import { json } from "@/lib/http";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  return json({
    delivered: true,
    eventId: uuidv4(),
    event: payload.event ?? "document.analysis.completed",
    target: payload.target ?? "https://example.com/webhooks/intellidoc",
    createdAt: new Date().toISOString()
  });
}
