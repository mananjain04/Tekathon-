# Phase 2 — PDF Ingestion Pipeline

Phase 2 covers PDF upload, validation, storage, text extraction (with local
OCR fallback), page records, and page-aware chunking. It deliberately stops
before embeddings/vector search/reranking/LLM/RAG — those are later phases.

## 1. Windows setup

### 1.1 Install Python requirements

From the repo root, using the existing venv:

```powershell
cd C:\Users\SIMRAN\OneDrive\Desktop\SIH\backend
..\venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 1.2 Install the Tesseract OCR engine (Windows)

`pytesseract` (already in requirements.txt) is only a thin Python wrapper —
it calls out to a real Tesseract binary that must be installed separately
at the OS level.

1. Download the Windows installer from the UB-Mannheim Tesseract build
   (the most commonly used Windows distribution):
   https://github.com/UB-Mannheim/tesseract/wiki
2. Run the installer. The default install path is typically:
   `C:\Program Files\Tesseract-OCR\tesseract.exe`
3. Verify it's on PATH:

   ```powershell
   tesseract --version
   ```

   If that fails with "not recognized", either add the install directory to
   your PATH, or skip PATH entirely and set `TESSERACT_CMD` in `.env`
   instead (see below) — the app will use that path directly regardless of
   PATH.

### 1.3 Configure `.env`

Copy `.env.example` to `.env` (already done in this repo) and fill in real
Postgres credentials. If Tesseract isn't on PATH, set:

```
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

`.env` is git-ignored — never commit it.

## 2. Running the backend

