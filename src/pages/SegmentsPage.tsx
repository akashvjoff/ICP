import React from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { EmptyState } from '../components/ui/EmptyState';
import { StickerBadge } from '../components/ui/StickerBadge';
import { StatusChip } from '../components/ui/StatusChip';
import { GitFork, Users, Target, ArrowRight, Sparkles, ExternalLink } from 'lucide-react';

export const SegmentsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { segments, leads, scores } = useAppStore();

  const getPastelBg = (index: number) => {
    const bgs: Array<'mint' | 'peach' | 'lavender' | 'pink'> = ['mint', 'peach', 'lavender', 'pink'];
    return bgs[index % bgs.length];
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
          <div>
            <SectionEyebrow color="bg-[#A1F000]">
              STP STRATEGY ENGINE
            </SectionEyebrow>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0A0A0A] tracking-tight">
              Customer Problem Segmentation
            </h1>
            <p className="text-xs text-[#0A0A0A]/70 font-medium mt-1 max-w-xl">
              Candidate customer segments clustered by shared business friction, decision urgency, and buying behavior rather than superficial industry labels alone.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={() => navigate('/companies')}
              icon={<Users className="w-3.5 h-3.5" />}
            >
              VIEW ALL {leads.length} LEADS
            </BrutalistButton>
          </div>
        </div>

        {/* Methodology Callout */}
        <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[4px_5px_0px_#0A0A0A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#8C6ADE]" />
              <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                PROBLEM-FIRST SEGMENTATION PRINCIPLE
              </span>
            </div>
            <p className="text-xs text-[#0A0A0A]/85 font-medium leading-relaxed max-w-2xl">
              Two companies in the same industry often have completely different software buying urgency. We cluster by <em>consequence of inaction</em> and <em>internal architectural readiness</em>.
            </p>
          </div>

          <span className="font-mono text-xs font-black bg-white px-3 py-1 rounded-lg border border-[#0A0A0A] shrink-0 text-center">
            {segments.length} CLUSTERS IDENTIFIED
          </span>
        </div>

        {/* Candidate Segment Cards Grid or Empty State */}
        {segments.length === 0 ? (
          <EmptyState
            title="No Problem Clusters Formed Yet"
            description="Segment clusters are generated automatically when lead lists are analyzed against your offering profile."
            actionText="UPLOAD COMPANY LEADS"
            onAction={() => navigate('/uploads/new')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {segments.map((segment, idx) => {
              const bg = getPastelBg(idx);
              const matchedCompanies = leads.filter(l => segment.matchedLeadIds?.includes(l.id));

            return (
              <BrutalistCard
                key={segment.id}
                bg={bg}
                shadowSize="md"
                className="p-6 flex flex-col justify-between space-y-6"
              >
                <div>
                  {/* Top Row: Attractiveness & Count */}
                  <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/20 pb-3 mb-4">
                    <span className="font-mono text-[10px] font-black uppercase bg-white px-2 py-0.5 rounded border border-[#0A0A0A]">
                      {segment.targetAttractiveness}
                    </span>
                    <span className="font-mono text-xs font-black text-[#0A0A0A]">
                      {segment.leadCount} MATCHING {segment.leadCount === 1 ? 'LEAD' : 'LEADS'}
                    </span>
                  </div>

                  {/* Title & Problem Definition */}
                  <h3 className="text-xl font-black text-[#0A0A0A] tracking-tight leading-snug mb-2">
                    {segment.segmentName}
                  </h3>

                  <p className="text-xs text-[#0A0A0A]/85 font-medium leading-relaxed mb-4">
                    {segment.problemDefinition}
                  </p>

                  {/* Positioning Hook */}
                  <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-3.5 shadow-[2px_2px_0px_#0A0A0A] space-y-1 mb-4">
                    <span className="font-mono text-[9px] font-black uppercase text-[#0A0A0A]/60 block">
                      DIFFERENTIATED POSITIONING HOOK
                    </span>
                    <p className="text-xs font-black text-[#0A0A0A] italic leading-snug">
                      "{segment.recommendedPositioningAngle}"
                    </p>
                  </div>

                  {/* Value Narrative */}
                  <div className="space-y-1 text-xs">
                    <span className="font-mono text-[9px] font-bold uppercase text-[#0A0A0A]/60 block">
                      FIT EVIDENCE & VALUE NARRATIVE
                    </span>
                    <p className="text-xs text-[#0A0A0A]/80 font-medium leading-relaxed">
                      {segment.valueNarrative}
                    </p>
                  </div>
                </div>

                {/* Bottom: Matched Accounts & Average Need Score */}
                <div className="border-t-[2px] border-[#0A0A0A]/20 pt-4 space-y-3">
                  <div className="flex justify-between items-center font-mono text-xs">
                    <span className="font-bold text-[#0A0A0A]/70">AVG NEED SCORE:</span>
                    <span className="font-black text-sm text-[#0A0A0A]">
                      {segment.averageNeedScore} / 100
                    </span>
                  </div>

                  <div className="flex justify-between items-center font-mono text-xs">
                    <span className="font-bold text-[#0A0A0A]/70">CONFIDENCE:</span>
                    <span className="font-black text-emerald-800 bg-[#E5F7E5] px-1.5 py-0.5 rounded border border-[#0A0A0A]">
                      {segment.targetAttractiveness.includes('Tier 1') ? '94%' : segment.targetAttractiveness.includes('Tier 2') ? '88%' : '75%'}
                    </span>
                  </div>

                  {matchedCompanies.length > 0 && (
                    <div className="pt-1">
                      <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block mb-1.5">
                        MATCHING ACCOUNTS:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {matchedCompanies.map(c => (
                          <button
                            key={c.id}
                            onClick={() => navigate(`/companies/${c.id}`)}
                            className="bg-white hover:bg-[#A1F000] border-[1.5px] border-[#0A0A0A] px-2 py-0.5 rounded text-[11px] font-mono font-bold text-[#0A0A0A] shadow-[1px_1px_0px_#0A0A0A] cursor-pointer inline-flex items-center gap-1 transition-colors"
                          >
                            <span>{c.companyName}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </BrutalistCard>
            );
          })}
        </div>
      )}
    </div>
    </AppLayout>
  );
};
