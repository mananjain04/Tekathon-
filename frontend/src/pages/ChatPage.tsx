import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ChatMessage,
  Conversation,
  DocumentItem,
  DocumentCitation,
  Source,
  SelectedDocument as SelectedDocType,
  RagProcessingStage,
} from '../types';
import { documentApi } from '../services/documentApi';
import { chatApi } from '../services/chatApi';
import { formatApiErrorMessage } from '../services/api';
import { MOCK_CONVERSATION_MESSAGES } from '../mock/chatMock';
import { SelectedDocument } from '../components/chat/SelectedDocument';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatInput } from '../components/chat/ChatInput';
import { EvidenceModal } from '../components/chat/EvidenceModal';
import { ShieldIcon, MenuIcon, XIcon } from '../components/icons';

export const ChatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const docIdParam = searchParams.get('documentId') || searchParams.get('docId');
  const docTitleParam = searchParams.get('title');
  const convIdParam = searchParams.get('convId');

  // Documents state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocType | null>(null);

  // Conversations and Messages state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(convIdParam || 'conv-001');
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(MOCK_CONVERSATION_MESSAGES);

  // Input & Processing state
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<RagProcessingStage>('ready');
  const [inputError, setInputError] = useState<string | null>(null);

  // Evidence Modal state
  const [activeEvidence, setActiveEvidence] = useState<DocumentCitation | null>(null);

  // Mobile sidebar toggle
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(false);

  // 1. Initial Data Load
  useEffect(() => {
    const initData = async () => {
      try {
        const [docs, convs] = await Promise.all([
          documentApi.getDocuments(),
          chatApi.getConversations(),
        ]);
        setDocuments(docs);
        setConversations(convs);

        if (convIdParam) {
          const matchedConv = convs.find((c) => c.id === convIdParam);
          if (matchedConv) {
            setActiveConversationId(convIdParam);
            if (matchedConv.document_id) {
              const matchedDoc = docs.find((d) => d.id === matchedConv.document_id);
              if (matchedDoc) {
                setSelectedDocument({
                  id: matchedDoc.id,
                  title: matchedDoc.title,
                  filename: matchedDoc.filename,
                  status: matchedDoc.status,
                  chunk_count: matchedDoc.chunk_count,
                  page_count: matchedDoc.page_count,
                  classification: matchedDoc.classification,
                });
              }
            }
          }
        }

        if (docIdParam) {
          const target = docs.find((d) => d.id === docIdParam);
          if (target) {
            setSelectedDocument({
              id: target.id,
              title: target.title,
              filename: target.filename,
              status: target.status,
              chunk_count: target.chunk_count,
              page_count: target.page_count,
              classification: target.classification,
            });
          } else {
            setSelectedDocument({
              id: docIdParam,
              title: docTitleParam ? decodeURIComponent(docTitleParam) : 'Selected Document',
              filename: docTitleParam ? decodeURIComponent(docTitleParam) : 'document.pdf',
              status: 'READY',
            });
          }

          if (!convIdParam) {
            const docConv = convs.find((c) => c.document_id === docIdParam);
            if (docConv) {
              setActiveConversationId(docConv.id);
            } else {
              const newSession = chatApi.createSession(
                docIdParam,
                docTitleParam ? decodeURIComponent(docTitleParam) : undefined
              );
              setConversations((prev) => [newSession, ...prev]);
              setActiveConversationId(newSession.id);
              setMessagesMap((prev) => ({ ...prev, [newSession.id]: [] }));
            }
          }
        } else if (!convIdParam && convs.length > 0) {
          setActiveConversationId(convs[0].id);
          if (convs[0].document_id) {
            const match = docs.find((d) => d.id === convs[0].document_id);
            if (match) {
              setSelectedDocument({
                id: match.id,
                title: match.title,
                filename: match.filename,
                status: match.status,
                chunk_count: match.chunk_count,
                page_count: match.page_count,
                classification: match.classification,
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize Chat Workbench data:', err);
      }
    };

    initData();
  }, [docIdParam, docTitleParam, convIdParam]);

  const handleSelectDocument = (doc: DocumentItem | null) => {
    if (doc) {
      setSelectedDocument({
        id: doc.id,
        title: doc.title,
        filename: doc.filename,
        status: doc.status,
        chunk_count: doc.chunk_count,
        page_count: doc.page_count,
        classification: doc.classification,
      });
      setSearchParams({ documentId: doc.id });
    } else {
      setSelectedDocument(null);
      setSearchParams({});
    }
  };

  const handleNewConversation = () => {
    const newSession = chatApi.createSession(
      selectedDocument?.id,
      selectedDocument?.title
    );
    setConversations((prev) => [newSession, ...prev]);
    setActiveConversationId(newSession.id);
    setMessagesMap((prev) => ({ ...prev, [newSession.id]: [] }));
    setInputQuery('');
    setInputError(null);
    setIsLeftPanelOpen(false);
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversationId(conv.id);
    setIsLeftPanelOpen(false);

    if (conv.document_id) {
      const match = documents.find((d) => d.id === conv.document_id);
      if (match) {
        setSelectedDocument({
          id: match.id,
          title: match.title,
          filename: match.filename,
          status: match.status,
          chunk_count: match.chunk_count,
          page_count: match.page_count,
          classification: match.classification,
        });
      }
    } else {
      setSelectedDocument(null);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    await chatApi.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessagesMap((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (activeConversationId === id) {
      handleNewConversation();
    }
  };

  const handleNavigateToEvidence = (
    source: DocumentCitation | Source,
    allCitations?: (DocumentCitation | Source)[]
  ) => {
    const page = source.page_number || 1;
    const chunkParam = source.chunk_id ? `&chunkId=${encodeURIComponent(source.chunk_id)}` : '';
    const convParam = `&convId=${encodeURIComponent(activeConversationId)}`;
    navigate(`/documents/${source.document_id}/evidence?page=${page}${chunkParam}${convParam}`, {
      state: { source, allCitations, convId: activeConversationId },
    });
  };

  const handleSendQuery = async () => {
    if (!inputQuery.trim() || isProcessing) return;

    const userText = inputQuery.trim();
    setInputQuery('');
    setInputError(null);

    const userMsg: ChatMessage = {
      id: `msg-usr-${Date.now()}`,
      session_id: activeConversationId,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), userMsg],
    }));
    setIsProcessing(true);
    setProcessingStage('retrieving');

    try {
      const response = await chatApi.sendChatMessage({
        query: userText,
        session_id: activeConversationId,
        document_id: selectedDocument?.id,
        top_k: 4,
      });

      const assistantMsg: ChatMessage = {
        id: `msg-ast-${Date.now()}`,
        session_id: activeConversationId,
        role: 'assistant',
        content: response.response,
        citations: response.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: [...(prev[activeConversationId] || []), assistantMsg],
      }));

      // Update conversation title if first message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConversationId && c.message_count === 0) {
            return {
              ...c,
              title: userText.slice(0, 42) + (userText.length > 42 ? '...' : ''),
              message_count: 2,
              updated_at: new Date().toISOString(),
            };
          }
          if (c.id === activeConversationId) {
            return {
              ...c,
              message_count: c.message_count + 2,
              updated_at: new Date().toISOString(),
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      console.error('Failed to receive AI response:', err);
      const errMsg = formatApiErrorMessage(err);
      setInputError(errMsg);

      const errorBubble: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        session_id: activeConversationId,
        role: 'system',
        content: `QUERY FAILED\n\nUnable to retrieve an answer from the local KAVACH service. (${errMsg})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: [...(prev[activeConversationId] || []), errorBubble],
      }));
    } finally {
      setIsProcessing(false);
      setProcessingStage('ready');
    }
  };

  const handleSelectSuggestion = (prompt: string) => {
    setInputQuery(prompt);
  };

  const handleClearSession = () => {
    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: [],
    }));
  };

  const activeMessages = messagesMap[activeConversationId] || [];

  return (
    <div className="h-[calc(100vh-110px)] flex flex-col max-w-7xl mx-auto rounded-lg border border-zinc-800/80 overflow-hidden shadow-sm bg-[#09090b]">
      {/* 1. TOP WORKBENCH HEADER */}
      <div className="bg-[#0c0c0e] border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className="md:hidden p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="Toggle context drawer"
          >
            {isLeftPanelOpen ? <XIcon size={16} /> : <MenuIcon size={16} />}
          </button>

          <div className="flex items-center space-x-2">
            <h1 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ShieldIcon size={14} className="text-blue-500" />
              <span>Query Assistant</span>
            </h1>
            <span className="hidden sm:inline text-zinc-600">·</span>
            <span className="hidden sm:inline text-[11px] font-mono text-zinc-400">
              Grounded Document Retrieval
            </span>
          </div>
        </div>

        {/* Right Status */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          {documentApi.isOffline ? (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Offline Enclave Fixtures
            </span>
          ) : (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Local Live Node
            </span>
          )}
        </div>
      </div>

      {/* 2. TWO-PANEL WORKBENCH */}
      <div className="flex flex-1 overflow-hidden relative">
        {isLeftPanelOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
            onClick={() => setIsLeftPanelOpen(false)}
          />
        )}

        {/* LEFT PANEL: KNOWLEDGE CONTEXT */}
        <aside
          className={`w-72 bg-[#0c0c0e] border-r border-zinc-800/80 flex flex-col justify-between p-3.5 space-y-3.5 shrink-0 transition-all duration-200 z-30
            ${
              isLeftPanelOpen
                ? 'fixed inset-y-16 left-0 shadow-2xl'
                : 'hidden md:flex'
            }`}
        >
          <div className="space-y-3.5 overflow-y-auto pr-1">
            <div className="px-1 text-[10px] font-mono tracking-wider text-zinc-500 uppercase font-semibold">
              Context & History
            </div>

            {/* Selected Document Card */}
            <SelectedDocument
              selectedDocument={selectedDocument}
              availableDocuments={documents}
              onSelectDocument={handleSelectDocument}
            />

            {/* Recent Conversations */}
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              onDeleteConversation={handleDeleteConversation}
            />
          </div>

          {/* Repository Status */}
          <div className="pt-2 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-400 space-y-1 bg-[#121215] p-2.5 rounded-md border">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Vector Index:</span>
              <span className="text-zinc-300">pgvector (384-d)</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-zinc-500">Inference:</span>
              <span className="text-zinc-300">Ollama / qwen2.5</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-zinc-500">Data Isolation:</span>
              <span className="text-emerald-400">Private Host</span>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL: AI WORKBENCH */}
        <section className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
          {/* Conversation Stream */}
          <ChatWindow
            messages={activeMessages}
            isProcessing={isProcessing}
            processingStage={processingStage}
            selectedDocument={selectedDocument}
            onSelectSuggestion={handleSelectSuggestion}
            onViewEvidence={handleNavigateToEvidence}
            onClearSession={handleClearSession}
          />

          {/* Bottom Chat Input */}
          <ChatInput
            value={inputQuery}
            onChange={setInputQuery}
            onSubmit={handleSendQuery}
            isProcessing={isProcessing}
            selectedDocName={selectedDocument ? selectedDocument.filename : undefined}
            onAttachClick={() => setIsLeftPanelOpen(true)}
            error={inputError}
          />
        </section>
      </div>

      {/* Forensic Evidence Modal */}
      <EvidenceModal
        citation={activeEvidence}
        onClose={() => setActiveEvidence(null)}
      />
    </div>
  );
};
