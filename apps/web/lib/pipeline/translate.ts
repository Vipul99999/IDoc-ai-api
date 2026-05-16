import { v4 as uuidv4 } from "uuid";
import { DocumentRecord } from "@/lib/types";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  ur: "Urdu",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  multi: "Multilingual"
};

const DICTIONARIES: Record<string, Record<string, string>> = {
  hi: {
    document: "दस्तावेज",
    invoice: "चालान",
    thesis: "शोध पत्र",
    resume: "जीवनवृत्त",
    contract: "अनुबंध",
    report: "रिपोर्ट",
    certificate: "प्रमाणपत्र",
    quality: "गुणवत्ता",
    search: "खोज",
    page: "पृष्ठ",
    total: "कुल",
    amount: "राशि",
    date: "तारीख",
    customer: "ग्राहक",
    summary: "सारांश",
    recommendation: "सिफारिश",
    agreement: "समझौता",
    university: "विश्वविद्यालय"
  },
  bn: {
    document: "নথি",
    invoice: "চালান",
    resume: "জীবনবৃত্তান্ত",
    contract: "চুক্তি",
    report: "প্রতিবেদন",
    certificate: "সনদ",
    quality: "গুণমান",
    page: "পৃষ্ঠা",
    total: "মোট",
    amount: "পরিমাণ",
    date: "তারিখ",
    customer: "গ্রাহক"
  },
  ta: {
    document: "ஆவணம்",
    invoice: "விலைப்பட்டியல்",
    resume: "சுயவிவரம்",
    contract: "ஒப்பந்தம்",
    report: "அறிக்கை",
    certificate: "சான்றிதழ்",
    quality: "தரம்",
    page: "பக்கம்",
    total: "மொத்தம்",
    amount: "தொகை",
    date: "தேதி"
  },
  te: {
    document: "పత్రం",
    invoice: "ఇన్వాయిస్",
    resume: "జీవిత చరిత్ర",
    contract: "ఒప్పందం",
    report: "నివేదిక",
    certificate: "సర్టిఫికేట్",
    quality: "నాణ్యత",
    page: "పేజీ",
    total: "మొత్తం",
    amount: "మొత్తం",
    date: "తేదీ"
  },
  ur: {
    document: "دستاویز",
    invoice: "انوائس",
    resume: "رزومے",
    contract: "معاہدہ",
    report: "رپورٹ",
    certificate: "سرٹیفکیٹ",
    quality: "معیار",
    page: "صفحہ",
    total: "کل",
    amount: "رقم",
    date: "تاریخ"
  }
};

export type TranslationRequest = {
  targetLanguage: string;
  sourceLanguage?: string;
  glossary?: Record<string, string>;
  preserveLayout?: boolean;
};

export type AdvancedTranslationResult = {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  engine: string;
  qualityScore: number;
  warnings: string[];
  chunks: Array<{
    id: string;
    source: string;
    translated: string;
    kind: "heading" | "paragraph" | "table" | "list" | "key-value" | "blank";
  }>;
  protectedTerms: Array<{ token: string; value: string; type: string }>;
};

function normalizeText(text: string) {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function classifyChunk(line: string): AdvancedTranslationResult["chunks"][number]["kind"] {
  if (!line.trim()) return "blank";
  if (/^\s*[-*•]|\d+[.)]\s+/.test(line)) return "list";
  if (line.includes("|") || line.includes("\t") || line.includes(",")) return "table";
  if (/^[A-Za-z][A-Za-z0-9 /_-]{2,35}\s*[:|]\s*.{2,}/.test(line)) return "key-value";
  if (line.length < 80 && /^[A-Z0-9][A-Z0-9\s:,-]{4,}$/.test(line)) return "heading";
  return "paragraph";
}

function chunkText(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const lines = normalized.split(/\n/);
  const chunks: Array<{ source: string; kind: AdvancedTranslationResult["chunks"][number]["kind"] }> = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    chunks.push({ source: paragraph.join(" "), kind: "paragraph" });
    paragraph = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const kind = classifyChunk(trimmed);
    if (kind === "paragraph" && trimmed.length < 600) {
      paragraph.push(trimmed);
      continue;
    }
    flushParagraph();
    chunks.push({ source: trimmed, kind });
  }
  flushParagraph();
  return chunks.filter((chunk) => chunk.source);
}

function protectTerms(text: string) {
  const protectedTerms: AdvancedTranslationResult["protectedTerms"] = [];
  let protectedText = text;
  const patterns: Array<[string, RegExp]> = [
    ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
    ["url", /\bhttps?:\/\/[^\s]+/gi],
    ["amount", /(?:rs\.?|inr|usd|\$)\s?[\d,]+(?:\.\d{1,2})?/gi],
    ["date", /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g],
    ["identifier", /\b[A-Z]{2,}[A-Z0-9-]{4,}\b/g]
  ];

  for (const [type, pattern] of patterns) {
    protectedText = protectedText.replace(pattern, (value) => {
      const token = `__TERM_${protectedTerms.length}__`;
      protectedTerms.push({ token, value, type });
      return token;
    });
  }
  return { protectedText, protectedTerms };
}

