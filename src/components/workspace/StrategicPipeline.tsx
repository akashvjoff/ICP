import React, { useState } from 'react';
import { FullStrategicAnalysis, STPCluster, NeedGapAnalysisItem } from '../../types/analysis';
import { OfferingProfile } from '../../types/offering';
import { NormalizedLead } from '../../types/lead';
import { SectionHeading } from '../ui/SectionHeading';
import { BrutalistCard } from '../ui/BrutalistCard';
import { BrutalistButton } from '../ui/BrutalistButton';
import { StickerBadge } from '../ui/StickerBadge';
import { StatusChip } from '../ui/StatusChip';
import { Target, Users, GitFork, Layers, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

interface StrategicPipelineProps {
  analysis: FullStrategicAnalysis;
  offering: OfferingProfile;
  leads: NormalizedLead[];
  onNextStep: () => void;
  onRefreshAnalysis: () => Promise<void>;
  isAnalyzing: boolean;
}

export const StrategicPipeline: React.FC<StrategicPipelineProps> = ({
  analysis,
  offering,
  leads,
  onNextStep,
  onRefreshAnalysis,
  isAnalyzing,
}) => {
  const [activeTab, setActiveTab] = useState<'needGap' | '5c' | 'stp' | 'mix'>('needGap');

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
        <SectionHeading
          eyebrow="STEP 03 OF 05 // STRATEGIC FRAMEWORKS"
          eyebrowColor="bg-[#6AAAFB]"
          title="Strategic Marketing Analysis Pipeline"
          description="Sequential execution of Need Gap Analysis → 5C Stakeholders → STP Strategy → Marketing Mix (4Ps)."
          className="mb-0"
        />

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <BrutalistButton
            variant="white"
            size="sm"
            onClick={onRefreshAnalysis}
            disabled={isAnalyzing || leads.length === 0}
            icon={<Sparkles className={`w-3.5 h-3.5 text-[#8C6ADE] ${isAnalyzing ? 'animate-spin' : ''}`} />}
          >
            {isAnalyzing ? 'ANALYZING...' : 'RUN GEMINI ANALYSIS'}
          </BrutalistButton>

          <BrutalistButton
            variant="lime"
            size="sm"
            onClick={onNextStep}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            PROCEED TO SCORING
          </BrutalistButton>
        </div>
      </div>

      {/* Synthesis Hypothesis Card */}
      <BrutalistCard bg="lavender" shadowSize="md" className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <StickerBadge color="purple" rotate="-2">
            COHORT SYNTHESIS
          </StickerBadge>
          <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
            STRATEGIC HYPOTHESIS
          </span>
        </div>
        <p className="text-sm text-[#0A0A0A] leading-relaxed font-medium">
          {analysis.cohortHypothesisSummary}
        </p>
      </BrutalistCard>

      {/* Framework Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border-[2.5px] border-[#0A0A0A] rounded-2xl shadow-[3px_4px_0px_#0A0A0A]">
        <button
          onClick={() => setActiveTab('needGap')}
          className={`flex-1 min-w-[150px] px-4 py-2.5 rounded-xl font-mono text-xs font-extrabold tracking-wider transition-all duration-120 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'needGap'
              ? 'bg-[#FFE3B3] text-[#0A0A0A] border-[2px] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
              : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
          }`}
        >
          <Target className="w-4 h-4 text-[#0A0A0A]" />
          <span>01. NEED GAP</span>
        </button>

        <button
          onClick={() => setActiveTab('5c')}
          className={`flex-1 min-w-[150px] px-4 py-2.5 rounded-xl font-mono text-xs font-extrabold tracking-wider transition-all duration-120 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === '5c'
              ? 'bg-[#E4E6FB] text-[#0A0A0A] border-[2px] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
              : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
          }`}
        >
          <Users className="w-4 h-4 text-[#0A0A0A]" />
          <span>02. 5C DYNAMICS</span>
        </button>

        <button
          onClick={() => setActiveTab('stp')}
          className={`flex-1 min-w-[150px] px-4 py-2.5 rounded-xl font-mono text-xs font-extrabold tracking-wider transition-all duration-120 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'stp'
              ? 'bg-[#E5F7E5] text-[#0A0A0A] border-[2px] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
              : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
          }`}
        >
          <GitFork className="w-4 h-4 text-[#0A0A0A]" />
          <span>03. STP STRATEGY</span>
        </button>

        <button
          onClick={() => setActiveTab('mix')}
          className={`flex-1 min-w-[150px] px-4 py-2.5 rounded-xl font-mono text-xs font-extrabold tracking-wider transition-all duration-120 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'mix'
              ? 'bg-[#FFB6C2] text-[#0A0A0A] border-[2px] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
              : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
          }`}
        >
          <Layers className="w-4 h-4 text-[#0A0A0A]" />
          <span>04. MARKETING MIX</span>
        </button>
      </div>

      {/* Tab 1: Need Gap */}
      {activeTab === 'needGap' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight">
              Customer Problem Gravity by Account
            </h3>
            <span className="font-mono text-xs font-bold text-[#0A0A0A]/60">
              ACUTE VS LATENT FRICTION
            </span>
          </div>

          <div className="space-y-4">
            {analysis.needGaps.map((item, idx) => (
              <BrutalistCard key={idx} bg="white" shadowSize="sm" className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-[2px] border-[#0A0A0A]/10 pb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="text-base font-black text-[#0A0A0A] tracking-tight">
                      {item.companyName}
                    </h4>
                    <StatusChip
                      color={item.gapMagnitude === 'Acute' ? 'lime' : item.gapMagnitude === 'Moderate' ? 'peach' : 'lavender'}
                    >
                      {item.gapMagnitude} Gap
                    </StatusChip>
                  </div>
                  <div className="font-mono text-xs font-bold text-[#0A0A0A]">
                    NEED SCORE: <strong className="text-base font-black">{item.gapScore}</strong> / 100
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block mb-1">
                      IDENTIFIED FRICTION
                    </span>
                    <p className="text-[#0A0A0A] font-medium leading-relaxed">{item.identifiedNeed}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block mb-1">
                      CONSEQUENCE OF INACTION
                    </span>
                    <p className="text-[#0A0A0A]/85 font-medium leading-relaxed">{item.consequenceOfInaction}</p>
                  </div>
                </div>

                <div className="border-t-[1.5px] border-[#0A0A0A]/10 pt-2.5 text-xs font-medium">
                  <span className="font-mono font-bold text-[#8C6ADE] mr-2">↳ CAPABILITY COVERAGE:</span>
                  <span className="text-[#0A0A0A] font-medium">{item.offeringCapabilityMatch}</span>
                </div>
              </BrutalistCard>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: 5C Dynamics */}
      {activeTab === '5c' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BrutalistCard bg="lavender" shadowSize="md" className="p-6 space-y-4">
            <h3 className="text-lg font-black text-[#0A0A0A] border-b-[2px] border-[#0A0A0A]/20 pb-2">
              Customers: Buying Unit Dynamics
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Economic Buyer</span>
                <p className="text-[#0A0A0A] font-extrabold text-sm">{analysis.fiveC.customers.economicBuyer}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Internal Champion</span>
                <p className="text-[#0A0A0A] font-extrabold text-sm">{analysis.fiveC.customers.championPersona}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Primary Friction Obstacle</span>
                <p className="text-[#0A0A0A] font-medium leading-relaxed">{analysis.fiveC.customers.primaryObstacle}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Estimated Decision Cycle</span>
                <p className="font-mono text-sm font-black text-[#0A0A0A]">{analysis.fiveC.customers.decisionCycleEstimate}</p>
              </div>
            </div>
          </BrutalistCard>

          <BrutalistCard bg="peach" shadowSize="md" className="p-6 space-y-4">
            <h3 className="text-lg font-black text-[#0A0A0A] border-b-[2px] border-[#0A0A0A]/20 pb-2">
              Competitors & Market Alternatives
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Current Alternatives</span>
                <p className="text-[#0A0A0A] font-extrabold text-sm">{analysis.fiveC.competitors.currentAlternative}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Switching Inertia</span>
                <p className="text-[#0A0A0A] font-extrabold text-sm">{analysis.fiveC.competitors.switchingFriction} Inertia</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Core Differentiation Hook</span>
                <p className="text-[#0A0A0A] font-medium leading-relaxed">{analysis.fiveC.competitors.differentiationAdvantage}</p>
              </div>
            </div>
          </BrutalistCard>

          <BrutalistCard bg="white" shadowSize="md" className="p-6 space-y-4">
            <h3 className="text-lg font-black text-[#0A0A0A] border-b-[2px] border-[#0A0A0A]/20 pb-2">
              Company Capabilities & Readiness
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Internal Capabilities</span>
                <p className="text-[#0A0A0A] font-medium leading-relaxed">{analysis.fiveC.company.internalCapabilities}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Engineering Readiness</span>
                <p className="text-[#0A0A0A] font-medium leading-relaxed">{analysis.fiveC.company.resourceReadiness}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">GTM Strategic Priority</span>
                <p className="text-[#0A0A0A] font-bold text-sm">{analysis.fiveC.company.strategicPriority}</p>
              </div>
            </div>
          </BrutalistCard>

          <BrutalistCard bg="mint" shadowSize="md" className="p-6 space-y-4">
            <h3 className="text-lg font-black text-[#0A0A0A] border-b-[2px] border-[#0A0A0A]/20 pb-2">
              Context: Macro & Regulatory Shifts
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Channel / Integration Partners</span>
                <p className="text-[#0A0A0A] font-medium leading-relaxed">{analysis.fiveC.collaborators.systemIntegrators}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Macro Economic Climate</span>
                <p className="text-[#0A0A0A] font-medium leading-relaxed">{analysis.fiveC.context.economicClimate}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Regulatory Compliance Factors</span>
                <p className="text-[#0A0A0A] font-medium leading-relaxed">{analysis.fiveC.context.regulatoryFactors}</p>
              </div>
            </div>
          </BrutalistCard>
        </div>
      )}

      {/* Tab 3: STP Strategy */}
      {activeTab === 'stp' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight">
              Problem-Based Customer Segments
            </h3>
            <span className="font-mono text-xs font-bold text-[#0A0A0A]/60">
              CLUSTER DISCOVERY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {analysis.stpSegments.map((segment) => (
              <BrutalistCard
                key={segment.id}
                bg={segment.targetAttractiveness.includes('Tier 1') ? 'mint' : segment.targetAttractiveness.includes('Tier 2') ? 'peach' : 'white'}
                shadowSize="md"
                className="p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3 border-b-[2px] border-[#0A0A0A]/20 pb-2">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]">
                      {segment.targetAttractiveness}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#0A0A0A]">
                      {segment.leadCount} LEADS
                    </span>
                  </div>

                  <h4 className="text-lg font-black text-[#0A0A0A] tracking-tight mb-2">
                    {segment.segmentName}
                  </h4>
                  <p className="text-xs text-[#0A0A0A]/85 font-medium leading-relaxed mb-4">
                    {segment.problemDefinition}
                  </p>

                  <div className="border-t-[2px] border-[#0A0A0A]/15 pt-3 space-y-2 text-xs">
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">POSITIONING HOOK:</span>
                      <p className="text-[#0A0A0A] font-black italic mt-0.5">
                        "{segment.recommendedPositioningAngle}"
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t-[2px] border-[#0A0A0A]/20 pt-3 mt-4 font-mono text-xs font-black text-[#0A0A0A]">
                  AVG NEED SCORE: {segment.averageNeedScore} / 100
                </div>
              </BrutalistCard>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Marketing Mix */}
      {activeTab === 'mix' && (
        <div className="space-y-4">
          <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight">
            Marketing Mix (4Ps) Resonance Verification
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <BrutalistCard bg="mint" shadowSize="md" className="p-6 space-y-2">
              <span className="font-mono text-xs font-black text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#0A0A0A] inline-block">
                PRODUCT FIT
              </span>
              <p className="text-[#0A0A0A] font-semibold text-sm leading-relaxed mt-2">
                {analysis.marketingMix.productResonance}
              </p>
            </BrutalistCard>

            <BrutalistCard bg="peach" shadowSize="md" className="p-6 space-y-2">
              <span className="font-mono text-xs font-black text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#0A0A0A] inline-block">
                PRICE ACCEPTABILITY
              </span>
              <p className="text-[#0A0A0A] font-semibold text-sm leading-relaxed mt-2">
                {analysis.marketingMix.priceAcceptability}
              </p>
            </BrutalistCard>

            <BrutalistCard bg="lavender" shadowSize="md" className="p-6 space-y-2">
              <span className="font-mono text-xs font-black text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#0A0A0A] inline-block">
                PLACE (DISTRIBUTION CHANNEL)
              </span>
              <p className="text-[#0A0A0A] font-semibold text-sm leading-relaxed mt-2">
                {analysis.marketingMix.placeChannelFit}
              </p>
            </BrutalistCard>

            <BrutalistCard bg="pink" shadowSize="md" className="p-6 space-y-2">
              <span className="font-mono text-xs font-black text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#0A0A0A] inline-block">
                PROMOTION HOOK
              </span>
              <p className="text-[#0A0A0A] font-semibold text-sm leading-relaxed mt-2">
                {analysis.marketingMix.promotionHook}
              </p>
            </BrutalistCard>
          </div>
        </div>
      )}
    </div>
  );
};
