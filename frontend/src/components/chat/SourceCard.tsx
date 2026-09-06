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
    <div className="bg-[#18181b] border border-zinc-800/80 hover:border-zinc-700/80 rounded-md p-3 space-y-2 transition-colors shadow-sm">
      {/* Evidence Tag Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800/60 pb-2">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="text-[10px] font-mono text-blue-400 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
            Source {evidenceNumber}
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-xs font-medium text-zinc-200 truncate" title={documentName}>
            {documentName}
          </span>
        </div>

        {hasRelevance && (
          <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <SparklesIcon size={10} className="text-emerald-400" />
            {relevancePct}% Match
          </span>
        )}
      </div>

      {/* Page & Document Reference */}
      <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-400">
        <DocumentIcon size={12} className="text-blue-400 shrink-0" />
        {hasPage && (
          <span className="text-zinc-300 font-medium">
            Page {source.page_number}
          </span>
        )}
        {source.chunk_id && (
          <>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500 truncate max-w-[140px]">{source.chunk_id}</span>
          </>
        )}
      </div>

      {/* Snippet Quotation Block */}
      {hasSnippet && (
        <div className="bg-[#121215] rounded border border-zinc-800/80 p-2.5 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap select-text font-serif italic">
          "{source.snippet}"
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-zinc-500">
        <span className="text-zinc-500">
          Grounded text segment
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewEvidence?.(source)}
          leftIcon={<ExternalLinkIcon size={11} />}
          className="text-[11px] py-0.5 px-2 h-6"
        >
          View Passage
        </Button>
      </div>
    </div>
  );
};
