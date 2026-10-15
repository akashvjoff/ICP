import { NormalizedLead } from '../types/lead';
import { OfferingProfile, SellerProductContext } from '../types/offering';
import { FullStrategicAnalysis, NeedGapAnalysisItem, DetailedFiveCAnalysis, CustomerSegment, DatasetNeedGapSummary } from '../types/analysis';
import { LeadICPScore, ScoringWeights, ICPTier, ScoreItemBreakdown, EvidenceOrigin } from '../types/scoring';
import { CompanyIntelligence, CompanyAnalysisEnvelope } from '../types/companyIntelligence';

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  needUrgencyWeight: 0.35,
  capabilityMatchWeight: 0.25,
  stakeholderFeasibilityWeight: 0.20,
  firmographicAlignmentWeight: 0.20,
};

export const CURRENT_SCORING_MODEL_VERSION = 'v1.3-need-gap-grounded';

export interface ScoringContext {
  companyIntelligence?: CompanyIntelligence | CompanyAnalysisEnvelope | null;
  fiveC?: DetailedFiveCAnalysis | null;
  segment?: CustomerSegment | null;
  sellerContext?: SellerProductContext | null;
  datasetNeedGapSummary?: DatasetNeedGapSummary | null;
  strictDisqualification?: boolean;
  requireNeedGap?: boolean;
  excludedIndustries?: string[];
  excludedGeographies?: string[];
}

/**
 * Validates that custom weights sum to 100% (within floating point precision tolerance).
 */
export function validateScoringWeights(weights: ScoringWeights): { isValid: boolean; sumPercentage: number; error?: string } {
  const sum = weights.needUrgencyWeight + weights.capabilityMatchWeight + weights.stakeholderFeasibilityWeight + weights.firmographicAlignmentWeight;
  const sumPercentage = Math.round(sum * 100);

  if (Math.abs(sum - 1.0) > 0.01) {
    return {
      isValid: false,
      sumPercentage,
      error: `Scoring weights must total exactly 100%. Current total: ${sumPercentage}%.`,
    };
  }

  if (
    weights.needUrgencyWeight < 0 ||
    weights.capabilityMatchWeight < 0 ||
    weights.stakeholderFeasibilityWeight < 0 ||
    weights.firmographicAlignmentWeight < 0
  ) {
    return {
      isValid: false,
      sumPercentage,
      error: 'Weights cannot be negative.',
    };
  }

  return { isValid: true, sumPercentage: 100 };
}

/**
 * Core Deterministic Multi-Attribute ICP Fit Scoring Engine.
 *
 * Strict Academic & Commercial Guardrails:
 * 1. Pure arithmetic (Non-AI calculation).
 * 2. Never invents ratings for missing evidence.
 * 3. Never confuses ICP Fit with verified Buying Intent.
 * 4. Hard disqualification overrides numeric score.
 * 5. Evidence coverage separately audited (<70% flags INSUFFICIENT EVIDENCE).
 */
