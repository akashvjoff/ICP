import React from 'react';
import { SectionEyebrow } from '../ui/SectionEyebrow';
import { BrutalistLink } from '../ui/BrutalistButton';
import { StickerBadge } from '../ui/StickerBadge';
import { BrutalistCard } from '../ui/BrutalistCard';
import { ArrowRight, Sparkles, Target, Zap, CheckCircle, ShieldCheck } from 'lucide-react';

export const LandingHero: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b-[3px] border-[#0A0A0A]">
      <div className="mx-auto max-w-6xl px-6">
        {/* Floating stickers on top */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <SectionEyebrow color="bg-[#6AAAFB]">
            THE ALGORITHMIC B2B STRATEGY ENGINE
          </SectionEyebrow>

          <div className="flex items-center gap-2.5">
            <StickerBadge color="lime" rotate="-2">
              100% EXPLAINABLE FIT
            </StickerBadge>
            <StickerBadge color="purple" rotate="2" className="hidden sm:inline-flex">
              CLASSICAL 4-STAGE PIPELINE
            </StickerBadge>
          </div>
        </div>

        {/* Massive Hero Heading (76-96px range fluid clamp) */}
        <div className="max-w-4xl mb-8">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-black text-[#0A0A0A] tracking-tighter leading-[0.98] text-balance">
            Find customers who <span className="bg-[#A1F000] px-2 py-0.5 rounded-lg border-[2.5px] border-[#0A0A0A] shadow-[3px_4px_0px_#0A0A0A] inline-block -rotate-1">actually need</span> what you build.
          </h1>
        </div>

        {/* Subhead with bold clarity */}
        <p className="text-lg sm:text-xl text-[#0A0A0A]/80 max-w-2xl font-medium leading-relaxed mb-10">
          Stop burning outbound budget on raw company headcount. icp.mode models real buyer motivation through <strong className="text-[#0A0A0A] font-black">Need Gap Analysis</strong>, <strong className="text-[#0A0A0A] font-black">5C Dynamics</strong>, and <strong className="text-[#0A0A0A] font-black">Deterministic Fit Scoring</strong>.
        </p>

        {/* Hero Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-16">
          <BrutalistLink
            variant="lime"
            size="lg"
            href="/demo"
            icon={<ArrowRight className="w-5 h-5" />}
          >
            START ICP DISCOVERY
          </BrutalistLink>

          <BrutalistLink
            variant="white"
            size="lg"
            href="/demo#accounts-heading"
            icon={<Sparkles className="w-5 h-5 text-[#8C6ADE]" />}
          >
            LOAD 5 SAMPLE B2B LEADS
          </BrutalistLink>
        </div>

        {/* Supporting Hero Cards Strip (Pastel yellow, lavender, mint, pink) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <BrutalistCard bg="peach" hoverable shadowSize="sm" className="p-5">
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white/80 px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-3">
              01 // PAIN GRAVITY
            </span>
            <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight mb-1">
              Need Gap Analysis
            </h3>
            <p className="text-xs text-[#0A0A0A]/80 leading-relaxed">
              Detects acute business friction versus casual exploratory interest.
            </p>
          </BrutalistCard>

          <BrutalistCard bg="lavender" hoverable shadowSize="sm" className="p-5">
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white/80 px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-3">
              02 // BUYING UNIT
            </span>
            <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight mb-1">
              5C Stakeholders
            </h3>
            <p className="text-xs text-[#0A0A0A]/80 leading-relaxed">
              Maps economic buyers, internal champions, and switching inertia.
            </p>
          </BrutalistCard>

          <BrutalistCard bg="mint" hoverable shadowSize="sm" className="p-5">
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white/80 px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-3">
              03 // POSITIONING
            </span>
            <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight mb-1">
              STP Strategy
            </h3>
            <p className="text-xs text-[#0A0A0A]/80 leading-relaxed">
              Clusters leads by shared business problem instead of superficial industry tags.
            </p>
          </BrutalistCard>

          <BrutalistCard bg="pink" hoverable shadowSize="sm" className="p-5">
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white/80 px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-3">
              04 // AUDIT PROOF
            </span>
            <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight mb-1">
              Pure Arithmetic
            </h3>
            <p className="text-xs text-[#0A0A0A]/80 leading-relaxed">
              Deterministic 0-100 fit score with full itemized point breakdown.
            </p>
          </BrutalistCard>
        </div>
      </div>
    </section>
  );
};
