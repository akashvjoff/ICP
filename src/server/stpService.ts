import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CustomerSegment,
  DatasetNeedGapSummary,
  DatasetSTPAnalysis,
  DetailedFiveCAnalysis,
  EvidenceOrigin,
  NeedGapAnalysis,
  SegmentMembership,
  SegmentOutcomeSummary,
  SegmentPositioning,
  SegmentTargetingAssessment,
} from '../types/analysis';
import type { SellerProfileContext } from './strategicAnalysisService';
import type { LeadForAnalysis } from './analysisJobService';
import { shortProblemLabel } from '../lib/offeringGrounding';
import { classifyLeadStage } from '../lib/leadOutcomes';

export interface STPRepository {
  assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void>;
  getDatasetSTPAnalysis(ownerUserId: string, datasetId: string): Promise<DatasetSTPAnalysis | null>;
  saveDatasetSTPAnalysis(
    ownerUserId: string,
    datasetId: string,
    analysis: DatasetSTPAnalysis
  ): Promise<void>;
  getSegment(ownerUserId: string, segmentId: string): Promise<CustomerSegment | null>;
}

// -----------------------------------------------------------------------------
// 1. OUTCOME DATA EXTRACTION & ANALYSIS (Deterministic Pure Math)
// -----------------------------------------------------------------------------

