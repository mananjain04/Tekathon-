# Phase 4 — Retrieval (4A: vector search, 4B: cross-encoder re-ranking)

Phase 4 adds the retrieval layer on top of Phase 3's embedded chunks: a
user query goes in, ranked evidence chunks come out.

- **Phase 4A** (vector search): local embedding → pgvector cosine search
  → top-K chunks, ranked by vector similarity.
- **Phase 4B** (this update): takes those same top-K chunks and re-scores
  them with a local cross-encoder for a second, more precise relevance
  judgment, before returning them.

**RAG prompt construction, the LLM/chat API, answer generation, citation
generation, and frontend integration are intentionally NOT included —
those are later phases.**

```
USER QUERY
    |
    v
local embedding (all-MiniLM-L6-v2, same EmbeddingService as Phase 3)
    |
    v
pgvector cosine distance search over chunks.embedding      <- Phase 4A
(uses the existing ix_chunks_embedding_hnsw HNSW index)
    |
    v
Top-K candidate chunks, ranked by vector similarity
    |
    v
local cross-encoder re-ranking                              <- Phase 4B
(cross-encoder/ms-marco-MiniLM-L-6-v2, scores each
 (query, chunk_text) pair independently of the vector score)
    |
    v
Re-ranked evidence, most-relevant-first
```

## 1. What Phase 4A added (unchanged by Phase 4B)

| File | Purpose |
|---|---|
| `app/services/retrieval_service.py::search()` | `search(db, query, top_k)` -- validation, query embedding, pgvector cosine search. |
| `app/models/retrieval.py` | `SearchRequest` / `SearchResult` / `SearchResponse` Pydantic schemas. |
| `app/routes/retrieval.py` | `POST /api/retrieval/search`. |
| `app/main.py` | Registered the retrieval router. |
| `app/core/config.py`, `.env.example` | `retrieval_top_k_default` (10) / `retrieval_top_k_max` (100). |
| `tests/conftest.py` | `indexed_chunk_factory` fixture (creates Document/Page/Chunk directly with a controlled embedding, for exact-distance retrieval tests). |
| `tests/test_retrieval_service.py`, `tests/test_routes_retrieval.py` | Phase 4A tests. |

`search()` itself was **not modified** in Phase 4B -- same SQL, same
filters, same signature, same return shape. Phase 4B is purely additive
(see §2).

**No database migration in 4A or 4B.** `chunks.embedding vector(384)` and
`ix_chunks_embedding_hnsw` already existed from the Phase 1 migration --
retrieval only *reads* that column via pgvector's cosine-distance operator
(`<=>`). Re-ranking happens entirely in Python, after the SQL query, so it
needed no schema change either.

**No second embedding implementation.** `retrieval_service.py` calls the
exact same `get_embedding_service()` singleton from
`app/services/embedding_service.py` that Phase 3 uses for chunk
embeddings.

### Phase 4A query & cosine search (unchanged)

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
`distance`. Only chunks with a non-null `embedding`, belonging to a
document whose `status == INDEXED`, are ever considered.

## 2. What Phase 4B adds

| File | Purpose |
|---|---|
| `app/services/reranker_service.py` | **New.** `RerankerService` -- loads `cross-encoder/ms-marco-MiniLM-L-6-v2` locally via sentence-transformers' `CrossEncoder`, scores `(query, chunk_text)` pairs, sorts descending. Same singleton/lazy-load pattern as `embedding_service.py`. |
| `app/services/retrieval_service.py::search_with_rerank()` | **New.** Orchestration: calls `search()` unchanged, then (if requested and there are candidates) hands the results to `reranker_service` to re-sort and attach `rerank_score`. |
| `app/models/retrieval.py` | `SearchRequest.rerank: bool = True` (new, optional). `SearchResult.rerank_score: Optional[float] = None` (new, additive). `SearchResponse.reranked: bool` (new). |
| `app/routes/retrieval.py` | `POST /api/retrieval/search` now calls `search_with_rerank()` instead of `search()`. Same route, same path, same request/response envelope shape -- just two new optional/additive fields. |
| `app/core/config.py`, `.env.example` | `reranker_device`, `reranker_batch_size`, `reranker_cache_dir`, `reranker_offline_mode` (new). `reranker_model_name` already existed from Phase 3's config scaffolding and is unchanged. |
| `tests/conftest.py` | `fake_cross_encoder_model` autouse fixture (new) -- same pattern as `fake_embedding_model`, keeps the whole suite offline/fast by default. |
| `tests/test_reranker_service.py` | **New.** Unit tests for the reranker in isolation. |
| `tests/test_retrieval_service.py` | + orchestration tests for `search_with_rerank()`. |
| `tests/test_routes_retrieval.py` | + route-level tests for `rerank` / `reranked` / `rerank_score`. |

**Nothing in Phase 4A was rewritten.** `search()`'s body, SQL, filters,
and the standalone `RetrievalError` conditions are byte-for-byte what
Phase 4A shipped. Every existing Phase 4A test still passes unmodified.

### Re-ranking logic

