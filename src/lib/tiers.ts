import type { LeadICPScore } from '../types/scoring';
import type { DatasetSTPAnalysis } from '../types/analysis';
import { shortProblemLabel } from './offeringGrounding';

export type TierBucket = 'tier1' | 'tier2' | 'tier3' | 'disqualified';

export function scoreTier(score: LeadICPScore): TierBucket {
  if (score.isDisqualified || score.tier === 'Tier 4: Disqualified') return 'disqualified';
  if (score.tier === 'Tier 1: High Conviction') return 'tier1';
  if (score.tier === 'Tier 2: Moderate Fit') return 'tier2';
  return 'tier3';
}

export function deriveTierCounts(scores: LeadICPScore[]) {
  const counts = { tier1: 0, tier2: 0, tier3: 0, disqualified: 0, lowData: 0 };
  for (const score of scores) {
    counts[scoreTier(score)] += 1;
    if (score.isInsufficientEvidence || (score.evidenceCoverage !== undefined && score.evidenceCoverage < 70)) counts.lowData += 1;
  }
  return counts;
}

export function qualifiedSegmentIds(ids: string[], scores: LeadICPScore[]): string[] {
  const byId = new Map(scores.map(score => [score.leadId, score]));
  return ids.filter(id => {
    const score = byId.get(id);
    return score ? scoreTier(score) !== 'disqualified' : true;
  });
}

export function qualifiedSegmentAnalysis(analysis: DatasetSTPAnalysis, scores: LeadICPScore[]): DatasetSTPAnalysis {
  const segments = analysis.segments.map(segment => {
    const primaryCompanyIds = qualifiedSegmentIds(segment.primaryCompanyIds, scores);
    const matchingCompanyIds = qualifiedSegmentIds(segment.matchingCompanyIds, scores);
    return {
      ...segment,
      name: shortProblemLabel(segment.name),
      primaryCompanyIds,
      matchingCompanyIds,
      companyCount: primaryCompanyIds.length,
      totalMatchingCount: matchingCompanyIds.length,
      datasetShare: analysis.totalAnalyzed ? Math.round(primaryCompanyIds.length / analysis.totalAnalyzed * 100) : 0,
      ratioFormatted: `${primaryCompanyIds.length}/${analysis.totalAnalyzed}`,
    };
  });
  const memberships = Object.fromEntries(Object.entries(analysis.memberships).filter(([id]) => qualifiedSegmentIds([id], scores).length > 0));
  return { ...analysis, segments, memberships };
}
