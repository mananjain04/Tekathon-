import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardIcon,
  DocumentIcon,
  ChatIcon,
  SettingsIcon,
  ShieldIcon,
  LogOutIcon,
  XIcon,
} from '../icons';
import { api } from '../../services/api';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getDocuments().then((docs) => {
      if (mounted) setDocCount(docs.length);
    }).catch(() => {
      if (mounted) setDocCount(null);
    });
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const handleLogout = () => {
    navigate('/login');
  };

  const navLinkClasses = (isActive: boolean) =>
    `group flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent'
    }`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`w-60 bg-[#0c0c0e] border-r border-zinc-800/80 flex flex-col justify-between h-full select-none shrink-0 z-40 transition-transform duration-200
          ${isOpen ? 'fixed inset-y-0 left-0 shadow-2xl' : 'hidden md:flex'}`}
      >
        <div>
          <div className="px-4 py-4 border-b border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-blue-600/10 text-blue-500 rounded-md border border-blue-500/20">
                <ShieldIcon size={18} />
              </div>
              <div>
                <div className="font-semibold tracking-tight text-xs text-zinc-100 flex items-center gap-1.5">
                  <span>Kavach</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800 text-zinc-300 rounded font-mono font-normal">
                    v1.0
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Document Intelligence
                </p>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 md:hidden"
                aria-label="Close sidebar"
              >
                <XIcon size={16} />
              </button>
            )}
          </div>

          <div className="p-3 space-y-5">
            <div>
              <div className="px-2 pb-1.5 text-[10px] font-mono tracking-wider text-zinc-500 uppercase font-semibold">
                Platform
              </div>
              <div className="space-y-1">
                <NavLink to="/dashboard" className={({ isActive }) => navLinkClasses(isActive)}>
                  <div className="flex items-center space-x-2.5">
                    <DashboardIcon size={15} className="text-zinc-400 group-hover:text-zinc-200 shrink-0" />
                    <span>Overview</span>
                  </div>
                </NavLink>

                <NavLink to="/documents" className={({ isActive }) => navLinkClasses(isActive)}>
                  <div className="flex items-center space-x-2.5">
                    <DocumentIcon size={15} className="text-zinc-400 group-hover:text-zinc-200 shrink-0" />
                    <span>Documents</span>
                  </div>
                  {docCount !== null && (
                    <span className="text-[11px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                      {docCount}
                    </span>
                  )}
                </NavLink>

                <NavLink to="/chat" className={({ isActive }) => navLinkClasses(isActive)}>
                  <div className="flex items-center space-x-2.5">
                    <ChatIcon size={15} className="text-zinc-400 group-hover:text-zinc-200 shrink-0" />
                    <span>Query Assistant</span>
                  </div>
                </NavLink>
              </div>
            </div>

            <div>
              <div className="px-2 pb-1.5 text-[10px] font-mono tracking-wider text-zinc-500 uppercase font-semibold">
                Configuration
              </div>
              <div className="space-y-1">
                <NavLink to="/settings" className={({ isActive }) => navLinkClasses(isActive)}>
                  <div className="flex items-center space-x-2.5">
                    <SettingsIcon size={15} className="text-zinc-400 group-hover:text-zinc-200 shrink-0" />
                    <span>Pipeline Settings</span>
                  </div>
                </NavLink>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-zinc-800/80 space-y-3 bg-[#0a0a0c]">
          <div className="p-2.5 rounded-md bg-[#121215] border border-zinc-800/80 space-y-1 text-xs">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
              <span>Local Engine</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <div className="text-[11px] text-zinc-300 font-medium">
              Ollama · qwen2.5:7b
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Dense Index: pgvector (384-d)
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2 truncate">
              <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-xs font-medium text-zinc-200 shrink-0">
                AD
              </div>
              <div className="truncate">
                <div className="text-xs font-medium text-zinc-200 truncate">Administrator</div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">Role: ADMIN</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/60 transition-colors"
            >
              <LogOutIcon size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
