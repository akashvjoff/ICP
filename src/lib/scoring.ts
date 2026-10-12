import { NormalizedLead } from '../types/lead';
import { OfferingProfile } from '../types/offering';
import { FullStrategicAnalysis, NeedGapAnalysisItem } from '../types/analysis';
import { LeadICPScore, ScoringWeights, ICPTier, ScoreItemBreakdown } from '../types/scoring';

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  needUrgencyWeight: 0.35,
  capabilityMatchWeight: 0.25,
  stakeholderFeasibilityWeight: 0.20,
  firmographicAlignmentWeight: 0.20
};

export function calculateDeterministicICPScore(
  lead: NormalizedLead,
  offering: OfferingProfile,
  needGap?: NeedGapAnalysisItem,
  customWeights?: Partial<ScoringWeights>
): LeadICPScore {
  const weights: ScoringWeights = {
    ...DEFAULT_SCORING_WEIGHTS,
    ...customWeights
  };

  const breakdown: ScoreItemBreakdown[] = [];
  const primaryStrengths: string[] = [];
  const primaryDisqualifiers: string[] = [];

  // 1. Need Urgency (Max 35 points scaled by weight)
  let needRaw = 50; // default baseline if no explicit need gap
  let needRationale = 'Standard baseline need assumption; awaiting deep qualification.';
  if (needGap) {
    if (needGap.gapMagnitude === 'Acute') {
      needRaw = Math.min(100, Math.max(85, needGap.gapScore));
      needRationale = `Acute business pain detected: ${needGap.identifiedNeed}. Consequence of inaction is severe.`;
      primaryStrengths.push(`Acute need urgency: ${needGap.urgencyDriver || needGap.identifiedNeed}`);
    } else if (needGap.gapMagnitude === 'Moderate') {
      needRaw = Math.min(84, Math.max(65, needGap.gapScore));
      needRationale = `Moderate friction identified: ${needGap.identifiedNeed}. Solution valuable but not existential.`;
    } else if (needGap.gapMagnitude === 'Latent') {
      needRaw = Math.min(64, Math.max(40, needGap.gapScore));
      needRationale = `Latent need: problem exists but leadership does not yet prioritize resolution.`;
    } else {
      needRaw = Math.min(30, Math.max(5, needGap.gapScore));
      needRationale = `Negligible need: target company has no active requirement for this capability.`;
      primaryDisqualifiers.push('No acute business need for offering');
    }
  }

  const needPoints = (needRaw * weights.needUrgencyWeight);
  breakdown.push({
    criterion: 'Need Urgency & Problem Severity',
    weightPct: Math.round(weights.needUrgencyWeight * 100),
    maxPoints: Math.round(weights.needUrgencyWeight * 100),
    awardedPoints: Number(needPoints.toFixed(1)),
    auditRationale: needRationale
  });

  // 2. Offering Capability Match (Max 25 points scaled by weight)
  let capRaw = 50;
  let capRationale = 'Standard capability alignment.';
  const matchingTech = lead.technologies.filter(t => 
    offering.keyCapabilities.some(c => c.toLowerCase().includes(t.toLowerCase())) ||
    ['snowflake', 'databricks', 'dbt', 'postgres', 'aws', 'kubernetes', 'spark'].some(stack => t.toLowerCase().includes(stack))
  );

  if (matchingTech.length >= 2) {
    capRaw = 95;
    capRationale = `Verified high-gravity tech stack match (${matchingTech.join(', ')}). Native compatibility confirmed.`;
    primaryStrengths.push(`Compatible technical infrastructure: ${matchingTech.slice(0, 3).join(', ')}`);
  } else if (matchingTech.length === 1) {
    capRaw = 75;
    capRationale = `Partial stack compatibility detected (${matchingTech[0]}). Minor adaptation required.`;
  } else if (lead.technologies.some(t => ['excel', 'quickbooks', 'legacy', 'paper'].includes(t.toLowerCase()))) {
    capRaw = 10;
    capRationale = 'Legacy/manual tooling detected. Offering requires modern architecture.';
    primaryDisqualifiers.push('Incompatible legacy technology environment');
  } else {
    capRaw = 60;
    capRationale = 'Standard workflow match without specific proprietary blockers.';
  }

  const capPoints = (capRaw * weights.capabilityMatchWeight);
  breakdown.push({
    criterion: 'Capability & Architecture Match',
    weightPct: Math.round(weights.capabilityMatchWeight * 100),
    maxPoints: Math.round(weights.capabilityMatchWeight * 100),
    awardedPoints: Number(capPoints.toFixed(1)),
    auditRationale: capRationale
  });

  // 3. Stakeholder & Economic Feasibility (Max 20 points scaled by weight)
  let stakeRaw = 60;
  let stakeRationale = 'Moderate economic feasibility based on company size.';
  const hasDecisionMaker = offering.buyerPersonas.length > 0;
  const headcount = lead.headcount || 0;

  if (headcount >= 150 && headcount <= 2500) {
    stakeRaw = 90;
    stakeRationale = `Optimal organization size (${headcount} FTE). High likelihood of specialized VP/Director department heads with budget.`;
    primaryStrengths.push(`Organization scale (${headcount} FTE) fits target buying committee`);
  } else if (headcount > 2500) {
    stakeRaw = 75;
    stakeRationale = `Large enterprise (${headcount} FTE). Strong budget capacity but lengthy procurement cycles.`;
  } else if (headcount >= 30 && headcount < 150) {
    stakeRaw = 65;
    stakeRationale = `Emerging team (${headcount} FTE). Fast decision-making but limited discretionary tool budget.`;
  } else if (headcount > 0 && headcount < 30) {
    stakeRaw = 30;
    stakeRationale = `Early-stage (<30 FTE). Unlikely to sustain typical ${offering.typicalACV} ACV commitment.`;
    primaryDisqualifiers.push('Sub-scale headcount to justify software spend');
  } else {
    stakeRaw = 50;
    stakeRationale = 'Headcount undisclosed; estimated from available firmographics.';
  }

  const stakePoints = (stakeRaw * weights.stakeholderFeasibilityWeight);
  breakdown.push({
    criterion: 'Stakeholder & Economic Feasibility',
    weightPct: Math.round(weights.stakeholderFeasibilityWeight * 100),
    maxPoints: Math.round(weights.stakeholderFeasibilityWeight * 100),
    awardedPoints: Number(stakePoints.toFixed(1)),
    auditRationale: stakeRationale
  });

  // 4. Firmographic & Hypothesis Alignment (Max 20 points scaled by weight)
  let firmoRaw = 60;
  let firmoRationale = 'General market alignment.';
  const industryMatches = offering.icpHypothesis.targetIndustries.some(ind => 
    lead.industry.toLowerCase().includes(ind.toLowerCase())
  );

  if (industryMatches) {
    firmoRaw = 90;
    firmoRationale = `Industry vertical (${lead.industry}) directly matches core ICP hypothesis target list.`;
    primaryStrengths.push(`Direct industry vertical fit: ${lead.industry}`);
  } else if (lead.industry.toLowerCase().includes('freight') || lead.industry.toLowerCase().includes('trucking')) {
    firmoRaw = 25;
    firmoRationale = `Vertical (${lead.industry}) is outside stated high-fit parameters.`;
    primaryDisqualifiers.push(`Non-target vertical (${lead.industry})`);
  } else {
    firmoRaw = 65;
    firmoRationale = `Adjacent vertical (${lead.industry}) with potential transferability.`;
  }

  const firmoPoints = (firmoRaw * weights.firmographicAlignmentWeight);
  breakdown.push({
    criterion: 'Firmographic & Hypothesis Alignment',
    weightPct: Math.round(weights.firmographicAlignmentWeight * 100),
    maxPoints: Math.round(weights.firmographicAlignmentWeight * 100),
    awardedPoints: Number(firmoPoints.toFixed(1)),
    auditRationale: firmoRationale
  });

  // Calculate Total Score
  const totalScore = Number((needPoints + capPoints + stakePoints + firmoPoints).toFixed(1));

  // Determine Tier
  let tier: ICPTier;
  let recommendedAction: LeadICPScore['recommendedAction'];

  if (totalScore >= 80) {
    tier = 'Tier 1: High Conviction';
    recommendedAction = 'Immediate Outreach';
  } else if (totalScore >= 65) {
    tier = 'Tier 2: Moderate Fit';
    recommendedAction = 'Nurture Campaign';
  } else if (totalScore >= 45) {
    tier = 'Tier 3: Niche / Edge';
    recommendedAction = 'Further Discovery';
  } else {
    tier = 'Tier 4: Disqualified';
    recommendedAction = 'Archive / Ignore';
  }

  return {
    leadId: lead.id,
    companyName: lead.companyName,
    domain: lead.domain,
    totalScore,
    tier,
    confidence: Number((0.85 + (totalScore / 1000)).toFixed(2)),
    isHypothesisOnly: !offering.icpHypothesis.isValidated,
    breakdown,
    primaryStrengths,
    primaryDisqualifiers,
    recommendedAction,
    scoredAt: new Date().toISOString()
  };
}

export function batchScoreLeads(
  leads: NormalizedLead[],
  offering: OfferingProfile,
  analysis?: FullStrategicAnalysis,
  customWeights?: Partial<ScoringWeights>
): LeadICPScore[] {
  return leads.map(lead => {
    const needGap = analysis?.needGaps?.find(g => g.leadId === lead.id);
    return calculateDeterministicICPScore(lead, offering, needGap, customWeights);
  });
}
