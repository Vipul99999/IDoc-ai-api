import { IMAGE_EXTENSIONS, OFFICE_EXTENSIONS, TEXT_EXTENSIONS } from "@/lib/config";

export function detectedCategory(extension: string) {
  if (extension === ".pdf") return "pdf" as const;
  if (IMAGE_EXTENSIONS.includes(extension)) return "image" as const;
  if (OFFICE_EXTENSIONS.includes(extension)) return "office" as const;
  if ([".csv", ".tsv", ".json", ".xml"].includes(extension)) return "data" as const;
  if (TEXT_EXTENSIONS.includes(extension)) return "text" as const;
  return "unknown" as const;
}

export function formatCapabilities(extension: string) {
  const category = detectedCategory(extension);
  return {
    category,
    preview: ["pdf", "image", "office", "text", "data"].includes(category),
    ocr: category === "image" || category === "pdf",
    textExtraction: category !== "unknown",
    nativeParsing: ["pdf", "office", "text", "data"].includes(category),
    structuredExtraction: ["office", "text", "data"].includes(category),
    layoutReconstruction: ["pdf", "office", "image"].includes(category),
    thumbnail: ["pdf", "image", "office"].includes(category)
  };
}
