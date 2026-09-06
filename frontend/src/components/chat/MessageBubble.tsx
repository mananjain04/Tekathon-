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
      <div className="flex items-center space-x-2 px-1 text-[10px] font-mono text-zinc-500 select-none font-medium">
        {isUser ? (
          <>
            <span className="text-zinc-900 font-bold flex items-center gap-1">
              <UserIcon size={12} className="text-zinc-700" />
              You
            </span>
            <span>·</span>
            <span className="text-zinc-400">{message.timestamp}</span>
          </>
        ) : isAssistant ? (
          <>
            <span className="text-zinc-950 font-black flex items-center gap-1">
              <ShieldIcon size={12} className="text-zinc-950" />
              KAVACH
            </span>
            <span className="status-pill-online text-[9px] py-0 px-2">
              GROUNDED
            </span>
            <span>·</span>
            <span className="text-zinc-400">{message.timestamp}</span>
          </>
        ) : (
          <span className="text-rose-600 font-bold flex items-center gap-1">
            <AlertTriangleIcon size={12} />
            System Notice
          </span>
        )}
      </div>

      {/* Bubble Container */}
      <div
        className={`max-w-3xl rounded-xl p-4 sm:p-5 text-xs leading-relaxed space-y-3.5 shadow-sm ${
          isUser
            ? 'bg-zinc-950 text-white shadow-md'
            : isAssistant
            ? 'kavach-glass-card text-zinc-900 border-white/95 shadow-md'
            : 'bg-rose-50 border border-rose-200 text-rose-900'
        }`}
      >
        {/* Main Text Content */}
        <div className={`whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed ${isUser ? 'text-zinc-100' : 'text-zinc-900'}`}>
          {message.content}
        </div>

        {/* Inline Citation Badges Strip */}
        {hasCitations && message.citations && (
          <div className={`pt-2.5 border-t space-y-1.5 ${isUser ? 'border-zinc-800' : 'border-zinc-200/80'}`}>
            <div className={`text-[10px] font-mono uppercase tracking-wider font-bold flex items-center gap-1 ${isUser ? 'text-zinc-400' : 'text-zinc-600'}`}>
              <DocumentIcon size={11} className={isUser ? 'text-zinc-300' : 'text-zinc-800'} />
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
          <div className={`pt-3 border-t space-y-2.5 ${isUser ? 'border-zinc-800' : 'border-zinc-200/80'}`}>
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-800 font-bold flex items-center gap-1.5">
                <DocumentIcon size={12} className="text-zinc-700" />
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
          <div className="pt-2.5 border-t border-zinc-200/70 text-[11px] font-mono text-zinc-400 italic">
            No source evidence returned.
          </div>
        ) : null}
      </div>
    </div>
  );
};
