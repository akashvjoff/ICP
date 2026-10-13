import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DatasetNeedGapSummary,
  DatasetStrategicAnalysis,
  DetailedFiveCAnalysis,
  DetailedFiveCDimension,
  EvidenceOrigin,
  MotivationalConflict,
  NeedGapAnalysis,
  NeedGapEvidenceItem,
  NeedGapPattern,
} from '../types/analysis';
import type { CompanyAnalysisEnvelope } from '../types/companyIntelligence';
import type { LeadForAnalysis } from './analysisJobService';

export interface SellerProfileContext {
  id?: string;
  companyName: string;
  website?: string;
  productName?: string;
  productDescription?: string;
  category?: string;
  valueProposition?: string;
  primaryProblemSolved?: string;
  keyCapabilities?: string[];
  typicalACV?: string;
  pricingModel?: string;
  mainAlternatives?: string;
  pointOfParity?: string;
  pointOfDifference?: string;
  targetMarket?: string;
  primaryBuyer?: string;
  mainCustomerProblem?: string;
}

export interface StrategicAnalysisRepository {
  assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void>;
  getDatasetStrategicAnalysis(ownerUserId: string, datasetId: string): Promise<DatasetStrategicAnalysis | null>;
  saveDatasetStrategicAnalysis(
    ownerUserId: string,
    datasetId: string,
    analysis: DatasetStrategicAnalysis
  ): Promise<void>;
  getLeadNeedGap(ownerUserId: string, leadId: string): Promise<NeedGapAnalysis | null>;
  saveLeadNeedGap(ownerUserId: string, leadId: string, needGap: NeedGapAnalysis): Promise<void>;
}

// -----------------------------------------------------------------------------
// 1. COMPANY-LEVEL NEED GAP EVALUATOR
// -----------------------------------------------------------------------------

