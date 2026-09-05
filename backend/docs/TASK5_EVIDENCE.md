# Task 5 — Evidence & Explainability

Task 5 verifies and hardens the answer -> source -> chunk -> page ->
document traceability of `POST /api/rag/query`. Most of the required
architecture already existed from Phase 5A (`context_builder.py` /
`prompt_builder.py` / `rag_service.py`) and was already well-tested; this
task's job was to inspect that work carefully, close the specific test
gaps the checklist called out, and add one genuine end-to-end regression
test against the real pipeline. **One real bug was found and fixed along
the way** -- see §8.

## 1. What already existed (inspected, not rebuilt)

| Requirement | Already implemented in |
|---|---|
| Structured sources (chunk_id, document_id, page_id, page_number, chunk_index, text, similarity, distance, rerank_score; no storage_path) | `context_builder.build_evidence()` (explicit allow-list), `app/models/rag.py::RAGSource` |
| `[Source N]` context blocks, page-cited | `context_builder.build_context()` |
| Grounded, cite-only, "cannot be determined" system prompt | `prompt_builder.SYSTEM_PROMPT` |
| Document text as untrusted data, structurally separated from instructions | `prompt_builder.build_prompt()` (`SYSTEM INSTRUCTIONS:` / `DOCUMENT EVIDENCE:` / `USER QUESTION:` sections, always in that order) |
| No-evidence -> LLM told explicitly, not faked in code | `rag_service.answer_query()` |
| No filesystem paths in the API response | `RAGSource` (no `storage_path` field), verified by an existing route test |

Nothing in this list was rewritten. Where the existing implementation
already satisfied a requirement, this task only added the specific test
that proves it (see §4).

## 2. Evidence-answer traceability

```
answer  <-  rag_service.answer_query()
              |
              +-- sources  <-  context_builder.build_evidence(chunks)
                                  |
                                  +-- chunk  <-  retrieval_service.search_with_rerank()
                                                    |
                                                    +-- page   (page_id, page_number -- from the Chunk row)
                                                    +-- document (document_id -- from the Chunk row)
```

The critical architectural property, confirmed by reading the code and
now also regression-tested end-to-end (§4.4): **`sources` is built by
code directly from the same chunk dicts that were placed in the prompt --
never by the LLM.** The LLM only produces the free-text `answer` string.
This means a hallucinated source (a source that wasn't actually
retrieved) is architecturally impossible, not just discouraged by a
prompt instruction -- there is no code path by which the LLM's output
could add, remove, or edit an entry in `sources`.

## 3. Citation validity (item 3) -- design decision

The task asked for the citation/source relationship to be made explicit,
"without a complicated parser." Given §2's structural guarantee, the
simplest correct design is: **don't parse the answer text's citations at
all.** There are two separate claims here, and only one of them is
something code can guarantee:

1. **"Every entry in `sources` corresponds to a real retrieved chunk."**
   Structurally guaranteed by construction (§2) -- verified in
   `test_evidence_e2e.py::test_sources_never_contain_a_page_not_actually_retrieved`,
   which deliberately makes the fake LLM's answer text cite a page number
   ("page 99") that was never retrieved, and confirms it never leaks into
   `sources`.
2. **"The LLM's answer text only cites page numbers that are in
   `sources`."** This is a claim about the LLM's own behavior, which
   cannot be verified without running the real model -- no amount of
   parsing the answer string proves the *model* followed the instruction,
   only that a given fake response happens to. Building a citation parser
   to check this against fake/scripted LLM output would produce a false
   sense of verification without buying anything real. **This has NOT
   been validated against the real Qwen3-4B-Instruct-2507 model** -- the
   local GGUF runtime still isn't installed (see `PHASE5.md`'s blocker
   section, unchanged by this task).

This is why no citation parser was added: the one thing worth guaranteeing
in code (claim 1) already is, and the one thing a parser might appear to
guarantee (claim 2) can't actually be verified without a real model
regardless.

## 4. What was added

### 4.1 New file: `tests/test_evidence_e2e.py`