```python
# app/services/reranker_service.py
def rerank(self, query: str, chunks: List[Dict]) -> List[Dict]:
    texts = [chunk["text"] for chunk in chunks]
    scores = self.score(query.strip(), texts)          # CrossEncoder.predict([(query, text), ...])

    reranked = [dict(chunk, rerank_score=score) for chunk, score in zip(chunks, scores)]
    reranked.sort(key=lambda c: c["rerank_score"], reverse=True)
    return reranked
```

```python
# app/services/retrieval_service.py
def search_with_rerank(db, query, top_k=None, rerank=True):
    results = search(db, query, top_k)               # Phase 4A, unchanged

    if not rerank or not results:
        for r in results:
            r["rerank_score"] = None
        return results

    return reranker_service.get_reranker_service().rerank(query, results)
```

- Re-ranking happens **only** over chunks `search()` already retrieved --
  it never queries the database itself and never changes which chunks
  were retrieved, only their order and an added score.
- Every existing key (`chunk_id`, `document_id`, `page_id`, `page_number`,
  `chunk_index`, `text`, `similarity`, `distance`) is preserved exactly.
  `rerank_score` is a new, additive key.
- `rerank()` returns shallow-copied dicts -- it never mutates the list
  `search()` returned.
- Cross-encoder relevance judgments and pgvector cosine similarity are
  independent scores from different models; `rerank_score` can (and
  often should) change the ordering `search()` alone would have produced.

## 3. API

```
POST /api/retrieval/search
{
  "query": "What is the leave policy?",
  "top_k": 5,
  "rerank": true            // optional, defaults to true
}
```

```json
{
  "query": "What is the leave policy?",
  "reranked": true,
  "results": [
    {
      "chunk_id": "...",
      "document_id": "...",
      "page_id": "...",
      "page_number": 5,
      "chunk_index": 2,
      "text": "...",
      "similarity": 0.82,
      "distance": 0.18,
      "rerank_score": 4.37
    }
  ]
}
```

**Backward compatibility:** the path, method, and every Phase 4A field
are unchanged. `rerank` defaults to `true` (so re-ranking is the default
behavior going forward), but a caller can pass `"rerank": false` to get
the exact Phase 4A response shape back, with `"reranked": false` and
every `rerank_score` set to `null`.

No filesystem paths or database credentials are ever exposed, same as
Phase 4A / the documents endpoints.

## 4. Configuration

```
# --- Reranker (Phase 4B) ---
RERANKER_MODEL_NAME=cross-encoder/ms-marco-MiniLM-L-6-v2
RERANKER_DEVICE=auto              # "auto" picks CUDA if available, else CPU
RERANKER_BATCH_SIZE=16
RERANKER_CACHE_DIR=               # optional: override HF cache location
RERANKER_OFFLINE_MODE=false       # set true before an offline demo, once cached
```

`reranker_device` follows the exact same `"auto"`/`"cpu"`/`"cuda"`
resolution logic as `embedding_device` (`embedding_service._resolve_device`,
reused directly by `reranker_service.py` rather than duplicated).

## 5. Error handling (Phase 4B additions)

`search_with_rerank()` raises the same `RetrievalError` used throughout
retrieval, so the route's existing `except RetrievalError -> HTTP 400`
handling covers re-ranking failures too, with no new exception types
exposed at the API boundary:

| Condition | Behavior |
|---|---|
| Empty/whitespace query | `RetrievalError` (unchanged from Phase 4A -- caught before re-ranking is even reached). |
| Invalid `top_k` | `RetrievalError` / `422` (unchanged from Phase 4A). |
| Zero retrieved chunks | **Not an error.** Returns `[]` immediately; the cross-encoder is never loaded for an empty candidate set. |
| Cross-encoder fails to load (missing model, bad device, etc.) | `RerankerModelError` inside `reranker_service`, wrapped as `RetrievalError("Re-ranking failed: ...")` by `search_with_rerank()` -> HTTP `400`. |
| Cross-encoder `.predict()` raises during scoring | Same wrapping -> `RetrievalError` -> HTTP `400`. |

## 6. Offline behavior

Phase 4B adds exactly one new local, offline call: the cross-encoder's
`.predict()`, via `RerankerService` -> `CrossEncoder` (sentence-transformers).
Same offline contract as Phase 3/4A's embedding model:

- No OpenAI, Groq, Hugging Face **hosted inference**, Pinecone, Weaviate
  Cloud, or Supabase hosted vector search calls anywhere in this phase.
- The model downloads from Hugging Face once per machine (first use of
  that model name); after that, sentence-transformers serves it from the
  local cache with zero network calls.
- Setting `RERANKER_OFFLINE_MODE=true` (once the model is cached) sets
  `HF_HUB_OFFLINE=1` / `TRANSFORMERS_OFFLINE=1`, guaranteeing no network
  call is attempted even for a version-check -- identical mechanism to
  `EMBEDDING_OFFLINE_MODE`.
- Retrieval + re-ranking together make exactly three kinds of calls at
  runtime: the local `EmbeddingService`, the local `RerankerService`, and
  PostgreSQL. Nothing else.

