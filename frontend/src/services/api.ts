import { DocumentItem, DocumentChunk, SystemStatus, DocumentMetadata } from '../types';
import { documentApi, SEED_DOCUMENTS, INITIAL_DOCUMENTS, SEED_CHUNKS } from './documentApi';
import { chatApi } from './chatApi';
import { evidenceApi } from './evidenceApi';

export {
  API_BASE_URL,
  ApiError,
  formatApiErrorMessage,
  authApi,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getAuthHeaders,
  ensureAuthToken,
} from './client';

export type {
  HealthStatus,
  BackendDocumentStatus,
  BackendDocumentOut,
  BackendProcessResult,
  BackendRAGSource,
  BackendRAGQueryRequest,
  BackendRAGQueryResponse,
  BackendSearchRequest,
  BackendSearchResult,
  BackendSearchResponse,
  BackendHealthResponse,
  BackendDbHealthResponse,
  TokenResponse,
  BackendUserProfile,
} from './client';
import { API_BASE_URL, ApiError, formatApiErrorMessage, HealthStatus } from './client';

export { documentApi, SEED_DOCUMENTS, INITIAL_DOCUMENTS, SEED_CHUNKS, chatApi, evidenceApi };

export const api = {
  // Document APIs delegated to documentApi
  getDocuments: () => documentApi.getDocuments(),
  getDocumentById: (id: string) => documentApi.getDocument(id),
  addDocument: async (doc: DocumentItem, customChunks?: DocumentChunk[]) => {
    const docs = await documentApi.getDocuments();
    if (!docs.some((d) => d.id === doc.id)) {
      docs.unshift(doc);
      try {
        localStorage.setItem('kavach_documents_store', JSON.stringify(docs));
        if (customChunks) {
          const rawChunks = localStorage.getItem('kavach_chunks_store');
          const chunksMap = rawChunks ? JSON.parse(rawChunks) : {};
          chunksMap[doc.id] = customChunks;
          localStorage.setItem('kavach_chunks_store', JSON.stringify(chunksMap));
        }
      } catch {
        // Ignore
      }
    }
    return doc;
  },
  uploadDocument: (file: File, metadata?: Partial<DocumentMetadata>) =>
    documentApi.uploadDocument(file, metadata),
  processDocument: (id: string) => documentApi.processDocument(id),
  deleteDocument: (id: string) => documentApi.deleteDocument(id),
  resetDocuments: () => documentApi.resetDocuments(),

  // Evidence APIs delegated to evidenceApi
  getDocumentPage: (documentId: string, pageNumber: number) =>
    evidenceApi.getDocumentPage(documentId, pageNumber),
  getEvidence: (documentId: string, chunkId?: string) =>
    evidenceApi.getEvidence(documentId, chunkId),

  // Chat APIs delegated to chatApi
  sendChatMessage: (payload: { message: string; session_id?: string; document_id?: string }) =>
    chatApi.sendChatMessage({
      query: payload.message,
      session_id: payload.session_id,
      document_id: payload.document_id,
    }),

  // Health Check APIs
  async checkBackendHealth(): Promise<{ status: string; [key: string]: unknown }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new ApiError(`Health check failed with status ${res.status}`, res.status, res.statusText);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  },

  async checkDbHealth(): Promise<{ status: string; [key: string]: unknown }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${API_BASE_URL}/health/db`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new ApiError(`Database health check failed with status ${res.status}`, res.status, res.statusText);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  },

  async getHealthStatus(): Promise<HealthStatus> {
    let backendOnline = false;
    let dbConnected = false;
    let backendDetails: Record<string, unknown> | undefined;
    let databaseDetails: Record<string, unknown> | undefined;
    let error: string | undefined;

    try {
      const healthRes = await this.checkBackendHealth();
      backendOnline = healthRes.status === 'ok' || healthRes.status === 'healthy' || healthRes.status === 'ONLINE' || Boolean(healthRes);
      backendDetails = healthRes;
    } catch (err) {
      backendOnline = false;
      error = formatApiErrorMessage(err);
    }

    if (backendOnline) {
      try {
        const dbRes = await this.checkDbHealth();
        dbConnected = dbRes.status === 'connected' || dbRes.status === 'ok' || dbRes.status === 'healthy' || dbRes.status === 'CONNECTED';
        databaseDetails = dbRes;
      } catch {
        dbConnected = false;
      }
    }

    const vectorReady = Boolean(databaseDetails?.pgvector_installed || (dbConnected && databaseDetails?.status === 'ok'));
    const ollamaReady = backendOnline;

    return {
      backend: backendOnline ? 'ONLINE' : 'OFFLINE',
      database: dbConnected ? 'CONNECTED' : 'DISCONNECTED',
      vectorDb: vectorReady ? 'READY' : 'UNAVAILABLE',
      ollama: ollamaReady ? 'READY' : 'UNAVAILABLE',
      backendDetails,
      databaseDetails,
      error,
    };
  },

  // System Status API
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${API_BASE_URL}/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Status API offline');
      return await res.json();
    } catch {
      let docs: DocumentItem[] = [];
      try {
        docs = await documentApi.getDocuments(true);
      } catch {
        docs = [...SEED_DOCUMENTS];
      }
      const readyDocs = docs.filter((d) => d.status === 'READY' || d.status === 'PROCESSED');
      return {
        airgap_mode: true,
        node_id: 'IN-NODE-DEL-01',
        node_name: 'Delhi Secure Operations Enclave',
        embedding_model: 'bge-m3-local-quantized',
        llm_inference_engine: 'Llama-3-8B-Instruct (GGUF Q5_K_M)',
        vector_db_status: 'HEALTHY',
        documents_indexed: readyDocs.length,
        storage_used_bytes: docs.reduce((acc, d) => acc + (d.file_size || 0), 0),
        total_storage_bytes: 107374182400, // 100 GB
        uptime_seconds: 184200,
      };
    }
  },
};
