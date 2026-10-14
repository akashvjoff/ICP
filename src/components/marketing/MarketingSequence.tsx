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
          eyebrow="CLASSICAL MARKETING SEQUENCE"
          eyebrowColor="bg-[#6AAAFB]"
          title="The 4-stage pipeline that eliminates outbound guesswork."
          description="Surface industry taxonomies lie. FiguredIt models customer decision-making using the exact sequence practiced by enterprise GTM strategists."
        />

        {/* 4 Pastel Step Cards in Sequence */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <PastelStepCard
            stepNumber="01"
            bg="peach"
            title="Need Gap Analysis"
            subtitle="PROBLEM GRAVITY"
            description="Evaluates whether the prospect experiences acute business pain, moderate friction, or zero operational consequence."
            takeaway="Calculates gap magnitude (Acute, Moderate, Latent, Negligible)."
            icon={<Target className="w-5 h-5 text-white" />}
            iconColor="purple"
          />

          <PastelStepCard
            stepNumber="02"
            bg="lavender"
            title="5C Dynamics"
            subtitle="DECISION ENVIRONMENT"
            description="Maps the target account's buying committee (economic buyer, champions), competitor inertia, and macro compliance context."
            takeaway="Unpacks who holds budget authority and what halts deals."
            icon={<Users className="w-5 h-5 text-[#0A0A0A]" />}
            iconColor="lime"
          />

          <PastelStepCard
            stepNumber="03"
            bg="mint"
            title="STP Strategy"
            subtitle="SEGMENT & POSITION"
            description="Clusters accounts by shared business problems rather than generic industry verticals; assigns targeting priority."
            takeaway="Generates tailored high-converting positioning angles."
            icon={<GitFork className="w-5 h-5 text-[#0A0A0A]" />}
            iconColor="blue"
          />

          <PastelStepCard
            stepNumber="04"
            bg="pink"
            title="Marketing Mix"
            subtitle="RESONANCE VERIFICATION"
            description="Tests the prospect against Product capabilities, Pricing acceptability (ACV vs payroll), and Promotion hook appeal."
            takeaway="Pre-verifies economic fit before launching outreach."
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
                  GOVERNANCE CONTRACT
                </StickerBadge>
                <span className="font-mono text-xs font-bold uppercase text-[#0A0A0A]/60">
                  CRITICAL INVARIANT
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-[#0A0A0A] tracking-tight">
                An ICP Hypothesis is not a Validated ICP.
              </h3>

              <p className="text-sm sm:text-base text-[#0A0A0A]/85 leading-relaxed font-normal">
                Lead lists without verified historical closed-won or closed-lost conversion data <strong className="text-[#0A0A0A] font-bold">cannot mathematically prove ideal customer quality</strong>. In FiguredIt, initial evaluations are explicitly governed as an <span className="bg-[#FFE3B3] px-1.5 py-0.5 rounded border border-[#0A0A0A] font-bold">ICP Hypothesis</span> until conversion velocity and retention metrics validate the cohort.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono font-bold text-[#0A0A0A]">
                <span className="bg-[#E4E6FB] px-2.5 py-1 rounded-md border border-[#0A0A0A]">
                  1. Theoretical Alignment
                </span>
                <span>→</span>
                <span className="bg-[#FFE3B3] px-2.5 py-1 rounded-md border border-[#0A0A0A]">
                  2. Outbound Sprints
                </span>
                <span>→</span>
                <span className="bg-[#A1F000] px-2.5 py-1 rounded-md border border-[#0A0A0A]">
                  3. Deal Outcome Validation
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="p-4 bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span className="font-mono text-xs font-bold uppercase text-[#0A0A0A]">
                    Lead List Ingestion Stage
                  </span>
                </div>
                <p className="text-xs text-[#0A0A0A]/75 leading-relaxed font-medium">
                  Identifies accounts with acute need urgency and tech stack overlap. Marked strictly as Hypothesis.
                </p>
              </div>

              <div className="p-4 bg-[#E5F7E5] border-[2px] border-[#0A0A0A] rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span className="font-mono text-xs font-bold uppercase text-[#0A0A0A]">
                    Validated ICP Criteria
                  </span>
                </div>
                <p className="text-xs text-[#0A0A0A]/75 leading-relaxed font-medium">
                  Requires ≥20% win-rate, target ACV realization, and measurable retention proof.
                </p>
              </div>
            </div>
          </div>
        </BrutalistCard>
      </div>
    </section>
  );
};
