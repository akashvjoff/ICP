import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDeterministicICPScore,
  batchScoreLeads,
  validateScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
  CURRENT_SCORING_MODEL_VERSION,
} from '../../lib/scoring';
import { InMemoryScoringRepository } from '../scoringService';
import type { NormalizedLead } from '../../types/lead';
import type { OfferingProfile } from '../../types/offering';
import type { NeedGapAnalysisItem, CustomerSegment } from '../../types/analysis';
import type { ScoringWeights } from '../../types/scoring';

// Helper to construct normalized leads with clean defaults
function createTestLead(overrides: Partial<NormalizedLead> = {}): NormalizedLead {
  return {
    id: 'lead-test-' + Math.random().toString(36).slice(2, 7),
    companyName: 'Test Company',
    domain: 'testcompany.com',
    industry: 'Enterprise Software',
    headcount: 250,
    annualRevenue: null,
    description: 'B2B enterprise technology provider.',
    country: 'United States',
    technologies: [],
    isClean: true,
    isAiEnriched: true,
    ingestedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to construct Need Gap items
function createTestNeedGap(overrides: Partial<NeedGapAnalysisItem> = {}): NeedGapAnalysisItem {
  return {
    leadId: 'lead-01',
    companyName: 'Test Company',
    identifiedNeed: 'Pipeline downtime and schema breaking changes',
    gapMagnitude: 'Acute',
    urgencyDriver: 'Executive board report failure',
    offeringCapabilityMatch: 'Automated contract tests',
    consequenceOfInaction: 'Recurring data corruption',
    gapScore: 90,
    ...overrides,
  };
}

// Standard Test Seller Offering
const TEST_OFFERING: OfferingProfile = {
  id: 'offering-01',
  companyName: 'Synthetix Data Cloud',
  website: 'https://synthetix.io',
  productName: 'DataReliability Engine',
  category: 'Enterprise B2B Software',
  businessModel: 'B2B SaaS',
  pricingModel: 'Annual Contract Value (ACV)',
  typicalACV: '$36,000 / year',
  valueProposition: 'Eliminates silent data corruption in mission-critical executive pipelines.',
  primaryProblemSolved: 'Silent schema drift causing corrupt executive dashboards',
  keyCapabilities: [
    'Automated schema drift detection',
    'Bidirectional dbt and Snowflake sync',
    'Real-time Slack & PagerDuty alerts',
  ],
  buyerPersonas: [
    {
      id: 'p-1',
      title: 'VP of Data & Analytics',
      department: 'Data Engineering',
      seniority: 'VP',
      coreMotivation: 'Zero downstream pipeline downtime',
      primaryFriction: 'Vendor security review',
      hasBudgetAuthority: true,
    },
  ],
  icpHypothesis: {
    targetHeadcount: '150–1,500 FTE',
    targetIndustries: ['FinTech', 'HealthTech', 'E-commerce', 'B2B SaaS'],
    targetGeographies: ['United States', 'Canada', 'United Kingdom'],
    criticalTriggerEvents: ['Corrupt executive board report'],
    hypothesisRationale: 'Requires cloud warehouse and dedicated data team.',
    isValidated: false,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test('1. Default weights total exactly 100%', () => {
  const sum =
    DEFAULT_SCORING_WEIGHTS.needUrgencyWeight +
    DEFAULT_SCORING_WEIGHTS.capabilityMatchWeight +
    DEFAULT_SCORING_WEIGHTS.stakeholderFeasibilityWeight +
    DEFAULT_SCORING_WEIGHTS.firmographicAlignmentWeight;

  assert.strictEqual(Math.round(sum * 100), 100);
  assert.strictEqual(DEFAULT_SCORING_WEIGHTS.needUrgencyWeight, 0.35);
  assert.strictEqual(DEFAULT_SCORING_WEIGHTS.capabilityMatchWeight, 0.25);
  assert.strictEqual(DEFAULT_SCORING_WEIGHTS.stakeholderFeasibilityWeight, 0.20);
  assert.strictEqual(DEFAULT_SCORING_WEIGHTS.firmographicAlignmentWeight, 0.20);

  const validation = validateScoringWeights(DEFAULT_SCORING_WEIGHTS);
  assert.strictEqual(validation.isValid, true);
  assert.strictEqual(validation.sumPercentage, 100);
});

test('2. Deterministic reproducibility: Identical inputs produce identical scores and audit ledger', () => {
  const lead = createTestLead({
    id: 'lead-repro-01',
    companyName: 'FinNova Technologies',
    domain: 'finnova.io',
    industry: 'FinTech',
    headcount: 350,
    technologies: ['Snowflake', 'dbt', 'Postgres'],
    country: 'United States',
    description: 'High-growth payments infrastructure for modern merchants.',
  });

  const needGap = createTestNeedGap({
    leadId: lead.id,
    companyName: lead.companyName,
    identifiedNeed: 'Silent schema break in payment analytics',
    gapMagnitude: 'Acute',
    gapScore: 92,
    urgencyDriver: 'CEO revenue metrics delayed weekly',
  });

  const scoreRun1 = calculateDeterministicICPScore(lead, TEST_OFFERING, needGap);
  const scoreRun2 = calculateDeterministicICPScore(lead, TEST_OFFERING, needGap);
  const scoreRun3 = calculateDeterministicICPScore(lead, TEST_OFFERING, needGap);

  assert.strictEqual(scoreRun1.totalScore, scoreRun2.totalScore);
  assert.strictEqual(scoreRun2.totalScore, scoreRun3.totalScore);
  assert.strictEqual(scoreRun1.tier, scoreRun2.tier);
  assert.strictEqual(scoreRun1.sourceFingerprint, scoreRun2.sourceFingerprint);
  assert.strictEqual(scoreRun1.evidenceCoverage, scoreRun2.evidenceCoverage);
  assert.deepStrictEqual(scoreRun1.breakdown, scoreRun2.breakdown);
});

test('3. Formula backward compatibility: Legacy inputs produce expected scores', () => {
  const minimalLead = createTestLead({
    id: 'lead-legacy-01',
    companyName: 'Acme Basic Inc',
    domain: 'acmebasic.com',
    industry: 'Manufacturing',
    headcount: 50,
    isAiEnriched: false,
  });

  const score = calculateDeterministicICPScore(minimalLead, TEST_OFFERING);
  assert.ok(typeof score.totalScore === 'number');
  assert.ok(score.totalScore >= 0 && score.totalScore <= 100);
  assert.ok(['Tier 1: High Conviction', 'Tier 2: Moderate Fit', 'Tier 3: Niche / Edge', 'Tier 4: Disqualified'].includes(score.tier));
  assert.strictEqual(score.modelVersion, CURRENT_SCORING_MODEL_VERSION);
});

test('4. Need Gap evidence integration: acute need gap maps to Need Urgency dimension', () => {
  const lead = createTestLead({
    id: 'lead-acute-01',
    companyName: 'Loomis Healthcare',
    domain: 'loomishealth.com',
    industry: 'HealthTech',
    headcount: 400,
    country: 'United States',
  });

  const acuteGap = createTestNeedGap({
    leadId: lead.id,
    companyName: lead.companyName,
    identifiedNeed: 'Critical patient intake ETL pipeline failures',
    gapMagnitude: 'Acute',
    gapScore: 95,
    urgencyDriver: 'HIPAA compliance audit risk',
  });

  const score = calculateDeterministicICPScore(lead, TEST_OFFERING, acuteGap);
  const needBreakdown = score.breakdown.find((b) => b.criterion === 'Need Urgency & Problem Severity');

  assert.ok(needBreakdown);
  assert.strictEqual(needBreakdown.rating, 95);
  assert.strictEqual(needBreakdown.awardedPoints, Number((95 * 0.35).toFixed(1)));
  assert.ok(score.primaryStrengths.some((s) => s.includes('Acute need urgency')));
});

test('5. Seller capability matching: matches offering capabilities against company pain', () => {
  const leadWithMatchingTech = createTestLead({
    id: 'lead-cap-01',
    companyName: 'Cloud Analytics Pro',
    domain: 'cloudanalytics.io',
    industry: 'B2B SaaS',
    headcount: 200,
    technologies: ['Snowflake', 'dbt'],
    country: 'United States',
  });

  const score = calculateDeterministicICPScore(leadWithMatchingTech, TEST_OFFERING);
  const capBreakdown = score.breakdown.find((b) => b.criterion === 'Capability & Architecture Match');

  assert.ok(capBreakdown);
  assert.strictEqual(capBreakdown.rating, 95);
  assert.strictEqual(capBreakdown.awardedPoints, Number((95 * 0.25).toFixed(1)));
  assert.ok(score.primaryStrengths.some((s) => s.includes('Compatible technical infrastructure')));
});

test('6. Missing stakeholder information yields UNKNOWN rating and zero awarded points', () => {
  const leadWithoutHeadcount = createTestLead({
    id: 'lead-nostake-01',
    companyName: 'Mystery Org LLC',
    domain: 'mystery.org',
    industry: 'FinTech',
    headcount: null,
    country: 'United States',
  });

  const score = calculateDeterministicICPScore(leadWithoutHeadcount, TEST_OFFERING);
  const stakeBreakdown = score.breakdown.find((b) => b.criterion === 'Stakeholder & Economic Feasibility');

  assert.ok(stakeBreakdown);
  assert.strictEqual(stakeBreakdown.rating, 'UNKNOWN');
  assert.strictEqual(stakeBreakdown.awardedPoints, 0);
  assert.strictEqual(stakeBreakdown.missingInformation, 'Stakeholder Authority & Headcount');
  assert.ok(score.missingFields?.includes('Stakeholders & Organization Scale'));
});

test('7. Missing firmographic information yields UNKNOWN rating and zero awarded points', () => {
  const leadWithoutIndustry = createTestLead({
    id: 'lead-nofirmo-01',
    companyName: 'Stealth Entity',
    domain: 'stealth.co',
    industry: '',
    headcount: 250,
    country: 'United States',
  });

  const score = calculateDeterministicICPScore(leadWithoutIndustry, TEST_OFFERING);
  const firmoBreakdown = score.breakdown.find((b) => b.criterion === 'Firmographic & Hypothesis Alignment');

  assert.ok(firmoBreakdown);
  assert.strictEqual(firmoBreakdown.rating, 'UNKNOWN');
  assert.strictEqual(firmoBreakdown.awardedPoints, 0);
  assert.strictEqual(firmoBreakdown.missingInformation, 'Firmographic Profile & Industry Vertical');
  assert.ok(score.missingFields?.includes('Firmographics & Industry'));
});

test('8. Unknown attribute handling: explicit UNKNOWN rating, zero hallucinated points', () => {
  const completelyBlankLead = createTestLead({
    id: 'lead-blank-01',
    companyName: 'Empty Data Corp',
    domain: null,
    industry: '',
    headcount: null,
    description: '',
    technologies: [],
    country: '',
    isAiEnriched: false,
  });

  const score = calculateDeterministicICPScore(completelyBlankLead, TEST_OFFERING);
  assert.strictEqual(score.totalScore, 0);
  assert.strictEqual(score.evidenceCoverage, 0);
  assert.strictEqual(score.isInsufficientEvidence, true);
  assert.strictEqual(score.tier, 'Tier 3: Niche / Edge'); // Demoted due to insufficient evidence

  const unknownBreakdowns = score.breakdown.filter((b) => b.rating === 'UNKNOWN');
  assert.strictEqual(unknownBreakdowns.length, 4);
});

test('9. Evidence coverage calculation: weighted assessable points / total weight', () => {
  // Lead with known Need (35%) and known Firmographics (20%), but unknown Cap (25%) and unknown Stakeholder (20%)
  const partialLead = createTestLead({
    id: 'lead-partial-cov',
    companyName: 'Partial Coverage Inc',
    domain: 'partialcov.com',
    industry: 'FinTech',
    headcount: null,
    technologies: [],
    description: '',
  });

  const needGap = createTestNeedGap({
    leadId: partialLead.id,
    companyName: partialLead.companyName,
    identifiedNeed: 'Pipeline lag',
    gapMagnitude: 'Acute',
    gapScore: 90,
  });

  const score = calculateDeterministicICPScore(partialLead, TEST_OFFERING, needGap);
  // Known dimensions: Need (35%) + Firmographics (20%) = 55%
  assert.strictEqual(score.evidenceCoverage, 55);
  assert.strictEqual(score.isInsufficientEvidence, true);
});

test('10. Insufficient evidence classification: coverage < 70% blocks Tier 1', () => {
  // Even with 100% need urgency and 100% industry alignment, if coverage is 55% (< 70%), cannot get Tier 1
  const highNeedLowCoverageLead = createTestLead({
    id: 'lead-highneed-nocov',
    companyName: 'High Need Hidden Co',
    domain: 'highneed.com',
    industry: 'FinTech', // 20%
    country: 'United States',
    headcount: null, // Missing 20%
    technologies: [], // Missing 25%
    description: '',
  });

  const acuteGap = createTestNeedGap({
    leadId: highNeedLowCoverageLead.id,
    companyName: highNeedLowCoverageLead.companyName,
    identifiedNeed: 'Critical data outages',
    gapMagnitude: 'Acute',
    gapScore: 100, // 35% * 100 = 35.0
  });

  const score = calculateDeterministicICPScore(highNeedLowCoverageLead, TEST_OFFERING, acuteGap);
  assert.strictEqual(score.isInsufficientEvidence, true);
  assert.notStrictEqual(score.tier, 'Tier 1: High Conviction');
});

test('11. High fit with unknown buying intent: intent score remains UNKNOWN/null while fit score is high', () => {
  const highFitNoIntentLead = createTestLead({
    id: 'lead-highfit-nointent',
    companyName: 'Uncontacted Perfect Fit',
    domain: 'perfectfit.io',
    industry: 'FinTech',
    headcount: 500,
    technologies: ['Snowflake', 'dbt'],
    country: 'United States',
    leadStage: undefined,
  });

  const acuteGap = createTestNeedGap({
    leadId: highFitNoIntentLead.id,
    companyName: highFitNoIntentLead.companyName,
    identifiedNeed: 'Corrupt dashboards',
    gapMagnitude: 'Acute',
    gapScore: 92,
  });

  const score = calculateDeterministicICPScore(highFitNoIntentLead, TEST_OFFERING, acuteGap);
  assert.ok(score.totalScore >= 80);
  assert.strictEqual(score.tier, 'Tier 1: High Conviction');
  assert.strictEqual(score.intentScore, null);
  assert.strictEqual(score.intentLabel, 'BUYING INTENT: UNKNOWN');

  // Verify verified won lead
  const wonLead = createTestLead({
    ...highFitNoIntentLead,
    id: 'lead-won-01',
    leadStage: 'won',
  });
  const wonScore = calculateDeterministicICPScore(wonLead, TEST_OFFERING, acuteGap);
  assert.strictEqual(wonScore.intentScore, 100);
  assert.strictEqual(wonScore.intentLabel, 'VERIFIED CUSTOMER (WON)');
});

test('12. Hard disqualification overrides score: geography, status, industry, and severe tech', () => {
  // A. Geographic Exclusion
  const overseasLead = createTestLead({
    id: 'lead-disq-geo',
    companyName: 'Tokyo Data K.K.',
    domain: 'tokyodata.jp',
    industry: 'FinTech',
    headcount: 500,
    technologies: ['Snowflake', 'dbt'],
    country: 'Japan', // Outside US, Canada, UK
  });

  const acuteGap = createTestNeedGap({
    leadId: overseasLead.id,
    companyName: overseasLead.companyName,
    identifiedNeed: 'Pipeline failures',
    gapMagnitude: 'Acute',
    gapScore: 95,
  });

  const geoScore = calculateDeterministicICPScore(overseasLead, TEST_OFFERING, acuteGap);
  assert.strictEqual(geoScore.isDisqualified, true);
  assert.strictEqual(geoScore.tier, 'Tier 4: Disqualified');
  assert.strictEqual(geoScore.recommendedAction, 'Archive / Ignore');
  assert.ok(geoScore.disqualificationReason?.includes('outside seller target territories'));

  // B. Explicit CRM Disqualification
  const crmDisqualifiedLead = createTestLead({
    id: 'lead-disq-crm',
    companyName: 'Defunct Tech LLC',
    domain: 'defunct.io',
    industry: 'FinTech',
    headcount: 500,
    technologies: ['Snowflake', 'dbt'],
    country: 'United States',
    leadStage: 'disqualified',
    reasonWonLost: 'Competitor locked multi-year exclusive',
  });
  const crmScore = calculateDeterministicICPScore(crmDisqualifiedLead, TEST_OFFERING, acuteGap);
  assert.strictEqual(crmScore.isDisqualified, true);
  assert.strictEqual(crmScore.tier, 'Tier 4: Disqualified');
  assert.strictEqual(crmScore.disqualificationReason, 'Competitor locked multi-year exclusive');

  // C. Target Industry Exclusion
  const excludedIndLead = createTestLead({
    id: 'lead-disq-ind',
    companyName: 'Gambling Bet Network',
    domain: 'betnet.com',
    industry: 'Online Gambling',
    headcount: 500,
    country: 'United States',
  });
  const indScore = calculateDeterministicICPScore(excludedIndLead, TEST_OFFERING, acuteGap, undefined, {
    excludedIndustries: ['Gambling', 'Casino'],
  });
  assert.strictEqual(indScore.isDisqualified, true);
  assert.strictEqual(indScore.tier, 'Tier 4: Disqualified');
  assert.ok(indScore.disqualificationReason?.includes('prohibited by seller exclusion policy'));

  // D. Severe Technical Incompatibility
  const legacyLead = createTestLead({
    id: 'lead-disq-tech',
    companyName: 'Mainframe Records Corp',
    domain: 'mainframerecords.com',
    industry: 'FinTech',
    headcount: 500,
    country: 'United States',
    technologies: ['Legacy Mainframe', 'COBOL', 'Paper-Based'],
  });
  const techScore = calculateDeterministicICPScore(legacyLead, TEST_OFFERING, acuteGap);
  assert.strictEqual(techScore.isDisqualified, true);
  assert.strictEqual(techScore.tier, 'Tier 4: Disqualified');
  assert.ok(techScore.disqualificationReason?.includes('legacy architecture'));
});

test('13. Configurable weight validation: sum must equal 100%', () => {
  // Valid weights
  const validWeights: ScoringWeights = {
    needUrgencyWeight: 0.40,
    capabilityMatchWeight: 0.30,
    stakeholderFeasibilityWeight: 0.15,
    firmographicAlignmentWeight: 0.15,
  };
  const v1 = validateScoringWeights(validWeights);
  assert.strictEqual(v1.isValid, true);
  assert.strictEqual(v1.sumPercentage, 100);

  // Invalid weights (sum = 110%)
  const invalidWeights: ScoringWeights = {
    needUrgencyWeight: 0.50,
    capabilityMatchWeight: 0.30,
    stakeholderFeasibilityWeight: 0.15,
    firmographicAlignmentWeight: 0.15,
  };
  const v2 = validateScoringWeights(invalidWeights);
  assert.strictEqual(v2.isValid, false);
  assert.ok(v2.error?.includes('Scoring weights must total exactly 100%'));

  // Negative weights
  const negativeWeights: ScoringWeights = {
    needUrgencyWeight: -0.10,
    capabilityMatchWeight: 0.60,
    stakeholderFeasibilityWeight: 0.25,
    firmographicAlignmentWeight: 0.25,
  };
  const v3 = validateScoringWeights(negativeWeights);
  assert.strictEqual(v3.isValid, false);
});

test('14. Score recalculation on weight change: updating weights recalculates deterministically', () => {
  const lead = createTestLead({
    id: 'lead-recalc-01',
    companyName: 'Recalc Technologies',
    domain: 'recalc.io',
    industry: 'FinTech',
    headcount: 300,
    technologies: ['Snowflake', 'dbt'],
    country: 'United States',
  });

  const acuteGap = createTestNeedGap({
    leadId: lead.id,
    companyName: lead.companyName,
    identifiedNeed: 'Silent schema breaks',
    gapMagnitude: 'Acute',
    gapScore: 90,
  });

  // Run with default weights (35/25/20/20)
  const defaultScore = calculateDeterministicICPScore(lead, TEST_OFFERING, acuteGap);

  // Run with heavy need weight (60/20/10/10)
  const heavyNeedWeights: ScoringWeights = {
    needUrgencyWeight: 0.60,
    capabilityMatchWeight: 0.20,
    stakeholderFeasibilityWeight: 0.10,
    firmographicAlignmentWeight: 0.10,
  };
  const heavyNeedScore = calculateDeterministicICPScore(lead, TEST_OFFERING, acuteGap, heavyNeedWeights);

  assert.notStrictEqual(defaultScore.totalScore, heavyNeedScore.totalScore);
  const needBreakdownDefault = defaultScore.breakdown.find((b) => b.criterion === 'Need Urgency & Problem Severity');
  const needBreakdownHeavy = heavyNeedScore.breakdown.find((b) => b.criterion === 'Need Urgency & Problem Severity');

  assert.strictEqual(needBreakdownDefault?.weightPct, 35);
  assert.strictEqual(needBreakdownHeavy?.weightPct, 60);
});

test('15. Score persistence: scores saved and retrieved from repository', async () => {
  const repo = new InMemoryScoringRepository();
  const userId = 'user-test-01';
  const datasetId = 'dataset-test-01';

  const lead = createTestLead({
    id: 'lead-persist-01',
    companyName: 'Persist Co',
    domain: 'persist.co',
    industry: 'FinTech',
    headcount: 200,
    technologies: ['Snowflake'],
    country: 'United States',
  });

  const score = calculateDeterministicICPScore(lead, TEST_OFFERING);
  await repo.saveLeadScores(userId, datasetId, [score]);

  const retrievedScores = await repo.getLeadScores(userId, datasetId);
  assert.strictEqual(retrievedScores.length, 1);
  assert.strictEqual(retrievedScores[0].leadId, 'lead-persist-01');
  assert.strictEqual(retrievedScores[0].totalScore, score.totalScore);

  const single = await repo.getSingleLeadScore(userId, 'lead-persist-01');
  assert.ok(single);
  assert.strictEqual(single.companyName, 'Persist Co');
});

test('16. Dataset ownership enforcement: cannot access scores for other users datasets', async () => {
  const repo = new InMemoryScoringRepository();
  repo.setDatasetOwner('dataset-alice-01', 'user-alice');

  // Alice accesses her dataset -> ok
  await repo.assertOwnedDataset('user-alice', 'dataset-alice-01');

  // Bob attempts to access Alice's dataset -> rejected
  await assert.rejects(
    async () => {
      await repo.assertOwnedDataset('user-bob', 'dataset-alice-01');
    },
    /Dataset dataset-alice-01 not found or not owned by user/
  );
});

test('17. No duplicate lead scores: upserting leads updates rather than duplicates', async () => {
  const repo = new InMemoryScoringRepository();
  const userId = 'user-upsert';
  const datasetId = 'dataset-upsert';

  const lead = createTestLead({
    id: 'lead-upsert-01',
    companyName: 'Upsert Corp',
    domain: 'upsert.com',
    industry: 'FinTech',
    headcount: 200,
  });

  const initialScore = calculateDeterministicICPScore(lead, TEST_OFFERING);
  await repo.saveLeadScores(userId, datasetId, [initialScore]);

  // Update lead and save again with new score
  const updatedLead = createTestLead({
    ...lead,
    technologies: ['Snowflake', 'dbt'],
  });
  const updatedScore = calculateDeterministicICPScore(updatedLead, TEST_OFFERING);
  await repo.saveLeadScores(userId, datasetId, [updatedScore]);

  const list = await repo.getLeadScores(userId, datasetId);
  assert.strictEqual(list.length, 1); // Not 2!
  assert.strictEqual(list[0].totalScore, updatedScore.totalScore);
});

test('18. Cached score retrieval: retrieves stored scores without recomputation', async () => {
  const repo = new InMemoryScoringRepository();
  const userId = 'user-cache';
  const datasetId = 'dataset-cache';

  const fakeSavedScore = {
    ...calculateDeterministicICPScore(
      createTestLead({ id: 'lead-c-1', companyName: 'Cached Inc' }),
      TEST_OFFERING
    ),
    totalScore: 88.5,
  };

  await repo.saveLeadScores(userId, datasetId, [fakeSavedScore]);
  const fetched = await repo.getLeadScores(userId, datasetId);
  assert.strictEqual(fetched[0].totalScore, 88.5);
});

test('19. STP compatibility: works seamlessly with STP segments', () => {
  const segment: CustomerSegment = {
    id: 'segment-fintech-dataops',
    name: 'High-Volume FinTech Data Ops',
    description: 'Payment processors experiencing silent schema drift.',
    primaryCompanyIds: ['lead-stp-01'],
    matchingCompanyIds: ['lead-stp-01'],
    companyCount: 1,
    totalMatchingCount: 1,
    datasetShare: 100,
    ratioFormatted: '1 / 1',
    confidence: 'high',
    evidenceStrength: 'high',
    sharedProblem: 'Data pipeline corruption',
    desiredOutcome: 'Zero downtime analytics',
    commonProductBenefits: ['Continuous validation'],
    commonIndustries: ['FinTech'],
    typicalCompanySizes: ['150–500 FTE'],
    relevantBusinessModels: ['B2B SaaS'],
    relevantSellerFeatures: ['Schema drift alerts'],
    buyingRoleHypotheses: ['VP of Data'],
    missingInformation: [],
    outcomes: {
      totalLeads: 1,
      leadsWithKnownOutcomes: 1,
      wonDeals: 1,
      lostDeals: 0,
      openDeals: 0,
      observedWinRate: 100,
      winRateFormatted: '1/1 (100%)',
      totalWonDealValue: 36000,
      averageWonDealValue: 36000,
      medianWonDealValue: 36000,
      averageRetentionMonths: 12,
      reasonsWon: ['Contract validation'],
      reasonsLost: [],
      warnings: [],
      dataClassification: 'CUSTOMER-BACKED SEGMENT ANALYSIS',
    },
  };

  const lead = createTestLead({
    id: 'lead-stp-01',
    companyName: 'FinOps Global',
    domain: 'finops.global',
    industry: 'FinTech',
    headcount: 300,
    technologies: ['Snowflake'],
    country: 'United States',
  });

  const scoredList = batchScoreLeads([lead], TEST_OFFERING, undefined, undefined, {
    segments: [segment],
  });

  assert.strictEqual(scoredList.length, 1);
  assert.strictEqual(scoredList[0].segmentId, 'segment-fintech-dataops');
  assert.strictEqual(scoredList[0].segmentName, 'High-Volume FinTech Data Ops');
});

test('20. Existing report compatibility: scored leads provide backward-compatible properties', () => {
  const lead = createTestLead({
    id: 'lead-compat-01',
    companyName: 'Compat Test Inc',
    domain: 'compat.io',
    industry: 'FinTech',
    headcount: 500,
    technologies: ['Snowflake', 'dbt'],
    country: 'United States',
  });

  const score = calculateDeterministicICPScore(lead, TEST_OFFERING);

  // All legacy properties exist and are correctly typed
  assert.strictEqual(typeof score.leadId, 'string');
  assert.strictEqual(typeof score.companyName, 'string');
  assert.strictEqual(typeof score.domain, 'string');
  assert.strictEqual(typeof score.totalScore, 'number');
  assert.strictEqual(typeof score.tier, 'string');
  assert.strictEqual(typeof score.confidence, 'number');
  assert.strictEqual(typeof score.recommendedAction, 'string');
  assert.ok(Array.isArray(score.breakdown));
  assert.ok(Array.isArray(score.primaryStrengths));
  assert.ok(Array.isArray(score.primaryDisqualifiers));
});

test('21. Offline demo mode operation: InMemoryScoringRepository functions without Supabase', async () => {
  const repo = new InMemoryScoringRepository();
  const userId = 'demo-user';
  const datasetId = 'demo-dataset';

  const defaultWeights: ScoringWeights = {
    needUrgencyWeight: 0.35,
    capabilityMatchWeight: 0.25,
    stakeholderFeasibilityWeight: 0.20,
    firmographicAlignmentWeight: 0.20,
  };

  await repo.saveScoringConfig(userId, datasetId, defaultWeights);
  const cfg = await repo.getScoringConfig(userId, datasetId);
  assert.ok(cfg);
  assert.strictEqual(cfg.needUrgencyWeight, 0.35);

  const emptyScores = await repo.getLeadScores(userId, datasetId);
  assert.deepStrictEqual(emptyScores, []);
});

test('22. Strict non-invention of ratings: no synthetic ratings when fields are missing or unknown', () => {
  const emptyLead = createTestLead({
    id: 'lead-no-invent',
    companyName: 'Blank Record',
    domain: null,
    industry: '',
    headcount: null,
    description: '',
    technologies: [],
    country: '',
    isAiEnriched: false,
  });

  const score = calculateDeterministicICPScore(emptyLead, TEST_OFFERING);

  score.breakdown.forEach((item) => {
    assert.strictEqual(item.rating, 'UNKNOWN');
    assert.strictEqual(item.awardedPoints, 0);
    assert.strictEqual(item.weightedContribution, null);
    assert.strictEqual(item.evidenceOrigin, 'UNKNOWN');
  });

  assert.strictEqual(score.totalScore, 0);
  assert.strictEqual(score.evidenceCoverage, 0);
  assert.strictEqual(score.missingFields?.length, 4);
});

// =========================================================================
// SYNTHETIC BENCHMARK SCENARIO (MANDATORY)
// Companies A, B, C, D
// =========================================================================
test('SYNTHETIC BENCHMARK SCENARIO: Companies A, B, C, and D', () => {
  // Company A: High fit (acute need matching seller capabilities, verified decision makers, target firmographics)
  const companyA = createTestLead({
    id: 'bench-comp-A',
    companyName: 'Alpha Financial Systems',
    domain: 'alphafin.com',
    industry: 'FinTech',
    headcount: 500, // Optimal size (150-2500)
    technologies: ['Snowflake', 'dbt'], // Matches key capabilities
    country: 'United States', // In target territory
    description: 'High-volume institutional payments routing network.',
  });

  const needGapA = createTestNeedGap({
    leadId: companyA.id,
    companyName: companyA.companyName,
    identifiedNeed: 'Frequent silent schema corruption breaking compliance audits',
    gapMagnitude: 'Acute',
    gapScore: 95,
    urgencyDriver: 'Imminent SEC & FINRA audit examination',
  });

  const scoreA = calculateDeterministicICPScore(companyA, TEST_OFFERING, needGapA);
  assert.ok(scoreA.totalScore >= 80, `Company A should score >= 80, got ${scoreA.totalScore}`);
  assert.strictEqual(scoreA.tier, 'Tier 1: High Conviction');
  assert.ok((scoreA.evidenceCoverage ?? 0) >= 70, `Company A evidence coverage should be >= 70%, got ${scoreA.evidenceCoverage}%`);
  assert.strictEqual(scoreA.isDisqualified, false);
  assert.strictEqual(scoreA.isInsufficientEvidence, false);

  // Company B: Same industry as Company A, but NO need gap / low urgency
  const companyB = createTestLead({
    id: 'bench-comp-B',
    companyName: 'Beta Financial Holdings',
    domain: 'betafin.com',
    industry: 'FinTech', // Same industry as A
    headcount: 500, // Same headcount as A
    technologies: ['Snowflake'], // Partial tech
    country: 'United States', // Same country as A
    description: 'Stable wealth management boutique with frozen tech stack.',
  });

  const needGapB = createTestNeedGap({
    leadId: companyB.id,
    companyName: companyB.companyName,
    identifiedNeed: 'None - architecture locked and satisfactory',
    gapMagnitude: 'Negligible',
    gapScore: 10,
    urgencyDriver: 'No active pain points',
  });

  const scoreB = calculateDeterministicICPScore(companyB, TEST_OFFERING, needGapB);
  assert.ok(scoreB.totalScore < 65, `Company B should score substantially lower (< 65), got ${scoreB.totalScore}`);
  assert.ok(scoreB.totalScore < scoreA.totalScore - 25, `Company B should be far below Company A`);
  assert.notStrictEqual(scoreB.tier, 'Tier 1: High Conviction');
  assert.ok(['Tier 3: Niche / Edge', 'Tier 4: Disqualified'].includes(scoreB.tier));

  // Company C: High need, but missing stakeholder/buying unit info and tech stack
  const companyC = createTestLead({
    id: 'bench-comp-C',
    companyName: 'Gamma Healthcare Partners',
    domain: 'gammahealth.org',
    industry: 'HealthTech', // Known industry (20%)
    country: 'United States',
    headcount: null, // Missing stakeholder info! (20% missing)
    technologies: [], // Missing tech stack! (25% missing)
    description: '',
  });

  const needGapC = createTestNeedGap({
    leadId: companyC.id,
    companyName: companyC.companyName,
    identifiedNeed: 'Severe data outages in clinical reporting',
    gapMagnitude: 'Acute',
    gapScore: 92, // High need! (35% * 92 = 32.2)
    urgencyDriver: 'Patient safety dashboard inaccuracies',
  });

  const scoreC = calculateDeterministicICPScore(companyC, TEST_OFFERING, needGapC);
  // High need points awarded, but missing tech stack & stakeholder leads to coverage = 55% (< 70%)
  assert.ok((scoreC.evidenceCoverage ?? 0) < 70, `Company C should have < 70% coverage, got ${scoreC.evidenceCoverage}%`);
  assert.strictEqual(scoreC.isInsufficientEvidence, true);
  assert.notStrictEqual(scoreC.tier, 'Tier 1: High Conviction', 'Company C cannot be Tier 1 due to insufficient evidence');
  assert.strictEqual(scoreC.tier, 'Tier 3: Niche / Edge');

  // Company D: High need, high match, but outside seller's target geography (Hard Disqualification)
  const companyD = createTestLead({
    id: 'bench-comp-D',
    companyName: 'Delta Mining Logistics Pty',
    domain: 'deltamining.com.au',
    industry: 'FinTech', // Target industry
    headcount: 500, // Target headcount
    technologies: ['Snowflake', 'dbt'], // Target tech
    country: 'Australia', // OUTSIDE target territory (US, Canada, UK)!
    description: 'Fintech settlement layer for APAC resources trading.',
  });

  const needGapD = createTestNeedGap({
    leadId: companyD.id,
    companyName: companyD.companyName,
    identifiedNeed: 'Critical transaction reconciliation discrepancies',
    gapMagnitude: 'Acute',
    gapScore: 95,
    urgencyDriver: 'Cross-border clearing fines',
  });

  const scoreD = calculateDeterministicICPScore(companyD, TEST_OFFERING, needGapD);
  // Must be strictly Tier 4 Disqualified regardless of high numeric need/capability match
  assert.strictEqual(scoreD.isDisqualified, true);
  assert.strictEqual(scoreD.tier, 'Tier 4: Disqualified');
  assert.strictEqual(scoreD.recommendedAction, 'Archive / Ignore');
  assert.ok(scoreD.disqualificationReason !== null);
  assert.ok(scoreD.disqualificationReason?.includes('outside seller target territories'));
});
