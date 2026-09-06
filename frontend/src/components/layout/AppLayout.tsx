import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SecurityBanner } from './SecurityBanner';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Enclave Security Banner */}
      <SecurityBanner />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sovereign Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Center / Right Content Panel */}
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-950">
          <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/60">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
