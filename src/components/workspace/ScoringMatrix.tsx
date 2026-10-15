import React, { useState } from 'react';
import { ScoringWeights, LeadICPScore } from '../../types/scoring';
import { NormalizedLead } from '../../types/lead';
import { OfferingProfile } from '../../types/offering';
import { FullStrategicAnalysis } from '../../types/analysis';
import { calculateDeterministicICPScore, DEFAULT_SCORING_WEIGHTS } from '../../lib/scoring';
import { formatScore } from '../../lib/formatters';
import { SectionHeading } from '../ui/SectionHeading';
import { BrutalistCard } from '../ui/BrutalistCard';
import { BrutalistButton } from '../ui/BrutalistButton';
import { TableShell } from '../ui/TableShell';
import { StatusChip } from '../ui/StatusChip';
import { Sliders, RotateCcw, ArrowRight, ShieldCheck } from 'lucide-react';

interface ScoringMatrixProps {
  weights: ScoringWeights;
  onUpdateWeights: (weights: ScoringWeights) => void;
  scores: LeadICPScore[];
  onUpdateScores: (scores: LeadICPScore[]) => void;
  leads: NormalizedLead[];
  offering: OfferingProfile;
  analysis: FullStrategicAnalysis;
  onNextStep: () => void;
}

export const ScoringMatrix: React.FC<ScoringMatrixProps> = ({
  weights,
  onUpdateWeights,
  scores,
  onUpdateScores,
  leads,
  offering,
  analysis,
  onNextStep,
}) => {
  const [localWeights, setLocalWeights] = useState<ScoringWeights>(weights);

  const handleWeightChange = (key: keyof ScoringWeights, val: number) => {
    const updated = { ...localWeights, [key]: val / 100 };
    setLocalWeights(updated);
    onUpdateWeights(updated);

    const recomputed = leads.map(lead => {
      const needGap = analysis?.needGaps?.find(g => g.leadId === lead.id);
      return calculateDeterministicICPScore(lead, offering, needGap, updated);
    });
    onUpdateScores(recomputed);
  };

  const handleResetWeights = () => {
    setLocalWeights(DEFAULT_SCORING_WEIGHTS);
    onUpdateWeights(DEFAULT_SCORING_WEIGHTS);
    const recomputed = leads.map(lead => {
      const needGap = analysis?.needGaps?.find(g => g.leadId === lead.id);
      return calculateDeterministicICPScore(lead, offering, needGap, DEFAULT_SCORING_WEIGHTS);
    });
    onUpdateScores(recomputed);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
        <SectionHeading
          eyebrow="STEP 04 OF 05 // CALCULATION"
          eyebrowColor="bg-[#A1F000]"
          title="Explainable Fit Scoring"
          description="A rule-based score with visible components. Adjust the weights to reflect your go-to-market priorities."
          className="mb-0"
        />

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <BrutalistButton
            variant="white"
            size="sm"
            onClick={handleResetWeights}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            RESET WEIGHTS
          </BrutalistButton>

          <BrutalistButton
            variant="lime"
            size="sm"
            onClick={onNextStep}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            GENERATE ICP DOSSIER
          </BrutalistButton>
        </div>
      </div>

      {/* Weight Sliders in White Brutalist Card */}
      <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7 space-y-6">
        <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/15 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0A0A0A]" />
            <h3 className="text-base font-black text-[#0A0A0A]">
              Scoring Dimension Rubric Weights
            </h3>
          </div>
          <span className="font-mono text-xs font-bold text-[#0A0A0A] bg-[#FFE3B3] px-2.5 py-1 rounded-md border border-[#0A0A0A]">
            TOTAL WEIGHT: {Math.round((localWeights.needUrgencyWeight + localWeights.capabilityMatchWeight + localWeights.stakeholderFeasibilityWeight + localWeights.firmographicAlignmentWeight) * 100)}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Dimension 1: Need Urgency */}
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-4.5 space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
            <div className="flex justify-between font-mono font-bold text-[#0A0A0A]">
              <span>1. NEED URGENCY</span>
              <span className="text-sm font-black bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A]">
                {Math.round(localWeights.needUrgencyWeight * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              value={Math.round(localWeights.needUrgencyWeight * 100)}
              onChange={(e) => handleWeightChange('needUrgencyWeight', parseInt(e.target.value, 10))}
              className="w-full accent-[#0A0A0A] cursor-pointer"
            />
            <p className="text-[11px] text-[#0A0A0A]/70 font-medium">
              Prioritizes accounts facing acute compliance or financial pain.
            </p>
          </div>

          {/* Dimension 2: Capability Match */}
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-4.5 space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
            <div className="flex justify-between font-mono font-bold text-[#0A0A0A]">
              <span>2. TECH ARCHITECTURE</span>
              <span className="text-sm font-black bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A]">
                {Math.round(localWeights.capabilityMatchWeight * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={Math.round(localWeights.capabilityMatchWeight * 100)}
              onChange={(e) => handleWeightChange('capabilityMatchWeight', parseInt(e.target.value, 10))}
              className="w-full accent-[#0A0A0A] cursor-pointer"
            />
            <p className="text-[11px] text-[#0A0A0A]/70 font-medium">
              Evaluates native toolchain overlap (e.g. Snowflake, Databricks, dbt).
            </p>
          </div>

          {/* Dimension 3: Stakeholder Feasibility */}
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-4.5 space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
            <div className="flex justify-between font-mono font-bold text-[#0A0A0A]">
              <span>3. BUYING UNIT & SCALE</span>
              <span className="text-sm font-black bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A]">
                {Math.round(localWeights.stakeholderFeasibilityWeight * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={Math.round(localWeights.stakeholderFeasibilityWeight * 100)}
              onChange={(e) => handleWeightChange('stakeholderFeasibilityWeight', parseInt(e.target.value, 10))}
              className="w-full accent-[#0A0A0A] cursor-pointer"
            />
            <p className="text-[11px] text-[#0A0A0A]/70 font-medium">
              Assesses presence of VP budget authority and headcount feasibility.
            </p>
          </div>

          {/* Dimension 4: Firmographic Alignment */}
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-4.5 space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
            <div className="flex justify-between font-mono font-bold text-[#0A0A0A]">
              <span>4. HYPOTHESIS OVERLAP</span>
              <span className="text-sm font-black bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A]">
                {Math.round(localWeights.firmographicAlignmentWeight * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={Math.round(localWeights.firmographicAlignmentWeight * 100)}
              onChange={(e) => handleWeightChange('firmographicAlignmentWeight', parseInt(e.target.value, 10))}
              className="w-full accent-[#0A0A0A] cursor-pointer"
            />
            <p className="text-[11px] text-[#0A0A0A]/70 font-medium">
              Checks alignment with stated target industries and geographic criteria.
            </p>
          </div>
        </div>
      </BrutalistCard>

      {/* Live Recomputed Table */}
      <TableShell
        title="Live Recomputed Fit Scores"
        countLabel={`${scores.length} LEADS EVALUATED`}
      >
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
              <th className="py-3 px-4 font-black tracking-wider uppercase">COMPANY</th>
              <th className="py-3 px-4 font-black tracking-wider uppercase text-right">ICP FIT SCORE</th>
              <th className="py-3 px-4 font-black tracking-wider uppercase">TIER COHORT</th>
              <th className="py-3 px-4 font-black tracking-wider uppercase">RECOMMENDED GTM ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
            {scores.map((score) => (
              <tr key={score.leadId} className="hover:bg-[#FFE3B3]/20 transition-colors">
                <td className="py-3.5 px-4">
                  <span className="font-extrabold text-[#0A0A0A] text-sm block">{score.companyName}</span>
                  <span className="font-mono text-[11px] text-[#0A0A0A]/60 font-bold">{score.domain}</span>
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                  <span className="text-lg font-black text-[#0A0A0A]">
                    {formatScore(score.totalScore)}
                  </span>
                  <span className="text-[#0A0A0A]/40 text-xs font-bold"> / 100</span>
                </td>
                <td className="py-3.5 px-4">
                  <StatusChip
                    color={score.totalScore >= 80 ? 'mint' : score.totalScore >= 60 ? 'peach' : 'pink'}
                  >
                    {score.tier}
                  </StatusChip>
                </td>
                <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#0A0A0A]">
                  {score.recommendedAction}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
};
