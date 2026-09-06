import React from 'react';
import { SelectedDocument } from '../../types';
import { ShieldIcon, DocumentIcon, SparklesIcon } from '../icons';
import { SUGGESTED_QUESTIONS } from '../../mock/chatMock';

interface ChatEmptyStateProps {
  selectedDocument: SelectedDocument | null;
  onSelectSuggestion: (question: string) => void;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  selectedDocument,
  onSelectSuggestion,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-6 my-auto">
      {/* Icon Badge */}
      <div className="w-14 h-14 rounded-2xl bg-white/80 border border-white/90 shadow-md flex items-center justify-center text-zinc-950 backdrop-blur-md">
        <ShieldIcon size={26} />
      </div>

      {/* Title & Description */}
      <div className="space-y-1.5">
        <h2 className="text-xl font-black text-zinc-950 tracking-tight uppercase font-mono">
          DOCUMENT INTELLIGENCE
        </h2>
        <p className="text-xs text-zinc-600 leading-relaxed max-w-md font-medium">
          Ask questions against indexed documents. Answers are grounded in local vector chunks with exact cryptographic and citation verification.
        </p>
      </div>

      {/* Selected Document or Empty Guidance */}
      {!selectedDocument ? (
        <div className="w-full p-6 rounded-2xl bg-white/70 border border-white/90 space-y-2 text-center font-mono shadow-sm backdrop-blur-md">
          <div className="text-xs font-bold tracking-wider text-zinc-700 uppercase">
            REPOSITORY WIDE RETRIEVAL
          </div>
          <p className="text-xs text-zinc-500 font-sans">
            You can query across all indexed documents or select a specific document in the left panel.
          </p>
        </div>
      ) : (
        <>
          {/* Selected Document Indicator */}
          <div className="w-full p-3 rounded-xl bg-white/75 border border-white/90 flex items-center justify-between text-xs font-mono shadow-sm backdrop-blur-md">
            <div className="flex items-center space-x-2 truncate">
              <DocumentIcon size={14} className="text-zinc-900 shrink-0" />
              <span className="text-zinc-500">Target:</span>
              <span className="text-zinc-950 font-bold truncate">
                {selectedDocument.filename || selectedDocument.title}
              </span>
            </div>
            <span className="status-pill-online text-[10px] shrink-0">
              INDEXED
            </span>
          </div>

          {/* Suggested Questions Grid */}
          <div className="w-full space-y-2.5 text-left">
            <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <SparklesIcon size={12} className="text-zinc-900" />
              <span>Suggested Queries</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSuggestion(q)}
                  className="p-3.5 text-left rounded-xl kavach-glass-card hover:bg-white/90 border border-white/90 text-xs text-zinc-900 transition-all group flex flex-col justify-between shadow-sm hover:shadow-md"
                >
                  <span className="leading-snug font-medium">{q}</span>
                  <span className="text-[10px] text-zinc-400 font-mono mt-2 group-hover:text-zinc-950 flex items-center gap-1">
                    Insert query →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
