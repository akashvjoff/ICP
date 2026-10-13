import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDatasetSTPAnalysis,
  analyzeSegmentOutcomes,
  evaluateSegmentTargeting,
  generateSegmentPositioning,
  InMemorySTPRepository,
} from '../stpService';
import {
  analyzeLeadNeedGap,
  aggregateDatasetNeedGaps,
  synthesizeDetailedFiveC,
  type SellerProfileContext,
} from '../strategicAnalysisService';
import { calculateDeterministicICPScore, DEFAULT_SCORING_WEIGHTS } from '../../lib/scoring';
import type { LeadForAnalysis } from '../analysisJobService';
import type { NormalizedLead } from '../../types/lead';
import type { OfferingProfile } from '../../types/offering';

const TEST_SELLER: SellerProfileContext = {
  id: 'seller-stp-01',
  companyName: 'Synthetix GTM Engine',
  website: 'https://synthetix.io',
  productName: 'Pipeline Radar',
  productDescription: 'Autonomous outbound prospecting platform that detects buying signals and drafts targeted campaigns.',
  category: 'B2B Sales Intelligence',
  valueProposition: 'Reduces manual outbound prospecting time by 80% with verified buying signals.',
  primaryProblemSolved: 'Manual outbound prospecting and fragmented researcher overhead',
  keyCapabilities: [
    'Automated outbound prospecting',
    'Real-time firmographic enrichment',
    'High-intent account scoring',
  ],
  typicalACV: '$24,000 / year',
  pricingModel: 'Annual subscription',
  mainAlternatives: 'Manual spreadsheets and legacy static databases',
  pointOfParity: 'SOC2 Type II compliance, CRM webhook sync',
  pointOfDifference: 'Continuous buying-intent radar with zero manual list building',
  primaryBuyer: 'VP of Sales',
  mainCustomerProblem: 'Sales teams spend 15+ hours weekly manually prospecting.',
};

const SELLER_WITHOUT_COMPETITORS: SellerProfileContext = {
  ...TEST_SELLER,
  mainAlternatives: '',
};

