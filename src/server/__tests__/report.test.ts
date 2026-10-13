import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_REPORT_MODEL_VERSION,
  sanitizeCsvCell,
  buildProductMix,
  buildPriceMix,
  buildPlaceMix,
  buildPromotionMix,
  buildPeopleMix,
  buildProcessMix,
  buildPhysicalEvidenceMix,
  generateSegment7PsMix,
  generateIntegratedActionPlan,
  composeExecutiveICPReport,
  InMemoryReportRepository,
} from '../reportService';
import {
  analyzeLeadNeedGap,
  aggregateDatasetNeedGaps,
  synthesizeDetailedFiveC,
  type SellerProfileContext,
} from '../strategicAnalysisService';
import { buildDatasetSTPAnalysis } from '../stpService';
import {
  calculateDeterministicICPScore,
  batchScoreLeads,
  DEFAULT_SCORING_WEIGHTS,
} from '../../lib/scoring';
import type { LeadForAnalysis } from '../analysisJobService';
import type { NormalizedLead } from '../../types/lead';
import type { OfferingProfile } from '../../types/offering';
import type {
  DatasetNeedGapSummary,
  DetailedFiveCAnalysis,
  DetailedFiveCDimension,
  DatasetSTPAnalysis,
  ExecutiveICPReport,
} from '../../types/analysis';
import type { LeadICPScore } from '../../types/scoring';

// -----------------------------------------------------------------------------
// STANDARD TEST FIXTURES
// -----------------------------------------------------------------------------

const TEST_SELLER: SellerProfileContext = {
  id: 'seller-rep-01',
  companyName: 'Synthetix Data Cloud',
  website: 'https://synthetix.io',
  productName: 'DataReliability Engine',
  productDescription: 'Autonomous data contract verification and schema drift protection platform.',
  category: 'Enterprise Data Observability',
  valueProposition: 'Eliminates silent data corruption in mission-critical executive pipelines.',
  primaryProblemSolved: 'Silent schema drift causing corrupt executive dashboards',
  keyCapabilities: [
    'Automated schema drift detection',
    'Bidirectional dbt and Snowflake contract sync',
    'Sub-minute incident alert webhooks',
  ],
  typicalACV: '$36,000 / year',
  pricingModel: 'Annual subscription',
  mainAlternatives: 'Manual scripts and spot checking',
  pointOfParity: 'Standard exception alerts, SOC2 Type II, and schema change audit logs',
  pointOfDifference: 'Proactive contract verification before downstream write-time breaks occur',
  primaryBuyer: 'VP of Data & Analytics',
  mainCustomerProblem: 'Data pipelines break silently when upstream microservice schemas change.',
};

