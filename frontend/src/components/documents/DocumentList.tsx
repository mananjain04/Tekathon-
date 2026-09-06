import React, { useState } from 'react';
import { DocumentItem } from '../../types';
import { DocumentCard } from './DocumentCard';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  SearchIcon,
  UploadIcon,
  GridIcon,
  ListIcon,
  RotateCwIcon,
  TrashIcon,
  FileTextIcon,
  AlertTriangleIcon,
  DocumentIcon
} from '../icons';

export interface DocumentListProps {
  documents: DocumentItem[];
  onOpenDoc: (doc: DocumentItem) => void;
  onAskAI: (doc: DocumentItem) => void;
  onRetryDoc: (doc: DocumentItem) => void;
  onDeleteDoc: (doc: DocumentItem) => void;
  onToggleUpload?: () => void;
  isUploadOpen?: boolean;
  retryingId?: string | null;
  className?: string;
  onRefresh?: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onOpenDoc,
  onAskAI,
  onRetryDoc,
  onDeleteDoc,
  onToggleUpload,
  isUploadOpen = false,
  retryingId = null,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const filteredDocs = documents.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const title = (doc.title || '').toLowerCase();
    const filename = (doc.filename || '').toLowerCase();
    const department = (doc.department || '').toLowerCase();
    const matchesSearch = title.includes(q) || filename.includes(q) || department.includes(q);

    const isReady = doc.status === 'READY' || doc.status === 'PROCESSED';
    const isProcessing = doc.status === 'PROCESSING' || doc.status === 'INDEXING';
    const isFailed = doc.status === 'FAILED';

    let matchesStatus = true;
    if (selectedStatus === 'READY') matchesStatus = isReady;
    else if (selectedStatus === 'PROCESSING') matchesStatus = isProcessing;
    else if (selectedStatus === 'FAILED') matchesStatus = isFailed;

    return matchesSearch && matchesStatus;
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    const d = new Date(isoString);
    return isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search & Filter Toolbar matching reference */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/75 backdrop-blur-xl p-3.5 rounded-2xl border border-white/80 shadow-xs">
        <div className="flex-1 max-w-sm relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <SearchIcon size={14} />
          </div>
          <input
            type="text"
            placeholder="Filter documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-slate-900 focus:bg-white/60 font-medium transition-all shadow-xs"
          />
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-white/60 bg-white/40 backdrop-blur-md px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-slate-900 shadow-xs font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value="READY">Ready</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center rounded-xl border border-white/60 bg-white/40 backdrop-blur-md p-1 shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'table'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
              title="Table View"
            >
              <ListIcon size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'grid'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
              title="Grid View"
            >
              <GridIcon size={14} />
            </button>
          </div>