function create20LeadSyntheticCohort(): LeadForAnalysis[] {
  const leads: LeadForAnalysis[] = [];

  // 8 companies sharing Need Pattern A: Outbound Prospecting Friction
  for (let i = 1; i <= 8; i++) {
    leads.push({
      id: `lead-outbound-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `Outbound Tech ${i} Inc`,
      normalized_domain: `outboundtech${i}.com`,
      website: `https://outboundtech${i}.com`,
      industry_raw: i % 2 === 0 ? 'Enterprise SaaS' : 'Financial Technology',
      employee_count: 50 + i * 10,
      notes: 'Outbound sales team struggling with manual prospecting and low pipeline generation volume.',
      analysis_eligible: true,
      analysis_status: 'completed',
      raw_row: {
        leadStage: i === 1 ? 'closed-won' : i === 2 ? 'closed-lost' : 'open',
        dealValue: i === 1 ? 24000 : null,
        retentionMonths: i === 1 ? 12 : null,
        reasonWonLost: i === 1 ? 'Fast time to pipeline' : i === 2 ? 'Budget freeze' : null,
      },
    });
  }

  // 5 companies sharing Need Pattern B: CRM Data Decay & Enrichment
  for (let i = 1; i <= 5; i++) {
    leads.push({
      id: `lead-crm-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `CRM Data ${i} Corp`,
      normalized_domain: `crmdata${i}.com`,
      website: `https://crmdata${i}.com`,
      industry_raw: 'Healthcare IT',
      employee_count: 120 + i * 20,
      notes: 'Massive CRM database decay with stale account intelligence and duplicate records needing real-time sync.',
      analysis_eligible: true,
      analysis_status: 'completed',
      raw_row: {
        leadStage: i === 1 ? 'closed-won' : 'open',
        dealValue: i === 1 ? 30000 : null,
      },
    });
  }

  // 7 companies with Insufficient Evidence
  for (let i = 1; i <= 7; i++) {
    leads.push({
      id: `lead-sparse-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `Sparse Unknown ${i} LLC`,
      normalized_domain: null,
      website: null,
      industry_raw: null,
      employee_count: null,
      notes: '',
      analysis_eligible: true,
      analysis_status: 'pending',
      raw_row: {},
    });
  }

  return leads;
}

// -----------------------------------------------------------------------------
// TEST SUITE: 22 SCENARIOS + 20-LEAD SYNTHETIC COHORT
// -----------------------------------------------------------------------------

test('1. Shared-need-based segmentation clusters accounts by operational friction rather than superficial labels', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  assert.ok(stp.segments.length >= 2, 'Should create at least 2 distinct problem-based segments');
  const outboundSeg = stp.segments.find((s) => s.sharedProblem.toLowerCase().includes('outbound'));
  assert.ok(outboundSeg, 'Should identify outbound prospecting friction segment');
  assert.equal(outboundSeg.sharedProblem.toLowerCase().includes('outbound'), true);
});

test('2. Companies in the same industry with different needs are partitioned into different segments', () => {
  const leads: LeadForAnalysis[] = [
    {
      id: 'l1',
      dataset_id: 'd1',
      owner_user_id: 'u1',
      company_name: 'FinTech Alpha',
      industry_raw: 'Financial Technology',
      notes: 'Outbound sales team struggling with manual prospecting and low lead volume.',
      analysis_eligible: true,
      analysis_status: 'completed',
    },
    {
      id: 'l2',
      dataset_id: 'd1',
      owner_user_id: 'u1',
      company_name: 'FinTech Beta',
      industry_raw: 'Financial Technology',
      notes: 'High CRM data decay; 50% of emails bounce.',
      analysis_eligible: true,
      analysis_status: 'completed',
    },
  ];

  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('d1', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'd1', summary, fiveC, leads, gapsMap);

  const mem1 = stp.memberships['l1'];
  const mem2 = stp.memberships['l2'];
  assert.notEqual(mem1.primarySegmentId, mem2.primarySegmentId, 'Companies sharing industry but different needs must be in different segments');
});

test('3. Companies in different industries sharing one need are grouped into the same segment', () => {
  const leads: LeadForAnalysis[] = [
    {
      id: 'l1',
      dataset_id: 'd1',
      owner_user_id: 'u1',
      company_name: 'SaaS Alpha',
      industry_raw: 'Enterprise SaaS',
      notes: 'Manual outbound prospecting is slowing down sales rep productivity.',
      analysis_eligible: true,
      analysis_status: 'completed',
    },
    {
      id: 'l2',
      dataset_id: 'd1',
      owner_user_id: 'u1',
      company_name: 'FinTech Beta',
      industry_raw: 'Financial Services',
      notes: 'Outbound sales team struggling with manual prospecting.',
      analysis_eligible: true,
      analysis_status: 'completed',
    },
  ];

  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('d1', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'd1', summary, fiveC, leads, gapsMap);

  const mem1 = stp.memberships['l1'];
  const mem2 = stp.memberships['l2'];
  assert.equal(mem1.primarySegmentId, mem2.primarySegmentId, 'Companies in different industries sharing the same need must share primary segment');
});

test('4. Deterministic primary segment membership assigns each lead exactly one primary segment', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  for (const lead of leads) {
    const mem = stp.memberships[lead.id];
    assert.ok(mem, `Lead ${lead.id} must have a membership record`);
    assert.ok(mem.primarySegmentId, `Lead ${lead.id} must have a non-empty primarySegmentId`);
  }
});

test('5. Secondary need-pattern associations are tracked as tags without corrupting primary membership', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  const memberships = Object.values(stp.memberships);
  for (const mem of memberships) {
    assert.ok(Array.isArray(mem.secondaryPatternIds), 'Secondary pattern IDs must be an array');
  }
});

test('6. No duplicate company counts: sum of primary segment members + insufficient evidence equals total cohort size', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  const totalSum = stp.segments.reduce((acc, s) => acc + s.companyCount, 0);
  assert.equal(totalSum, 20, 'Sum of primary members across all segments (including quarantine) must equal 20 exactly');
});

test('7. Insufficient evidence handling isolates sparse accounts into a dedicated quarantine group', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  const quarantine = stp.segments.find((s) => s.isInsufficientEvidenceGroup);
  assert.ok(quarantine, 'Quarantine segment must exist');
  assert.equal(quarantine.companyCount, 7, 'Quarantine segment must contain exactly 7 accounts');
  assert.equal(quarantine.datasetShare, 35, 'Quarantine segment must represent exactly 35% of the 20-lead dataset');
});

test('8. Explicit Milestone Requirement: 20-Row Synthetic Dataset (Segment A: 8 (40%), Segment B: 5 (25%), Insufficient: 7 (35%))', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  assert.equal(stp.totalAnalyzed, 20);
  assert.equal(stp.insufficientEvidenceCount, 7);

  const segA = stp.segments.find((s) => s.sharedProblem.toLowerCase().includes('outbound'));
  assert.ok(segA, 'Segment A must exist');
  assert.equal(segA.companyCount, 8, 'Segment A must have exactly 8 primary companies');
  assert.equal(segA.datasetShare, 40, 'Segment A must be 40%');
  assert.equal(segA.ratioFormatted, '8/20');

  const segB = stp.segments.find((s) => s.sharedProblem.toLowerCase().includes('crm'));
  assert.ok(segB, 'Segment B must exist');
  assert.equal(segB.companyCount, 5, 'Segment B must have exactly 5 primary companies');
  assert.equal(segB.datasetShare, 25, 'Segment B must be 25%');
  assert.equal(segB.ratioFormatted, '5/20');

  const quarantine = stp.segments.find((s) => s.isInsufficientEvidenceGroup);
  assert.ok(quarantine, 'Insufficient evidence group must exist');
  assert.equal(quarantine.companyCount, 7);
  assert.equal(quarantine.datasetShare, 35);
  assert.equal(quarantine.ratioFormatted, '7/20');
});

test('9. Observed won/lost outcome analysis correctly calculates deal counts and won values', () => {
  const leads = create20LeadSyntheticCohort();
  const outboundLeads = leads.filter((l) => l.id.startsWith('lead-outbound'));
  const outcomes = analyzeSegmentOutcomes(outboundLeads);

  assert.equal(outcomes.totalLeads, 8);
  assert.equal(outcomes.wonDeals, 1);
  assert.equal(outcomes.lostDeals, 1);
  assert.equal(outcomes.leadsWithKnownOutcomes, 2);
  assert.equal(outcomes.totalWonDealValue, 24000);
  assert.equal(outcomes.averageWonDealValue, 24000);
  assert.equal(outcomes.medianWonDealValue, 24000);
});

test('10. Win rate uses correct resolved-outcomes denominator and returns null when no deals resolved', () => {
  const leads = create20LeadSyntheticCohort();
  const outboundLeads = leads.filter((l) => l.id.startsWith('lead-outbound'));
  const outcomes = analyzeSegmentOutcomes(outboundLeads);

  // 1 won out of 2 resolved = 50%
  assert.equal(outcomes.observedWinRate, 50);
  assert.equal(outcomes.winRateFormatted, '1/2 (50%)');

  // Leads with only open status:
  const openLeads: LeadForAnalysis[] = [
    { id: '1', dataset_id: 'd', owner_user_id: 'u', company_name: 'A', analysis_eligible: true, analysis_status: 'completed', raw_row: { leadStage: 'open' } },
    { id: '2', dataset_id: 'd', owner_user_id: 'u', company_name: 'B', analysis_eligible: true, analysis_status: 'completed', raw_row: { leadStage: 'pipeline' } },
  ];
  const openOutcomes = analyzeSegmentOutcomes(openLeads);
  assert.equal(openOutcomes.observedWinRate, null, 'Win rate must be null when no resolved deals exist');
  assert.equal(openOutcomes.winRateFormatted, 'Outcome data unavailable');
  assert.equal(openOutcomes.dataClassification, 'ICP HYPOTHESIS — OUTCOME DATA UNAVAILABLE');
});

test('11. Missing profitability data explicitly produces PROFIT POTENTIAL — INSUFFICIENT DATA without guessing margins', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  for (const seg of stp.segments) {
    const targeting = stp.targetingAssessments[seg.id];
    assert.equal(targeting.profitPotential.label, 'PROFIT POTENTIAL — INSUFFICIENT DATA');
    assert.equal(targeting.profitPotential.score, null);
    assert.equal(targeting.profitPotential.hasSufficientCostData, false);
  }
});

test('12. Missing competitor information omits competitive Point of Parity without fabricating claims', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(SELLER_WITHOUT_COMPETITORS, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, SELLER_WITHOUT_COMPETITORS);
  const fiveC = synthesizeDetailedFiveC(SELLER_WITHOUT_COMPETITORS, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(SELLER_WITHOUT_COMPETITORS, 'dataset-20', summary, fiveC, leads, gapsMap);

  const validSeg = stp.segments.find((s) => !s.isInsufficientEvidenceGroup)!;
  const positioning = stp.positioningRecommendations[validSeg.id];

  assert.equal(positioning.competitivePointOfParity, null, 'Competitive PoP must be null when competitors unknown');
  assert.equal(positioning.positioningStatement.includes('unlike'), false, 'Positioning statement must omit "unlike" comparison');
});

test('13. Unique-needs evaluation reflects acute problem gravity and capability match', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  const segA = stp.segments.find((s) => s.sharedProblem.toLowerCase().includes('outbound'))!;
  const targeting = stp.targetingAssessments[segA.id];
  assert.ok(targeting.uniqueCustomerNeeds.score >= 75, 'Targeting unique needs score should reflect acute alignment');
  assert.equal(targeting.uniqueCustomerNeeds.label, 'High');
});

test('14. Evidence-backed targeting provides transparent arithmetic explanations', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  const segA = stp.segments.find((s) => s.sharedProblem.toLowerCase().includes('outbound'))!;
  const targeting = stp.targetingAssessments[segA.id];
  assert.ok(targeting.recommendationRationale.length > 10, 'Recommendation rationale must be provided');
});

test('15. Provisional recommendations with sparse deal data flag shortlist rather than conclusive winner', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  assert.equal(
    stp.overallTargetingRecommendation.isProvisional,
    true,
    'Overall targeting recommendation must be provisional when deal data or unit economics is sparse'
  );
  assert.ok(
    stp.overallTargetingRecommendation.summary.toLowerCase().includes('provisional'),
    'Summary must explicitly state provisional status'
  );
});

test('16. Point of Parity and Point of Difference are generated with quality control checks', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  const segA = stp.segments.find((s) => !s.isInsufficientEvidenceGroup)!;
  const positioning = stp.positioningRecommendations[segA.id];

  assert.ok(positioning.pointOfDifference.length > 5, 'Point of Difference must be populated');
  assert.ok(positioning.reasonsToBelieve.length >= 2, 'Reasons to believe must have at least 2 points');
  assert.equal(positioning.qualityControl.relevance, true);
  assert.equal(positioning.qualityControl.differentiation, true);
  assert.equal(positioning.qualityControl.credibility, true);
});

test('17. No invented competitor superiority or fabricated claims', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  for (const seg of stp.segments) {
    const pos = stp.positioningRecommendations[seg.id];
    assert.equal(pos.isTestedClaim, false, 'All claims must be marked as untested hypotheses');
  }
});

test('18. Dataset ownership checks are strictly enforced by repository', async () => {
  const repo = new InMemorySTPRepository();
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);

  await repo.saveDatasetSTPAnalysis('user-01', 'dataset-20', stp);

  const owned = await repo.getDatasetSTPAnalysis('user-01', 'dataset-20');
  assert.ok(owned, 'Owner must be able to retrieve dataset STP analysis');

  const crossTenant = await repo.getDatasetSTPAnalysis('user-other', 'dataset-20');
  assert.equal(crossTenant, null, 'Cross-tenant access must return null');
});

test('19. Mock provider operates cleanly in demo mode without API credentials', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  // Executes in pure TypeScript without any network or API keys
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);
  assert.ok(stp.segments.length > 0);
  assert.ok(stp.targetingAssessments);
});

test('20. Compatibility: Deterministic lead ICP fit scoring engine operates unchanged', () => {
  const normLead: NormalizedLead = {
    id: 'lead-test',
    companyName: 'Acme Software',
    domain: 'acme.com',
    industry: 'Enterprise SaaS',
    headcount: 200,
    annualRevenue: '$25M',
    description: 'B2B SaaS platform.',
    country: 'United States',
    technologies: ['snowflake', 'aws', 'postgres'],
    isClean: true,
    ingestedAt: new Date().toISOString(),
  };

  const offering: OfferingProfile = {
    id: 'offering-01',
    companyName: 'Synthetix',
    website: 'https://synthetix.io',
    productName: 'Pipeline Radar',
    category: 'Sales Tech',
    businessModel: 'B2B SaaS',
    pricingModel: 'Annual Contract Value (ACV)',
    typicalACV: '$36,000 / year',
    valueProposition: 'Automate outbound prospecting.',
    primaryProblemSolved: 'Manual list building',
    keyCapabilities: ['snowflake', 'postgres'],
    buyerPersonas: [
      {
        id: 'bp-1',
        title: 'VP of Sales',
        department: 'Sales',
        seniority: 'VP',
        coreMotivation: 'Close deals faster',
        primaryFriction: 'Manual list building',
        hasBudgetAuthority: true,
      },
    ],
    icpHypothesis: {
      targetHeadcount: '50-500 FTE',
      targetIndustries: ['Enterprise SaaS'],
      targetGeographies: ['North America'],
      criticalTriggerEvents: ['Hiring SDR team'],
      hypothesisRationale: 'Target mid-market SaaS',
      isValidated: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };


  const score = calculateDeterministicICPScore(normLead, offering, undefined, DEFAULT_SCORING_WEIGHTS);
  assert.ok(score.totalScore >= 0 && score.totalScore <= 100);
  assert.equal(score.breakdown.length, 4);
});


test('21. Compatibility: Seamless integration with Prompt 10 Need Gap and 5C outputs', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);
  assert.equal(stp.candidateSegmentsCount, summary.topNeedPatterns.length);
});

test('22. Cached result reuse and repository persistence', async () => {
  const repo = new InMemorySTPRepository();
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-20', summary, fiveC, leads, gapsMap);
  await repo.saveDatasetSTPAnalysis('user-01', 'dataset-20', stp);

  const cached = await repo.getDatasetSTPAnalysis('user-01', 'dataset-20');
  assert.ok(cached);
  assert.equal(cached.versionFingerprint, stp.versionFingerprint);

  const firstSegId = stp.segments[0].id;
  const singleSeg = await repo.getSegment('user-01', firstSegId);
  assert.ok(singleSeg);
  assert.equal(singleSeg.id, firstSegId);
});
