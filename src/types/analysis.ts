import type { LeadICPScore } from './scoring';

export type NeedGapMagnitude = 'Acute' | 'Moderate' | 'Latent' | 'Negligible';

export interface NeedGapAnalysisItem {
  leadId: string;
  analysisStatus?: 'completed' | 'hypothesis' | 'insufficient_evidence';
  companyName: string;
  identifiedNeed: string;
  gapMagnitude: NeedGapMagnitude;
  urgencyDriver: string;
  offeringCapabilityMatch: string;
  consequenceOfInaction: string;
  gapScore: number; // 0 to 100
}

export type EvidenceOrigin = 'verified' | 'user_provided' | 'inferred' | 'unknown';

export interface NeedGapEvidenceItem {
  attribute: string;
  summary: string;
  origin: EvidenceOrigin;
  sourceField?: string;
}

export type MotivationalConflict =
  | 'Approach-Approach'
  | 'Approach-Avoidance'
  | 'Avoidance-Avoidance'
  | null;

export interface NeedGapAnalysis {
  leadId: string;
  companyName?: string;
  sellerOfferingId: string;
  currentState: string;
  idealState: string;
  needGap: string;
  relevantProblem: string;
  problemIntensity: 'Acute' | 'Moderate' | 'Low' | 'Negligible';
  motivationToChange: string;
  involvement: 'High' | 'Medium' | 'Low' | 'Unknown';
  outcomeAttractiveness: 'High' | 'Medium' | 'Low' | 'Unknown';
  perceivedBenefits: string[];
  perceivedCosts: string[];
  approachMotivation: string | null;
  avoidanceMotivation: string | null;
  motivationalConflict: MotivationalConflict;
  relevantProductBenefits: string[];
  suggestedBuyerRoles: string[];
  evidence: NeedGapEvidenceItem[];
  unknowns: string[];
  confidence: 'high' | 'medium' | 'low';
  analysisStatus: 'completed' | 'hypothesis' | 'insufficient_evidence';
  analyzedAt: string;
}

export interface NeedGapPattern {
  id: string;
  problemTitle: string;
  description: string;
  supportingLeadIds: string[];
  supportingCount: number;
  totalCount: number;
  percentage: number; // e.g. 40 for 8/20
  ratioFormatted: string; // e.g. "8/20"
  intensityDistribution: {
    acute: number;
    moderate: number;
    low: number;
    negligible: number;
  };
  relevantSellerCapabilities: string[];
  evidenceLevel: 'verified' | 'hypothesis' | 'unknown';
}

export interface DatasetNeedGapSummary {
  datasetId: string;
  totalLeads: number;
  analyzedLeadsCount: number;
  insufficientEvidenceCount: number;
  insufficientEvidenceLeadIds: string[];
  topNeedPatterns: NeedGapPattern[];
  commonHypothesizedProblems: string[];
  matchingSellerBenefits: Array<{
    sellerBenefit: string;
    matchedNeedCount: number;
    leadIds: string[];
  }>;
  missingInformationSummary: string[];
  generatedAt: string;
}

export interface DetailedFiveCDimension {
  title: string;
  targetEntity: 'seller' | 'lead_cohort' | 'market_alternatives' | 'ecosystem' | 'macro_environment';
  mainObservations: string[];
  evidence: Array<{
    fact: string;
    origin: EvidenceOrigin;
    source?: string;
  }>;
  potentialOpportunity: string;
  potentialRisk: string;
  missingInformation: string[];
  confidence: 'high' | 'medium' | 'low';
  strategicImplications: string;
  researchRequired: boolean;
}

export interface DetailedFiveCAnalysis {
  company: DetailedFiveCDimension;
  customers: DetailedFiveCDimension;
  competitors: DetailedFiveCDimension;
  collaborators: DetailedFiveCDimension;
  context: DetailedFiveCDimension;
  analyzedAt: string;
}

export interface DatasetStrategicAnalysis {
  id?: string;
  datasetId: string;
  ownerUserId: string;
  sellerOfferingId: string;
  needGapSummary: DatasetNeedGapSummary;
  fiveC: DetailedFiveCAnalysis;
  companyNeedGaps: Record<string, NeedGapAnalysis>;
  createdAt: string;
  updatedAt: string;
}

