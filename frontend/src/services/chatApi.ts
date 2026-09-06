import { ChatRequest, ChatResponse, Conversation, DocumentCitation } from '../types';
import { INITIAL_CONVERSATIONS } from '../mock/chatMock';
import { API_BASE_URL, ApiError, getAuthHeaders, ensureAuthToken, BackendRAGQueryResponse } from './client';

import { documentApi } from './documentApi';

const CONVERSATIONS_STORAGE_KEY = 'kavach_chat_conversations';

/**
 * Sovereign AI Chat & RAG Query API Service
 * Connects directly to real FastAPI backend: POST /api/rag/query
 */
export const chatApi = {
  /**
   * Submit a user inquiry to the sovereign RAG backend.
   * Target endpoint: POST /api/rag/query (and fallback to /api/chat if supported)
   */
  async sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
    const requestBody = {
      query: payload.query.trim(),
      top_k: payload.top_k ?? 5,
    };

    let response: Response;
    try {
      await ensureAuthToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // LLM inference can take up to 45s

      
      // Attempt verified backend endpoint: POST /api/rag/query
      response = await fetch(`${API_BASE_URL}/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // If /api/rag/query returned 404, check alternative /api/chat endpoint
      if (response.status === 404) {
        const altController = new AbortController();
        const altTimeoutId = setTimeout(() => altController.abort(), 45000);
        try {
          const altRes = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              query: payload.query.trim(),
              session_id: payload.session_id,
              document_id: payload.document_id,
              top_k: payload.top_k ?? 5,
            }),
            signal: altController.signal,
          });
          clearTimeout(altTimeoutId);
          if (altRes.ok) {
            response = altRes;
          }
        } catch {
          clearTimeout(altTimeoutId);
        }
      }
    } catch (netErr) {
      throw new ApiError(
        'Unable to retrieve an answer from the local KAVACH service.',
        0,
        'NetworkError',
        true,
        netErr
      );
    }

    if (!response.ok) {
      let errDetail = 'Unable to retrieve an answer from the local KAVACH service.';
      try {
        const errJson = await response.json();
        if (errJson?.detail) {
          errDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // non-json
      }
      throw new ApiError(errDetail, response.status, response.statusText);
    }

    const data: BackendRAGQueryResponse & { response?: string; citations?: any[]; session_id?: string; model?: string; latency_ms?: number } = await response.json();
    const answerText = data.answer || data.response || '';
    const rawSources = Array.isArray(data.sources)
      ? data.sources
      : Array.isArray(data.citations)
      ? data.citations
      : [];

    const storedDocs = documentApi.getStoredDocuments();

    const citations: DocumentCitation[] = rawSources.map((s: any) => {
      const docId = String(s.document_id || payload.document_id || '');
      const matchedDoc = docId ? storedDocs.find((d) => d.id === docId) : null;
      const docTitle = String(
        s.document_title ||
        s.document_name ||
        matchedDoc?.title ||
        matchedDoc?.filename ||
        (docId ? `Document ${docId.slice(0, 8)}` : 'Grounded Document')
      );

      return {
        document_id: docId,
        document_title: docTitle,
        chunk_id: String(s.chunk_id || ''),
        page_number: typeof s.page_number === 'number' ? s.page_number : undefined,
        snippet: String(s.text || s.snippet || ''),
        relevance_score:
          typeof s.rerank_score === 'number'
            ? s.rerank_score
            : typeof s.similarity === 'number'
            ? s.similarity
            : typeof s.relevance_score === 'number'
            ? s.relevance_score
            : undefined as unknown as number,
      };
    });

    return {
      session_id: String(data.session_id || payload.session_id || `sess-${Date.now()}`),
      response: answerText,
      citations,
      model: typeof data.model === 'string' ? data.model : 'Local Sovereign LLM',
      latency_ms: typeof data.latency_ms === 'number' ? data.latency_ms : undefined,
    };
  },

  /**
   * Retrieve list of recent conversations
   */
  async getConversations(): Promise<Conversation[]> {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore localStorage read errors
    }
    return INITIAL_CONVERSATIONS;
  },

  /**
   * Save or update conversation history
   */
  async saveConversation(conv: Conversation): Promise<void> {
    try {
      const existing = await this.getConversations();
      const index = existing.findIndex((c) => c.id === conv.id);
      let updated: Conversation[];
      if (index >= 0) {
        updated = [...existing];
        updated[index] = conv;
      } else {
        updated = [conv, ...existing];
      }
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore localStorage write errors
    }
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<void> {
    try {
      const existing = await this.getConversations();
      const filtered = existing.filter((c) => c.id !== id);
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore
    }
  },

  /**
   * Create a new blank conversation session
   */
  createSession(documentId?: string, documentTitle?: string): Conversation {
    const id = `sess-${Date.now()}`;
    const newConv: Conversation = {
      id,
      title: documentTitle ? `Inquiry: ${documentTitle.slice(0, 30)}...` : 'New Sovereign Inquiry',
      document_id: documentId,
      document_title: documentTitle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
    };
    return newConv;
  },
};