export function analyzeLeadNeedGap(
  seller: SellerProfileContext,
  lead: LeadForAnalysis,
  intelligence?: CompanyAnalysisEnvelope | null
): NeedGapAnalysis {
  const sellerOfferingId = seller.id || 'seller-offering-default';
  const effectiveDescription = (
    lead.user_corrected_description ||
    lead.notes ||
    lead.product_raw ||
    ''
  ).trim();

  const storedIntel = intelligence?.analysis;
  const intelSummary = storedIntel?.product_summary?.value !== 'unknown'
    ? storedIntel?.product_summary?.value
    : '';

  const possibleNeeds = storedIntel?.potential_business_needs?.value || [];
  const primaryProducts = storedIntel?.products?.value || [];
  const targetCustomers = storedIntel?.target_customers?.value || [];

  // Determine if there is sufficient evidence
  const hasDescriptiveContent = Boolean(
    effectiveDescription ||
    (intelSummary && intelSummary !== 'unknown') ||
    possibleNeeds.length > 0 ||
    primaryProducts.length > 0 ||
    (lead.website && intelligence?.websiteEvidence?.status === 'fetched')
  );

  const evidence: NeedGapEvidenceItem[] = [];
  const unknowns: string[] = [];

  // 1. Evidence extraction
  if (lead.user_corrected_description) {
    evidence.push({
      attribute: 'human_verified_description',
      summary: 'Verified by human operator: ' + lead.user_corrected_description.slice(0, 140),
      origin: 'user_provided',
      sourceField: 'user_corrected_description',
    });
  } else if (effectiveDescription) {
    evidence.push({
      attribute: 'uploaded_profile_notes',
      summary: 'Uploaded lead record: ' + effectiveDescription.slice(0, 140),
      origin: 'user_provided',
      sourceField: 'notes',
    });
  }

  if (intelligence?.websiteEvidence && intelligence.websiteEvidence.status === 'fetched') {
    evidence.push({
      attribute: 'public_website_observation',
      summary: `Extracted from ${intelligence.websiteEvidence.sourceUrl} (${intelligence.websiteEvidence.headings?.length || 0} headings)`,
      origin: 'verified',
      sourceField: 'website_evidence',
    });
  }

  if (storedIntel && storedIntel.business_model.value !== 'unknown') {
    evidence.push({
      attribute: 'business_model_inference',
      summary: `Classified business model: ${storedIntel.business_model.value}`,
      origin: storedIntel.business_model.origin === 'uploaded' ? 'user_provided' : 'inferred',
      sourceField: 'company_analyses.business_model',
    });
  }

  // 2. Critical Guardrails on Unknowns
  unknowns.push('Willingness to pay (cannot be inferred from headcount or industry alone)');
  unknowns.push('Internal software procurement budget');
  unknowns.push('Current vendor contract renewal timeline');

  if (!lead.employee_count && !lead.company_size_raw) {
    unknowns.push('Verified employee headcount');
  }
  if (!lead.industry_raw && (!storedIntel || storedIntel.industry.value === 'unknown')) {
    unknowns.push('Industry vertical classification');
  }

  // 3. Case A: Insufficient evidence
  if (!hasDescriptiveContent) {
    unknowns.push('Specific operational bottlenecks');
    unknowns.push('Current workflow technology architecture');

    return {
      leadId: lead.id,
      companyName: lead.company_name,
      sellerOfferingId,
      currentState: 'Current operational baseline unknown due to lack of descriptive or website data.',
      idealState: 'Unknown ideal state.',
      needGap: 'Insufficient evidence to determine business friction without company description or verified operational data.',
      relevantProblem: 'Unsubstantiated operational friction (Insufficient Evidence)',
      problemIntensity: 'Negligible',
      motivationToChange: 'Unknown change trigger',
      involvement: 'Unknown',
      outcomeAttractiveness: 'Unknown',
      perceivedBenefits: [],
      perceivedCosts: [],
      approachMotivation: null,
      avoidanceMotivation: null,
      motivationalConflict: null,
      relevantProductBenefits: [],
      suggestedBuyerRoles: seller.primaryBuyer ? [`${seller.primaryBuyer} (Hypothesis)`] : ['Executive Sponsor (Hypothesis)'],
      evidence,
      unknowns,
      confidence: 'low',
      analysisStatus: 'insufficient_evidence',
      analyzedAt: new Date().toISOString(),
    };
  }

  // 4. Case B: Has descriptive evidence or intelligence
  const fullText = `${lead.company_name} ${effectiveDescription} ${intelSummary} ${possibleNeeds.join(' ')} ${primaryProducts.join(' ')}`.toLowerCase();

  const sellerProblem = seller.primaryProblemSolved || seller.mainCustomerProblem || 'Manual operational overhead and inefficient team workflows';
  const sellerCapabilities = seller.keyCapabilities || ['Automated diagnostics', 'Workflow optimization', 'Real-time integrations'];

  // Match capabilities and needs
  const matchedCapabilities = sellerCapabilities.filter((cap) => {
    const tokens = cap.toLowerCase().split(/\s+/).filter((t) => t.length > 4);
    return tokens.length === 0 || tokens.some((token) => fullText.includes(token));
  });

  const relevantProductBenefits = matchedCapabilities.length > 0 ? matchedCapabilities : [sellerCapabilities[0] || 'Operational automation and error reduction'];

  // Detect problem and need gap
  let relevantProblem = possibleNeeds[0] || `Friction in scaling operations while relying on fragmented manual processes`;
  let currentState = `Operating with manual or fragmented processes across ${primaryProducts[0] || 'core operations'}`;
  let idealState = `Streamlined, automated operations with predictable outcomes and reduced cycle time`;
  let needGap = `Gap between manual, labor-intensive workflows and scalable automated infrastructure`;
  let problemIntensity: NeedGapAnalysis['problemIntensity'] = 'Moderate';
  let motivationToChange = 'Executive pressure to increase efficiency and avoid operational bottlenecks';
  let involvement: NeedGapAnalysis['involvement'] = 'Medium';
  let outcomeAttractiveness: NeedGapAnalysis['outcomeAttractiveness'] = 'High';
  let approachMotivation: string | null = 'Accelerate operational output and revenue expansion';
  let avoidanceMotivation: string | null = 'Avoid costly operational errors and missed delivery deadlines';
  let motivationalConflict: MotivationalConflict = null;

  // Refine based on text clues
  if (fullText.includes('prospect') || fullText.includes('sales') || fullText.includes('pipeline') || fullText.includes('outbound')) {
    relevantProblem = 'Manual outbound prospecting and high researcher overhead';
    currentState = 'Sales reps spend significant weekly hours on manual lead research and fragmented contact list building.';
    idealState = 'Continuous automated outbound pipeline generation with verified high-intent account targeting.';
    needGap = 'Time lost to manual data qualification instead of direct sales conversations.';
    problemIntensity = 'Acute';
    motivationToChange = 'Slowing pipeline velocity and rising customer acquisition costs.';
    involvement = 'High';
    outcomeAttractiveness = 'High';
    approachMotivation = 'Rapid pipeline velocity and higher quota attainment';
    avoidanceMotivation = 'Avoid missed quarterly revenue commitments';
    motivationalConflict = 'Approach-Avoidance'; // Desire for growth vs fear of outbound domain spam / disruption
  } else if (fullText.includes('crm') || fullText.includes('enrich') || fullText.includes('data') || fullText.includes('hygiene') || fullText.includes('sync')) {
    relevantProblem = 'CRM data decay and fragmented account intelligence';
    currentState = 'Account databases suffer from missing firmographics and stale contact records.';
    idealState = 'Enriched, real-time synchronized account dossiers integrated into operational CRM workflows.';
    needGap = 'Discrepancy between stale static data and accurate current market positioning.';
    problemIntensity = 'Moderate';
    motivationToChange = 'Sales operations auditing inaccurate pipeline conversion metrics.';
    involvement = 'Medium';
    outcomeAttractiveness = 'Medium';
    approachMotivation = 'Single source of account truth for revenue operations';
    avoidanceMotivation = 'Prevent rep time wasted on defunct domains or invalid accounts';
    motivationalConflict = null;
  } else if (fullText.includes('security') || fullText.includes('compliance') || fullText.includes('audit')) {
    relevantProblem = 'Audit readiness and regulatory compliance exposure';
    currentState = 'Manual audit log collection and ad-hoc compliance monitoring.';
    idealState = 'Automated continuous compliance verification with instant governance audit trails.';
    needGap = 'Gap between periodic manual sampling and continuous regulatory readiness.';
    problemIntensity = 'Acute';
    motivationToChange = 'Approaching external compliance audit or enterprise client security questionnaire.';
    involvement = 'High';
    outcomeAttractiveness = 'High';
    approachMotivation = 'Seamless enterprise procurement approvals';
    avoidanceMotivation = 'Avoid severe compliance fines and failed enterprise audits';
    motivationalConflict = 'Approach-Avoidance';
  }

  // Label as hypothesis if not directly stated by human
  if (!lead.user_corrected_description && !lead.notes) {
    relevantProblem = `${relevantProblem} (Hypothesis)`;
  }

  const perceivedBenefits = [
    `Measurable reduction in operational cycle time via ${seller.productName || 'offering'}`,
    `Increased team bandwidth for strategic initiatives`,
    `Automated visibility into workflow performance`,
  ];

  const perceivedCosts = [
    `Software subscription fee (Pricing specifics unverified)`,
    `Implementation and team adoption learning curve`,
    `Data migration and integration configuration effort`,
  ];

  const suggestedBuyerRoles = seller.primaryBuyer
    ? [seller.primaryBuyer]
    : targetCustomers.length > 0
    ? targetCustomers.slice(0, 2)
    : ['VP of Operations', 'Head of Revenue Operations'];

  const confidence: NeedGapAnalysis['confidence'] = lead.user_corrected_description
    ? 'high'
    : intelligence?.websiteEvidence?.status === 'fetched'
    ? 'medium'
    : 'low';

  return {
    leadId: lead.id,
    companyName: lead.company_name,
    sellerOfferingId,
    currentState,
    idealState,
    needGap,
    relevantProblem,
    problemIntensity,
    motivationToChange,
    involvement,
    outcomeAttractiveness,
    perceivedBenefits,
    perceivedCosts,
    approachMotivation,
    avoidanceMotivation,
    motivationalConflict,
    relevantProductBenefits,
    suggestedBuyerRoles,
    evidence,
    unknowns,
    confidence,
    analysisStatus: lead.user_corrected_description ? 'completed' : 'hypothesis',
    analyzedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// 2. DATASET-LEVEL NEED GAP AGGREGATION (Pure Deterministic Math)
// -----------------------------------------------------------------------------

export function aggregateDatasetNeedGaps(
  datasetId: string,
  analyses: NeedGapAnalysis[],
  seller: SellerProfileContext
): DatasetNeedGapSummary {
  const totalLeads = analyses.length;
  if (totalLeads === 0) {
    return {
      datasetId,
      totalLeads: 0,
      analyzedLeadsCount: 0,
      insufficientEvidenceCount: 0,
      insufficientEvidenceLeadIds: [],
      topNeedPatterns: [],
      commonHypothesizedProblems: [],
      matchingSellerBenefits: [],
      missingInformationSummary: ['No company records present in dataset.'],
      generatedAt: new Date().toISOString(),
    };
  }

  const insufficientEvidenceLeads = analyses.filter(
    (a) => a.analysisStatus === 'insufficient_evidence'
  );
  const insufficientEvidenceCount = insufficientEvidenceLeads.length;
  const insufficientEvidenceLeadIds = insufficientEvidenceLeads.map((a) => a.leadId);
  const analyzedLeadsCount = totalLeads - insufficientEvidenceCount;

  // Group analyzed leads into problem clusters using deterministic keys
  const patternBuckets = new Map<
    string,
    {
      title: string;
      description: string;
      leadIds: string[];
      acute: number;
      moderate: number;
      low: number;
      negligible: number;
      sellerCapabilities: Set<string>;
      verifiedCount: number;
    }
  >();

  for (const analysis of analyses) {
    if (analysis.analysisStatus === 'insufficient_evidence') {
      continue;
    }

    // Clean title (strip "(Hypothesis)" for grouping)
    const cleanTitle = analysis.relevantProblem.replace(/\s*\(Hypothesis\)$/i, '').trim();
    const key = cleanTitle.toLowerCase();

    if (!patternBuckets.has(key)) {
      patternBuckets.set(key, {
        title: cleanTitle,
        description: analysis.needGap,
        leadIds: [],
        acute: 0,
        moderate: 0,
        low: 0,
        negligible: 0,
        sellerCapabilities: new Set(),
        verifiedCount: 0,
      });
    }

    const bucket = patternBuckets.get(key)!;
    bucket.leadIds.push(analysis.leadId);

    if (analysis.problemIntensity === 'Acute') bucket.acute += 1;
    else if (analysis.problemIntensity === 'Moderate') bucket.moderate += 1;
    else if (analysis.problemIntensity === 'Low') bucket.low += 1;
    else bucket.negligible += 1;

    for (const cap of analysis.relevantProductBenefits) {
      bucket.sellerCapabilities.add(cap);
    }

    if (analysis.analysisStatus === 'completed') {
      bucket.verifiedCount += 1;
    }
  }

  // Convert buckets to ranked patterns
  const topNeedPatterns: NeedGapPattern[] = Array.from(patternBuckets.entries())
    .map(([key, bucket], index) => {
      const supportingCount = bucket.leadIds.length;
      const percentage = Math.round((supportingCount / totalLeads) * 100);
      const ratioFormatted = `${supportingCount}/${totalLeads}`;

      const evidenceLevel: NeedGapPattern['evidenceLevel'] =
        bucket.verifiedCount > 0
          ? 'verified'
          : supportingCount > 0
          ? 'hypothesis'
          : 'unknown';

      return {
        id: `pattern-${index + 1}-${key.slice(0, 16).replace(/\s+/g, '-')}`,
        problemTitle: bucket.title,
        description: bucket.description,
        supportingLeadIds: bucket.leadIds,
        supportingCount,
        totalCount: totalLeads,
        percentage,
        ratioFormatted,
        intensityDistribution: {
          acute: bucket.acute,
          moderate: bucket.moderate,
          low: bucket.low,
          negligible: bucket.negligible,
        },
        relevantSellerCapabilities: Array.from(bucket.sellerCapabilities),
        evidenceLevel,
      };
    })
    .sort((a, b) => b.supportingCount - a.supportingCount);

  // Seller benefit matching
  const sellerCaps = seller.keyCapabilities || ['Operational automation', 'Workflow diagnostics'];
  const matchingSellerBenefits = sellerCaps.map((cap) => {
    const matchedLeads = analyses.filter((a) =>
      a.relevantProductBenefits.some(
        (b) => b.toLowerCase().includes(cap.toLowerCase()) || cap.toLowerCase().includes(b.toLowerCase())
      )
    );
    return {
      sellerBenefit: cap,
      matchedNeedCount: matchedLeads.length,
      leadIds: matchedLeads.map((l) => l.leadId),
    };
  });

  const missingInformationSummary: string[] = [
    `Willingness to pay (WTP) is unverified across all ${totalLeads} accounts. Historical win/loss deal data is required to substantiate demand.`,
    `${insufficientEvidenceCount}/${totalLeads} accounts lack sufficient descriptive or website data to formulate a grounded need hypothesis.`,
    `Budget authority, buying unit composition, and procurement renewal calendars remain unobserved.`,
  ];

  return {
    datasetId,
    totalLeads,
    analyzedLeadsCount,
    insufficientEvidenceCount,
    insufficientEvidenceLeadIds,
    topNeedPatterns,
    commonHypothesizedProblems: topNeedPatterns.map((p) => p.problemTitle),
    matchingSellerBenefits,
    missingInformationSummary,
    generatedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// 3. 5C / STAKEHOLDER SYNTHESIS ENGINE
// -----------------------------------------------------------------------------

export function synthesizeDetailedFiveC(
  seller: SellerProfileContext,
  analyses: NeedGapAnalysis[],
  leads: LeadForAnalysis[]
): DetailedFiveCAnalysis {
  const totalLeads = leads.length;

  // C1 — COMPANY (Analyzes SELLER strictly)
  const sellerCapabilities = seller.keyCapabilities?.length
    ? seller.keyCapabilities
    : ['Enterprise platform integration', 'Automated workflow diagnostics'];

  const company: DetailedFiveCDimension = {
    title: 'C1: Seller Organization & Offering Capabilities',
    targetEntity: 'seller',
    mainObservations: [
      `Company: ${seller.companyName}`,
      `Offering: ${seller.productName || seller.companyName} (${seller.category || 'B2B Software'})`,
      `Core Value Proposition: ${seller.valueProposition || seller.productDescription || 'Operational streamlining'}`,
      `Supported Product Capabilities: ${sellerCapabilities.join(', ')}`,
      `Target Buyer Identified: ${seller.primaryBuyer || 'Not specified in onboarding'}`,
    ],
    evidence: [
      {
        fact: `Seller profile provided by operator for "${seller.companyName}"`,
        origin: 'user_provided',
        source: 'seller_profiles.onboarding_data',
      },
    ],
    potentialOpportunity: `Directly address acute workflow and efficiency friction identified in ${seller.primaryProblemSolved || 'target accounts'}.`,
    potentialRisk: `Over-promising custom integrations or broader capabilities outside of: ${sellerCapabilities.join('; ')}.`,
    missingInformation: seller.typicalACV
      ? [`Target pricing model: ${seller.pricingModel || 'Subscription'} at ${seller.typicalACV}`]
      : ['Specific contract pricing thresholds and commercial implementation costs'],
    confidence: 'high',
    strategicImplications: `Position exclusively around core proven strengths (${sellerCapabilities.slice(0, 2).join(' & ')}), avoiding non-core product expansion.`,
    researchRequired: false,
  };

  // C2 — CUSTOMERS (Analyzes LEAD COHORT)
  const acuteCount = analyses.filter((a) => a.problemIntensity === 'Acute').length;
  const moderateCount = analyses.filter((a) => a.problemIntensity === 'Moderate').length;
  const insufficientCount = analyses.filter((a) => a.analysisStatus === 'insufficient_evidence').length;

  const customers: DetailedFiveCDimension = {
    title: 'C2: Customer Cohort & Buying Committee Analysis',
    targetEntity: 'lead_cohort',
    mainObservations: [
      `Cohort Size: ${totalLeads} ingested company accounts evaluated.`,
      `Problem Intensity Distribution: ${acuteCount}/${totalLeads} acute friction, ${moderateCount}/${totalLeads} moderate friction, ${insufficientCount}/${totalLeads} insufficient evidence.`,
      `Hypothesized Economic Buyer: ${seller.primaryBuyer || 'VP / Executive Sponsor with P&L authority'}.`,
      `Hypothesized Daily User: Operational specialists, engineers, and frontline team members.`,
    ],
    evidence: [
      {
        fact: `${totalLeads} accounts uploaded and evaluated against seller problem-solution map.`,
        origin: 'user_provided',
        source: 'leads table',
      },
      {
        fact: `${analyses.length - insufficientCount} accounts matched against possible operational need hypotheses.`,
        origin: 'inferred',
        source: 'company intelligence engine',
      },
    ],
    potentialOpportunity: `Focus initial sales outreach on the ${acuteCount} accounts with acute identified operational friction.`,
    potentialRisk: `Treating company headcount or industry as proof of willingness to pay without verified deal outcomes.`,
    missingInformation: [
      'Willingness to pay (WTP) cannot be inferred from firmographics alone - requires commercial sales dialogue.',
      'Active budget allocation status for current fiscal period.',
      'Internal procurement obstacle hurdles and security review requirements.',
    ],
    confidence: totalLeads > 0 ? (insufficientCount < totalLeads / 2 ? 'medium' : 'low') : 'low',
    strategicImplications: `Qualify economic buyer authority and budget willingness before investing senior technical resource hours.`,
    researchRequired: false,
  };

  // C3 — COMPETITORS (Analyzes Alternatives)
  const hasSellerAlternatives = Boolean(seller.mainAlternatives && seller.mainAlternatives.trim().length > 0);
  const sellerAlternativesText = seller.mainAlternatives?.trim() || '';

  const competitors: DetailedFiveCDimension = hasSellerAlternatives
    ? {
        title: 'C3: Competitive Dynamics & Market Alternatives',
        targetEntity: 'market_alternatives',
        mainObservations: [
          `Identified Existing Alternatives: ${sellerAlternativesText}`,
          `Points of Parity: ${seller.pointOfParity || 'Standard security, role-based controls, cloud hosting'}`,
          `Points of Difference: ${seller.pointOfDifference || 'Proprietary automated workflow optimization and zero-config time-to-value'}`,
        ],
        evidence: [
          {
            fact: `Alternatives recorded during seller onboarding: ${sellerAlternativesText}`,
            origin: 'user_provided',
            source: 'seller_profiles.main_alternatives',
          },
        ],
        potentialOpportunity: `Displace manual spreadsheets or heavyweight legacy suites by highlighting rapid deployment and immediate ROI.`,
        potentialRisk: `Status quo inertia: customer teams prefer familiar manual workarounds despite operational friction.`,
        missingInformation: [
          'Detailed feature matrices of point solutions',
          'Competitor contract pricing and discount schedules',
          'Customer switching costs and contractual lock-in periods',
        ],
        confidence: 'medium',
        strategicImplications: `Lead with differentiated point of value (${seller.pointOfDifference || 'faster time-to-value'}) to overcome status quo inertia.`,
        researchRequired: false,
      }
    : {
        title: 'C3: Competitive Dynamics & Market Alternatives',
        targetEntity: 'market_alternatives',
        mainObservations: [
          'RESEARCH REQUIRED: No specific competitor alternatives or incumbent solutions were provided in seller onboarding.',
          'Competitive positioning cannot be verified without seller-provided alternatives or external market research.',
        ],
        evidence: [
          {
            fact: 'Seller onboarding contains empty competitor alternatives field.',
            origin: 'unknown',
            source: 'seller_profiles.main_alternatives',
          },
        ],
        potentialOpportunity: 'Opportunity to define the category narrative if market lacks a dominant incumbent.',
        potentialRisk: 'Blindsided by entrenched incumbent tools during procurement evaluations.',
        missingInformation: [
          'RESEARCH REQUIRED: Direct competitor product names',
          'RESEARCH REQUIRED: Competitive pricing models and average contract values',
          'RESEARCH REQUIRED: Competitor market share and customer overlap',
        ],
        confidence: 'low',
        strategicImplications: 'Conduct systematic competitor research before deploying high-volume sales positioning.',
        researchRequired: true,
      };

  // C4 — COLLABORATORS (Partners, Integrations, Ecosystem)
  const leadTechs = Array.from(
    new Set(
      leads
        .flatMap((l) => (l.raw_row && typeof l.raw_row === 'object' && 'technologies' in l.raw_row ? (l.raw_row as Record<string, unknown>).technologies : []))
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
    )
  );

  const collaborators: DetailedFiveCDimension = {
    title: 'C4: Collaborators & Ecosystem Channel Integrations',
    targetEntity: 'ecosystem',
    mainObservations: [
      `Key Platforms & Dependencies: Enterprise software ecosystems, cloud infrastructure, and data platforms.`,
      `Observed Cohort Technologies: ${leadTechs.slice(0, 5).join(', ') || 'Standard cloud SaaS tech stacks'}.`,
      `Channel Opportunities: System integrators, CRM marketplaces, and advisory consultants.`,
    ],
    evidence: [
      {
        fact: leadTechs.length > 0 ? `Observed tech stack signals across uploaded accounts: ${leadTechs.slice(0, 4).join(', ')}` : 'Standard enterprise cloud infrastructure dependencies.',
        origin: leadTechs.length > 0 ? 'inferred' : 'unknown',
        source: 'lead technology attributes',
      },
    ],
    potentialOpportunity: `Build marketplace partnerships (e.g. Salesforce AppExchange, AWS Marketplace) for co-selling leverage.`,
    potentialRisk: `High API dependency on third-party platforms that may change terms of service or rate limits.`,
    missingInformation: [
      'Specific implementation partner capacity in target regions',
      'Formal channel co-selling agreements',
    ],
    confidence: 'low',
    strategicImplications: `Validate API stability and pre-build connectors for the most common cohort tech stacks.`,
    researchRequired: false,
  };

  // C5 — CONTEXT (PESTEL Macro Environment)
  const sellerText = `${seller.category || ''} ${seller.productDescription || ''} ${seller.valueProposition || ''} ${seller.pointOfParity || ''}`.toLowerCase();
  const leadsText = leads.map((l) => (l.notes || '') + ' ' + (l.industry_raw || '')).join(' ').toLowerCase();
  const combinedText = `${sellerText} ${leadsText}`;

  const verifiedRegs: string[] = [];
  if (combinedText.includes('hipaa')) verifiedRegs.push('HIPAA');
  if (combinedText.includes('gdpr')) verifiedRegs.push('GDPR');
  if (combinedText.includes('sec') || combinedText.includes('sox')) verifiedRegs.push('SEC/SOX');
  if (combinedText.includes('soc2') || combinedText.includes('soc 2')) verifiedRegs.push('SOC2 Type II');
  if (combinedText.includes('pci')) verifiedRegs.push('PCI-DSS');

  const hasVerifiedRegs = verifiedRegs.length > 0;
  const regulatoryClimateObservation = hasVerifiedRegs
    ? `Verified Regulatory Context: Source data substantiates compliance drivers for ${verifiedRegs.join(', ')}.`
    : `POTENTIAL CONTEXT — RESEARCH REQUIRED: Specific regulatory compliance drivers (e.g., industry data privacy and governance mandates) unverified in candidate source data.`;

  const context: DetailedFiveCDimension = {
    title: 'C5: Macro Context, Regulatory & Technological Climate',
    targetEntity: 'macro_environment',
    mainObservations: [
      'Technological Climate: Accelerated adoption of operational automation and AI-assisted tooling.',
      regulatoryClimateObservation,
      'Economic Climate: Scrutiny on enterprise software spend requiring defensible ROI calculations.',
    ],
    evidence: [
      {
        fact: hasVerifiedRegs
          ? `Specific compliance drivers supported by source data (${verifiedRegs.join(', ')}).`
          : 'POTENTIAL CONTEXT — RESEARCH REQUIRED: Enterprise baseline assumed; specific mandates unverified.',
        origin: hasVerifiedRegs ? 'user_provided' : 'unknown',
        source: hasVerifiedRegs ? 'seller offering & lead notes' : 'unverified general context',
      },
    ],
    potentialOpportunity: `Software that reduces operational headcount cost or provides auditable compliance is prioritized in constrained budget cycles.`,
    potentialRisk: `Lengthened procurement review cycles and mandatory committee-level approval on new vendor software.`,
    missingInformation: [
      hasVerifiedRegs
        ? 'Specific jurisdiction enforcement timelines affecting lead accounts'
        : 'POTENTIAL CONTEXT — RESEARCH REQUIRED: Verified regulatory frameworks and audit mandates for target accounts',
      'Target buyer capital expenditure budget ceilings for current cycle',
    ],
    confidence: hasVerifiedRegs ? 'medium' : 'low',
    strategicImplications: `Provide clear ROI calculations and avoid asserting regulatory requirements unless customer procurement audits confirm them.`,
    researchRequired: !hasVerifiedRegs,
  };

  return {
    company,
    customers,
    competitors,
    collaborators,
    context,
    analyzedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// 4. SUPABASE & IN-MEMORY REPOSITORIES
// -----------------------------------------------------------------------------

export function createSupabaseStrategicAnalysisRepository(client: SupabaseClient): StrategicAnalysisRepository {
  return {
    async assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void> {
      const { data, error } = await client
        .from('datasets')
        .select('id')
        .eq('id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Dataset not found or access denied.');
      }
    },

    async getDatasetStrategicAnalysis(ownerUserId: string, datasetId: string): Promise<DatasetStrategicAnalysis | null> {
      const { data, error } = await client
        .from('dataset_strategic_analyses')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('dataset_id', datasetId)
        .maybeSingle();

      if (error) {
        // Table might not exist yet before migration, return null gracefully
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        datasetId: data.dataset_id,
        ownerUserId: data.owner_user_id,
        sellerOfferingId: data.seller_offering_id || 'seller-offering-default',
        needGapSummary: data.need_gap_summary,
        fiveC: data.five_c_analysis,
        companyNeedGaps: {},
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },

    async saveDatasetStrategicAnalysis(
      ownerUserId: string,
      datasetId: string,
      analysis: DatasetStrategicAnalysis
    ): Promise<void> {
      await this.assertOwnedDataset(ownerUserId, datasetId);

      const { error } = await client
        .from('dataset_strategic_analyses')
        .upsert(
          {
            owner_user_id: ownerUserId,
            dataset_id: datasetId,
            seller_offering_id: analysis.sellerOfferingId,
            need_gap_summary: analysis.needGapSummary,
            five_c_analysis: analysis.fiveC,
            lead_analyses_count: analysis.needGapSummary.analyzedLeadsCount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'owner_user_id,dataset_id' }
        );

      if (error) throw error;
    },

    async getLeadNeedGap(ownerUserId: string, leadId: string): Promise<NeedGapAnalysis | null> {
      const { data, error } = await client
        .from('company_analyses')
        .select('need_gap_json')
        .eq('owner_user_id', ownerUserId)
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error || !data?.need_gap_json) return null;
      return data.need_gap_json as NeedGapAnalysis;
    },

    async saveLeadNeedGap(ownerUserId: string, leadId: string, needGap: NeedGapAnalysis): Promise<void> {
      const { error } = await client
        .from('company_analyses')
        .update({ need_gap_json: needGap })
        .eq('owner_user_id', ownerUserId)
        .eq('lead_id', leadId);

      if (error) {
        // Non-fatal if column is being migrated
        console.warn('Could not update company_analyses.need_gap_json:', error.message);
      }
    },
  };
}

export class InMemoryStrategicAnalysisRepository implements StrategicAnalysisRepository {
  private datasetAnalyses = new Map<string, DatasetStrategicAnalysis>();
  private leadNeedGaps = new Map<string, NeedGapAnalysis>();
  private datasetOwners = new Map<string, string>();

  setDatasetOwner(datasetId: string, ownerUserId: string): void {
    this.datasetOwners.set(datasetId, ownerUserId);
  }

  async assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void> {
    const owner = this.datasetOwners.get(datasetId);
    if (owner && owner !== ownerUserId) {
      throw new Error(`Dataset ${datasetId} not found or not owned by user.`);
    }
  }

  async getDatasetStrategicAnalysis(ownerUserId: string, datasetId: string): Promise<DatasetStrategicAnalysis | null> {
    const item = this.datasetAnalyses.get(`${ownerUserId}:${datasetId}`);
    return item ? structuredClone(item) : null;
  }

  async saveDatasetStrategicAnalysis(
    ownerUserId: string,
    datasetId: string,
    analysis: DatasetStrategicAnalysis
  ): Promise<void> {
    this.datasetAnalyses.set(`${ownerUserId}:${datasetId}`, structuredClone(analysis));
  }

  async getLeadNeedGap(ownerUserId: string, leadId: string): Promise<NeedGapAnalysis | null> {
    const item = this.leadNeedGaps.get(`${ownerUserId}:${leadId}`);
    return item ? structuredClone(item) : null;
  }

  async saveLeadNeedGap(ownerUserId: string, leadId: string, needGap: NeedGapAnalysis): Promise<void> {
    this.leadNeedGaps.set(`${ownerUserId}:${leadId}`, structuredClone(needGap));
  }
}
