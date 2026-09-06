import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MenuIcon, SettingsIcon, ShieldIcon } from '../icons';
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
    <header className="h-12 border-b border-zinc-800 bg-[#09090b]/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left: App Breadcrumbs */}
      <div className="flex items-center space-x-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 md:hidden"
            aria-label="Toggle navigation menu"
          >
            <MenuIcon size={18} />
          </button>
        )}

        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1.5 font-medium text-zinc-300">
            <ShieldIcon size={14} className="text-blue-500" />
            <span className="font-semibold text-zinc-100 tracking-tight">Kavach</span>
          </div>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 font-mono text-[11px] hidden sm:inline">{section}</span>
          <span className="text-zinc-600 hidden sm:inline">/</span>
          <span className="font-medium text-zinc-200">{title}</span>
        </div>
      </div>

      {/* Right: Operational Telemetry & Controls */}
      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex items-center space-x-2 font-mono text-xs">
          {health?.backend === 'ONLINE' ? (
            <div className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded text-emerald-400 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium">● BACKEND ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded text-amber-300 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="font-medium">○ BACKEND OFFLINE</span>
            </div>
          )}

          <div className="flex items-center space-x-1 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400 text-[11px]">
            <span className="text-zinc-500">DB:</span>
            <span className={health?.database === 'CONNECTED' ? 'text-emerald-400' : 'text-zinc-500'}>
              {health?.database === 'CONNECTED' ? 'CONNECTED' : 'UNAVAILABLE'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 pl-2 border-l border-zinc-800">
          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            title="System Settings"
          >
            <SettingsIcon size={15} />
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="flex items-center space-x-1.5 px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-xs font-mono"
            title="User Profile"
          >
            <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-[10px] font-bold">
              A
            </div>
            <span className="hidden md:inline text-[11px]">ADMIN</span>
          </button>
        </div>
      </div>
    </header>
  );
};
