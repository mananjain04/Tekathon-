"""
Phase 5A: deterministic context building for the local LLM prompt.

Turns a list of ranked evidence chunk dicts (as produced by
retrieval_service.search_with_rerank()) into a single, clearly-delimited
context string the LLM can ground its answer in, plus a matching list of
plain "source" dicts the API layer echoes back for citation rendering.

This module NEVER invents or modifies source content: every [Source N]
block contains the chunk's `text` field verbatim (only whitespace-
stripped) -- never summarized, paraphrased, reworded, or truncated. It
also never decides relevance or ordering -- that's retrieval_service.py's
/ reranker_service.py's job; this module only formats whatever it's
given, in the order it's given.
"""
from typing import Dict, List

_EVIDENCE_FIELDS = (
    "chunk_id",
    "document_id",
    "page_id",
    "page_number",
    "chunk_index",
    "text",
    "similarity",
    "distance",
    "rerank_score",
)


def build_context(chunks: List[Dict]) -> str:
    """
    Renders `chunks` (already ranked, most-relevant-first) as numbered
    [Source N] blocks, each carrying document/page/chunk identifiers and
    the exact chunk text. Returns "" for an empty chunk list -- callers
    (prompt_builder.build_prompt) treat that as "no evidence was found"
    rather than building a prompt around an empty/malformed section.
    """
    if not chunks:
        return ""

    blocks = []
    for i, chunk in enumerate(chunks, start=1):
        blocks.append(
            "\n".join(
                [
                    f"[Source {i}]",
                    f"Document: {chunk['document_id']}",
                    f"Page: {chunk['page_number']}",
                    f"Chunk: {chunk['chunk_index']}",
                    "Content:",
                    chunk["text"].strip(),
                ]
            )
        )
    return "\n\n".join(blocks)


def build_evidence(chunks: List[Dict]) -> List[Dict]:
    """
    Returns a new list of plain dicts (one per chunk, same order) carrying
    exactly the metadata needed for later citation rendering: chunk_id,
    document_id, page_id, page_number, chunk_index, text, similarity,
    distance, rerank_score. This is an explicit allow-list (not a blind
    copy of whatever keys the input dicts happen to carry), so nothing
    filesystem-related (e.g. a stray storage_path) could ever leak through
    even if an upstream dict grew new keys later.
    """
    return [{field: chunk.get(field) for field in _EVIDENCE_FIELDS} for chunk in chunks]
