import React from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { StatusChip } from '../components/ui/StatusChip';
import { StickerBadge } from '../components/ui/StickerBadge';
import { formatScore, formatHeadcount } from '../lib/formatters';
import {
  Building2,
  Globe,
  ExternalLink,
  ArrowLeft,
  Check,
  X,
  ShieldAlert,
  Zap,
  Target,
  Users,
  Layers,
} from 'lucide-react';

export const CompanyProfilePage: React.FC<{ params: { id: string } }> = ({ params }) => {
  const { navigate } = useRouter();
  const { leads, scores, analysis } = useAppStore();

  const companyId = params.id;
  const lead = leads.find(l => l.id === companyId) || leads[0];
  const score = scores.find(s => s.leadId === (lead ? lead.id : companyId)) || scores[0];
  const needGap = analysis.needGaps.find(g => g.leadId === (lead ? lead.id : companyId));

  if (!lead || !score) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <h2 className="text-2xl font-black">Company Not Found</h2>
          <BrutalistButton variant="lime" size="md" onClick={() => navigate('/companies')}>
            ← BACK TO COMPANIES
          </BrutalistButton>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b-[2.5px] border-[#0A0A0A] pb-5">
          <button
            onClick={() => navigate('/companies')}
            className="font-mono text-xs font-bold text-[#0A0A0A] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO COMPANY DIRECTORY</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#0A0A0A]/60">
              COHORT STATUS:
            </span>
            <StatusChip
              color={score.totalScore >= 80 ? 'mint' : score.totalScore >= 60 ? 'peach' : 'pink'}
            >
              {score.tier}
            </StatusChip>
          </div>
        </div>

        {/* Company Heading & Core Metadata */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <SectionEyebrow color="bg-[#A1F000]">
              INDIVIDUAL COMPANY INTELLIGENCE
            </SectionEyebrow>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-4xl sm:text-5xl font-black text-[#0A0A0A] tracking-tight">
                {lead.companyName}
              </h1>
              {lead.domain ? (
                <a
                  href={`https://${lead.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs font-bold text-[#8C6ADE] underline underline-offset-4 flex items-center gap-1"
                >
                  <span>{lead.domain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="font-mono text-xs font-bold text-[#0A0A0A]/60 italic">
                  [No domain provided]
                </span>
              )}
            </div>

            <p className="mt-3 text-base text-[#0A0A0A]/80 font-medium leading-relaxed max-w-2xl">
              {lead.description}
            </p>
          </div>

          {/* Large ICP Score Box */}
          <div className="bg-white border-[3px] border-[#0A0A0A] rounded-2xl p-5 shadow-[5px_6px_0px_#0A0A0A] shrink-0 text-center min-w-[180px]">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#0A0A0A]/60 block mb-1">
              DETERMINISTIC FIT
            </span>
            <div className="flex items-baseline justify-center gap-1.5 my-1 font-mono">
              <span className="text-4xl font-black text-[#0A0A0A] tabular-nums">
                {formatScore(score.totalScore)}
              </span>
              <span className="text-sm font-bold text-[#0A0A0A]/40">/ 100</span>
            </div>
            <span className="font-mono text-[11px] font-black uppercase text-[#0A0A0A] bg-[#FFE3B3] px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mt-1">
              {score.recommendedAction}
            </span>
          </div>
        </div>

        {/* Four Firmographic Specification Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
            <span className="text-[#0A0A0A]/60 font-bold block mb-0.5">VERTICAL</span>
            <span className="font-black text-[#0A0A0A] text-sm block truncate">{lead.industry}</span>
          </div>
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
            <span className="text-[#0A0A0A]/60 font-bold block mb-0.5">HEADCOUNT</span>
            <span className="font-black text-[#0A0A0A] text-sm block tabular-nums">{formatHeadcount(lead.headcount)}</span>
          </div>
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
            <span className="text-[#0A0A0A]/60 font-bold block mb-0.5">REVENUE</span>
            <span className="font-black text-[#0A0A0A] text-sm block tabular-nums">{lead.annualRevenue || 'Undisclosed'}</span>
          </div>
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
            <span className="text-[#0A0A0A]/60 font-bold block mb-0.5">BUSINESS MODEL</span>
            <span className="font-black text-[#0A0A0A] text-sm block truncate">
              {lead.aiClassification?.businessModel || 'B2B SaaS'}
            </span>
          </div>
        </div>

        {/* Need Gap & Problem Explanation Card */}
        {needGap && (
          <BrutalistCard bg="peach" shadowSize="md" className="p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/20 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#0A0A0A]" />
                <h3 className="text-lg font-black text-[#0A0A0A]">
                  Need Gap Analysis & Problem Gravity
                </h3>
              </div>
              <StatusChip color={needGap.gapMagnitude === 'Acute' ? 'lime' : 'peach'}>
                {needGap.gapMagnitude} Need Gap ({needGap.gapScore} pts)
              </StatusChip>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/70 block mb-1">
                  IDENTIFIED FRICTION
                </span>
                <p className="text-sm font-bold text-[#0A0A0A] leading-relaxed">
                  {needGap.identifiedNeed}
                </p>
                <div className="mt-2 text-[#0A0A0A]/85 font-medium">
                  <strong>Urgency Trigger:</strong> {needGap.urgencyDriver}
                </div>
              </div>

              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/70 block mb-1">
                  CONSEQUENCE OF INACTION
                </span>
                <p className="text-sm font-semibold text-[#0A0A0A]/90 leading-relaxed">
                  {needGap.consequenceOfInaction}
                </p>
                <div className="mt-2 text-[#0A0A0A]/85 font-medium">
                  <strong>Capability Match:</strong> {needGap.offeringCapabilityMatch}
                </div>
              </div>
            </div>
          </BrutalistCard>
        )}

        {/* Buying Unit & 5C Context */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BrutalistCard bg="lavender" shadowSize="md" className="p-6 space-y-3">
            <div className="flex items-center gap-2 border-b-[2px] border-[#0A0A0A]/20 pb-2">
              <Users className="w-4 h-4 text-[#0A0A0A]" />
              <h3 className="text-base font-black text-[#0A0A0A]">
                Target Buying Committee
              </h3>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Economic Buyer</span>
                <p className="font-extrabold text-[#0A0A0A] text-sm">{analysis.fiveC.customers.economicBuyer}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Internal Champion</span>
                <p className="font-extrabold text-[#0A0A0A] text-sm">{analysis.fiveC.customers.championPersona}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Primary Friction Obstacle</span>
                <p className="text-[#0A0A0A] font-medium">{analysis.fiveC.customers.primaryObstacle}</p>
              </div>
            </div>
          </BrutalistCard>

          <BrutalistCard bg="mint" shadowSize="md" className="p-6 space-y-3">
            <div className="flex items-center gap-2 border-b-[2px] border-[#0A0A0A]/20 pb-2">
              <Layers className="w-4 h-4 text-[#0A0A0A]" />
              <h3 className="text-base font-black text-[#0A0A0A]">
                Detected Architecture & Stack
              </h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <span className="text-[#0A0A0A]/60 font-bold block">DETECTED TECHNOLOGIES</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {lead.technologies.map((tech, i) => (
                  <span
                    key={i}
                    className="bg-white border-[1.5px] border-[#0A0A0A] px-2 py-0.5 rounded-md font-bold text-[#0A0A0A] shadow-[1px_1px_0px_#0A0A0A]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
              <p className="font-sans text-[#0A0A0A]/80 font-medium text-xs pt-2">
                Primary products: {lead.aiClassification?.primaryProducts?.join(', ') || 'Enterprise Platform'}
              </p>
            </div>
          </BrutalistCard>
        </div>

        {/* Itemized Score Ledger */}
        <BrutalistCard bg="white" shadowSize="lg" className="p-7 space-y-5">
          <div className="border-b-[2px] border-[#0A0A0A]/15 pb-3">
            <h3 className="text-lg font-black text-[#0A0A0A]">
              Itemized Mathematical Point Ledger
            </h3>
            <p className="text-xs text-[#0A0A0A]/70 font-medium">
              Transparent, explainable audit points contributing to {formatScore(score.totalScore)} / 100.
            </p>
          </div>

          <div className="space-y-3">
            {score.breakdown.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-4 space-y-1.5 shadow-[2px_2px_0px_#0A0A0A]"
              >
                <div className="flex justify-between items-center font-mono">
                  <span className="font-black text-sm text-[#0A0A0A]">{item.criterion}</span>
                  <span className="tabular-nums font-black text-base text-[#0A0A0A]">
                    {item.awardedPoints} / {item.maxPoints} pts
                  </span>
                </div>
                <p className="text-xs text-[#0A0A0A]/80 font-medium leading-relaxed">
                  {item.auditRationale}
                </p>
              </div>
            ))}
          </div>

          {/* Strengths & Disqualifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
            <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] rounded-xl p-4">
              <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-700" /> Key Strengths
              </span>
              <ul className="space-y-1 text-xs font-medium text-[#0A0A0A]">
                {score.primaryStrengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] rounded-xl p-4">
              <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-700" /> Disqualifiers
              </span>
              {score.primaryDisqualifiers.length > 0 ? (
                <ul className="space-y-1 text-xs font-bold text-rose-950">
                  {score.primaryDisqualifiers.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <X className="w-3.5 h-3.5 text-rose-700 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-800 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Zero disqualifiers observed.
                </p>
              )}
            </div>
          </div>
        </BrutalistCard>
      </div>
    </AppLayout>
  );
};
