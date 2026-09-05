"""
Task 5: end-to-end Evidence & Explainability regression test.

Pushes a small, real, synthetic PDF (built in-memory with PyMuPDF, never
written to the repo -- item 11's "lightweight test fixture") through the
ACTUAL pipeline -- real document_processing_service, real
retrieval_service.search_with_rerank, real context_builder/prompt_builder
-- with only the embedding model and cross-encoder faked (via the
existing autouse fixtures in conftest.py) and the LLM faked via
rag_service.answer_query's `llm=` injection point. No mocked chunks here
-- every chunk comes from real PDF extraction/chunking/embedding/storage.

Purpose (item 7): prove page numbers survive the WHOLE pipeline --
PDF -> extraction -> chunks -> embeddings -> retrieval -> reranking ->
context -> RAG response -- without ever being swapped, off-by-one, or
lost. Because the embedding/reranker fakes are not semantically
meaningful (random-but-deterministic vectors), this test does not assert
*which* chunks are most relevant to a query -- it retrieves every chunk
(top_k >= total chunk count) and asserts that each chunk's text/page
pairing, as verified against the exact source PDF content, is preserved
identically at every downstream stage.
"""
import io

import fitz
import pytest

from app.services import document_processing_service, document_service, rag_service, retrieval_service

PAGE_TEXTS = [
    "The annual leave policy grants fifteen days of paid leave per year to every employee.",
    "The refund policy allows a full refund within thirty days of purchase for any product.",
    "The office is located at forty two market street in springfield.",
]


class FakeUploadFile:
    def __init__(self, filename, content, content_type="application/pdf"):
        self.filename = filename
        self.content_type = content_type
        self.file = io.BytesIO(content)


class _FakeLLM:
    def __init__(self, answer="See the cited sources."):
        self._answer = answer
        self.prompts = []

    def generate(self, prompt, **kwargs):
        self.prompts.append(prompt)
        return self._answer


def _make_pdf_bytes(page_texts):
    doc = fitz.open()
    for text in page_texts:
        page = doc.new_page()
        page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


@pytest.fixture()
def three_page_indexed_document(db_session, cleanup_documents, temp_storage):
    """Uploads and fully processes (through the real pipeline) a 3-page PDF with known, distinct content per page."""
    content = _make_pdf_bytes(PAGE_TEXTS)
    upload = FakeUploadFile("evidence_e2e.pdf", content)
    document_id, storage_path, original_filename = document_service.save_uploaded_pdf(upload)
    document = document_service.create_document(
        db_session,
        document_id=document_id,
        filename=original_filename,
        storage_path=storage_path,
        content_type="application/pdf",
    )
    cleanup_documents.append(document.id)  # BUG FIX: this was missing -- every run was leaving 3
    # orphaned INDEXED documents (with real embedded chunks) permanently in the shared sih_rag DB,
    # which then polluted every other retrieval test's results on the NEXT run. Confirmed via a
    # direct DB query (6 leftover "evidence_e2e.pdf" documents from 2 prior runs) before this fix.
    document_processing_service.process_document(db_session, document.id)
    return document


def _expected_page_for_text(chunk_text: str) -> int:
    for page_number, page_text in enumerate(PAGE_TEXTS, start=1):
        if page_text in chunk_text or chunk_text in page_text:
            return page_number
    raise AssertionError(f"Chunk text did not match any known page: {chunk_text!r}")


def test_page_numbers_survive_retrieval_through_the_real_pipeline(db_session, three_page_indexed_document):
    all_results = retrieval_service.search_with_rerank(db_session, "policy", top_k=50, rerank=True)
    # Filtered to this test's own document: sih_rag is a real, shared, persistent DB (also used for
    # manual/live verification elsewhere), never assumed empty -- see the cleanup-bug note above.
    results = [r for r in all_results if r["document_id"] == three_page_indexed_document.id]

    assert len(results) == 3  # one chunk per page for text this short
    for result in results:
        assert result["page_number"] == _expected_page_for_text(result["text"])


def test_page_numbers_survive_all_the_way_into_the_rag_response(db_session, three_page_indexed_document):
    fake_llm = _FakeLLM()
    all_result = rag_service.answer_query(db_session, "policy", top_k=50, llm=fake_llm)
    sources = [s for s in all_result["sources"] if s["document_id"] == three_page_indexed_document.id]

    assert len(sources) == 3
    for source in sources:
        assert source["page_number"] == _expected_page_for_text(source["text"])

    # And the exact same page numbers/text appear in the prompt the LLM saw.
    prompt = fake_llm.prompts[0]
    for source in sources:
        assert f"Page: {source['page_number']}" in prompt
        assert source["text"] in prompt


def test_sources_never_contain_a_page_not_actually_retrieved(db_session, three_page_indexed_document):
    """
    Structural citation-validity check (item 3/H): `sources` is built
    directly from the real retrieved/reranked chunks by
    context_builder.build_evidence -- the LLM never generates or edits
    this list, only the free-text answer. So it is architecturally
    impossible for `sources` to contain a page number that wasn't among
    the actual retrieved chunks, regardless of what the LLM's answer text
    claims. This test confirms that invariant even when the (fake) LLM's
    answer references a page number that isn't among the sources at all.
    """
    fake_llm = _FakeLLM(answer="According to the documents, see page 99 for details.")
    result = rag_service.answer_query(db_session, "policy", top_k=50, llm=fake_llm)

    own_sources = [s for s in result["sources"] if s["document_id"] == three_page_indexed_document.id]
    assert len(own_sources) == 3
    own_page_numbers = {s["page_number"] for s in own_sources}
    assert own_page_numbers == {1, 2, 3}
    all_page_numbers = {s["page_number"] for s in result["sources"]}
    assert 99 not in all_page_numbers  # the hallucinated page in the answer text never leaks into sources