          {onToggleUpload && (
            <button
              onClick={onToggleUpload}
              className="bg-white/40 hover:bg-white/65 backdrop-blur-md border border-white/60 shadow-xs px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 transition-all"
            >
              <UploadIcon size={14} className="text-slate-700" />
              <span>{isUploadOpen ? 'Close Upload' : 'Upload'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {documents.length === 0 && (
        <div className="kavach-glass-panel p-16 text-center space-y-3 font-mono">
          <FileTextIcon size={32} className="mx-auto text-slate-400 mb-1" />
          <h3 className="text-sm font-bold text-slate-900 tracking-wider uppercase">NO DOCUMENTS FOUND</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans">
            Your secure sovereign knowledge repository is currently empty.
          </p>
          {onToggleUpload && (
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<UploadIcon size={14} />}
                onClick={onToggleUpload}
              >
                Upload Document
              </Button>
            </div>
          )}
        </div>
      )}

      {documents.length > 0 && filteredDocs.length === 0 && (
        <div className="kavach-glass-panel p-12 text-center">
          <FileTextIcon size={28} className="mx-auto text-slate-400 mb-2" />
          <h3 className="text-xs font-bold text-slate-800">No matching documents found</h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto font-sans">
            Try adjusting your search terms or status filters.
          </p>
        </div>
      )}

      {/* TABLE VIEW matching reference design */}
      {filteredDocs.length > 0 && viewMode === 'table' && (
        <div className="kavach-glass-panel overflow-hidden border border-white/60 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/20 text-slate-700 uppercase text-[10px] tracking-widest border-b border-white/40 font-bold backdrop-blur-md">
                <tr>
                  <th className="py-3 px-4">DOCUMENT</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3">PAGES</th>
                  <th className="py-3 px-3">CHUNKS</th>
                  <th className="py-3 px-3">INGESTED</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/30 bg-transparent">
                {filteredDocs.map((doc) => {
                  const isReady = doc.status === 'READY' || doc.status === 'PROCESSED' || doc.status === 'INDEXED';
                  const isProcessing = doc.status === 'PROCESSING' || doc.status === 'INDEXING' || doc.status === 'OCR_COMPLETE' || doc.status === 'EMBEDDING' || doc.status === 'UPLOADED';
                  const isFailed = doc.status === 'FAILED';

                  return (
                    <tr key={doc.id} className="hover:bg-white/40 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 rounded-xl bg-white/50 border border-white/60 text-slate-800 shrink-0 mt-0.5 shadow-xs">
                            <DocumentIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div
                              onClick={() => onOpenDoc(doc)}
                              className="font-bold text-slate-950 hover:text-blue-700 transition-colors cursor-pointer truncate text-xs"
                              title={doc.filename}
                            >
                              {doc.filename}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5 font-sans">
                              <span className="font-semibold text-slate-600">PDF</span>
                              <span>·</span>
                              <span>{formatBytes(doc.file_size)}</span>
                              <span>·</span>
                              <span className="truncate max-w-[140px] text-slate-500">{doc.department || 'Enclave Operations'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {isReady && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider font-mono shadow-xs border border-emerald-200/60">
                            INDEXED
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold uppercase tracking-wider font-mono shadow-xs border border-blue-200/60">
                            <RotateCwIcon size={10} className="animate-spin" />
                            PROCESSING
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold uppercase tracking-wider font-mono shadow-xs border border-rose-200/60">
                            <AlertTriangleIcon size={10} />
                            FAILED
                          </span>
                        )}
                        {!isReady && !isProcessing && !isFailed && (
                          <Badge variant="default" size="sm">
                            {doc.status}
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-slate-800 font-medium text-xs font-mono">
                        {doc.page_count ? `${doc.page_count} pgs` : '1 pgs'}
                      </td>

                      <td className="py-3.5 px-3 text-sky-600 font-bold text-xs font-mono">
                        {doc.chunk_count}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 text-[11px] font-mono">
                        {formatDate(doc.uploaded_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-sans">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onOpenDoc(doc)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800 hover:text-black hover:bg-slate-100/80 transition-colors flex items-center gap-1"
                          >
                            <span>Details</span>
                            <span>→</span>
                          </button>

                          {isReady && (
                            <button
                              onClick={() => onAskAI(doc)}
                              className="px-2.5 py-1 rounded-lg text-xs bg-neutral-900 text-white hover:bg-black font-bold shadow-xs transition-colors"
                            >
                              Query
                            </button>
                          )}

                          {isFailed && (
                            <button
                              onClick={() => onRetryDoc(doc)}
                              disabled={retryingId === doc.id}
                              className="px-2.5 py-1 rounded-lg text-xs bg-rose-600 text-white hover:bg-rose-700 font-bold shadow-xs transition-colors flex items-center gap-1"
                            >
                              {retryingId === doc.id ? (
                                <RotateCwIcon size={11} className="animate-spin" />
                              ) : null}
                              Retry
                            </button>
                          )}

                          <button
                            onClick={() => onDeleteDoc(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100/80 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {filteredDocs.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onOpen={onOpenDoc}
              onAskAI={onAskAI}
              onRetry={onRetryDoc}
              onDelete={onDeleteDoc}
              isRetrying={retryingId === doc.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
