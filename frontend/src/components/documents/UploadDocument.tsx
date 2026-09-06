import React, { useState, useRef, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ShieldIcon,
  FileTextIcon,
  XIcon,
  RotateCwIcon,
  PlusIcon
} from '../icons';
import { Alert } from '../common/Alert';
import { documentApi } from '../../services/documentApi';
import { DocumentItem, SecurityClassification } from '../../types';

export interface UploadDocumentProps {
  onUploadSuccess?: (doc: DocumentItem) => void;
  existingFilenames?: string[];
  maxSizeMB?: number;
  className?: string;
}

export const UploadDocument: React.FC<UploadDocumentProps> = ({
  onUploadSuccess,
  existingFilenames = [],
  maxSizeMB = 50,
  className = '',
}) => {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'selected' | 'uploading' | 'success' | 'failed'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<DocumentItem | null>(null);

  // Metadata form state
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [classification, setClassification] = useState<SecurityClassification>('CONFIDENTIAL');
  const [description, setDescription] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (file.size === 0) {
      return 'Selected file is empty (0 bytes). Please select a valid document.';
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return 'Only PDF documents (.pdf) are supported for semantic ingestion.';
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File exceeds size limit: ${formatFileSize(file.size)} exceeds maximum limit of ${maxSizeMB} MB.`;
    }

    const isDuplicate = existingFilenames.some(
      (name) => name.toLowerCase() === file.name.toLowerCase()
    );
    if (isDuplicate) {
      return `A document named "${file.name}" is already indexed in the knowledge base.`;
    }

    return null;
  };

  const handleFile = (file: File) => {
    setValidationError(null);
    setUploadError(null);

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      setUploadState('idle');
      return;
    }

    setSelectedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    setUploadState('selected');
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const resetForm = () => {
    setSelectedFile(null);
    setUploadState('idle');
    setValidationError(null);
    setUploadError(null);
    setUploadedDoc(null);
    setTitle('');
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile) return;

    setUploadState('uploading');
    setUploadError(null);

    try {
      const doc = await documentApi.uploadDocument(selectedFile, {
        title: title.trim() || selectedFile.name,
        department: department.trim() || 'Operations',
        classification,
        description: description.trim() || undefined,
      });

      setUploadedDoc(doc);
      setUploadState('success');
      onUploadSuccess?.(doc);
    } catch (err: any) {
      console.error('Upload failed:', err);
      const isConnErr = !err?.status || err?.status === 0 || err?.message?.includes('connect') || err?.message?.includes('backend');
      const errorMsg = isConnErr
        ? 'LOCAL BACKEND UNAVAILABLE: Please ensure the local FastAPI backend is running on http://127.0.0.1:8000 to ingest live PDF documents.'
        : (err.message || 'Failed to upload and process document.');
      setUploadError(errorMsg);
      setUploadState('failed');
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {validationError && (
        <Alert variant="danger" title="Validation Error">
          {validationError}
        </Alert>
      )}

      {/* STATE 1: IDLE / SECURE UPLOAD PANEL */}
      {uploadState === 'idle' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all bg-white/60 backdrop-blur-md ${
            dragActive
              ? 'border-neutral-900 bg-white/80'
              : 'border-slate-300/80 hover:border-slate-800 hover:bg-white/75'
          }`}
        >
          <div className="mx-auto w-11 h-11 rounded-2xl bg-neutral-900 flex items-center justify-center text-white mb-3 shadow-sm">
            <PlusIcon size={20} />
          </div>

          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 font-bold mb-1">
            CONFIDENTIAL DOCUMENT INGESTION
          </div>

          <h3 className="text-base font-black text-black uppercase tracking-tight font-sans">
            Upload Document to Repository
          </h3>
          
          <p className="text-xs text-slate-600 mt-1 font-medium">
            Drag and drop your PDF here, or select from local storage
          </p>

          <p className="text-[11px] text-slate-500 font-mono mt-2.5 flex items-center justify-center gap-1.5 font-medium">
            <ShieldIcon size={13} className="text-emerald-600" />
            <span>PDF only • Files processed locally inside secure enclave</span>
          </p>

          <div className="mt-5">
            <button
              onClick={handleBrowseClick}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-bold px-4 py-2 rounded-xl text-xs shadow-xs inline-flex items-center gap-2 transition-all"
            >
              <UploadIcon size={14} className="text-slate-700" />
              <span>Browse Local Files</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE 2: FILE SELECTED / PARAMETERS */}
      {uploadState === 'selected' && selectedFile && (
        <div className="kavach-glass-card p-6 space-y-4">
          <div className="flex items-start justify-between pb-3 border-b border-slate-200/80">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shrink-0 shadow-xs">
                <FileTextIcon size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-black truncate max-w-sm sm:max-w-md font-mono">
                  {selectedFile.name}
                </h4>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-0.5">
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span>·</span>
                  <span className="font-semibold text-slate-700">PDF Document</span>
                  <span>·</span>
                  <span className="text-emerald-700 font-bold">Validated</span>
                </div>
              </div>
            </div>

            <button
              onClick={resetForm}
              className="p-1 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors"
              title="Cancel Selection"
            >
              <XIcon size={16} />
            </button>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. System Architecture Manual"
                  className="w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 font-sans shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                  Department / Authority
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Enclave Operations"
                  className="w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 font-sans shadow-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                  Security Classification
                </label>
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as SecurityClassification)}
                  className="w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-900 font-mono shadow-xs"
                >
                  <option value="TOP_SECRET">TOP_SECRET (Strict Clearance)</option>
                  <option value="SECRET">SECRET (Confidential Operations)</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL (Standard Repository)</option>
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="UNCLASSIFIED">UNCLASSIFIED</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Technical engineering specifications"
                  className="w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 font-sans shadow-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 font-medium">
                <ShieldIcon size={13} className="text-emerald-600" />
                <span>Local pgvector indexing (384-d embeddings)</span>
              </span>

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-black hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-black text-white shadow-xs flex items-center gap-2 transition-all"
                >
                  <UploadIcon size={14} />
                  <span>Start Ingestion</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* STATE 3: PROCESSING PIPELINE */}
      {uploadState === 'uploading' && (
        <div className="kavach-glass-card border border-blue-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 mx-auto shadow-xs">
            <RotateCwIcon size={20} className="animate-spin" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
              Processing Document
            </h4>
            <p className="text-xs text-slate-600 mt-1 font-sans">
              Extracting text, chunking, and computing embeddings in local vector store...
            </p>
          </div>

          <div className="flex items-center justify-center space-x-3 text-xs font-mono pt-2 text-slate-500 font-semibold">
            <span className="text-emerald-700">FILE</span>
            <span>→</span>
            <span className="text-blue-700">UPLOADING</span>
            <span>→</span>
            <span className="text-slate-900 animate-pulse">PROCESSING</span>
            <span>→</span>
            <span>INDEXED</span>
          </div>
        </div>
      )}

      {/* STATE 4: SUCCESS */}
      {uploadState === 'success' && uploadedDoc && (
        <div className="bg-emerald-50/90 backdrop-blur-md border border-emerald-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0 shadow-xs">
              <CheckCircleIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-emerald-950 font-mono uppercase tracking-wider">
                Document Indexed Successfully
              </h4>
              <p className="text-xs text-emerald-900 mt-0.5">
                <strong className="font-bold">{uploadedDoc.title}</strong> is now registered and indexed.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-3 text-xs font-mono py-2 bg-white/70 rounded-xl border border-emerald-200">
            <span className="text-emerald-700 font-bold">FILE</span>
            <span className="text-slate-400">→</span>
            <span className="text-emerald-700 font-bold">UPLOADING</span>
            <span className="text-slate-400">→</span>
            <span className="text-emerald-700 font-bold">PROCESSING</span>
            <span className="text-slate-400">→</span>
            <span className="text-emerald-800 font-extrabold">INDEXED</span>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 hover:bg-white transition-colors"
            >
              Upload Another
            </button>
            <button
              type="button"
              onClick={() => navigate(`/documents/${uploadedDoc.id}`)}
              className="px-4 py-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-colors"
            >
              View Document Details
            </button>
          </div>
        </div>
      )}

      {/* STATE 5: FAILED matching reference screenshot */}
      {uploadState === 'failed' && (
        <div className="bg-rose-50/90 backdrop-blur-md border border-rose-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0 shadow-xs">
              <AlertCircleIcon size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-rose-900 font-mono uppercase tracking-wider">
                DOCUMENT INGESTION FAILED
              </h4>
              <p className="text-xs text-rose-800 mt-1 font-medium leading-relaxed">
                {uploadError || 'An error occurred while processing the document.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-black hover:bg-rose-100/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleUploadSubmit()}
              className="px-4 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <RotateCwIcon size={13} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
