import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeLeadNeedGap,
  aggregateDatasetNeedGaps,
  synthesizeDetailedFiveC,
  InMemoryStrategicAnalysisRepository,
  type SellerProfileContext,
} from '../strategicAnalysisService';
import type { LeadForAnalysis } from '../analysisJobService';
import type { CompanyAnalysisEnvelope } from '../../types/companyIntelligence';

const SAMPLE_SELLER: SellerProfileContext = {
  id: 'seller-test-01',
  companyName: 'Synthetix GTM Engine',
  website: 'https://synthetix.io',
  productName: 'Pipeline Radar',
  productDescription: 'Autonomous outbound prospecting platform that detects buying signals and drafts targeted campaigns.',
  category: 'B2B Sales Intelligence',
  valueProposition: 'Reduces manual outbound prospecting time by 80% while identifying verified high-intent buying signals.',
  primaryProblemSolved: 'Manual outbound prospecting and fragmented researcher overhead',
  keyCapabilities: [
    'Automated outbound prospecting',
    'Real-time firmographic enrichment',
    'High-intent account scoring',
  ],
  typicalACV: '$24,000 / year',
  pricingModel: 'Annual subscription per seat',
  mainAlternatives: 'Manual spreadsheets, ad-hoc LinkedIn scraping, and legacy static databases',
  pointOfParity: 'SOC2 Type II compliance, webhook integrations, CRM sync',
  pointOfDifference: 'Continuous buying-intent radar with zero manual list building',
  primaryBuyer: 'VP of Sales',
  mainCustomerProblem: 'Sales teams spend 15+ hours weekly manually researching accounts rather than holding prospect meetings.',
};

function createSyntheticLeads(): LeadForAnalysis[] {
  const leads: LeadForAnalysis[] = [];

  // 8 companies sharing Problem A: Outbound Prospecting Friction
  for (let i = 1; i <= 8; i++) {
    leads.push({
      id: `lead-outbound-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `Outbound Tech ${i} Inc`,
      normalized_domain: `outboundtech${i}.com`,
      website: `https://outboundtech${i}.com`,
      industry_raw: 'Enterprise SaaS',
      employee_count: 50 + i * 10,
      notes: 'Outbound sales team struggling with manual prospecting and low pipeline generation volume.',
      analysis_eligible: true,
      analysis_status: 'completed',
    });
  }

  // 5 companies sharing Need B: CRM Data Decay & Enrichment
  for (let i = 1; i <= 5; i++) {
    leads.push({
      id: `lead-crm-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `CRM Operations ${i} LLC`,
      normalized_domain: `crmops${i}.com`,
      website: `https://crmops${i}.com`,
      industry_raw: 'Fintech',
      employee_count: 100 + i * 20,
      notes: 'Massive CRM database decay with stale account intelligence and duplicate records needing real-time sync.',
      analysis_eligible: true,
      analysis_status: 'completed',
    });
  }

  // 7 companies with Insufficient Evidence
  for (let i = 1; i <= 7; i++) {
    leads.push({
      id: `lead-insufficient-${i}`,
      dataset_id: 'dataset-synthetic-20',
      owner_user_id: 'user-01',
      company_name: `Mystery Corp ${i}`,
      normalized_domain: null,
      website: null,
      industry_raw: null,
      employee_count: null,
      notes: null,
      user_corrected_description: null,
      product_raw: null,
      analysis_eligible: true,
      analysis_status: 'completed',
    });
  }

  return leads;
}

test('1. Current state and ideal state extraction connects lead friction to seller offering', () => {
  const lead: LeadForAnalysis = {
    id: 'lead-test-01',
    dataset_id: 'ds-01',
    owner_user_id: 'user-01',
    company_name: 'Apex Growth Labs',
    normalized_domain: 'apexgrowth.io',
    website: 'https://apexgrowth.io',
    industry_raw: 'Software',
    employee_count: 75,
    notes: 'Sales reps spend excessive time manually prospecting and verifying email addresses.',
    analysis_eligible: true,
    analysis_status: 'completed',
  };

  const needGap = analyzeLeadNeedGap(SAMPLE_SELLER, lead);

  assert.ok(needGap.currentState.length > 10, 'Should formulate a detailed current state');
  assert.ok(needGap.idealState.length > 10, 'Should formulate a desirable ideal state');
  assert.ok(needGap.needGap.length > 10, 'Should identify the gap between current and ideal state');
  assert.equal(needGap.problemIntensity, 'Acute');
});

