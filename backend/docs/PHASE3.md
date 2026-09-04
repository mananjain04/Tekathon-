# Phase 3 — Local Embedding Generation

Phase 3 adds local, offline embedding generation to the existing Phase 2
ingestion pipeline. It does **not** add retrieval, reranking, or the chat
API — those are Phase 5+.

```
PDF -> extraction/OCR -> pages -> page-aware chunks   (Phase 2, unchanged)
                                        |
                                        v
                          embed every chunk locally    (Phase 3, new)
                                        |
                                        v
                          store 384-dim vector in
                          chunks.embedding (pgvector)
                                        |
                                        v
                              document status = INDEXED
```

## 1. Embedding model

**all-MiniLM-L6-v2**, run locally via `sentence-transformers`. Chosen
because it's small (~80MB), fast on CPU, and produces a well-established
384-dimensional sentence embedding — matching the `vector(384)` column
and HNSW index that were already created in the Phase 1 migration.

- Dimension: `384` (`EMBEDDING_DIM`)
- Vectors are L2-normalized (`normalize_embeddings=True`), matching the
  existing `vector_cosine_ops` HNSW index.
- No OpenAI/Cohere/Voyage/hosted-inference calls anywhere — the only
  network access is the one-time Hugging Face model download the first
  time `all-MiniLM-L6-v2` is used on a given machine.

## 2. PostgreSQL / pgvector

**No new migration.** `chunks.embedding vector(384)` and the
`ix_chunks_embedding_hnsw` HNSW index already exist from the Phase 1
migration (`migrations/versions/0001_initial_schema.py`) — Phase 3 only
populates that column, and only if it were empty was a migration needed.

## 3. What was added / changed

| File | Change |
|---|---|
| `app/services/embedding_service.py` | Already existed in the repo (untouched) — `EmbeddingService` / `get_embedding_service()` singleton wrapping `sentence-transformers`. |
| `app/services/document_processing_service.py` | Added `_embed_chunks()` and wired it into `process_document()`: after chunking, the document moves `OCR_COMPLETE -> EMBEDDING -> INDEXED` instead of stopping at `OCR_COMPLETE`. |
| `app/core/config.py` | Added `embedding_device`, `embedding_batch_size`, `embedding_cache_dir`, `embedding_offline_mode` (embedding_dim/embedding_model_name already existed). |
| `.env.example` | Documented the new embedding env vars. |
| `app/models/document.py` | `ProcessResult` gained `chunks_embedded: int`. |
| `requirements.txt` | Added `sentence-transformers>=3.2.0`. |
| `tests/conftest.py` | Added an autouse fixture that fakes the embedding model for the whole suite (see §7). |
| `tests/test_embedding_service.py` | New — unit tests for `EmbeddingService`. |
| `tests/test_document_processing_service.py`, `tests/test_routes_documents.py` | Updated final-status assertions from `OCR_COMPLETE` to `INDEXED`; added embedding-specific assertions and one embedding-failure test. |

No changes were needed to `app/db/models.py` (the `DocumentStatus` enum
already had `EMBEDDING`/`INDEXED`) or to the upload/list/get endpoints.

## 4. Processing lifecycle

```
UPLOADED -> PROCESSING -> OCR_COMPLETE -> EMBEDDING -> INDEXED
                                              |
                                              v (on failure)
                                           FAILED (error_message set)
```

`OCR_COMPLETE` and `EMBEDDING` are now transient checkpoints within a
single `POST /api/documents/{id}/process` call rather than terminal
states — each is committed to the database as it's reached, so if the
process crashes mid-pipeline the document's status in Postgres reflects
exactly how far it got, and it is never left stuck in `PROCESSING`.

**Design note:** Phase 2 originally left the API/tests expecting a
successful `/process` call to end at `OCR_COMPLETE`. Phase 3's instructions
explicitly call for the same endpoint to now reach `INDEXED`, so the
Phase 2 tests' final-status assertions were updated accordingly (see the
table above) — this was a deliberate, documented change, not an
accidental behavior break. Nothing about the request/response *shape*
changed except the additive `chunks_embedded` field.

## 5. API

No new endpoints. `POST /api/documents/{document_id}/process` now returns:

```json
{
  "document_id": "...",
  "status": "INDEXED",
  "pages_processed": 2,
  "pages_ocr": 0,
  "chunks_created": 5,
  "chunks_embedded": 5
}
```

On embedding failure, the same endpoint returns `422` with a message like
`"Embedding generation failed: ..."`, and the document is `FAILED` in the
database with `error_message` populated — reprocessing (calling `/process`
again once the underlying issue is fixed) works exactly like Phase 2's
retry behavior, since `_reset_previous_attempt` wipes pages/chunks from
the failed attempt before rebuilding.

## 6. CPU / GPU behavior

`EMBEDDING_DEVICE=auto` (default) picks CUDA if `torch.cuda.is_available()`,
else CPU — same code path runs unmodified on this Ryzen 7 5825U / integrated
Radeon / no-NVIDIA-GPU laptop and on a teammate's CUDA machine. Set
`EMBEDDING_DEVICE=cpu` or `=cuda` to force one explicitly. No CUDA install
is required for this laptop to run everything, including tests.

## 7. Batching

`_embed_chunks()` embeds only the chunks belonging to the document being
processed (never scans the whole `chunks` table), in batches of
`EMBEDDING_BATCH_SIZE` (default 32, configurable). The model is loaded
once per process (a module-level singleton via `get_embedding_service()`)
and reused for every document and every batch — never reloaded per chunk.

## 8. Idempotency