export function analyzeSegmentOutcomes(leads: LeadForAnalysis[]): SegmentOutcomeSummary {
  const totalLeads = leads.length;
  if (totalLeads === 0) {
    return {
      totalLeads: 0,
      leadsWithKnownOutcomes: 0,
      wonDeals: 0,
      lostDeals: 0,
      openDeals: 0,
      observedWinRate: null,
      winRateFormatted: 'Outcome data unavailable',
      totalWonDealValue: null,
      averageWonDealValue: null,
      medianWonDealValue: null,
      averageRetentionMonths: null,
      reasonsWon: [],
      reasonsLost: [],
      dataClassification: 'ICP HYPOTHESIS — OUTCOME DATA UNAVAILABLE',
      warnings: ['No leads present in segment to evaluate outcomes.'],
    };
  }

  let wonDeals = 0;
  let lostDeals = 0;
  let openDeals = 0;
  const wonDealValues: number[] = [];
  const retentionValues: number[] = [];
  const reasonsWonSet = new Set<string>();
  const reasonsLostSet = new Set<string>();

  for (const lead of leads) {
    const raw = (lead.raw_row || {}) as Record<string, unknown>;

    // The uploaded stage is authoritative; normalized lead_status is a fallback.
    const rawStatus = String(
      raw.leadStage ||
      raw['Lead Stage'] ||
      raw['lead stage'] ||
      raw.lead_status ||
      raw.status ||
      raw.stage ||
      lead.lead_status ||
      ''
    );
    const outcome = classifyLeadStage(rawStatus);

    if (outcome === 'positive') {
      wonDeals += 1;
      const rawVal = raw.dealValue ?? raw.deal_value ?? raw.annualRevenue;
      if (typeof rawVal === 'number' && !isNaN(rawVal) && rawVal > 0) {
        wonDealValues.push(rawVal);
      }
      const rawRet = raw.retentionMonths ?? raw.retention_months;
      if (typeof rawRet === 'number' && !isNaN(rawRet) && rawRet > 0) {
        retentionValues.push(rawRet);
      }
      const reason = String(raw.reasonWonLost ?? raw.reason_won_lost ?? raw.reasonWon ?? '').trim();
      if (reason) reasonsWonSet.add(reason);
    } else if (outcome === 'negative') {
      lostDeals += 1;
      const reason = String(raw.reasonWonLost ?? raw.reason_won_lost ?? raw.reasonLost ?? '').trim();
      if (reason) reasonsLostSet.add(reason);
    } else {
      openDeals += 1;
    }
  }

  const leadsWithKnownOutcomes = wonDeals + lostDeals;
  const observedWinRate =
    leadsWithKnownOutcomes >= 10
      ? Math.round((wonDeals / leadsWithKnownOutcomes) * 100)
      : null;

  const winRateFormatted =
    observedWinRate !== null
      ? `${wonDeals}/${leadsWithKnownOutcomes} (${observedWinRate}%)`
      : leadsWithKnownOutcomes > 0 ? `Awaiting 10 outcomes (${leadsWithKnownOutcomes} recorded)` : 'Outcome data unavailable';

  const totalWonDealValue =
    wonDealValues.length > 0
      ? wonDealValues.reduce((sum, v) => sum + v, 0)
      : null;

  const averageWonDealValue =
    wonDealValues.length > 0 && totalWonDealValue !== null
      ? Math.round(totalWonDealValue / wonDealValues.length)
      : null;

  let medianWonDealValue: number | null = null;
  if (wonDealValues.length > 0) {
    const sorted = [...wonDealValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianWonDealValue =
      sorted.length % 2 !== 0
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  const averageRetentionMonths =
    retentionValues.length > 0
      ? Math.round(retentionValues.reduce((sum, v) => sum + v, 0) / retentionValues.length)
      : null;

  const warnings: string[] = [];
  if (leadsWithKnownOutcomes === 0) {
    warnings.push(
      'ICP HYPOTHESIS: No positive or negative Lead Stage outcomes are available.'
    );
  } else if (leadsWithKnownOutcomes < 10) {
    warnings.push(
      `Win rate will appear after 10 positive or negative Lead Stage outcomes; ${leadsWithKnownOutcomes} recorded so far.`
    );
  }

  const dataClassification =
    leadsWithKnownOutcomes >= 10
      ? 'CUSTOMER-BACKED SEGMENT ANALYSIS'
      : leadsWithKnownOutcomes > 0 ? 'EARLY OUTCOME SIGNALS' : 'ICP HYPOTHESIS — OUTCOME DATA UNAVAILABLE';

  return {
    totalLeads,
    leadsWithKnownOutcomes,
    wonDeals,
    lostDeals,
    openDeals,
    observedWinRate,
    winRateFormatted,
    totalWonDealValue,
    averageWonDealValue,
    medianWonDealValue,
    averageRetentionMonths,
    reasonsWon: Array.from(reasonsWonSet),
    reasonsLost: Array.from(reasonsLostSet),
    dataClassification,
    warnings,
  };
}

// -----------------------------------------------------------------------------
// 2. TARGETING EVALUATION ENGINE (3 Core Marketing Dimensions)
// -----------------------------------------------------------------------------

export function evaluateSegmentTargeting(
  segment: Omit<CustomerSegment, 'outcomes'>,
  outcomes: SegmentOutcomeSummary,
  totalCohortSize: number,
  seller: SellerProfileContext,
  fiveC: DetailedFiveCAnalysis
): SegmentTargetingAssessment {
  if (segment.isInsufficientEvidenceGroup) {
    return {
      segmentId: segment.id,
      segmentName: segment.name,
      salesPotential: {
        score: 10,
        label: 'Unknown',
        rationale: 'Quarantined due to insufficient descriptive or website evidence.',
        isProvisional: true,
      },
      profitPotential: {
        score: null,
        label: 'PROFIT POTENTIAL — INSUFFICIENT DATA',
        rationale: 'No financial or operational data available for ungrounded leads.',
        hasSufficientCostData: false,
      },
      uniqueCustomerNeeds: {
        score: 10,
        label: 'Low',
        rationale: 'Unsubstantiated operational friction; no specific business problem identified.',
        unmetFriction: 'None evidenced',
      },
      feasibilityAndContextMatch: {
        score: 10,
        label: 'Constrained',
        rationale: 'Cannot verify technical readiness or buying committee without company data.',
      },
      coverageConfidence: 'low',
      attractivenessScore: 10,
      recommendationTier: 'Avoid',
      recommendationRationale: 'Quarantined from targeting campaigns until verified company data is supplied.',
      isConfidentWinner: false,
    };
  }

  // 1. Sales Potential
  // Based on primary member volume, share of dataset, and observed win outcomes if available
  const sampleSharePct = totalCohortSize > 0 ? (segment.companyCount / totalCohortSize) * 100 : 0;
  let salesScore = Math.min(95, Math.max(30, Math.round(sampleSharePct * 1.5 + 20)));

  if (outcomes.observedWinRate !== null) {
    // Bolster with real customer win rate
    salesScore = Math.round(salesScore * 0.5 + outcomes.observedWinRate * 0.5);
  }

  const salesLabel: SegmentTargetingAssessment['salesPotential']['label'] =
    outcomes.leadsWithKnownOutcomes > 0
      ? salesScore >= 75
        ? 'High'
        : 'Moderate'
      : segment.companyCount >= 5
      ? 'Provisional'
      : 'Unknown';

  const salesRationale =
    outcomes.leadsWithKnownOutcomes >= 10
      ? `Supported by ${segment.companyCount} accounts in cohort with ${outcomes.winRateFormatted} win rate.`
      : `Scale within uploaded sample: ${segment.companyCount} accounts (${Math.round(sampleSharePct)}%). Note: Sample share does not represent total market TAM/SAM.`;

  // 2. Profit Potential (Strict Academic Guardrail: Revenue != Profit)
  // If CAC, cost-to-serve, or gross margin are missing, MUST show PROFIT POTENTIAL — INSUFFICIENT DATA
  const hasCostData = false; // Uploaded CSV lead lists lack customer acquisition cost (CAC) or cost-to-serve
  const profitPotential: SegmentTargetingAssessment['profitPotential'] = {
    score: null,
    label: 'PROFIT POTENTIAL — INSUFFICIENT DATA',
    rationale:
      'Customer acquisition cost (CAC), cost to serve, and gross margin are unobserved in the uploaded lead records. Deal revenue cannot be treated as profit without unit-economics disclosures.',
    hasSufficientCostData: false,
  };

  // 3. Unique Customer Needs
  // Evaluate the strength of the shared problem (acute friction) and seller's distinct capability match
  const capabilityMatchCount = segment.relevantSellerFeatures.length;
  const isAcuteNeed =
    segment.description.toLowerCase().includes('manual') ||
    segment.sharedProblem.toLowerCase().includes('outbound') ||
    segment.sharedProblem.toLowerCase().includes('prospect');
  let needsScore = 60;

  if (capabilityMatchCount >= 2 || (capabilityMatchCount >= 1 && isAcuteNeed)) {
    needsScore = 85;
  } else if (capabilityMatchCount >= 1) {
    needsScore = 75;
  }

  const uniqueNeedsLabel: 'High' | 'Moderate' | 'Low' =
    needsScore >= 80 ? 'High' : needsScore >= 60 ? 'Moderate' : 'Low';


  const uniqueNeedsRationale =
    capabilityMatchCount > 0
      ? `Strong alignment: ${capabilityMatchCount} seller capabilities directly resolve "${segment.sharedProblem}".`
      : `General capability alignment with standard workflow requirements.`;

  // 4. Feasibility & Context Match
  let feasibilityScore = 70;
  if (fiveC.competitors.researchRequired) {
    feasibilityScore -= 10; // Unverified competitive environment
  }
  const feasibilityLabel: 'Strong' | 'Moderate' | 'Constrained' =
    feasibilityScore >= 75 ? 'Strong' : feasibilityScore >= 55 ? 'Moderate' : 'Constrained';

  const feasibilityRationale = fiveC.competitors.researchRequired
    ? 'Feasibility is constrained by unverified competitive alternatives. Verification recommended.'
    : 'Seller capabilities and organizational scale indicate favorable delivery feasibility.';

  // 5. Attractiveness & Recommendation
  // Pure arithmetic synthesis:
  const attractivenessScore = Math.round(salesScore * 0.4 + needsScore * 0.4 + feasibilityScore * 0.2);

  // Invariant: If essential data (e.g. profit potential or outcome validation) is missing,
  // do NOT declare a conclusive winner. Provide a provisional shortlist!
  const hasRigorousValidation = outcomes.leadsWithKnownOutcomes >= 10 && hasCostData;
  const isConfidentWinner = hasRigorousValidation && attractivenessScore >= 80;

  let recommendationTier: SegmentTargetingAssessment['recommendationTier'] = 'Secondary Priority';
  let recommendationRationale = '';

  if (isConfidentWinner) {
    recommendationTier = 'Recommended Target';
    recommendationRationale = `Primary target candidate supported by observed conversion (${outcomes.winRateFormatted}) and need fit.`;
  } else if (attractivenessScore >= 70 && segment.companyCount >= 3) {
    recommendationTier = 'Provisional Shortlist';
    recommendationRationale = `Provisional target shortlist based on problem gravity and sample scale (${segment.companyCount} accounts). Full validation requires closed-deal outcome metrics and unit cost data.`;
  } else if (attractivenessScore >= 50) {
    recommendationTier = 'Secondary Priority';
    recommendationRationale = `Viable secondary segment. Prioritize testing after initial outreach to provisional shortlist.`;
  } else {
    recommendationTier = 'Monitor / Opportunistic';
    recommendationRationale = `Low urgency or limited evidence in current cohort. Treat opportunistically.`;
  }

  return {
    segmentId: segment.id,
    segmentName: segment.name,
    salesPotential: {
      score: salesScore,
      label: salesLabel,
      rationale: salesRationale,
      isProvisional: outcomes.leadsWithKnownOutcomes === 0,
    },
    profitPotential,
    uniqueCustomerNeeds: {
      score: needsScore,
      label: uniqueNeedsLabel,
      rationale: uniqueNeedsRationale,
      unmetFriction: segment.sharedProblem,
    },
    feasibilityAndContextMatch: {
      score: feasibilityScore,
      label: feasibilityLabel,
      rationale: feasibilityRationale,
    },
    coverageConfidence: segment.confidence,
    attractivenessScore,
    recommendationTier,
    recommendationRationale,
    isConfidentWinner,
  };
}

// -----------------------------------------------------------------------------
// 3. POSITIONING ENGINE (PoP, PoD, Credibility & Quality Control)
// -----------------------------------------------------------------------------

export function generateSegmentPositioning(
  segment: CustomerSegment,
  seller: SellerProfileContext,
  fiveC: DetailedFiveCAnalysis
): SegmentPositioning {
  if (segment.isInsufficientEvidenceGroup) {
    return {
      segmentId: segment.id,
      segmentName: segment.name,
      targetCustomer: 'Unclassified accounts with insufficient evidence',
      need: 'Unknown operational need',
      categoryPointOfParity: 'Standard compliance baseline',
      competitivePointOfParity: null,
      pointOfDifference: 'None formulated',
      reasonsToBelieve: [],
      positioningStatement: 'Positioning cannot be formulated for quarantined accounts lacking descriptive evidence.',
      proposedMarketingHooks: [],
      missingEvidence: ['Verified operational workflow data', 'Public website observations'],
      isTestedClaim: false,
      qualityControl: {
        relevance: false,
        differentiation: false,
        credibility: false,
        capabilityFit: false,
        clarity: false,
      },
    };
  }

  const targetCustomer = segment.name;
  const need = segment.sharedProblem;
  const sellerProduct = seller.productName || seller.companyName;
  const coreBenefit = seller.valueProposition || seller.primaryProblemSolved || 'operational efficiency';
  const relevantCapabilities =
    segment.relevantSellerFeatures.slice(0, 2).join(' and ') ||
    seller.keyCapabilities?.slice(0, 2).join(' and ') ||
    'automated workflow diagnostics';

  const categoryPointOfParity =
    seller.pointOfParity ||
    'Enterprise data security, standard API integrations, and auditable operational workflows.';

  // Invariant: If competitive alternatives are unknown or flagged researchRequired,
  // OMIT the competitive comparison rather than fabricating one!
  const hasCompetitorInfo =
    !fiveC.competitors.researchRequired &&
    Boolean(seller.mainAlternatives && seller.mainAlternatives.trim().length > 0);

  const competitivePointOfParity = hasCompetitorInfo
    ? `Matches incumbent ${seller.mainAlternatives} on workflow coverage while modernizing execution.`
    : null;

  const pointOfDifference =
    seller.pointOfDifference ||
    'Continuous autonomous diagnostics with zero manual overhead.';

  const reasonsToBelieve: string[] = [
    `Purpose-built capability architecture: ${relevantCapabilities}.`,
    `Direct alignment to acute customer friction: ${segment.desiredOutcome}.`,
  ];
  if (seller.typicalACV) {
    reasonsToBelieve.push(`Predictable enterprise engagement structure (${seller.typicalACV}).`);
  }

  // Positioning statement template:
  // "For [target customer], who struggles with [specific need], [seller product] provides [core benefit] through [relevant capabilities], unlike [supported alternative], because [credible evidence]."
  let positioningStatement = '';
  if (hasCompetitorInfo && seller.mainAlternatives) {
    positioningStatement = `For ${targetCustomer}, who struggles with ${need}, ${sellerProduct} provides ${coreBenefit} through ${relevantCapabilities}, unlike ${seller.mainAlternatives}, because it delivers ${pointOfDifference}.`;
  } else {
    positioningStatement = `For ${targetCustomer}, who struggles with ${need}, ${sellerProduct} provides ${coreBenefit} through ${relevantCapabilities}, because it delivers ${pointOfDifference}.`;
  }

  const proposedMarketingHooks = [
    `Stop losing pipeline to ${need.toLowerCase()}. See how ${sellerProduct} delivers ${coreBenefit.toLowerCase()}.`,
    `Engineered for ${targetCustomer}: solve ${need.toLowerCase()} through ${relevantCapabilities}.`,
  ];

  const missingEvidence: string[] = [
    'Message untested in live market outbound campaigns (Proposed Hypothesis).',
  ];
  if (!hasCompetitorInfo) {
    missingEvidence.push(
      'Competitive comparison omitted: Competitor alternatives not provided in seller onboarding.'
    );
  }

  const qualityControl = {
    relevance: true,
    differentiation: Boolean(pointOfDifference && pointOfDifference.length > 5),
    credibility: reasonsToBelieve.length >= 2,
    capabilityFit: Boolean(relevantCapabilities && relevantCapabilities.length > 5),
    clarity: Boolean(positioningStatement && positioningStatement.length > 20),
  };

  return {
    segmentId: segment.id,
    segmentName: segment.name,
    targetCustomer,
    need,
    categoryPointOfParity,
    competitivePointOfParity,
    pointOfDifference,
    reasonsToBelieve,
    positioningStatement,
    proposedMarketingHooks,
    missingEvidence,
    isTestedClaim: false,
    qualityControl,
  };
}

// -----------------------------------------------------------------------------
// 4. CORE STP ENGINE PIPELINE (Deterministic TypeScript Arithmetic)
// -----------------------------------------------------------------------------

export function buildDatasetSTPAnalysis(
  seller: SellerProfileContext,
  datasetId: string,
  needGapSummary: DatasetNeedGapSummary,
  fiveC: DetailedFiveCAnalysis,
  leads: LeadForAnalysis[],
  companyNeedGaps: Record<string, NeedGapAnalysis> = {}
): DatasetSTPAnalysis {
  const totalAnalyzed = leads.length;
  const ownerUserId = leads[0]?.owner_user_id || 'default-owner';
  const sellerOfferingId = seller.id || 'seller-offering-default';

  if (totalAnalyzed === 0) {
    return {
      datasetId,
      ownerUserId,
      sellerOfferingId,
      totalAnalyzed: 0,
      candidateSegmentsCount: 0,
      insufficientEvidenceCount: 0,
      insufficientEvidenceCompanyIds: [],
      segments: [],
      memberships: {},
      targetingAssessments: {},
      positioningRecommendations: {},
      overallTargetingRecommendation: {
        recommendedSegmentId: null,
        summary: 'No leads available to segment.',
        isProvisional: true,
      },
      generatedAt: new Date().toISOString(),
      versionFingerprint: `stp-${datasetId}-empty`,
    };
  }

  // 1. Identify insufficient evidence leads
  const insufficientLeadIdsSet = new Set<string>(
    needGapSummary.insufficientEvidenceLeadIds || []
  );

  // Also include leads explicitly flagged as insufficient_evidence in companyNeedGaps
  for (const lead of leads) {
    const gap = companyNeedGaps[lead.id];
    if (gap && gap.analysisStatus === 'insufficient_evidence') {
      insufficientLeadIdsSet.add(lead.id);
    }
  }

  const insufficientEvidenceCount = insufficientLeadIdsSet.size;
  const insufficientEvidenceCompanyIds = Array.from(insufficientLeadIdsSet);

  // 2. Identify patterns and map company memberships
  // We use existing NeedGapPattern[] from Prompt 10
  const topPatterns = needGapSummary.topNeedPatterns || [];

  // Lead lookup map
  const leadMap = new Map<string, LeadForAnalysis>(leads.map((l) => [l.id, l]));

  // Primary membership mapping: each lead gets EXACTLY ONE primary segment
  // to prevent double-counting.
  const leadPrimarySegmentMap = new Map<string, string>();
  const leadSecondaryPatternsMap = new Map<string, string[]>();

  for (const lead of leads) {
    if (insufficientLeadIdsSet.has(lead.id)) {
      leadPrimarySegmentMap.set(lead.id, 'segment-insufficient-evidence');
      leadSecondaryPatternsMap.set(lead.id, []);
      continue;
    }

    // Find all patterns matching this lead
    const matchedPatterns = topPatterns.filter((p) =>
      p.supportingLeadIds.includes(lead.id)
    );

    if (matchedPatterns.length === 0) {
      // If analyzed but didn't match any prominent pattern, provisionally categorize
      leadPrimarySegmentMap.set(lead.id, 'segment-insufficient-evidence');
      leadSecondaryPatternsMap.set(lead.id, []);
      insufficientLeadIdsSet.add(lead.id);
      continue;
    }

    // Determine primary segment:
    // Check if company's need gap is Acute for a specific pattern
    const companyGap = companyNeedGaps[lead.id];
    let primaryPattern = matchedPatterns[0];

    if (companyGap && companyGap.problemIntensity === 'Acute') {
      const acuteMatch = matchedPatterns.find((p) =>
        p.problemTitle.toLowerCase().includes(companyGap.relevantProblem.toLowerCase()) ||
        companyGap.relevantProblem.toLowerCase().includes(p.problemTitle.toLowerCase())
      );
      if (acuteMatch) primaryPattern = acuteMatch;
    }

    const primarySegId = `segment-${primaryPattern.id}`;
    leadPrimarySegmentMap.set(lead.id, primarySegId);

    const secondary = matchedPatterns
      .filter((p) => p.id !== primaryPattern.id)
      .map((p) => p.id);
    leadSecondaryPatternsMap.set(lead.id, secondary);
  }

  // 3. Build candidate segments (up to 3-5 segments based on patterns)
  const segments: CustomerSegment[] = [];

  for (let idx = 0; idx < Math.min(topPatterns.length, 5); idx++) {
    const pattern = topPatterns[idx];
    const segId = `segment-${pattern.id}`;

    // Matching leads (all leads associated with pattern)
    const matchingLeadIds = pattern.supportingLeadIds.filter(
      (id) => !insufficientLeadIdsSet.has(id)
    );

    // Primary leads (leads where this is the primary segment)
    const primaryLeadIds = matchingLeadIds.filter(
      (id) => leadPrimarySegmentMap.get(id) === segId
    );

    if (primaryLeadIds.length === 0 && matchingLeadIds.length === 0) {
      continue;
    }

    const primaryLeads = primaryLeadIds
      .map((id) => leadMap.get(id)!)
      .filter(Boolean);

    // Human-readable commercial name describing the shared problem
    const commercialName = shortProblemLabel(pattern.problemTitle);

    // Firmographics extraction from underlying primary leads
    const industries = Array.from(
      new Set(
        primaryLeads
          .map((l) => l.industry_raw)
          .filter((ind): ind is string => typeof ind === 'string' && ind.trim().length > 0)
      )
    );

    const companySizes = Array.from(
      new Set(
        primaryLeads
          .map((l) => {
            if (l.employee_count) {
              if (l.employee_count < 50) return '1-50 FTE';
              if (l.employee_count <= 250) return '51-250 FTE';
              if (l.employee_count <= 1000) return '251-1000 FTE';
              return '1000+ Enterprise FTE';
            }
            return l.company_size_raw || null;
          })
          .filter((s): s is string => typeof s === 'string' && s.length > 0)
      )
    );

    const businessModels = Array.from(
      new Set(
        primaryLeads
          .map((l) => l.business_model_raw)
          .filter((bm): bm is string => typeof bm === 'string' && bm.length > 0)
      )
    );

    const buyerRoles = Array.from(
      new Set(
        primaryLeads
          .flatMap((l) => {
            const gap = companyNeedGaps[l.id];
            return gap?.suggestedBuyerRoles || [];
          })
          .filter((r): r is string => typeof r === 'string' && r.length > 0)
      )
    );

    const companyCount = primaryLeadIds.length;
    const datasetShare = Math.round((companyCount / totalAnalyzed) * 100);
    const ratioFormatted = `${companyCount}/${totalAnalyzed}`;

    // Outcome summary
    const outcomes = analyzeSegmentOutcomes(primaryLeads);

    const segment: CustomerSegment = {
      id: segId,
      name: commercialName,
      description: pattern.description || `Accounts constrained by ${pattern.problemTitle.toLowerCase()}.`,
      sharedProblem: pattern.problemTitle,
      desiredOutcome: `Resolution of ${pattern.problemTitle.toLowerCase()} through targeted capability deployment.`,
      commonProductBenefits: pattern.relevantSellerCapabilities,
      matchingCompanyIds: matchingLeadIds,
      primaryCompanyIds: primaryLeadIds,
      companyCount,
      totalMatchingCount: matchingLeadIds.length,
      datasetShare,
      ratioFormatted,
      commonIndustries: industries.length > 0 ? industries : ['Cross-Industry B2B'],
      typicalCompanySizes: companySizes.length > 0 ? companySizes : ['Growth Stage (50-500 FTE)'],
      relevantBusinessModels: businessModels.length > 0 ? businessModels : ['B2B Technology / SaaS'],
      buyingRoleHypotheses: buyerRoles.length > 0 ? buyerRoles : [seller.primaryBuyer || 'VP of Operations (Hypothesis)'],
      relevantSellerFeatures: pattern.relevantSellerCapabilities,
      evidenceStrength: pattern.evidenceLevel === 'verified' ? 'high' : 'moderate',
      missingInformation: [
        'Willingness to pay (WTP) unverified across accounts',
        'Specific procurement budget ceilings unobserved',
      ],
      confidence: pattern.evidenceLevel === 'verified' ? 'high' : 'medium',
      outcomes,
      isInsufficientEvidenceGroup: false,
    };

    segments.push(segment);
  }

  // 4. Add Insufficient Evidence segment if needed
  if (insufficientLeadIdsSet.size > 0) {
    const insufficientCount = insufficientLeadIdsSet.size;
    const insufficientShare = Math.round((insufficientCount / totalAnalyzed) * 100);
    const insufficientLeads = Array.from(insufficientLeadIdsSet)
      .map((id) => leadMap.get(id)!)
      .filter(Boolean);

    const insufficientOutcomes = analyzeSegmentOutcomes(insufficientLeads);

    segments.push({
      id: 'segment-insufficient-evidence',
      name: 'Insufficient Evidence Quarantine',
      description: 'Accounts lacking sufficient descriptive, website, or operational evidence to formulate a grounded need hypothesis.',
      sharedProblem: 'Unsubstantiated operational friction (Insufficient Evidence)',
      desiredOutcome: 'Enrichment required before formulating operational ideal state.',
      commonProductBenefits: [],
      matchingCompanyIds: Array.from(insufficientLeadIdsSet),
      primaryCompanyIds: Array.from(insufficientLeadIdsSet),
      companyCount: insufficientCount,
      totalMatchingCount: insufficientCount,
      datasetShare: insufficientShare,
      ratioFormatted: `${insufficientCount}/${totalAnalyzed}`,
      commonIndustries: ['Unknown vertical'],
      typicalCompanySizes: ['Unknown headcount'],
      relevantBusinessModels: ['Unknown business model'],
      buyingRoleHypotheses: ['Unverified buying unit'],
      relevantSellerFeatures: [],
      evidenceStrength: 'exploratory',
      missingInformation: [
        'Company operational description missing or empty',
        'Public website content unverified or unreachable',
        'All commercial attributes remain strictly unknown',
      ],
      confidence: 'low',
      outcomes: insufficientOutcomes,
      isInsufficientEvidenceGroup: true,
    });
  }

  // 5. Build targeting assessments and positioning recommendations for each segment
  const targetingAssessments: Record<string, SegmentTargetingAssessment> = {};
  const positioningRecommendations: Record<string, SegmentPositioning> = {};

  for (const segment of segments) {
    const assessment = evaluateSegmentTargeting(
      segment,
      segment.outcomes,
      totalAnalyzed,
      seller,
      fiveC
    );
    targetingAssessments[segment.id] = assessment;

    const positioning = generateSegmentPositioning(segment, seller, fiveC);
    positioningRecommendations[segment.id] = positioning;
  }

  // 6. Build memberships record for every individual lead
  const memberships: Record<string, SegmentMembership> = {};
  for (const lead of leads) {
    const primarySegmentId = leadPrimarySegmentMap.get(lead.id) || 'segment-insufficient-evidence';
    const isInsufficient = primarySegmentId === 'segment-insufficient-evidence';
    const secondaryPatternIds = leadSecondaryPatternsMap.get(lead.id) || [];

    const origin: EvidenceOrigin = lead.user_corrected_description
      ? 'user_provided'
      : isInsufficient
      ? 'unknown'
      : 'inferred';

    const confidence: SegmentMembership['confidence'] = lead.user_corrected_description
      ? 'high'
      : isInsufficient
      ? 'low'
      : 'medium';

    memberships[lead.id] = {
      leadId: lead.id,
      companyName: lead.company_name,
      primarySegmentId,
      secondaryPatternIds,
      isInsufficientEvidence: isInsufficient,
      confidence,
      evidenceOrigin: origin,
    };
  }

  // 7. Overall targeting recommendation
  const validSegments = segments.filter((s) => !s.isInsufficientEvidenceGroup);
  const bestAssessment = validSegments
    .map((s) => targetingAssessments[s.id])
    .filter(Boolean)
    .sort((a, b) => b.attractivenessScore - a.attractivenessScore)[0];

  let overallTargetingRecommendation: DatasetSTPAnalysis['overallTargetingRecommendation'] = {
    recommendedSegmentId: null,
    summary: 'No segments qualify for a targeting recommendation due to insufficient data.',
    isProvisional: true,
  };

  if (bestAssessment) {
    const bestSeg = segments.find((s) => s.id === bestAssessment.segmentId);
    if (bestAssessment.isConfidentWinner) {
      overallTargetingRecommendation = {
        recommendedSegmentId: bestAssessment.segmentId,
        summary: `Validated Primary Target: ${bestAssessment.segmentName} (${bestSeg?.companyCount || 0} accounts, win rate: ${bestSeg?.outcomes.winRateFormatted || 'N/A'}).`,
        isProvisional: false,
      };
    } else {
      overallTargetingRecommendation = {
        recommendedSegmentId: bestAssessment.segmentId,
        summary: `Provisional Target Shortlist: ${bestAssessment.segmentName} (${bestSeg?.companyCount || 0} accounts, ${bestSeg?.datasetShare || 0}% share). Grounded in acute problem gravity, awaiting deal conversion validation.`,
        isProvisional: true,
      };
    }
  }

  return {
    datasetId,
    ownerUserId,
    sellerOfferingId,
    totalAnalyzed,
    candidateSegmentsCount: validSegments.length,
    insufficientEvidenceCount,
    insufficientEvidenceCompanyIds,
    segments,
    memberships,
    targetingAssessments,
    positioningRecommendations,
    overallTargetingRecommendation,
    generatedAt: new Date().toISOString(),
    versionFingerprint: `stp-${datasetId}-${Date.now()}`,
  };
}

// -----------------------------------------------------------------------------
// 5. SUPABASE & IN-MEMORY REPOSITORIES
// -----------------------------------------------------------------------------

export function createSupabaseSTPRepository(client: SupabaseClient): STPRepository {
  return {
    async assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void> {
      const { data, error } = await client
        .from('datasets')
        .select('id')
        .eq('id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Dataset not found or access denied.');
      }
    },

    async getDatasetSTPAnalysis(ownerUserId: string, datasetId: string): Promise<DatasetSTPAnalysis | null> {
      const { data, error } = await client
        .from('dataset_stp_analyses')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('dataset_id', datasetId)
        .maybeSingle();

      if (error || !data) return null;

      const rawJson = data.stp_analysis_json as unknown as DatasetSTPAnalysis;
      return {
        ...rawJson,
        id: data.id,
        datasetId: data.dataset_id,
        ownerUserId: data.owner_user_id,
      };
    },

    async saveDatasetSTPAnalysis(
      ownerUserId: string,
      datasetId: string,
      analysis: DatasetSTPAnalysis
    ): Promise<void> {
      await this.assertOwnedDataset(ownerUserId, datasetId);

      const { error } = await client
        .from('dataset_stp_analyses')
        .upsert(
          {
            owner_user_id: ownerUserId,
            dataset_id: datasetId,
            seller_offering_id: analysis.sellerOfferingId,
            stp_analysis_json: analysis,
            segments_count: analysis.candidateSegmentsCount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'owner_user_id,dataset_id' }
        );

      if (error) throw error;
    },

    async getSegment(ownerUserId: string, segmentId: string): Promise<CustomerSegment | null> {
      const { data, error } = await client
        .from('dataset_stp_analyses')
        .select('stp_analysis_json')
        .eq('owner_user_id', ownerUserId);

      if (error || !data) return null;

      for (const row of data) {
        const parsed = row.stp_analysis_json as unknown as DatasetSTPAnalysis;
        const found = parsed?.segments?.find((s) => s.id === segmentId);
        if (found) return found;
      }
      return null;
    },
  };
}

export class InMemorySTPRepository implements STPRepository {
  private stpAnalyses = new Map<string, DatasetSTPAnalysis>();
  private datasetOwners = new Map<string, string>();

  setDatasetOwner(datasetId: string, ownerUserId: string): void {
    this.datasetOwners.set(datasetId, ownerUserId);
  }

  async assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void> {
    const owner = this.datasetOwners.get(datasetId);
    if (owner && owner !== ownerUserId) {
      throw new Error(`Dataset ${datasetId} not found or not owned by user.`);
    }
  }

  async getDatasetSTPAnalysis(ownerUserId: string, datasetId: string): Promise<DatasetSTPAnalysis | null> {
    const item = this.stpAnalyses.get(`${ownerUserId}:${datasetId}`);
    return item ? structuredClone(item) : null;
  }

  async saveDatasetSTPAnalysis(
    ownerUserId: string,
    datasetId: string,
    analysis: DatasetSTPAnalysis
  ): Promise<void> {
    this.stpAnalyses.set(`${ownerUserId}:${datasetId}`, structuredClone(analysis));
  }

  async getSegment(ownerUserId: string, segmentId: string): Promise<CustomerSegment | null> {
    for (const [key, analysis] of this.stpAnalyses.entries()) {
      if (key.startsWith(`${ownerUserId}:`)) {
        const seg = analysis.segments.find((s) => s.id === segmentId);
        if (seg) return structuredClone(seg);
      }
    }
    return null;
  }
}
