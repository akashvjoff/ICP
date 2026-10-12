export interface ScoringWeights {
  needUrgencyWeight: number; // e.g. 0.35
  capabilityMatchWeight: number; // e.g. 0.25
  stakeholderFeasibilityWeight: number; // e.g. 0.20
  firmographicAlignmentWeight: number; // e.g. 0.20
}

export type ICPTier = 
  | 'Tier 1: High Conviction'
  | 'Tier 2: Moderate Fit'
  | 'Tier 3: Niche / Edge'
  | 'Tier 4: Disqualified';

export interface ScoreItemBreakdown {
  criterion: string;
  weightPct: number;
  maxPoints: number;
  awardedPoints: number;
  auditRationale: string;
}

export interface LeadICPScore {
  leadId: string;
  companyName: string;
  domain: string | null;
  totalScore: number; // 0 to 100
  tier: ICPTier;
  confidence: number; // 0 to 1
  isHypothesisOnly: boolean; // true if no CRM conversion outcome data exists
  breakdown: ScoreItemBreakdown[];
  primaryStrengths: string[];
  primaryDisqualifiers: string[];
  recommendedAction: 'Immediate Outreach' | 'Nurture Campaign' | 'Further Discovery' | 'Archive / Ignore';
  scoredAt: string;
}
