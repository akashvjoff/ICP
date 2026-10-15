import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DatasetNeedGapSummary,
  DatasetSTPAnalysis,
  DetailedFiveCAnalysis,
  ExecutiveICPReport,
  FeatureAdvantageBenefit,
  MarketingMixDimension,
  PeopleMixAnalysis,
  PhysicalEvidenceMixAnalysis,
  PlaceMixAnalysis,
  PriceMixAnalysis,
  ProcessJourneyStage,
  ProcessMixAnalysis,
  ProductMixAnalysis,
  PromotionMixAnalysis,
  RecommendedActionItem,
  Segment7PsMarketingMix,
} from '../types/analysis';
import type { LeadICPScore } from '../types/scoring';
import type { SellerProfileContext } from './strategicAnalysisService';
import type { LeadForAnalysis } from './analysisJobService';
import { deriveTierCounts, qualifiedSegmentAnalysis } from '../lib/tiers';

export const CURRENT_REPORT_MODEL_VERSION = 'v1.5-consistent-tiers';

export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  // Prevent spreadsheet formula injection (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str}"`;
}

export interface ReportRepository {
  assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void>;
  getReport(ownerUserId: string, datasetId: string): Promise<ExecutiveICPReport | null>;
  saveReport(ownerUserId: string, datasetId: string, report: ExecutiveICPReport): Promise<void>;
}

// -----------------------------------------------------------------------------
// 1. DETERMINISTIC 7Ps MARKETING MIX ENGINE
// -----------------------------------------------------------------------------

export function buildProductMix(
  seller: SellerProfileContext,
  segmentName: string,
  sharedNeed: string,
  desiredOutcome: string
): ProductMixAnalysis {
  const sellerCaps = seller.keyCapabilities && seller.keyCapabilities.length > 0
    ? seller.keyCapabilities
    : ['Seller capabilities require validation'];

  const fabMapping: FeatureAdvantageBenefit[] = sellerCaps.map((cap, idx) => ({
    feature: cap,
    advantage: `Potential fit with ${sharedNeed}; validate in buyer discovery`,
    customerBenefit: `Potential contribution to ${desiredOutcome}; outcome is unverified`,
    isExisting: true,
  }));

  // Add potential product hypothesis
  fabMapping.push({
    feature: `[PROPOSED] Improvement for ${sharedNeed}`,
    advantage: 'Requires buyer validation and product feasibility review',
    customerBenefit: `Could improve ${desiredOutcome} if validated`,
    isExisting: false,
  });

  return {
    coreBenefit: desiredOutcome,
    expectedProduct: [
      seller.pointOfParity || 'Category expectations require buyer research',
      'Implementation requirements require validation',
    ],
    augmentedProduct: [
      seller.pointOfDifference || 'Differentiation requires customer evidence',
      ...sellerCaps.slice(0, 2),
    ],
    potentialProduct: [
      `[PROPOSED] Test a product improvement for ${sharedNeed}`,
      '[PROPOSED] Validate integration needs with target buyers',
    ],
    fabMapping,
    pointOfParity: seller.pointOfParity || 'Category baseline unverified.',
    pointOfDifference: seller.pointOfDifference || 'Differentiation unverified.',
    productGaps: [
      'Document buyer-requested integrations and missing capabilities',
    ],
    productPriorities: [
      `Validate the most important requirements for ${segmentName}`,
      'Measure time to first value in a customer pilot',
    ],
    proposedFeatureImprovements: [
      '[PROPOSED] Prioritize improvements after buyer interviews',
    ],
  };
}

