import React from 'react';
import { useRouter } from '../lib/router';
import { AppNavbar } from '../components/ui/AppNavbar';
import { LandingHero } from '../components/marketing/LandingHero';
import { MarketingSequence } from '../components/marketing/MarketingSequence';
import { InteractiveTeaser } from '../components/marketing/InteractiveTeaser';
import { useAppStore } from '../lib/store';

export const LandingPage: React.FC = () => {
  const { navigate } = useRouter();
  const { resetToDemoData } = useAppStore();

  const handleStart = () => {
    navigate('/dashboard');
  };

  const handleLoadSample = () => {
    resetToDemoData();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F9F8F4] text-[#0A0A0A] flex flex-col font-sans selection:bg-[#A1F000] selection:text-[#0A0A0A]">
      <AppNavbar
        currentTab="landing"
        onSelectTab={(tab) => {
          if (tab === 'overview') navigate('/dashboard');
          else if (tab === 'offering') navigate('/onboarding');
          else if (tab === 'ingestion') navigate('/uploads/new');
          else if (tab === 'pipeline') navigate('/segments');
          else if (tab === 'dossier') navigate('/companies');
        }}
        onPrimaryAction={handleStart}
        isWorkspace={false}
        onToggleView={() => navigate('/dashboard')}
      />

      <main className="flex-1">
        <LandingHero
          onEnterWorkspace={handleStart}
          onLoadSample={handleLoadSample}
        />
        <MarketingSequence />
        <InteractiveTeaser
          onLaunchWorkspace={handleStart}
        />
      </main>

      {/* Footer */}
      <footer className="border-t-[3px] border-[#0A0A0A] py-10 px-6 sm:px-8 bg-[#F9F8F4] text-[#0A0A0A]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tighter text-[#0A0A0A]">
              icp<span className="text-[#A1F000]">.</span>mode
            </span>
            <span className="font-mono text-xs text-[#0A0A0A]/40 font-bold">/</span>
            <span className="font-mono text-xs font-bold text-[#0A0A0A]/70 uppercase">
              The Customer-Fit Engine
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono font-bold text-[#0A0A0A]">
            <span className="bg-white px-2 py-0.5 rounded border border-[#0A0A0A]">
              NEED GAP ANALYSIS
            </span>
            <span className="bg-white px-2 py-0.5 rounded border border-[#0A0A0A]">
              5C DYNAMICS
            </span>
            <span className="bg-white px-2 py-0.5 rounded border border-[#0A0A0A]">
              STP STRATEGY
            </span>
            <span className="bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A]">
              DETERMINISTIC MATH
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
