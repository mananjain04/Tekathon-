"""
Deterministic, character-based, page-scoped chunking.

Chunking always operates on a single page's text at a time -- it is never
called across a page boundary -- so every chunk it produces inherits that
page's page_number by construction. This is what guarantees Phase 2's
"chunks must not lose page boundaries" requirement.
"""
from dataclasses import dataclass
from typing import List


@dataclass
class ChunkSpan:
    text: str
    start_char: int  # offset into the (cleaned) page text this chunk came from
    end_char: int


def chunk_text(text: str, chunk_size: int, chunk_overlap: int) -> List[ChunkSpan]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    stripped = text.strip()
    if not stripped:
        return []

    # Guard against a misconfigured overlap >= chunk_size, which would
    # otherwise never advance `start` and loop forever.
    overlap = chunk_overlap if 0 <= chunk_overlap < chunk_size else max(0, chunk_size // 4)

    spans: List[ChunkSpan] = []
    n = len(stripped)
    start = 0
    while start < n:
        end = min(start + chunk_size, n)
        spans.append(ChunkSpan(text=stripped[start:end], start_char=start, end_char=end))
        if end >= n:
            break
        start = end - overlap

    return spans


def approx_token_count(text: str) -> int:
    """Cheap whitespace-based approximation, not a real tokenizer (that belongs to the embedding phase)."""
    return len(text.split())
