import { ComplianceFinding } from "@/lib/types";

const detectors: Array<{
  type: ComplianceFinding["type"];
  label: string;
  severity: ComplianceFinding["severity"];
  regex: RegExp;
  recommendation: string;
}> = [
  {
    type: "email",
    label: "Email address",
    severity: "medium",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    recommendation: "Mask email addresses before sharing with print vendors or external reviewers."
  },
  {
    type: "phone",
    label: "Phone number",
    severity: "medium",
    regex: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4}\b/g,
    recommendation: "Confirm whether phone numbers are necessary in downstream exports."
  },
  {
    type: "payment_card",
    label: "Payment card-like number",
    severity: "critical",
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    recommendation: "Redact payment card data and avoid storing it in OCR/search indexes."
  },
  {
    type: "tax_id",
    label: "Tax or government ID",
    severity: "high",
    regex: /\b(?:PAN|GSTIN|SSN|TIN|AADHAAR|AADHAR)[:\s-]*[A-Z0-9-]{6,20}\b/gi,
    recommendation: "Apply restricted access and redact identifiers in shared copies."
  },
  {
    type: "passport",
    label: "Passport reference",
    severity: "high",
    regex: /\bpassport(?:\s+no\.?|\s+number|)[:\s-]*[A-Z0-9]{6,12}\b/gi,
    recommendation: "Treat identity documents as sensitive and require explicit retention consent."
  },
  {
    type: "health",
    label: "Health information",
    severity: "critical",
    regex: /\b(patient|diagnosis|prescription|medical record|blood group|lab result)\b/gi,
    recommendation: "Route through healthcare privacy workflow and limit access."
  },
  {
    type: "confidential",
    label: "Confidential marker",
    severity: "high",
    regex: /\b(confidential|restricted|internal use only|privileged|do not distribute)\b/gi,
    recommendation: "Disable public sharing and require approval before export."
  }
];

export function detectComplianceFindings(text: string): ComplianceFinding[] {
  return detectors.flatMap((detector) => {
    const matches = Array.from(text.matchAll(detector.regex)).map((match) => match[0]);
    if (matches.length === 0) return [];
    return [
      {
        id: `${detector.type}-${matches.length}`,
        type: detector.type,
        severity: detector.severity,
        label: detector.label,
        sample: maskSensitive(matches[0]),
        count: matches.length,
        recommendation: detector.recommendation
      }
    ];
  });
}

export function complianceRiskScore(findings: ComplianceFinding[]) {
  const weights = { low: 8, medium: 18, high: 31, critical: 45 };
  return Math.min(100, findings.reduce((sum, finding) => sum + weights[finding.severity], 0));
}

export function policyTags(findings: ComplianceFinding[]) {
  const tags = new Set<string>();
  if (findings.some((finding) => finding.type === "health")) tags.add("health-privacy");
  if (findings.some((finding) => ["passport", "tax_id"].includes(finding.type))) tags.add("identity-data");
  if (findings.some((finding) => finding.type === "payment_card")) tags.add("pci-review");
  if (findings.some((finding) => finding.type === "confidential")) tags.add("restricted-sharing");
  if (findings.length === 0) tags.add("standard-retention");
  return Array.from(tags);
}

export function redactText(text: string, selectedTypes?: string[]) {
  return detectors.reduce((current, detector) => {
    if (selectedTypes && !selectedTypes.includes(detector.type)) return current;
    return current.replace(detector.regex, `[REDACTED:${detector.type.toUpperCase()}]`);
  }, text);
}

function maskSensitive(value: string) {
  if (value.length <= 6) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
