import { listDocuments } from "@/lib/storage/db";
import { json } from "@/lib/http";

export async function GET() {
  const documents = await listDocuments();
  const latest = documents[0];
  const quality = latest?.analysis?.qualityScore ?? 80;
  const pages = latest?.pageCount ?? 20;
  return json({
    vendors: [
      {
        id: "campus-fastprint",
        name: "Campus FastPrint",
        strengths: ["notes", "spiral binding", "same-day pickup"],
        estimatedPrice: Math.max(30, pages * 1.2),
        etaHours: 6,
        recommended: pages < 120
      },
      {
        id: "premium-doc-studio",
        name: "Premium Doc Studio",
        strengths: ["resume", "certificate", "photo paper", "color calibration"],
        estimatedPrice: Math.max(120, pages * 4.5),
        etaHours: 24,
        recommended: quality > 85
      },
      {
        id: "archive-bindery",
        name: "Archive Bindery",
        strengths: ["thesis", "government archive", "hard binding", "lamination"],
        estimatedPrice: Math.max(350, pages * 3.2),
        etaHours: 48,
        recommended: pages >= 80
      }
    ]
  });
}
