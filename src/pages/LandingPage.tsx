import React from 'react';
import { AppNavbar } from '../components/ui/AppNavbar';
import { LandingHero } from '../components/marketing/LandingHero';
import { MarketingSequence } from '../components/marketing/MarketingSequence';
import { InteractiveTeaser } from '../components/marketing/InteractiveTeaser';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen max-w-full overflow-x-clip bg-[#F9F8F4] text-[#0A0A0A] flex flex-col font-sans selection:bg-[#A1F000] selection:text-[#0A0A0A]">
      <AppNavbar />

      <main className="flex-1">
        <LandingHero />
        <MarketingSequence />
        <InteractiveTeaser />
      </main>

      {/* Footer */}
      <footer className="border-t-[3px] border-[#0A0A0A] py-10 px-6 sm:px-8 bg-[#F9F8F4] text-[#0A0A0A]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tighter text-[#0A0A0A]">
              Figured<span className="text-[#5F3EB5]">It</span>
            </span>
            <span className="font-mono text-xs text-[#0A0A0A]/40 font-bold">/</span>
            <span className="font-mono text-xs font-bold text-[#0A0A0A]/70">
              Figure out who your best customers are.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono font-bold text-[#0A0A0A]">
            <a href="https://figuredit.in" className="underline hover:text-[#8C6ADE]">figuredit.in</a>
            <a href="/demo" className="underline hover:text-[#8C6ADE]">EXPLORE DEMO</a>
            <a href="/about" className="underline hover:text-[#8C6ADE]">ABOUT & Q&A</a>
            <a href="/guides/ideal-customer-profile-from-leads" className="underline hover:text-[#8C6ADE]">ICP GUIDE</a>
            <a href="/privacy" className="underline hover:text-[#8C6ADE]">PRIVACY</a>
            <a href="/pricing" className="underline hover:text-[#8C6ADE]">PRICING</a>
            <a href="/terms" className="underline hover:text-[#8C6ADE]">TERMS</a>
            <a href="/refund-policy" className="underline hover:text-[#8C6ADE]">REFUNDS</a>
            <a href="/contact" className="underline hover:text-[#8C6ADE]">CONTACT</a>
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
              RULE-BASED SCORING
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
