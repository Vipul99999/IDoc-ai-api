import { DocumentRecord } from "@/lib/types";

function sentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
}

export function generateExecutiveSummary(document: DocumentRecord) {
  const text = document.ocr?.extractedText || document.analysis?.summary || "";
  const chosen = sentences(text).slice(0, 4);
  if (chosen.length === 0) return `${document.originalName} has been processed and is ready for review.`;
  return chosen.join(" ");
}

export function answerQuestion(document: DocumentRecord, question: string) {
  const text = document.ocr?.extractedText || document.analysis?.summary || "";
  const qTokens = new Set(question.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const ranked = sentences(text)
    .map((sentence) => ({
      sentence,
      score: (sentence.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => qTokens.has(token)).length
    }))
    .sort((a, b) => b.score - a.score);

  if (!ranked[0] || ranked[0].score === 0) {
    return "I could not find a direct answer in the extracted text. Re-run OCR or ask a more specific question.";
  }
  return ranked.slice(0, 3).map((item) => item.sentence).join(" ");
}

export function generateFlashcards(document: DocumentRecord) {
  const type = document.analysis?.documentType ?? "document";
  const summary = document.analysis?.summary ?? document.originalName;
  const recommendations = document.analysis?.recommendations ?? [];
  return [
    {
      front: `What type of document is this?`,
      back: `The platform classified it as ${type}.`
    },
    {
      front: `What is the main summary?`,
      back: summary
    },
    ...recommendations.slice(0, 4).map((recommendation) => ({
      front: `Why recommend ${recommendation.title}?`,
      back: recommendation.reason
    }))
  ];
}

export function generateStudyGuide(document: DocumentRecord) {
  const text = document.ocr?.extractedText || document.analysis?.summary || "";
  const chunks = sentences(text).slice(0, 8);
  return [
    `Overview: ${document.analysis?.summary ?? document.originalName}`,
    `Key Document Type: ${document.analysis?.documentType ?? "general"}`,
    `Quality Focus: score ${document.analysis?.qualityScore ?? "not available"} with ${(document.analysis?.issues ?? []).length} issue(s).`,
    `Important Points: ${chunks.length ? chunks.join(" ") : "OCR text is limited; scan quality should be improved before study extraction."}`,
    `Next Actions: review recommendations, re-run OCR if needed, and export a formatted copy.`
  ];
}
