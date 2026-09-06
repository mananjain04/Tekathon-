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
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/80 transition-colors cursor-pointer shadow-sm group ${className}`}
      title={`Open source passage for ${docName}`}
    >
      <DocumentIcon size={11} className="text-blue-400 shrink-0" />
      <span className="truncate max-w-[200px] font-medium">{label}</span>
    </button>
  );
};
