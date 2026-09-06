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
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
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
    <div className="space-y-6 max-w-7xl mx-auto text-zinc-100">
      {/* Offline Mode Status Pill */}
      {!isBackendOnline && !healthLoading && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono">
          <div className="flex items-center space-x-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold text-amber-200">Offline Mode (Local Enclave Fixtures)</span>
            <span className="text-amber-400/70 hidden sm:inline">· Air-gapped local simulation active</span>
          </div>
          <button
            onClick={loadData}
            disabled={healthLoading}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshIcon size={12} className={healthLoading ? 'animate-spin' : ''} />
            <span>{healthLoading ? 'Checking...' : 'Connect Live Backend'}</span>
          </button>
        </div>
      )}

      {/* 1. Header & Quick Actions */}
      <div className="bg-[#121215] border border-zinc-800/80 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-medium">
                Operations
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-[11px] font-mono text-zinc-400">Local Private Deployment</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100 mt-1">
              Document Intelligence Overview
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Knowledge base metrics, local inference pipelines, and query history.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<UploadIcon size={14} />}
              onClick={() => navigate('/documents')}
            >
              Upload Document
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<ChatIcon size={14} />}
              onClick={() => navigate('/chat')}
            >
              Query Assistant
            </Button>
          </div>
        </div>

        {/* Telemetry Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-4">
          {/* Card 1: Node State */}
          <div className="bg-[#18181b] border border-zinc-800/80 rounded-md p-3.5 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Host Node
            </div>
            <div className="flex items-center space-x-2 pt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-zinc-100 font-mono">
                {status?.node_id || 'LOCAL-01'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono pt-0.5">
              Air-Gapped / Isolated
            </div>
          </div>

          {/* Card 2: Documents */}
          <div className="bg-[#18181b] border border-zinc-800/80 rounded-md p-3.5 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Documents
            </div>
            <div className="flex items-baseline space-x-2 pt-0.5">
              <span className="text-2xl font-semibold text-zinc-100 tracking-tight font-mono">
                {documents.length}
              </span>
              <span className="text-xs text-zinc-400 font-mono">PDFs</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono pt-0.5">
              Active Repository
            </div>
          </div>

          {/* Card 3: Indexed Chunks */}
          <div className="bg-[#18181b] border border-zinc-800/80 rounded-md p-3.5 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Indexed Chunks
            </div>
            <div className="flex items-baseline space-x-2 pt-0.5">
              <span className="text-2xl font-semibold text-blue-400 tracking-tight font-mono">
                {totalChunks}
              </span>
              <span className="text-xs text-zinc-400 font-mono">vectors</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono pt-0.5">
              pgvector (384-d dense)
            </div>
          </div>

          {/* Card 4: Inference Engine */}
          <div className="bg-[#18181b] border border-zinc-800/80 rounded-md p-3.5 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Inference Engine
            </div>
            <div className="flex items-center space-x-2 pt-0.5">
              <CpuIcon size={15} className="text-blue-400" />
              <span className="text-sm font-semibold text-zinc-200 font-mono">
                Ollama
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono truncate pt-0.5">
              qwen2.5:7b (Local)
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Knowledge Repository & Query Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Documents Table */}
          <div className="bg-[#121215] border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div>
                <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono flex items-center gap-2">
                  <DocumentIcon size={15} className="text-zinc-400" />
                  <span>Document Repository</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Latest files ingested and indexed in pgvector
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ChevronRightIcon size={14} />}
                onClick={() => navigate('/documents')}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                View All
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-mono uppercase text-zinc-500 border-b border-zinc-800/80">
                  <tr>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Chunks</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 font-mono">
                  {documents.slice(0, 5).map((doc) => (
                    <tr key={doc.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 max-w-[220px]">
                        <div className="font-medium text-zinc-200 truncate font-sans">{doc.title}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{doc.filename}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            doc.classification === 'TOP_SECRET' ? 'danger' :
                            doc.classification === 'SECRET' ? 'warning' : 'classified'
                          }
                          size="sm"
                        >
                          {(doc.classification || 'CONFIDENTIAL').replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300">
                        {doc.chunk_count}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded ${
                          doc.status === 'READY' || doc.status === 'PROCESSED' || doc.status === 'INDEXED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : doc.status === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            doc.status === 'READY' || doc.status === 'PROCESSED' || doc.status === 'INDEXED'
                              ? 'bg-emerald-500'
                              : doc.status === 'FAILED'
                              ? 'bg-rose-500'
                              : 'bg-blue-500'
                          }`} />
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => navigate(`/documents/${doc.id}`)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}

                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center font-mono">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">NO DOCUMENTS</div>
                          <p className="text-[11px] text-zinc-500 font-sans">
                            Your secure knowledge repository is empty.
                          </p>
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<UploadIcon size={13} />}
                              onClick={() => navigate('/documents')}
                            >
                              Upload Document
                            </Button>
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
          <div className="bg-[#121215] border border-zinc-800/80 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div>
                <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono flex items-center gap-2">
                  <ChatIcon size={15} className="text-zinc-400" />
                  <span>Recent Query Sessions</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Dialogue sessions and grounded evidence queries
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ChevronRightIcon size={14} />}
                onClick={() => navigate('/chat')}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Open Assistant
              </Button>
            </div>

            <div className="divide-y divide-zinc-800/50 mt-2">
              {recentConversations.slice(0, 4).map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/chat?convId=${conv.id}`)}
                  className="py-2.5 px-2 hover:bg-zinc-800/40 rounded cursor-pointer transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-200 truncate font-sans">{conv.title}</div>
                    <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                      {conv.document_title ? (
                        <span className="text-blue-400 truncate max-w-[200px]">Doc: {conv.document_title}</span>
                      ) : (
                        <span>Repository-wide</span>
                      )}
                      <span>·</span>
                      <span>{conv.message_count} messages</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    Ready
                  </span>
                </div>
              ))}

              {recentConversations.length === 0 && (
                <div className="py-6 text-center text-zinc-500 font-mono text-xs">
                  No active query sessions recorded. Launch Query Assistant to execute inquiries.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Service Health & Pipeline Parameters */}
        <div className="space-y-6">
          {/* Service Health */}
          <div className="bg-[#121215] border border-zinc-800/80 rounded-lg p-5 space-y-4">
            <div className="pb-3 border-b border-zinc-800/80">
              <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <ServerIcon size={15} className="text-zinc-400" />
                <span>Service Health</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Local system components status
              </p>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {/* Backend API */}
              <div className="flex items-center justify-between p-2.5 rounded bg-[#18181b] border border-zinc-800/80">
                <span className="text-zinc-400">FastAPI Backend</span>
                {healthLoading ? (
                  <span className="text-zinc-500 text-[10px]">CHECKING...</span>
                ) : isBackendOnline ? (
                  <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> CONNECTED
                  </span>
                ) : (
                  <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> OFFLINE (FIXTURE)
                  </span>
                )}
              </div>

              {/* Database */}
              <div className="flex items-center justify-between p-2.5 rounded bg-[#18181b] border border-zinc-800/80">
                <span className="text-zinc-400">PostgreSQL</span>
                {healthLoading ? (
                  <span className="text-zinc-500 text-[10px]">CHECKING...</span>
                ) : health?.database === 'CONNECTED' ? (
                  <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> CONNECTED
                  </span>
                ) : (
                  <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> OFFLINE
                  </span>
                )}
              </div>

              {/* Vector Store */}
              <div className="flex items-center justify-between p-2.5 rounded bg-[#18181b] border border-zinc-800/80">
                <span className="text-zinc-400">pgvector Index</span>
                {healthLoading ? (
                  <span className="text-zinc-500 text-[10px]">CHECKING...</span>
                ) : health?.vectorDb === 'READY' ? (
                  <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> READY
                  </span>
                ) : (
                  <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> UNAVAILABLE
                  </span>
                )}
              </div>

              {/* LLM Engine */}
              <div className="flex items-center justify-between p-2.5 rounded bg-[#18181b] border border-zinc-800/80">
                <span className="text-zinc-400">Ollama Local LLM</span>
                {healthLoading ? (
                  <span className="text-zinc-500 text-[10px]">CHECKING...</span>
                ) : isBackendOnline ? (
                  <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> READY
                  </span>
                ) : (
                  <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> OFFLINE
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline Parameters */}
          <div className="bg-[#121215] border border-zinc-800/80 rounded-lg p-5 space-y-3">
            <div className="pb-3 border-b border-zinc-800/80">
              <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldIcon size={15} className="text-zinc-400" />
                <span>Security & Ingestion</span>
              </h2>
            </div>

            <div className="space-y-2 text-xs font-mono text-zinc-300">
              <div className="flex justify-between py-1 border-b border-zinc-800/60 text-[11px]">
                <span className="text-zinc-500">Host UID:</span>
                <span className="text-zinc-200">{status?.node_id || 'LOCAL-01'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60 text-[11px]">
                <span className="text-zinc-500">Network Isolation:</span>
                <span className="text-emerald-400 font-medium">Air-Gapped (Private)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60 text-[11px]">
                <span className="text-zinc-500">Embedding:</span>
                <span className="text-zinc-200">all-MiniLM-L6-v2</span>
              </div>
              <div className="flex justify-between py-1 text-[11px]">
                <span className="text-zinc-500">Cloud Sync:</span>
                <span className="text-zinc-400">Disabled</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center text-xs mt-3"
              onClick={() => navigate('/settings')}
            >
              Pipeline Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
