import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import { IMAGE_EXTENSIONS } from "@/lib/config";
import { writeOutput } from "@/lib/storage/fs";

export type RealOcrResult = {
  text: string;
  engine: string;
  confidence: number;
};

export async function extractWithRealOcr(buffer: Buffer, filename: string): Promise<RealOcrResult> {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const text = parsed.text?.trim() ?? "";
      if (text.length > 20) return { text, engine: "pdf-parse", confidence: 0.94 };
      const aiServiceResult = await extractWithAiService(buffer, filename).catch(() => null);
      if (aiServiceResult?.text) return aiServiceResult;
      return { text: "", engine: "pdf-parse-empty-scan-needs-rendering", confidence: 0.2 };
    } finally {
      await parser.destroy();
    }
  }

  if (IMAGE_EXTENSIONS.includes(extension)) {
    const aiServiceResult = await extractWithAiService(buffer, filename).catch(() => null);
    if (aiServiceResult?.text && aiServiceResult.confidence >= 0.5) return aiServiceResult;

    const worker = await createWorker("eng");
    try {
      const result = await worker.recognize(buffer);
      return {
        text: result.data.text.trim(),
        engine: "tesseract.js",
        confidence: Number(((result.data.confidence ?? 0) / 100).toFixed(2))
      };
    } finally {
      await worker.terminate();
    }
  }

  return { text: buffer.toString("utf8").replace(/\s+/g, " ").trim(), engine: "text-extraction", confidence: 0.9 };
}

async function extractWithAiService(buffer: Buffer, filename: string): Promise<RealOcrResult | null> {
  if (!process.env.AI_SERVICES_URL) return null;
  const response = await fetch(`${process.env.AI_SERVICES_URL.replace(/\/$/, "")}/ocr`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename,
      content_base64: buffer.toString("base64"),
      engine: "auto"
    })
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { text?: string; engine?: string; confidence?: number };
  const text = payload.text?.trim() ?? "";
  if (!text) return null;
  return {
    text,
    engine: payload.engine ? `ai-services:${payload.engine}` : "ai-services",
    confidence: Number(Math.max(0, Math.min(1, payload.confidence ?? 0)).toFixed(2))
  };
}

export async function createSearchablePdf(documentId: string, originalName: string, text: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText(`Searchable text layer for ${originalName}`, {
    x: 48,
    y: 740,
    size: 13,
    font,
    color: rgb(0.1, 0.13, 0.11)
  });

  const lines = wrapText(text || "No OCR text was extracted.", 88).slice(0, 48);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 48,
      y: 710 - index * 13,
      size: 9,
      font,
      color: rgb(0.03, 0.03, 0.03)
    });
  });

  const bytes = await pdf.save();
  return writeOutput(documentId, "searchable-output.pdf", Buffer.from(bytes));
}

function wrapText(text: string, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}