const TEST_OFFERING: OfferingProfile = {
  id: 'seller-rep-01',
  companyName: 'Synthetix Data Cloud',
  website: 'https://synthetix.io',
  productName: 'DataReliability Engine',
  category: 'Enterprise Data Observability',
  businessModel: 'B2B SaaS',
  pricingModel: 'Annual Contract Value (ACV)',
  typicalACV: '$36,000 / year',
  valueProposition: 'Eliminates silent data corruption in mission-critical executive pipelines.',
  primaryProblemSolved: 'Silent schema drift causing corrupt executive dashboards',
  keyCapabilities: [
    'Automated schema drift detection',
    'Bidirectional dbt and Snowflake contract sync',
    'Sub-minute incident alert webhooks',
  ],
  buyerPersonas: [
    {
      id: 'p-1',
      title: 'VP of Data & Analytics',
      department: 'Data Engineering',
      seniority: 'VP',
      coreMotivation: 'Zero downstream pipeline downtime',
      primaryFriction: 'Vendor security review and procurement delay',
      hasBudgetAuthority: true,
    },
  ],
  icpHypothesis: {
    targetHeadcount: '100–1,000 FTE',
    targetIndustries: ['FinTech', 'HealthTech', 'E-commerce'],
    targetGeographies: ['United States', 'Canada'],
    criticalTriggerEvents: ['Executive dashboard corruption incident'],
    hypothesisRationale: 'Requires cloud warehouse and dedicated data team.',
    isValidated: false,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createTestLeadForAnalysis(overrides: Partial<LeadForAnalysis> = {}): LeadForAnalysis {
  return {
    id: 'lead-' + Math.random().toString(36).slice(2, 8),
    dataset_id: 'dataset-test-01',
    owner_user_id: 'user-01',
    company_name: 'Test Enterprise Inc',
    normalized_domain: 'testenterprise.com',
    website: 'https://testenterprise.com',
    industry_raw: 'Financial Technology',
    employee_count: 350,
    company_size_raw: '350 employees',
    notes: 'Experiencing silent schema drift in Snowflake data warehouse that breaks executive KPI dashboards weekly.',
    user_corrected_description: null,
    product_raw: 'Fintech Payments Platform',
    analysis_eligible: true,
    analysis_status: 'completed',
    ...overrides,
  };
}

function createTestNormalizedLead(overrides: Partial<NormalizedLead> = {}): NormalizedLead {
  return {
    id: 'lead-' + Math.random().toString(36).slice(2, 8),
    companyName: 'Test Enterprise Inc',
    domain: 'testenterprise.com',
    website: 'https://testenterprise.com',
    industry: 'Financial Technology',
    headcount: 350,
    annualRevenue: null,
    description: 'Experiencing silent schema drift in Snowflake data warehouse that breaks executive KPI dashboards weekly.',
    country: 'United States',
    technologies: ['Snowflake', 'dbt'],
    isClean: true,
    isAiEnriched: true,
    ingestedAt: new Date().toISOString(),
    userCorrectedDescription: null,
    ...overrides,
  };
}

function create20LeadSyntheticCohort(): LeadForAnalysis[] {
  const leads: LeadForAnalysis[] = [];

  // 8 companies sharing Problem Cluster A: Acute schema drift & dashboard corruption
  for (let i = 1; i <= 8; i++) {
    leads.push({
      id: `lead-cluster-a-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `DataCore ${i} FinTech`,
      normalized_domain: `datacore${i}.com`,
      website: `https://datacore${i}.com`,
      industry_raw: 'Financial Technology',
      employee_count: 200 + i * 50,
      company_size_raw: `${200 + i * 50} employees`,
      notes: 'Silent schema drift breaks executive KPI dashboards every week; data engineering team spends 15 hours firefighting.',
      product_raw: 'Payment Settlement API',
      analysis_eligible: true,
      analysis_status: 'completed',
    });
  }

  // 5 companies sharing Problem Cluster B: Data warehouse query cost inflation
  for (let i = 1; i <= 5; i++) {
    leads.push({
      id: `lead-cluster-b-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `CloudScale ${i} Health`,
      normalized_domain: `cloudscale${i}.io`,
      website: `https://cloudscale${i}.io`,
      industry_raw: 'Healthcare Technology',
      employee_count: 150 + i * 40,
      company_size_raw: `${150 + i * 40} employees`,
      notes: 'Cloud data warehouse query spend inflated by redundant table rebuilds; needs cost observability and query optimization.',
      product_raw: 'Patient Data Management',
      analysis_eligible: true,
      analysis_status: 'completed',
    });
  }

  // 7 companies with Insufficient Evidence (<70% data coverage)
  for (let i = 1; i <= 7; i++) {
    leads.push({
      id: `lead-sparse-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `Sparse Account ${i}`,
      normalized_domain: null,
      website: null,
      industry_raw: null,
      employee_count: null,
      company_size_raw: null,
      notes: null,
      user_corrected_description: null,
      product_raw: null,
      analysis_eligible: true,
      analysis_status: 'pending',
    });
  }

  return leads;
}

// -----------------------------------------------------------------------------
// AUTOMATED VERIFICATION SUITE: 25 TESTS
// -----------------------------------------------------------------------------

test('1. Report generation uses correct target dataset', () => {
  const leads = [createTestLeadForAnalysis({ dataset_id: 'dataset-alpha-42' })];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('dataset-alpha-42', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'dataset-alpha-42', summary, fiveC, leads, gapsMap);

  const normalized = leads.map((l) => createTestNormalizedLead({ id: l.id }));
  const scores = batchScoreLeads(normalized, TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'dataset-alpha-42',
    'Alpha_Pipeline_Q3.csv',
    'user-01',
    1,
    summary,
    fiveC,
    stp,
    scores
  );

  assert.strictEqual(report.datasetId, 'dataset-alpha-42');
  assert.strictEqual(report.datasetFilename, 'Alpha_Pipeline_Q3.csv');
  assert.strictEqual(report.id, 'report-dataset-alpha-42');
  assert.ok(report.title.includes('Alpha_Pipeline_Q3.csv'));
});

test('2. Report generation uses correct seller offering profile', () => {
  const leads = [createTestLeadForAnalysis()];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-01', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-01', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads([createTestNormalizedLead({ id: leads[0].id })], TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-01',
    'leads.csv',
    'user-01',
    1,
    summary,
    fiveC,
    stp,
    scores
  );

  assert.strictEqual(report.sellerOfferingId, TEST_SELLER.id);
  assert.strictEqual(report.sellerCompanyName, TEST_SELLER.companyName);
  assert.strictEqual(report.sellerProductName, TEST_SELLER.productName);
  assert.ok(report.executiveThesis.problemAddressed.includes(TEST_SELLER.primaryProblemSolved || ''));
});

test('3. Cross-tenant access is rejected', async () => {
  const repo = new InMemoryReportRepository();
  repo.setDatasetOwner('dataset-tenant-a', 'user-tenant-a');

  // Tenant B attempting to access Tenant A's dataset
  await assert.rejects(
    async () => {
      await repo.assertOwnedDataset('user-tenant-b', 'dataset-tenant-a');
    },
    /not found or not owned/i
  );
});

test('4. Need Gap analysis results are preserved in Section B without re-inventing data', () => {
  const leads = [
    createTestLeadForAnalysis({ id: 'l-1', notes: 'Silent schema drift breaks executive dashboard' }),
    createTestLeadForAnalysis({ id: 'l-2', notes: 'Routine data warehouse migration questions' }),
  ];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-01', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-01', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads(leads.map((l) => createTestNormalizedLead({ id: l.id })), TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-01',
    'leads.csv',
    'user-01',
    2,
    summary,
    fiveC,
    stp,
    scores
  );

  assert.strictEqual(report.needGapSummary.datasetId, summary.datasetId);
  assert.strictEqual(report.needGapSummary.totalLeads, summary.totalLeads);
  assert.strictEqual(report.needGapSummary.analyzedLeadsCount, summary.analyzedLeadsCount);
  assert.strictEqual(report.needGapSummary.insufficientEvidenceCount, summary.insufficientEvidenceCount);
});

test('5. All five Cs appear correctly in Section C', () => {
  const leads = [createTestLeadForAnalysis()];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-01', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-01', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads([createTestNormalizedLead({ id: leads[0].id })], TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-01',
    'leads.csv',
    'user-01',
    1,
    summary,
    fiveC,
    stp,
    scores
  );

  assert.ok(report.fiveCAnalysis.company);
  assert.ok(report.fiveCAnalysis.customers);
  assert.ok(report.fiveCAnalysis.competitors);
  assert.ok(report.fiveCAnalysis.collaborators);
  assert.ok(report.fiveCAnalysis.context);
  assert.ok(report.fiveCAnalysis.customers.strategicImplications || report.fiveCAnalysis.customers.mainObservations.length > 0);
});

test('6. Segment counts match stored data without duplicate counting', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-20', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads(leads.map((l) => createTestNormalizedLead({ id: l.id })), TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-20',
    'synthetic20.csv',
    'user-01',
    20,
    summary,
    fiveC,
    stp,
    scores
  );

  // Collect all company IDs assigned across segments
  const allAssignedIds = report.stpAnalysis.segments.flatMap((s) => s.primaryCompanyIds || []);
  const uniqueAssignedIds = new Set(allAssignedIds);

  // Invariant: No duplicate assignments across segments
  assert.strictEqual(allAssignedIds.length, uniqueAssignedIds.size, 'No account should be counted in multiple segments');
  assert.strictEqual(report.summaryMetrics.totalAnalyzed, 20);
});

test('7. Targeting conclusions reflect STP', () => {
  const leads = create20LeadSyntheticCohort();
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-20', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads(leads.map((l) => createTestNormalizedLead({ id: l.id })), TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-20',
    'synthetic20.csv',
    'user-01',
    20,
    summary,
    fiveC,
    stp,
    scores
  );

  // Executive thesis recommended segment should match top segment
  assert.strictEqual(report.executiveThesis.recommendedSegmentName, report.stpAnalysis.segments[0].name);
  assert.ok(Object.keys(report.stpAnalysis.targetingAssessments).length > 0);
  assert.ok(report.stpAnalysis.overallTargetingRecommendation.summary);
});

test('8. Positioning comes from saved analysis', () => {
  const leads = [createTestLeadForAnalysis()];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-01', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-01', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads([createTestNormalizedLead({ id: leads[0].id })], TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-01',
    'leads.csv',
    'user-01',
    1,
    summary,
    fiveC,
    stp,
    scores
  );

  const posKeys = Object.keys(report.stpAnalysis.positioningRecommendations);
  assert.ok(posKeys.length > 0);
  const pos = report.stpAnalysis.positioningRecommendations[posKeys[0]];
  assert.ok(pos.categoryPointOfParity);
  assert.ok(pos.pointOfDifference);
  assert.ok(pos.reasonsToBelieve.length > 0);
  assert.ok(pos.positioningStatement.length > 0);
});

test('9. Existing scoring weights and formula are unchanged', () => {
  assert.strictEqual(DEFAULT_SCORING_WEIGHTS.needUrgencyWeight, 0.35);
  assert.strictEqual(DEFAULT_SCORING_WEIGHTS.capabilityMatchWeight, 0.25);
  assert.strictEqual(DEFAULT_SCORING_WEIGHTS.stakeholderFeasibilityWeight, 0.20);
  assert.strictEqual(DEFAULT_SCORING_WEIGHTS.firmographicAlignmentWeight, 0.20);

  const total =
    DEFAULT_SCORING_WEIGHTS.needUrgencyWeight +
    DEFAULT_SCORING_WEIGHTS.capabilityMatchWeight +
    DEFAULT_SCORING_WEIGHTS.stakeholderFeasibilityWeight +
    DEFAULT_SCORING_WEIGHTS.firmographicAlignmentWeight;
  assert.strictEqual(Math.round(total * 100), 100);
});

test('10. Score tier and evidence coverage are displayed for all leads', () => {
  const leads = [
    createTestNormalizedLead({ id: 'lead-1', companyName: 'Complete Tech', headcount: 300 }),
    createTestNormalizedLead({ id: 'lead-2', companyName: 'Sparse Corp', domain: null, headcount: null, description: '' }),
  ];

  const scores = batchScoreLeads(leads, TEST_OFFERING);

  for (const score of scores) {
    assert.ok(score.tier);
    assert.ok(score.evidenceCoverage !== undefined && score.evidenceCoverage >= 0 && score.evidenceCoverage <= 100);
  }
});

test('11. Low fit versus disqualification is clearly distinguished', () => {
  // A lead with low score (<45)
  const lowFitLead = createTestNormalizedLead({
    id: 'lead-low-01',
    companyName: 'Unrelated Sole Proprietor',
    industry: 'Lawn Care',
    headcount: 2,
    description: 'Local residential lawn care service.',
    technologies: [],
  });

  const lowFitScore = calculateDeterministicICPScore(lowFitLead, TEST_OFFERING);
  assert.strictEqual(lowFitScore.isDisqualified, false, 'Eligible account with low score is not automatically hard-disqualified');

  // A lead with an explicit disqualification constraint (e.g. excluded geography)
  const disqualifiedLead = createTestNormalizedLead({
    id: 'lead-disq-01',
    companyName: 'Foreign Entity',
    country: 'Antarctica',
  });

  const disqualifiedScore = calculateDeterministicICPScore(disqualifiedLead, TEST_OFFERING, undefined, undefined, {
    strictDisqualification: true,
    excludedGeographies: ['Antarctica'],
  });

  assert.strictEqual(disqualifiedScore.isDisqualified, true);
  assert.ok(disqualifiedScore.disqualificationReason);
  assert.strictEqual(disqualifiedScore.tier, 'Tier 4: Disqualified');
});

test('12. CRM status does not become invented intent', () => {
  const leadWithCrm = createTestNormalizedLead({
    id: 'lead-crm-stage-01',
    companyName: 'Pipeline Prospect',
  });

  // Score without closed-won proof
  const score = calculateDeterministicICPScore(leadWithCrm, TEST_OFFERING);
  assert.strictEqual(score.intentLabel, 'BUYING INTENT: UNKNOWN');
});

test('13. All seven marketing Ps are present in generated marketing mix', () => {
  const mix = generateSegment7PsMix(
    TEST_SELLER,
    'seg-01',
    'Enterprise Data Engineering Teams',
    'Silent schema drift in Snowflake data pipelines',
    'Autonomous continuous contract verification',
    'VP of Data & Analytics'
  );

  assert.ok(mix.product, 'Product mix must be present');
  assert.ok(mix.price, 'Price mix must be present');
  assert.ok(mix.place, 'Place mix must be present');
  assert.ok(mix.promotion, 'Promotion mix must be present');
  assert.ok(mix.people, 'People mix must be present');
  assert.ok(mix.process, 'Process mix must be present');
  assert.ok(mix.physicalEvidence, 'Physical evidence mix must be present');
});

test('14. Product capabilities reflect seller profile and marks roadmap as [PROPOSED]', () => {
  const productMix = buildProductMix(
    TEST_SELLER,
    'Enterprise Segment',
    'Schema breaks',
    'Pipeline uptime'
  );

  const existingCapabilities = productMix.fabMapping.filter((f) => f.isExisting);
  const proposedCapabilities = productMix.fabMapping.filter((f) => !f.isExisting);

  assert.ok(existingCapabilities.length >= 2, 'Should map existing seller capabilities');
  assert.ok(proposedCapabilities.length >= 1, 'Should include proposed capabilities');
  for (const proposed of proposedCapabilities) {
    assert.ok(proposed.feature.startsWith('[PROPOSED]'), 'Proposed features must start with [PROPOSED]');
  }
});

test('15. Unknown pricing remains unknown (PROVISIONAL / RESEARCH REQUIRED)', () => {
  // Case A: Seller without pricing notes -> completely unknown
  const sellerWithoutPricing: SellerProfileContext = {
    ...TEST_SELLER,
    typicalACV: '',
    pricingModel: '',
  };
  const priceMixUnknown = buildPriceMix(sellerWithoutPricing, 'Enterprise Segment');

  assert.strictEqual(priceMixUnknown.isPricePointKnown, false);
  assert.ok(priceMixUnknown.recommendedPricePoint.includes('RESEARCH REQUIRED') && priceMixUnknown.recommendedPricePoint.includes('PROVISIONAL'));
  assert.ok(priceMixUnknown.monetaryCosts.includes('PROVISIONAL'));
  assert.ok(priceMixUnknown.recommendedPricingResearch.length >= 3);

  // Case B: Seller with indicative pricing -> treated as hypothesis needing ROI validation
  const priceMixKnown = buildPriceMix(TEST_SELLER, 'Enterprise Segment');
  assert.strictEqual(priceMixKnown.isPricePointKnown, true);
  assert.ok(priceMixKnown.recommendedPricePoint.includes('Validate against buyer ROI threshold'));
});

test('16. Place mix captures direct/indirect channel requirements and identifies integration risks', () => {
  const placeMix = buildPlaceMix(TEST_SELLER, 'Enterprise Segment');

  assert.ok(placeMix.customerTouchpoints.length > 0);
  assert.ok(placeMix.implementationRequirements.length > 0);
  assert.ok(placeMix.channelRisks.length > 0);
});

test('17. Promotion mix aligns with 5-stage buyer decision journey and includes structured drafts', () => {
  const promotionMix = buildPromotionMix(
    TEST_SELLER,
    'Enterprise Segment',
    'Silent schema drift',
    'Guaranteed contract validation',
    'VP of Data & Analytics'
  );

  assert.ok(promotionMix.decisionJourney.needRecognition);
  assert.ok(promotionMix.decisionJourney.searchForAlternatives);
  assert.ok(promotionMix.decisionJourney.evaluationOfOptions);
  assert.ok(promotionMix.decisionJourney.purchaseAdoption);
  assert.ok(promotionMix.decisionJourney.postPurchaseEvaluation);

  assert.ok(promotionMix.sampleDrafts.headline);
  assert.ok(promotionMix.sampleDrafts.outreachAngle.includes('{{Company}}') || promotionMix.sampleDrafts.outreachAngle.includes('{{FirstName}}'));
  assert.ok(promotionMix.sampleDrafts.discoveryQuestion);
  assert.ok(promotionMix.sampleDrafts.callToAction);
});

test('18. Physical evidence mix labels missing proof assets as PROOF ASSET REQUIRED', () => {
  const physicalMix = buildPhysicalEvidenceMix(TEST_SELLER, 'Enterprise Segment');

  assert.ok(physicalMix.proofAssetsRequired.length > 0);
  for (const proof of physicalMix.proofAssetsRequired) {
    assert.ok(proof.includes('PROOF ASSET REQUIRED'), 'Unverified proof items must be labeled PROOF ASSET REQUIRED');
  }
});

test('19. Action plan links to segment and evidence', () => {
  const leads = [createTestLeadForAnalysis()];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-01', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-01', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads([createTestNormalizedLead({ id: leads[0].id })], TEST_OFFERING);

  const plan = generateIntegratedActionPlan(TEST_SELLER, stp, scores);

  assert.ok(plan.immediate.length > 0);
  assert.ok(plan.next.length > 0);
  assert.ok(plan.later.length > 0);
  assert.ok(plan.whatToValidateFirst.length > 0);

  for (const item of plan.immediate) {
    assert.ok(item.linkedSegmentId);
    assert.ok(item.linkedNeedGap);
    assert.ok(item.fiveCConsideration);
    assert.ok(item.marketingMixDimension);
    assert.ok(['high', 'medium', 'low'].includes(item.evidenceConfidence));
  }
});

test('20. Missing or partial upstream analysis handled gracefully', () => {
  // Empty STP analysis fallback
  const fallbackStp: DatasetSTPAnalysis = {
    datasetId: 'ds-empty',
    ownerUserId: 'user-01',
    sellerOfferingId: 'seller-01',
    totalAnalyzed: 0,
    candidateSegmentsCount: 0,
    insufficientEvidenceCount: 0,
    insufficientEvidenceCompanyIds: [],
    segments: [],
    memberships: {},
    targetingAssessments: {},
    positioningRecommendations: {},
    overallTargetingRecommendation: {
      recommendedSegmentId: null,
      summary: 'Fallback narrative',
      isProvisional: true,
    },
    generatedAt: new Date().toISOString(),
    versionFingerprint: 'v1',
  };

  const emptySummary: DatasetNeedGapSummary = {
    datasetId: 'ds-empty',
    totalLeads: 0,
    analyzedLeadsCount: 0,
    insufficientEvidenceCount: 0,
    insufficientEvidenceLeadIds: [],
    topNeedPatterns: [],
    commonHypothesizedProblems: [],
    matchingSellerBenefits: [],
    missingInformationSummary: [],
    generatedAt: new Date().toISOString(),
  };

  const createEmptyDimension = (title: string): DetailedFiveCDimension => ({
    title,
    targetEntity: 'seller',
    mainObservations: ['No data'],
    evidence: [],
    potentialOpportunity: 'None identified',
    potentialRisk: 'None identified',
    missingInformation: ['All observations'],
    confidence: 'low',
    strategicImplications: 'Preliminary analysis required',
    researchRequired: true,
  });

  const emptyFiveC: DetailedFiveCAnalysis = {
    analyzedAt: new Date().toISOString(),
    company: createEmptyDimension('Company'),
    customers: createEmptyDimension('Customers'),
    competitors: createEmptyDimension('Competitors'),
    collaborators: createEmptyDimension('Collaborators'),
    context: createEmptyDimension('Context'),
  };

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-empty',
    'empty.csv',
    'user-01',
    0,
    emptySummary,
    emptyFiveC,
    fallbackStp,
    []
  );

  assert.ok(report);
  assert.strictEqual(report.summaryMetrics.totalAnalyzed, 0);
  assert.ok(report.executiveThesis.relevanceRationale);
});

test('21. Report caching works in repository', async () => {
  const repo = new InMemoryReportRepository();
  const leads = [createTestLeadForAnalysis()];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-cache', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-cache', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads([createTestNormalizedLead({ id: leads[0].id })], TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-cache',
    'cache.csv',
    'user-01',
    1,
    summary,
    fiveC,
    stp,
    scores
  );

  await repo.saveReport('user-01', 'ds-cache', report);
  const retrieved = await repo.getReport('user-01', 'ds-cache');

  assert.ok(retrieved);
  assert.strictEqual(retrieved.versionFingerprint, report.versionFingerprint);
  assert.strictEqual(retrieved.id, report.id);
});

test('22. Report refresh updates version fingerprint when source changes', () => {
  const leads = [createTestLeadForAnalysis({ id: 'lead-v1' })];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-refresh', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-refresh', summary, fiveC, leads, gapsMap);
  const scores1 = batchScoreLeads([createTestNormalizedLead({ id: 'lead-v1' })], TEST_OFFERING);

  const report1 = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-refresh',
    'refresh.csv',
    'user-01',
    1,
    summary,
    fiveC,
    stp,
    scores1
  );

  // Add 2 more leads to simulate refreshed dataset
  const scores2 = batchScoreLeads([
    createTestNormalizedLead({ id: 'lead-v1' }),
    createTestNormalizedLead({ id: 'lead-v2' }),
    createTestNormalizedLead({ id: 'lead-v3' }),
  ], TEST_OFFERING);

  const report2 = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-refresh',
    'refresh.csv',
    'user-01',
    3,
    summary,
    fiveC,
    stp,
    scores2
  );

  assert.notStrictEqual(report1.versionFingerprint, report2.versionFingerprint);
  assert.strictEqual(report2.summaryMetrics.totalAnalyzed, 3);
});

test('23. Demo report generation works via InMemoryReportRepository', async () => {
  const repo = new InMemoryReportRepository();
  repo.setDatasetOwner('demo-ds', 'demo-user');

  await assert.doesNotReject(async () => {
    await repo.assertOwnedDataset('demo-user', 'demo-ds');
  });

  const emptyReport = await repo.getReport('demo-user', 'demo-ds');
  assert.strictEqual(emptyReport, null);
});

test('24. CSV formula injection is prevented', () => {
  // Test formula injection characters: =, +, -, @, \t, \r
  const equalsInjection = sanitizeCsvCell('=1+1');
  assert.strictEqual(equalsInjection, `"'=1+1"`);

  const plusInjection = sanitizeCsvCell('+SUM(A1:A10)');
  assert.strictEqual(plusInjection, `"'+SUM(A1:A10)"`);

  const minusInjection = sanitizeCsvCell('-100');
  assert.strictEqual(minusInjection, `"'-100"`);

  const atInjection = sanitizeCsvCell('@evil');
  assert.strictEqual(atInjection, `"'@evil"`);

  const tabInjection = sanitizeCsvCell('\tcmd|');
  assert.strictEqual(tabInjection, `"'\tcmd|"`);

  // Safe strings should be properly escaped with double quotes
  const safeString = sanitizeCsvCell('Synthetix Data Cloud');
  assert.strictEqual(safeString, `"Synthetix Data Cloud"`);

  // Quotes inside values are doubled
  const quoteString = sanitizeCsvCell('Data "Cloud" Systems');
  assert.strictEqual(quoteString, `"Data ""Cloud"" Systems"`);

  // Null/undefined values return empty quotes
  assert.strictEqual(sanitizeCsvCell(null), `""`);
  assert.strictEqual(sanitizeCsvCell(undefined), `""`);
});

test('25. Mandatory 20-company synthetic benchmark scenario', () => {
  const leads = create20LeadSyntheticCohort();
  assert.strictEqual(leads.length, 20);

  // 1. Need Gap & 5C Analysis
  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-synthetic-20', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

  // 2. STP Segmentation
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-synthetic-20', summary, fiveC, leads, gapsMap);

  // 3. Normalized Leads & Deterministic Scoring
  const normalizedLeads: NormalizedLead[] = leads.map((l) => ({
    id: l.id,
    companyName: l.company_name,
    domain: l.normalized_domain ?? null,
    website: l.website ?? null,
    industry: l.industry_raw || '',
    headcount: l.employee_count ?? null,
    annualRevenue: null,
    description: l.notes || '',
    country: 'United States',
    technologies: l.id.includes('cluster-a') ? ['Snowflake', 'dbt'] : [],
    isClean: true,
    isAiEnriched: !l.id.includes('sparse'),
    ingestedAt: new Date().toISOString(),
    userCorrectedDescription: null,
  }));

  const scores = batchScoreLeads(normalizedLeads, TEST_OFFERING, undefined, undefined, {
    fiveC,
    segments: stp.segments,
  });

  // 4. Compose Executive ICP Report
  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-synthetic-20',
    'synthetic_20_pipeline.csv',
    'user-01',
    20,
    summary,
    fiveC,
    stp,
    scores
  );

  // VERIFICATION OF BENCHMARK INVARIANTS:
  // (a) Cohort totals
  assert.strictEqual(report.summaryMetrics.totalUploaded, 20);
  assert.strictEqual(report.summaryMetrics.totalAnalyzed, 20);

  // (b) Problem Cluster A (8 accounts) should be segregated from Problem Cluster B (5 accounts)
  const clusterALeads = report.scoredLeads.filter((s) => s.leadId.includes('cluster-a'));
  const clusterBLeads = report.scoredLeads.filter((s) => s.leadId.includes('cluster-b'));
  const sparseLeads = report.scoredLeads.filter((s) => s.leadId.includes('sparse'));

  assert.strictEqual(clusterALeads.length, 8, 'Must have exactly 8 accounts in Cluster A');
  assert.strictEqual(clusterBLeads.length, 5, 'Must have exactly 5 accounts in Cluster B');
  assert.strictEqual(sparseLeads.length, 7, 'Must have exactly 7 sparse accounts');

  // Cluster A has acute need & matching stack -> High average score
  const clusterAAvg = clusterALeads.reduce((acc, s) => acc + s.totalScore, 0) / clusterALeads.length;
  assert.ok(clusterAAvg >= 65, 'Cluster A accounts must average moderate to high fit scores');

  // (c) 7 Sparse accounts must have < 70% evidence coverage
  for (const sparse of sparseLeads) {
    assert.ok((sparse.evidenceCoverage ?? 0) < 70, `Sparse account ${sparse.leadId} must have <70% evidence coverage`);
    assert.strictEqual(sparse.isInsufficientEvidence, true, 'Sparse account must be flagged as insufficient evidence');
  }
  assert.strictEqual(report.summaryMetrics.insufficientEvidenceCount, 7);

  // (d) No double counting across segments
  const assignedIds = report.stpAnalysis.segments.flatMap((s) => s.primaryCompanyIds || []);
  const uniqueIds = new Set(assignedIds);
  assert.strictEqual(assignedIds.length, uniqueIds.size, 'No account may appear in multiple primary segments');

  // (e) Governance Notice
  assert.strictEqual(report.isProvisionalHypothesis, true);
  assert.strictEqual(report.governanceClassification, 'PROVISIONAL ICP HYPOTHESIS');
  assert.ok(report.evidenceLimitations.statutoryNotice.includes('ICP Hypothesis'));

  // (f) 7Ps Marketing Mix generated for segments
  assert.ok(Object.keys(report.marketingMixBySegment).length >= 1);
  for (const segId of Object.keys(report.marketingMixBySegment)) {
    const mix = report.marketingMixBySegment[segId];
    assert.ok(mix.product);
    assert.ok(mix.price);
    assert.ok(mix.place);
    assert.ok(mix.promotion);
    assert.ok(mix.people);
    assert.ok(mix.process);
    assert.ok(mix.physicalEvidence);
  }
});

test('26. Customer deal outcomes produce CUSTOMER-BACKED ICP HYPOTHESIS without claiming premature statistical validation', () => {
  const leads: LeadForAnalysis[] = [
    {
      ...createTestLeadForAnalysis({ id: 'won-1', company_name: 'Acme Won' }),
      raw_row: {
        lead_status: 'won',
        deal_value: 50000,
      },
    },
    {
      ...createTestLeadForAnalysis({ id: 'lost-1', company_name: 'Beta Lost' }),
      raw_row: {
        lead_status: 'lost',
      },
    },
  ];

  const needGaps = leads.map((l) => analyzeLeadNeedGap(TEST_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-deals', needGaps, TEST_SELLER);
  const fiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
  const stp = buildDatasetSTPAnalysis(TEST_SELLER, 'ds-deals', summary, fiveC, leads, gapsMap);
  const scores = batchScoreLeads(leads.map((l) => createTestNormalizedLead({ id: l.id })), TEST_OFFERING);

  const report = composeExecutiveICPReport(
    TEST_SELLER,
    'ds-deals',
    'deals.csv',
    'user-01',
    2,
    summary,
    fiveC,
    stp,
    scores
  );

  // Must NOT claim statistically validated
  assert.strictEqual(report.isProvisionalHypothesis, true, 'isProvisionalHypothesis must remain true');
  assert.ok(
    report.governanceClassification.includes('CUSTOMER-BACKED ICP HYPOTHESIS'),
    'Governance classification must reflect customer-backed hypothesis'
  );
  assert.ok(
    !report.governanceClassification.includes('STATISTICALLY VALIDATED'),
    'Must NOT state STATISTICALLY VALIDATED without longitudinal statistical power'
  );
});

test('27. Unverified regulatory compliance drivers are marked POTENTIAL CONTEXT — RESEARCH REQUIRED', () => {
  const unverifiedSeller: SellerProfileContext = {
    ...TEST_SELLER,
    pointOfParity: 'Standard exception alerts and schema change audit logs',
  };
  const leads: LeadForAnalysis[] = [createTestLeadForAnalysis()];
  const needGaps = leads.map((l) => analyzeLeadNeedGap(unverifiedSeller, l));
  const fiveC = synthesizeDetailedFiveC(unverifiedSeller, needGaps, leads);

  assert.ok(
    fiveC.context.mainObservations.some((obs) =>
      obs.includes('POTENTIAL CONTEXT — RESEARCH REQUIRED')
    ),
    'Unverified regulatory constraints must be flagged as POTENTIAL CONTEXT — RESEARCH REQUIRED'
  );

  // When verified compliance is present (e.g. SOC2 Type II in TEST_SELLER), only substantiated regulations are claimed
  const verifiedFiveC = synthesizeDetailedFiveC(TEST_SELLER, needGaps, leads);
  assert.ok(
    verifiedFiveC.context.mainObservations.some((obs) => obs.includes('SOC2 Type II')),
    'Substantiated regulation must be noted'
  );
  assert.ok(
    !verifiedFiveC.context.mainObservations.some((obs) => obs.includes('HIPAA')),
    'Unverified regulations like HIPAA must NOT be claimed'
  );
});
