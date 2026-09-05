# KAVACH Security Gaps — Phase 0
**Date:** 2026-09-05  
Severity scale: CRITICAL | HIGH | MEDIUM | LOW | INFO

---

| # | File / Area | Gap | Severity | Phase |
|---|---|---|---|---|
| G-01 | All routes | No authentication on any endpoint. Any caller can upload PDFs and query RAG. | CRITICAL | 1 |
| G-02 | All routes | No authorization/RBAC. No concept of roles or permissions exists. | CRITICAL | 2 |
| G-03 | document_service.py | No MIME-type sniffing; client Content-Type is stored unvalidated. | MEDIUM | 3 |
| G-04 | pdf_extractor.py | No inspection for embedded JavaScript or suspicious PDF action streams. | HIGH | 3 |
| G-05 | document_service.py | No explicit storage_root confinement assertion (resolve_storage_path). | MEDIUM | 3 |
| G-06 | rag_service.py | No similarity threshold gate — LLM can answer from zero or near-zero evidence. | HIGH | 4 |
| G-07 | rag_service.py | No citation cross-validation — LLM could hallucinate page/doc IDs. | MEDIUM | 4 |
| G-08 | retrieval_service.py | No pre-retrieval access control filter on chunks. | CRITICAL | 2 |
| G-09 | config.py / settings | No JWT_SECRET_KEY configured; JWT infrastructure entirely absent. | CRITICAL | 1 |
| G-10 | System-level | No deny-by-default outbound firewall rule for backend process. | HIGH | 5 |
| G-11 | System-level | No network-isolation proof script for demo or offline verification. | MEDIUM | 5 |
| G-12 | main.py | /api/health/db exposes pgvector version to unauthenticated callers. | LOW | 1 |
| G-13 | All routes | No rate limiting on any endpoint. | MEDIUM | Roadmap |
| G-14 | ollama_provider.py | Offline mode not enforced at startup; model could pull on first call. | LOW | 5 |
| G-15 | System-level | No audit log persistence; all events lost on server restart. | MEDIUM | Roadmap |
