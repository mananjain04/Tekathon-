import React from 'react';
import { DocumentCitation, Citation, Source } from '../../types';
import { DocumentIcon } from '../icons';

interface CitationBadgeProps {
  citation: DocumentCitation | Citation | Source;
  onClick?: (citation: DocumentCitation | Citation | Source) => void;
  className?: string;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  citation,
  onClick,
  className = '',
}) => {
  const docName = citation.document_title || citation.document_id || 'Document';
  const label = `${docName}${
    citation.page_number !== undefined && citation.page_number !== null
      ? ` · P.${citation.page_number}`
      : ''
  }`;

  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-white/90 hover:bg-white text-zinc-950 border border-zinc-300 hover:border-zinc-500 transition-all cursor-pointer shadow-sm group font-semibold ${className}`}
      title={`Open source passage for ${docName}`}
    >
      <DocumentIcon size={11} className="text-zinc-800 shrink-0" />
      <span className="truncate max-w-[200px]">{label}</span>
    </button>
  );
};
