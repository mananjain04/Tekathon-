import React from 'react';
import { RagProcessingStage } from '../../types';
import { ShieldIcon, CheckCircleIcon, CpuIcon } from '../icons';

interface ChatLoadingStateProps {
  currentStage?: RagProcessingStage;
  message?: string;
}

interface StageStep {
  id: RagProcessingStage;
  label: string;
}

const STAGES: StageStep[] = [
  { id: 'understanding', label: 'Analyzing question intent' },
  { id: 'searching', label: 'Querying dense vector index (pgvector)' },
  { id: 'retrieving', label: 'Retrieving & reranking relevant chunks' },
  { id: 'generating', label: 'Synthesizing response (Ollama)' },
  { id: 'ready', label: 'Ready' },
];

export const ChatLoadingState: React.FC<ChatLoadingStateProps> = ({
  currentStage = 'retrieving',
  message,
}) => {
  const currentStageIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="flex flex-col items-start space-y-3 p-4 bg-[#121215] border border-zinc-800/80 rounded-lg max-w-xl text-xs font-mono shadow-sm">
      {/* Header telemetry line */}
      <div className="flex items-center space-x-2 text-blue-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
        <span className="font-medium text-[11px] tracking-wide uppercase">
          RETRIEVING FROM LOCAL KNOWLEDGE BASE...
        </span>
      </div>

      {/* RAG Processing Visual Pipeline */}
      <div className="w-full space-y-2 py-1">
        {STAGES.map((step, index) => {
          const isDone = currentStageIndex > index;
          const isCurrent = currentStageIndex === index;

          return (
            <div key={step.id} className="flex items-center space-x-3 text-xs">
              <div className="flex items-center justify-center w-4 h-4 shrink-0">
                {isDone ? (
                  <CheckCircleIcon size={14} className="text-emerald-400" />
                ) : isCurrent ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                )}
              </div>

              <span
                className={`${
                  isDone
                    ? 'text-zinc-500'
                    : isCurrent
                    ? 'text-zinc-100 font-medium flex items-center gap-1.5'
                    : 'text-zinc-600'
                }`}
              >
                {step.label}
                {isCurrent && <span className="text-blue-400">...</span>}
              </span>

              {isCurrent && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 ml-auto">
                  RUNNING
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Subtext info */}
      <div className="pt-2 border-t border-zinc-800/80 w-full flex items-center justify-between text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <CpuIcon size={12} className="text-zinc-500" />
          <span>{message || 'Executed on local on-premise compute'}</span>
        </span>
        <span className="flex items-center gap-1 text-emerald-400/80">
          <ShieldIcon size={11} />
          Zero Cloud Egress
        </span>
      </div>
    </div>
  );
};