export interface FiveCAnalysis {
  company: {
    internalCapabilities: string;
    resourceReadiness: string;
    strategicPriority: string;
  };
  customers: {
    economicBuyer: string;
    championPersona: string;
    primaryObstacle: string;
    decisionCycleEstimate: string;
  };
  competitors: {
    currentAlternative: string;
    switchingFriction: 'Low' | 'Medium' | 'High' | string;
    differentiationAdvantage: string;
  };
  collaborators: {
    systemIntegrators: string;
    ecosystemPartners: string;
  };
  context: {
    regulatoryFactors: string;
    economicClimate: string;
    technologicalShifts: string;
  };
}

export interface STPCluster {
  id: string;
  segmentName: string;
  problemDefinition: string;
  leadCount: number;
  averageNeedScore: number;
  targetAttractiveness: 'Tier 1 Priority' | 'Tier 2 Secondary' | 'Tier 3 Opportunistic' | 'Avoid';
  recommendedPositioningAngle: string;
  valueNarrative: string;
  matchedLeadIds: string[];
}

export interface MarketingMixResonance {
  productResonance: string;
  priceAcceptability: string;
  placeChannelFit: string;
  promotionHook: string;
}

export interface FullStrategicAnalysis {
  offeringId: string;
  analyzedAt: string;
  needGaps: NeedGapAnalysisItem[];
  fiveC: FiveCAnalysis;
  stpSegments: STPCluster[];
  marketingMix: MarketingMixResonance;
  cohortHypothesisSummary: string;
  detailedNeedGapSummary?: DatasetNeedGapSummary;
  detailedFiveC?: DetailedFiveCAnalysis;
}

// -----------------------------------------------------------------------------
// PROMPT 11: SEGMENTATION, TARGETING & POSITIONING (STP) DATA CONTRACTS
// -----------------------------------------------------------------------------

export interface SegmentMembership {
  leadId: string;
  companyName: string;
  primarySegmentId: string;
  secondaryPatternIds: string[];
  isInsufficientEvidence: boolean;
  confidence: 'high' | 'medium' | 'low';
  evidenceOrigin: EvidenceOrigin;
}

export interface SegmentOutcomeSummary {
  totalLeads: number;
  leadsWithKnownOutcomes: number;
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  observedWinRate: number | null; // e.g. 75 (%) or null if no resolved deals
  winRateFormatted: string; // e.g. "3/4 (75%)" or "Outcome data unavailable"
  totalWonDealValue: number | null;
  averageWonDealValue: number | null;
  medianWonDealValue: number | null;
  averageRetentionMonths: number | null;
  reasonsWon: string[];
  reasonsLost: string[];
  dataClassification: 'CUSTOMER-BACKED SEGMENT ANALYSIS' | 'EARLY OUTCOME SIGNALS' | 'ICP HYPOTHESIS — OUTCOME DATA UNAVAILABLE';
  warnings: string[];
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  sharedProblem: string;
  desiredOutcome: string;
  commonProductBenefits: string[];
  matchingCompanyIds: string[]; // All matching companies (primary or secondary)
  primaryCompanyIds: string[]; // Primary members only
  companyCount: number; // Primary count for exclusive segment distribution
  totalMatchingCount: number;
  datasetShare: number; // e.g. 40 (%)
  ratioFormatted: string; // e.g. "8/20"
  commonIndustries: string[];
  typicalCompanySizes: string[];
  relevantBusinessModels: string[];
  buyingRoleHypotheses: string[];
  relevantSellerFeatures: string[];
  evidenceStrength: 'high' | 'moderate' | 'low' | 'exploratory';
  missingInformation: string[];
  confidence: 'high' | 'medium' | 'low';
  outcomes: SegmentOutcomeSummary;
  isInsufficientEvidenceGroup?: boolean;
}