export function buildPriceMix(
  seller: SellerProfileContext,
  segmentName: string
): PriceMixAnalysis {
  const observedPricing = seller.typicalACV || seller.pricingModel || null;
  const isPriceKnown = Boolean(observedPricing && observedPricing.trim().length > 0);

  return {
    pricingApproach: 'Value-Based Pricing',
    rationale: `Price is aligned with the quantifiable business value of resolving acute operational friction (${segmentName}), rather than cost-plus hours or simplistic commodity tiers.`,
    monetaryCosts: observedPricing ? `Indicative baseline: ${observedPricing}` : 'PRICING RECOMMENDATION: PROVISIONAL — REAL ACV UNDISCLOSED',
    switchingCosts: 'Unknown: document the buyer’s current process and migration work.',
    implementationCosts: 'Unknown: measure setup effort in a pilot.',
    costToServe: 'Unknown: validate delivery and support costs.',
    observedSellerPricing: observedPricing,
    isPricePointKnown: isPriceKnown,
    recommendedPricePoint: isPriceKnown
      ? `Indicative Tier: ${observedPricing} (Validate against buyer ROI threshold)`
      : 'PRICING RECOMMENDATION: PROVISIONAL — PRICE POINT: RESEARCH REQUIRED',
    recommendedPricingResearch: [
      'Conduct Van Westendorp Price Sensitivity Meter interviews with 10 target budget holders',
      'Ask buyers to estimate the cost of the problem using their own evidence',
      'Test pricing structure against the stated buying process',
      'Evaluate competitor price anchoring where public proposals or procurement quotes are verified',
    ],
  };
}

export function buildPlaceMix(
  seller: SellerProfileContext,
  segmentName: string
): PlaceMixAnalysis {
  return {
    distributionModel: 'Hybrid Direct & Partner',
    rationale: `Test direct discovery with ${segmentName} before investing in partner channels.`,
    customerTouchpoints: [
      'Product explanation on the seller website, if available',
      'Buyer discovery conversation',
      'Proof of concept with agreed success criteria, if feasible',
      'Procurement review when required',
    ],
    implementationRequirements: [
      'Confirm delivery requirements with the seller',
      'Identify a buyer contact for evaluation',
    ],
    channelRisks: [
      'Extended enterprise infosec reviews stalling sales cycle',
      'Over-reliance on unverified third-party systems integrators without direct seller oversight',
    ],
    missingEvidence: [
      'Partner ecosystem channel margin requirements and referral agreements undisclosed',
      'Self-service customer acquisition funnel metrics unverified',
    ],
  };
}

export function buildPromotionMix(
  seller: SellerProfileContext,
  segmentName: string,
  sharedNeed: string,
  desiredOutcome: string,
  primaryBuyer: string
): PromotionMixAnalysis {
  const buyerRole = primaryBuyer || 'potential buyer';

  return {
    decisionJourney: {
      needRecognition: `Hypothesis: ${sharedNeed} creates a reason to consider change; verify with buyers.`,
      searchForAlternatives: 'Ask buyers which alternatives they actually compare.',
      evaluationOfOptions: `Ask the ${buyerRole} which criteria matter in evaluation.`,
      purchaseAdoption: 'Confirm budget owner, approval process, and purchasing criteria.',
      postPurchaseEvaluation: `Measure whether the buyer achieved ${desiredOutcome}.`,
    },
    needAwarenessMessage: `Does ${sharedNeed} affect your team?`,
    valuePropositionMessage: seller.valueProposition || `Potential path to ${desiredOutcome}; validate the outcome.`,
    proofMessage: 'Proof is required before making performance or compliance claims.',
    recommendedChannels: {
      ownedMedia: [
        'Product explanation using verified capabilities',
        'Buyer education addressing the stated problem',
      ],
      earnedMedia: [
        'Relevant industry communities, subject to audience research',
      ],
      paidMedia: [
        `Provisional: test search terms related to ${sharedNeed}`,
      ],
      outboundDirect: [
        `Direct peer-to-peer outreach to ${buyerRole} titles at high-conviction accounts experiencing acute friction`,
      ],
      referralPartnerships: [
        'Potential referral partners identified through buyer interviews',
      ],
    },
    sampleDrafts: {
      headline: `Explore a better way to address ${sharedNeed}.`,
      outreachAngle: `[SUGGESTED DRAFT] Hi {{FirstName}}, is ${sharedNeed} a priority at {{Company}}? We are learning how teams approach this problem and would value a short conversation.`,
      discoveryQuestion: `How does your team currently handle ${sharedNeed}, and what would a better outcome look like?`,
      educationalContentAngle: `Buyer guide: approaches to ${sharedNeed}.`,
      callToAction: 'Schedule a discovery conversation.',
    },
  };
}

