import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function notFound(message = "Document not found") {
  return json({ error: message }, 404);
}

export function badRequest(message: string) {
  return json({ error: message }, 400);
}

export function serviceUnavailable(message: string) {
  return json({ error: message }, 503);
}
