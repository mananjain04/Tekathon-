import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentItem } from '../../types';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { ProcessingStatus } from './ProcessingStatus';
import {
  FileTextIcon,
  SparklesIcon,
  RotateCwIcon,
  EyeIcon,
  TrashIcon,
  AlertTriangleIcon,
  CheckIcon,
} from '../icons';

export interface DocumentCardProps {
  document: DocumentItem;
  onOpen?: (doc: DocumentItem) => void;
  onAskAI?: (doc: DocumentItem) => void;
  onRetry?: (doc: DocumentItem) => void;
  onDelete?: (doc: DocumentItem) => void;
  isRetrying?: boolean;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onOpen,
  onAskAI,
  onRetry,
  onDelete,
  isRetrying = false,
}) => {
  const navigate = useNavigate();

  const handleOpen = () => {
    if (onOpen) onOpen(document);
    else navigate(`/documents/${document.id}`);
  };

  const handleAskAI = () => {
    if (onAskAI) onAskAI(document);
    else navigate(`/chat?docId=${document.id}&title=${encodeURIComponent(document.title)}`);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRetry) onRetry(document);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(document);
  };

  const isReady = document.status === 'READY' || document.status === 'PROCESSED';
  const isProcessing = document.status === 'PROCESSING' || document.status === 'INDEXING';
  const isFailed = document.status === 'FAILED';
  const isUploading = document.status === 'UPLOADING';
  const isUploaded = document.status === 'UPLOADED';

  const renderMetaLine = () => {
    if (isReady) {
      const parts = ['PDF'];
      if (document.page_count) parts.push(`${document.page_count} pages`);
      parts.push(`${document.chunk_count} chunks`);
      return parts.join(' • ');
    }
    if (isProcessing) {
      return 'PDF • Processing';
    }
    if (isFailed) {
      return 'PDF';
    }
    if (isUploading) {
      return 'PDF • Uploading';
    }
    return 'PDF • Uploaded';
  };

  return (
    <Card
      className="p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors duration-150 group bg-[#121215]"
    >
      <div>
        {/* Top bar: Classification badge + Delete icon */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <Badge
            variant={
              document.classification === 'TOP_SECRET'
                ? 'danger'
                : document.classification === 'SECRET'
                ? 'warning'
                : document.classification === 'CONFIDENTIAL'
                ? 'classified'
                : 'default'
            }
            size="sm"
          >
            {document.classification.replace('_', ' ')}
          </Badge>

          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
              title="Delete Document"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>

        {/* Document Icon & Filename */}
        <div className="flex items-start space-x-3 mb-2.5">
          <div
            className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 border ${
              isReady
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : isProcessing
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                : isFailed
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            <FileTextIcon size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <h4
              onClick={handleOpen}
              className="text-xs font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors cursor-pointer truncate font-mono"
              title={document.filename}
            >
              {document.filename}
            </h4>
            <p className="text-xs text-zinc-400 truncate mt-0.5" title={document.title}>
              {document.title}
            </p>
          </div>
        </div>

        {/* Metadata stats line */}
        <div className="text-[11px] font-mono text-zinc-500 mb-3">
          {renderMetaLine()}
        </div>

        {/* Status Badge & Diagnostic info */}
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">STATUS:</span>

          {isReady && (
            <Badge variant="success" size="sm" className="gap-1">
              <CheckIcon size={11} className="stroke-[2.5]" />
              READY
            </Badge>
          )}

          {isProcessing && (
            <Badge variant="info" size="sm" className="gap-1">
              <RotateCwIcon size={11} className="animate-spin text-blue-400" />
              PROCESSING
            </Badge>
          )}

          {isFailed && (
            <Badge variant="danger" size="sm" className="gap-1">
              <AlertTriangleIcon size={11} />
              FAILED
            </Badge>
          )}

          {isUploading && (
            <Badge variant="info" size="sm" className="gap-1">
              <RotateCwIcon size={11} className="animate-spin" />
              UPLOADING
            </Badge>
          )}

          {isUploaded && (
            <Badge variant="default" size="sm">
              UPLOADED
            </Badge>
          )}
        </div>

        {/* Conceptual Pipeline tracker when document is PROCESSING */}
        {isProcessing && (
          <div className="mb-3.5 p-2 rounded bg-zinc-900/60 border border-zinc-800">
            <ProcessingStatus
              status={document.status}
              currentStage={document.current_stage || 'EMBEDDING'}
              variant="compact"
            />
          </div>
        )}

        {/* Error message snippet if failed */}
        {isFailed && document.error_message && (
          <div className="mb-4 p-2 bg-rose-950/20 border border-rose-800/40 rounded text-[11px] text-rose-300 truncate font-mono">
            {document.error_message}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
        {isReady && (
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<EyeIcon size={13} />}
              onClick={handleOpen}
              className="flex-1"
            >
              Open
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<SparklesIcon size={13} />}
              onClick={handleAskAI}
              className="flex-1"
            >
              Query
            </Button>
          </>
        )}

        {isProcessing && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<EyeIcon size={13} />}
            onClick={handleOpen}
            className="w-full"
          >
            View Status
          </Button>
        )}

        {isFailed && (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<RotateCwIcon size={13} className={isRetrying ? 'animate-spin' : ''} />}
            onClick={handleRetry}
            isLoading={isRetrying}
            className="w-full"
          >
            Retry
          </Button>
        )}

        {(isUploading || isUploaded) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpen}
            className="w-full"
          >
            Inspect
          </Button>
        )}
      </div>
    </Card>
  );
};
