import React, { useState } from 'react';
import { DocumentItem, DocumentChunk, Evidence, DocumentCitation, Source } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  DocumentIcon,
  SparklesIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ExternalLinkIcon,
  FileTextIcon,
  AlertTriangleIcon,
} from '../icons';

export interface EvidenceViewerProps {
  document: DocumentItem | null;
  evidence: Evidence | DocumentCitation | Source | null;
  initialPage?: number;
  chunks?: DocumentChunk[];
  onPageChange?: (newPage: number) => void;
  onBackToChat?: () => void;
  onBackToDocument?: () => void;
  className?: string;
}

const renderHighlightedContent = (content: string, snippet?: string) => {
  if (!snippet || !snippet.trim()) {
    return <span>{content}</span>;
  }

  const cleanSnippet = snippet.trim();
  const lowerContent = content.toLowerCase();
  const lowerSnippet = cleanSnippet.toLowerCase();

  const matchIdx = lowerContent.indexOf(lowerSnippet);
  if (matchIdx === -1) {
    return <span>{content}</span>;
  }

  const before = content.slice(0, matchIdx);
  const matched = content.slice(matchIdx, matchIdx + cleanSnippet.length);
  const after = content.slice(matchIdx + cleanSnippet.length);

  return (
    <span>
      {before}
      <mark className="bg-amber-400/20 text-amber-200 px-1 py-0.5 rounded border border-amber-500/30 font-medium select-text">
        {matched}
      </mark>
      {after}
    </span>
  );
};

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  document,
  evidence,
  initialPage = 1,
  chunks = [],
  onPageChange,
  onBackToChat,
  onBackToDocument,
  className = '',
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  React.useEffect(() => {
    if (initialPage && initialPage !== currentPage) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

  const handlePageSelect = (page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const totalPages = document?.page_count;

  const handlePrev = () => {
    if (currentPage > 1) {
      handlePageSelect(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (totalPages === undefined || currentPage < totalPages) {
      handlePageSelect(currentPage + 1);
    }
  };

  const pageChunks = chunks.filter(
    (c) => c.page_number === currentPage || (c.page_number === undefined && currentPage === 1)
  );

  const docTitle = document?.title || evidence?.document_title || 'Document';
  const docFilename = document?.filename || evidence?.document_title || 'Document.pdf';
  const hasEvidence = Boolean(evidence && evidence.snippet && evidence.snippet.trim().length > 0);
  const relevancePct = evidence?.relevance_score !== undefined && evidence?.relevance_score !== null
    ? Math.round(evidence.relevance_score * 100)
    : null;

  return (
    <div className={`space-y-4 ${className} text-zinc-100`}>
      {/* 1. Clean Navigation Bar */}
      <div className="bg-[#121215] border border-zinc-800/80 px-4 py-2 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <div className="flex items-center space-x-2 text-zinc-400 overflow-x-auto py-0.5">
          <span className="text-zinc-500">Query Assistant</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-300 truncate max-w-[200px]" title={docFilename}>
            {docFilename}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-blue-400 font-medium">
            Page {currentPage}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-medium">
            Source Passage
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
            Grounded Chunk
          </span>
        </div>
      </div>

      {/* 2. Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121215] border border-zinc-800/80 px-4 py-2 rounded-lg text-xs font-mono">
        <div className="flex items-center space-x-3">
          {/* Navigation Controls */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePrev}
              disabled={currentPage <= 1}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#18181b] hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded text-zinc-200 transition-colors border border-zinc-800"
              title="Previous Page"
            >
              <ChevronLeftIcon size={14} />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 bg-zinc-900 rounded border border-zinc-800 text-zinc-300">
              Page <strong className="text-white font-medium">{currentPage}</strong>
              {totalPages !== undefined && (
                <span> of <strong className="text-zinc-400">{totalPages}</strong></span>
              )}
            </span>

            <button
              onClick={handleNext}
              disabled={totalPages !== undefined ? currentPage >= totalPages : false}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#18181b] hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded text-zinc-200 transition-colors border border-zinc-800"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRightIcon size={14} />
            </button>
          </div>

          <span className="text-zinc-700">|</span>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
              disabled={zoomLevel <= 75}
              className="p-1 bg-[#18181b] hover:bg-zinc-800 disabled:opacity-40 rounded text-zinc-300 transition-colors border border-zinc-800"
              title="Zoom Out"
            >
              <ZoomOutIcon size={13} />
            </button>
            <span className="text-zinc-400 text-[10px] w-8 text-center font-medium">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              disabled={zoomLevel >= 150}
              className="p-1 bg-[#18181b] hover:bg-zinc-800 disabled:opacity-40 rounded text-zinc-300 transition-colors border border-zinc-800"
              title="Zoom In"
            >
              <ZoomInIcon size={13} />
            </button>
          </div>
        </div>

        {onBackToChat && (
          <Button
            variant="primary"
            size="sm"
            onClick={onBackToChat}
            leftIcon={<ArrowLeftIcon size={13} />}
            className="text-xs py-1"
          >
            Back to Assistant
          </Button>
        )}
      </div>

      {/* 3. Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Document Canvas */}
        <div className="lg:col-span-7 space-y-3">
          <div className="overflow-auto rounded-lg border border-zinc-800/80 bg-[#121215] p-3 shadow-sm min-h-[500px]">
            <div
              className="relative p-4 flex flex-col justify-between overflow-hidden transition-all duration-150"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
            >
              {/* Document Header */}
              <div className="border-b border-zinc-800 pb-3 mb-3">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
                  <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                    <DocumentIcon size={13} />
                    <span>Document Content</span>
                  </span>
                  {document?.classification && (
                    <Badge variant="default" size="sm">
                      {document.classification}
                    </Badge>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 truncate" title={docTitle}>
                  {docFilename}
                </h3>
                <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-400 mt-0.5">
                  <span className="text-blue-400 font-medium">Page {currentPage}</span>
                  {totalPages !== undefined && (
                    <span className="text-zinc-500">of {totalPages} pages</span>
                  )}
                </div>
              </div>

              {/* Document Text Content */}
              <div className="space-y-3 text-xs font-mono text-zinc-300 leading-relaxed overflow-y-auto max-h-[420px] pr-2">
                {pageChunks.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-[10px] flex items-center justify-between">
                      <span>Indexed Chunks for Page {currentPage}</span>
                      <span className="text-zinc-500 text-[9px]">{pageChunks.length} chunk(s)</span>
                    </div>

                    {pageChunks.map((chunk) => {
                      const isDirectMatch = Boolean(
                        (evidence?.chunk_id && evidence.chunk_id === chunk.id) ||
                        (evidence?.snippet && chunk.content.toLowerCase().includes(evidence.snippet.trim().toLowerCase()))
                      );

                      return (
                        <div
                          key={chunk.id}
                          className={`p-3 rounded border transition-all leading-relaxed font-mono text-xs whitespace-pre-wrap select-text ${
                            isDirectMatch
                              ? 'bg-amber-950/15 border-amber-500/40 text-amber-100 ring-1 ring-amber-500/20'
                              : 'bg-[#18181b] border-zinc-800 text-zinc-300'
                          }`}
                        >
                          {isDirectMatch && (
                            <div className="text-[10px] font-mono text-amber-400 font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <SparklesIcon size={11} />
                              <span>Grounded Passage Match</span>
                            </div>
                          )}
                          <div>
                            {isDirectMatch
                              ? renderHighlightedContent(chunk.content, evidence?.snippet)
                              : chunk.content}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center space-y-2.5">
                    <div className="p-2.5 bg-zinc-900 rounded-full w-10 h-10 flex items-center justify-center mx-auto text-zinc-500 border border-zinc-800">
                      <FileTextIcon size={18} />
                    </div>
                    <div className="text-zinc-300 font-medium text-xs">
                      No vector chunks indexed for Page {currentPage}.
                    </div>
                    <p className="text-[11px] text-zinc-500 max-w-sm mx-auto font-sans">
                      Verify that the document has completed processing in the ingestion pipeline.
                    </p>
                  </div>
                )}
              </div>

              {/* Canvas Footer */}
              <div className="pt-2.5 border-t border-zinc-800/80 mt-3 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span className="truncate max-w-[260px]">
                  {document?.checksum_sha256 ? `SHA-256: ${document.checksum_sha256.slice(0, 16)}...` : 'Local Store'}
                </span>
                <span>pgvector index</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Evidence Information */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 sm:p-5 bg-[#121215] border border-zinc-800/80 rounded-lg shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div>
                <h4 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono flex items-center gap-2">
                  <DocumentIcon size={14} className="text-blue-500" />
                  <span>Grounding Evidence</span>
                </h4>
                <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                  Exact passage retrieved for question context
                </p>
              </div>
              <Badge variant="success" size="sm">
                VERIFIED
              </Badge>
            </div>

            {hasEvidence && evidence ? (
              <div className="space-y-3.5">
                <div className="p-3 bg-[#18181b] rounded-md border border-zinc-800 space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 text-[10px] block uppercase">Document</span>
                    <span className="text-zinc-200 font-medium truncate block mt-0.5" title={evidence.document_title || docFilename}>
                      {evidence.document_title || docFilename}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500 text-[10px] block uppercase">Page</span>
                      <span className="text-zinc-200 font-medium text-xs">
                        {evidence.page_number !== undefined ? evidence.page_number : currentPage}
                      </span>
                    </div>

                    {relevancePct !== null && (
                      <div>
                        <span className="text-zinc-500 text-[10px] block uppercase">Similarity</span>
                        <span className="text-emerald-400 font-medium text-xs flex items-center gap-1">
                          <SparklesIcon size={10} />
                          {relevancePct}% Match
                        </span>
                      </div>
                    )}
                  </div>

                  {evidence.chunk_id && (
                    <div className="pt-2 border-t border-zinc-800/80">
                      <span className="text-zinc-500 text-[10px] block uppercase">Chunk Identifier</span>
                      <span className="text-zinc-400 text-[10px] truncate block font-mono">
                        {evidence.chunk_id}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-medium flex items-center justify-between">
                    <span>Retrieved Passage:</span>
                  </div>

                  <div className="p-3 bg-[#18181b] rounded-md border border-zinc-800 text-xs text-zinc-200 leading-relaxed font-serif whitespace-pre-wrap select-text italic">
                    "{evidence.snippet}"
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-[#18181b] rounded-md border border-zinc-800 text-center space-y-2 font-mono">
                <AlertTriangleIcon size={18} className="text-amber-400 mx-auto" />
                <div className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                  NO EVIDENCE AVAILABLE
                </div>
                <p className="text-xs text-zinc-400 font-sans">
                  This response does not contain retrievable evidence.
                </p>
              </div>
            )}

            {/* Actions: [← Back to Query] and [Open Document] */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-2">
              {onBackToChat && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center text-xs"
                  onClick={onBackToChat}
                  leftIcon={<ArrowLeftIcon size={13} />}
                >
                  Back to Query
                </Button>
              )}

              {onBackToDocument && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center text-xs"
                  onClick={onBackToDocument}
                  leftIcon={<ExternalLinkIcon size={12} />}
                >
                  Open Document
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
