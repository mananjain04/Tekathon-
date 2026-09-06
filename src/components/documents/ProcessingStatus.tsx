import React from 'react';
import { DocumentStatus, IngestionStatus, ProcessingStage } from '../../types';
import { CheckIcon, AlertTriangleIcon, RotateCwIcon } from '../icons';

export interface ProcessingStatusProps {
  status: DocumentStatus | IngestionStatus;
  currentStage?: ProcessingStage;
  errorMessage?: string;
  variant?: 'compact' | 'detailed' | 'inline';
  className?: string;
}

interface PipelineStepConfig {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
}

const PIPELINE_STEPS: PipelineStepConfig[] = [
  {
    key: 'UPLOADED',
    label: 'Document Uploaded',
    shortLabel: 'Uploaded',
    description: 'File received and staged in local secure storage.',
  },
  {
    key: 'TEXT_EXTRACTION',
    label: 'Text Extraction',
    shortLabel: 'Extraction',
    description: 'Local PDF parsing & layout extraction without external cloud calls.',
  },
  {
    key: 'CHUNKING',
    label: 'Semantic Chunking',
    shortLabel: 'Chunking',
    description: 'Segmented with 512-token window and 64-token boundary overlap.',
  },
  {
    key: 'EMBEDDING',
    label: 'Vector Embedding',
    shortLabel: 'Embedding',
    description: 'Computed with all-MiniLM-L6-v2 (384-d) into PostgreSQL pgvector index.',
  },
  {
    key: 'READY',
    label: 'Ready for AI',
    shortLabel: 'Ready',
    description: 'Indexed and accessible for local on-premise RAG inference.',
  },
];

type StepState = 'completed' | 'active' | 'pending' | 'failed';

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  status,
  currentStage,
  errorMessage,
  variant = 'compact',
  className = '',
}) => {
  const getStepState = (stepIndex: number): StepState => {
    if (status === 'FAILED') {
      const failedIndex = currentStage === 'TEXT_EXTRACTION' ? 1
        : currentStage === 'CHUNKING' ? 2
        : currentStage === 'EMBEDDING' ? 3
        : 1;
      if (stepIndex < failedIndex) return 'completed';
      if (stepIndex === failedIndex) return 'failed';
      return 'pending';
    }

    if (status === 'READY' || status === 'PROCESSED') {
      return 'completed';
    }

    if (status === 'UPLOADING') {
      if (stepIndex === 0) return 'active';
      return 'pending';
    }

    if (status === 'UPLOADED') {
      if (stepIndex === 0) return 'completed';
      if (stepIndex === 1) return 'active';
      return 'pending';
    }

    if (status === 'PROCESSING' || status === 'INDEXING' || status === 'QUEUED') {
      let activeIndex = 2;
      if (currentStage === 'TEXT_EXTRACTION') activeIndex = 1;
      else if (currentStage === 'CHUNKING') activeIndex = 2;
      else if (currentStage === 'EMBEDDING') activeIndex = 3;

      if (stepIndex < activeIndex) return 'completed';
      if (stepIndex === activeIndex) return 'active';
      return 'pending';
    }

    return 'pending';
  };

  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center space-x-1.5 text-xs font-mono ${className}`}>
        {PIPELINE_STEPS.map((step, idx) => {
          const state = getStepState(idx);
          return (
            <React.Fragment key={step.key}>
              <span
                className={`inline-flex items-center gap-1 ${
                  state === 'completed'
                    ? 'text-emerald-400'
                    : state === 'active'
                    ? 'text-blue-400 font-medium'
                    : state === 'failed'
                    ? 'text-rose-400'
                    : 'text-zinc-600'
                }`}
              >
                {state === 'completed' && <CheckIcon size={12} className="stroke-[2.5]" />}
                {state === 'active' && <RotateCwIcon size={12} className="animate-spin" />}
                {state === 'failed' && <AlertTriangleIcon size={12} />}
                {state === 'pending' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-700" />}
                <span>{step.shortLabel}</span>
              </span>
              {idx < PIPELINE_STEPS.length - 1 && (
                <span className="text-zinc-700 select-none">→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-[11px] font-mono">
          {PIPELINE_STEPS.map((step, idx) => {
            const state = getStepState(idx);
            return (
              <div key={step.key} className="flex items-center space-x-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                    state === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : state === 'active'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : state === 'failed'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                  }`}
                >
                  {state === 'completed' && '✓'}
                  {state === 'active' && '⟳'}
                  {state === 'failed' && '✕'}
                  {state === 'pending' && '○'}
                </span>
                <span
                  className={`hidden sm:inline ${
                    state === 'completed'
                      ? 'text-zinc-300'
                      : state === 'active'
                      ? 'text-blue-400 font-medium'
                      : state === 'failed'
                      ? 'text-rose-400 font-medium'
                      : 'text-zinc-600'
                  }`}
                >
                  {step.shortLabel}
                </span>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <span className="text-zinc-700 select-none ml-1 hidden md:inline">·</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden flex">
          {PIPELINE_STEPS.map((_, idx) => {
            const state = getStepState(idx);
            return (
              <div
                key={idx}
                className={`flex-1 transition-all duration-300 ${
                  idx > 0 ? 'border-l border-zinc-900' : ''
                } ${
                  state === 'completed'
                    ? 'bg-emerald-500'
                    : state === 'active'
                    ? 'bg-blue-500'
                    : state === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-zinc-800/60'
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Detailed timeline view
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div>
          <h4 className="text-sm font-semibold text-zinc-200">Processing & Ingestion Pipeline</h4>
          <p className="text-xs text-zinc-400">Local pipeline execution stage tracker</p>
        </div>
        <div className="text-xs font-mono">
          {status === 'READY' && (
            <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Pipeline Completed (5/5)
            </span>
          )}
          {status === 'PROCESSING' && (
            <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
              Pipeline Active
            </span>
          )}
          {status === 'FAILED' && (
            <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
              Pipeline Halted
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
        {PIPELINE_STEPS.map((step, idx) => {
          const state = getStepState(idx);
          return (
            <div
              key={step.key}
              className={`p-3 rounded-lg border text-xs transition-all ${
                state === 'completed'
                  ? 'bg-[#121215] border-zinc-800/80 shadow-sm'
                  : state === 'active'
                  ? 'bg-[#18181b] border-blue-500/40 shadow-sm'
                  : state === 'failed'
                  ? 'bg-rose-950/20 border-rose-800/50'
                  : 'bg-zinc-900/40 border-zinc-800/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] text-zinc-500">STAGE 0{idx + 1}</span>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    state === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : state === 'active'
                      ? 'bg-blue-500/20 text-blue-300'
                      : state === 'failed'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {state === 'completed' && <CheckIcon size={12} />}
                  {state === 'active' && <RotateCwIcon size={12} className="animate-spin" />}
                  {state === 'failed' && <AlertTriangleIcon size={12} />}
                  {state === 'pending' && '○'}
                </span>
              </div>

              <div
                className={`font-medium text-xs mb-1 ${
                  state === 'completed'
                    ? 'text-zinc-200'
                    : state === 'active'
                    ? 'text-blue-300 font-semibold'
                    : state === 'failed'
                    ? 'text-rose-300'
                    : 'text-zinc-400'
                }`}
              >
                {step.label}
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-md text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangleIcon size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold uppercase tracking-wider block">Pipeline Failure Diagnostic:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
