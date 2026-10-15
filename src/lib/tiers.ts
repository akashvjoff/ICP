import type { LeadICPScore } from '../types/scoring';
import type { DatasetSTPAnalysis } from '../types/analysis';
import { shortProblemLabel } from './offeringGrounding';

export type TierBucket = 'tier1' | 'tier2' | 'tier3' | 'disqualified';
export type TierLead = { id: string; analysisStatus?: string; analysis_status?: string };

export function scoreTier(score: LeadICPScore): TierBucket {
  if (score.isDisqualified || score.tier === 'Tier 4: Disqualified') return 'disqualified';
  if (score.tier === 'Tier 1: High Conviction') return 'tier1';
  if (score.tier === 'Tier 2: Moderate Fit') return 'tier2';
  return 'tier3';
}

export function analyzedScores(scores: LeadICPScore[], leads?: TierLead[] | number): LeadICPScore[] {
  if (!leads || typeof leads === 'number') return scores;
  const completed = new Set(leads.filter(lead => (lead.analysisStatus ?? lead.analysis_status) === 'completed').map(lead => lead.id));
  return scores.filter(score => completed.has(score.leadId));
}

export function deriveTierCounts(scores: LeadICPScore[], leads?: TierLead[] | number) {
  const counts = { analyzed: 0, tier1: 0, tier2: 0, tier3: 0, disqualified: 0, lowData: 0, pending: 0 };
  const eligible = analyzedScores(scores, leads);
  counts.analyzed = eligible.length;
  counts.pending = Math.max(0, (typeof leads === 'number' ? leads : leads?.length ?? eligible.length) - eligible.length);
  for (const score of eligible) {
    counts[scoreTier(score)] += 1;
    if (score.isInsufficientEvidence || (score.evidenceCoverage !== undefined && score.evidenceCoverage < 70)) counts.lowData += 1;
  }
  return counts;
}

export function qualifiedSegmentIds(ids: string[], scores: LeadICPScore[]): string[] {
  const byId = new Map(scores.map(score => [score.leadId, score]));
  return ids.filter(id => {
    const score = byId.get(id);
    return Boolean(score && scoreTier(score) !== 'disqualified');
  });
}

export function qualifiedSegmentAnalysis(analysis: DatasetSTPAnalysis, scores: LeadICPScore[], leads?: TierLead[]): DatasetSTPAnalysis {
  const eligible = analyzedScores(scores, leads);
  const analyzed = deriveTierCounts(scores, leads).analyzed;
  const segments = analysis.segments.map(segment => {
    const primaryCompanyIds = qualifiedSegmentIds(segment.primaryCompanyIds, eligible);
    const matchingCompanyIds = qualifiedSegmentIds(segment.matchingCompanyIds, eligible);
    return {
      ...segment,
      name: shortProblemLabel(segment.name),
      primaryCompanyIds,
      matchingCompanyIds,
      companyCount: primaryCompanyIds.length,
      totalMatchingCount: matchingCompanyIds.length,
      datasetShare: analyzed ? Math.round(primaryCompanyIds.length / analyzed * 100) : 0,
      ratioFormatted: `${primaryCompanyIds.length}/${analyzed}`,
    };
  });
  const memberships = Object.fromEntries(Object.entries(analysis.memberships).filter(([id]) => qualifiedSegmentIds([id], eligible).length > 0));
  return { ...analysis, totalAnalyzed: analyzed, segments, memberships };
}