Reprocessing a document (`/process` called again) goes through the
existing Phase 2 `_reset_previous_attempt()`, which deletes that
document's prior pages/chunks before rebuilding — so re-running Phase 3
never produces duplicate chunks or duplicate/stale vectors. New chunks are
always embedded fresh; there's no separate "reuse existing embedding"
branch, since a reprocessed document has no old chunk rows left to reuse
by the time embedding runs.

## 9. Offline requirement

The **first** time `all-MiniLM-L6-v2` is used on a machine,
`sentence-transformers` downloads it from Hugging Face
(`~/.cache/huggingface` by default, or wherever `EMBEDDING_CACHE_DIR`
points). After that, no network access is needed for embedding at all.

Before an offline demo:

1. Run the backend once with internet access and process at least one
   document, so the model gets cached.
2. Set `EMBEDDING_OFFLINE_MODE=true` in `.env` — this makes the app set
   `HF_HUB_OFFLINE=1` / `TRANSFORMERS_OFFLINE=1` before loading the model,
   so `sentence-transformers`/`huggingface_hub` never attempt even a
   quick "check for updates" network call.
3. Confirm it still works with your network disabled.

## 10. Windows setup

```powershell
cd C:\Users\SIMRAN\OneDrive\Desktop\SIH\backend
..\venv\Scripts\python.exe -m pip install -r requirements.txt
```

`sentence-transformers` pulls in `torch`, `transformers`, `numpy`, etc. —
this is a large install (the CPU build of `torch` alone is a few hundred
MB) and will take a few minutes. It installs the CPU build by default,
which is exactly what's needed here (no NVIDIA GPU on this machine).

No new migration to run — Phase 1's migration already created the vector
column and HNSW index.

## 11. Testing

```powershell
cd C:\Users\SIMRAN\OneDrive\Desktop\SIH\backend
..\venv\Scripts\python.exe -m pytest -v
```

Expected: all tests pass, including the original Phase 2 tests (with
their final-status assertions updated to `INDEXED` as described in §4)
plus the new Phase 3 tests. This default run **never downloads the real
model or touches the network** — every test uses an autouse fixture
(`tests/conftest.py::fake_embedding_model`) that replaces
`sentence-transformers`' model loading with a fast, deterministic fake
(same input text -> same output vector, correct dimension, correctly
normalized) via the one seam `embedding_service.py` exposes for exactly
this purpose (`_load_sentence_transformer`).

To also run the one real-model integration test (downloads
all-MiniLM-L6-v2 the first time — needs internet then, not after):

```powershell
..\venv\Scripts\python.exe -m pytest tests/test_embedding_service.py -v -m real_embedding_model
```

That test checks the real model produces 384-dim, L2-normalized vectors,
and that two similar sentences end up closer together (cosine similarity)
than two unrelated ones — a check the fake model can't meaningfully do.

New/updated test coverage:

- `test_embedding_service.py` — dimension, batch vs. individual encoding
  order, empty/whitespace-input rejection, model-loaded-once-and-reused,
  singleton behavior, model-load-failure and wrong-output-dimension both
  raising `EmbeddingModelError`, plus the real-model test above.
- `test_document_processing_service.py` — every chunk gets a 384-dim
  embedding after processing; `chunks_embedded == chunks_created`;
  reprocessing re-embeds cleanly with no null/duplicate vectors; a
  simulated embedding-model failure lands the document on `FAILED` with
  a useful `error_message` and no partially-written vectors.
- `test_routes_documents.py` — the full upload -> process HTTP flow now
  asserts `status == "INDEXED"` and `chunks_embedded > 0`.

## 12. Real database verification

After processing a real document through the running server (see PHASE2.md
§3 for the upload/process curl commands):

```powershell
psql -U postgres -d sih_rag -c "SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL;"
psql -U postgres -d sih_rag -c "SELECT vector_dims(embedding) FROM chunks WHERE embedding IS NOT NULL LIMIT 5;"
psql -U postgres -d sih_rag -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'chunks';"
```

Expected: the chunk count matches `chunks_embedded` from the `/process`
response, every `vector_dims(embedding)` is `384`, and
`ix_chunks_embedding_hnsw` (`USING hnsw (embedding vector_cosine_ops)`)
is listed alongside the existing btree indexes.

## 13. Known limitations (Phase 3 scope)

- No vector similarity search yet — chunks are embedded and stored, but
  nothing queries them by similarity. That's Phase 5 (retrieval).
- No cross-encoder reranking, RAG prompt construction, or LLM integration
  yet — Phases 6–8.
- Still synchronous — `/process` blocks on both extraction and embedding
  for the duration of the request, same as Phase 2. Embedding a large
  document (many chunks) on CPU will make this noticeably slower than
  Phase 2 alone; moving this behind a background task queue is still an
  option later without redesigning `process_document()`'s internals.
- The "reuse existing embedding vs. regenerate" question doesn't actually
  arise given `_reset_previous_attempt()`'s current idempotency strategy
  (old chunks are deleted before new ones are created), so there's no
  separate embedding-reuse code path to reason about.

## 14. What Phase 4/5 should implement

Phase 4/5 (per the original phase plan, retrieval) should add:

- A `retrieval_service.py`: embed an incoming query with the same
  `EmbeddingService`, then a pgvector cosine-distance similarity search
  (`ORDER BY embedding <=> :query_vector LIMIT :k`) against `chunks`,
  returning `document_id`/`page_number`/`text` for each hit.
- No new database schema changes are expected to be needed for that —
  the HNSW index already in place is exactly what a `<=>` query would use.
