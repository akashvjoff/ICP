export type NeedGapMagnitude = 'Acute' | 'Moderate' | 'Latent' | 'Negligible';

export interface NeedGapAnalysisItem {
  leadId: string;
  companyName: string;
  identifiedNeed: string;
  gapMagnitude: NeedGapMagnitude;
  urgencyDriver: string;
  offeringCapabilityMatch: string;
  consequenceOfInaction: string;
  gapScore: number; // 0 to 100
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
}
