import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldIcon, LockIcon, ServerIcon, AlertTriangleIcon } from '../components/icons';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { authApi, formatApiErrorMessage } from '../services/api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [operatorId, setOperatorId] = useState('admin');
  const [passphrase, setPassphrase] = useState('Kavach@2026!');
  const [clearanceLevel, setClearanceLevel] = useState('TOP_SECRET');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authApi.login(operatorId.trim(), passphrase);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(formatApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const selectPreset = (user: string, pass: string, clearance: string) => {
    setOperatorId(user);
    setPassphrase(pass);
    setClearanceLevel(clearance);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-between text-zinc-100">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121215] border border-zinc-800/90 rounded-xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-blue-500 shadow-inner">
              <ShieldIcon size={28} />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">Sign in to Kavach</h2>
              <p className="text-xs text-zinc-400 mt-1">Enterprise On-Premise Document Intelligence & RAG</p>
            </div>
            <div className="pt-1 flex justify-center gap-2">
              <Badge variant="success" size="sm">Local Node: Active</Badge>
              <Badge variant="default" size="sm">Air-Gapped</Badge>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs text-rose-400 flex items-start space-x-2">
              <AlertTriangleIcon size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Operator Identity / Service ID"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              placeholder="e.g. admin or admin@kavach.local"
              leftIcon={<ShieldIcon size={15} />}
              required
            />

            <Input
              label="Passphrase / Security Token"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter secure passphrase"
              leftIcon={<LockIcon size={15} />}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Security Clearance Level
              </label>
              <select
                value={clearanceLevel}
                onChange={(e) => setClearanceLevel(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              >
                <option value="TOP_SECRET">TOP_SECRET (Full Administrative Clearance)</option>
                <option value="SECRET">SECRET (Analyst Ingestion Clearance)</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL (Standard Repository)</option>
                <option value="RESTRICTED">RESTRICTED (Read-Only Viewer)</option>
              </select>
            </div>

            {/* Quick-fill Role Buttons */}
            <div className="pt-1">
              <span className="text-[10px] text-zinc-500 font-mono block mb-1.5 uppercase">Quick Access Enclave Roles:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => selectPreset('admin', 'Kavach@2026!', 'TOP_SECRET')}
                  className={`px-2 py-1.5 rounded border text-[11px] font-mono transition-colors ${
                    operatorId === 'admin'
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('analyst', 'Kavach@2026!', 'SECRET')}
                  className={`px-2 py-1.5 rounded border text-[11px] font-mono transition-colors ${
                    operatorId === 'analyst'
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  🔬 Analyst
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('viewer', 'Kavach@2026!', 'RESTRICTED')}
                  className={`px-2 py-1.5 rounded border text-[11px] font-mono transition-colors ${
                    operatorId === 'viewer'
                      ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  👁️ Viewer
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-medium mt-2"
              isLoading={isLoading}
            >
              Sign In to Workspace
            </Button>
          </form>

          <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-md text-[11px] text-zinc-400 flex items-center space-x-2">
            <ServerIcon size={14} className="text-zinc-500 shrink-0" />
            <span>Local deployment running on private host without external telemetry.</span>
          </div>
        </div>
      </div>

      <div className="py-4 text-center text-xs text-zinc-600 font-mono">
        Kavach Platform · Build 2026.09 · Self-Hosted Local Instance
      </div>
    </div>
  );
};
