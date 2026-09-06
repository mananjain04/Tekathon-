import React from 'react';
import { ShieldIcon, ServerIcon, CheckIcon } from '../icons';

export const SecurityBanner: React.FC = () => {
  return (
    <div className="bg-[#0c0c0e] border-b border-zinc-800 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono tracking-tight text-zinc-400 select-none z-30">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 text-zinc-200 font-medium">
          <ShieldIcon size={13} className="text-blue-500" />
          <span className="tracking-wide">KAVACH PLATFORM</span>
        </div>
        <span className="text-zinc-700">|</span>
        <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Local Private Node</span>
        </div>
        <span className="text-zinc-700 hidden sm:inline">|</span>
        <div className="hidden sm:flex items-center space-x-1.5 text-zinc-400">
          <ServerIcon size={12} className="text-zinc-500" />
          <span>pgvector (384-d) · Ollama (qwen2.5:7b)</span>
        </div>
      </div>

      <div className="flex items-center space-x-3 text-zinc-400">
        <div className="flex items-center space-x-1.5">
          <CheckIcon size={12} className="text-emerald-500" />
          <span className="text-zinc-300">Zero Cloud Egress</span>
        </div>
        <span className="text-zinc-700 hidden md:inline">|</span>
        <div className="hidden md:inline text-zinc-500">
          Audit Compliant
        </div>
      </div>
    </div>
  );
};
