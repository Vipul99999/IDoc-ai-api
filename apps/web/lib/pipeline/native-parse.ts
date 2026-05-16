import path from "node:path";
import { PDFParse } from "pdf-parse";

export type NativeParseResult = {
  text: string;
  engine: string;
  confidence: number;
  structure: {
    sheets?: string[];
    slides?: number;
    tables?: number;
    format: string;
  };
};

function printableFallback(buffer: Buffer) {
  return buffer
    .toString("utf8")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanText(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function xmlText(text: string) {
  return cleanText(text.replace(/<[^>]+>/g, " "));
}

function rtfText(text: string) {
  return text
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function parsePdf(buffer: Buffer): Promise<NativeParseResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    const text = cleanText(parsed.text ?? "");
    return {
      text,
      engine: text.length > 20 ? "pdf-parse-native" : "pdf-parse-empty-scanned",
      confidence: text.length > 20 ? 0.94 : 0.18,
      structure: { format: "pdf" }
    };
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<NativeParseResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: cleanText(result.value),
    engine: "mammoth-docx",
    confidence: result.value.trim().length ? 0.92 : 0.3,
    structure: { format: "docx" }
  };
}

async function parseSpreadsheet(buffer: Buffer, extension: string): Promise<NativeParseResult> {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const sheetTexts = workbook.SheetNames.slice(0, 12).map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = xlsx.utils.sheet_to_csv(sheet, { FS: ",", RS: "\n", blankrows: false });
    return `Sheet: ${sheetName}\n${csv}`;
  });
  return {
    text: cleanText(sheetTexts.join("\n\n")),
    engine: `xlsx-native-${extension.replace(".", "")}`,
    confidence: sheetTexts.length ? 0.9 : 0.35,
    structure: { format: extension.replace(".", ""), sheets: workbook.SheetNames, tables: workbook.SheetNames.length }
  };
}

async function parsePptx(buffer: Buffer): Promise<NativeParseResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1] ?? 0) - Number(b.match(/slide(\d+)/)?.[1] ?? 0));
  const slides = await Promise.all(
    slideFiles.map(async (name, index) => {
      const xml = await zip.files[name].async("text");
      const runs = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) => cleanText(match[1]));
      return `Slide ${index + 1}\n${runs.filter(Boolean).join("\n")}`;
    })
  );
  return {
    text: cleanText(slides.join("\n\n")),
    engine: "pptx-xml-native",
    confidence: slides.length ? 0.86 : 0.28,
    structure: { format: "pptx", slides: slides.length }
  };
}

async function parseOdt(buffer: Buffer): Promise<NativeParseResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const content = await zip.files["content.xml"]?.async("text");
  return {
    text: xmlText(content ?? ""),
    engine: "odt-xml-native",
    confidence: content ? 0.82 : 0.25,
    structure: { format: "odt" }
  };
}

function parseStructured(buffer: Buffer, extension: string): NativeParseResult {
  const raw = printableFallback(buffer);
  if (extension === ".json") {
    try {
      const data = JSON.parse(raw);
      return {
        text: cleanText(JSON.stringify(data, null, 2)),
        engine: "json-native",
        confidence: 0.95,
        structure: { format: "json" }
      };
    } catch {
      return { text: raw, engine: "json-raw-invalid", confidence: 0.45, structure: { format: "json" } };
    }
  }
  if (extension === ".xml") return { text: xmlText(raw), engine: "xml-native", confidence: 0.86, structure: { format: "xml" } };
  if (extension === ".html") return { text: cleanText(raw), engine: "html-native", confidence: 0.86, structure: { format: "html" } };
  if (extension === ".rtf") return { text: rtfText(raw), engine: "rtf-native", confidence: 0.72, structure: { format: "rtf" } };
  return { text: cleanText(raw), engine: "text-native", confidence: raw.length ? 0.86 : 0.2, structure: { format: extension.replace(".", "") || "unknown" } };
}

export async function extractNativeDocumentText(buffer: Buffer, filename: string): Promise<NativeParseResult> {
  const extension = path.extname(filename).toLowerCase();
  try {
    if (extension === ".pdf") return parsePdf(buffer);
    if (extension === ".docx") return parseDocx(buffer);
    if (extension === ".xlsx" || extension === ".xls") return parseSpreadsheet(buffer, extension);
    if (extension === ".csv" || extension === ".tsv") return parseStructured(buffer, extension);
    if (extension === ".pptx") return parsePptx(buffer);
    if (extension === ".odt") return parseOdt(buffer);
    if ([".txt", ".md", ".html", ".xml", ".json", ".rtf"].includes(extension)) return parseStructured(buffer, extension);
  } catch {
    const fallback = printableFallback(buffer);
    return {
      text: cleanText(fallback),
      engine: `${extension.replace(".", "") || "unknown"}-fallback`,
      confidence: fallback.length > 80 ? 0.42 : 0.18,
      structure: { format: extension.replace(".", "") || "unknown" }
    };
  }

  const fallback = printableFallback(buffer);
  const nameText = path.basename(filename, extension).replace(/[-_]+/g, " ");
  return {
    text: fallback.length > 80 ? cleanText(fallback).slice(0, 10000) : `Visual or legacy document ${nameText}. OCR and visual extraction should process this file.`,
    engine: "generic-native-fallback",
    confidence: fallback.length > 80 ? 0.35 : 0.15,
    structure: { format: extension.replace(".", "") || "unknown" }
  };
}
