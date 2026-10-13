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

export type EvidenceOrigin =
  | 'USER_PROVIDED'
  | 'PUBLIC_WEBSITE'
  | 'VERIFIED_OUTCOME'
  | 'AI_INFERRED'
  | 'UNKNOWN';

export interface ScoreItemBreakdown {
  criterion: string;
  weightPct: number;
  maxPoints: number;
  awardedPoints: number;
  auditRationale: string;
  // Prompt 12 additions:
  rating?: number | 'UNKNOWN';
  supportingEvidence?: string;
  evidenceOrigin?: EvidenceOrigin;
  confidence?: 'high' | 'medium' | 'low' | 'unknown';
  weightedContribution?: number | null;
  missingInformation?: string | null;
}

export interface DisqualificationDetails {
  isDisqualified: boolean;
  reason: string;
  supportingEvidence: string;
  relevantSellerConstraint: string;
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

  // Prompt 12 additions:
  evidenceCoverage?: number; // 0 to 100%
  isInsufficientEvidence?: boolean; // true if coverage < 70%
  intentScore?: number | null; // null if unknown
  intentLabel?: string; // e.g. 'BUYING INTENT: UNKNOWN'
  isDisqualified?: boolean;
  disqualificationReason?: string | null;
  disqualificationEvidence?: string | null;
  disqualificationConstraint?: string | null;
  missingFields?: string[];
  modelVersion?: string;
  sourceFingerprint?: string;
  segmentId?: string | null;
  segmentName?: string | null;
}
