import React, { useState } from 'react';
import { SAMPLE_LEADS, SAMPLE_SCORES } from '../../lib/mockData';
import { formatScore } from '../../lib/formatters';
import { SectionHeading } from '../ui/SectionHeading';
import { BrutalistCard } from '../ui/BrutalistCard';
import { StickerBadge } from '../ui/StickerBadge';
import { StatusChip } from '../ui/StatusChip';
import { BrutalistLink } from '../ui/BrutalistButton';
import { Check, X, ShieldAlert, Zap, ArrowRight } from 'lucide-react';

export const InteractiveTeaser: React.FC = () => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>('lead-01');

  const selectedLead = SAMPLE_LEADS.find(l => l.id === selectedLeadId) || SAMPLE_LEADS[0];
  const selectedScore = SAMPLE_SCORES.find(s => s.leadId === selectedLeadId) || SAMPLE_SCORES[0];

  return (
    <section id="test-drive" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <SectionHeading
            eyebrow="SAMPLE SCORE BREAKDOWN"
            eyebrowColor="bg-[#A1F000]"
            title="See how a sample score is broken down."
            description="Toggle between fictional accounts to inspect illustrative score components. Your results depend on your own offering and lead evidence."
            className="mb-0"
          />

          <BrutalistLink
            variant="lime"
            size="md"
            href="/demo"
            icon={<ArrowRight className="w-4 h-4" />}
            className="self-start md:self-auto shrink-0"
          >
            TRY THE KEYWORD PREVIEW
          </BrutalistLink>
        </div>

        <p className="mb-4 font-mono text-xs font-bold text-[#0A0A0A]/70">ILLUSTRATIVE SAMPLE · FICTIONAL ACCOUNTS, SCORES &amp; RECOMMENDATIONS</p>
        {/* Lead Switcher Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 mb-8">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0A0A0A] mr-2">
            SELECT ACCOUNT:
          </span>
          {SAMPLE_LEADS.slice(0, 3).map((lead) => {
            const isSelected = lead.id === selectedLeadId;
            return (
              <button
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className={`
                  px-3.5 py-2
                  rounded-xl
                  border-[2.5px] border-[#0A0A0A]
                  font-mono text-xs font-bold
                  transition-all duration-120 cursor-pointer
                  ${isSelected
                    ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[3px_4px_0px_#0A0A0A] -translate-y-0.5'
                    : 'bg-white text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#F9F8F4]'
                  }
                `}
              >
                {lead.companyName}
              </button>
            );
          })}

          {/* Disqualified lead example */}
          {SAMPLE_LEADS[4] && (
            <button
              onClick={() => setSelectedLeadId(SAMPLE_LEADS[4].id)}
              className={`
                px-3.5 py-2
                rounded-xl
                border-[2.5px] border-[#0A0A0A]
                font-mono text-xs font-bold
                transition-all duration-120 cursor-pointer
                ${selectedLeadId === SAMPLE_LEADS[4].id
                  ? 'bg-[#FFB6C2] text-[#0A0A0A] shadow-[3px_4px_0px_#0A0A0A] -translate-y-0.5'
                  : 'bg-white text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#FFB6C2]/30'
                }
              `}
            >
              {SAMPLE_LEADS[4].companyName} (Disqualified Lead)
            </button>
          )}
        </div>

        {/* Main Brutalist Comparison Panel */}
        <BrutalistCard bg="white" shadowSize="lg" className="p-6 sm:p-8 border-[3px] border-[#0A0A0A]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Lead Profile (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                    {selectedLead.companyName}
                  </h3>
                  <span className="font-mono text-xs font-bold text-[#0A0A0A]/60 bg-[#F9F8F4] px-2 py-0.5 rounded border border-[#0A0A0A]">
                    {selectedLead.domain}
                  </span>
                </div>
                <p className="text-sm text-[#0A0A0A]/80 leading-relaxed font-normal">
                  {selectedLead.description}
                </p>
              </div>

              {/* Firmographic Specs */}
              <div className="space-y-2 border-t-[2px] border-[#0A0A0A]/15 pt-4 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-[#0A0A0A]/10">
                  <span className="text-[#0A0A0A]/60 font-bold">INDUSTRY</span>
                  <span className="text-[#0A0A0A] font-bold">{selectedLead.industry}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#0A0A0A]/10">
                  <span className="text-[#0A0A0A]/60 font-bold">HEADCOUNT</span>
                  <span className="text-[#0A0A0A] font-bold tabular-nums">{selectedLead.headcount} FTE</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#0A0A0A]/10">
                  <span className="text-[#0A0A0A]/60 font-bold">REVENUE</span>
                  <span className="text-[#0A0A0A] font-bold tabular-nums">{selectedLead.annualRevenue}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#0A0A0A]/60 font-bold">TECH STACK</span>
                  <span className="text-[#0A0A0A] font-bold text-right truncate max-w-[200px]">
                    {selectedLead.technologies.slice(0, 3).join(', ')}
                  </span>
                </div>
              </div>

              {/* Action Recommendation Card */}
              <div className={`p-4 rounded-xl border-[2px] border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] ${
                selectedScore.totalScore >= 80 ? 'bg-[#E5F7E5]' :
                selectedScore.totalScore >= 60 ? 'bg-[#FFE3B3]' : 'bg-[#FFB6C2]'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A]">
                    RECOMMENDED GTM ACTION:
                  </span>
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    {selectedScore.recommendedAction}
                  </span>
                </div>
                <p className="text-xs text-[#0A0A0A]/85 leading-relaxed font-medium">
                  {selectedScore.totalScore >= 80 
                    ? 'High-priority outbound cohort. Acute compliance trigger creates open buying window.'
                    : selectedScore.totalScore >= 60
                    ? 'Nurture cadence. Monitor for modern warehouse migration and VP hiring.'
                    : 'Disqualified from outreach due to severe architecture incompatibility.'}
                </p>
              </div>
            </div>

            {/* Right: Mathematical Score Ledger (7 cols) */}
            <div className="lg:col-span-7 bg-[#F9F8F4] border-[2.5px] border-[#0A0A0A] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/20 pb-4 mb-6">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-[#0A0A0A]/60 uppercase tracking-wider">
                      RULE-BASED FIT SCORE
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-4xl sm:text-5xl font-black font-mono tabular-nums text-[#0A0A0A]">
                        {formatScore(selectedScore.totalScore)}
                      </span>
                      <span className="font-mono text-base font-bold text-[#0A0A0A]/40">/ 100</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-[11px] font-bold text-[#0A0A0A]/60 uppercase tracking-wider block mb-1">
                      CLASSIFICATION
                    </span>
                    <StatusChip
                      color={selectedScore.totalScore >= 80 ? 'mint' : selectedScore.totalScore >= 60 ? 'peach' : 'pink'}
                    >
                      {selectedScore.tier}
                    </StatusChip>
                  </div>
                </div>

                {/* Score Breakdown Bars with brutalist progress */}
                <div className="space-y-4">
                  {selectedScore.breakdown.map((item, idx) => {
                    const pct = (item.awardedPoints / item.maxPoints) * 100;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="font-bold text-[#0A0A0A]">{item.criterion}</span>
                          <span className="tabular-nums font-bold text-[#0A0A0A]">
                            <strong>{item.awardedPoints}</strong> / {item.maxPoints} pts
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-white border-[1.5px] border-[#0A0A0A] rounded-md overflow-hidden p-0.5">
                          <div 
                            className={`h-full rounded-xs transition-all duration-200 ${
                              pct >= 75 ? 'bg-[#A1F000]' : pct >= 50 ? 'bg-[#FFE3B3]' : 'bg-[#FFB6C2]'
                            }`}
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#0A0A0A]/70 leading-tight font-medium">
                          {item.auditRationale}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strengths & Disqualifiers */}
              <div className="mt-6 border-t-[2px] border-[#0A0A0A]/20 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A] block mb-2 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    Key Strengths
                  </span>
                  {selectedScore.primaryStrengths.length > 0 ? (
                    <ul className="space-y-1.5">
                      {selectedScore.primaryStrengths.map((s, i) => (
                        <li key={i} className="text-[#0A0A0A] font-medium flex items-start gap-1.5 leading-snug">
                          <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[#0A0A0A]/50 italic">None observed</p>
                  )}
                </div>

                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A] block mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Disqualifiers
                  </span>
                  {selectedScore.primaryDisqualifiers.length > 0 ? (
                    <ul className="space-y-1.5">
                      {selectedScore.primaryDisqualifiers.map((d, i) => (
                        <li key={i} className="text-rose-900 font-bold flex items-start gap-1.5 leading-snug">
                          <X className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                      <Check className="w-3.5 h-3.5" /> Zero disqualifiers observed.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </BrutalistCard>
      </div>
    </section>
  );
};
