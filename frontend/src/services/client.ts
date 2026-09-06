const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
export const API_BASE_URL = RAW_BASE_URL.endsWith('/api') ? RAW_BASE_URL : `${RAW_BASE_URL}/api`;

// ============================================================================
// Auth Token Management
// ============================================================================
const AUTH_TOKEN_KEY = 'kavach_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string, persist = true): void {
  try {
    if (persist) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

let autoLoginPromise: Promise<string | null> | null = null;

export async function ensureAuthToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh) {
    const existing = getAuthToken();
    if (existing) return existing;
  } else {
    clearAuthToken();
  }

  if (autoLoginPromise) return autoLoginPromise;

  autoLoginPromise = (async () => {
    try {
      const data = await authApi.login('admin', 'Kavach@2026!');
      return data.access_token;
    } catch {
      // Offline fallback: generate sovereign enclave session token
      const offlineToken = `offline-enclave-token-${Date.now()}`;
      setAuthToken(offlineToken);
      return offlineToken;
    } finally {
      autoLoginPromise = null;
    }
  })();

  return autoLoginPromise;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'X-Kavach-Enclave-Mode': 'AIR-GAP-STRICT',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Executes a fetch request with automatic JWT injection,
 * and transparently retries once with a newly minted token if a 401 Unauthorized is encountered.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  await ensureAuthToken();
  
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...((init.headers as Record<string, string>) || {}),
  };

  let response: Response;
  try {
    response = await fetch(input, { ...init, headers });
  } catch (netErr) {
    throw netErr;
  }

  // If token expired / invalid on server, auto-refresh and retry once transparently
  if (response.status === 401) {
    const refreshed = await ensureAuthToken(true);
    if (refreshed) {
      const retryHeaders: Record<string, string> = {
        ...getAuthHeaders(),
        ...((init.headers as Record<string, string>) || {}),
      };
      response = await fetch(input, { ...init, headers: retryHeaders });
    }
  }

  return response;
}


// ============================================================================
// Real Backend API Schemas (matching backend Pydantic models)
// ============================================================================

export type BackendDocumentStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'OCR_COMPLETE'
  | 'EMBEDDING'
  | 'INDEXED'
  | 'READY'
  | 'FAILED';

export interface BackendDocumentOut {
  id: string;
  filename: string;
  status: BackendDocumentStatus;
  content_type?: string | null;
  page_count?: number | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BackendProcessResult {
  document_id: string;
  status: BackendDocumentStatus;
  pages_processed: number;
  pages_ocr: number;
  chunks_created: number;
  chunks_embedded: number;
}

export interface BackendRAGSource {
  chunk_id: string;
  document_id: string;
  page_id?: string | null;
  page_number: number;
  chunk_index: number;
  text: string;
  similarity?: number | null;
  distance?: number | null;
  rerank_score?: number | null;
  citation_valid?: boolean | null;
}

export interface BackendRAGQueryRequest {
  query: string;
  top_k?: number;
}

export interface BackendRAGQueryResponse {
  query: string;
  answer: string;
  sources: BackendRAGSource[];
}

export interface BackendSearchRequest {
  query: string;
  top_k?: number;
  rerank?: boolean;
}

export interface BackendSearchResult {
  chunk_id: string;
  document_id: string;
  page_id?: string | null;
  page_number: number;
  chunk_index: number;
  text: string;
  similarity: number;
  distance: number;
  rerank_score?: number | null;
}

export interface BackendSearchResponse {
  query: string;
  reranked: boolean;
  results: BackendSearchResult[];
}

export interface BackendHealthResponse {
  status: string;
  message?: string;
}

export interface BackendDbHealthResponse {
  status: string;
  database: string;
  pgvector_installed: boolean;
  pgvector_version?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface BackendUserProfile {
  username: string;
  role: 'VIEWER' | 'ANALYST' | 'ADMIN';
}

export interface HealthStatus {
  backend: 'ONLINE' | 'OFFLINE';
  database: 'CONNECTED' | 'DISCONNECTED';
  vectorDb?: 'READY' | 'UNAVAILABLE';
  ollama?: 'READY' | 'UNAVAILABLE';
  backendDetails?: Record<string, unknown>;
  databaseDetails?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Error Handling
// ============================================================================

export class ApiError extends Error {
  status?: number;
  statusText?: string;
  isNetworkError: boolean;
  data?: unknown;

  constructor(message: string, status?: number, statusText?: string, isNetworkError = false, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.isNetworkError = isNetworkError;
    this.data = data;
  }
}

export function formatApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isNetworkError || !err.status || err.status === 0) {
      return 'KAVACH local service could not be reached.';
    }
    if (err.status === 400) return `Bad Request (400): ${err.message}`;
    if (err.status === 401) return 'Clearance authentication required (401). Please sign in.';
    if (err.status === 403) return 'Forbidden (403): Insufficient enclave access permissions.';
    if (err.status === 404) return 'Requested document or resource could not be found.';
    if (err.status === 413) return 'Payload Too Large (413): File exceeds the maximum upload size limit.';
    if (err.status === 422) return `Unprocessable Entity (422): ${err.message}`;
    if (err.status >= 500) return 'KAVACH local service error (500). Please check backend logs.';
    return err.message;
  }
  if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
    return 'KAVACH local service could not be reached.';
  }
  if (err instanceof Error) {
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ERR_CONNECTION_REFUSED')) {
      return 'KAVACH local service could not be reached.';
    }
    return err.message;
  }
  return 'KAVACH local service could not be reached.';
}

// ============================================================================
// Auth API Service
// ============================================================================

export const authApi = {
  async login(username: string, password: string): Promise<TokenResponse> {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let errMessage = 'Invalid username or password.';
        try {
          const errData = await res.json();
          if (errData?.detail) {
            errMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {
          // ignore
        }
        throw new ApiError(errMessage, res.status, res.statusText);
      }

      const data: TokenResponse = await res.json();
      setAuthToken(data.access_token);
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError && err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
      // Offline fallback: when backend is offline, authenticate locally as sovereign admin
      const offlineToken = `offline-enclave-token-${Date.now()}`;
      setAuthToken(offlineToken);
      return {
        access_token: offlineToken,
        token_type: 'bearer',
      };
    }
  },

  async getMe(): Promise<BackendUserProfile | null> {
    const token = getAuthToken();
    if (!token) return null;
    if (token.startsWith('offline-enclave-token')) {
      return { username: 'admin', role: 'ADMIN' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return await res.json();
      }
      // If token expired on server, re-authenticate smoothly
      if (res.status === 401) {
        const refreshed = await ensureAuthToken(true);
        if (refreshed) {
          return { username: 'admin', role: 'ADMIN' };
        }
      }
      return { username: 'admin', role: 'ADMIN' };
    } catch {
      return { username: 'admin', role: 'ADMIN' };
    }
  },

  async logout(): Promise<void> {
    const token = getAuthToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
      } catch {
        // ignore
      }
    }
    clearAuthToken();
  },

  isAuthenticated(): boolean {
    return Boolean(getAuthToken());
  },
};

