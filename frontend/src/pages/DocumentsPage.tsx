import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadIcon,
  RefreshIcon,
  CheckIcon,
  DocumentIcon,
  LayersIcon,
  ClockIcon,
  AlertTriangleIcon,
} from '../components/icons';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Massive Editorial Page Heading matching reference */}
      <div className="relative pt-2 pb-1">
        {/* Right side atmospheric branding */}
        <div className="hidden lg:block absolute right-0 top-0 text-right">
          <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500 uppercase leading-relaxed">
            SECURING<br />INFORMATION<br />WORLDWIDE
          </div>
          <div className="w-8 h-[1.5px] bg-slate-400 mt-2 ml-auto" />
        </div>

        <div>
          <div className="text-[11px] font-bold tracking-[0.28em] text-slate-600 uppercase mb-1">
            DOCUMENT REPOSITORY
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-black uppercase leading-none">
            DOCUMENTS
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-slate-700 uppercase">
              YOUR KNOWLEDGE. PRIVATELY INDEXED.
            </p>

            {/* Action Buttons matching reference */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleResetData}
                className="bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 shadow-xs px-4 py-2 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2 transition-all"
                title="Reset to default seed documents"
              >
                <RefreshIcon size={14} className="text-slate-700" />
                <span>Reset Seed Data</span>
              </button>

              <button
                onClick={() => setIsUploadSectionOpen(!isUploadSectionOpen)}
                className="bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all"
              >
                <UploadIcon size={14} className="text-white" />
                <span>{isUploadSectionOpen ? 'Hide Upload Panel' : 'Upload Document'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action notification banner */}
      {actionNotice && (
        <div className="p-3.5 bg-white/40 backdrop-blur-xl border border-white/60 rounded-xl text-xs text-slate-900 flex items-center justify-between shadow-xs font-mono">
          <div className="flex items-center space-x-2.5">
            <CheckIcon size={16} className="text-emerald-600" />
            <span className="font-semibold">{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-500 hover:text-black font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Offline Mode Status Pill */}
      {isOfflineMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50/45 backdrop-blur-xl border border-amber-200/50 text-amber-950 text-xs font-mono shadow-xs">
          <div className="flex items-center space-x-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="font-bold">Offline Mode (Local Enclave Fixtures)</span>
            <span className="text-amber-900/70 hidden md:inline">· Air-gapped local seed store active</span>
          </div>
          <button
            onClick={loadDocuments}
            disabled={isLoading}
            className="px-3 py-1 rounded-lg bg-amber-100/70 hover:bg-amber-100 border border-amber-300/80 text-amber-950 text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshIcon size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Checking...' : 'Connect Live Backend'}</span>
          </button>
        </div>
      )}

      {/* 2. Four Prominent Stat Cards matching reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Documents */}
        <div className="kavach-glass-card p-5 flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-white/40 text-slate-800 shrink-0 shadow-xs border border-white/50 backdrop-blur-sm">
            <DocumentIcon size={22} />
          </div>
          <div>
            <div className="text-3xl font-black text-black font-mono leading-none">
              {documents.length}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-slate-900 uppercase mt-1">
              TOTAL DOCUMENTS
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              PDFs in repository
            </div>
          </div>
        </div>

        {/* Card 2: Ready For Query */}
        <div className="kavach-glass-card p-5 flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-white/40 text-emerald-800 shrink-0 shadow-xs border border-white/50 backdrop-blur-sm">
            <LayersIcon size={22} />
          </div>
          <div>
            <div className="text-3xl font-black text-black font-mono leading-none">
              {readyCount}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-slate-900 uppercase mt-1">
              READY FOR QUERY
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              Indexed
            </div>
          </div>
        </div>

        {/* Card 3: Processing */}
        <div className="kavach-glass-card p-5 flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-white/40 text-blue-800 shrink-0 shadow-xs border border-white/50 backdrop-blur-sm">
            <ClockIcon size={22} />
          </div>
          <div>
            <div className="text-3xl font-black text-black font-mono leading-none">
              {processingCount}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-slate-900 uppercase mt-1">
              PROCESSING
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              Active
            </div>
          </div>
        </div>

        {/* Card 4: Failed Ingestion */}
        <div className="kavach-glass-card p-5 flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-white/40 text-rose-800 shrink-0 shadow-xs border border-white/50 backdrop-blur-sm">
            <AlertTriangleIcon size={22} />
          </div>
          <div>
            <div className="text-3xl font-black text-black font-mono leading-none">
              {failedCount}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-slate-900 uppercase mt-1">
              FAILED INGESTION
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              Errors
            </div>
          </div>
        </div>
      </div>

      {/* 3. Collapsible Upload Section */}
      {isUploadSectionOpen && (
        <div className="kavach-glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest font-mono">
              UPLOAD NEW DOCUMENT
            </h3>
            <button
              onClick={() => setIsUploadSectionOpen(false)}
              className="text-slate-500 hover:text-black text-xs font-mono font-bold"
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

      {/* 4. Document List Table */}
      {apiError && !isOfflineMode && (
        <Alert variant="danger" title="BACKEND OFFLINE">
          Unable to reach the local KAVACH service.
        </Alert>
      )}

      {isLoading ? (
        <div className="p-16 text-center text-slate-500 font-mono text-xs kavach-glass-panel space-y-3">
          <div className="inline-block h-7 w-7 border-2 border-slate-400 border-t-neutral-900 rounded-full animate-spin" />
          <p className="font-semibold text-slate-700">Loading document repository...</p>
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

      {/* 5. Editorial Ambient Watermark matching reference */}
      <div className="pt-8 pb-4 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 select-none opacity-85">
        <div className="flex items-center space-x-3 text-slate-600 font-semibold tracking-[0.25em] text-[10px] uppercase">
          <div className="w-10 h-[1.5px] bg-slate-500" />
          <div>
            SENSITIVE INFORMATION.<br />
            A MORE SECURE TOMORROW.
          </div>
        </div>

        <div className="text-right">
          <div className="text-[9px] font-bold tracking-[0.25em] text-slate-500 uppercase">
            PRIVATE AI FOR A SAFER TOMORROW
          </div>
          <div className="text-xl font-black tracking-tight text-black uppercase leading-none mt-1">
            KAVACH
          </div>
          <div className="text-[8px] font-semibold tracking-[0.25em] text-slate-500 uppercase">
            DOCUMENT INTELLIGENCE
          </div>
        </div>
      </div>

      {/* 6. Confirm Delete Modal */}
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
          <div className="p-3.5 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-mono space-y-1">
            <p className="text-slate-900 font-bold">{docToDelete.title}</p>
            <p className="text-slate-600 text-[11px]">{docToDelete.filename} · {docToDelete.chunk_count} chunks</p>
          </div>
        </Modal>
      )}
    </div>
  );
};

