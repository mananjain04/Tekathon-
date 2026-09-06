import React, { useRef, useEffect } from 'react';
import { SendIcon, PaperclipIcon, AlertCircleIcon } from '../icons';
import { Button } from '../common/Button';

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
  placeholder?: string;
  selectedDocName?: string;
  onAttachClick?: () => void;
  error?: string | null;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  isProcessing,
  placeholder,
  selectedDocName,
  onAttachClick,
  error,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim() && !isProcessing) {
        onSubmit();
      }
    }
  };

  const defaultPlaceholder = selectedDocName
    ? `Query regarding "${selectedDocName}"...`
    : 'Ask a question across indexed documents...';

  return (
    <div className="bg-white/70 border-t border-zinc-200/80 p-3.5 space-y-2 shrink-0 backdrop-blur-md">
      {/* Optional Error Banner */}
      {error && (
        <div className="flex items-center space-x-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg font-mono">
          <AlertCircleIcon size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Target Document Context Tag */}
      {selectedDocName && (
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600 px-1">
          <span className="flex items-center gap-1.5 truncate">
            <span className="text-zinc-950 font-bold">Context:</span>
            <span className="text-zinc-800 font-medium truncate">{selectedDocName}</span>
          </span>
          <span className="text-zinc-400 shrink-0 text-[10px]">Enter to send · Shift+Enter for newline</span>
        </div>
      )}

      {/* Input Form Box */}
      <div className="relative flex items-end gap-2 bg-white/90 border border-zinc-300 focus-within:border-zinc-950 focus-within:ring-2 focus-within:ring-zinc-950/10 rounded-xl p-2.5 transition-all shadow-sm">
        {onAttachClick && (
          <button
            type="button"
            onClick={onAttachClick}
            title="Attach or filter document"
            disabled={isProcessing}
            className="p-1.5 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-40"
          >
            <PaperclipIcon size={15} />
          </button>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          placeholder={placeholder || defaultPlaceholder}
          className="flex-1 bg-transparent border-none text-xs sm:text-sm text-zinc-950 placeholder-zinc-400 focus:outline-none resize-none py-1.5 max-h-36 leading-relaxed disabled:opacity-50 font-sans"
        />

        <div className="flex items-center space-x-1.5 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={!value.trim() || isProcessing}
            leftIcon={<SendIcon size={13} />}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
