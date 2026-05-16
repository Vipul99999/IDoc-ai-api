import path from "node:path";
import { extractNativeDocumentText } from "@/lib/pipeline/native-parse";

const LANGUAGE_HINTS: Record<string, string[]> = {
  hi: ["hai", "namaste", "vidyalaya", "bharat", "hindi", "shiksha", "adhyayan"],
  ur: ["urdu", "pakistan", "karachi", "islamabad"],
  bn: ["bangla", "bengali", "kolkata", "dhaka"],
  ta: ["tamil", "chennai", "madurai"],
  te: ["telugu", "hyderabad", "andhra", "telangana"],
  en: ["the", "and", "invoice", "agreement", "resume", "report"]
};

const SCRIPT_RANGES: Record<string, RegExp> = {
  hi: /[\u0900-\u097F]/g,
  ur: /[\u0600-\u06FF]/g,
  bn: /[\u0980-\u09FF]/g,
  ta: /[\u0B80-\u0BFF]/g,
  te: /[\u0C00-\u0C7F]/g
};

export function extractReadableText(buffer: Buffer, filename: string) {
  const extension = path.extname(filename).toLowerCase();
  const raw = buffer.toString("utf8");
  const printable = raw
    .replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (extension === ".pdf") {
    const objects = raw.match(/\(([^)]{3,})\)/g)?.map((value) => value.slice(1, -1)) ?? [];
    const joined = objects.join(" ").replace(/\s+/g, " ").trim();
    return joined.length > 40 ? joined : printable.slice(0, 6000);
  }

  if (extension === ".docx") {
    return printable
      .replace(/word\/document\.xml/g, " ")
      .replace(/<[^>]+>/g, " ")
      .slice(0, 6000)
      .trim();
  }

  if (extension === ".txt") {
    return printable;
  }

  const nameText = path.basename(filename, extension).replace(/[-_]+/g, " ");
  return printable.length > 80
    ? printable.slice(0, 3000)
    : `Image document ${nameText}. OCR engine should process visual text and handwriting from this file.`;
}

export async function extractReadableTextAdvanced(buffer: Buffer, filename: string) {
  return extractNativeDocumentText(buffer, filename);
}

export function detectLanguage(text: string) {
  const lower = text.toLowerCase();
  const scriptScores = Object.entries(SCRIPT_RANGES)
    .map(([language, pattern]) => ({ language, score: text.match(pattern)?.length ?? 0 }))
    .sort((a, b) => b.score - a.score);
  if ((scriptScores[0]?.score ?? 0) > 8) {
    const second = scriptScores[1]?.score ?? 0;
    return second > 8 && second > (scriptScores[0]?.score ?? 0) * 0.35 ? "multi" : scriptScores[0].language;
  }

  const hintScores = Object.entries(LANGUAGE_HINTS)
    .map(([language, hints]) => ({
      language,
      score: hints.reduce((total, hint) => total + (new RegExp(`\\b${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);
  if ((hintScores[0]?.score ?? 0) >= 2 && hintScores[0].language !== "en") return hintScores[0].language;

  for (const [language, hints] of Object.entries(LANGUAGE_HINTS)) {
    if (language !== "en" && hints.some((hint) => lower.includes(hint))) return language;
  }
  if (/[^\u0000-\u007f]/.test(text)) return "multi";
  return "en";
}

export function summarizeText(text: string, filename: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return `${filename} is stored and ready for OCR processing.`;
  const firstSentence = cleaned.split(/[.!?]/).find((part) => part.trim().length > 40);
  return (firstSentence ?? cleaned).slice(0, 220);
}

export function createSnippet(text: string, query: string) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 180);
  const start = Math.max(0, idx - 70);
  return text.slice(start, start + 220).trim();
}
