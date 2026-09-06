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
    <div className={`space-y-4 ${className} text-zinc-900`}>
      {/* 1. Clean Navigation Bar */}
      <div className="kavach-glass-panel border border-white/85 px-5 py-2.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs font-mono shadow-sm">
        <div className="flex items-center space-x-2 text-zinc-600 overflow-x-auto py-0.5">
          <span className="text-zinc-500">Query Assistant</span>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-950 font-bold truncate max-w-[200px]" title={docFilename}>
            {docFilename}
          </span>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-900 font-bold">
            Page {currentPage}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="status-pill-local text-[10px]">
            Source Passage
          </span>
          <span className="status-pill-online text-[10px]">
            Grounded Chunk
          </span>
        </div>
      </div>

      {/* 2. Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 kavach-glass-panel border border-white/85 px-5 py-2.5 rounded-xl text-xs font-mono shadow-sm">
        <div className="flex items-center space-x-3">
          {/* Navigation Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handlePrev}
              disabled={currentPage <= 1}
              className="inline-flex items-center space-x-1 px-3 py-1 bg-white/80 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-zinc-900 transition-all border border-zinc-200 shadow-sm font-semibold"
              title="Previous Page"
            >
              <ChevronLeftIcon size={14} />
              <span>Previous</span>
            </button>

            <span className="px-3.5 py-1 bg-white/60 rounded-lg border border-zinc-200 text-zinc-700">
              Page <strong className="text-zinc-950 font-bold">{currentPage}</strong>
              {totalPages !== undefined && (
                <span> of <strong className="text-zinc-600">{totalPages}</strong></span>
              )}
            </span>

            <button
              onClick={handleNext}
              disabled={totalPages !== undefined ? currentPage >= totalPages : false}
              className="inline-flex items-center space-x-1 px-3 py-1 bg-white/80 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-zinc-900 transition-all border border-zinc-200 shadow-sm font-semibold"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRightIcon size={14} />
            </button>
          </div>

          <span className="text-zinc-300">|</span>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
              disabled={zoomLevel <= 75}
              className="p-1.5 bg-white/80 hover:bg-white disabled:opacity-40 rounded-lg text-zinc-700 transition-colors border border-zinc-200 shadow-sm"
              title="Zoom Out"
            >
              <ZoomOutIcon size={13} />
            </button>
            <span className="text-zinc-700 text-[10px] w-8 text-center font-bold">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              disabled={zoomLevel >= 150}
              className="p-1.5 bg-white/80 hover:bg-white disabled:opacity-40 rounded-lg text-zinc-700 transition-colors border border-zinc-200 shadow-sm"
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
            className="text-xs py-1.5"
          >
            Back to Assistant
          </Button>
        )}
      </div>

      {/* 3. Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Document Canvas */}
        <div className="lg:col-span-7 space-y-3">
          <div className="overflow-auto rounded-2xl border border-white/85 kavach-glass-panel p-4 shadow-xl min-h-[500px]">
            <div
              className="relative p-4 flex flex-col justify-between overflow-hidden transition-all duration-150"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
            >
              {/* Document Header */}
              <div className="border-b border-zinc-200/80 pb-3 mb-3">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
                  <span className="flex items-center gap-1.5 text-zinc-700 font-bold">
                    <DocumentIcon size={13} />
                    <span>Document Content</span>
                  </span>
                  {document?.classification && (
                    <Badge variant="default" size="sm">
                      {document.classification}
                    </Badge>
                  )}
                </div>
                <h3 className="text-base font-black text-zinc-950 truncate font-mono" title={docTitle}>
                  {docFilename}
                </h3>
                <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-500 mt-0.5">
                  <span className="text-zinc-950 font-bold">Page {currentPage}</span>
                  {totalPages !== undefined && (
                    <span className="text-zinc-500">of {totalPages} pages</span>
                  )}
                </div>
              </div>

              {/* Document Text Content */}
              <div className="space-y-3 text-xs font-mono text-zinc-800 leading-relaxed overflow-y-auto max-h-[420px] pr-2">
                {pageChunks.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-lg bg-white/70 border border-zinc-200/80 text-zinc-600 text-[10px] flex items-center justify-between font-semibold">
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
                          className={`p-4 rounded-xl border transition-all leading-relaxed font-mono text-xs whitespace-pre-wrap select-text ${
                            isDirectMatch
                              ? 'bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-400/20 shadow-sm'
                              : 'bg-white/85 border-zinc-200/80 text-zinc-900 shadow-sm'
                          }`}
                        >
                          {isDirectMatch && (
                            <div className="text-[10px] font-mono text-amber-800 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
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
                    <div className="p-2.5 bg-white/80 rounded-full w-10 h-10 flex items-center justify-center mx-auto text-zinc-500 border border-zinc-200">
                      <FileTextIcon size={18} />
                    </div>
                    <div className="text-zinc-900 font-bold text-xs">
                      No vector chunks indexed for Page {currentPage}.
                    </div>
                    <p className="text-[11px] text-zinc-500 max-w-sm mx-auto font-sans">
                      Verify that the document has completed processing in the ingestion pipeline.
                    </p>
                  </div>
                )}
              </div>

              {/* Canvas Footer */}
              <div className="pt-2.5 border-t border-zinc-200/80 mt-3 flex items-center justify-between text-[10px] font-mono text-zinc-500">
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
          <div className="p-5 kavach-glass-panel border border-white/85 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
              <div>
                <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider font-mono flex items-center gap-2">
                  <DocumentIcon size={14} className="text-zinc-900" />
                  <span>Grounding Evidence</span>
                </h4>
                <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                  Exact passage retrieved for question context
                </p>
              </div>
              <span className="status-pill-online text-[10px]">
                VERIFIED
              </span>
            </div>

            {hasEvidence && evidence ? (
              <div className="space-y-3.5">
                <div className="p-3.5 bg-white/80 rounded-xl border border-white/90 shadow-sm space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 text-[10px] block uppercase font-semibold">Document</span>
                    <span className="text-zinc-950 font-bold truncate block mt-0.5" title={evidence.document_title || docFilename}>
                      {evidence.document_title || docFilename}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200/70">
                    <div>
                      <span className="text-zinc-500 text-[10px] block uppercase font-semibold">Page</span>
                      <span className="text-zinc-950 font-bold text-xs">
                        {evidence.page_number !== undefined ? evidence.page_number : currentPage}
                      </span>
                    </div>

                    {relevancePct !== null && (
                      <div>
                        <span className="text-zinc-500 text-[10px] block uppercase font-semibold">Similarity</span>
                        <span className="status-pill-online text-xs flex items-center gap-1 font-bold">
                          <SparklesIcon size={10} />
                          {relevancePct}% Match
                        </span>
                      </div>
                    )}
                  </div>

                  {evidence.chunk_id && (
                    <div className="pt-2 border-t border-zinc-200/70">
                      <span className="text-zinc-500 text-[10px] block uppercase font-semibold">Chunk Identifier</span>
                      <span className="text-zinc-600 text-[10px] truncate block font-mono">
                        {evidence.chunk_id}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 font-bold flex items-center justify-between">
                    <span>Retrieved Passage:</span>
                  </div>

                  <div className="p-3.5 bg-white/90 rounded-xl border border-zinc-200/80 text-xs text-zinc-900 leading-relaxed font-serif whitespace-pre-wrap select-text italic shadow-inner">
                    "{evidence.snippet}"
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-white/70 rounded-xl border border-zinc-200/80 text-center space-y-2 font-mono">
                <AlertTriangleIcon size={18} className="text-amber-500 mx-auto" />
                <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  NO EVIDENCE AVAILABLE
                </div>
                <p className="text-xs text-zinc-500 font-sans">
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
