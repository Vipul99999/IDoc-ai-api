import { AdvancedSearchOptions } from "@/lib/search-engine";

export function isOpenSearchEnabled() {
  return Boolean(process.env.OPENSEARCH_URL);
}

export function buildOpenSearchQuery(options: AdvancedSearchOptions) {
  const filters = [];
  if (options.documentType) filters.push({ term: { "documentType.keyword": options.documentType } });
  if (options.language) filters.push({ term: { "language.keyword": options.language } });
  if (options.category) filters.push({ term: { "category.keyword": options.category } });
  if (options.minQuality) filters.push({ range: { qualityScore: { gte: options.minQuality } } });
  if (options.maxComplianceRisk !== undefined) filters.push({ range: { complianceRisk: { lte: options.maxComplianceRisk } } });

  return {
    size: options.limit ?? 20,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: options.query,
              fields: ["title^4", "tags^3", "summary^2", "metadata^2", "text"],
              fuzziness: "AUTO",
              type: "best_fields"
            }
          }
        ],
        filter: filters
      }
    },
    highlight: {
      fields: {
        summary: {},
        text: {}
      }
    },
    aggs: {
      documentTypes: { terms: { field: "documentType.keyword" } },
      languages: { terms: { field: "language.keyword" } },
      categories: { terms: { field: "category.keyword" } },
      tags: { terms: { field: "tags.keyword" } }
    }
  };
}

export async function searchWithOpenSearch(options: AdvancedSearchOptions) {
  if (!process.env.OPENSEARCH_URL) throw new Error("OPENSEARCH_URL is not configured.");
  const url = `${process.env.OPENSEARCH_URL.replace(/\/$/, "")}/${process.env.OPENSEARCH_INDEX ?? "intellidoc-documents"}/_search`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OPENSEARCH_BASIC_AUTH ? { Authorization: `Basic ${process.env.OPENSEARCH_BASIC_AUTH}` } : {})
    },
    body: JSON.stringify(buildOpenSearchQuery(options))
  });
  if (!response.ok) throw new Error(`OpenSearch query failed: ${response.status}`);
  return response.json();
}
