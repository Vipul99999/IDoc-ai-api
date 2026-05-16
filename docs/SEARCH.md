# Search Architecture

## Local Search Engine

The runnable product uses a local search engine in `apps/web/lib/search-engine.ts`.

Capabilities:

- Tokenization and stop-word removal.
- Synonym expansion for real document vocabulary.
- BM25-style lexical ranking.
- Field boosts for title, tags, summary, metadata, and OCR text.
- Phrase boosts.
- Fuzzy token matching for small typos.
- Semantic reranking using local hash-vector embeddings.
- Freshness score.
- Facets for document type, language, category, quality, compliance, and tags.
- Suggestions.
- Similar-document discovery.

## Production OpenSearch/Elasticsearch Path

For larger deployments, run OpenSearch:

```powershell
docker compose --profile search up -d opensearch opensearch-dashboards
```

Create the index using:

```powershell
Invoke-RestMethod -Method Put -Uri http://localhost:9200/intellidoc-documents -Body (Get-Content infrastructure/docker/opensearch-index.json -Raw) -ContentType application/json
```

Set:

```text
OPENSEARCH_URL=http://localhost:9200
OPENSEARCH_INDEX=intellidoc-documents
```

The adapter in `apps/web/lib/opensearch-adapter.ts` builds an OpenSearch `multi_match` query with fuzziness, filters, highlighting, and aggregations.

## Search Analytics and Product Value

The database schema includes:

- `search_queries` for observability, quality tuning, no-result tracking, and billing analytics.
- `saved_searches` for enterprise monitoring, legal discovery, contract alerts, and archive workflows.

Recommended next production ranking upgrades:

- Store real sentence-transformer vectors in pgvector or OpenSearch k-NN.
- Add click-through feedback for learning-to-rank.
- Add tenant-specific synonyms for universities, courts, hospitals, and print shops.
- Add OCR confidence-aware ranking so low-confidence matches rank lower.

## Real-World Search Features Still Available Through API

- `GET /api/search?q=...`
- `GET /api/search/advanced?q=...`
- `POST /api/search/advanced`
- `GET /api/search/facets`
- `GET /api/search/suggest?q=...`
- `GET /api/search/similar?documentId=...`
