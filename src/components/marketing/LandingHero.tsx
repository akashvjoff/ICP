import React from 'react';
import { SectionEyebrow } from '../ui/SectionEyebrow';
import { BrutalistLink } from '../ui/BrutalistButton';
import { StickerBadge } from '../ui/StickerBadge';
import { BrutalistCard } from '../ui/BrutalistCard';
import { ArrowRight, Sparkles } from 'lucide-react';

export const LandingHero: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b-[3px] border-[#0A0A0A]">
      <div className="mx-auto max-w-6xl px-6">
        {/* Floating stickers on top */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <SectionEyebrow color="bg-[#6AAAFB]">
            AI-ASSISTED ANALYSIS
          </SectionEyebrow>

          <div className="flex items-center gap-2.5">
            <StickerBadge color="lime" rotate="-2">
              EXPLAINABLE FIT SCORE
            </StickerBadge>
            <StickerBadge color="purple" rotate="2" className="hidden sm:inline-flex">
              RULE-BASED SCORING
            </StickerBadge>
          </div>
        </div>

        {/* Massive Hero Heading (76-96px range fluid clamp) */}
        <div className="max-w-4xl mb-4">
          <h1 className="text-3xl sm:text-6xl md:text-7xl lg:text-[76px] font-black text-[#0A0A0A] tracking-tighter leading-[0.98] text-balance">
            Figure out who your <span className="bg-[#A1F000] px-2 py-0.5 rounded-lg border-[2.5px] border-[#0A0A0A] shadow-[3px_4px_0px_#0A0A0A] inline-block -rotate-1">best customers</span> are.
          </h1>
        </div>

        <p className="mb-7 text-xl font-black italic leading-snug tracking-tight text-[#315700] sm:text-2xl md:text-3xl">
          <span className="inline-block max-w-full rounded-md border-2 border-[#0A0A0A] bg-[#A1F000] px-3 py-1 shadow-[3px_3px_0px_#0A0A0A]">
            Let’s FigureIt together.
          </span>
        </p>

        {/* Subhead with bold clarity */}
        <p className="text-lg sm:text-xl text-[#0A0A0A]/80 max-w-2xl font-medium leading-relaxed mb-10">
          AI-assisted analysis with an explainable, rule-based score helps you find your ideal B2B customers. Prioritize leads and plan your go-to-market strategy.
        </p>

        {/* Hero Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-16">
          <BrutalistLink
            variant="lime"
            size="lg"
            href="/demo"
            icon={<ArrowRight className="w-5 h-5" />}
          >
            FIND MY IDEAL CUSTOMERS
          </BrutalistLink>

          <BrutalistLink
            variant="white"
            size="lg"
            href="/demo#accounts-heading"
            icon={<Sparkles className="w-5 h-5 text-[#8C6ADE]" />}
          >
            EXPLORE DEMO
          </BrutalistLink>
        </div>

        {/* Supporting Hero Cards Strip (Pastel yellow, lavender, mint, pink) */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <BrutalistCard bg="peach" hoverable shadowSize="sm" className="p-5">
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white/80 px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-3">
              01 // PAIN GRAVITY
            </span>
            <h2 className="mb-2 text-lg font-black leading-tight tracking-tight text-[#0A0A0A]">
              Ideal customer profile analysis
            </h2>
            <p className="text-sm leading-relaxed text-[#0A0A0A]/80">
              Identify the customer problems your product solves and where buyer need is strongest.
            </p>
          </BrutalistCard>

          <BrutalistCard bg="lavender" hoverable shadowSize="sm" className="p-5">
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white/80 px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-3">
              02 // BUYING UNIT
            </span>
            <h2 className="mb-2 text-lg font-black leading-tight tracking-tight text-[#0A0A0A]">
              B2B buying committee insights
            </h2>
            <p className="text-sm leading-relaxed text-[#0A0A0A]/80">
              Map decision makers, internal champions, and barriers to buying in each account.
            </p>
          </BrutalistCard>

          <BrutalistCard bg="mint" hoverable shadowSize="sm" className="p-5">
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white/80 px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-3">
              03 // POSITIONING
            </span>
            <h2 className="mb-2 text-lg font-black leading-tight tracking-tight text-[#0A0A0A]">
              Customer segmentation &amp; positioning
            </h2>
            <p className="text-sm leading-relaxed text-[#0A0A0A]/80">
              Group B2B leads by shared needs and find a clearer position for each segment.
            </p>
          </BrutalistCard>

          <BrutalistCard bg="pink" hoverable shadowSize="sm" className="p-5">
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white/80 px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-3">
              04 // AUDIT PROOF
            </span>
            <h2 className="mb-2 text-lg font-black leading-tight tracking-tight text-[#0A0A0A]">
              Explainable lead scoring
            </h2>
            <p className="text-sm leading-relaxed text-[#0A0A0A]/80">
              Prioritize accounts with a 0–100 fit score and an itemized breakdown of the result.
            </p>
          </BrutalistCard>
        </div>
      </div>
    </section>
  );
};