```powershell
cd C:\Users\SIMRAN\OneDrive\Desktop\SIH\backend
..\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Confirm it's up:

```powershell
curl http://localhost:8000/api/health
curl http://localhost:8000/api/health/db
```

## 3. Testing the API manually

### 3.1 Upload a PDF

```powershell
curl -X POST http://localhost:8000/api/documents/upload -F "file=@C:\path\to\some.pdf"
```

Returns a `DocumentOut` JSON body (id, filename, status=UPLOADED, ...).
Note `storage_path` is intentionally never included in this response — the
server's on-disk layout is never exposed through the API.

### 3.2 Process it

```powershell
curl -X POST http://localhost:8000/api/documents/<id>/process
```

Returns `pages_processed`, `pages_ocr`, `chunks_created`, and the final
status. On success this is `OCR_COMPLETE` for Phase 2 (the later
EMBEDDING/INDEXED/READY statuses belong to future phases — the enum already
has room for them). On failure the document is set to `FAILED` with
`error_message` populated, and it is safe to call `/process` again on the
same document once the underlying problem is fixed (e.g. the file is
restored) — reprocessing clears out any partial pages/chunks from the
failed attempt before rebuilding, so nothing is duplicated or left orphaned.

### 3.3 List / get

```powershell
curl http://localhost:8000/api/documents
curl http://localhost:8000/api/documents/<id>
```

## 4. Checking Postgres directly

```powershell
psql -U postgres -d sih_rag -c "SELECT id, filename, status, page_count FROM documents ORDER BY created_at DESC LIMIT 5;"
psql -U postgres -d sih_rag -c "SELECT document_id, page_number, ocr_used, length(text) FROM pages ORDER BY created_at DESC LIMIT 10;"
psql -U postgres -d sih_rag -c "SELECT document_id, page_number, chunk_index, token_count FROM chunks ORDER BY created_at DESC LIMIT 10;"
```

## 5. Running the automated tests

```powershell
cd C:\Users\SIMRAN\OneDrive\Desktop\SIH\backend
..\venv\Scripts\python.exe -m pytest -v
```

The suite is intentionally split so it never requires Tesseract to be
installed:

- `tests/test_chunker.py` — pure unit tests of the chunking algorithm
  (empty/short/long text, overlap behavior including misconfigured/negative
  overlap, invalid chunk_size, character-offset correctness).
- `tests/test_pdf_extractor.py` — PDF text extraction using small
  real-text (non-scanned) PDFs built in-memory with PyMuPDF, so normal
  extraction always finds enough text and the OCR fallback path is never
  triggered. Also covers a corrupted (non-PDF) file and a genuinely
  zero-page PDF (see note below).
- `tests/test_document_service.py` — upload validation (extension, `%PDF`
  magic bytes, empty file, max size), safe UUID-based storage filenames
  (never the client's filename), and document CRUD.
- `tests/test_document_processing_service.py` — full processing against
  real Postgres: one Page row per PDF page, page-scoped chunks that never
  cross a page boundary, reprocessing idempotency (no duplicate rows),
  missing-file-on-disk → FAILED, and retrying a failed document.
- `tests/test_routes_documents.py` — the same flows through the actual
  HTTP API (FastAPI `TestClient`), including confirming `storage_path`
  never appears in any API response.

The DB-backed test files (`test_document_service.py`,
`test_document_processing_service.py`, `test_routes_documents.py`) run
against your real local Postgres `sih_rag` database — the same one Phase 1
set up. Every test that creates a `Document` registers it with a
`cleanup_documents` fixture that deletes it (cascading to its pages/chunks)
after the test, so the suite never leaves rows behind. They also redirect
file storage to a throwaway temp directory per test (`temp_storage`
fixture) so nothing is ever written into the real `backend/storage/`
folder.

### Note: zero-page PDFs and PyMuPDF

PyMuPDF's `Document.save()` refuses to write a document with zero pages —
it raises `ValueError: cannot save with zero pages`, even if you insert a
page and then delete it before saving. So a zero-page test PDF can't be
produced via `fitz.open()` + `doc.save()`. `test_zero_page_pdf_raises_pdf_extraction_error`
instead writes a minimal, structurally valid PDF by hand (an empty `/Kids`
array with `/Count 0`), which PyMuPDF opens fine and reports
`page_count == 0` for — exactly the condition `extract_pages()` needs to
guard against. The test asserts this directly before checking
`extract_pages()`'s behavior, so a broken fixture can't silently pass.

### Manual OCR verification (not covered by automated tests)

The automated suite deliberately never requires Tesseract to be installed,
per the Phase 2 requirements. To manually verify the OCR fallback path:

1. Install Tesseract (see section 1.2) and set `TESSERACT_CMD` if needed.
2. Create or obtain a scanned/image-only PDF (a PDF page that is a photo
   of text, with no embedded text layer — e.g. print a page to PDF as an
   image, or scan a physical document).
3. Upload and process it via the API (section 3).
4. Check the response's `pages_ocr` count is > 0, and confirm in Postgres
   that the corresponding `pages.ocr_used` is `true` and `pages.text` has
   non-trivial extracted content.
5. To confirm the "Tesseract not installed" error path, temporarily rename
   or move the Tesseract executable / clear `TESSERACT_CMD` and point it at
   a nonexistent path, then process a scanned PDF again — the document
   should end up `FAILED` with an error message referencing the missing
   OCR engine, not stuck in `PROCESSING`.

## 6. Known limitations (Phase 2 scope)

- No background worker yet — `/process` runs synchronously in the request.
  The processing function takes a plain `Session` and `document_id` and has
  no dependency on being called from a request, so moving it behind a
  queue (Celery/RQ/arq/etc.) later doesn't require a redesign.
- No embeddings, vector search, reranking, or LLM/RAG — by design, per the
  Phase 2 scope. Successful processing maps to `OCR_COMPLETE`, not
  `READY`/`INDEXED`, since those later stages don't exist yet.
- Encrypted/password-protected PDFs are rejected outright (`PDFExtractionError`)
  rather than prompted for a password — no password-entry flow exists yet.
- If the database itself is unreachable at the moment a document's status
  needs to be recorded as `FAILED`, that specific state transition cannot
  be persisted (nothing can write to a database that can't be reached).
  The originating exception still propagates to the caller in that case, so
  the failure is never silently swallowed — but the document's status in
  the DB may remain stale until the next processing attempt.
