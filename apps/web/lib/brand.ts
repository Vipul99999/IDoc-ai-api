import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "@/lib/config";

export type BrandSettings = {
  name: string;
  tagline: string;
  logoText: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  marketplaceName: string;
  domainHint: string;
  enabledModules: string[];
};

const DEFAULT_BRAND: BrandSettings = {
  name: "IntelliDoc AI",
  tagline: "Document intelligence for print, search, compliance, and knowledge workflows.",
  logoText: "ID",
  primaryColor: "#17211b",
  accentColor: "#34785f",
  supportEmail: "support@intellidoc.local",
  marketplaceName: "IntelliDoc Print Network",
  domainHint: "intellidoc.local",
  enabledModules: [
    "quality-analysis",
    "ocr",
    "translation",
    "formatting",
    "semantic-search",
    "privacy-redaction",
    "print-marketplace",
    "billing",
    "audit"
  ]
};

function brandPath() {
  return path.join(DATA_ROOT, "settings", "brand.json");
}

export async function getBrandSettings() {
  try {
    return { ...DEFAULT_BRAND, ...JSON.parse(await fs.readFile(brandPath(), "utf8")) } as BrandSettings;
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function saveBrandSettings(settings: Partial<BrandSettings>) {
  const next = { ...(await getBrandSettings()), ...settings };
  await fs.mkdir(path.dirname(brandPath()), { recursive: true });
  await fs.writeFile(brandPath(), JSON.stringify(next, null, 2));
  return next;
}
