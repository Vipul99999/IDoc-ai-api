import { DocumentType } from "@/lib/types";

const TYPE_HINTS: Array<{ type: DocumentType; hints: Array<[string, number]> }> = [
  { type: "resume", hints: [["resume", 4], ["curriculum vitae", 5], ["skills", 2], ["work experience", 3], ["education", 1.5], ["linkedin", 1.5], ["portfolio", 1]] },
  { type: "thesis", hints: [["thesis", 5], ["dissertation", 5], ["abstract", 2], ["chapter", 1.5], ["bibliography", 3], ["references", 1.5], ["supervisor", 2]] },
  { type: "notes", hints: [["notes", 3], ["lecture", 3], ["semester", 2], ["handwritten", 3], ["unit", 1], ["assignment", 1.5]] },
  { type: "invoice", hints: [["invoice", 5], ["gst", 3], ["subtotal", 3], ["tax", 2], ["amount due", 4], ["due date", 2.5], ["bill to", 3], ["ship to", 1.5], ["total", 1.5]] },
  { type: "certificate", hints: [["certificate", 5], ["awarded", 3], ["completion", 2], ["grade", 1.5], ["certifies", 3], ["achievement", 2]] },
  { type: "contract", hints: [["contract", 5], ["agreement", 4], ["clause", 3], ["party", 2], ["whereas", 4], ["termination", 2], ["confidentiality", 2], ["indemnity", 2]] },
  { type: "report", hints: [["report", 3], ["executive summary", 4], ["findings", 2], ["recommendations", 2], ["methodology", 1.5], ["appendix", 1]] },
  { type: "presentation", hints: [["presentation", 4], ["slide", 3], ["deck", 2], ["ppt", 3], ["agenda", 1.5], ["thank you", 1]] },
  { type: "government-record", hints: [["government", 4], ["citizen", 3], ["land record", 5], ["registry", 3], ["application", 1.5], ["passport", 4], ["aadhaar", 4], ["license", 2]] }
];

const FORMAT_BOOSTS: Array<{ pattern: RegExp; type: DocumentType; boost: number; hint: string }> = [
  { pattern: /\.(ppt|pptx)$/i, type: "presentation", boost: 3, hint: "presentation-file" },
  { pattern: /\.(xls|xlsx|csv|tsv)$/i, type: "invoice", boost: 1.2, hint: "tabular-financial-file" },
  { pattern: /resume|cv/i, type: "resume", boost: 3, hint: "filename-resume" },
  { pattern: /invoice|bill/i, type: "invoice", boost: 3.5, hint: "filename-invoice" },
  { pattern: /contract|agreement|nda/i, type: "contract", boost: 3.5, hint: "filename-contract" },
  { pattern: /certificate/i, type: "certificate", boost: 3.5, hint: "filename-certificate" },
  { pattern: /thesis|dissertation/i, type: "thesis", boost: 3.5, hint: "filename-thesis" }
];

function occurrences(haystack: string, needle: string) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return haystack.match(new RegExp(`\\b${escaped}\\b`, "gi"))?.length ?? 0;
}

export function classifyDocumentDetailed(text: string, filename: string) {
  const haystack = `${filename} ${text}`.toLowerCase();
  const scored = TYPE_HINTS.map(({ type, hints }) => {
    const matchedHints = hints.filter(([hint]) => occurrences(haystack, hint) > 0);
    const keywordScore = matchedHints.reduce((sum, [hint, weight]) => sum + Math.min(3, occurrences(haystack, hint)) * weight, 0);
    const formatBoosts = FORMAT_BOOSTS.filter((boost) => boost.type === type && boost.pattern.test(filename));
    const score = keywordScore + formatBoosts.reduce((sum, boost) => sum + boost.boost, 0);
    const formatHints = formatBoosts.map((boost) => boost.hint);
    return { type, score, matchedHints: [...matchedHints.map(([hint]) => hint), ...formatHints] };
  }).sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const runnerUp = scored[1]?.score ?? 0;
  if (!winner?.score) return { type: "general" as DocumentType, confidence: 0.45, matchedHints: [], score: 0 };
  const margin = winner.score - runnerUp;
  const confidence = Math.min(0.98, Math.max(0.55, 0.52 + winner.score / 18 + margin / 16));
  return {
    type: winner.type,
    confidence: Number(confidence.toFixed(2)),
    matchedHints: winner.matchedHints,
    score: Number(winner.score.toFixed(2))
  };
}

export function classifyDocument(text: string, filename: string): DocumentType {
  return classifyDocumentDetailed(text, filename).type;
}
