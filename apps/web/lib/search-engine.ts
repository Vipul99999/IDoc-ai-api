import { createEmbedding, cosineSimilarity } from "@/lib/pipeline/embedding";
import { listDocuments } from "@/lib/storage/db";
import { DocumentRecord, DocumentType, SearchHit } from "@/lib/types";

type IndexedDocument = {
  record: DocumentRecord;
  fields: Record<string, string>;
  tokens: string[];
  tokenCounts: Map<string, number>;
  length: number;
};

export type AdvancedSearchOptions = {
  query: string;
  documentType?: string;
  language?: string;
  category?: string;
  minQuality?: number;
  maxComplianceRisk?: number;
  hasSensitiveData?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with"
]);

const SYNONYMS: Record<string, string[]> = {
  resume: ["cv", "curriculum", "profile"],
  invoice: ["bill", "receipt", "gst"],
  contract: ["agreement", "clause", "legal"],
  thesis: ["dissertation", "research", "abstract"],
  notes: ["lecture", "study", "class"],
  certificate: ["award", "completion", "credential"],
  passport: ["identity", "travel", "id"]
};

function tokenize(text: string) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .flatMap((token) => [token, ...(SYNONYMS[token] ?? [])]);
}

function countTokens(tokens: string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function indexDocument(record: DocumentRecord): IndexedDocument {
  const fields = {
    title: record.originalName,
    tags: record.tags.join(" "),
    summary: record.analysis?.summary ?? "",
    text: record.ocr?.extractedText ?? "",
    metadata: [
      record.analysis?.documentType,
      record.analysis?.language,
      record.metadata.detectedCategory,
      ...(record.compliance?.policyTags ?? []),
      ...(record.analysis?.recommendations.map((recommendation) => recommendation.title) ?? [])
    ].join(" ")
  };
  const weighted = [
    fields.title.repeat(4),
    fields.tags.repeat(3),
    fields.summary.repeat(2),
    fields.metadata.repeat(2),
    fields.text
  ].join(" ");
  const tokens = tokenize(weighted);
  return { record, fields, tokens, tokenCounts: countTokens(tokens), length: Math.max(1, tokens.length) };
}

function filterDocuments(indexed: IndexedDocument[], options: AdvancedSearchOptions) {
  return indexed.filter(({ record }) => {
    if (options.documentType && record.analysis?.documentType !== options.documentType) return false;
    if (options.language && record.analysis?.language !== options.language) return false;
    if (options.category && record.metadata.detectedCategory !== options.category) return false;
    if (options.minQuality && (record.analysis?.qualityScore ?? 0) < options.minQuality) return false;
    if (options.maxComplianceRisk !== undefined && (record.compliance?.riskScore ?? 0) > options.maxComplianceRisk) return false;
    if (options.hasSensitiveData !== undefined && ((record.compliance?.findings.length ?? 0) > 0) !== options.hasSensitiveData) return false;
    if (options.dateFrom && record.createdAt < options.dateFrom) return false;
    if (options.dateTo && record.createdAt > options.dateTo) return false;
    return true;
  });
}

function bm25Score(doc: IndexedDocument, queryTokens: string[], allDocs: IndexedDocument[], avgLength: number) {
  const k1 = 1.4;
  const b = 0.75;
  let score = 0;
  for (const token of queryTokens) {
    const tf = doc.tokenCounts.get(token) ?? 0;
    const fuzzyTf = tf || fuzzyTokenFrequency(doc.tokenCounts, token);
    if (!fuzzyTf) continue;
    const docsWithTerm = allDocs.filter((candidate) => candidate.tokenCounts.has(token) || fuzzyTokenFrequency(candidate.tokenCounts, token)).length;
    const idf = Math.log(1 + (allDocs.length - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
    score += idf * ((fuzzyTf * (k1 + 1)) / (fuzzyTf + k1 * (1 - b + b * (doc.length / avgLength))));
  }
  return score;
}

function fuzzyTokenFrequency(counts: Map<string, number>, token: string) {
  for (const [candidate, count] of counts.entries()) {
    if (candidate[0] === token[0] && Math.abs(candidate.length - token.length) <= 2 && editDistance(candidate, token) <= 1) return count * 0.55;
  }
  return 0;
}

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function phraseScore(fields: Record<string, string>, query: string) {
  if (!query.trim()) return 0;
  const phrase = query.toLowerCase();
  return Object.entries(fields).reduce((score, [field, value]) => {
    if (!value.toLowerCase().includes(phrase)) return score;
    return score + (field === "title" ? 3 : field === "summary" ? 2 : 1);
  }, 0);
}

function matchedFields(fields: Record<string, string>, queryTokens: string[]) {
  return Object.entries(fields)
    .filter(([, value]) => {
      const tokens = new Set(tokenize(value));
      return queryTokens.some((token) => tokens.has(token));
    })
    .map(([field]) => field);
}

function freshnessScore(createdAt: string) {
  const ageDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return Math.max(0, 1 - ageDays / 365);
}

function snippet(fields: Record<string, string>, queryTokens: string[]) {
  const haystack = `${fields.summary} ${fields.text} ${fields.metadata}`.replace(/\s+/g, " ").trim();
  const lower = haystack.toLowerCase();
  const firstHit = queryTokens.map((token) => lower.indexOf(token)).filter((idx) => idx >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, firstHit - 80);
  return haystack.slice(start, start + 240) || fields.title;
}

export async function advancedSearch(options: AdvancedSearchOptions): Promise<{ hits: SearchHit[]; facets: SearchFacets; total: number }> {
  const query = options.query.trim();
  if (!query) return { hits: [], facets: await searchFacets(), total: 0 };
  const documents = await listDocuments();
  const indexed = documents.map(indexDocument);
  const filtered = filterDocuments(indexed, options);
  const queryTokens = tokenize(query);
  const qVector = createEmbedding(query);
  const avgLength = filtered.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, filtered.length);
  const raw = filtered.map((doc) => {
    const bm25 = bm25Score(doc, queryTokens, filtered, avgLength);
    const semantic = doc.record.embedding ? cosineSimilarity(qVector, doc.record.embedding.vector) : 0;
    const phrase = phraseScore(doc.fields, query);
    const freshness = freshnessScore(doc.record.createdAt);
    const score = bm25 * 58 + semantic * 26 + phrase * 9 + freshness * 7;
    const documentType: DocumentType | "unknown" = doc.record.analysis?.documentType ?? "unknown";
    return {
      id: doc.record.id,
      filename: doc.record.originalName,
      documentType,
      score: Number(score.toFixed(1)),
      snippet: snippet(doc.fields, queryTokens),
      tags: doc.record.tags,
      language: doc.record.analysis?.language,
      qualityScore: doc.record.analysis?.qualityScore,
      complianceRisk: doc.record.compliance?.riskScore ?? 0,
      matchedFields: matchedFields(doc.fields, queryTokens),
      rankSignals: {
        bm25: Number(bm25.toFixed(3)),
        semantic: Number(semantic.toFixed(3)),
        phrase: Number(phrase.toFixed(3)),
        freshness: Number(freshness.toFixed(3))
      }
    };
  });

  const hits = raw
    .filter((hit) => hit.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 20);
  return { hits, facets: buildFacets(filtered), total: raw.length };
}

export type SearchFacets = {
  documentTypes: Record<string, number>;
  languages: Record<string, number>;
  categories: Record<string, number>;
  qualityBands: Record<string, number>;
  complianceBands: Record<string, number>;
  tags: Record<string, number>;
};

export async function searchFacets() {
  return buildFacets((await listDocuments()).map(indexDocument));
}

function buildFacets(indexed: IndexedDocument[]): SearchFacets {
  const facets: SearchFacets = {
    documentTypes: {},
    languages: {},
    categories: {},
    qualityBands: {},
    complianceBands: {},
    tags: {}
  };
  for (const { record } of indexed) {
    increment(facets.documentTypes, record.analysis?.documentType ?? "unknown");
    increment(facets.languages, record.analysis?.language ?? "unknown");
    increment(facets.categories, record.metadata.detectedCategory ?? "unknown");
    increment(facets.qualityBands, qualityBand(record.analysis?.qualityScore ?? 0));
    increment(facets.complianceBands, complianceBand(record.compliance?.riskScore ?? 0));
    for (const tag of record.tags) increment(facets.tags, tag);
  }
  return facets;
}

function increment(bucket: Record<string, number>, key: string) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function qualityBand(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "needs-review";
  return "poor";
}

function complianceBand(score: number) {
  if (score >= 70) return "high-risk";
  if (score >= 35) return "review";
  return "standard";
}

export async function searchSuggestions(prefix: string) {
  const q = prefix.trim().toLowerCase();
  if (!q) return [];
  const docs = await listDocuments();
  const candidates = new Map<string, number>();
  for (const doc of docs) {
    for (const value of [
      doc.originalName,
      doc.analysis?.documentType ?? "",
      doc.analysis?.language ?? "",
      ...doc.tags,
      ...(doc.compliance?.policyTags ?? []),
      ...(doc.ocr?.extractedText.split(/\s+/).slice(0, 120) ?? [])
    ]) {
      for (const token of tokenize(value)) {
        if (token.startsWith(q) || editDistance(token, q) <= 1) candidates.set(token, (candidates.get(token) ?? 0) + 1);
      }
    }
  }
  return [...candidates.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([suggestion, count]) => ({ suggestion, count }));
}

export async function similarDocuments(documentId: string, limit = 10) {
  const docs = await listDocuments();
  const source = docs.find((doc) => doc.id === documentId);
  if (!source?.embedding) return [];
  return docs
    .filter((doc) => doc.id !== documentId && doc.embedding)
    .map((doc) => ({
      id: doc.id,
      filename: doc.originalName,
      documentType: doc.analysis?.documentType ?? "unknown",
      similarity: Number((cosineSimilarity(source.embedding!.vector, doc.embedding!.vector) * 100).toFixed(1)),
      sameChecksum: source.metadata.checksum === doc.metadata.checksum
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
