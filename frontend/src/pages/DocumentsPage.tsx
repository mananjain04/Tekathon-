import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadIcon,
  RefreshIcon,
  CheckIcon,
} from '../components/icons';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Alert } from '../components/common/Alert';
import { UploadDocument } from '../components/documents/UploadDocument';
import { DocumentList } from '../components/documents/DocumentList';
import { documentApi } from '../services/documentApi';
import { DocumentItem } from '../types';

export const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isUploadSectionOpen, setIsUploadSectionOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await documentApi.getDocuments(true);
      setDocuments(data);
      setIsOfflineMode(documentApi.isOffline);
    } catch (err) {
      console.warn('Backend unavailable, using local enclave fixtures:', err);
      const fallbackDocs = documentApi.getStoredDocuments();
      setDocuments(fallbackDocs);
      setIsOfflineMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleOpenDoc = (doc: DocumentItem) => {
    navigate(`/documents/${doc.id}`);
  };

  const handleAskAI = (doc: DocumentItem) => {
    navigate(`/chat?documentId=${doc.id}`);
  };

  const handleRetryDoc = async (doc: DocumentItem) => {
    setRetryingId(doc.id);
    try {
      await documentApi.processDocument(doc.id);
      await loadDocuments();
      setActionNotice(`Processing completed for "${doc.filename}". Ready for queries.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice(`Processing failed for "${doc.filename}".`);
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setRetryingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    await documentApi.deleteDocument(docToDelete.id);
    await loadDocuments();
    setActionNotice(`Document "${docToDelete.filename}" removed from repository.`);
    setDocToDelete(null);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleResetData = async () => {
    const seed = await documentApi.resetDocuments();
    setDocuments(seed);
    setActionNotice('Document repository reset to standard seed fixtures.');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const readyCount = documents.filter((d) => d.status === 'READY' || d.status === 'PROCESSED' || d.status === 'INDEXED').length;
  const processingCount = documents.filter((d) => d.status === 'PROCESSING' || d.status === 'INDEXING' || d.status === 'OCR_COMPLETE' || d.status === 'EMBEDDING' || d.status === 'UPLOADED').length;
  const failedCount = documents.filter((d) => d.status === 'FAILED').length;

  return (
    <div className="space-y-5 max-w-7xl mx-auto text-zinc-100">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-medium">
              Repository
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-[11px] font-mono text-zinc-400">Local Vector Store</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mt-1">
            Documents
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage, upload, and inspect PDF files ingested into pgvector.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshIcon size={14} />}
            onClick={handleResetData}
            title="Reset to default seed documents"
          >
            Reset Seed Data
          </Button>

          <Button
            variant={isUploadSectionOpen ? 'secondary' : 'primary'}
            size="sm"
            leftIcon={<UploadIcon size={14} />}
            onClick={() => setIsUploadSectionOpen(!isUploadSectionOpen)}
          >
            {isUploadSectionOpen ? 'Hide Upload Panel' : '+ Upload Document'}
          </Button>
        </div>
      </div>

      {/* Action notification banner */}
      {actionNotice && (
        <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-md text-xs text-blue-200 flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2">
            <CheckIcon size={14} className="text-blue-400" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Offline Mode Status Pill */}
      {isOfflineMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono">
          <div className="flex items-center space-x-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold text-amber-200">Offline Mode (Local Enclave Fixtures)</span>
            <span className="text-amber-400/70 hidden md:inline">· Air-gapped local seed store active</span>
          </div>
          <button
            onClick={loadDocuments}
            disabled={isLoading}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshIcon size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Checking...' : 'Connect Live Backend'}</span>
          </button>
        </div>
      )}

      {/* 2. Repository Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-md bg-[#121215] border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Total Documents</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-semibold text-white tracking-tight">{documents.length}</span>
            <span className="text-zinc-500 text-[10px]">PDFs</span>
          </div>
        </div>

        <div className="p-3 rounded-md bg-[#121215] border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Ready for Query</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-semibold text-emerald-400 tracking-tight">{readyCount}</span>
            <span className="text-emerald-500/70 text-[10px]">Indexed</span>
          </div>
        </div>

        <div className="p-3 rounded-md bg-[#121215] border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Processing</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-semibold text-blue-400 tracking-tight">{processingCount}</span>
            <span className="text-zinc-500 text-[10px]">Active</span>
          </div>
        </div>

        <div className="p-3 rounded-md bg-[#121215] border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Failed Ingestion</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className={`text-xl font-semibold tracking-tight ${failedCount > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
              {failedCount}
            </span>
            <span className="text-zinc-500 text-[10px]">Errors</span>
          </div>
        </div>
      </div>

      {/* 3. Upload Drawer */}
      {isUploadSectionOpen && (
        <div className="p-5 bg-[#121215] border border-zinc-800/90 rounded-lg space-y-3 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
            <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              Upload New Document
            </h3>
            <button
              onClick={() => setIsUploadSectionOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-mono"
            >
              Close ✕
            </button>
          </div>
          <UploadDocument
            onUploadSuccess={() => {
              loadDocuments();
              setIsUploadSectionOpen(false);
              setActionNotice('Document uploaded and queued for processing.');
              setTimeout(() => setActionNotice(null), 4000);
            }}
            existingFilenames={documents.map((d) => d.filename)}
          />
        </div>
      )}

      {/* 4. Document List */}
      {apiError && !isOfflineMode && (
        <Alert variant="danger" title="BACKEND OFFLINE">
          Unable to reach the local KAVACH service.
        </Alert>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-zinc-500 font-mono text-xs border border-zinc-800 rounded-lg bg-[#121215] space-y-2">
          <div className="inline-block h-6 w-6 border-2 border-zinc-500 border-t-blue-400 rounded-full animate-spin" />
          <p>Loading repository...</p>
        </div>
      ) : (
        <DocumentList
          documents={documents}
          onOpenDoc={handleOpenDoc}
          onAskAI={handleAskAI}
          onRetryDoc={handleRetryDoc}
          onDeleteDoc={(doc: DocumentItem) => setDocToDelete(doc)}
          onToggleUpload={() => setIsUploadSectionOpen(!isUploadSectionOpen)}
          isUploadOpen={isUploadSectionOpen}
          retryingId={retryingId}
          onRefresh={loadDocuments}
        />
      )}

      {/* 5. Confirm Delete Modal */}
      {docToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setDocToDelete(null)}
          title="Delete Document"
          description="Are you sure you want to remove this document from the local repository?"
          footer={
            <div className="flex items-center justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setDocToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmDelete}>
                Delete Permanently
              </Button>
            </div>
          }
        >
          <div className="p-3 rounded bg-zinc-900/80 border border-zinc-800 text-xs font-mono space-y-1">
            <p className="text-zinc-300 font-semibold">{docToDelete.title}</p>
            <p className="text-zinc-500 text-[11px]">{docToDelete.filename} · {docToDelete.chunk_count} chunks</p>
          </div>
        </Modal>
      )}
    </div>
  );
};
