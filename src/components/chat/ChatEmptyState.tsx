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
      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-sm">
        <ShieldIcon size={24} />
      </div>

      {/* Title & Description */}
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
          Document Intelligence Assistant
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed max-w-md">
          Ask questions against indexed documents. Answers are grounded in local vector chunks with exact source citations.
        </p>
      </div>

      {/* Selected Document or Empty Guidance */}
      {!selectedDocument ? (
        <div className="w-full p-6 rounded-lg bg-[#121215] border border-zinc-800 space-y-2 text-center font-mono">
          <div className="text-xs font-bold tracking-wider text-amber-400 uppercase">
            NO ACTIVE DOCUMENT
          </div>
          <p className="text-xs text-zinc-400 font-sans">
            Select a processed document to begin querying.
          </p>
        </div>
      ) : (
        <>
          {/* Selected Document Indicator */}
          <div className="w-full p-2.5 rounded-lg bg-[#121215] border border-zinc-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 truncate">
              <DocumentIcon size={14} className="text-blue-400 shrink-0" />
              <span className="text-zinc-500">Scoped to:</span>
              <span className="text-zinc-200 font-medium truncate">
                {selectedDocument.filename || selectedDocument.title}
              </span>
            </div>
            <span className="text-emerald-400 text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              INDEXED
            </span>
          </div>

          {/* Suggested Questions Grid */}
          <div className="w-full space-y-2.5 text-left">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
              <SparklesIcon size={12} className="text-blue-400" />
              <span>Suggested Queries</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSuggestion(q)}
                  className="p-3 text-left rounded-lg bg-[#121215] hover:bg-[#18181b] border border-zinc-800/80 hover:border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100 transition-colors group flex flex-col justify-between"
                >
                  <span className="leading-snug">{q}</span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-2 group-hover:text-blue-400 flex items-center gap-1">
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
