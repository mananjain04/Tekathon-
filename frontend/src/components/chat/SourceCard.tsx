import React from 'react';
import { DocumentCitation, Source } from '../../types';
import { DocumentIcon, SparklesIcon, ExternalLinkIcon } from '../icons';
import { Button } from '../common/Button';

interface SourceCardProps {
  source: DocumentCitation | Source;
  index?: number;
  onViewEvidence?: (source: DocumentCitation | Source) => void;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source, index, onViewEvidence }) => {
  const documentName = source.document_title || source.document_id || 'Ingested Document';
  const hasPage = source.page_number !== undefined && source.page_number !== null;
  const hasRelevance = source.relevance_score !== undefined && source.relevance_score !== null;
  const relevancePct = hasRelevance ? Math.round((source.relevance_score || 0) * 100) : null;
  const hasSnippet = Boolean(source.snippet && source.snippet.trim().length > 0);
  const evidenceNumber = index !== undefined ? String(index + 1).padStart(2, '0') : '01';

  return (
    <div className="bg-white/85 border border-white/90 hover:border-zinc-300 rounded-xl p-3.5 space-y-2.5 transition-all shadow-sm">
      {/* Evidence Tag Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-200/70 pb-2">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="text-[10px] font-mono text-zinc-900 font-bold bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200 shrink-0">
            Source {evidenceNumber}
          </span>
          <span className="text-zinc-400">·</span>
          <span className="text-xs font-bold text-zinc-950 truncate" title={documentName}>
            {documentName}
          </span>
        </div>

        {hasRelevance && (
          <span className="status-pill-online text-[10px] shrink-0">
            <SparklesIcon size={10} />
            {relevancePct}% Match
          </span>
        )}
      </div>

      {/* Page & Document Reference */}
      <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-500">
        <DocumentIcon size={12} className="text-zinc-700 shrink-0" />
        {hasPage && (
          <span className="text-zinc-800 font-semibold">
            Page {source.page_number}
          </span>
        )}
        {source.chunk_id && (
          <>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-500 truncate max-w-[140px]">{source.chunk_id}</span>
          </>
        )}
      </div>

      {/* Snippet Quotation Block */}
      {hasSnippet && (
        <div className="bg-white/90 rounded-lg border border-zinc-200/80 p-3 text-xs text-zinc-800 leading-relaxed whitespace-pre-wrap select-text font-serif italic shadow-inner">
          "{source.snippet}"
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-zinc-500">
        <span>
          Grounded text segment
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewEvidence?.(source)}
          leftIcon={<ExternalLinkIcon size={11} />}
          className="text-[11px] py-0.5 px-2.5 h-6 bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-900 font-medium"
        >
          View Passage
        </Button>
      </div>
    </div>
  );
};
