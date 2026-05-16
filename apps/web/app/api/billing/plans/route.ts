import { json } from "@/lib/http";

export async function GET() {
  return json({
    plans: [
      {
        id: "student",
        name: "Student",
        priceMonthlyUsd: 9,
        includedPages: 300,
        features: ["OCR", "quality checks", "print recommendations", "study guides"]
      },
      {
        id: "business",
        name: "Business",
        priceMonthlyUsd: 49,
        includedPages: 2500,
        features: ["team workspace", "API access", "semantic search", "billing reports"]
      },
      {
        id: "institution",
        name: "Institution",
        priceMonthlyUsd: 199,
        includedPages: 15000,
        features: ["SSO-ready", "retention controls", "audit exports", "white-label deployment"]
      }
    ]
  });
}
