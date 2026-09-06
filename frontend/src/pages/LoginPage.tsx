import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldIcon, LockIcon, ServerIcon } from '../components/icons';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [operatorId, setOperatorId] = useState('admin@kavach.local');
  const [passphrase, setPassphrase] = useState('••••••••••••');
  const [clearanceLevel, setClearanceLevel] = useState('TOP_SECRET');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard');
    }, 400);
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
              <Badge variant="default" size="sm">Private</Badge>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Operator Identity / Service ID"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              placeholder="e.g. admin@kavach.local"
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
                <option value="TOP_SECRET">TOP_SECRET (Full Access)</option>
                <option value="SECRET">SECRET (Operational Documents)</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL (Standard Repository)</option>
                <option value="RESTRICTED">RESTRICTED (Read-Only)</option>
              </select>
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
