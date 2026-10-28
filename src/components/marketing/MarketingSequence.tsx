import React from 'react';
import { SectionHeading } from '../ui/SectionHeading';
import { PastelStepCard } from '../ui/PastelStepCard';
import { BrutalistCard } from '../ui/BrutalistCard';
import { StickerBadge } from '../ui/StickerBadge';
import { IconMedallion } from '../ui/IconMedallion';
import { Target, Users, GitFork, Layers, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

export const MarketingSequence: React.FC = () => {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 border-b-[3px] border-[#0A0A0A]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="HOW FIGUREDIT WORKS"
          eyebrowColor="bg-[#6AAAFB]"
          title="A four-step path from lead list to ICP hypothesis."
          description="Use your offering and lead evidence to examine need, buying context, segments, and positioning."
        />

        {/* 4 Pastel Step Cards in Sequence */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <PastelStepCard
            stepNumber="01"
            bg="peach"
            title="Need Gap Analysis"
            subtitle="PROBLEM GRAVITY"
            description="Estimates how closely available account evidence matches the need your offering addresses."
            takeaway="Shows the estimated need level and supporting evidence."
            icon={<Target className="w-5 h-5 text-white" />}
            iconColor="purple"
          />

          <PastelStepCard
            stepNumber="02"
            bg="lavender"
            title="5C Dynamics"
            subtitle="DECISION ENVIRONMENT"
            description="Explores likely buying roles, competing options, and external context when evidence is available."
            takeaway="Highlights open questions about budget and decision makers."
            icon={<Users className="w-5 h-5 text-[#0A0A0A]" />}
            iconColor="lime"
          />

          <PastelStepCard
            stepNumber="03"
            bg="mint"
            title="STP Strategy"
            subtitle="SEGMENT & POSITION"
            description="Clusters accounts by shared business problems rather than generic industry verticals; assigns targeting priority."
            takeaway="Suggests positioning angles for your review."
            icon={<GitFork className="w-5 h-5 text-[#0A0A0A]" />}
            iconColor="blue"
          />

          <PastelStepCard
            stepNumber="04"
            bg="pink"
            title="Marketing Mix"
            subtitle="MARKET FIT CHECK"
            description="Reviews how your offering, price assumptions, and outreach messages align with available account evidence."
            takeaway="Flags assumptions to validate in outreach."
            icon={<Layers className="w-5 h-5 text-white" />}
            iconColor="purple"
          />
        </div>

        {/* Governance Rule: Hypothesis vs Validated ICP */}
        <BrutalistCard bg="white" shadowSize="lg" className="p-7 sm:p-9 border-[3px] border-[#0A0A0A]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <StickerBadge color="peach" rotate="-2">
                  ICP QUALITY CHECK
                </StickerBadge>
                <span className="font-mono text-xs font-bold uppercase text-[#0A0A0A]/60">
                  WORKING HYPOTHESIS
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-[#0A0A0A] tracking-tight">
                An ICP hypothesis needs real outcomes.
              </h3>

              <p className="text-sm sm:text-base text-[#0A0A0A]/85 leading-relaxed font-normal">
                A lead list can suggest fit, but it cannot prove who will buy. Treat your initial ICP as a <span className="bg-[#FFE3B3] px-1.5 py-0.5 rounded border border-[#0A0A0A] font-bold">working hypothesis</span> until real outreach, deal outcomes, and retention data support it.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono font-bold text-[#0A0A0A]">
                <span className="bg-[#E4E6FB] px-2.5 py-1 rounded-md border border-[#0A0A0A]">
                  1. Initial Fit Estimate
                </span>
                <span>→</span>
                <span className="bg-[#FFE3B3] px-2.5 py-1 rounded-md border border-[#0A0A0A]">
                  2. Customer Outreach
                </span>
                <span>→</span>
                <span className="bg-[#A1F000] px-2.5 py-1 rounded-md border border-[#0A0A0A]">
                  3. Outcome Review
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="p-4 bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span className="font-mono text-xs font-bold uppercase text-[#0A0A0A]">
                    Starting Point
                  </span>
                </div>
                <p className="text-xs text-[#0A0A0A]/75 leading-relaxed font-medium">
                  Uses your lead list and offering to highlight possible need and fit. Findings remain a hypothesis.
                </p>
              </div>

              <div className="p-4 bg-[#E5F7E5] border-[2px] border-[#0A0A0A] rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span className="font-mono text-xs font-bold uppercase text-[#0A0A0A]">
                    What to Validate
                  </span>
                </div>
                <p className="text-xs text-[#0A0A0A]/75 leading-relaxed font-medium">
                  Compare win rates, deal size, and retention against targets you set for your business.
                </p>
              </div>
            </div>
          </div>
        </BrutalistCard>
      </div>
    </section>
  );
};
