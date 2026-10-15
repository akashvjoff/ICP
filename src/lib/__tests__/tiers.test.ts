import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTierCounts, qualifiedSegmentAnalysis, qualifiedSegmentIds, scoreTier } from '../tiers';
import type { LeadICPScore } from '../../types/scoring';
import type { DatasetSTPAnalysis } from '../../types/analysis';

const scores = [
  { leadId: 'finova', tier: 'Tier 1: High Conviction', isDisqualified: false, evidenceCoverage: 90 },
  { leadId: 'beacon', tier: 'Tier 4: Disqualified', isDisqualified: false, evidenceCoverage: 80 },
  { leadId: 'sparse', tier: 'Tier 3: Niche / Edge', isInsufficientEvidence: true, evidenceCoverage: 45 },
] as LeadICPScore[];

test('tier counts classify Tier 4 as disqualified even when the legacy flag is false', () => {
  assert.equal(scoreTier(scores[1]), 'disqualified');
  assert.deepEqual(deriveTierCounts(scores), { analyzed: 3, tier1: 1, tier2: 0, tier3: 1, disqualified: 1, lowData: 1, pending: 0 });
});

test('only completed scored companies count as analyzed', () => {
  const leads = Array.from({ length: 53 }, (_, index) => ({
    id: `company-${index}`,
    analysisStatus: index < 20 ? 'completed' : 'pending',
  }));
  const allScores = leads.map(lead => ({ ...scores[0], leadId: lead.id }));
  assert.deepEqual(deriveTierCounts(allScores, leads), {
    analyzed: 20, tier1: 20, tier2: 0, tier3: 0, disqualified: 0, lowData: 0, pending: 33,
  });
  assert.deepEqual(qualifiedSegmentIds(['finova', 'missing', 'beacon'], scores), ['finova']);
});

test('disqualified accounts are removed from segment support and primary membership', () => {
  const analysis = {
    totalAnalyzed: 3,
    segments: [{ id: 'priority', name: 'Data quality Cohort', primaryCompanyIds: ['finova', 'beacon'], matchingCompanyIds: ['finova', 'beacon', 'sparse'], companyCount: 2, totalMatchingCount: 3 }],
    memberships: { finova: { leadId: 'finova' }, beacon: { leadId: 'beacon' }, sparse: { leadId: 'sparse' } },
  } as unknown as DatasetSTPAnalysis;
  const qualified = qualifiedSegmentAnalysis(analysis, scores);
  assert.deepEqual(qualifiedSegmentIds(['finova', 'beacon'], scores), ['finova']);
  assert.deepEqual(qualified.segments[0].primaryCompanyIds, ['finova']);
  assert.deepEqual(qualified.segments[0].matchingCompanyIds, ['finova', 'sparse']);
  assert.equal(qualified.segments[0].companyCount, 1);
  assert.equal(qualified.segments[0].name, 'Data quality');
  assert.equal(qualified.memberships.beacon, undefined);
});
