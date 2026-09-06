import { DocumentPage, Evidence } from '../types';
import { API_BASE_URL } from './client';
import { documentApi } from './documentApi';

/**
 * Sovereign Evidence & Page Retrieval API Service
 * 
 * NOTE (Pending Backend Support):
 * Target endpoint: GET /api/documents/{id}/pages/{page}
 * This endpoint is not yet implemented on the FastAPI backend.
 * This service interface is prepared with standard graceful fallbacks:
 * If the real endpoint is unavailable or returns 404, it resolves page metadata
 * from locally registered document chunks without inventing fake evidence.
 */
export const evidenceApi = {
  /**
   * Fetch page details, text streams, and chunk boundaries.
   * Future Backend Target: GET /api/documents/{id}/pages/{page}
   */
  async getDocumentPage(
    documentId: string,
    pageNumber: number
  ): Promise<DocumentPage | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${documentId}/pages/${pageNumber}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend endpoint pending support; gracefully resolve from local document chunks
    }

    // Fallback: Resolve page content from registered document chunks
    const docData = await documentApi.getDocument(documentId);
    if (!docData) return null;

    const pageChunks = docData.chunks.filter(
      (c) => c.page_number === pageNumber || (c.page_number === undefined && pageNumber === 1)
    );

    return {
      document_id: documentId,
      page_number: pageNumber,
      total_pages: docData.document.page_count,
      content: pageChunks.map((c) => c.content).join('\n\n'),
      chunks: pageChunks,
    };
  },

  /**
   * Fetch evidence detail for a specific chunk or citation.
   * STRICT: Does not invent fake evidence if chunk is not found.
   */
  async getEvidence(
    documentId: string,
    chunkId?: string
  ): Promise<Evidence | null> {
    const docData = await documentApi.getDocument(documentId);
    if (!docData) return null;

    // Do not invent fake evidence if chunkId is missing
    if (!chunkId) return null;

    const chunk = docData.chunks.find((c) => c.id === chunkId);
    if (!chunk) return null;

    return {
      id: chunk.id,
      document_id: documentId,
      document_title: docData.document.title,
      page_number: chunk.page_number,
      snippet: chunk.content,
      relevance_score: chunk.relevance_score,
      chunk_id: chunk.id,
    };
  },
};
