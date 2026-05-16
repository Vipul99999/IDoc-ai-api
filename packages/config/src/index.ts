export const platformConfig = {
  appName: "IntelliDoc AI",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 25),
  retentionDays: Number(process.env.RETENTION_DAYS ?? 30),
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4000",
  aiServicesUrl: process.env.AI_SERVICES_URL ?? "http://localhost:8000",
  costTargetMonthlyUsd: 50
};

export const supportedFormats = ["pdf", "png", "jpg", "jpeg", "tiff", "docx", "txt"] as const;
