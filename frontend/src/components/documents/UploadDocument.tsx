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
import { Button } from '../common/Button';
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
          className={`relative border border-dashed rounded-lg p-8 sm:p-10 text-center transition-colors bg-[#121215] ${
            dragActive
              ? 'border-blue-500 bg-blue-500/5'
              : 'border-zinc-800 hover:border-zinc-700 hover:bg-[#151519]'
          }`}
        >
          <div className="mx-auto w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400 mb-3 shadow-sm">
            <PlusIcon size={18} />
          </div>

          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-1">
            ADD CONFIDENTIAL DOCUMENT
          </div>

          <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
            Upload Document
          </h3>
          
          <p className="text-xs text-zinc-400 mt-1">
            Drop PDF here or browse files
          </p>

          <p className="text-[11px] text-zinc-500 font-mono mt-2 flex items-center justify-center gap-1.5">
            <ShieldIcon size={12} className="text-emerald-400" />
            <span>PDF • Supported formats (Files remain on local node)</span>
          </p>

          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBrowseClick}
              leftIcon={<UploadIcon size={14} />}
            >
              Browse Files
            </Button>
          </div>
        </div>
      )}

      {/* STATE 2: FILE SELECTED / PARAMETERS */}
      {uploadState === 'selected' && selectedFile && (
        <div className="bg-[#121215] border border-zinc-800/80 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-md bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <FileTextIcon size={18} />
              </div>
              <div>
                <h4 className="text-xs font-medium text-white truncate max-w-sm sm:max-w-md font-mono">
                  {selectedFile.name}
                </h4>
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 mt-0.5">
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span>·</span>
                  <span className="text-blue-400">PDF Document</span>
                  <span>·</span>
                  <span className="text-emerald-400">Validated</span>
                </div>
              </div>
            </div>

            <button
              onClick={resetForm}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Cancel Selection"
            >
              <XIcon size={15} />
            </button>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. System Overview Document"
                  className="w-full rounded border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                  Department / Authority
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Operations"
                  className="w-full rounded border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-sans"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                  Security Classification
                </label>
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as SecurityClassification)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="TOP_SECRET">TOP_SECRET (Strict Clearance)</option>
                  <option value="SECRET">SECRET (Confidential Operations)</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL (Standard Repository)</option>
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="UNCLASSIFIED">UNCLASSIFIED</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Operational reference manual"
                  className="w-full rounded border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
                <ShieldIcon size={12} className="text-emerald-400" />
                <span>Local pgvector indexing (384-d)</span>
              </span>

              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" type="button" onClick={resetForm}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" leftIcon={<UploadIcon size={14} />}>
                  Upload
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* STATE 3: PROCESSING PIPELINE */}
      {uploadState === 'uploading' && (
        <div className="bg-[#121215] border border-blue-500/30 rounded-lg p-6 text-center space-y-4 shadow-sm">
          <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
            <RotateCwIcon size={18} className="animate-spin" />
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase font-mono tracking-wider">
              Processing Document
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
              Extracting text and generating dense vector embeddings in pgvector...
            </p>
          </div>

          <div className="flex items-center justify-center space-x-3 text-xs font-mono pt-2 text-zinc-500">
            <span className="text-emerald-400 font-medium">FILE</span>
            <span>→</span>
            <span className="text-blue-400 font-medium">UPLOADING</span>
            <span>→</span>
            <span>PROCESSING</span>
            <span>→</span>
            <span>INDEXED</span>
          </div>
        </div>
      )}

      {/* STATE 4: SUCCESS */}
      {uploadState === 'success' && uploadedDoc && (
        <div className="bg-[#121215] border border-emerald-500/30 rounded-lg p-5 space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircleIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
                Document Indexed Successfully
              </h4>
              <p className="text-xs text-zinc-300 mt-0.5">
                <strong className="text-white font-medium">{uploadedDoc.title}</strong> is now registered and indexed.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-3 text-xs font-mono py-1.5 bg-zinc-900/60 rounded border border-zinc-800">
            <span className="text-emerald-400">FILE</span>
            <span className="text-zinc-600">→</span>
            <span className="text-emerald-400">UPLOADING</span>
            <span className="text-zinc-600">→</span>
            <span className="text-emerald-400">PROCESSING</span>
            <span className="text-zinc-600">→</span>
            <span className="text-emerald-400 font-semibold">INDEXED</span>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1">
            <Button variant="outline" size="sm" type="button" onClick={resetForm}>
              Upload Another
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => navigate(`/documents/${uploadedDoc.id}`)}
            >
              View Document Details
            </Button>
          </div>
        </div>
      )}

      {/* STATE 5: FAILED */}
      {uploadState === 'failed' && (
        <div className="bg-[#121215] border border-rose-500/30 rounded-lg p-5 space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertCircleIcon size={18} />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-rose-300 font-mono uppercase tracking-wider">
                Document Ingestion Failed
              </h4>
              <p className="text-xs text-rose-400 mt-0.5">
                {uploadError || 'An error occurred while processing the document in local storage.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1">
            <Button variant="ghost" size="sm" type="button" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              type="button"
              leftIcon={<RotateCwIcon size={14} />}
              onClick={() => handleUploadSubmit()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