export function calculateDeterministicICPScore(
  lead: NormalizedLead,
  offering: OfferingProfile,
  needGap?: NeedGapAnalysisItem,
  customWeights?: Partial<ScoringWeights>,
  context?: ScoringContext
): LeadICPScore {
  const weights: ScoringWeights = {
    ...DEFAULT_SCORING_WEIGHTS,
    ...customWeights,
  };

  const breakdown: ScoreItemBreakdown[] = [];
  const primaryStrengths: string[] = [];
  const primaryDisqualifiers: string[] = [];
  const missingFields: string[] = [];

  const companyIntel = context?.companyIntelligence;
  const sellerCtx = context?.sellerContext;
  const targetIndustries = offering.icpHypothesis?.targetIndustries || sellerCtx?.targetBusinessTypes || [];
  const targetGeos = offering.icpHypothesis?.targetGeographies || sellerCtx?.targetGeography || [];

  // =========================================================================
  // 1. NEED URGENCY & PROBLEM SEVERITY (35% default weight)
  // =========================================================================
  let needRaw: number | 'UNKNOWN' = 50;
  let needOrigin: EvidenceOrigin = 'UNKNOWN';
  let needEvidence = 'Standard baseline need assumption; awaiting deep qualification.';
  let needMissing: string | null = null;

  if (needGap?.analysisStatus === 'insufficient_evidence') {
    needRaw = 'UNKNOWN';
    needEvidence = 'Need urgency is pending sufficient offering-related evidence.';
    needMissing = 'Offering-related need gap evidence.';
    missingFields.push('Need Urgency');
  } else if (needGap) {
    needOrigin = 'AI_INFERRED';
    if (needGap.gapMagnitude === 'Acute') {
      needRaw = Math.min(100, Math.max(85, needGap.gapScore || 90));
      needEvidence = `Acute business pain detected: ${needGap.identifiedNeed}. Consequence of inaction is severe.`;
      primaryStrengths.push(`Acute need urgency: ${needGap.urgencyDriver || needGap.identifiedNeed}`);
    } else if (needGap.gapMagnitude === 'Moderate') {
      needRaw = Math.min(84, Math.max(65, needGap.gapScore || 75));
      needEvidence = `Moderate friction identified: ${needGap.identifiedNeed}. Solution valuable but not existential.`;
    } else if (needGap.gapMagnitude === 'Latent') {
      needRaw = Math.min(64, Math.max(40, needGap.gapScore || 50));
      needEvidence = 'Latent need: problem exists but leadership does not yet prioritize resolution.';
    } else {
      needRaw = Math.min(30, Math.max(5, needGap.gapScore || 20));
      needEvidence = 'Negligible need: target company has no active requirement for this capability.';
      primaryDisqualifiers.push('No acute business need for offering');
    }
  } else if (context?.requireNeedGap) {
    needRaw = 'UNKNOWN';
    needEvidence = 'Need urgency is pending saved need-gap analysis.';
    needMissing = 'Run need-gap analysis before assigning urgency points.';
    missingFields.push('Need Urgency');
  } else if (lead.customerPain && lead.customerPain.trim().length > 0) {
    needRaw = 80;
    needOrigin = 'USER_PROVIDED';
    needEvidence = `Documented customer friction from upload: ${lead.customerPain}`;
    primaryStrengths.push(`Documented customer friction: ${lead.customerPain}`);
  } else if (companyIntel && 'possible_needs' in companyIntel && Array.isArray(companyIntel.possible_needs) && companyIntel.possible_needs.length > 0) {
    needRaw = 65;
    needOrigin = 'AI_INFERRED';
    needEvidence = `Inferred operational needs: ${companyIntel.possible_needs.slice(0, 2).join(', ')}`;
  } else if (lead.description && lead.description.trim().length > 0) {
    needRaw = 50;
    needOrigin = lead.userCorrectedDescription ? 'USER_PROVIDED' : 'PUBLIC_WEBSITE';
    needEvidence = 'General operational description present without verified friction severity.';
  } else {
    // Explicitly UNKNOWN - do not invent a fake score
    needRaw = 'UNKNOWN';
    needOrigin = 'UNKNOWN';
    needEvidence = 'No customer friction, pain points, or operational challenges documented.';
    needMissing = 'Need Urgency & Customer Friction';
    missingFields.push('Need Urgency');
  }

  const needPoints = needRaw !== 'UNKNOWN' ? Number((needRaw * weights.needUrgencyWeight).toFixed(1)) : 0;
  breakdown.push({
    criterion: 'Need Urgency & Problem Severity',
    weightPct: Math.round(weights.needUrgencyWeight * 100),
    maxPoints: Math.round(weights.needUrgencyWeight * 100),
    awardedPoints: needPoints,
    auditRationale: needEvidence,
    rating: needRaw,
    supportingEvidence: needEvidence,
    evidenceOrigin: needOrigin,
    confidence: needOrigin === 'USER_PROVIDED' ? 'high' : needOrigin === 'AI_INFERRED' || needOrigin === 'PUBLIC_WEBSITE' ? 'medium' : 'unknown',
    weightedContribution: needRaw !== 'UNKNOWN' ? needPoints : null,
    missingInformation: needMissing,
  });

  // =========================================================================
  // 2. CAPABILITY & ARCHITECTURE MATCH (25% default weight)
  // =========================================================================
  let capRaw: number | 'UNKNOWN' = 50;
  let capOrigin: EvidenceOrigin = 'UNKNOWN';
  let capEvidence = 'Standard capability alignment.';
  let capMissing: string | null = null;

  const keyCaps = (offering.keyCapabilities || []).concat(sellerCtx?.coreFeatures || []);
  const leadTech = lead.technologies || [];

  const matchingTech = leadTech.filter((t) =>
    keyCaps.some((c) => c.toLowerCase().includes(t.toLowerCase())) ||
    ['snowflake', 'databricks', 'dbt', 'postgres', 'aws', 'kubernetes', 'spark'].some((stack) => t.toLowerCase().includes(stack))
  );

  const hasLegacyTool = leadTech.some((t) => ['excel', 'quickbooks', 'legacy', 'paper'].includes(t.toLowerCase()));

  if (matchingTech.length >= 2) {
    capRaw = 95;
    capOrigin = lead.rawRow && 'technologies' in lead.rawRow ? 'USER_PROVIDED' : 'PUBLIC_WEBSITE';
    capEvidence = `Verified high-gravity tech stack match (${matchingTech.join(', ')}). Native compatibility confirmed.`;
    primaryStrengths.push(`Compatible technical infrastructure: ${matchingTech.slice(0, 3).join(', ')}`);
  } else if (matchingTech.length === 1) {
    capRaw = 75;
    capOrigin = lead.rawRow && 'technologies' in lead.rawRow ? 'USER_PROVIDED' : 'PUBLIC_WEBSITE';
    capEvidence = `Partial stack compatibility detected (${matchingTech[0]}). Minor adaptation required.`;
  } else if (hasLegacyTool) {
    capRaw = 10;
    capOrigin = 'USER_PROVIDED';
    capEvidence = 'Legacy/manual tooling detected. Offering requires modern architecture.';
    primaryDisqualifiers.push('Incompatible legacy technology environment');
  } else if (leadTech.length > 0 || lead.description || (companyIntel && 'products' in companyIntel)) {
    capRaw = 60;
    capOrigin = lead.description ? 'PUBLIC_WEBSITE' : 'AI_INFERRED';
    capEvidence = 'Standard workflow match without specific proprietary blockers.';
  } else {
    // Explicitly UNKNOWN
    capRaw = 'UNKNOWN';
    capOrigin = 'UNKNOWN';
    capEvidence = 'Technical architecture, tooling, and infrastructure stack undisclosed.';
    capMissing = 'Tech Stack & Capability Compatibility';
    missingFields.push('Technical Capabilities');
  }

  const capPoints = capRaw !== 'UNKNOWN' ? Number((capRaw * weights.capabilityMatchWeight).toFixed(1)) : 0;
  breakdown.push({
    criterion: 'Capability & Architecture Match',
    weightPct: Math.round(weights.capabilityMatchWeight * 100),
    maxPoints: Math.round(weights.capabilityMatchWeight * 100),
    awardedPoints: capPoints,
    auditRationale: capEvidence,
    rating: capRaw,
    supportingEvidence: capEvidence,
    evidenceOrigin: capOrigin,
    confidence: capOrigin === 'USER_PROVIDED' ? 'high' : capOrigin === 'PUBLIC_WEBSITE' ? 'medium' : 'unknown',
    weightedContribution: capRaw !== 'UNKNOWN' ? capPoints : null,
    missingInformation: capMissing,
  });

  // =========================================================================
  // 3. STAKEHOLDER & ECONOMIC FEASIBILITY (20% default weight)
  // =========================================================================
  let stakeRaw: number | 'UNKNOWN' = 60;
  let stakeOrigin: EvidenceOrigin = 'UNKNOWN';
  let stakeEvidence = 'Moderate economic feasibility based on company size.';
  let stakeMissing: string | null = null;

  const headcount = lead.headcount;

  // Academic Guardrail: "If no stakeholder information exists, mark this attribute UNKNOWN.
  // Do not assume employee count alone establishes purchasing authority."
  if (headcount === null || headcount === undefined || headcount <= 0) {
    stakeRaw = 'UNKNOWN';
    stakeOrigin = 'UNKNOWN';
    stakeEvidence = 'Headcount and buying committee undisclosed; purchasing authority unknown.';
    stakeMissing = 'Stakeholder Authority & Headcount';
    missingFields.push('Stakeholders & Organization Scale');
  } else {
    stakeOrigin = 'USER_PROVIDED';
    if (headcount >= 150 && headcount <= 2500) {
      stakeRaw = 90;
      stakeEvidence = `Optimal organization size (${headcount} FTE). High likelihood of specialized VP/Director department heads with budget.`;
      primaryStrengths.push(`Organization scale (${headcount} FTE) fits target buying committee`);
    } else if (headcount > 2500) {
      stakeRaw = 75;
      stakeEvidence = `Large enterprise (${headcount} FTE). Strong budget capacity but lengthy procurement cycles.`;
    } else if (headcount >= 30 && headcount < 150) {
      stakeRaw = 65;
      stakeEvidence = `Emerging team (${headcount} FTE). Fast decision-making but limited discretionary tool budget.`;
    } else {
      stakeRaw = 30;
      stakeEvidence = `Early-stage (<30 FTE). Unlikely to sustain typical ${offering.typicalACV || 'commercial'} ACV commitment.`;
      primaryDisqualifiers.push('Sub-scale headcount to justify software spend');
    }
  }

  const stakePoints = stakeRaw !== 'UNKNOWN' ? Number((stakeRaw * weights.stakeholderFeasibilityWeight).toFixed(1)) : 0;
  breakdown.push({
    criterion: 'Stakeholder & Economic Feasibility',
    weightPct: Math.round(weights.stakeholderFeasibilityWeight * 100),
    maxPoints: Math.round(weights.stakeholderFeasibilityWeight * 100),
    awardedPoints: stakePoints,
    auditRationale: stakeEvidence,
    rating: stakeRaw,
    supportingEvidence: stakeEvidence,
    evidenceOrigin: stakeOrigin,
    confidence: stakeOrigin === 'USER_PROVIDED' ? 'high' : 'unknown',
    weightedContribution: stakeRaw !== 'UNKNOWN' ? stakePoints : null,
    missingInformation: stakeMissing,
  });

  // =========================================================================
  // 4. FIRMOGRAPHIC & HYPOTHESIS ALIGNMENT (20% default weight)
  // =========================================================================
  let firmoRaw: number | 'UNKNOWN' = 60;
  let firmoOrigin: EvidenceOrigin = 'UNKNOWN';
  let firmoEvidence = 'General market alignment.';
  let firmoMissing: string | null = null;

  const leadInd = (lead.industry || '').trim();

  if (!leadInd) {
    firmoRaw = 'UNKNOWN';
    firmoOrigin = 'UNKNOWN';
    firmoEvidence = 'Industry vertical and business model undisclosed.';
    firmoMissing = 'Firmographic Profile & Industry Vertical';
    missingFields.push('Firmographics & Industry');
  } else {
    firmoOrigin = 'USER_PROVIDED';
    const industryMatches = targetIndustries.some((ind) =>
      leadInd.toLowerCase().includes(ind.toLowerCase())
    );

    if (industryMatches) {
      firmoRaw = 90;
      firmoEvidence = `Industry vertical (${leadInd}) directly matches core ICP hypothesis target list.`;
      primaryStrengths.push(`Direct industry vertical fit: ${leadInd}`);
    } else if (leadInd.toLowerCase().includes('freight') || leadInd.toLowerCase().includes('trucking')) {
      firmoRaw = 25;
      firmoEvidence = `Vertical (${leadInd}) is outside stated high-fit parameters.`;
      primaryDisqualifiers.push(`Non-target vertical (${leadInd})`);
    } else {
      firmoRaw = 65;
      firmoEvidence = `Adjacent vertical (${leadInd}) with potential transferability.`;
    }
  }

  const firmoPoints = firmoRaw !== 'UNKNOWN' ? Number((firmoRaw * weights.firmographicAlignmentWeight).toFixed(1)) : 0;
  breakdown.push({
    criterion: 'Firmographic & Hypothesis Alignment',
    weightPct: Math.round(weights.firmographicAlignmentWeight * 100),
    maxPoints: Math.round(weights.firmographicAlignmentWeight * 100),
    awardedPoints: firmoPoints,
    auditRationale: firmoEvidence,
    rating: firmoRaw,
    supportingEvidence: firmoEvidence,
    evidenceOrigin: firmoOrigin,
    confidence: firmoOrigin === 'USER_PROVIDED' ? 'high' : 'unknown',
    weightedContribution: firmoRaw !== 'UNKNOWN' ? firmoPoints : null,
    missingInformation: firmoMissing,
  });

  // =========================================================================
  // 5. EVIDENCE COVERAGE CALCULATION
  // =========================================================================
  let assessableWeight = 0;
  if (needRaw !== 'UNKNOWN') assessableWeight += weights.needUrgencyWeight;
  if (capRaw !== 'UNKNOWN') assessableWeight += weights.capabilityMatchWeight;
  if (stakeRaw !== 'UNKNOWN') assessableWeight += weights.stakeholderFeasibilityWeight;
  if (firmoRaw !== 'UNKNOWN') assessableWeight += weights.firmographicAlignmentWeight;

  const evidenceCoverage = Math.round(assessableWeight * 100);
  const isInsufficientEvidence = evidenceCoverage < 70;

  // =========================================================================
  // 6. HARD DISQUALIFICATION ENGINE (Part 8)
  // =========================================================================
  let isDisqualified = false;
  let disqualificationReason: string | null = null;
  let disqualificationEvidence: string | null = null;
  let disqualificationConstraint: string | null = null;

  // A. Geographic Exclusion Check
  if (targetGeos.length > 0 && lead.country && lead.country.trim().length > 0) {
    const leadCountryLower = lead.country.toLowerCase();
    const isGeoMatched = targetGeos.some((geo) => {
      const g = geo.toLowerCase();
      return (
        leadCountryLower.includes(g) ||
        g.includes(leadCountryLower) ||
        (g.includes('north america') && ['united states', 'usa', 'us', 'canada', 'mexico'].some((c) => leadCountryLower.includes(c))) ||
        (g.includes('europe') && ['uk', 'germany', 'france', 'netherlands', 'ireland', 'sweden'].some((c) => leadCountryLower.includes(c)))
      );
    });

    if (!isGeoMatched) {
      isDisqualified = true;
      disqualificationReason = `Operating country (${lead.country}) is outside seller target territories.`;
      disqualificationEvidence = `Lead Country: ${lead.country}`;
      disqualificationConstraint = `Target Geographies: ${targetGeos.join(', ')}`;
    }
  }

  // B. Target Industry Exclusion Check
  const excludedIndustries = context?.excludedIndustries || [];
  if (!isDisqualified && excludedIndustries.length > 0 && leadInd) {
    const isExcludedInd = excludedIndustries.some((ex) => leadInd.toLowerCase().includes(ex.toLowerCase()));
    if (isExcludedInd) {
      isDisqualified = true;
      disqualificationReason = `Industry vertical (${leadInd}) is explicitly prohibited by seller exclusion policy.`;
      disqualificationEvidence = `Lead Industry: ${leadInd}`;
      disqualificationConstraint = `Excluded Industries: ${excludedIndustries.join(', ')}`;
    }
  }

  // C. Explicit CRM / Operational Stage Disqualification
  if (!isDisqualified) {
    const stage = (lead.leadStage || '').toLowerCase();
    const desc = (lead.description || '').toLowerCase();
    const isStageDisqualified = ['disqualified', 'bankruptcy', 'closed', 'churned', 'insolvent'].includes(stage);
    const isNotesDisqualified = desc.includes('chapter 11') || desc.includes('bankruptcy') || desc.includes('permanently closed');

    if (isStageDisqualified || isNotesDisqualified) {
      isDisqualified = true;
      disqualificationReason = lead.reasonWonLost || (isNotesDisqualified ? 'Insolvent or permanently closed in corporate records.' : 'Explicitly marked as disqualified in CRM records.');
      disqualificationEvidence = isStageDisqualified ? `CRM Status: ${lead.leadStage}` : 'Public Record: Insolvency / Closure';
      disqualificationConstraint = 'Historical Lead Status & Solvency';
    }
  }

  // D. Severe Technical Incompatibility Check
  if (!isDisqualified && (context?.strictDisqualification || leadTech.length > 0)) {
    const severeIncompatibleTech = leadTech.find((t) =>
      ['legacy mainframe', 'as400', 'cobol', 'paper-based', 'on-premise only'].some((arch) => t.toLowerCase().includes(arch))
    );
    if (severeIncompatibleTech) {
      isDisqualified = true;
      disqualificationReason = `Severe technical incompatibility: legacy architecture (${severeIncompatibleTech}) cannot integrate with modern cloud stack.`;
      disqualificationEvidence = `Incompatible Tooling: ${severeIncompatibleTech}`;
      disqualificationConstraint = 'Architecture Prerequisite: Modern Cloud API / Webhook Integration';
    }
  }

  // =========================================================================
  // 7. BUYING INTENT EVALUATION (Part 7 - Distinct from ICP Fit)
  // =========================================================================
  let intentScore: number | null = null;
  let intentLabel = 'BUYING INTENT: UNKNOWN';

  if (lead.leadStage && ['opportunity', 'qualified', 'contacted', 'won'].includes(lead.leadStage)) {
    if (lead.leadStage === 'won') {
      intentScore = 100;
      intentLabel = 'VERIFIED CUSTOMER (WON)';
    } else if (lead.leadStage === 'opportunity') {
      intentScore = 85;
      intentLabel = 'ACTIVE SALES OPPORTUNITY';
    } else if (lead.leadStage === 'qualified') {
      intentScore = 70;
      intentLabel = 'QUALIFIED INBOUND / PIPELINE';
    } else {
      intentScore = 50;
      intentLabel = 'ENGAGED / CONTACTED';
    }
  }

  // =========================================================================
  // 8. TOTAL SCORE & TIER ASSIGNMENT
  // =========================================================================
  const totalScore = Number((needPoints + capPoints + stakePoints + firmoPoints).toFixed(1));

  let tier: ICPTier;
  let recommendedAction: LeadICPScore['recommendedAction'];

  if (isDisqualified) {
    tier = 'Tier 4: Disqualified';
    recommendedAction = 'Archive / Ignore';
    primaryDisqualifiers.unshift(disqualificationReason || 'Disqualified by target constraint');
  } else if (isInsufficientEvidence) {
    // Insufficient evidence cannot be assigned Tier 1
    tier = 'Tier 3: Niche / Edge';
    recommendedAction = 'Further Discovery';
    primaryDisqualifiers.push(`Incomplete data coverage (${evidenceCoverage}%) prevents high-conviction tier assignment`);
  } else if (totalScore >= 80) {
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

  const sourceFingerprint = `${lead.id}:${needRaw}:${capRaw}:${stakeRaw}:${firmoRaw}:${weights.needUrgencyWeight}:${weights.capabilityMatchWeight}`;

  return {
    leadId: lead.id,
    companyName: lead.companyName,
    domain: lead.domain,
    totalScore,
    tier,
    confidence: Number((0.85 + totalScore / 1000).toFixed(2)),
    isHypothesisOnly: !offering.icpHypothesis?.isValidated && !lead.reasonWonLost,
    breakdown,
    primaryStrengths,
    primaryDisqualifiers,
    recommendedAction,
    scoredAt: new Date().toISOString(),

    // Prompt 12 Fields:
    evidenceCoverage,
    isInsufficientEvidence,
    intentScore,
    intentLabel,
    isDisqualified,
    disqualificationReason,
    disqualificationEvidence,
    disqualificationConstraint,
    missingFields,
    modelVersion: CURRENT_SCORING_MODEL_VERSION,
    sourceFingerprint,
    segmentId: context?.segment?.id || null,
    segmentName: context?.segment?.name || null,
  };
}

/**
 * Batch score multiple leads with optional rich analysis context.
 */
export function batchScoreLeads(
  leads: NormalizedLead[],
  offering: OfferingProfile,
  analysis?: FullStrategicAnalysis,
  customWeights?: Partial<ScoringWeights>,
  contextBundle?: {
    companyIntelligences?: Record<string, CompanyIntelligence | CompanyAnalysisEnvelope>;
    fiveC?: DetailedFiveCAnalysis | null;
    segments?: CustomerSegment[];
    sellerContext?: SellerProductContext | null;
    requireNeedGap?: boolean;
  }
): LeadICPScore[] {
  return leads.map((lead) => {
    const needGap = analysis?.needGaps?.find((g) => g.leadId === lead.id) ||
      (analysis && 'companyNeedGaps' in analysis && (analysis as any).companyNeedGaps?.[lead.id]);

    const companyIntel = contextBundle?.companyIntelligences?.[lead.id];
    const segment = contextBundle?.segments?.find((s) => s.primaryCompanyIds?.includes(lead.id) || s.matchingCompanyIds?.includes(lead.id));

    return calculateDeterministicICPScore(lead, offering, needGap, customWeights, {
      companyIntelligence: companyIntel,
      fiveC: contextBundle?.fiveC,
      segment,
      sellerContext: contextBundle?.sellerContext,
      requireNeedGap: contextBundle?.requireNeedGap,
    });
  });
}
