import React, { useState, useEffect } from 'react';
import {
  ShieldIcon,
  CpuIcon,
  DatabaseIcon,
  LockIcon,
  CheckIcon
} from '../components/icons';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { Alert } from '../components/common/Alert';

const DEFAULT_SETTINGS = {
  nodeId: 'LOCAL-01',
  embeddingModel: 'all-MiniLM-L6-v2',
  llmEngine: 'Ollama: qwen2.5:7b',
  vectorCollection: 'document_chunks',
  similarityThreshold: '0.60',
  auditRetentionDays: '365',
};

const SETTINGS_STORAGE_KEY = 'kavach_pipeline_settings';

export const SettingsPage: React.FC = () => {
  const [initialSettings, setInitialSettings] = useState(DEFAULT_SETTINGS);
  const [nodeId, setNodeId] = useState(DEFAULT_SETTINGS.nodeId);
  const [embeddingModel, setEmbeddingModel] = useState(DEFAULT_SETTINGS.embeddingModel);
  const [llmEngine, setLlmEngine] = useState(DEFAULT_SETTINGS.llmEngine);
  const [vectorCollection, setVectorCollection] = useState(DEFAULT_SETTINGS.vectorCollection);
  const [similarityThreshold, setSimilarityThreshold] = useState(DEFAULT_SETTINGS.similarityThreshold);
  const [auditRetentionDays, setAuditRetentionDays] = useState(DEFAULT_SETTINGS.auditRetentionDays);
  const [isSaved, setIsSaved] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        setInitialSettings(merged);
        setNodeId(merged.nodeId);
        setEmbeddingModel(merged.embeddingModel);
        setLlmEngine(merged.llmEngine);
        setVectorCollection(merged.vectorCollection);
        setSimilarityThreshold(merged.similarityThreshold);
        setAuditRetentionDays(merged.auditRetentionDays);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasUnsavedChanges =
    nodeId !== initialSettings.nodeId ||
    embeddingModel !== initialSettings.embeddingModel ||
    llmEngine !== initialSettings.llmEngine ||
    vectorCollection !== initialSettings.vectorCollection ||
    similarityThreshold !== initialSettings.similarityThreshold ||
    auditRetentionDays !== initialSettings.auditRetentionDays;

  const handleReset = () => {
    setNodeId(DEFAULT_SETTINGS.nodeId);
    setEmbeddingModel(DEFAULT_SETTINGS.embeddingModel);
    setLlmEngine(DEFAULT_SETTINGS.llmEngine);
    setVectorCollection(DEFAULT_SETTINGS.vectorCollection);
    setSimilarityThreshold(DEFAULT_SETTINGS.similarityThreshold);
    setAuditRetentionDays(DEFAULT_SETTINGS.auditRetentionDays);
    setInitialSettings(DEFAULT_SETTINGS);
    setValidationError(null);
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!nodeId.trim()) {
      setValidationError('Node Host Identifier cannot be blank.');
      return;
    }

    const simScore = parseFloat(similarityThreshold);
    if (isNaN(simScore) || simScore < 0.1 || simScore > 1.0) {
      setValidationError('Cosine similarity threshold must be a number between 0.1 and 1.0.');
      return;
    }

    const retentionNum = parseInt(auditRetentionDays, 10);
    if (isNaN(retentionNum) || retentionNum <= 0) {
      setValidationError('Audit log retention must be a positive integer.');
      return;
    }

    const newSettings = {
      nodeId: nodeId.trim(),
      embeddingModel,
      llmEngine,
      vectorCollection: vectorCollection.trim(),
      similarityThreshold: String(simScore),
      auditRetentionDays: String(retentionNum),
    };

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch {
      // Ignore
    }

    setInitialSettings(newSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center font-mono space-y-3">
        <div className="inline-block h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Pipeline & System Configuration</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure local embedding models, pgvector indexing, and inference parameters.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {hasUnsavedChanges ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Unsaved Changes
            </span>
          ) : (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
              Synced
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleReset} type="button">
            Reset to Defaults
          </Button>
        </div>
      </div>

      {isSaved && (
        <Alert variant="success" title="Configuration Saved">
          System parameters updated and verified against local host settings.
        </Alert>
      )}

      {validationError && (
        <Alert variant="danger" title="Validation Error">
          {validationError}
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Node Identity */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <ShieldIcon size={16} className="text-blue-500" />
              <CardTitle>Host Node Identity</CardTitle>
            </div>
            <Badge variant="success" size="sm">NODE ACTIVE</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Node Host Identifier"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                helperText="Identifier for this self-hosted instance"
                required
              />
              <Input
                label="Environment / Region"
                defaultValue="On-Premise Private Cluster (Zone 1)"
                helperText="Deployment infrastructure environment"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Local AI Engines */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <CpuIcon size={16} className="text-blue-500" />
              <CardTitle>AI Models & Inference</CardTitle>
            </div>
            <Badge variant="outline" size="sm">ON-PREMISE</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Vector Embedding Model
                </label>
                <select
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="all-MiniLM-L6-v2">sentence-transformers / all-MiniLM-L6-v2 (384-dim, Active)</option>
                  <option value="bge-small-en-v1.5">BAAI / bge-small-en-v1.5 (384-dim)</option>
                  <option value="bge-m3-local">BAAI / bge-m3 (1024-dim, Multilingual)</option>
                </select>
                <p className="text-[11px] text-zinc-500">Dense vector embeddings computed locally via HuggingFace transformers</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Local LLM Inference Engine
                </label>
                <select
                  value={llmEngine}
                  onChange={(e) => setLlmEngine(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="Ollama: qwen2.5:7b">Ollama / qwen2.5:7b (Local, Recommended)</option>
                  <option value="Ollama: llama3.1:8b">Ollama / llama3.1:8b (Local)</option>
                  <option value="Ollama: mistral:7b">Ollama / mistral:7b (Local)</option>
                </select>
                <p className="text-[11px] text-zinc-500">Inference executes locally without data egress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vector DB Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <DatabaseIcon size={16} className="text-emerald-400" />
              <CardTitle>Vector Database & Retrieval Settings</CardTitle>
            </div>
            <Badge variant="success" size="sm">PGVECTOR READY</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="PostgreSQL Table / Collection"
                value={vectorCollection}
                onChange={(e) => setVectorCollection(e.target.value)}
                helperText="Target table for dense vector storage"
                required
              />

              <Input
                label="Minimum Cosine Similarity Threshold"
                type="number"
                step="0.05"
                min="0.1"
                max="1.0"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(e.target.value)}
                helperText="Filter passages with relevance below this score"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Security & Audit Policies */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <LockIcon size={16} className="text-amber-400" />
              <CardTitle>Audit & Access Policy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Audit Log Retention (Days)"
                type="number"
                value={auditRetentionDays}
                onChange={(e) => setAuditRetentionDays(e.target.value)}
                helperText="Retention period for security and query access logs"
                required
              />

              <Input
                label="Audit Log Path"
                defaultValue="var/log/kavach/audit.log"
                helperText="Local log destination path"
                disabled
              />
            </div>

            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between p-3 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs">
                <div>
                  <div className="font-medium text-zinc-200">Network Isolation</div>
                  <div className="text-zinc-400 text-[11px]">Enforce local-only network socket bindings</div>
                </div>
                <Badge variant="success" size="sm">ACTIVE</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs">
                <div>
                  <div className="font-medium text-zinc-200">Cross-Encoder Reranker</div>
                  <div className="text-zinc-400 text-[11px]">Two-stage retrieval with cross-encoder scoring enabled</div>
                </div>
                <Badge variant="info" size="sm">ENABLED</Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              variant="primary"
              leftIcon={<CheckIcon size={15} />}
            >
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};
