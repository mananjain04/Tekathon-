import React, { useState } from 'react';
import { DocumentItem } from '../../types';
import { DocumentCard } from './DocumentCard';
import { Input } from '../common/Input';
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
  CheckIcon,
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
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121215] p-3 rounded-lg border border-zinc-800/80">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Filter documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<SearchIcon size={14} />}
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded border border-zinc-800 bg-[#18181b] px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value="READY">Ready</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center rounded border border-zinc-800 bg-[#18181b] p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Table View"
            >
              <ListIcon size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Grid View"
            >
              <GridIcon size={14} />
            </button>
          </div>

          {onToggleUpload && (
            <Button
              variant={isUploadOpen ? 'secondary' : 'primary'}
              size="sm"
              leftIcon={<UploadIcon size={14} />}
              onClick={onToggleUpload}
            >
              {isUploadOpen ? 'Close Upload' : 'Add Document'}
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {documents.length === 0 && (
        <div className="border border-zinc-800 rounded-lg p-12 text-center bg-[#121215] space-y-3 font-mono">
          <FileTextIcon size={28} className="mx-auto text-zinc-600 mb-1" />
          <h3 className="text-sm font-semibold text-zinc-200 tracking-wider uppercase">NO DOCUMENTS</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto font-sans">
            Your secure knowledge repository is empty.
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
        <div className="border border-zinc-800 rounded-lg p-10 text-center bg-[#121215]">
          <FileTextIcon size={24} className="mx-auto text-zinc-600 mb-2" />
          <h3 className="text-xs font-medium text-zinc-200">No matching documents found</h3>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto font-sans">
            Try adjusting search terms or clear filters.
          </p>
        </div>
      )}

      {/* TABLE VIEW */}
      {filteredDocs.length > 0 && viewMode === 'table' && (
        <div className="bg-[#121215] border border-zinc-800/80 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#18181b] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3.5">Document</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Pages</th>
                  <th className="py-2.5 px-3">Chunks</th>
                  <th className="py-2.5 px-3">Ingested</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredDocs.map((doc) => {
                  const isReady = doc.status === 'READY' || doc.status === 'PROCESSED';
                  const isProcessing = doc.status === 'PROCESSING' || doc.status === 'INDEXING';
                  const isFailed = doc.status === 'FAILED';

                  return (
                    <tr key={doc.id} className="hover:bg-zinc-800/25 transition-colors">
                      <td className="py-3 px-3.5 max-w-xs">
                        <div className="flex items-start space-x-2.5">
                          <div className="p-1 rounded bg-blue-600/10 border border-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                            <DocumentIcon size={14} />
                          </div>
                          <div className="min-w-0">
                            <div
                              onClick={() => onOpenDoc(doc)}
                              className="font-medium text-zinc-200 hover:text-blue-400 transition-colors cursor-pointer truncate text-xs"
                              title={doc.filename}
                            >
                              {doc.filename}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1.5 mt-0.5 font-sans">
                              <span>PDF</span>
                              <span>·</span>
                              <span>{formatBytes(doc.file_size)}</span>
                              <span>·</span>
                              <span className="truncate max-w-[120px]">{doc.department}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {isReady && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                            <CheckIcon size={10} className="stroke-[2.5]" />
                            ✓ Ready for Query
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
                            <RotateCwIcon size={10} className="animate-spin" />
                            Processing document
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
                            <AlertTriangleIcon size={10} />
                            Processing failed
                          </span>
                        )}
                        {!isReady && !isProcessing && !isFailed && (
                          <Badge variant="default" size="sm">
                            {doc.status}
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-3 text-zinc-400 text-xs">
                        {doc.page_count ? `${doc.page_count} pgs` : '—'}
                      </td>

                      <td className="py-3 px-3 text-blue-400 text-xs">
                        {doc.chunk_count}
                      </td>

                      <td className="py-3 px-3 text-zinc-500 text-[11px]">
                        {formatDate(doc.uploaded_at)}
                      </td>

                      <td className="py-3 px-3.5 text-right font-sans">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onOpenDoc(doc)}
                            className="px-2 py-1 rounded text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                          >
                            Details
                          </button>

                          {isReady && (
                            <button
                              onClick={() => onAskAI(doc)}
                              className="px-2 py-1 rounded text-xs bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 border border-blue-500/20 transition-colors font-medium"
                            >
                              Query
                            </button>
                          )}

                          {isFailed && (
                            <button
                              onClick={() => onRetryDoc(doc)}
                              disabled={retryingId === doc.id}
                              className="px-2 py-1 rounded text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors font-medium flex items-center gap-1"
                            >
                              {retryingId === doc.id ? (
                                <RotateCwIcon size={11} className="animate-spin" />
                              ) : null}
                              Retry
                            </button>
                          )}

                          <button
                            onClick={() => onDeleteDoc(doc)}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon size={13} />
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
