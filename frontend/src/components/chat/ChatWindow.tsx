import React, { useRef, useEffect } from 'react';
import { ChatMessage, DocumentCitation, Source, SelectedDocument, RagProcessingStage } from '../../types';
import { MessageBubble } from './MessageBubble';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatLoadingState } from './ChatLoadingState';
import { RefreshIcon, ChatIcon } from '../icons';
import { Button } from '../common/Button';

interface ChatWindowProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  processingStage?: RagProcessingStage;
  selectedDocument: SelectedDocument | null;
  onSelectSuggestion: (prompt: string) => void;
  onViewEvidence: (citation: DocumentCitation | Source, allCitations?: (DocumentCitation | Source)[]) => void;
  onClearSession: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isProcessing,
  processingStage,
  selectedDocument,
  onSelectSuggestion,
  onViewEvidence,
  onClearSession,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing, processingStage]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      {/* Top Session Sub-Header */}
      <div className="bg-white/60 border-b border-zinc-200/80 px-5 py-2.5 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center space-x-2.5">
          <div className="p-1 rounded bg-zinc-100 text-zinc-900 border border-zinc-200">
            <ChatIcon size={14} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-zinc-900">Session Dialogue</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              {selectedDocument
                ? `Target: ${selectedDocument.title}`
                : 'Target: All Repository Documents'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshIcon size={12} />}
              onClick={onClearSession}
              title="Clear dialogue"
              className="text-xs text-zinc-600 hover:text-zinc-950 hover:bg-white/80"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages Scroll Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.length === 0 ? (
          <ChatEmptyState
            selectedDocument={selectedDocument}
            onSelectSuggestion={onSelectSuggestion}
          />
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onViewEvidence={onViewEvidence}
            />
          ))
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="pt-2">
            <ChatLoadingState currentStage={processingStage} />
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>
    </div>
  );
};
