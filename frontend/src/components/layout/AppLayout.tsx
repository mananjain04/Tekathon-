import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden select-none bg-slate-950 font-sans">
      {/* 1. Global High-Resolution Earth Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-all duration-700"
        style={{
          backgroundImage: `url('/earth-bg.jpg')`,
          filter: 'brightness(0.88) contrast(1.02)',
        }}
      />

      {/* 2. Ambient Atmosphere Vignette Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/5 via-transparent to-black/20" />

      {/* 3. Left Frosted Glass Sovereign Sidebar */}
      <div className="relative z-30 flex shrink-0">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* 4. Center / Right Content Panel */}
      <div className="relative z-10 flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Top Frosted Navbar */}
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Scrollable Editorial Workspace */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