export interface SegmentTargetingAssessment {
  segmentId: string;
  segmentName: string;
  salesPotential: {
    score: number; // 0-100
    label: 'High' | 'Moderate' | 'Provisional' | 'Unknown';
    rationale: string;
    isProvisional: boolean;
  };
  profitPotential: {
    score: number | null; // null if insufficient cost data
    label: 'High' | 'Moderate' | 'Low' | 'PROFIT POTENTIAL — INSUFFICIENT DATA';
    rationale: string;
    hasSufficientCostData: boolean;
  };
  uniqueCustomerNeeds: {
    score: number; // 0-100
    label: 'High' | 'Moderate' | 'Low';
    rationale: string;
    unmetFriction: string;
  };
  feasibilityAndContextMatch: {
    score: number;
    label: 'Strong' | 'Moderate' | 'Constrained';
    rationale: string;
  };
  coverageConfidence: 'high' | 'medium' | 'low';
  attractivenessScore: number; // 0-100
  recommendationTier: 'Recommended Target' | 'Provisional Shortlist' | 'Secondary Priority' | 'Monitor / Opportunistic' | 'Avoid';
  recommendationRationale: string;
  isConfidentWinner: boolean;
}

export interface SegmentPositioning {
  segmentId: string;
  segmentName: string;
  targetCustomer: string;
  need: string;
  categoryPointOfParity: string;
  competitivePointOfParity: string | null; // null if competitors unknown
  pointOfDifference: string;
  reasonsToBelieve: string[];
  positioningStatement: string;
  proposedMarketingHooks: string[];
  missingEvidence: string[];
  isTestedClaim: boolean; // Always false (labeled as hypothesis until tested)
  qualityControl: {
    relevance: boolean;
    differentiation: boolean;
    credibility: boolean;
    capabilityFit: boolean;
    clarity: boolean;
  };
}

export interface DatasetSTPAnalysis {
  id?: string;
  datasetId: string;
  ownerUserId: string;
  sellerOfferingId: string;
  totalAnalyzed: number;
  candidateSegmentsCount: number;
  insufficientEvidenceCount: number;
  insufficientEvidenceCompanyIds: string[];
  segments: CustomerSegment[];
  memberships: Record<string, SegmentMembership>;
  targetingAssessments: Record<string, SegmentTargetingAssessment>;
  positioningRecommendations: Record<string, SegmentPositioning>;
  overallTargetingRecommendation: {
    recommendedSegmentId: string | null;
    summary: string;
    isProvisional: boolean;
  };
  generatedAt: string;
  versionFingerprint: string;
}

// -----------------------------------------------------------------------------
// PROMPT 13: 7Ps MARKETING MIX & EXECUTIVE REPORT DATA CONTRACTS
// -----------------------------------------------------------------------------

export type MarketingMixDimension =
  | 'product'
  | 'price'
  | 'place'
  | 'promotion'
  | 'people'
  | 'process'
  | 'physical_evidence';

export interface FeatureAdvantageBenefit {
  feature: string;
  advantage: string;
  customerBenefit: string;
  isExisting: boolean; // true if supported by seller context, false if proposed
}

export interface ProductMixAnalysis {
  coreBenefit: string;
  expectedProduct: string[];
  augmentedProduct: string[];
  potentialProduct: string[];
  fabMapping: FeatureAdvantageBenefit[];
  pointOfParity: string;
  pointOfDifference: string;
  productGaps: string[];
  productPriorities: string[];
  proposedFeatureImprovements: string[];
}

export interface PriceMixAnalysis {
  pricingApproach:
    | 'Value-Based Pricing'
    | 'Perceived-Value Pricing'
    | 'Target Costing'
    | 'Two-Part Pricing'
    | 'Penetration Pricing'
    | 'Provisional Value Assessment';
  rationale: string;
  monetaryCosts: string;
  switchingCosts: string;
  implementationCosts: string;
  costToServe: string;
  observedSellerPricing: string | null;
  isPricePointKnown: boolean;
  recommendedPricePoint: string;
  recommendedPricingResearch: string[];
}

export interface PlaceMixAnalysis {
  distributionModel:
    | 'Direct Sales'
    | 'Inside Sales'
    | 'Product-Led (Self-Service)'
    | 'Channel Partner'
    | 'Hybrid Direct & Partner';
  rationale: string;
  customerTouchpoints: string[];
  implementationRequirements: string[];
  channelRisks: string[];
  missingEvidence: string[];
}

export interface PromotionMixSampleDrafts {
  headline: string;
  outreachAngle: string;
  discoveryQuestion: string;
  educationalContentAngle: string;
  callToAction: string;
}

