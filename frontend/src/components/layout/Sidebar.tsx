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
    `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all duration-200 ${
      isActive
        ? 'bg-neutral-900/10 text-black font-bold shadow-xs backdrop-blur-md'
        : 'text-slate-600 hover:text-black hover:bg-black/[0.04] font-medium'
    }`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`w-64 kavach-glass-sidebar flex flex-col justify-between h-full select-none shrink-0 z-40 transition-transform duration-200
          ${isOpen ? 'fixed inset-y-0 left-0 shadow-2xl' : 'hidden md:flex'}`}
      >
        <div>
          {/* Top Logo & Branding matching reference */}
          <div className="px-6 pt-7 pb-6 flex items-start justify-between">
            <div>
              <div className="text-2xl font-black tracking-tight text-black leading-none uppercase">
                KAVACH
              </div>
              <p className="text-[9px] font-semibold tracking-[0.25em] text-slate-500 uppercase mt-1">
                DOCUMENT INTELLIGENCE
              </p>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-500 hover:text-black md:hidden"
                aria-label="Close sidebar"
              >
                <XIcon size={16} />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <div className="px-3.5 space-y-1">
            <NavLink to="/dashboard" className={({ isActive }) => navLinkClasses(isActive)}>
              <div className="flex items-center space-x-3">
                <DashboardIcon size={16} className="shrink-0 text-slate-700 group-hover:text-black" />
                <span>Overview</span>
              </div>
            </NavLink>

            <NavLink to="/documents" className={({ isActive }) => navLinkClasses(isActive)}>
              <div className="flex items-center space-x-3">
                <DocumentIcon size={16} className="shrink-0 text-slate-700 group-hover:text-black" />
                <span>Documents</span>
              </div>
              {docCount !== null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-mono font-semibold">
                  {docCount}
                </span>
              )}
            </NavLink>

            <NavLink to="/chat" className={({ isActive }) => navLinkClasses(isActive)}>
              <div className="flex items-center space-x-3">
                <ChatIcon size={16} className="shrink-0 text-slate-700 group-hover:text-black" />
                <span>Query Assistant</span>
              </div>
            </NavLink>

            <NavLink to="/settings" className={({ isActive }) => navLinkClasses(isActive)}>
              <div className="flex items-center space-x-3">
                <ShieldIcon size={16} className="shrink-0 text-slate-700 group-hover:text-black" />
                <span>Security</span>
              </div>
            </NavLink>

            <NavLink to="/settings" className={({ isActive }) => navLinkClasses(isActive)}>
              <div className="flex items-center space-x-3">
                <SettingsIcon size={16} className="shrink-0 text-slate-700 group-hover:text-black" />
                <span>Pipeline Settings</span>
              </div>
            </NavLink>
          </div>
        </div>

        {/* Bottom Status & Profile Area matching reference */}
        <div className="p-4 space-y-3">
          {/* Node Status Box */}
          <div className="p-3.5 rounded-xl bg-white/60 border border-white/80 shadow-xs space-y-1 text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold">
              <span>Local Private Node</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-[10px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
            <div className="text-[11px] text-slate-800 font-medium">
              Ollama · qwen2.5-7b
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Dense Index: pgvector (384-d)
            </div>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center space-x-2.5 truncate">
              <div className="h-8 w-8 rounded-full bg-neutral-900 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                AD
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 truncate">Administrator</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">Role: ADMIN</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-black/5 transition-colors"
            >
              <LogOutIcon size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

