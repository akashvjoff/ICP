import React from 'react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onPrimaryAction: () => void;
  isWorkspace: boolean;
  onToggleView: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onPrimaryAction,
  isWorkspace,
  onToggleView,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/8 bg-[#090a0f]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6">
        {/* Zone 1: Brand Wordmark (Single text element in display face, no sub-badges) */}
        <button
          onClick={onToggleView}
          className="flex items-center text-left text-lg font-semibold tracking-tight text-white hover:text-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>icp.mode</span>
        </button>

        {/* Zone 2: 4-5 Clean single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            onClick={() => {
              if (!isWorkspace) onToggleView();
              onSelectTab('overview');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'overview' && isWorkspace
                ? 'text-sky-400'
                : 'hover:text-white text-slate-400'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => {
              if (!isWorkspace) onToggleView();
              onSelectTab('offering');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'offering' && isWorkspace
                ? 'text-sky-400'
                : 'hover:text-white text-slate-400'
            }`}
          >
            Offering Profile
          </button>
          <button
            onClick={() => {
              if (!isWorkspace) onToggleView();
              onSelectTab('ingestion');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'ingestion' && isWorkspace
                ? 'text-sky-400'
                : 'hover:text-white text-slate-400'
            }`}
          >
            Lead Ingestion
          </button>
          <button
            onClick={() => {
              if (!isWorkspace) onToggleView();
              onSelectTab('pipeline');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'pipeline' && isWorkspace
                ? 'text-sky-400'
                : 'hover:text-white text-slate-400'
            }`}
          >
            Strategic Pipeline
          </button>
          <button
            onClick={() => {
              if (!isWorkspace) onToggleView();
              onSelectTab('dossier');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'dossier' && isWorkspace
                ? 'text-sky-400'
                : 'hover:text-white text-slate-400'
            }`}
          >
            ICP Dossier
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onPrimaryAction}
            className="px-4 py-2 text-xs font-medium text-slate-900 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm shadow-sky-500/10"
          >
            {isWorkspace ? 'New Lead Analysis' : 'Open Workspace'}
          </button>
        </div>
      </div>
    </header>
  );
};