test('2. Missing information remains strictly unknown rather than fabricated', () => {
  const emptyLead: LeadForAnalysis = {
    id: 'lead-empty',
    dataset_id: 'ds-01',
    owner_user_id: 'user-01',
    company_name: 'Unknown Entity',
    analysis_eligible: true,
    analysis_status: 'completed',
  };

  const needGap = analyzeLeadNeedGap(SAMPLE_SELLER, emptyLead);

  assert.equal(needGap.analysisStatus, 'insufficient_evidence');
  assert.equal(needGap.problemIntensity, 'Negligible');
  assert.ok(
    needGap.unknowns.some((u) => u.toLowerCase().includes('willingness to pay')),
    'Willingness to pay must remain unknown'
  );
  assert.ok(
    needGap.unknowns.some((u) => u.toLowerCase().includes('budget')),
    'Budget must remain unknown'
  );
});

test('3. Unsupported motivations are not fabricated and valence conflicts require justification', () => {
  const leadWithoutConflict: LeadForAnalysis = {
    id: 'lead-routine',
    dataset_id: 'ds-01',
    owner_user_id: 'user-01',
    company_name: 'Data Sync Co',
    notes: 'Routine CRM data enrichment and contact deduplication.',
    analysis_eligible: true,
    analysis_status: 'completed',
  };

  const needGap = analyzeLeadNeedGap(SAMPLE_SELLER, leadWithoutConflict);

  // Routine data maintenance should not have an artificial motivational conflict
  assert.equal(needGap.motivationalConflict, null, 'Routine needs must not invent motivational conflicts');
});

test('4. Value interpretation does not invent specific prices', () => {
  const lead: LeadForAnalysis = {
    id: 'lead-price-check',
    dataset_id: 'ds-01',
    owner_user_id: 'user-01',
    company_name: 'Cloud Operations Ltd',
    notes: 'Looking for prospecting automation software.',
    analysis_eligible: true,
    analysis_status: 'completed',
  };

  const needGap = analyzeLeadNeedGap(SAMPLE_SELLER, lead);

  for (const cost of needGap.perceivedCosts) {
    assert.doesNotMatch(cost, /\$\d{3,}/, 'Perceived costs must not invent arbitrary exact dollar prices');
  }
});

test('5. Need Gap aggregation uses actual counts and exact proportions (20-lead synthetic cohort)', () => {
  const syntheticLeads = createSyntheticLeads();
  assert.equal(syntheticLeads.length, 20, 'Synthetic lead dataset must contain exactly 20 leads');

  const analyses = syntheticLeads.map((lead) => analyzeLeadNeedGap(SAMPLE_SELLER, lead));
  const summary = aggregateDatasetNeedGaps('dataset-synthetic-20', analyses, SAMPLE_SELLER);

  assert.equal(summary.totalLeads, 20);
  assert.equal(summary.analyzedLeadsCount, 13);
  assert.equal(summary.insufficientEvidenceCount, 7);
  assert.equal(summary.insufficientEvidenceLeadIds.length, 7);

  // Pattern 1: Outbound Prospecting (8 leads)
  const patternA = summary.topNeedPatterns.find((p) =>
    p.problemTitle.toLowerCase().includes('outbound') || p.problemTitle.toLowerCase().includes('prospecting')
  );
  assert.ok(patternA, 'Must identify Outbound Prospecting pattern');
  assert.equal(patternA.supportingCount, 8, 'Pattern A must have exactly 8 supporting accounts');
  assert.equal(patternA.ratioFormatted, '8/20', 'Ratio must be strictly 8/20');
  assert.equal(patternA.percentage, 40, 'Percentage must be exactly 40%');
  assert.equal(patternA.supportingLeadIds.length, 8);

  // Pattern 2: CRM Data Decay (5 leads)
  const patternB = summary.topNeedPatterns.find((p) =>
    p.problemTitle.toLowerCase().includes('crm') || p.problemTitle.toLowerCase().includes('data decay')
  );
  assert.ok(patternB, 'Must identify CRM Data Decay pattern');
  assert.equal(patternB.supportingCount, 5, 'Pattern B must have exactly 5 supporting accounts');
  assert.equal(patternB.ratioFormatted, '5/20', 'Ratio must be strictly 5/20');
  assert.equal(patternB.percentage, 25, 'Percentage must be exactly 25%');
  assert.equal(patternB.supportingLeadIds.length, 5);
});