## 7. Testing

Same testing philosophy as Phase 3/4A: the whole suite runs offline/fast
by default via two autouse fixtures in `tests/conftest.py` --
`fake_embedding_model` (Phase 3) and `fake_cross_encoder_model` (Phase
4B, new). Both patch the one loader seam each service exposes
(`_load_sentence_transformer` / `_load_cross_encoder`) with a fast,
deterministic fake, so no test in the default run downloads or runs
either real model.

```powershell
cd C:\Users\SIMRAN\OneDrive\Desktop\SIH\backend
..\venv\Scripts\python.exe -m pytest -v
```

**Coverage added in `tests/test_reranker_service.py`:**
- Re-ranking changes ordering correctly, by descending score, given
  controlled (non-monotonic-with-vector-order) scores.
- `(query, chunk_text)` pairs are constructed correctly and in the right
  order (asserted directly against the fake `CrossEncoder.predict()` call
  args).
- `rerank_score` is attached correctly to every result, matching the
  score for that exact chunk.
- All existing metadata keys are preserved unchanged.
- The caller's original dicts are never mutated (rerank returns copies).
- An empty candidate list returns `[]` immediately -- **without loading
  the model** (asserted by making the loader raise if called).
- An empty/whitespace query with non-empty candidates raises
  `RerankerModelError`.
- The model is loaded once and reused across repeated `score()`/`rerank()`
  calls (singleton + load-call counting, same pattern as
  `test_embedding_service.py::test_model_is_loaded_once_and_reused`).
- A simulated model-load failure and a simulated `.predict()` failure
  each raise a clear `RerankerModelError`.
- A spy on the fake model's `predict()` confirms re-ranking's only path
  to a score is that local call -- no external API/network dependency.
- **One** test marked `@pytest.mark.real_reranker_model` loads the actual
  `cross-encoder/ms-marco-MiniLM-L-6-v2` and checks it scores a genuinely
  relevant passage above an unrelated one -- run explicitly with:
  `pytest tests/test_reranker_service.py -v -m real_reranker_model`
  (mirrors `test_embedding_service.py`'s one real-model test).

**Coverage added in `tests/test_retrieval_service.py`** (orchestration):
`search_with_rerank()` re-orders vector-ranked candidates by cross-encoder
score while preserving metadata; `rerank=False` skips the reranker
entirely (asserted by making `get_reranker_service` raise if called) and
sets every `rerank_score` to `None`; an empty candidate set short-circuits
without loading the reranker; a `RerankerModelError` from the reranker is
wrapped as `RetrievalError`.

**Coverage added in `tests/test_routes_retrieval.py`:** the default
route call re-ranks and returns a numeric `rerank_score` plus
`"reranked": true`; `"rerank": false` in the request returns
`"reranked": false` with every `rerank_score` set to `null`; omitting
`rerank` defaults to `true`. All prior Phase 4A route tests (ranked
results, empty-query validation, out-of-range `top_k`, empty-database
`[]`, OpenAPI exposure) pass unmodified.

## 8. Verification performed

This was verified by actually running the commands below (not just
inspected) via a filesystem/process connector with access to this
machine:

- `pytest -v` from `backend/`: **91 passed** (0 failed), ~56s, including
  the one real-embedding-model test (Phase 3) and the one real-reranker-model
  test (Phase 4B) -- both ran against already-cached local models, no
  network required.
- `uvicorn app.main:app` started successfully on a local port.
- `GET /api/health` -> `200 {"status":"ok",...}`
- `GET /api/health/db` -> `200`, confirmed `pgvector_installed: true`.
- `GET /docs` -> `200`.
- `GET /openapi.json` -> confirmed `/api/retrieval/search` listed.
- `POST /api/retrieval/search` with a real request against the (empty)
  local database -> `200 {"query":"test query","reranked":true,"results":[]}`.
- Test server process stopped afterward.
- `git status --porcelain` / `git diff --stat` confirmed only the
  intended Phase 4B files changed, `.env` was not staged, and no new
  files outside `backend/app` and `backend/tests` were touched.

## 9. Known limitations / intentionally out of scope (Phase 4B)

- No RAG prompt construction or LLM call -- later phases.
- No chat API, no answer generation, no citation generation, no frontend
  integration.
- Re-ranking scores the same top-K candidates `search()` already limited
  to `top_k` -- there's no separate "fetch more candidates, then narrow"
  step. If a future phase wants a wider candidate pool before re-ranking
  (e.g. fetch 50, re-rank, keep 10), that's an additive change to
  `search_with_rerank()`'s signature, not a re-architecture.
- Re-ranking is synchronous within the request, same as embedding/
  processing in Phases 2-4A -- fine at this scale; a background worker
  isn't warranted yet.
- `reranker_offline_mode` is a separate flag from `embedding_offline_mode`
  by design (the two models may be cached/verified at different times),
  but in practice both are normally set together before an offline demo.

**Not committed/pushed** -- per instructions, this is left for review.