export interface PromotionMixAnalysis {
  decisionJourney: {
    needRecognition: string;
    searchForAlternatives: string;
    evaluationOfOptions: string;
    purchaseAdoption: string;
    postPurchaseEvaluation: string;
  };
  needAwarenessMessage: string;
  valuePropositionMessage: string;
  proofMessage: string;
  recommendedChannels: {
    ownedMedia: string[];
    earnedMedia: string[];
    paidMedia: string[];
    outboundDirect: string[];
    referralPartnerships: string[];
  };
  sampleDrafts: PromotionMixSampleDrafts;
}

export interface PeopleMixAnalysis {
  buyerFacingExpertise: string[];
  salesConversationSkills: string[];
  buyingCommitteeEngagement: {
    economicBuyerRole: string;
    championRole: string;
    technicalEvaluatorRole: string;
  };
  onboardingSupportModel: string;
  trainingRequirements: string[];
  customerServiceTouchpoints: string[];
}

export interface ProcessJourneyStage {
  stage: string;
  customerAction: string;
  sellerDelivery: string;
  frictionPoints: string[];
  valueCreationMechanism: string;
  metricsToMonitor: string[];
  requiresHumanVerification: boolean;
}

export interface ProcessMixAnalysis {
  currentVsRecommended: {
    currentStateAssumption: string;
    recommendedStandardizedProcess: string;
  };
  journeyStages: ProcessJourneyStage[];
  serviceStandardizationRules: string[];
}

export interface PhysicalEvidenceMixAnalysis {
  existingProofAssets: string[];
  proofAssetsRequired: string[];
  recommendedTrustSignals: string[];
  documentationChecklist: string[];
}

export interface Segment7PsMarketingMix {
  segmentId: string;
  segmentName: string;
  product: ProductMixAnalysis;
  price: PriceMixAnalysis;
  place: PlaceMixAnalysis;
  promotion: PromotionMixAnalysis;
  people: PeopleMixAnalysis;
  process: ProcessMixAnalysis;
  physicalEvidence: PhysicalEvidenceMixAnalysis;
  generatedAt: string;
}

export interface RecommendedActionItem {
  id: string;
  priority: 'IMMEDIATE' | 'NEXT' | 'LATER';
  action: string;
  linkedNeedGap: string;
  linkedSegmentId: string;
  linkedSegmentName: string;
  fiveCConsideration: string;
  marketingMixDimension: MarketingMixDimension;
  suggestedRole: string;
  requiredInputs: string;
  successMetric: string;
  evidenceConfidence: 'high' | 'medium' | 'low';
  dependencies: string[];
}

export interface ExecutiveICPReport {
  id: string;
  datasetId: string;
  datasetFilename: string;
  ownerUserId: string;
  sellerOfferingId: string;
  sellerCompanyName: string;
  sellerProductName: string;
  title: string;
  generatedAt: string;
  analysisVersion: string;
  versionFingerprint: string;
  isProvisionalHypothesis: boolean;
  governanceClassification: 'PROVISIONAL ICP HYPOTHESIS' | 'VALIDATED ICP DOSSIER' | string;

  summaryMetrics: {
    totalUploaded: number;
    totalAnalyzed: number;
    pendingCount?: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    disqualifiedCount: number;
    insufficientEvidenceCount: number;
    averageEvidenceCoverage: number;
    dataQualityStatus: 'OPTIMAL' | 'ACCEPTABLE' | 'NEEDS_VERIFICATION';
  };

  executiveThesis: {
    problemAddressed: string;
    targetCohort: string;
    recommendedSegmentName: string;
    relevanceRationale: string;
    missingInformation: string[];
    recommendationSummary: string;
  };

  needGapSummary: DatasetNeedGapSummary;
  fiveCAnalysis: DetailedFiveCAnalysis;
  stpAnalysis: DatasetSTPAnalysis;

  scoringSummary: {
    topFitScore: number;
    averageFitScore: number;
    highFitCount: number;
    scoreDistribution: {
      tier1: number;
      tier2: number;
      tier3: number;
      tier4Disqualified: number;
      insufficientEvidence: number;
    };
  };

  scoredLeads: LeadICPScore[];
  marketingMixBySegment: Record<string, Segment7PsMarketingMix>;

  actionPlan: {
    immediate: RecommendedActionItem[];
    next: RecommendedActionItem[];
    later: RecommendedActionItem[];
    whatToValidateFirst: string[];
  };

  evidenceLimitations: {
    evidenceCoveragePercent: number;
    unknownAttributes: string[];
    statutoryNotice: string;
    brandEquityNotice: string;
  };
}
