import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { DocumentItem, DocumentChunk, Evidence, DocumentCitation, Source } from '../types';
import { documentApi } from '../services/documentApi';
import { EvidenceViewer } from '../components/evidence/EvidenceViewer';
import { ChevronRightIcon, DocumentIcon, AlertTriangleIcon } from '../components/icons';
import { Button } from '../components/common/Button';

interface NavigationState {
  source?: DocumentCitation | Source;
  evidence?: Evidence;
  allCitations?: (DocumentCitation | Source)[];
  convId?: string;
}

export const DocumentEvidencePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const pageParam = searchParams.get('page');
  const initialPageNumber = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const chunkIdParam = searchParams.get('chunkId') || undefined;
  const convIdParam = searchParams.get('convId') || (location.state as NavigationState | null)?.convId;

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [evidence, setEvidence] = useState<Evidence | DocumentCitation | Source | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPageNumber);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const knownCitationsRef = useRef<(DocumentCitation | Source)[]>([]);

  useEffect(() => {
    const loadDocData = async () => {
      if (!id) return;
      setIsLoading(true);
      setError(null);

      try {
        const data = await documentApi.getDocument(id);
        if (!data) {
          setError(`Document not found: ${id}`);
          setIsLoading(false);
          return;
        }

        let finalChunks = data.chunks || [];
        const stateObj = location.state as NavigationState | null;
        if (stateObj?.allCitations && Array.isArray(stateObj.allCitations)) {
          knownCitationsRef.current = stateObj.allCitations;
        } else if (stateObj?.source) {
          knownCitationsRef.current = [stateObj.source];
        }

        // If backend does not expose a chunks endpoint, populate from live citations so canvas renders
        if (finalChunks.length === 0 && knownCitationsRef.current.length > 0) {
          finalChunks = knownCitationsRef.current.map((c, idx) => ({
            id: `live-chunk-${idx + 1}`,
            document_id: data.document.id,
            page_number: c.page_number || 1,
            chunk_index: idx,
            content: c.snippet || '',
            token_count: Math.ceil((c.snippet || '').length / 4),
            relevance_score: c.relevance_score,
            keywords: [],
          }));
        }

        setDocument(data.document);
        setChunks(finalChunks);

        if (stateObj?.source) {
          setEvidence(stateObj.source);
          if (stateObj.source.page_number && stateObj.source.page_number !== currentPage) {
            setCurrentPage(stateObj.source.page_number);
          }
        } else if (stateObj?.evidence) {
          setEvidence(stateObj.evidence);
          if (stateObj.evidence.page_number && stateObj.evidence.page_number !== currentPage) {
            setCurrentPage(stateObj.evidence.page_number);
          }
        } else if (chunkIdParam) {
          const targetChunk = data.chunks.find((c) => c.id === chunkIdParam);
          if (targetChunk) {
            setEvidence({
              id: targetChunk.id,
              document_id: data.document.id,
              document_title: data.document.title,
              page_number: targetChunk.page_number,
              snippet: targetChunk.content,
              relevance_score: targetChunk.relevance_score,
              chunk_id: targetChunk.id,
            });
            if (targetChunk.page_number && targetChunk.page_number !== currentPage) {
              setCurrentPage(targetChunk.page_number);
            }
          } else {
            setEvidence(null);
          }
        } else {
          const matchingCit = knownCitationsRef.current.find(
            (c) => c.page_number === initialPageNumber
          );
          setEvidence(matchingCit || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve document record.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocData();
  }, [id]);

  useEffect(() => {
    if (pageParam) {
      const parsed = parseInt(pageParam, 10);
      if (!isNaN(parsed) && parsed !== currentPage) {
        setCurrentPage(parsed);
        const matched = knownCitationsRef.current.find((c) => c.page_number === parsed);
        setEvidence(matched || null);
      }
    }
  }, [pageParam]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams, { replace: true });

    const matched = knownCitationsRef.current.find((c) => c.page_number === newPage);
    if (matched) {
      setEvidence(matched);
    } else {
      setEvidence(null);
    }
  };

  const handleBackToChat = () => {
    const params = new URLSearchParams();
    if (id) params.set('docId', id);
    if (convIdParam) params.set('convId', convIdParam);
    if (document?.title) params.set('title', document.title);
    navigate(`/chat?${params.toString()}`);
  };

  const handleBackToDocument = () => {
    if (id) {
      navigate(`/documents/${id}`);
    } else {
      navigate('/documents');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center space-y-4 font-mono">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <div className="text-xs text-zinc-400">
          Loading document page and evidence citation...
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4 font-mono">
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 text-xs space-y-2">
          <AlertTriangleIcon size={24} className="mx-auto text-rose-400" />
          <div className="font-semibold">DOCUMENT EVIDENCE UNAVAILABLE</div>
          <p>{error || 'Requested document could not be located.'}</p>
        </div>
        <div className="flex items-center justify-center space-x-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
            Documents Repository
          </Button>
          <Button variant="primary" size="sm" onClick={handleBackToChat}>
            Return to Assistant
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs font-mono text-zinc-400">
        <button
          onClick={() => navigate('/documents')}
          className="hover:text-zinc-200 transition-colors"
        >
          Documents
        </button>
        <ChevronRightIcon size={13} />
        <button
          onClick={handleBackToDocument}
          className="hover:text-zinc-200 transition-colors truncate max-w-xs"
          title={document.filename}
        >
          {document.filename}
        </button>
        <ChevronRightIcon size={13} />
        <span className="text-blue-400 font-medium flex items-center gap-1">
          <DocumentIcon size={13} />
          Evidence Inspector
        </span>
      </nav>

      {/* Main Evidence Viewer Component */}
      <EvidenceViewer
        document={document}
        evidence={evidence}
        initialPage={currentPage}
        chunks={chunks}
        onPageChange={handlePageChange}
        onBackToChat={handleBackToChat}
        onBackToDocument={handleBackToDocument}
      />
    </div>
  );
};