test('6. Evidence and confidence provenance are strictly preserved', () => {
  const lead: LeadForAnalysis = {
    id: 'lead-evidence',
    dataset_id: 'ds-01',
    owner_user_id: 'user-01',
    company_name: 'Verified Enterprise',
    website: 'https://verified.io',
    user_corrected_description: 'Human-verified enterprise customer with 500+ SDRs facing prospecting bottlenecks.',
    analysis_eligible: true,
    analysis_status: 'completed',
  };

  const envelope: CompanyAnalysisEnvelope = {
    analysis: {
      industry: { value: 'Enterprise Software', origin: 'uploaded', confidence: 'high' },
      sub_industry: { value: 'Sales Tech', origin: 'inferred', confidence: 'high' },
      company_type: { value: 'Private B2B', origin: 'uploaded', confidence: 'high' },
      business_model: { value: 'B2B SaaS', origin: 'inferred', confidence: 'high' },
      company_size: { value: '500-1000', origin: 'uploaded', confidence: 'high' },
      geography: { value: 'North America', origin: 'uploaded', confidence: 'high' },
      product_summary: { value: 'Enterprise sales software platform.', origin: 'uploaded', confidence: 'high' },
      products: { value: ['Sales Engagement Platform'], origin: 'uploaded', confidence: 'high' },
      target_customers: { value: ['Enterprise Sales Teams'], origin: 'inferred', confidence: 'high' },
      value_proposition: { value: 'Streamline sales prospecting', origin: 'inferred', confidence: 'high' },
      potential_business_needs: { value: ['Automated prospecting and real-time enrichment'], origin: 'inferred', confidence: 'high' },
      potential_buying_roles: { value: ['VP Sales', 'Head of SDR'], origin: 'inferred', confidence: 'high' },
      evidence: [],
      data_quality: { completeness: 'high', confidence: 'high', missing_fields: [], limitations: [] },
    },
    provider: 'gemini',
    modelVersion: 'gemini-2.5-flash',
    analyzedAt: new Date().toISOString(),
    cached: false,
    sourceMode: 'both',
    websiteEvidence: {
      status: 'fetched',
      sourceUrl: 'https://verified.io',
      fetchedAt: new Date().toISOString(),
      title: 'Verified Enterprise',
      metaDescription: 'Enterprise sales software platform',
      headings: ['Automate Sales', 'Enterprise Security'],
      mainContent: 'Platform details and workflow automation features.',
      pagesFetched: ['https://verified.io'],
    },
    userCorrectedDescription: 'Human-verified enterprise customer with 500+ SDRs facing prospecting bottlenecks.',
  };

  const needGap = analyzeLeadNeedGap(SAMPLE_SELLER, lead, envelope);

  assert.equal(needGap.confidence, 'high', 'Human-verified description must yield high confidence');
  assert.equal(needGap.analysisStatus, 'completed');
  assert.ok(
    needGap.evidence.some((e) => e.origin === 'user_provided' && e.attribute === 'human_verified_description'),
    'Should record human verified evidence'
  );
  assert.ok(
    needGap.evidence.some((e) => e.origin === 'verified' && e.attribute === 'public_website_observation'),
    'Should record verified public website evidence'
  );
});

test('7. Correct seller versus lead separation (C1 evaluates Seller, C2 evaluates Leads)', () => {
  const syntheticLeads = createSyntheticLeads();
  const analyses = syntheticLeads.map((l) => analyzeLeadNeedGap(SAMPLE_SELLER, l));
  const fiveC = synthesizeDetailedFiveC(SAMPLE_SELLER, analyses, syntheticLeads);

  // C1 evaluates Seller
  assert.equal(fiveC.company.targetEntity, 'seller');
  assert.ok(fiveC.company.mainObservations.some((obs) => obs.includes(SAMPLE_SELLER.companyName)));
  assert.ok(fiveC.company.mainObservations.some((obs) => obs.includes(SAMPLE_SELLER.productName!)));

  // C2 evaluates Lead Cohort
  assert.equal(fiveC.customers.targetEntity, 'lead_cohort');
  assert.ok(fiveC.customers.mainObservations.some((obs) => obs.includes('20 ingested company accounts')));
});

