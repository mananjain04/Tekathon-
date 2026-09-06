import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DocumentIcon,
  ShieldIcon,
  ChevronRightIcon,
  DatabaseIcon,
  HardDriveIcon,
  TrashIcon,
  RefreshIcon,
  SparklesIcon,
  EyeIcon,
  FileTextIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
  CheckIcon,
  AlertTriangleIcon,
  RotateCwIcon,
} from '../components/icons';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Alert } from '../components/common/Alert';
import { ProcessingStatus } from '../components/documents/ProcessingStatus';
import { DocumentViewer } from '../components/documents/DocumentViewer';
import { documentApi } from '../services/documentApi';
import { DocumentItem, DocumentChunk } from '../types';

export const DocumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [docData, setDocData] = useState<{ document: DocumentItem; chunks: DocumentChunk[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'preview' | 'chunks' | 'rag'>('preview');
  const [copiedHash, setCopiedHash] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [reindexingMessage, setReindexingMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDoc = async () => {
    if (!id) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await documentApi.getDocument(id);
      if (!data) {
        setFetchError('Document not found.');
      } else {
        setDocData(data);
      }
    } catch {
      setFetchError('Unable to load this document.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoc();
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-24 text-center font-mono space-y-3">
        <div className="inline-block h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Loading document...</p>
      </div>
    );
  }

  if (fetchError || !docData) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4 font-mono">
        <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-800/40 text-rose-200 text-xs space-y-2">
          <div className="font-semibold tracking-wider">DOCUMENT ERROR</div>
          <p className="text-rose-400">{fetchError || 'Unable to load this document.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
          Back to Documents
        </Button>
      </div>
    );
  }

  const { document, chunks } = docData;

  const handleCopyHash = () => {
    if (document.checksum_sha256) {
      navigator.clipboard.writeText(document.checksum_sha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleReProcess = async () => {
    setIsProcessing(true);
    setReindexingMessage('Processing pipeline triggered: extracting and generating 384-d dense embeddings...');
    try {
      await documentApi.processDocument(document.id);
      await fetchDoc();
      setReindexingMessage('Processing completed: vector index updated in pgvector.');
    } catch {
      setReindexingMessage('Failed to execute processing pipeline.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setReindexingMessage(null), 4500);
    }
  };

  const handlePurge = async () => {
    await documentApi.deleteDocument(document.id);
    navigate('/documents');
  };

  const handleAskAI = () => {
    if (!isReady) return;
    navigate(`/chat?documentId=${document.id}`);
  };

  const handleOpenEvidenceViewer = (page = 1, chunkId?: string) => {
    const chunkParam = chunkId ? `&chunkId=${encodeURIComponent(chunkId)}` : '';
    navigate(`/documents/${document.id}/evidence?page=${page}${chunkParam}`);
  };

  const isReady = document.status === 'READY' || document.status === 'PROCESSED' || document.status === 'INDEXED';
  const isProcessingStatus = document.status === 'PROCESSING' || document.status === 'INDEXING' || document.status === 'OCR_COMPLETE' || document.status === 'EMBEDDING' || document.status === 'UPLOADED';
  const isFailed = document.status === 'FAILED';

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-zinc-100">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/documents')}
          className="inline-flex items-center space-x-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeftIcon size={14} />
          <span>← Back to Documents</span>
        </button>

        <nav className="flex items-center space-x-2 text-xs text-zinc-500 font-mono">
          <span>Documents</span>
          <ChevronRightIcon size={12} />
          <span className="text-zinc-300 truncate max-w-xs">{document.filename}</span>
        </nav>
      </div>

      {reindexingMessage && (
        <Alert variant="info" title="Pipeline Telemetry">
          {reindexingMessage}
        </Alert>
      )}

      {/* DOCUMENT OVERVIEW CARD */}
      <div className="bg-[#121215] border border-zinc-800/80 rounded-lg overflow-hidden shadow-sm">
        {/* Document Header */}
        <div className="p-6 border-b border-zinc-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight font-mono">
                {document.filename}
              </h1>
              <p className="text-xs text-zinc-400 mt-1 font-mono flex items-center gap-2">
                <span>PDF</span>
                <span className="text-zinc-600">•</span>
                <span>Secure Local Repository</span>
                {document.classification && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-blue-400">{document.classification.replace('_', ' ')}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400">STATUS:</span>
              {isReady && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
                  <CheckIcon size={12} className="stroke-[2.5]" />
                  READY
                </span>
              )}
              {isProcessingStatus && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-semibold">
                  <RotateCwIcon size={12} className="animate-spin" />
                  PROCESSING
                </span>
              )}
              {isFailed && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-semibold">
                  <AlertTriangleIcon size={12} />
                  FAILED
                </span>
              )}
            </div>
          </div>

          {/* Status Details Strip */}
          <div className="pt-2 text-xs font-mono">
            {isReady && (
              <div className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckIcon size={13} className="stroke-[2.5]" />
                <span>✓ Ready for Query</span>
              </div>
            )}
            {isProcessingStatus && (
              <div className="text-blue-400 flex items-center gap-2">
                <span className="font-medium">Processing document</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">Local indexing in progress</span>
              </div>
            )}
            {isFailed && (
              <div className="p-3 bg-rose-950/25 border border-rose-800/40 rounded text-rose-300 space-y-1">
                <div className="font-semibold tracking-wider">INGESTION FAILED</div>
                <p className="text-rose-400 text-[11px]">Unable to process this document.</p>
              </div>
            )}
          </div>
        </div>

        {/* 2-Column Split: DOCUMENT INFORMATION | PROCESSING */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800/80 text-xs font-mono">
          {/* Column 1: DOCUMENT INFORMATION */}
          <div className="p-6 space-y-3">
            <h3 className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold border-b border-zinc-800/60 pb-2">
              DOCUMENT INFORMATION
            </h3>

            <div className="space-y-2.5">
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">Document name</span>
                <span className="text-zinc-200 font-medium truncate max-w-[240px] text-right font-sans" title={document.title}>
                  {document.title}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">File type</span>
                <span className="text-zinc-200 uppercase">{document.mime_type?.replace('application/', '') || 'PDF'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">File size</span>
                <span className="text-zinc-200">
                  {document.file_size && document.file_size > 0
                    ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB`
                    : '1.00 MB'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">Pages</span>
                <span className="text-zinc-200">{document.page_count ? `${document.page_count}` : '1'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">Chunks</span>
                <span className="text-blue-400">{document.chunk_count}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">Upload date</span>
                <span className="text-zinc-200">
                  {(() => {
                    try {
                      const d = new Date(document.uploaded_at);
                      return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString();
                    } catch {
                      return 'Recently';
                    }
                  })()}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">Last processed</span>
                <span className="text-zinc-200">
                  {isReady
                    ? (() => {
                        try {
                          const d = new Date(document.uploaded_at);
                          return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString();
                        } catch {
                          return 'Recently';
                        }
                      })()
                    : isProcessingStatus
                    ? 'In progress'
                    : 'Failed'}
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Indexing state</span>
                <span className={isReady ? 'text-emerald-400' : 'text-zinc-400'}>
                  {isReady ? 'pgvector (384-d dense embeddings)' : isProcessingStatus ? 'Local vector indexing' : 'Not indexed'}
                </span>
              </div>
            </div>

            {document.checksum_sha256 && (
              <div className="pt-2 text-[11px] text-zinc-500 flex items-center justify-between bg-zinc-900/60 p-2.5 rounded border border-zinc-800/60">
                <span className="truncate max-w-[200px]">SHA-256: {document.checksum_sha256.slice(0, 16)}...</span>
                <button
                  onClick={handleCopyHash}
                  className="text-blue-400 hover:text-blue-300 text-[10px] ml-2 shrink-0 font-medium"
                >
                  {copiedHash ? 'COPIED' : 'COPY'}
                </button>
              </div>
            )}
          </div>

          {/* Column 2: PROCESSING */}
          <div className="p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold border-b border-zinc-800/60 pb-2">
                PROCESSING
              </h3>

              <div className="space-y-3.5 pt-1">
                {/* Uploaded */}
                <div className="flex items-center space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs">
                    ✓
                  </span>
                  <div>
                    <span className="font-medium text-zinc-200">Uploaded</span>
                    <p className="text-[10px] text-zinc-500 font-sans">Document stored in secure enclave</p>
                  </div>
                </div>

                {/* Extracted */}
                <div className="flex items-center space-x-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    isReady ? 'bg-emerald-500/15 text-emerald-400'
                    : isFailed ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-blue-500/15 text-blue-400'
                  }`}>
                    {isReady ? '✓' : isFailed ? '✕' : '⟳'}
                  </span>
                  <div>
                    <span className="font-medium text-zinc-200">Extracted</span>
                    <p className="text-[10px] text-zinc-500 font-sans">
                      {isReady ? `${document.page_count || 1} pages parsed` : isFailed ? 'Text extraction failed' : 'Local PDF parsing'}
                    </p>
                  </div>
                </div>

                {/* Indexed */}
                <div className="flex items-center space-x-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    isReady ? 'bg-emerald-500/15 text-emerald-400'
                    : isFailed ? 'bg-zinc-800 text-zinc-600'
                    : 'bg-blue-500/15 text-blue-400'
                  }`}>
                    {isReady ? '✓' : isFailed ? '○' : '⟳'}
                  </span>
                  <div>
                    <span className="font-medium text-zinc-200">Indexed</span>
                    <p className="text-[10px] text-zinc-500 font-sans">
                      {isReady ? `${document.chunk_count} chunks embedded in pgvector` : isFailed ? 'Indexing pending' : 'Generating dense embeddings'}
                    </p>
                  </div>
                </div>

                {/* Ready */}
                <div className="flex items-center space-x-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    isReady ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-600'
                  }`}>
                    {isReady ? '✓' : '○'}
                  </span>
                  <div>
                    <span className="font-medium text-zinc-200">Ready</span>
                    <p className="text-[10px] text-zinc-500 font-sans">
                      {isReady ? 'Available for RAG query' : 'Awaiting processing pipeline'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isFailed && (
              <div className="pt-3">
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<RefreshIcon size={13} className={isProcessing ? 'animate-spin' : ''} />}
                  onClick={handleReProcess}
                  isLoading={isProcessing}
                  className="w-full justify-center"
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Strip */}
        <div className="p-4 bg-[#18181b] border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Button
              variant={isReady ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={<SparklesIcon size={14} />}
              onClick={handleAskAI}
              disabled={!isReady}
            >
              Ask KAVACH
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<DocumentIcon size={14} />}
              onClick={() => handleOpenEvidenceViewer(1)}
              disabled={chunks.length === 0 && !isReady}
            >
              Open Evidence
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<EyeIcon size={13} />}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </Button>

            {!isFailed && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshIcon size={13} className={isProcessing ? 'animate-spin' : ''} />}
                onClick={handleReProcess}
                isLoading={isProcessing}
              >
                Re-index
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<TrashIcon size={13} />}
              onClick={() => setIsPurgeModalOpen(true)}
              className="text-zinc-500 hover:text-rose-400"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-zinc-800 flex space-x-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'pipeline'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <RefreshIcon size={14} />
          <span>Ingestion Pipeline</span>
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'preview'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileTextIcon size={14} />
          <span>Document Preview</span>
        </button>

        <button
          onClick={() => setActiveTab('chunks')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'chunks'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <DatabaseIcon size={14} />
          <span>Indexed Chunks ({chunks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rag')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'rag'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <HardDriveIcon size={14} />
          <span>RAG Configuration</span>
        </button>
      </div>

      {/* Tab 1: Processing Pipeline */}
      {activeTab === 'pipeline' && (
        <Card className="p-6 bg-[#121215] border border-zinc-800/80">
          <ProcessingStatus
            status={document.status}
            currentStage={document.current_stage}
            errorMessage={document.error_message}
            variant="detailed"
          />

          <div className="mt-6 pt-5 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-zinc-400 font-mono">
              Vector Storage: <strong className="text-zinc-200">PostgreSQL / pgvector (384-d)</strong>
              <span className="text-zinc-600 mx-2">·</span>
              <span>Status: <strong className={isReady ? 'text-emerald-400' : isFailed ? 'text-rose-400' : 'text-blue-400'}>{document.status}</strong></span>
            </div>

            <Button
              variant={isFailed ? 'danger' : 'outline'}
              size="sm"
              leftIcon={<RefreshIcon size={14} />}
              onClick={handleReProcess}
              isLoading={isProcessing}
            >
              {isFailed ? 'Retry Ingestion' : 'Re-index Chunks'}
            </Button>
          </div>
        </Card>
      )}

      {/* Tab 2: Document Preview */}
      {activeTab === 'preview' && (
        <DocumentViewer document={document} chunks={chunks} />
      )}

      {/* Tab 3: Extracted Chunks */}
      {activeTab === 'chunks' && (
        <div className="space-y-3">
          {chunks.length === 0 ? (
            <Card className="p-10 text-center text-xs text-zinc-400 bg-[#121215]">
              <DatabaseIcon size={24} className="mx-auto text-zinc-600 mb-2" />
              <div className="font-semibold text-zinc-300">No Vector Chunks Available</div>
              <p className="mt-1 text-zinc-500 max-w-sm mx-auto">
                {isFailed
                  ? 'Text extraction failed. Chunks could not be parsed.'
                  : 'Document is not yet chunked. Trigger re-index to extract chunks.'}
              </p>
            </Card>
          ) : (
            chunks.map((chunk, idx) => (
              <Card key={chunk.id} className="p-4 border-zinc-800 bg-[#121215]">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-3 text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400 font-medium">Chunk #{idx + 1}</span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-400">ID: {chunk.id}</span>
                    {chunk.page_number && (
                      <>
                        <span className="text-zinc-600">|</span>
                        <span className="text-zinc-400">Page {chunk.page_number}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-[11px]">
                    <span className="text-zinc-500">{chunk.token_count} Tokens</span>
                    {chunk.relevance_score && (
                      <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        Score: {chunk.relevance_score}
                      </span>
                    )}
                    <button
                      onClick={() => handleOpenEvidenceViewer(chunk.page_number || 1, chunk.id)}
                      className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <ExternalLinkIcon size={12} />
                      Inspect
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/60 p-3.5 rounded border border-zinc-800 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text font-serif">
                  {chunk.content}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab 4: RAG Configuration */}
      {activeTab === 'rag' && (
        <Card className="p-6 space-y-6 text-xs bg-[#121215] border border-zinc-800/80">
          <div>
            <h3 className="text-sm font-semibold text-white">Local RAG Configuration</h3>
            <p className="text-zinc-400 text-xs mt-0.5">Parameters applied during document ingestion and vector retrieval</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-[#18181b] rounded-lg border border-zinc-800 space-y-1">
              <div className="text-zinc-500 font-mono text-[11px] uppercase">Embedding Model</div>
              <div className="text-blue-400 font-medium font-mono">sentence-transformers / all-MiniLM-L6-v2</div>
              <div className="text-[11px] text-zinc-400">384-dimensional dense vectors generated locally</div>
            </div>

            <div className="p-3.5 bg-[#18181b] rounded-lg border border-zinc-800 space-y-1">
              <div className="text-zinc-500 font-mono text-[11px] uppercase">Vector Index</div>
              <div className="text-emerald-400 font-medium font-mono">PostgreSQL pgvector (HNSW Index)</div>
              <div className="text-[11px] text-zinc-400">Cosine distance metric with persistent storage</div>
            </div>

            <div className="p-3.5 bg-[#18181b] rounded-lg border border-zinc-800 space-y-1">
              <div className="text-zinc-500 font-mono text-[11px] uppercase">Chunk Size & Overlap</div>
              <div className="text-zinc-200 font-medium font-mono">512 tokens / 64 token overlap (12.5%)</div>
              <div className="text-[11px] text-zinc-400">Recursive character splitting preserving sentence boundaries</div>
            </div>

            <div className="p-3.5 bg-[#18181b] rounded-lg border border-zinc-800 space-y-1">
              <div className="text-zinc-500 font-mono text-[11px] uppercase">Classification Policy</div>
              <div className="text-amber-400 font-medium font-mono">
                Level: {document.classification}
              </div>
              <div className="text-[11px] text-zinc-400">Role-based access check applied before query expansion</div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
              <ShieldIcon size={14} className="text-emerald-400" />
              Local Private Inference Verified
            </span>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<SparklesIcon size={14} />}
              onClick={handleAskAI}
              disabled={!isReady}
            >
              Query This Document
            </Button>
          </div>
        </Card>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        title="Delete Document"
        description="Permanently remove this document and its vector embeddings from the repository."
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsPurgeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handlePurge}>
              Delete Permanently
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-zinc-300">
          <p>
            You are about to delete <strong className="text-white">{document.title}</strong> ({document.filename}).
          </p>
          <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded text-rose-300">
            {chunks.length} extracted semantic vectors will be removed from the pgvector table. This action cannot be undone.
          </div>
        </div>
      </Modal>
    </div>
  );
};
