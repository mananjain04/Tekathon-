import React from 'react';
import { Conversation } from '../../types';
import { ChatIcon, PlusIcon, TrashIcon, ClockIcon } from '../icons';
import { Button } from '../common/Button';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (conv: Conversation) => void;
  onNewConversation: () => void;
  onDeleteConversation?: (id: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) => {
  const getCategory = (isoString: string): 'Today' | 'Yesterday' | 'Previous 7 Days' => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0 && now.getDate() === date.getDate()) return 'Today';
    if (diffDays <= 1) return 'Yesterday';
    return 'Previous 7 Days';
  };

  const categories: ('Today' | 'Yesterday' | 'Previous 7 Days')[] = [
    'Today',
    'Yesterday',
    'Previous 7 Days',
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden space-y-3">
      {/* New Conversation Button */}
      <Button
        variant="primary"
        size="sm"
        leftIcon={<PlusIcon size={14} />}
        onClick={onNewConversation}
        className="w-full justify-center tracking-wide font-medium text-xs shadow-sm"
      >
        New Session
      </Button>

      {/* Conversations scroll area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 px-1 font-semibold">
          <ClockIcon size={12} className="text-zinc-500" />
          <span>Recent Sessions</span>
        </div>

        {categories.map((cat) => {
          const matching = conversations.filter(
            (c) => c.category === cat || getCategory(c.updated_at || c.created_at) === cat
          );

          if (matching.length === 0) return null;

          return (
            <div key={cat} className="space-y-1">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider px-2 py-0.5">
                {cat}
              </div>
              <div className="space-y-1">
                {matching.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => onSelectConversation(conv)}
                      className={`group relative flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all border ${
                        isActive
                          ? 'bg-white/90 border-white text-zinc-950 shadow-sm font-semibold'
                          : 'bg-transparent border-transparent hover:bg-white/60 text-zinc-700 hover:text-zinc-950'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <ChatIcon
                          size={13}
                          className={`shrink-0 ${isActive ? 'text-zinc-950' : 'text-zinc-400 group-hover:text-zinc-700'}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate leading-snug">
                            {conv.title}
                          </p>
                          {conv.document_title && (
                            <p className="text-[10px] text-zinc-400 truncate font-mono">
                              {conv.document_title}
                            </p>
                          )}
                        </div>
                      </div>

                      {onDeleteConversation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 rounded transition-all"
                          title="Delete Session"
                        >
                          <TrashIcon size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