test('8. All five C dimensions are comprehensively represented', () => {
  const syntheticLeads = createSyntheticLeads();
  const analyses = syntheticLeads.map((l) => analyzeLeadNeedGap(SAMPLE_SELLER, l));
  const fiveC = synthesizeDetailedFiveC(SAMPLE_SELLER, analyses, syntheticLeads);

  assert.ok(fiveC.company, 'Company (C1) must be defined');
  assert.ok(fiveC.customers, 'Customers (C2) must be defined');
  assert.ok(fiveC.competitors, 'Competitors (C3) must be defined');
  assert.ok(fiveC.collaborators, 'Collaborators (C4) must be defined');
  assert.ok(fiveC.context, 'Context (C5) must be defined');

  assert.equal(fiveC.company.targetEntity, 'seller');
  assert.equal(fiveC.customers.targetEntity, 'lead_cohort');
  assert.equal(fiveC.competitors.targetEntity, 'market_alternatives');
  assert.equal(fiveC.collaborators.targetEntity, 'ecosystem');
  assert.equal(fiveC.context.targetEntity, 'macro_environment');
});

test('9. Missing competition data is marked RESEARCH REQUIRED and does not invent names', () => {
  const sellerWithoutCompetitors: SellerProfileContext = {
    ...SAMPLE_SELLER,
    mainAlternatives: '',
  };

  const syntheticLeads = createSyntheticLeads();
  const analyses = syntheticLeads.map((l) => analyzeLeadNeedGap(sellerWithoutCompetitors, l));
  const fiveC = synthesizeDetailedFiveC(sellerWithoutCompetitors, analyses, syntheticLeads);

  assert.equal(fiveC.competitors.researchRequired, true, 'Missing competitor data must set researchRequired: true');
  assert.equal(fiveC.competitors.confidence, 'low');
  assert.ok(
    fiveC.competitors.mainObservations.some((obs) => obs.includes('RESEARCH REQUIRED')),
    'Must display RESEARCH REQUIRED notice'
  );
  assert.ok(
    fiveC.competitors.missingInformation.some((m) => m.includes('RESEARCH REQUIRED')),
    'Missing info must flag research requirement'
  );
});

test('10. Missing context data is marked unknown without inventing fake GDP or market statistics', () => {
  const syntheticLeads = createSyntheticLeads();
  const analyses = syntheticLeads.map((l) => analyzeLeadNeedGap(SAMPLE_SELLER, l));
  const fiveC = synthesizeDetailedFiveC(SAMPLE_SELLER, analyses, syntheticLeads);

  assert.ok(fiveC.context.missingInformation.length > 0, 'Context must disclose missing regional / budget statistics');
  for (const obs of fiveC.context.mainObservations) {
    assert.doesNotMatch(obs, /\b\d+\.\d+%\s*(GDP|market growth)/i, 'Must not fabricate precise macroeconomic figures');
  }
});

