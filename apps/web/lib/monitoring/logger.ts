export type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, message: string, metadata: Record<string, unknown> = {}) {
  const entry = {
    level,
    message,
    service: "intellidoc-web",
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
    ...metadata
  };
  console[level === "debug" ? "log" : level](JSON.stringify(entry));
}
