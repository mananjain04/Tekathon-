import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldIcon, ServerIcon, AlertTriangleIcon } from '../components/icons';
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
    <div className="relative min-h-screen flex flex-col justify-between select-none overflow-hidden font-sans">
      {/* 1. Earth Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url('/earth-bg.jpg')`,
          filter: 'brightness(0.65) contrast(1.05)',
        }}
      />
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/25 via-transparent to-black/40" />

      {/* 2. Frosted Glass Login Enclave Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md kavach-glass-panel p-8 sm:p-10 space-y-6 border border-white/90 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-neutral-900 text-white shadow-md mb-1">
              <ShieldIcon size={28} />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500 uppercase">
                SOVEREIGN DOCUMENT AI
              </div>
              <h1 className="text-3xl font-black tracking-tight text-black uppercase leading-tight mt-0.5">
                KAVACH
              </h1>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Enterprise On-Premise Document Intelligence & RAG
              </p>
            </div>
            <div className="pt-1 flex justify-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                ● Local Node: Active
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                Air-Gapped
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2.5 shadow-xs font-medium">
              <AlertTriangleIcon size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                Operator Identity / Service ID
              </label>
              <input
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                placeholder="e.g. admin or admin@kavach.local"
                className="w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 font-medium shadow-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                Passphrase / Security Token
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter secure passphrase"
                className="w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 font-medium shadow-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                Security Clearance Level
              </label>
              <select
                value={clearanceLevel}
                onChange={(e) => setClearanceLevel(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-slate-900 font-mono shadow-xs"
              >
                <option value="TOP_SECRET">TOP_SECRET (Full Administrative Clearance)</option>
                <option value="SECRET">SECRET (Analyst Ingestion Clearance)</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL (Standard Repository)</option>
                <option value="RESTRICTED">RESTRICTED (Read-Only Viewer)</option>
              </select>
            </div>

            {/* Quick-fill Role Buttons */}
            <div className="pt-1">
              <span className="text-[10px] text-slate-500 font-mono block mb-1.5 font-bold uppercase">
                Quick Access Enclave Roles:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => selectPreset('admin', 'Kavach@2026!', 'TOP_SECRET')}
                  className={`px-2 py-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                    operatorId === 'admin'
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                      : 'bg-white/80 border-slate-200 text-slate-700 hover:text-black hover:bg-white'
                  }`}
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('analyst', 'Kavach@2026!', 'SECRET')}
                  className={`px-2 py-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                    operatorId === 'analyst'
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                      : 'bg-white/80 border-slate-200 text-slate-700 hover:text-black hover:bg-white'
                  }`}
                >
                  🔬 Analyst
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('viewer', 'Kavach@2026!', 'RESTRICTED')}
                  className={`px-2 py-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                    operatorId === 'viewer'
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                      : 'bg-white/80 border-slate-200 text-slate-700 hover:text-black hover:bg-white'
                  }`}
                >
                  👁️ Viewer
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold shadow-md transition-all mt-3 flex items-center justify-center gap-2"
            >
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Workspace'}</span>
            </button>
          </form>

          <div className="p-3 bg-slate-100/80 border border-slate-200/80 rounded-xl text-[11px] text-slate-600 flex items-center space-x-2 font-medium">
            <ServerIcon size={14} className="text-slate-700 shrink-0" />
            <span>Local deployment running on private host without external telemetry.</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 py-4 text-center text-xs text-white/80 font-mono font-semibold">
        Kavach Platform · Build 2026.09 · Self-Hosted Sovereign Enclave
      </div>
    </div>
  );
};

