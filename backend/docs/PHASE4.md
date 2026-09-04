# Phase 4A — Vector Retrieval (no reranking yet)

Phase 4A adds the first retrieval layer on top of Phase 3's embedded
chunks: a user query goes in, the top-K most similar chunks come out.
**Cross-encoder reranking, RAG prompt construction, and the LLM/chat API
are intentionally NOT included — those are Phase 4B / later phases.**

```
USER QUERY
    |
    v
local embedding (all-MiniLM-L6-v2, same EmbeddingService as Phase 3)
    |
    v
pgvector cosine distance search over chunks.embedding
(uses the existing ix_chunks_embedding_hnsw HNSW index)
    |
    v
Top-K chunks, ranked most-similar-first
```

## 1. What was added

| File | Purpose |
|---|---|
| `app/services/retrieval_service.py` | New. `search(db, query, top_k)` -- validation, query embedding, pgvector cosine search. |
| `app/models/retrieval.py` | New. `SearchRequest` / `SearchResult` / `SearchResponse` Pydantic schemas. |
| `app/routes/retrieval.py` | New. `POST /api/retrieval/search`. |
| `app/main.py` | Registered the new router. |
| `app/core/config.py`, `.env.example` | Added `retrieval_top_k_default` (10) / `retrieval_top_k_max` (100). |
| `tests/conftest.py` | Added `indexed_chunk_factory` fixture (creates Document/Page/Chunk directly with a controlled embedding, for exact-distance retrieval tests). |
| `tests/test_retrieval_service.py`, `tests/test_routes_retrieval.py` | New. |

**No database migration.** `chunks.embedding vector(384)` and
`ix_chunks_embedding_hnsw` already existed from the Phase 1 migration —
retrieval only *reads* that column via pgvector's cosine-distance operator
(`<=>`), which is exactly what that HNSW index (`vector_cosine_ops`) is
built for. Nothing in the schema changed.

**No second embedding implementation.** `retrieval_service.py` imports and
calls the exact same `get_embedding_service()` singleton from
`app/services/embedding_service.py` that Phase 3 uses for chunk
embeddings — same model, same 384 dimensions, same offline/local
behavior.

## 2. Query embedding & cosine search

```python
query_vector = get_embedding_service().embed_text(query.strip())

distance_col = Chunk.embedding.cosine_distance(query_vector).label("distance")
stmt = (
    select(Chunk, distance_col)
    .join(Document, Chunk.document_id == Document.id)
    .where(Chunk.embedding.is_not(None))
    .where(Document.status == DocumentStatus.INDEXED)
    .order_by(distance_col.asc())
    .limit(top_k)
)
```

`similarity = 1 - cosine_distance` is returned alongside the raw
`distance` (kept for debugging, per the spec). 1.0 = identical direction,
0.0 = orthogonal, -1.0 = opposite.

**Filtering:** only chunks with a non-null `embedding`, belonging to a
document whose `status == INDEXED`, are ever considered. The status
filter is a deliberate extra safety check beyond "embedding IS NOT
NULL" — it excludes a document that's mid-reprocess (partially embedded,
still in `EMBEDDING` status) or `FAILED`, so retrieval never returns
stale or partial results.

## 3. top_k

- Default: `RETRIEVAL_TOP_K_DEFAULT=10`
- Max: `RETRIEVAL_TOP_K_MAX=100`
- Both configurable via `.env`, following the same settings pattern as
  every other Phase 1–3 config value.
- Validated in two places: `SearchRequest.top_k` (`Field(ge=1, le=100)`,
  so the API rejects bad input with `422` before the service even runs)
  and again in `retrieval_service._validate_top_k()` (so calling the
  service directly, outside the API, is equally protected).

## 4. Empty-database / empty-result behavior

`search()` never raises for "no results" — an empty or not-yet-indexed
database just returns `[]`. It only raises `RetrievalError` for: an
empty/whitespace query, an out-of-range `top_k`, or a query-embedding
failure (wrapped from `EmbeddingModelError`). The route turns
`RetrievalError` into an HTTP `400`.

