export type SecurityClassification = 
  | 'UNCLASSIFIED'
  | 'RESTRICTED'
  | 'CONFIDENTIAL'
  | 'SECRET'
  | 'TOP_SECRET';

export type DocumentStatus = 
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'OCR_COMPLETE'
  | 'EMBEDDING'
  | 'INDEXED'
  | 'READY'
  | 'FAILED';

// Backward compatibility with Phase 1 types
export type IngestionStatus = DocumentStatus | 'QUEUED' | 'INDEXING' | 'PROCESSED';

export type ProcessingStage = 
  | 'UPLOADED'
  | 'PROCESSING'
  | 'TEXT_EXTRACTION'
  | 'OCR_COMPLETE'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXED'
  | 'READY'
  | 'FAILED';

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_size: number;
  mime_type: string;
  classification: SecurityClassification;
  status: DocumentStatus | IngestionStatus;
  chunk_count: number;
  vector_count: number;
  page_count?: number;
  uploaded_at: string;
  department: string;
  checksum_sha256?: string;
  tags?: string[];
  description?: string;
  current_stage?: ProcessingStage;
  error_message?: string;
}

export interface DocumentUploadState {
  status: 'idle' | 'selected' | 'uploading' | 'success' | 'failed';
  file: File | null;
  progress: number;
  error?: string;
  uploadedDocument?: DocumentItem;
}

export interface DocumentMetadata {
  title?: string;
  classification?: SecurityClassification;
  department?: string;
  description?: string;
  tags?: string[];
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  page_number?: number;
  relevance_score?: number;
}

export interface DocumentCitation {
  document_id: string;
  document_title: string;
  chunk_id: string;
  page_number?: number;
  snippet: string;
  relevance_score: number;
}

// Source type representing a cited passage from RAG retrieval
export interface Source {
  document_id: string;
  document_title: string;
  chunk_id?: string;
  page_number?: number;
  snippet?: string;
  relevance_score?: number;
}

// Citation type for badges and inline references
export interface Citation {
  document_id: string;
  document_title: string;
  chunk_id?: string;
  page_number?: number;
  snippet?: string;
  relevance_score?: number;
}

// Forensic evidence structure for dedicated evidence view
export interface Evidence {
  id?: string;
  document_id: string;
  document_title: string;
  page_number?: number;
  snippet: string;
  relevance_score?: number;
  chunk_id?: string;
  highlight_coordinates?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}

// Document page representation for viewer abstractions
export interface DocumentPage {
  document_id: string;
  page_number: number;
  total_pages?: number;
  content?: string;
  image_url?: string;
  highlights?: string[];
  chunks?: DocumentChunk[];
}

export interface SelectedDocument {
  id: string;
  title: string;
  filename: string;
  status: DocumentStatus | IngestionStatus;
  chunk_count?: number;
  page_count?: number;
  classification?: SecurityClassification;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: DocumentCitation[];
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  document_id?: string;
  document_title?: string;
  last_message?: string;
  category?: 'Today' | 'Yesterday' | 'Previous 7 Days';
}

export type Conversation = ChatSession;

export interface ChatRequest {
  query: string;
  session_id?: string;
  document_id?: string;
  top_k?: number;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  citations: DocumentCitation[];
  model?: string;
  latency_ms?: number;
}

export type RagProcessingStage =
  | 'understanding'
  | 'searching'
  | 'retrieving'
  | 'generating'
  | 'ready';

export interface RagProcessingState {
  currentStage: RagProcessingStage;
  active: boolean;
  stageMessage?: string;
}

export interface SystemStatus {
  airgap_mode: boolean;
  node_id: string;
  node_name: string;
  embedding_model: string;
  llm_inference_engine: string;
  vector_db_status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED';
  documents_indexed: number;
  storage_used_bytes: number;
  total_storage_bytes: number;
  uptime_seconds: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'SECURITY_ADMIN' | 'OPERATOR' | 'ANALYST';
  clearance_level: SecurityClassification;
  organization: string;
}
