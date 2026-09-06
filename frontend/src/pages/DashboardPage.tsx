import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DocumentIcon,
  ChatIcon,
  UploadIcon,
  ShieldIcon,
  CpuIcon,
  ServerIcon,
  ChevronRightIcon,
  RefreshIcon,
} from '../components/icons';
import { api, HealthStatus } from '../services/api';
import { chatApi } from '../services/chatApi';
import { DocumentItem, SystemStatus, Conversation } from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);

  const loadData = () => {
    setHealthLoading(true);
    setDataLoading(true);
    api
      .getHealthStatus()
      .then((h) => {
        setHealth(h);
      })
      .catch(() => {
        setHealth({ backend: 'OFFLINE', database: 'DISCONNECTED', vectorDb: 'UNAVAILABLE', ollama: 'UNAVAILABLE' });
      })
      .finally(() => {
        setHealthLoading(false);
      });

    Promise.all([
      api.getDocuments().catch(() => api.resetDocuments()),
      api.getSystemStatus().catch(() => null),
      chatApi.getConversations().catch(() => []),
    ]).then(([docs, s, convs]) => {
      setDocuments(docs || []);
      if (s) setStatus(s);
      setRecentConversations(convs || []);
    }).finally(() => {
      setDataLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalChunks = documents.reduce((acc, doc) => acc + (doc.chunk_count || 0), 0);
  const isBackendOnline = health?.backend === 'ONLINE';

  if (dataLoading) {
    return (
      <div className="max-w-7xl mx-auto py-24 text-center font-mono space-y-3">
        <div className="inline-block h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Loading system state...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Offline Mode Status Pill */}
      {!isBackendOnline && !healthLoading && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50/90 backdrop-blur-md border border-amber-200 text-amber-900 text-xs font-mono shadow-xs">
          <div className="flex items-center space-x-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="font-bold">Offline Mode (Local Enclave Fixtures)</span>
            <span className="text-amber-800/70 hidden md:inline">· Air-gapped local simulation active</span>
          </div>
          <button
            onClick={loadData}
            disabled={healthLoading}
            className="px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshIcon size={12} className={healthLoading ? 'animate-spin' : ''} />
            <span>{healthLoading ? 'Checking...' : 'Connect Live Backend'}</span>
          </button>
        </div>
      )}

      {/* 1. Header & Quick Actions */}
      <div className="relative pt-2 pb-1">
        <div className="text-[11px] font-bold tracking-[0.28em] text-slate-600 uppercase mb-1">
          OPERATIONAL OVERVIEW
        </div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-black uppercase leading-none">
          OVERVIEW
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-slate-700 uppercase">
            LOCAL INFERENCE PIPELINES & REPOSITORY TELEMETRY
          </p>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/documents')}
              className="bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 shadow-xs px-4 py-2 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2 transition-all"
            >
              <UploadIcon size={14} className="text-slate-700" />
              <span>Upload Document</span>
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all"
            >
              <ChatIcon size={14} className="text-white" />
              <span>Query Assistant</span>
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Node State */}
        <div className="kavach-glass-card p-5 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            HOST NODE
          </div>
          <div className="flex items-center space-x-2 pt-0.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-xs" />
            <span className="text-xl font-black text-black font-mono">
              {status?.node_id || 'LOCAL-01'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Air-Gapped / Isolated Enclave
          </div>
        </div>

        {/* Card 2: Documents */}
        <div className="kavach-glass-card p-5 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            DOCUMENTS
          </div>
          <div className="flex items-baseline space-x-2 pt-0.5">
            <span className="text-3xl font-black text-black tracking-tight font-mono">
              {documents.length}
            </span>
            <span className="text-xs text-slate-500 font-mono font-bold">PDFs</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Active Sovereign Repository
          </div>
        </div>

        {/* Card 3: Indexed Chunks */}
        <div className="kavach-glass-card p-5 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            INDEXED CHUNKS
          </div>
          <div className="flex items-baseline space-x-2 pt-0.5">
            <span className="text-3xl font-black text-sky-700 tracking-tight font-mono">
              {totalChunks}
            </span>
            <span className="text-xs text-slate-500 font-mono font-bold">vectors</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            pgvector (384-d dense)
          </div>
        </div>

        {/* Card 4: Inference Engine */}
        <div className="kavach-glass-card p-5 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            INFERENCE ENGINE
          </div>
          <div className="flex items-center space-x-2 pt-0.5">
            <CpuIcon size={18} className="text-slate-700" />
            <span className="text-lg font-black text-black font-mono">
              Ollama
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium truncate">
            qwen2.5:7b (Local LLM)
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Knowledge Repository & Query Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Documents Table */}
          <div className="kavach-glass-panel p-6 border border-white/80 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                  <DocumentIcon size={16} className="text-slate-700" />
                  <span>Document Repository</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Latest files ingested and indexed in pgvector
                </p>
              </div>

              <button
                onClick={() => navigate('/documents')}
                className="text-xs font-bold text-slate-800 hover:text-black flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRightIcon size={14} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-mono uppercase text-slate-500 border-b border-slate-200/80 font-bold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Chunks</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 font-mono">
                  {documents.slice(0, 5).map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/60 transition-colors">
                      <td className="py-3 px-3 max-w-[220px]">
                        <div className="font-bold text-slate-900 truncate font-sans">{doc.title}</div>
                        <div className="text-[10px] text-slate-500 truncate">{doc.filename}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {(doc.classification || 'CONFIDENTIAL').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-sky-700 font-bold">
                        {doc.chunk_count}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => navigate(`/documents/${doc.id}`)}
                          className="text-xs font-bold text-slate-800 hover:text-black hover:underline"
                        >
                          Details →
                        </button>
                      </td>
                    </tr>
                  ))}

                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center font-mono">
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">NO DOCUMENTS</div>
                          <p className="text-[11px] text-slate-500 font-sans">
                            Your secure knowledge repository is empty.
                          </p>
                          <div className="pt-2">
                            <button
                              onClick={() => navigate('/documents')}
                              className="px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-xs hover:bg-black"
                            >
                              Upload Document
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Query Sessions */}
          <div className="kavach-glass-panel p-6 border border-white/80 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                  <ChatIcon size={16} className="text-slate-700" />
                  <span>Recent Query Sessions</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Dialogue sessions and grounded evidence queries
                </p>
              </div>

              <button
                onClick={() => navigate('/chat')}
                className="text-xs font-bold text-slate-800 hover:text-black flex items-center gap-1"
              >
                <span>Open Assistant</span>
                <ChevronRightIcon size={14} />
              </button>
            </div>

            <div className="divide-y divide-slate-200/50 mt-2">
              {recentConversations.slice(0, 4).map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/chat?convId=${conv.id}`)}
                  className="py-3 px-2 hover:bg-white/60 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate font-sans">{conv.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                      {conv.document_title ? (
                        <span className="text-blue-700 font-semibold truncate max-w-[200px]">Doc: {conv.document_title}</span>
                      ) : (
                        <span>Repository-wide</span>
                      )}
                      <span>·</span>
                      <span>{conv.message_count} messages</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    Ready
                  </span>
                </div>
              ))}

              {recentConversations.length === 0 && (
                <div className="py-8 text-center text-slate-500 font-mono text-xs font-medium">
                  No active query sessions recorded. Launch Query Assistant to execute inquiries.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Service Health & Pipeline Parameters */}
        <div className="space-y-6">
          {/* Service Health */}
          <div className="kavach-glass-panel p-6 border border-white/80 shadow-md space-y-4">
            <div className="pb-3 border-b border-slate-200/80">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                <ServerIcon size={16} className="text-slate-700" />
                <span>Service Health</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Local system components status
              </p>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {/* Backend API */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-slate-200/70 shadow-xs">
                <span className="text-slate-700 font-bold">FastAPI Backend</span>
                {healthLoading ? (
                  <span className="text-slate-500 text-[10px]">CHECKING...</span>
                ) : isBackendOnline ? (
                  <span className="text-emerald-800 text-[10px] font-bold flex items-center gap-1.5 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> CONNECTED
                  </span>
                ) : (
                  <span className="text-amber-800 text-[10px] font-bold flex items-center gap-1.5 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> OFFLINE (FIXTURE)
                  </span>
                )}
              </div>

              {/* Database */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-slate-200/70 shadow-xs">
                <span className="text-slate-700 font-bold">PostgreSQL</span>
                {healthLoading ? (
                  <span className="text-slate-500 text-[10px]">CHECKING...</span>
                ) : health?.database === 'CONNECTED' ? (
                  <span className="text-emerald-800 text-[10px] font-bold flex items-center gap-1.5 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> CONNECTED
                  </span>
                ) : (
                  <span className="text-amber-800 text-[10px] font-bold flex items-center gap-1.5 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> OFFLINE
                  </span>
                )}
              </div>

              {/* Vector Store */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-slate-200/70 shadow-xs">
                <span className="text-slate-700 font-bold">pgvector Index</span>
                {healthLoading ? (
                  <span className="text-slate-500 text-[10px]">CHECKING...</span>
                ) : health?.vectorDb === 'READY' ? (
                  <span className="text-emerald-800 text-[10px] font-bold flex items-center gap-1.5 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> READY
                  </span>
                ) : (
                  <span className="text-amber-800 text-[10px] font-bold flex items-center gap-1.5 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> UNAVAILABLE
                  </span>
                )}
              </div>

              {/* LLM Engine */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-slate-200/70 shadow-xs">
                <span className="text-slate-700 font-bold">Ollama Local LLM</span>
                {healthLoading ? (
                  <span className="text-slate-500 text-[10px]">CHECKING...</span>
                ) : isBackendOnline ? (
                  <span className="text-emerald-800 text-[10px] font-bold flex items-center gap-1.5 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> READY
                  </span>
                ) : (
                  <span className="text-amber-800 text-[10px] font-bold flex items-center gap-1.5 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> OFFLINE
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline Parameters */}
          <div className="kavach-glass-panel p-6 border border-white/80 shadow-md space-y-3">
            <div className="pb-3 border-b border-slate-200/80">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldIcon size={16} className="text-slate-700" />
                <span>Security & Ingestion</span>
              </h2>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-800">
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 text-[11px]">
                <span className="text-slate-500 font-semibold">Host UID:</span>
                <span className="font-bold">{status?.node_id || 'LOCAL-01'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 text-[11px]">
                <span className="text-slate-500 font-semibold">Network Isolation:</span>
                <span className="text-emerald-800 font-bold">Air-Gapped (Private)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 text-[11px]">
                <span className="text-slate-500 font-semibold">Embedding:</span>
                <span className="font-bold">all-MiniLM-L6-v2</span>
              </div>
              <div className="flex justify-between py-1.5 text-[11px]">
                <span className="text-slate-500 font-semibold">Cloud Sync:</span>
                <span className="text-slate-600 font-medium">Disabled</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/settings')}
              className="w-full py-2 rounded-xl bg-white/80 hover:bg-white border border-slate-300 text-slate-900 font-bold text-xs shadow-xs transition-all mt-3"
            >
              Pipeline Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
