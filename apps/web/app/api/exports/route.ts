import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  return json({
    exports: documents.flatMap((document) => [
      ...(document.ocr ? [{ documentId: document.id, type: "ocr_json", path: document.ocr.jsonPath }] : []),
      ...(document.ocr ? [{ documentId: document.id, type: "searchable_text_layer", path: document.ocr.searchablePdfPath }] : []),
      ...document.translations.map((translation) => ({ documentId: document.id, type: "translation", path: translation.outputPath })),
      ...document.reformats.map((reformat) => ({ documentId: document.id, type: `reformat_${reformat.format}`, path: reformat.outputPath })),
      ...document.compliance.redactions.map((redaction) => ({ documentId: document.id, type: "redacted_copy", path: redaction.outputPath }))
    ])
  });
}
