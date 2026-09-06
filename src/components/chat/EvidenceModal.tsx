import React from 'react';
import { DocumentCitation } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { DocumentIcon, SparklesIcon, ExternalLinkIcon } from '../icons';
import { useNavigate } from 'react-router-dom';

interface EvidenceModalProps {
  citation: DocumentCitation | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ citation, onClose }) => {
  const navigate = useNavigate();

  if (!citation) return null;

  const relevancePct = Math.round((citation.relevance_score || 0) * 100);

  const handleOpenFullDocument = () => {
    onClose();
    navigate(`/documents/${citation.document_id}`);
  };

  return (
    <Modal
      isOpen={citation !== null}
      onClose={onClose}
      title="Source Citation Inspector"
      description="Ground-truth passage retrieved from local vector store"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenFullDocument}
            leftIcon={<ExternalLinkIcon size={14} />}
          >
            Open Document Details
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Document Header Metadata */}
        <div className="p-3 bg-[#18181b] border border-zinc-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DocumentIcon size={16} className="text-blue-400" />
              <span className="text-xs font-medium text-white">
                {citation.document_title}
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <SparklesIcon size={11} className="text-emerald-400" />
              {relevancePct}% Relevance
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800">
            {citation.page_number !== undefined && (
              <span>Page: {citation.page_number}</span>
            )}
            {citation.chunk_id && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="truncate max-w-xs">Chunk: {citation.chunk_id}</span>
              </>
            )}
          </div>
        </div>

        {/* Passage Text */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Retrieved Grounding Snippet
          </label>
          <div className="p-3.5 bg-[#121215] rounded-md border border-zinc-800 text-xs text-zinc-200 leading-relaxed font-serif whitespace-pre-wrap select-text italic">
            "{citation.snippet}"
          </div>
        </div>
      </div>
    </Modal>
  );
};
