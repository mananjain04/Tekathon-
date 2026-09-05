# KAVACH Security Audit — Phase 0
**Date:** 2026-09-05
**Baseline commit:** a529d04 (RAG and evidence)
**Current HEAD:** cb8e104 (Ollama integration)
**Auditor:** Security Engineering Pass (Phases 1-5)

---

## 1. Authentication State

| Endpoint | Auth Required? | Notes |
|---|---|---|
| POST /api/documents/upload | No | Any caller can upload arbitrary PDFs |
| GET /api/documents | No | Full document list exposed |
| GET /api/documents/{id} | No | Any caller can query any doc by UUID |
| POST /api/documents/{id}/process | No | Any caller can trigger reprocessing |
| POST /api/retrieval/search | No | Vector search open to anyone |
| POST /api/rag/query | No | Full RAG pipeline open to anyone |
| GET /api/health | No | Acceptable (healthcheck) |
| GET /api/health/db | No | Reveals pgvector version - should be admin-only |

**Summary:** Zero authentication exists. Any unauthenticated HTTP request can upload, query, and extract from the RAG system.

---

## 2. Authorization State

| Control | Implemented? | Notes |
|---|---|---|
| Role-based access control | No | No User model, no roles |
| Endpoint-level permission checks | No | All routes accept all callers |
| Document-level access control | No | All documents visible to all callers |
| Pre-retrieval vector filtering | No | pgvector returns all indexed chunks |

---

## 3. Ingestion Hardening State

| Check | Implemented? | Notes |
|---|---|---|
| .pdf extension check | Yes | _validate_extension() in document_service.py |
| Magic bytes check (%PDF) | Yes | First chunk of upload stream checked |
| File size limit | Yes | MAX_UPLOAD_SIZE_MB enforced during stream |
| UUID-based storage path | Yes | Client filename never used for path |
| Original filename sanitization | Yes | os.path.basename() + length trim |
| MIME-type sniffing | No | Only client-supplied content_type stored, not validated |
| JavaScript embedded in PDF | No | PyMuPDF not used to inspect JS/action streams |
| Suspicious object stream rejection | No | No inspection of embedded actions |
| Storage root confinement check | Partial | UUID path avoids traversal, but no explicit assertion |

---

## 4. RAG Output Validation State

| Check | Implemented? | Notes |
|---|---|---|
| Citation validation | No | LLM-generated page citations not cross-checked |
| Insufficient-evidence explicit response | Partial | Prompt instructs model but no code enforces pre-LLM |
| Similarity threshold gate | No | All retrieved chunks passed to LLM regardless of score |
| Prompt injection in PDF content | Partial | Prompt separation + system rule 7; no automated test |

---

## 5. Logging State

| Control | Implemented? | Notes |
|---|---|---|
| Prompt text logging | Safe | ollama_provider.py explicitly avoids logging prompt |
| Sensitive data in error messages | Mostly safe | storage_path not in DocumentOut |
| Structured audit log | No | Standard uvicorn/FastAPI logging only |
| CISO immutable audit trail | No | Not implemented |

---

## 6. Network State

| Control | Implemented? | Notes |
|---|---|---|
| Ollama points to localhost | Yes | OLLAMA_BASE_URL=http://localhost:11434 |
| sentence-transformers offline mode | Configurable | EMBEDDING_OFFLINE_MODE=false by default |
| Cross-encoder offline mode | Configurable | RERANKER_OFFLINE_MODE=false by default |
| OS-level outbound firewall | No | No deny-by-default rule for backend process |
| Network isolation proof/script | No | No tcpdump/capture script provided |

---

## 7. Secrets State

| Check | Status | Notes |
|---|---|---|
| .env in .gitignore | Yes | Line 11 of .gitignore |
| .env.example has placeholders only | Yes | Passwords say "changeme"; no real credentials |
| Hardcoded secrets in source | Not found | Config uses pydantic-settings / env vars |
| API keys in source | Not found | No external API keys |
| JWT secret hardcoded | Not applicable yet | Will be added to .env in Phase 1 |

---

## 8. CORS State

Configured for localhost:3000 and localhost:5173 with allow_methods=["*"] and allow_headers=["*"].
Assessment: Acceptable for air-gapped local demo. Tighten for production.
