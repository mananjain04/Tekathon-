"""
Phase 5A: RAG orchestration.

    route -> rag_service -> retrieval_service -> reranker_service -> llm_service

Ties together everything already built in Phases 3/4A/4B (local query
embedding, pgvector retrieval, cross-encoder re-ranking -- all UNCHANGED
here, called exactly as retrieval_service.py already exposes them) with a
new context-building step and a new local LLM call, and returns a
grounded answer plus the evidence it was built from.

This module contains no LLM-runtime code of its own (that's
llm_service.py) and no prompt-injection-handling logic of its own (that's
prompt_builder.py's SYSTEM_PROMPT + the SYSTEM/DOCUMENT EVIDENCE
separation). Its only job is orchestration: call retrieval+reranking,
build context/evidence, build the prompt, call the LLM, and shape the
result -- never fabricating an answer if any step fails.
"""
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.services import llm_service
from app.services.context_builder import build_context, build_evidence
from app.services.llm_service import LLMModelError, LLMService
from app.services.prompt_builder import build_prompt
from app.services.retrieval_service import RetrievalError, search_with_rerank


class RAGError(Exception):
    """
    A clearly-diagnosed RAG orchestration failure: an empty/invalid query,
    a retrieval/re-ranking failure (wrapping the underlying
    RetrievalError), or a local LLM failure/unavailability (wrapping the
    underlying LLMModelError). Always safe to surface to the API layer as
    str(exc) -- never leaks internals like file paths or stack traces.
    """


def answer_query(
    db: Session,
    query: str,
    top_k: Optional[int] = None,
    *,
    llm: Optional[LLMService] = None,
) -> Dict:
    """
    Runs the full RAG pipeline for one user query and returns:
        {"query": ..., "answer": ..., "sources": [...]}

    Evidence is retrieved and re-ranked exactly as
    retrieval_service.search_with_rerank() already does it (Phases 4A/4B
    unchanged), then formatted into context (context_builder.build_context)
    and evidence metadata (context_builder.build_evidence), then wrapped in
    the grounded system prompt (prompt_builder.build_prompt) and handed to
    the local LLM. If retrieval finds no evidence at all, the LLM is still
    called -- with the prompt's DOCUMENT EVIDENCE section explicitly
    stating that no evidence was retrieved -- so the grounded system
    prompt's own instruction (state that the answer cannot be determined
    from the provided documents) produces the "no answer" response, rather
    than this function fabricating one itself.

    `llm` lets callers (mainly tests) inject a fake/alternate LLMService
    instead of the process-wide singleton, mirroring how
    test_retrieval_service.py monkeypatches get_embedding_service()/
    get_reranker_service() rather than requiring real models.

    Raises RAGError for an empty/whitespace query, a retrieval/re-ranking
    failure, or a local LLM failure/unavailability. Never returns a
    fabricated answer: any failure is a raised exception, not a
    placeholder response in the result dict.
    """
    if query is None or not query.strip():
        raise RAGError("Query must not be empty.")

    try:
        ranked_chunks = search_with_rerank(db, query, top_k=top_k, rerank=True)
    except RetrievalError as exc:
        raise RAGError(f"Retrieval failed: {exc}") from exc

    context = build_context(ranked_chunks)
    evidence = build_evidence(ranked_chunks)
    prompt = build_prompt(query, context)

    llm_instance = llm if llm is not None else llm_service.get_llm_service()
    try:
        answer = llm_instance.generate(prompt)
    except LLMModelError as exc:
        raise RAGError(f"Local LLM generation failed: {exc}") from exc

    return {
        "query": query.strip(),
        "answer": answer,
        "sources": evidence,
    }