export function buildPeopleMix(
  seller: SellerProfileContext,
  primaryBuyer: string
): PeopleMixAnalysis {
  const buyer = primaryBuyer || 'potential buyer';

  return {
    buyerFacingExpertise: [
      `Understanding of ${seller.productName || 'the offering'} and its verified capabilities`,
      'Ability to discuss buyer outcomes without unsupported claims',
    ],
    salesConversationSkills: [
      'Challenger sales methodology: diagnosing hidden costs of status-quo inertia',
      'Qualification of problem severity, budget, and timeline',
      'Active listening about the buyer’s current process',
    ],
    buyingCommitteeEngagement: {
      economicBuyerRole: 'Economic buyer: identity and purchase criteria require validation.',
      championRole: `${buyer}: confirm interest and influence in discovery.`,
      technicalEvaluatorRole: 'Technical evaluator: identify only if the buying process requires one.',
    },
    onboardingSupportModel: 'Define onboarding ownership and support level after validating seller capacity.',
    trainingRequirements: [
      'Train customer-facing staff on verified capabilities and limits',
    ],
    customerServiceTouchpoints: [
      'Support channel and response targets to be confirmed with the seller',
      'Periodic review of verified buyer outcomes',
    ],
  };
}

export function buildProcessMix(
  seller: SellerProfileContext,
  segmentName: string
): ProcessMixAnalysis {
  const journeyStages: ProcessJourneyStage[] = [
    {
      stage: '1. Awareness & Discovery',
      customerAction: 'Interacts with technical educational content or receives targeted peer outreach.',
      sellerDelivery: `Explains the offering and asks whether ${seller.primaryProblemSolved || 'the stated problem'} is relevant.`,
      frictionPoints: ['Skepticism of vendor marketing claims', 'Time constraints of busy engineering leads'],
      valueCreationMechanism: 'Validates and quantifies the hidden cost of the customer’s existing friction.',
      metricsToMonitor: ['Meeting booking rate', 'Discovery qualification rate'],
      requiresHumanVerification: true,
    },
    {
      stage: '2. Technical Qualification',
      customerAction: 'Describes the current process, pain, and desired outcome.',
      sellerDelivery: 'Maps verified capabilities to the stated need and records gaps.',
      frictionPoints: ['Incomplete problem evidence', 'Unclear budget authority'],
      valueCreationMechanism: 'Confirms structural fit and establishes clear success criteria for pilot.',
      metricsToMonitor: ['Qualification pass rate', 'Problem clarity'],
      requiresHumanVerification: true,
    },
    {
      stage: '3. Evaluation / Pilot',
      customerAction: 'Evaluates the offering against agreed success criteria.',
      sellerDelivery: 'Provides a feasible evaluation path and records observed outcomes.',
      frictionPoints: ['Evaluation effort', 'Unclear success criteria'],
      valueCreationMechanism: 'Tests whether the offering delivers value in the buyer context.',
      metricsToMonitor: ['Time to first value', 'Pilot completion rate'],
      requiresHumanVerification: true,
    },
    {
      stage: '4. Commercial & Security Close',
      customerAction: 'Submits vendor security questionnaire and reviews contract terms.',
      sellerDelivery: 'Provides verified security and commercial information.',
      frictionPoints: ['Procurement legal redlines', 'Budget freeze or reallocation'],
      valueCreationMechanism: 'Minimizes administrative friction to enable rapid production adoption.',
      metricsToMonitor: ['Sales cycle duration (days)', 'Contract close rate'],
      requiresHumanVerification: true,
    },
    {
      stage: '5. Production Onboarding & Expansion',
      customerAction: 'Introduces the offering to intended users.',
      sellerDelivery: 'Supports onboarding and measures adoption.',
      frictionPoints: ['Slow adoption', 'Unclear ownership'],
      valueCreationMechanism: 'Measures whether expected value is realized over time.',
      metricsToMonitor: ['Product adoption', 'Customer retention'],
      requiresHumanVerification: false,
    },
  ];

  return {
    currentVsRecommended: {
      currentStateAssumption: 'Manual ad-hoc sales cycles with variable pilot durations and unstandardized success metrics.',
      recommendedStandardizedProcess: 'A rigid 5-stage customer journey with documented success criteria at each gate, reducing sales cycle duration and eliminating pilot stalls.',
    },
    journeyStages,
    serviceStandardizationRules: [
      'Never begin a pilot without written, mutually agreed success criteria and a confirmed decision date.',
      'Provide verified security documentation when buyers request it.',
      'Measure the time needed for a buyer to experience value.',
    ],
  };
}