The one substantive gap: every existing Phase 5A test used hand-built
fake chunk dicts, never a real PDF through the real pipeline. This file
pushes a small, synthetic, in-memory 3-page PDF (built with PyMuPDF,
never written to the repo -- item 11) through the **actual**
`document_processing_service.process_document()` -> **actual**
`retrieval_service.search_with_rerank()` -> **actual**
`context_builder`/`prompt_builder`, with only the embedding model and
cross-encoder faked (the existing autouse fixtures) and the LLM faked via
`answer_query()`'s `llm=` parameter. Three tests:

- `test_page_numbers_survive_retrieval_through_the_real_pipeline` --
  each page's known text comes back tagged with its correct page number
  after the real extract -> chunk -> embed -> retrieve pipeline.
- `test_page_numbers_survive_all_the_way_into_the_rag_response` -- same,
  through `rag_service.answer_query()`, also checking the exact page
  numbers/text appear in the actual prompt string the (fake) LLM saw.
- `test_sources_never_contain_a_page_not_actually_retrieved` -- the
  citation-validity structural check from §3.

Because the embedding/cross-encoder fakes are not semantically
meaningful (deterministic-but-random vectors), these tests don't assert
*relevance* -- they retrieve with a generously high `top_k` and assert
*preservation*: whatever comes back, its page number must match the page
it actually came from in the source PDF.

### 4.2 Extended `tests/test_rag_service.py` and `tests/test_routes_rag.py`

Added, at both the service and HTTP layers:

- **Multiple sources across multiple pages/documents** (items D/M/N):
  confirms `search_with_rerank`'s exact output order survives unchanged
  into `sources` and into the `[Source N]` position in the prompt/response
  -- context building never re-sorts.
- **Missing rerank score** (item L): a chunk with `rerank_score: None`
  (the contract `search_with_rerank(rerank=False)` already produces)
  serializes cleanly through `RAGSource` without error.

### 4.3 `.gitignore`

Added a `*.gguf` rule as a defensive backstop (Task 5's security
requirements explicitly call out never committing model files); the GGUF
model was already never placed inside the repo per `PHASE5.md`, so this
changes nothing about where the model actually lives -- it's a safety net,
not a behavior change.

## 5. No-evidence / weak-evidence behavior

Unchanged from Phase 5A, re-confirmed by existing + new tests:
`answer_query()` still calls the LLM with an explicit
"(No evidence was retrieved for this question.)" marker rather than
short-circuiting with a hardcoded response, so "no evidence" and "weak
evidence" are handled by the same mechanism (the model reading and
following the system prompt), not two code paths that could drift apart.
No hard-coded similarity/rerank-score threshold was introduced -- the
task explicitly said not to add one without evidence of a real need, and
none emerged from this review.

## 6. Source order / relevance

Confirmed (not just assumed) at three layers, each with its own test:
`context_builder.build_context()` never re-sorts its input
(`test_build_context_numbers_sources_in_input_order`, pre-existing);
`rag_service`/route-level, sources preserve `search_with_rerank`'s exact
order for 3+ sources across different documents/pages (new, §4.2); and
the real pipeline (new, §4.1) confirms this end-to-end.

## 7. Prompt injection + evidence

