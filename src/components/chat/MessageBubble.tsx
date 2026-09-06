import React from 'react';
import { ChatMessage, DocumentCitation, Source } from '../../types';
import { ShieldIcon, UserIcon, AlertTriangleIcon, DocumentIcon } from '../icons';
import { SourceCard } from './SourceCard';
import { CitationBadge } from './CitationBadge';

interface MessageBubbleProps {
  message: ChatMessage;
  onViewEvidence?: (citation: DocumentCitation | Source, allCitations?: (DocumentCitation | Source)[]) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onViewEvidence }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const hasCitations = isAssistant && Array.isArray(message.citations) && message.citations.length > 0;

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1 w-full`}>
      {/* Sender Header */}
      <div className="flex items-center space-x-2 px-1 text-[10px] font-mono text-zinc-400 select-none">
        {isUser ? (
          <>
            <span className="text-zinc-300 font-medium flex items-center gap-1">
              <UserIcon size={12} className="text-zinc-400" />
              You
            </span>
            <span>·</span>
            <span className="text-zinc-500">{message.timestamp}</span>
          </>
        ) : isAssistant ? (
          <>
            <span className="text-zinc-200 font-semibold flex items-center gap-1">
              <ShieldIcon size={12} className="text-blue-500" />
              Kavach
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
              Grounded
            </span>
            <span>·</span>
            <span className="text-zinc-500">{message.timestamp}</span>
          </>
        ) : (
          <span className="text-rose-400 font-medium flex items-center gap-1">
            <AlertTriangleIcon size={12} />
            System Notice
          </span>
        )}
      </div>

      {/* Bubble Container */}
      <div
        className={`max-w-3xl rounded-lg p-4 text-xs leading-relaxed space-y-3.5 ${
          isUser
            ? 'bg-[#18181b] border border-zinc-700/80 text-zinc-100 shadow-sm'
            : isAssistant
            ? 'bg-[#121215] border border-zinc-800/80 text-zinc-200 shadow-sm'
            : 'bg-rose-950/20 border border-rose-800/40 text-rose-200'
        }`}
      >
        {/* Main Text Content */}
        <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-200">
          {message.content}
        </div>

        {/* Inline Citation Badges Strip */}
        {hasCitations && message.citations && (
          <div className="pt-2.5 border-t border-zinc-800/80 space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <DocumentIcon size={11} className="text-blue-400" />
              <span>Cited Documents:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((cit, idx) => (
                <CitationBadge
                  key={idx}
                  citation={cit}
                  onClick={(c) => onViewEvidence?.(c, message.citations)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Evidence Sources Section */}
        {hasCitations && message.citations ? (
          <div className="pt-3 border-t border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-300 font-medium flex items-center gap-1.5">
                <DocumentIcon size={12} className="text-blue-400" />
                <span>Sources & Grounding ({message.citations.length})</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                Verified pgvector chunks
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {message.citations.map((source, idx) => (
                <SourceCard
                  key={idx}
                  source={source}
                  index={idx}
                  onViewEvidence={(s) => onViewEvidence?.(s, message.citations)}
                />
              ))}
            </div>
          </div>
        ) : isAssistant ? (
          <div className="pt-2.5 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500 italic">
            No source evidence returned.
          </div>
        ) : null}
      </div>
    </div>
  );
};
