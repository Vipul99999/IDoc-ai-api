import { v4 as uuidv4 } from "uuid";
import { DocumentRecord } from "@/lib/types";

export type PrintQuote = {
  id: string;
  documentId: string;
  vendorId: string;
  vendorName: string;
  paper: string;
  binding: string;
  colorMode: "bw" | "color";
  copies: number;
  subtotal: number;
  serviceFee: number;
  total: number;
  etaHours: number;
  createdAt: string;
};

export function buildPrintQuote(document: DocumentRecord, vendorId = "campus-fastprint", copies = 1): PrintQuote {
  const isPremium = document.metadata.budget === "premium" || document.analysis?.documentType === "certificate";
  const colorMode = document.metadata.colorPercentage > 20 ? "color" : "bw";
  const pageRate = colorMode === "color" ? 5 : 1.5;
  const binding = document.pageCount > 80 ? "hard-binding" : document.analysis?.documentType === "notes" ? "spiral" : "stapled";
  const bindingCost = binding === "hard-binding" ? 320 : binding === "spiral" ? 70 : 15;
  const paper = isPremium ? "100 GSM premium matte" : "75 GSM standard";
  const subtotal = Math.round((document.pageCount * pageRate + bindingCost) * copies);
  const serviceFee = Math.max(12, Math.round(subtotal * 0.08));
  const vendorName =
    vendorId === "archive-bindery" ? "Archive Bindery" : vendorId === "premium-doc-studio" ? "Premium Doc Studio" : "Campus FastPrint";

  return {
    id: uuidv4(),
    documentId: document.id,
    vendorId,
    vendorName,
    paper,
    binding,
    colorMode,
    copies,
    subtotal,
    serviceFee,
    total: subtotal + serviceFee,
    etaHours: vendorId === "archive-bindery" ? 48 : vendorId === "premium-doc-studio" ? 24 : 6,
    createdAt: new Date().toISOString()
  };
}
