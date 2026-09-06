import React, { useState } from 'react';
import { DocumentItem, SelectedDocument as SelectedDocType } from '../../types';
import { DocumentIcon, CheckCircleIcon, XIcon, ShieldIcon } from '../icons';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface SelectedDocumentProps {
  selectedDocument: SelectedDocType | null;
  availableDocuments: DocumentItem[];
  onSelectDocument: (doc: DocumentItem | null) => void;
}

export const SelectedDocument: React.FC<SelectedDocumentProps> = ({
  selectedDocument,
  availableDocuments,
  onSelectDocument,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const filteredDocuments = availableDocuments.filter((d) =>
    d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.filename.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleChoose = (doc: DocumentItem | null) => {
    onSelectDocument(doc);
    setIsPickerOpen(false);
  };

  return (
    <div className="kavach-glass-card rounded-xl p-3.5 space-y-3 border-white/80 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 font-bold">
          <DocumentIcon size={13} className="text-zinc-900" />
          ACTIVE CONTEXT
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPickerOpen(true)}
          className="text-xs text-zinc-900 font-semibold hover:bg-white/80 py-0.5 px-2 h-6"
        >
          {selectedDocument ? 'Change' : 'Select'}
        </Button>
      </div>

      {selectedDocument ? (
        <div className="p-3 rounded-lg bg-white/85 border border-white/95 space-y-2 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start space-x-2 min-w-0">
              <div className="p-1 rounded bg-zinc-100 text-zinc-900 border border-zinc-200 shrink-0 mt-0.5">
                <DocumentIcon size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-950 truncate font-mono" title={selectedDocument.title}>
                  {selectedDocument.filename || selectedDocument.title}
                </p>
                <p className="text-[10px] text-zinc-500 truncate">
                  {selectedDocument.title}
                </p>
              </div>
            </div>
            <button
              onClick={() => onSelectDocument(null)}
              title="Clear specific document filter"
              className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded transition-colors"
            >
              <XIcon size={13} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-200/70 text-[11px] font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="text-zinc-500">Status:</span>
              <span className="status-pill-online text-[9px] py-0 px-1.5 font-semibold">
                <CheckCircleIcon size={11} />
                INDEXED
              </span>
            </div>

            {selectedDocument.chunk_count !== undefined && (
              <span className="text-zinc-500 text-[10px] font-medium">
                {selectedDocument.chunk_count} Chunks
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsPickerOpen(true)}
          className="p-3 rounded-lg border border-dashed border-zinc-300 hover:border-zinc-600 bg-white/40 cursor-pointer transition-colors text-center space-y-1 shadow-sm"
        >
          <div className="text-xs font-bold text-zinc-800 flex items-center justify-center gap-1.5">
            <ShieldIcon size={13} className="text-zinc-900" />
            <span>All Repository Documents</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono">
            Click to narrow context to a single document
          </p>
        </div>
      )}

      {/* Picker Modal */}
      {isPickerOpen && (
        <Modal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          title="Select Context Document"
          description="Focus assistant queries on a specific indexed document, or query across all files."
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleChoose(null)}
              >
                Clear Focus (Query All)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsPickerOpen(false)}
              >
                Cancel
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Filter available documents..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white/90 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950"
            />

            <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-zinc-200/60">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleChoose(doc)}
                  className="p-2.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-950 truncate font-mono">
                      {doc.filename}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {doc.title}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 font-mono text-[10px]">
                    <span className="text-zinc-500">{doc.chunk_count} chunks</span>
                    <Badge variant={doc.status === 'READY' ? 'success' : 'default'} size="sm">
                      {doc.status}
                    </Badge>
                  </div>
                </div>
              ))}

              {filteredDocuments.length === 0 && (
                <div className="py-6 text-center text-zinc-500 text-xs font-mono">
                  No documents found matching your filter.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
