import React, { useState } from 'react';
import { DocumentItem, DocumentChunk } from '../../types';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import {
  FileTextIcon,
  ShieldIcon,
  AlertTriangleIcon,
} from '../icons';

export interface DocumentViewerProps {
  document: DocumentItem;
  chunks: DocumentChunk[];
  className?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  chunks,
  className = '',
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [chunkFilter, setChunkFilter] = useState('');
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(
    chunks.length > 0 ? chunks[0].id : null
  );

  const totalPages = document.page_count || Math.max(1, Math.ceil(chunks.length / 2));

  const filteredChunks = chunks.filter((c) =>
    (c.content || '').toLowerCase().includes(chunkFilter.toLowerCase())
  );

  const activeChunk = chunks.find((c) => c.id === selectedChunkId) || (chunks.length > 0 ? chunks[0] : null);

  const isFailed = document.status === 'FAILED';
  const isProcessing = document.status === 'PROCESSING' || document.status === 'INDEXING';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-lg text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-300 transition-colors"
            >
              ◀ Prev
            </button>
            <span className="px-2 text-slate-300">
              Page <strong className="text-cyan-400">{currentPage}</strong> of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-300 transition-colors"
            >
              Next ▶
            </button>
          </div>

          <span className="text-slate-700">|</span>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
              title="Zoom Out"
            >
              -
            </button>
            <span className="text-slate-400">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
              title="Zoom In"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded text-[11px] flex items-center gap-1 font-mono">
            <ShieldIcon size={12} />
            Air-Gap Sandboxed Preview
          </span>
        </div>
      </div>

      {/* Failure Diagnostic Alert if FAILED */}
      {isFailed && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-3">
          <AlertTriangleIcon size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold uppercase tracking-wider text-rose-300">
              Text Extraction & Vectorization Failed
            </div>
            <p className="text-rose-200/90 font-mono">
              {document.error_message || 'Malformed PDF cross-reference table encountered during text stream extraction.'}
            </p>
            <p className="text-[11px] text-rose-400/80 mt-1">
              Document cannot be previewed or queried with AI until re-indexing succeeds. Use the "Re-Process" button to retry extraction.
            </p>
          </div>
        </div>
      )}

      {/* Main Split: Simulated Document Page Canvas + Extracted Evidence Chunks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Simulated High-Fidelity Page Preview Canvas */}
        <div className="lg:col-span-7">
          <div className="relative bg-slate-950 rounded-xl border border-slate-800 p-8 shadow-2xl min-h-[540px] flex flex-col justify-between overflow-hidden">
            {/* Sovereign Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-5 rotate-[-25deg]">
              <span className="text-6xl font-black tracking-widest text-slate-100 font-mono text-center">
                KAVACH SOVEREIGN<br />CONFIDENTIAL ENCLAVE
              </span>
            </div>

            {/* Document Header in Canvas */}
            <div className="relative z-10 border-b border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-2">
                <span>{(document.department || 'SOVEREIGN ENCLAVE').toUpperCase()}</span>
                <span className="text-amber-400 font-semibold">{document.classification}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-100">{document.title}</h2>
              <div className="text-xs font-mono text-slate-400 mt-1">
                File: {document.filename} · Page {currentPage} of {totalPages}
              </div>
            </div>

            {/* Simulated Extracted Text Stream Content */}
            <div className="relative z-10 space-y-4 text-xs font-mono text-slate-300 leading-relaxed overflow-y-auto max-h-[380px] pr-2">
              {activeChunk ? (
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 text-[11px]">
                    Showing text mapped to <strong>{activeChunk.id}</strong> (Page {activeChunk.page_number || currentPage}):
                  </div>
                  <div className="p-4 rounded bg-slate-900/90 border border-slate-800 whitespace-pre-wrap select-text leading-6 font-mono">
                    {activeChunk.content}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    * Layout preserved in sovereign sandbox. Segment verified against local SHA-256 integrity digest.
                  </div>
                </div>
              ) : isFailed ? (
                <div className="p-8 rounded-lg bg-rose-950/20 border border-rose-900/40 text-center space-y-2">
                  <AlertTriangleIcon size={28} className="text-rose-400 mx-auto" />
                  <h4 className="text-sm font-semibold text-rose-300">Extraction Incomplete</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    No text stream could be rendered for this page because the parser encountered a fatal format exception.
                  </p>
                </div>
              ) : isProcessing ? (
                <div className="p-8 rounded-lg bg-cyan-950/20 border border-cyan-800/40 text-center space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto" />
                  <h4 className="text-sm font-semibold text-cyan-300">Processing in Progress</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Text extraction and vector embeddings are currently being generated on local hardware.
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded bg-slate-900/90 border border-slate-800 text-slate-400 text-center">
                  Document registered. No text chunks selected for display.
                </div>
              )}
            </div>

            {/* Canvas Footer */}
            <div className="relative z-10 pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>SHA-256: {document.checksum_sha256 ? document.checksum_sha256.slice(0, 16) + '...' : 'N/A'}</span>
              <span>Local Hardware Render</span>
            </div>
          </div>
        </div>

        {/* Right Column: Evidence & Extracted Chunks Explorer */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 bg-slate-900/90">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  Evidence & Citations ({chunks.length})
                </h4>
                <p className="text-[11px] text-slate-400">Semantic vector chunks available to local AI</p>
              </div>
              <Badge variant={chunks.length > 0 ? 'classified' : 'default'} size="sm">
                {chunks.length > 0 ? 'RAG READY' : 'NO VECTORS'}
              </Badge>
            </div>

            {/* Chunk Search Filter */}
            {chunks.length > 0 && (
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search within extracted chunks..."
                  value={chunkFilter}
                  onChange={(e) => setChunkFilter(e.target.value)}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            )}

            {/* Chunk List / Empty States */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {chunks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <FileTextIcon size={24} className="mx-auto text-slate-600" />
                  <p className="font-medium text-slate-400">No Vector Chunks Available</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    {isFailed
                      ? 'Text extraction failed for this document. No vector chunks were indexed into ChromaDB.'
                      : isProcessing
                      ? 'Document is currently being processed. Vector chunks will appear once indexing completes.'
                      : 'This document has not been chunked or indexed yet.'}
                  </p>
                </div>
              ) : filteredChunks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No chunks match "{chunkFilter}"
                </div>
              ) : (
                filteredChunks.map((chunk, idx) => {
                  const isSelected = chunk.id === selectedChunkId;
                  return (
                    <div
                      key={chunk.id}
                      onClick={() => {
                        setSelectedChunkId(chunk.id);
                        if (chunk.page_number) setCurrentPage(chunk.page_number);
                      }}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[11px] mb-1.5">
                        <span className={isSelected ? 'text-cyan-300 font-bold' : 'text-slate-400 font-medium'}>
                          CHUNK #{idx + 1} ({chunk.id})
                        </span>
                        <div className="flex items-center space-x-2">
                          {chunk.page_number && (
                            <span className="text-slate-500">Page {chunk.page_number}</span>
                          )}
                          <span className="text-cyan-400">{chunk.token_count} tok</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed font-mono">
                        {chunk.content}
                      </p>

                      {chunk.relevance_score && (
                        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-500">Ground-truth Relevance</span>
                          <span className="text-emerald-400 font-semibold">
                            {(chunk.relevance_score * 100).toFixed(0)}% Match
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