Unchanged from Phase 5A (see `PHASE5.md`'s section on this). Existing
tests already cover the structural placement guarantee at the
`prompt_builder`, `rag_service`, and route levels. No new prompt-injection
test was needed -- the existing coverage already matched the task's
requirement (test that injected instruction text stays inside
`DOCUMENT EVIDENCE:`, never before it).

## 8. Bug found and fixed during this task

While building `test_evidence_e2e.py`'s fixture, a genuine bug was
introduced and then caught by actually running the suite (not just
inspecting code): the `three_page_indexed_document` fixture created a
real `Document` row but never registered its id with the existing
`cleanup_documents` fixture. Every test run using it left 3 orphaned,
fully-`INDEXED` documents (with real embedded chunks) permanently in the
shared `sih_rag` Postgres database. On the next run, those leftover
chunks polluted unrelated retrieval tests that assumed a clean/empty
database -- observed as 10 failing tests across `test_evidence_e2e.py`,
`test_retrieval_service.py`, and `test_routes_retrieval.py` simultaneously
(none of those other files were touched by this task).

Diagnosis was done directly against the database (not guessed): a query
confirmed 6 orphaned `evidence_e2e.pdf` documents (3 per prior run x 2
runs), all `INDEXED`, all with embedded chunks. Fix applied:

1. Added the missing `cleanup_documents.append(document.id)` call to the
   fixture.
2. Made the three new tests filter results/sources by
   `document_id == three_page_indexed_document.id` before asserting
   counts -- defense-in-depth, since `sih_rag` is a real, persistent,
   shared database (also used for manual/live verification per
   `PHASE5.md`), not a fresh per-test-run schema, so a test should never
   assume it's the only thing that has ever written to it.
3. Manually deleted the 6 already-orphaned rows from the live database
   (confirmed via a direct count query, both before: 6, and after: 0).
4. Re-ran the full suite: clean.

This is exactly the kind of bug that a "the code merely looks right"
review would have missed -- it only surfaced by actually executing the
tests against the real database, which is why this task's final
verification step (§9) is a real, executed pytest run, not just a
read-through of the new test files.

## 9. Test results

Actually executed (via terminal access to your machine), not just
inspected:

```
150 passed, 2 warnings in 29.24s
```

- **Before this task**: 144 tests (91 pre-existing Phase 1-4B + 53 Phase 5A, per `PHASE5.md`).
- **After this task**: 150 tests -- 144 unchanged + 6 new (3 in
  `test_evidence_e2e.py`, 2 in `test_rag_service.py`, 1 in
  `test_routes_rag.py`).
- All 144 previous tests still pass, confirming Phase 1-4B and Phase 5A
  both remain intact.
- Database confirmed empty (0 documents) both before and after the final
  run -- no leftover rows from this task's testing.
- The 2 warnings are pre-existing Starlette/anyio deprecation warnings
  from the installed FastAPI/Starlette versions, unrelated to this task.

The two deprecation warnings are unrelated to Task 5 (pre-existing
library warnings from the installed FastAPI/Starlette versions) and were
left alone, per the instruction not to touch working Phases 1-4B without
a genuine bug affecting Evidence & Explainability.

## 10. Frontend expectations

`POST /api/rag/query` response shape is unchanged from `PHASE5.md`'s
documented contract:

```json
{
  "query": "...",
  "answer": "...",
  "sources": [
    {
      "chunk_id": "...", "document_id": "...", "page_id": "...",
      "page_number": 4, "chunk_index": 0,
      "text": "...", "similarity": 0.87, "distance": 0.13, "rerank_score": 6.5
    }
  ]
}
```

A frontend can render "Answer" plus a "Sources" list (document + page +
evidence snippet) directly from `sources`, in the order given -- that
order is the final relevance order (vector search -> rerank), confirmed
by this task's tests. `rerank_score`/`similarity`/`distance` are all
optional (`None` when unavailable, e.g. reranking disabled) and safe to
treat as "not shown" rather than an error.

## 11. Known limitations

- Real-LLM citation accuracy (claim 2 in §3) is **not validated** -- no
  local GGUF runtime is installed on this machine yet (unchanged
  `PHASE5.md` blocker: `llama-cpp-python` has no Python 3.13/Windows
  wheel, and building from source needs Windows Long Path support + a
  C++ toolchain, both explicitly out of scope). Do not read this
  document as claiming Qwen3-4B (or any real model) reliably cites only
  real pages -- that can only be verified once a real model is running.
- The end-to-end test (§4.1) verifies *preservation*, not *relevance* --
  the embedding/cross-encoder fakes aren't semantically meaningful, so it
  can't (and doesn't try to) confirm the *right* chunks get retrieved for
  a given question, only that whatever is retrieved keeps its correct
  page/document metadata all the way through.
- The e2e test's `top_k=50` assumes the shared `sih_rag` database doesn't
  contain so much other data that a 3-chunk test document could get
  crowded out of the top 50 vector-search candidates. Fine at current
  scale; worth revisiting if the test database accumulates significantly
  more real content over time.

## 12. Readiness for commit

Not committed or pushed, per instruction. Everything above was verified
by actually running the suite and querying the database directly, not by
code inspection alone. From a Task 5 standpoint, this is ready for your
review and, if you're satisfied, a commit -- the one open item is the
real-LLM verification noted in §11, which is out of this task's scope by
design (same blocker as Phase 5A, not something Task 5 was asked to
resolve).