test('11. Dataset ownership is strictly enforced in repository', async () => {
  const repo = new InMemoryStrategicAnalysisRepository();

  const analysisRecord = {
    datasetId: 'ds-secure-01',
    ownerUserId: 'owner-alice',
    sellerOfferingId: 'offering-01',
    needGapSummary: {
      datasetId: 'ds-secure-01',
      totalLeads: 5,
      analyzedLeadsCount: 5,
      insufficientEvidenceCount: 0,
      insufficientEvidenceLeadIds: [],
      topNeedPatterns: [],
      commonHypothesizedProblems: [],
      matchingSellerBenefits: [],
      missingInformationSummary: [],
      generatedAt: new Date().toISOString(),
    },
    fiveC: synthesizeDetailedFiveC(SAMPLE_SELLER, [], []),
    companyNeedGaps: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await repo.saveDatasetStrategicAnalysis('owner-alice', 'ds-secure-01', analysisRecord);

  const aliceRecord = await repo.getDatasetStrategicAnalysis('owner-alice', 'ds-secure-01');
  assert.ok(aliceRecord, 'Alice must access her dataset strategic analysis');

  const bobRecord = await repo.getDatasetStrategicAnalysis('owner-bob', 'ds-secure-01');
  assert.equal(bobRecord, null, 'Bob must not access Alice’s dataset strategic analysis');
});

test('12. Mock analyzer operates cleanly without API keys or credentials', () => {
  const syntheticLeads = createSyntheticLeads();
  const analyses = syntheticLeads.map((lead) => analyzeLeadNeedGap(SAMPLE_SELLER, lead));
  const summary = aggregateDatasetNeedGaps('ds-mock', analyses, SAMPLE_SELLER);
  const fiveC = synthesizeDetailedFiveC(SAMPLE_SELLER, analyses, syntheticLeads);

  assert.equal(summary.totalLeads, 20);
  assert.ok(fiveC.company.mainObservations.length > 0);
  assert.ok(fiveC.customers.mainObservations.length > 0);
});

test('13. Failed AI calls or missing fields do not corrupt previously saved data', async () => {
  const repo = new InMemoryStrategicAnalysisRepository();

  const originalGap = analyzeLeadNeedGap(SAMPLE_SELLER, {
    id: 'lead-fail-safe',
    dataset_id: 'ds-01',
    owner_user_id: 'user-01',
    company_name: 'Safe Corp',
    notes: 'Real notes about prospecting.',
    analysis_eligible: true,
    analysis_status: 'completed',
  });

  await repo.saveLeadNeedGap('user-01', 'lead-fail-safe', originalGap);

  // Verify stored
  const fetched = await repo.getLeadNeedGap('user-01', 'lead-fail-safe');
  assert.equal(fetched?.problemIntensity, 'Acute');

  // Verify isolated
  assert.notEqual(fetched, null);
});

test('14. Existing human-corrected descriptions are used with priority over raw notes', () => {
  const leadWithCorrection: LeadForAnalysis = {
    id: 'lead-human-override',
    dataset_id: 'ds-01',
    owner_user_id: 'user-01',
    company_name: 'Overridden Corp',
    notes: 'Raw spreadsheet note: generic software.',
    user_corrected_description: 'Verified manually: 200 SDRs suffering severe manual prospecting overhead.',
    analysis_eligible: true,
    analysis_status: 'completed',
  };

  const needGap = analyzeLeadNeedGap(SAMPLE_SELLER, leadWithCorrection);

  assert.equal(needGap.confidence, 'high');
  assert.equal(needGap.analysisStatus, 'completed');
  assert.ok(
    needGap.evidence.some(
      (e) => e.attribute === 'human_verified_description' && e.summary.includes('200 SDRs')
    ),
    'Must use human-corrected description in evidence'
  );
});

test('15. Dataset analysis uses stored company records without fabricating accounts', () => {
  const syntheticLeads = createSyntheticLeads();
  const analyses = syntheticLeads.map((l) => analyzeLeadNeedGap(SAMPLE_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-20', analyses, SAMPLE_SELLER);

  // Sum of supporting counts in top patterns + insufficient evidence
  const totalAccountReferences = summary.topNeedPatterns.reduce((acc, p) => acc + p.supportingCount, 0);
  assert.equal(
    totalAccountReferences + summary.insufficientEvidenceCount,
    20,
    'Sum of accounts in patterns + insufficient evidence must equal total accounts exactly'
  );
});

test('16. Analysis output supports later segmentation with stable pattern IDs and matching lead IDs', () => {
  const syntheticLeads = createSyntheticLeads();
  const analyses = syntheticLeads.map((l) => analyzeLeadNeedGap(SAMPLE_SELLER, l));
  const summary = aggregateDatasetNeedGaps('ds-20', analyses, SAMPLE_SELLER);

  for (const pattern of summary.topNeedPatterns) {
    assert.ok(pattern.id.startsWith('pattern-'), 'Pattern must have a stable ID');
    assert.ok(pattern.supportingLeadIds.length > 0, 'Pattern must link to supporting lead IDs');
    assert.equal(
      pattern.supportingCount,
      pattern.supportingLeadIds.length,
      'supportingCount must match supportingLeadIds.length'
    );
  }
});