function restoreTerms(text: string, protectedTerms: AdvancedTranslationResult["protectedTerms"]) {
  return protectedTerms.reduce((current, term) => current.replaceAll(term.token, term.value), text);
}

function applyDictionary(text: string, targetLanguage: string, glossary: Record<string, string>) {
  const dictionary = { ...(DICTIONARIES[targetLanguage] ?? {}), ...glossary };
  return text.replace(/\b[A-Za-z][A-Za-z-]{1,}\b/g, (word) => {
    const replacement = dictionary[word.toLowerCase()];
    if (!replacement) return word;
    return /^[A-Z]/.test(word) ? replacement : replacement;
  });
}

async function translateWithLibreTranslate(text: string, sourceLanguage: string, targetLanguage: string) {
  if (!process.env.LIBRETRANSLATE_URL) return null;
  const response = await fetch(`${process.env.LIBRETRANSLATE_URL.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: sourceLanguage === "multi" ? "auto" : sourceLanguage,
      target: targetLanguage,
      format: "text",
      api_key: process.env.LIBRETRANSLATE_API_KEY
    })
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { translatedText?: string };
  return payload.translatedText ?? null;
}

async function translateWithAiService(text: string, sourceLanguage: string, targetLanguage: string, glossary: Record<string, string>) {
  if (!process.env.AI_SERVICES_URL) return null;
  const response = await fetch(`${process.env.AI_SERVICES_URL.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, source_language: sourceLanguage, target_language: targetLanguage, glossary })
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { translated_text?: string; engine?: string };
  if (!payload.translated_text) return null;
  return { translatedText: payload.translated_text, engine: payload.engine ?? "ai-services" };
}

function qualityScore(source: string, translated: string, protectedTerms: AdvancedTranslationResult["protectedTerms"], engine: string) {
  const warnings: string[] = [];
  const sourceLength = Math.max(source.length, 1);
  const ratio = translated.length / sourceLength;
  if (ratio < 0.35) warnings.push("Translation is much shorter than the source.");
  if (ratio > 2.8) warnings.push("Translation is much longer than the source.");
  const missingTerms = protectedTerms.filter((term) => !translated.includes(term.value));
  if (missingTerms.length) warnings.push(`${missingTerms.length} protected terms were not preserved.`);
  const engineBase = engine.includes("libretranslate") || engine.includes("ai-services") ? 92 : 72;
  const score = Math.max(30, Math.min(98, engineBase - warnings.length * 12 - Math.abs(1 - Math.min(ratio, 2)) * 8));
  return { score: Math.round(score), warnings };
}

export async function translateDocumentAdvanced(document: DocumentRecord, request: TranslationRequest): Promise<AdvancedTranslationResult> {
  const sourceLanguage = request.sourceLanguage ?? document.analysis?.language ?? "en";
  const sourceText = document.ocr?.extractedText || document.analysis?.summary || "";
  const targetLanguage = request.targetLanguage;
  const glossary = request.glossary ?? {};
  const { protectedText, protectedTerms } = protectTerms(sourceText);
  const chunks = chunkText(protectedText);
  let engine = "local-glossary-layout-v2";

  const translatedChunks = [];
  for (const chunk of chunks) {
    const aiResult = await translateWithAiService(chunk.source, sourceLanguage, targetLanguage, glossary).catch(() => null);
    let translated: string | null = aiResult?.translatedText ?? null;
    if (aiResult?.engine) engine = aiResult.engine;
    if (!translated) {
      translated = await translateWithLibreTranslate(chunk.source, sourceLanguage, targetLanguage).catch(() => null);
      if (translated) engine = "libretranslate";
    }
    if (!translated) translated = targetLanguage === sourceLanguage ? chunk.source : applyDictionary(chunk.source, targetLanguage, glossary);
    translatedChunks.push({
      id: uuidv4(),
      source: restoreTerms(chunk.source, protectedTerms),
      translated: restoreTerms(translated, protectedTerms),
      kind: chunk.kind
    });
  }

  const translatedText = translatedChunks.map((chunk) => chunk.translated).join(request.preserveLayout === false ? "\n" : "\n\n");
  const quality = qualityScore(sourceText, translatedText, protectedTerms, engine);
  return {
    id: uuidv4(),
    sourceLanguage,
    targetLanguage,
    translatedText,
    engine,
    qualityScore: quality.score,
    warnings: quality.warnings,
    chunks: translatedChunks,
    protectedTerms
  };
}

export function translateText(text: string, targetLanguage: string) {
  if (targetLanguage === "en") return text;
  return applyDictionary(text, targetLanguage, {});
}

export function languageName(language: string) {
  return LANGUAGE_NAMES[language] ?? language.toUpperCase();
}