## 5. API

```
POST /api/retrieval/search
{
  "query": "What is the leave policy?",
  "top_k": 5
}
```

```json
{
  "query": "What is the leave policy?",
  "results": [
    {
      "chunk_id": "...",
      "document_id": "...",
      "page_id": "...",
      "page_number": 5,
      "chunk_index": 2,
      "text": "...",
      "similarity": 0.82,
      "distance": 0.18
    }
  ]
}
```

No filesystem paths or database credentials are ever exposed — same
convention as the documents endpoints (`DocumentOut` omits
`storage_path`).

## 6. Offline behavior

Retrieval makes exactly two kinds of calls: the local `EmbeddingService`
(Phase 3 — no network after the model is cached; see `PHASE3.md` §9 for
offline-mode setup) and PostgreSQL. No OpenAI, Groq, Hugging Face hosted
inference, Pinecone, Weaviate Cloud, or Supabase hosted vector search
calls exist anywhere in this phase.

## 7. Testing

Same testing philosophy as Phase 3: the whole suite runs offline/fast by
default via the autouse fake-embedding-model fixture (`tests/conftest.py`).
Retrieval-specific tests additionally use a new `indexed_chunk_factory`
fixture to insert chunks with **exact, known** embedding vectors (unit
vectors along different axes) and a `_FixedVectorService` stand-in for the
query embedding — so similarity/ordering assertions are exact numbers
(1.0, 0.0, -1.0), not "probably close", regardless of what the fake or
real model would produce for arbitrary text.

```powershell
cd C:\Users\SIMRAN\OneDrive\Desktop\SIH\backend
..\venv\Scripts\python.exe -m pytest -v
```

Coverage added:

- `test_retrieval_service.py` — ordering by similarity (exact 1.0/0.0/-1.0
  cosine similarities), document/page/chunk metadata preserved, query
  embedding is 384-dim, `top_k` respected and validated (both directions),
  empty/whitespace query rejected, empty database returns `[]` cleanly,
  null-embedding chunks ignored, chunks from non-`INDEXED` documents
  excluded, retrieval only ever calls the local `EmbeddingService` (no
  external API), and a simulated embedding failure raises `RetrievalError`
  cleanly.
- `test_routes_retrieval.py` — the full HTTP flow through
  `POST /api/retrieval/search` (ranked results, empty-query `422`,
  out-of-range `top_k` `422`, empty-database `200` with `[]`), and that
  the route is exposed in `/openapi.json`.

No real-model-marked test was added for retrieval specifically — Phase
3's `test_embedding_service.py::test_real_model_produces_384_dim_normalized_vectors`
already covers the real `all-MiniLM-L6-v2` model end-to-end, and
retrieval calls that exact same service, so a second real-model test here
would just re-verify the same thing.

## 8. Verification checklist

- [ ] `pytest -v` — all Phase 1–4A tests pass (run this yourself; see
      PHASE3.md's note on why I can't execute tests on your machine from
      here).
- [ ] `uvicorn app.main:app --reload` starts without errors.
- [ ] `http://localhost:8000/docs` lists `POST /api/retrieval/search`.
- [ ] `.env` is not staged (`git status` should not show it — it's
      already in `.gitignore` from Phase 1).
- [ ] No new secrets were added anywhere in this phase.

Exact commands are in `PHASE3.md` §10–12 (install/run/test) — nothing new
is required there; Phase 4A adds no new dependencies.

**Not committed/pushed** — per your instructions, this is left for your
review first.

## 9. Known limitations / intentionally out of scope (Phase 4A)

- No cross-encoder reranking of the top-K candidates — **Phase 4B**
  (`cross-encoder/ms-marco-MiniLM-L-6-v2`, already configured in
  `settings.reranker_model_name` but unused until then).
- No RAG prompt construction or LLM call — later phases.
- No chat API, no frontend integration.
- Retrieval is synchronous within the request, same as processing in
  Phase 2/3 — fine at this scale; a background worker isn't warranted yet.
- top_k limited to 100 to bound per-request database work; no pagination.
