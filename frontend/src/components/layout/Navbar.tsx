import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MenuIcon, ShieldIcon } from '../icons';
import { api, HealthStatus } from '../../services/api';

export interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getHealthStatus().then((h) => {
      if (mounted) setHealth(h);
    }).catch(() => {
      if (mounted) setHealth({ backend: 'OFFLINE', database: 'DISCONNECTED' });
    });
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const getPageInfo = (pathname: string) => {
    if (pathname.startsWith('/dashboard')) {
      return { section: 'Workspace', title: 'Overview' };
    }
    if (pathname.startsWith('/documents/')) {
      return { section: 'Workspace', title: 'Document Inspector' };
    }
    if (pathname.startsWith('/documents')) {
      return { section: 'Workspace', title: 'Document Repository' };
    }
    if (pathname.startsWith('/chat')) {
      return { section: 'Workspace', title: 'Query Assistant' };
    }
    if (pathname.startsWith('/settings')) {
      return { section: 'System', title: 'Pipeline Settings' };
    }
    return { section: 'Workspace', title: 'Overview' };
  };

  const { section, title } = getPageInfo(location.pathname);

  return (
    <header className="h-14 px-4 sm:px-8 flex items-center justify-between z-20 shrink-0 select-none bg-transparent">
      {/* Left: App Breadcrumbs matching reference */}
      <div className="flex items-center space-x-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-600 hover:text-black hover:bg-white/40 md:hidden backdrop-blur-sm"
            aria-label="Toggle navigation menu"
          >
            <MenuIcon size={18} />
          </button>
        )}

        <div className="flex items-center space-x-2 text-xs font-mono">
          <div className="flex items-center space-x-1.5 font-medium text-slate-600">
            <ShieldIcon size={13} className="text-slate-700" />
            <span className="font-bold text-slate-800 tracking-wider">KAVACH</span>
          </div>
          <span className="text-slate-400">/</span>
          <span className="text-slate-600 text-[11px] hidden sm:inline">{section}</span>
          <span className="text-slate-400 hidden sm:inline">/</span>
          <span className="font-bold text-black tracking-tight">{title}</span>
        </div>
      </div>

      {/* Right: Operational Telemetry & User Pills matching reference */}
      <div className="flex items-center space-x-2.5">
        <div className="hidden sm:flex items-center space-x-2">
          {health?.backend === 'ONLINE' ? (
            <div className="flex items-center space-x-1.5 bg-white/75 backdrop-blur-md border border-white/80 px-3 py-1 rounded-full text-slate-800 text-[11px] font-mono font-bold shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs" />
              <span>BACKEND ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-amber-50/80 backdrop-blur-md border border-amber-200 px-3 py-1 rounded-full text-amber-900 text-[11px] font-mono font-bold shadow-xs">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>BACKEND OFFLINE</span>
            </div>
          )}

          <div className="flex items-center space-x-1 bg-white/75 backdrop-blur-md border border-white/80 px-3 py-1 rounded-full text-slate-800 text-[11px] font-mono font-bold shadow-xs">
            <span className="text-slate-500">DB:</span>
            <span className={health?.database === 'CONNECTED' ? 'text-slate-900' : 'text-rose-600'}>
              {health?.database === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate('/settings')}
          className="flex items-center space-x-2 bg-white/75 backdrop-blur-md border border-white/80 px-2.5 py-1 rounded-full text-slate-900 text-xs font-mono font-bold shadow-xs hover:bg-white transition-colors"
          title="User Profile & Settings"
        >
          <div className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-extrabold">
            AD
          </div>
          <span className="text-[11px] tracking-wider hidden md:inline">ADMIN</span>
        </button>
      </div>
    </header>
  );
};

