import path from "node:path";

export const DATA_ROOT = path.resolve(process.env.DATA_ROOT ?? "../../data");
export const UPLOAD_DIR = path.join(DATA_ROOT, "uploads");
export const OUTPUT_DIR = path.join(DATA_ROOT, "outputs");
export const DOCUMENT_DIR = path.join(DATA_ROOT, "documents");
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 25);
export const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 30);
export const DATABASE_URL = process.env.DATABASE_URL;
export const RABBITMQ_URL = process.env.RABBITMQ_URL;
export const JWT_SECRET = process.env.JWT_SECRET ?? "local-development-jwt-secret";

export const MINIO_CONFIG = {
  endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY ?? "intellidoc",
  secretKey: process.env.MINIO_SECRET_KEY ?? "intellidoc-secret",
  bucket: process.env.MINIO_BUCKET ?? "documents"
};

export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
  ".webp",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".doc",
  ".docx",
  ".odt",
  ".rtf",
  ".txt",
  ".md",
  ".csv",
  ".tsv",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".html",
  ".xml",
  ".json"
];

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp", ".bmp", ".gif", ".heic", ".heif"];
export const OFFICE_EXTENSIONS = [".doc", ".docx", ".odt", ".rtf", ".xls", ".xlsx", ".ppt", ".pptx"];
export const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".tsv", ".html", ".xml", ".json"];