export function buildPhysicalEvidenceMix(
  seller: SellerProfileContext,
  segmentName: string
): PhysicalEvidenceMixAnalysis {
  const existingProof: string[] = [];
  if (seller.website) existingProof.push(`Live product website and domain presence (${seller.website})`);
  if (seller.pointOfParity) existingProof.push(`Seller-stated point of parity, pending verification: ${seller.pointOfParity}`);

  const requiredProof: string[] = [
    'PROOF ASSET REQUIRED: Evidence for any performance or compliance claims the seller makes',
    'PROOF ASSET REQUIRED: Verified customer outcome or pilot result',
  ];

  return {
    existingProofAssets: existingProof,
    proofAssetsRequired: requiredProof,
    recommendedTrustSignals: [
      'Product demonstration based on verified functionality',
      'Clear explanation of how the offering works',
    ],
    documentationChecklist: [
      'Privacy and security documentation appropriate to the offering',
      'Implementation guidance based on the actual product',
      'Commercial terms reviewed by the seller',
    ],
  };
}

export function generateSegment7PsMix(
  seller: SellerProfileContext,
  segmentId: string,
  segmentName: string,
  sharedNeed: string,
  desiredOutcome: string,
  primaryBuyer: string
): Segment7PsMarketingMix {
  return {
    segmentId,
    segmentName,
    product: buildProductMix(seller, segmentName, sharedNeed, desiredOutcome),
    price: buildPriceMix(seller, segmentName),
    place: buildPlaceMix(seller, segmentName),
    promotion: buildPromotionMix(seller, segmentName, sharedNeed, desiredOutcome, primaryBuyer),
    people: buildPeopleMix(seller, primaryBuyer),
    process: buildProcessMix(seller, segmentName),
    physicalEvidence: buildPhysicalEvidenceMix(seller, segmentName),
    generatedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// 2. INTEGRATED ACTION PLAN GENERATOR
// -----------------------------------------------------------------------------

export function generateIntegratedActionPlan(
  seller: SellerProfileContext,
  stpAnalysis: DatasetSTPAnalysis,
  scoredLeads: LeadICPScore[]
): {
  immediate: RecommendedActionItem[];
  next: RecommendedActionItem[];
  later: RecommendedActionItem[];
  whatToValidateFirst: string[];
} {
  const targetSeg = stpAnalysis.segments.find(segment => !segment.isInsufficientEvidenceGroup && segment.companyCount > 0) || {
    id: 'segment-primary',
    name: 'Primary Candidate Segment',
    sharedProblem: 'Operational friction',
    desiredOutcome: 'Optimized workflow',
  };

  const tier1Leads = scoredLeads.filter((s) => s.tier === 'Tier 1: High Conviction');

  const immediate: RecommendedActionItem[] = [
    {
      id: 'act-imm-1',
      priority: 'IMMEDIATE',
      action: tier1Leads.length > 0
        ? `Launch a measured outbound test with ${tier1Leads.length} Tier 1 account${tier1Leads.length === 1 ? '' : 's'} using the ${targetSeg.name} positioning hook.`
        : `Qualify the highest-scoring accounts in ${targetSeg.name} through evidence gathering and discovery before launching Tier 1 outbound.`,
      linkedNeedGap: targetSeg.sharedProblem,
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Customer Buying Unit & Economic Buyer motivation',
      marketingMixDimension: 'promotion',
      suggestedRole: 'Account Executive / Outbound SDR',
      requiredInputs: tier1Leads.length > 0
        ? 'Verified lead contact info, customized positioning-led outreach drafts'
        : 'Verified account pain, buyer authority, budget evidence, and offering fit',
      successMetric: tier1Leads.length > 0
        ? '≥25% reply rate and ≥10% discovery meeting booking rate'
        : 'At least one account qualifies for Tier 1 with documented evidence',
      evidenceConfidence: tier1Leads.length > 0 ? 'high' : 'low',
      dependencies: tier1Leads.length > 0
        ? ['Lead list verified with valid domains', 'Value proposition message finalized']
        : ['Account evidence and qualification gaps documented'],
    },
    {
      id: 'act-imm-2',
      priority: 'IMMEDIATE',
      action: 'Assemble verified product, security, and pilot evidence relevant to this offering.',
      linkedNeedGap: 'Security and vendor procurement hesitation',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Company technical credibility & regulatory context',
      marketingMixDimension: 'physical_evidence',
      suggestedRole: 'Head of Product / Security Lead',
      requiredInputs: 'Verified seller documentation and buyer requests',
      successMetric: 'Buyers can review all claims with supporting evidence',
      evidenceConfidence: 'low',
      dependencies: ['Architecture documentation verified'],
    },
    {
      id: 'act-imm-3',
      priority: 'IMMEDIATE',
      action: 'Conduct structured discovery interviews with 5 accounts to validate friction severity and confirm willingness-to-pay ceiling.',
      linkedNeedGap: targetSeg.sharedProblem,
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Customer budget constraints & motivation to change',
      marketingMixDimension: 'price',
      suggestedRole: 'Founder / Product Marketing',
      requiredInputs: 'Van Westendorp price sensitivity interview protocol',
      successMetric: '5 completed interviews with documented cost-of-inaction estimates',
      evidenceConfidence: 'medium',
      dependencies: ['Target accounts agree to discovery call'],
    },
  ];

  const next: RecommendedActionItem[] = [
    {
      id: 'act-nxt-1',
      priority: 'NEXT',
      action: 'Design an evaluation flow with buyer-approved success criteria.',
      linkedNeedGap: 'Delayed time-to-value during pilot evaluations',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Company delivery feasibility & customer engineering bandwidth',
      marketingMixDimension: 'process',
      suggestedRole: 'Solutions Engineer / Tech Lead',
      requiredInputs: 'Feasible pilot plan and success measures',
      successMetric: 'Pilot outcome measured against agreed criteria',
      evidenceConfidence: 'low',
      dependencies: ['Seller confirms evaluation capacity'],
    },
    {
      id: 'act-nxt-2',
      priority: 'NEXT',
      action: 'Deliver sales enablement training on the Challenger sales conversation model and handling competitive Point of Parity objections.',
      linkedNeedGap: 'Status-quo inertia and competitor lock-in',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Competitor differentiation & sales team capability',
      marketingMixDimension: 'people',
      suggestedRole: 'Sales Lead',
      requiredInputs: 'Battlecards on competitive alternatives and table-stakes PoP',
      successMetric: '100% of sales reps certified on discovery objection handling',
      evidenceConfidence: 'medium',
      dependencies: ['Competitive analysis completed'],
    },
  ];

  const later: RecommendedActionItem[] = [
    {
      id: 'act-ltr-1',
      priority: 'LATER',
      action: 'Evaluate partner channels after direct buyer demand is demonstrated.',
      linkedNeedGap: 'Long-term market expansion and channel leverage',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Collaborators & partner ecosystem alignment',
      marketingMixDimension: 'place',
      suggestedRole: 'VP of Business Development',
      requiredInputs: 'Partner commission economics and technical certification program',
      successMetric: 'Partner-sourced opportunities measured against direct acquisition',
      evidenceConfidence: 'low',
      dependencies: ['Direct sales motion validated with closed-won proof'],
    },
    {
      id: 'act-ltr-2',
      priority: 'LATER',
      action: `Prototype an improvement addressing ${targetSeg.sharedProblem} after buyer validation.`,
      linkedNeedGap: 'Eliminating manual remediation overhead',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Company engineering innovation & product defensibility',
      marketingMixDimension: 'product',
      suggestedRole: 'VP of Engineering',
      requiredInputs: 'Verified customer feedback and feasibility review',
      successMetric: 'Prototype tested against a documented buyer need',
      evidenceConfidence: 'medium',
      dependencies: ['Seller confirms product roadmap fit'],
    },
  ];

  const whatToValidateFirst = [
    `Confirm that target buyers experience ${targetSeg.sharedProblem} and prioritize solving it.`,
    'Verify the seller can deliver a pilot within its actual capacity.',
    'Test price and purchasing process with budget owners.',
    'Measure conversion from discovery to sale before scaling outbound.',
  ];

  return { immediate, next, later, whatToValidateFirst };
}

// -----------------------------------------------------------------------------
// 3. COMPLETE EXECUTIVE ICP REPORT COMPOSITION SERVICE
// -----------------------------------------------------------------------------

export function composeExecutiveICPReport(
  seller: SellerProfileContext,
  datasetId: string,
  datasetFilename: string,
  ownerUserId: string,
  totalUploaded: number,
  needGapSummary: DatasetNeedGapSummary,
  fiveC: DetailedFiveCAnalysis,
  stpAnalysis: DatasetSTPAnalysis,
  scoredLeads: LeadICPScore[]
): ExecutiveICPReport {
  const qualifiedStp = qualifiedSegmentAnalysis(stpAnalysis, scoredLeads);
  const targetSeg = qualifiedStp.segments.find(segment => !segment.isInsufficientEvidenceGroup && segment.companyCount > 0) || {
    id: 'segment-01',
    name: 'Primary Candidate Segment',
    sharedProblem: seller.primaryProblemSolved || 'Operational friction',
    desiredOutcome: seller.valueProposition || 'Optimized operational workflow',
    companyCount: scoredLeads.length,
    datasetShare: 100,
  };

  // Compile 7Ps marketing mix for all identified segments
  const marketingMixBySegment: Record<string, Segment7PsMarketingMix> = {};
  for (const seg of qualifiedStp.segments) {
    marketingMixBySegment[seg.id] = generateSegment7PsMix(
      seller,
      seg.id,
      seg.name,
      seg.sharedProblem,
      seg.desiredOutcome,
      seller.primaryBuyer || 'VP of Data & Engineering'
    );
  }

  // Scoring distribution & metrics
  const { tier1: tier1Count, tier2: tier2Count, tier3: tier3Count, disqualified: disqualifiedCount, lowData: insufficientEvidenceCount } = deriveTierCounts(scoredLeads);

  const totalCoverage = scoredLeads.reduce((acc, s) => acc + (s.evidenceCoverage ?? 100), 0);
  const averageEvidenceCoverage = scoredLeads.length > 0 ? Math.round(totalCoverage / scoredLeads.length) : 100;

  const topFitScore = scoredLeads.length > 0 ? Math.max(...scoredLeads.map((s) => s.totalScore)) : 0;
  const totalScoreSum = scoredLeads.reduce((acc, s) => acc + s.totalScore, 0);
  const averageFitScore = scoredLeads.length > 0 ? Number((totalScoreSum / scoredLeads.length).toFixed(1)) : 0;

  const actionPlan = generateIntegratedActionPlan(seller, qualifiedStp, scoredLeads);

  const versionFingerprint = `${datasetId}:${stpAnalysis.versionFingerprint || 'v1'}:${scoredLeads.length}:${new Date().toISOString().slice(0, 10)}`;

  // Governed Hypothesis Classification:
  // An observed win rate >= 20% alone does NOT establish independent statistical validation.
  // We distinguish: observed sales outcomes, customer-backed evidence, provisional hypothesis, and longitudinal validation.
  const leadsWithOutcomesCount = stpAnalysis.segments.reduce((acc, s) => acc + (s.outcomes?.leadsWithKnownOutcomes || 0), 0);
  const totalWonDeals = stpAnalysis.segments.reduce((acc, s) => acc + (s.outcomes?.wonDeals || 0), 0);
  const totalResolvedDeals = stpAnalysis.segments.reduce((acc, s) => acc + ((s.outcomes?.wonDeals || 0) + (s.outcomes?.lostDeals || 0)), 0);
  const aggregateWinRate = totalResolvedDeals > 0 ? Math.round((totalWonDeals / totalResolvedDeals) * 100) : null;
  const hasCustomerOutcomes = leadsWithOutcomesCount > 0 && totalResolvedDeals > 0;

  // By scientific standard, an ICP dossier remains an ICP Hypothesis until multi-cohort longitudinal study satisfies statistical power.
  const isProvisionalHypothesis = true;
  const governanceClassification = hasCustomerOutcomes
    ? `CUSTOMER-BACKED ICP HYPOTHESIS (Observed Win Rate: ${aggregateWinRate ?? 0}%)`
    : 'PROVISIONAL ICP HYPOTHESIS';

  return {
    id: `report-${datasetId}`,
    datasetId,
    datasetFilename,
    ownerUserId,
    sellerOfferingId: seller.id || 'seller-offering-01',
    sellerCompanyName: seller.companyName || 'Seller Organization',
    sellerProductName: seller.productName || 'Core Offering',
    title: `Ideal Customer Profile Strategic Intelligence Report // ${datasetFilename}`,
    generatedAt: new Date().toISOString(),
    analysisVersion: CURRENT_REPORT_MODEL_VERSION,
    versionFingerprint,
    isProvisionalHypothesis,
    governanceClassification,

    summaryMetrics: {
      totalUploaded,
      totalAnalyzed: scoredLeads.length,
      tier1Count,
      tier2Count,
      tier3Count,
      disqualifiedCount,
      insufficientEvidenceCount,
      averageEvidenceCoverage,
      dataQualityStatus: averageEvidenceCoverage >= 80 ? 'OPTIMAL' : averageEvidenceCoverage >= 65 ? 'ACCEPTABLE' : 'NEEDS_VERIFICATION',
    },

    executiveThesis: {
      problemAddressed: seller.primaryProblemSolved || 'Buyer problem requires validation.',
      targetCohort: `${targetSeg.name} (${targetSeg.companyCount} accounts, ${targetSeg.datasetShare}% of cohort).`,
      recommendedSegmentName: targetSeg.name,
      relevanceRationale: tier1Count > 0
        ? `The offering may address the need pattern in ${targetSeg.name}; confirm capability overlap and buyer economics in discovery before treating fit as validated.`
        : `${targetSeg.name} is a candidate cohort, but the current account evidence does not establish high fit or economic feasibility.`,
      missingInformation: [
        'Multi-cohort longitudinal deal conversion data and statistical power verification',
        'Direct customer willingness-to-pay and unit-economics cost-to-serve metrics',
        'Documented competitor pricing proposals and contract terms',
      ],
      recommendationSummary: tier1Count === 0
        ? `No Tier 1 accounts qualify in this dataset. Gather stronger account and buyer evidence before launching an outbound sprint; the segment remains an ICP Hypothesis.`
        : hasCustomerOutcomes
          ? `Run a measured Tier 1 outbound test supported by observed sales outcomes (win rate: ${aggregateWinRate}% across ${totalResolvedDeals} resolved deals). Maintain hypothesis tracking until longitudinal validation across multiple cohorts is achieved.`
          : `Run a measured Tier 1 outbound test with the qualifying accounts, while treating segment conclusions as a Provisional ICP Hypothesis until customer-backed deal validation is recorded.`,
    },

    needGapSummary,
    fiveCAnalysis: fiveC,
    stpAnalysis: qualifiedStp,

    scoringSummary: {
      topFitScore,
      averageFitScore,
      highFitCount: tier1Count,
      scoreDistribution: {
        tier1: tier1Count,
        tier2: tier2Count,
        tier3: tier3Count,
        tier4Disqualified: disqualifiedCount,
        insufficientEvidence: insufficientEvidenceCount,
      },
    },

    scoredLeads,
    marketingMixBySegment,
    actionPlan,

    evidenceLimitations: {
      evidenceCoveragePercent: averageEvidenceCoverage,
      unknownAttributes: [
        'Buying intent is strictly marked UNKNOWN unless explicit CRM pipeline or won deals exist.',
        'Gross margins, CAC, and LTV remain unverified without accounting unit-economics records.',
        'Market size is evaluated strictly on the ingested sample; sample proportions are not confused with Total Addressable Market (TAM).',
      ],
      statutoryNotice: 'STATUTORY GOVERNANCE: Per FiguredIt standards, all recommendations represent an ICP Hypothesis until closed-won deal data establishes statistical validation.',
      brandEquityNotice: 'BRAND EQUITY MEASUREMENT: NOT AVAILABLE (Requires longitudinal consumer/market survey instrumentation).',
    },
  };
}

// -----------------------------------------------------------------------------
// 4. PERSISTENCE REPOSITORIES
// -----------------------------------------------------------------------------

export function createSupabaseReportRepository(client: SupabaseClient): ReportRepository {
  return {
    async assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void> {
      const { data, error } = await client
        .from('datasets')
        .select('id')
        .eq('id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to verify dataset ownership: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Dataset ${datasetId} not found or not owned by user.`);
      }
    },

    async getReport(ownerUserId: string, datasetId: string): Promise<ExecutiveICPReport | null> {
      const { data, error } = await client
        .from('icp_reports')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('dataset_id', datasetId)
        .maybeSingle();

      if (error || !data) return null;
      return data.report_json as unknown as ExecutiveICPReport;
    },

    async saveReport(ownerUserId: string, datasetId: string, report: ExecutiveICPReport): Promise<void> {
      const { error } = await client.from('icp_reports').upsert(
        {
          owner_user_id: ownerUserId,
          dataset_id: datasetId,
          seller_offering_id: report.sellerOfferingId,
          version_fingerprint: report.versionFingerprint,
          report_json: report as unknown as Record<string, unknown>,
          evidence_level: report.summaryMetrics.averageEvidenceCoverage >= 70 ? 'high' : 'moderate',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_user_id,dataset_id' }
      );

      if (error) {
        throw new Error(`Failed to persist executive report: ${error.message}`);
      }
    },
  };
}

export class InMemoryReportRepository implements ReportRepository {
  private reports = new Map<string, ExecutiveICPReport>();
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

  async getReport(ownerUserId: string, datasetId: string): Promise<ExecutiveICPReport | null> {
    return this.reports.get(`${ownerUserId}:${datasetId}`) || null;
  }

  async saveReport(ownerUserId: string, datasetId: string, report: ExecutiveICPReport): Promise<void> {
    this.reports.set(`${ownerUserId}:${datasetId}`, report);
  }
}
