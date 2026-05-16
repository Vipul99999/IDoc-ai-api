import { v4 as uuidv4 } from "uuid";
import { DocumentRecord, ExtractedEntity } from "@/lib/types";

function entity(type: ExtractedEntity["type"], label: string, value: string, confidence = 0.82): ExtractedEntity {
  return { id: uuidv4(), type, label, value, confidence, source: "rule" };
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function captureField(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[|,;]+$/, "");
  }
  return null;
}

export function extractStructuredData(document: DocumentRecord) {
  const text = normalizeText(`${document.originalName}\n${document.ocr?.extractedText ?? ""}\n${document.analysis?.summary ?? ""}`);
  const entities: ExtractedEntity[] = [];
  const fields: Record<string, string> = {};

  for (const match of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) entities.push(entity("email", "Email", match[0], 0.94));
  for (const match of text.matchAll(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4}\b/g)) entities.push(entity("phone", "Phone", match[0], 0.78));
  for (const match of text.matchAll(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g)) entities.push(entity("date", "Date", match[0], 0.82));
  for (const match of text.matchAll(/(?:rs\.?|inr|usd|\$)\s?[\d,]+(?:\.\d{1,2})?/gi)) entities.push(entity("amount", "Amount", match[0], 0.86));

  const keyValues = extractKeyValues(text);
  Object.assign(fields, keyValues);

  const invoiceNumber = captureField(text, [
    /\b(?:invoice|bill)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
    /\binv\s*[:#-]\s*([A-Z0-9][A-Z0-9-]{3,})/i
  ]);
  if (invoiceNumber) {
    fields.invoiceNumber = invoiceNumber;
    entities.push(entity("invoice_number", "Invoice number", invoiceNumber, 0.9));
  }

  const purchaseOrder = captureField(text, [/\b(?:po|purchase order)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9-]{4,})/i]);
  if (purchaseOrder) fields.purchaseOrder = purchaseOrder;

  const invoiceDate = captureField(text, [/\b(?:invoice date|date)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i]);
  if (invoiceDate) fields.invoiceDate = invoiceDate;

  const dueDate = captureField(text, [/\b(?:due date|payment due)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i]);
  if (dueDate) fields.dueDate = dueDate;

  const subtotal = captureField(text, [/\bsubtotal\s*[:#-]?\s*((?:rs\.?|inr|usd|\$)?\s?[\d,]+(?:\.\d{1,2})?)/i]);
  if (subtotal) fields.subtotal = subtotal;

  const taxAmount = captureField(text, [/\b(?:tax|gst|vat)\s*[:#-]?\s*((?:rs\.?|inr|usd|\$)?\s?[\d,]+(?:\.\d{1,2})?)/i]);
  if (taxAmount) fields.taxAmount = taxAmount;

  const totalAmount = captureField(text, [
    /\b(?:grand total|total amount|amount due|balance due|total)\s*[:#-]?\s*((?:rs\.?|inr|usd|\$)?\s?[\d,]+(?:\.\d{1,2})?)/i
  ]);
  if (totalAmount) {
    fields.totalAmount = totalAmount;
    entities.push(entity("amount", "Total amount", totalAmount, 0.92));
  }

  const billTo = captureField(text, [/\b(?:bill to|billed to|customer)\s*[:#-]?\s*([A-Z][A-Za-z0-9 &.,'-]{3,80})/i]);
  if (billTo) fields.billTo = billTo;

  const issuer = captureField(text, [/\b(?:from|issuer|vendor|seller)\s*[:#-]?\s*([A-Z][A-Za-z0-9 &.,'-]{3,80})/i]);
  if (issuer) fields.issuer = issuer;

  const taxId = text.match(/\b(?:GSTIN|PAN|TIN|SSN|AADHAAR|AADHAR)[:\s-]*([A-Z0-9-]{6,20})\b/i)?.[1];
  if (taxId) {
    fields.taxId = taxId;
    entities.push(entity("tax_id", "Tax or identity ID", taxId, 0.84));
  }

  const skillHints = ["react", "next.js", "typescript", "python", "fastapi", "ocr", "machine learning", "postgresql", "docker", "kubernetes", "node.js", "java", "sql", "aws", "azure", "gcp"];
  const skills = skillHints.filter((skill) => text.toLowerCase().includes(skill));
  if (skills.length) {
    fields.skills = skills.join(", ");
    for (const skill of skills) entities.push(entity("skill", "Skill", skill, 0.72));
  }

  const parties = text.match(/\b(?:between|party|client|vendor|employer|company)\s+([A-Z][A-Za-z0-9 &.,-]{2,50})/g) ?? [];
  parties.slice(0, 4).forEach((party) => entities.push(entity("organization", "Party", party.replace(/^(between|party|client|vendor|employer|company)\s+/i, ""), 0.68)));

  const clauses = text.match(/\b(?:termination|confidentiality|liability|indemnity|payment terms|governing law|force majeure|non-compete|data protection|intellectual property)\b/gi) ?? [];
  clauses.slice(0, 8).forEach((clause) => entities.push(entity("clause", "Contract clause", clause, 0.74)));

  const tables = extractTables(text);
  const fieldBoost = Math.min(0.18, Object.keys(fields).length * 0.015);
  const tableBoost = Math.min(0.1, tables.length * 0.04);
  const entityConfidence = entities.length ? entities.reduce((sum, item) => sum + item.confidence, 0) / entities.length : 0.55;
  const confidence = Number(Math.min(0.97, entityConfidence + fieldBoost + tableBoost).toFixed(2));

  return {
    entities: dedupeEntities(entities).slice(0, 80),
    fields,
    tables,
    confidence,
    extractedAt: new Date().toISOString()
  };
}

function extractTables(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tableLines = lines.filter((line) => line.includes(",") || line.includes("\t") || line.includes("|") || /\s{2,}/.test(line)).slice(0, 40);
  if (tableLines.length < 2) return [];
  const separator = tableLines[0].includes("|") ? "|" : tableLines[0].includes("\t") ? "\t" : tableLines[0].includes(",") ? "," : /\s{2,}/;
  const rows = tableLines
    .map((line) => line.split(separator).map((cell) => cell.trim()).filter(Boolean))
    .filter((row) => row.length >= 2);
  if (rows.length < 2) return [];
  return [{ id: uuidv4(), headers: rows[0] ?? [], rows: rows.slice(1, 50) }];
}

function extractKeyValues(text: string) {
  const fields: Record<string, string> = {};
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.slice(0, 120)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 /_-]{2,35})\s*[:|]\s*(.{2,120})$/);
    if (!match) continue;
    const key = match[1]
      .trim()
      .replace(/[^A-Za-z0-9]+(.)/g, (_, character: string) => character.toUpperCase())
      .replace(/^[A-Z]/, (character) => character.toLowerCase());
    if (!fields[key]) fields[key] = match[2].trim();
  }
  return fields;
}

function dedupeEntities(entities: ExtractedEntity[]) {
  const seen = new Set<string>();
  return entities.filter((item) => {
    const key = `${item.type}:${item.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
