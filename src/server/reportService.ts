import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DatasetNeedGapSummary,
  DatasetSTPAnalysis,
  DetailedFiveCAnalysis,
  ExecutiveICPReport,
  FeatureAdvantageBenefit,
  MarketingMixDimension,
  PeopleMixAnalysis,
  PhysicalEvidenceMixAnalysis,
  PlaceMixAnalysis,
  PriceMixAnalysis,
  ProcessJourneyStage,
  ProcessMixAnalysis,
  ProductMixAnalysis,
  PromotionMixAnalysis,
  RecommendedActionItem,
  Segment7PsMarketingMix,
} from '../types/analysis';
import type { LeadICPScore } from '../types/scoring';
import type { SellerProfileContext } from './strategicAnalysisService';
import type { LeadForAnalysis } from './analysisJobService';

export const CURRENT_REPORT_MODEL_VERSION = 'v1.3-executive-report';

export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  // Prevent spreadsheet formula injection (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str}"`;
}

export interface ReportRepository {
  assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void>;
  getReport(ownerUserId: string, datasetId: string): Promise<ExecutiveICPReport | null>;
  saveReport(ownerUserId: string, datasetId: string, report: ExecutiveICPReport): Promise<void>;
}

// -----------------------------------------------------------------------------
// 1. DETERMINISTIC 7Ps MARKETING MIX ENGINE
// -----------------------------------------------------------------------------

export function buildProductMix(
  seller: SellerProfileContext,
  segmentName: string,
  sharedNeed: string,
  desiredOutcome: string
): ProductMixAnalysis {
  const sellerCaps = seller.keyCapabilities && seller.keyCapabilities.length > 0
    ? seller.keyCapabilities
    : ['Continuous automated monitoring', 'High-fidelity workflow validation'];

  const fabMapping: FeatureAdvantageBenefit[] = sellerCaps.map((cap, idx) => ({
    feature: cap,
    advantage: `Directly targets ${sharedNeed} without requiring manual custom scripting`,
    customerBenefit: `Enables ${desiredOutcome} with rapid deployment and lower operational overhead`,
    isExisting: true,
  }));

  // Add potential product hypothesis
  fabMapping.push({
    feature: '[PROPOSED] Automated Remediation & Real-time Bi-directional Synchronization',
    advantage: 'Proactively corrects upstream schema breaks rather than merely alerting',
    customerBenefit: 'Complete self-healing reliability for mission-critical pipelines',
    isExisting: false,
  });

  return {
    coreBenefit: desiredOutcome,
    expectedProduct: [
      seller.pointOfParity || 'Standard alerting, role-based access control, and API/webhook connectivity',
      'Automated health check reporting and audit logging',
      'Data encryption in transit and at rest',
    ],
    augmentedProduct: [
      seller.pointOfDifference || 'Proprietary bidirectional simulation and continuous contract verification',
      ...sellerCaps.slice(0, 2),
      'Dedicated integration specialist for accelerated deployment',
    ],
    potentialProduct: [
      '[PROPOSED] Autonomous self-healing data pipeline failover',
      '[PROPOSED] Multi-cloud unified contract governance dashboard',
      '[PROPOSED] Real-time cost-to-serve telemetry and query optimization hints',
    ],
    fabMapping,
    pointOfParity: seller.pointOfParity || 'Category baseline: automated exception alerts and schema change audit logs.',
    pointOfDifference: seller.pointOfDifference || 'Proprietary edge: proactive contract verification before downstream pipelines break.',
    productGaps: [
      'Pre-built integrations for legacy on-premise ERP/CRM systems (if required by enterprise accounts)',
      'Automated single-click rollback for corrupted warehouse tables',
    ],
    productPriorities: [
      `Deepen compatibility with core data warehouses used by ${segmentName}`,
      'Minimize time-to-first-alert to under 15 minutes during pilot evaluation',
      'Provide downloadable executive compliance and reliability summaries',
    ],
    proposedFeatureImprovements: [
      '[PROPOSED] Slack and Teams interactive bot for immediate incident triage',
      '[PROPOSED] Synthetic test data generator for non-production staging environments',
    ],
  };
}

export function buildPriceMix(
  seller: SellerProfileContext,
  segmentName: string
): PriceMixAnalysis {
  const observedPricing = seller.typicalACV || seller.pricingModel || null;
  const isPriceKnown = Boolean(observedPricing && observedPricing.trim().length > 0);

  return {
    pricingApproach: 'Value-Based Pricing',
    rationale: `Price is aligned with the quantifiable business value of resolving acute operational friction (${segmentName}), rather than cost-plus hours or simplistic commodity tiers.`,
    monetaryCosts: observedPricing ? `Indicative baseline: ${observedPricing}` : 'PRICING RECOMMENDATION: PROVISIONAL — REAL ACV UNDISCLOSED',
    switchingCosts: 'Moderate: Requires updating downstream query dependencies and configuring warehouse service account IAM permissions.',
    implementationCosts: 'Low to Moderate: 1 to 2 weeks for data pipeline mapping and baseline validation.',
    costToServe: 'Scales with data pipeline complexity and daily query volume; unit economics require validation.',
    observedSellerPricing: observedPricing,
    isPricePointKnown: isPriceKnown,
    recommendedPricePoint: isPriceKnown
      ? `Indicative Tier: ${observedPricing} (Validate against buyer ROI threshold)`
      : 'PRICING RECOMMENDATION: PROVISIONAL — PRICE POINT: RESEARCH REQUIRED',
    recommendedPricingResearch: [
      'Conduct Van Westendorp Price Sensitivity Meter interviews with 10 target budget holders',
      'Audit customer cost-of-inaction (downtime cost, engineering triage hours) to calculate ROI ceiling',
      'Test two-part pricing structure (base platform fee + volume-based query contract allocation)',
      'Evaluate competitor price anchoring where public proposals or procurement quotes are verified',
    ],
  };
}

export function buildPlaceMix(
  seller: SellerProfileContext,
  segmentName: string
): PlaceMixAnalysis {
  return {
    distributionModel: 'Hybrid Direct & Partner',
    rationale: `Given the technical involvement and budget authorization required for ${segmentName}, inside sales paired with modern self-serve pilot environments optimizes conversion velocity while preserving enterprise trust.`,
    customerTouchpoints: [
      'Interactive product tour or sandboxed demo environment on website',
      'Technical discovery consultation with Solutions Architect',
      '2-week hands-on proof of concept in non-production staging warehouse',
      'Executive procurement and security review package delivery',
      'Post-contract dedicated Slack/Teams onboarding channel',
    ],
    implementationRequirements: [
      'Read-only warehouse IAM credentials or secure OAuth application connector',
      'Network whitelist configuration or VPC peering if behind enterprise firewalls',
      'Designated lead engineer on buyer team for initial pipeline verification',
    ],
    channelRisks: [
      'Extended enterprise infosec reviews stalling sales cycle',
      'Over-reliance on unverified third-party systems integrators without direct seller oversight',
    ],
    missingEvidence: [
      'Partner ecosystem channel margin requirements and referral agreements undisclosed',
      'Self-service customer acquisition funnel metrics unverified',
    ],
  };
}

export function buildPromotionMix(
  seller: SellerProfileContext,
  segmentName: string,
  sharedNeed: string,
  desiredOutcome: string,
  primaryBuyer: string
): PromotionMixAnalysis {
  const buyerRole = primaryBuyer || 'VP of Data & Engineering';

  return {
    decisionJourney: {
      needRecognition: `Triggered by an acute data pipeline failure, corrupted board metrics, or impending regulatory audit. The buyer realizes manual firefighting is unsustainable.`,
      searchForAlternatives: `Buyer evaluates in-house Python/dbt assert scripts, legacy database spot-check tools, and modern automated observability platforms.`,
      evaluationOfOptions: `Technical team compares time-to-value, query performance overhead, security architecture, and false-positive alert frequency.`,
      purchaseAdoption: `Procurement validates pricing against avoided downtime cost, securing sign-off from CTO/CFO.`,
      postPurchaseEvaluation: `Customer Success monitors pipeline uptime, alert actionability, and onboarding milestone completion over first 90 days.`,
    },
    needAwarenessMessage: `Is silent pipeline drift putting your executive reporting at risk? When upstream schemas change without warning, downstream decisions suffer.`,
    valuePropositionMessage: `${seller.valueProposition || `Eliminate data pipeline downtime and achieve ${desiredOutcome} with automated continuous contract testing.`}`,
    proofMessage: `Engineered for enterprise reliability with zero-copy validation, SOC2 Type II controls, and non-intrusive read-only execution.`,
    recommendedChannels: {
      ownedMedia: [
        'Interactive product sandbox tour',
        'Technical whitepaper: "Preventing Silent Data Corruption in High-Gravity Warehouses"',
        'Customer implementation blueprint checklist',
      ],
      earnedMedia: [
        'Open-source schema verification utilities and community technical blogs',
        'Guest presentations at data engineering and modern data stack meetups',
      ],
      paidMedia: [
        'Provisional: Targeted search campaigns on high-intent terms ("data contract testing", "dbt pipeline observability")',
      ],
      outboundDirect: [
        `Direct peer-to-peer outreach to ${buyerRole} titles at high-conviction accounts experiencing acute friction`,
      ],
      referralPartnerships: [
        'Co-marketing with cloud data warehouse ecosystem partners and modern analytics consultancies',
      ],
    },
    sampleDrafts: {
      headline: `Stop Silent Pipeline Failures Before They Corrupt Your Executive Dashboards.`,
      outreachAngle: `[SUGGESTED DRAFT] Hi {{FirstName}}, noticed {{Company}}'s modern stack with Snowflake/dbt. Most data teams we talk to lose 10+ hours a week troubleshooting undocumented schema changes that break executive reporting. We built an automated engine that verifies contracts before write-time. Worth a 15-minute technical walkthrough?`,
      discoveryQuestion: `When an upstream service changes a database column or data type without notice today, how long does it take your team to identify the break before a stakeholder flags it?`,
      educationalContentAngle: `Benchmark Guide: The True Cost of Data Pipeline Downtime in Scaleup Data Teams.`,
      callToAction: `Request a 14-day staging sandbox or schedule an architecture discovery session.`,
    },
  };
}

export function buildPeopleMix(
  seller: SellerProfileContext,
  primaryBuyer: string
): PeopleMixAnalysis {
  const buyer = primaryBuyer || 'VP of Data & Engineering';

  return {
    buyerFacingExpertise: [
      'Deep fluency in modern data warehouse architectures (Snowflake, Databricks, BigQuery, dbt)',
      'Ability to articulate data governance, compliance risk, and engineering ROI to C-level stakeholders',
      'Empathy for the daily incident firefights experienced by data engineers and analytics leads',
    ],
    salesConversationSkills: [
      'Challenger sales methodology: diagnosing hidden costs of status-quo inertia',
      'Technical qualification: identifying query volumes, pipeline topology, and budget timelines early',
      'Active listening: mapping specific past incident horrors to product contract verification',
    ],
    buyingCommitteeEngagement: {
      economicBuyerRole: `CTO / Chief Data Officer: Focus on executive governance, SLA compliance, and software spend justification.`,
      championRole: `${buyer}: Focus on operational tranquility, reducing weekend on-call pages, and team velocity.`,
      technicalEvaluatorRole: `Lead Data Engineer: Focus on security clearance, API documentation, query overhead, and CLI ease-of-use.`,
    },
    onboardingSupportModel: 'Dedicated Solutions Engineer during 14-day pilot, transitioning to a named Customer Success Manager upon contract execution.',
    trainingRequirements: [
      'Continuous quarterly training on emerging warehouse ecosystem features and security standards',
      'Standardized demo certification ensuring all customer-facing reps can deploy a working sandbox in 10 minutes',
    ],
    customerServiceTouchpoints: [
      'Direct shared Slack/Teams channel for priority accounts',
      'Sub-hour SLA for critical severity incident tickets',
      'Quarterly executive business reviews (EBRs) tracking verified pipeline uptime',
    ],
  };
}

export function buildProcessMix(
  seller: SellerProfileContext,
  segmentName: string
): ProcessMixAnalysis {
  const journeyStages: ProcessJourneyStage[] = [
    {
      stage: '1. Awareness & Discovery',
      customerAction: 'Interacts with technical educational content or receives targeted peer outreach.',
      sellerDelivery: 'Shares benchmark data on pipeline downtime and offers self-guided architecture tour.',
      frictionPoints: ['Skepticism of vendor marketing claims', 'Time constraints of busy engineering leads'],
      valueCreationMechanism: 'Validates and quantifies the hidden cost of the customer’s existing friction.',
      metricsToMonitor: ['Meeting booking rate', 'Discovery qualification rate'],
      requiresHumanVerification: true,
    },
    {
      stage: '2. Technical Qualification',
      customerAction: 'Participates in 30-minute architecture review and outlines current data pipeline topology.',
      sellerDelivery: 'Maps capabilities to specific pipeline blockers; assesses feasibility and compatibility.',
      frictionPoints: ['Unwillingness to disclose architecture without NDA', 'Unclear budget authority'],
      valueCreationMechanism: 'Confirms structural fit and establishes clear success criteria for pilot.',
      metricsToMonitor: ['Technical qualification pass rate', 'Pipeline scope clarity'],
      requiresHumanVerification: true,
    },
    {
      stage: '3. Staging Sandbox / Pilot',
      customerAction: 'Connects read-only credential to staging data warehouse and validates simulated breaks.',
      sellerDelivery: 'Provides automated deployment script and assists with initial contract configuration.',
      frictionPoints: ['IAM permission approvals delayed by internal DevOps', 'Query performance concerns'],
      valueCreationMechanism: 'Delivers undeniable physical proof of value on the customer’s actual data models.',
      metricsToMonitor: ['Time to first alert (<24 hrs target)', 'Pilot completion rate (≥80% target)'],
      requiresHumanVerification: true,
    },
    {
      stage: '4. Commercial & Security Close',
      customerAction: 'Submits vendor security questionnaire and reviews contract terms.',
      sellerDelivery: 'Delivers pre-filled SOC2 compliance package and transparent annual contract.',
      frictionPoints: ['Procurement legal redlines', 'Budget freeze or reallocation'],
      valueCreationMechanism: 'Minimizes administrative friction to enable rapid production adoption.',
      metricsToMonitor: ['Sales cycle duration (days)', 'Contract close rate'],
      requiresHumanVerification: true,
    },
    {
      stage: '5. Production Onboarding & Expansion',
      customerAction: 'Rolls out contracts across all core executive pipelines and invites engineering team.',
      sellerDelivery: 'Conducts team enablement workshop and configures proactive health monitoring.',
      frictionPoints: ['Slow team adoption of new verification workflows', 'Stale alerts'],
      valueCreationMechanism: 'Embeds the solution as permanent infrastructure, guaranteeing long-term pipeline integrity.',
      metricsToMonitor: ['Daily active alert reviews', 'Net revenue retention (NRR)'],
      requiresHumanVerification: false,
    },
  ];

  return {
    currentVsRecommended: {
      currentStateAssumption: 'Manual ad-hoc sales cycles with variable pilot durations and unstandardized success metrics.',
      recommendedStandardizedProcess: 'A rigid 5-stage customer journey with documented success criteria at each gate, reducing sales cycle duration and eliminating pilot stalls.',
    },
    journeyStages,
    serviceStandardizationRules: [
      'Never begin a pilot without written, mutually agreed success criteria and a confirmed decision date.',
      'Provide pre-compiled security documentation proactively during Discovery to cut infosec review lag by 50%.',
      'Automate sandbox provisioning so the customer experiences value within 30 minutes of credential grant.',
    ],
  };
}

export function buildPhysicalEvidenceMix(
  seller: SellerProfileContext,
  segmentName: string
): PhysicalEvidenceMixAnalysis {
  const existingProof: string[] = [];
  if (seller.website) existingProof.push(`Live product website and domain presence (${seller.website})`);
  if (seller.pointOfParity) existingProof.push(`Documented standard compliance baseline: ${seller.pointOfParity}`);

  const requiredProof: string[] = [
    'PROOF ASSET REQUIRED: SOC2 Type II compliance audit report and third-party penetration test summary',
    'PROOF ASSET REQUIRED: Verified customer case study demonstrating ≥20% win-rate or quantifiable downtime reduction',
    'PROOF ASSET REQUIRED: Interactive sandboxed product demo environment with pre-loaded mock anomalies',
    'PROOF ASSET REQUIRED: Public status page showing 99.99% historical service availability',
  ];

  return {
    existingProofAssets: existingProof,
    proofAssetsRequired: requiredProof,
    recommendedTrustSignals: [
      'Interactive sandbox environment permitting prospective buyers to trigger and resolve simulated anomalies',
      'Verifiable architecture diagrams demonstrating zero-copy, read-only metadata execution',
      'Transparent documentation portal with public API schemas and changelogs',
    ],
    documentationChecklist: [
      'Data security & privacy whitepaper detailing non-retention of sensitive customer records',
      'Step-by-step IAM warehouse deployment guide with copy-pasteable CLI commands',
      'Standard Master Services Agreement (MSA) and Business Associate Agreement (BAA) templates',
    ],
  };
}

export function generateSegment7PsMix(
  seller: SellerProfileContext,
  segmentId: string,
  segmentName: string,
  sharedNeed: string,
  desiredOutcome: string,
  primaryBuyer: string
): Segment7PsMarketingMix {
  return {
    segmentId,
    segmentName,
    product: buildProductMix(seller, segmentName, sharedNeed, desiredOutcome),
    price: buildPriceMix(seller, segmentName),
    place: buildPlaceMix(seller, segmentName),
    promotion: buildPromotionMix(seller, segmentName, sharedNeed, desiredOutcome, primaryBuyer),
    people: buildPeopleMix(seller, primaryBuyer),
    process: buildProcessMix(seller, segmentName),
    physicalEvidence: buildPhysicalEvidenceMix(seller, segmentName),
    generatedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// 2. INTEGRATED ACTION PLAN GENERATOR
// -----------------------------------------------------------------------------

export function generateIntegratedActionPlan(
  seller: SellerProfileContext,
  stpAnalysis: DatasetSTPAnalysis,
  scoredLeads: LeadICPScore[]
): {
  immediate: RecommendedActionItem[];
  next: RecommendedActionItem[];
  later: RecommendedActionItem[];
  whatToValidateFirst: string[];
} {
  const targetSeg = stpAnalysis.segments[0] || {
    id: 'segment-primary',
    name: 'Primary Candidate Segment',
    sharedProblem: 'Operational friction',
    desiredOutcome: 'Optimized workflow',
  };

  const tier1Leads = scoredLeads.filter((s) => s.tier === 'Tier 1: High Conviction');

  const immediate: RecommendedActionItem[] = [
    {
      id: 'act-imm-1',
      priority: 'IMMEDIATE',
      action: tier1Leads.length > 0
        ? `Launch a measured outbound test with ${tier1Leads.length} Tier 1 account${tier1Leads.length === 1 ? '' : 's'} using the ${targetSeg.name} positioning hook.`
        : `Qualify the highest-scoring accounts in ${targetSeg.name} through evidence gathering and discovery before launching Tier 1 outbound.`,
      linkedNeedGap: targetSeg.sharedProblem,
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Customer Buying Unit & Economic Buyer motivation',
      marketingMixDimension: 'promotion',
      suggestedRole: 'Account Executive / Outbound SDR',
      requiredInputs: tier1Leads.length > 0
        ? 'Verified lead contact info, customized positioning-led outreach drafts'
        : 'Verified account pain, buyer authority, budget evidence, and offering fit',
      successMetric: tier1Leads.length > 0
        ? '≥25% reply rate and ≥10% discovery meeting booking rate'
        : 'At least one account qualifies for Tier 1 with documented evidence',
      evidenceConfidence: tier1Leads.length > 0 ? 'high' : 'low',
      dependencies: tier1Leads.length > 0
        ? ['Lead list verified with valid domains', 'Value proposition message finalized']
        : ['Account evidence and qualification gaps documented'],
    },
    {
      id: 'act-imm-2',
      priority: 'IMMEDIATE',
      action: 'Assemble and publish the Proof Package (read-only IAM architecture overview and pilot checklist) to eliminate security friction.',
      linkedNeedGap: 'Security and vendor procurement hesitation',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Company technical credibility & regulatory context',
      marketingMixDimension: 'physical_evidence',
      suggestedRole: 'Head of Product / Security Lead',
      requiredInputs: 'Security architecture diagrams, IAM least-privilege policy spec',
      successMetric: 'Security questionnaire approval time reduced to <5 business days',
      evidenceConfidence: 'high',
      dependencies: ['Architecture documentation verified'],
    },
    {
      id: 'act-imm-3',
      priority: 'IMMEDIATE',
      action: 'Conduct structured discovery interviews with 5 accounts to validate friction severity and confirm willingness-to-pay ceiling.',
      linkedNeedGap: targetSeg.sharedProblem,
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Customer budget constraints & motivation to change',
      marketingMixDimension: 'price',
      suggestedRole: 'Founder / Product Marketing',
      requiredInputs: 'Van Westendorp price sensitivity interview protocol',
      successMetric: '5 completed interviews with documented cost-of-inaction estimates',
      evidenceConfidence: 'medium',
      dependencies: ['Target accounts agree to discovery call'],
    },
  ];

  const next: RecommendedActionItem[] = [
    {
      id: 'act-nxt-1',
      priority: 'NEXT',
      action: 'Standardize the 14-day staging sandbox onboarding flow with pre-configured validation contracts to accelerate time-to-first-alert.',
      linkedNeedGap: 'Delayed time-to-value during pilot evaluations',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Company delivery feasibility & customer engineering bandwidth',
      marketingMixDimension: 'process',
      suggestedRole: 'Solutions Engineer / Tech Lead',
      requiredInputs: 'Automated sandbox onboarding script, sample error dataset',
      successMetric: 'Time-to-first-alert achieved within 2 hours of credential grant',
      evidenceConfidence: 'high',
      dependencies: ['Staging sandbox environment operational'],
    },
    {
      id: 'act-nxt-2',
      priority: 'NEXT',
      action: 'Deliver sales enablement training on the Challenger sales conversation model and handling competitive Point of Parity objections.',
      linkedNeedGap: 'Status-quo inertia and competitor lock-in',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Competitor differentiation & sales team capability',
      marketingMixDimension: 'people',
      suggestedRole: 'Sales Lead',
      requiredInputs: 'Battlecards on competitive alternatives and table-stakes PoP',
      successMetric: '100% of sales reps certified on discovery objection handling',
      evidenceConfidence: 'medium',
      dependencies: ['Competitive analysis completed'],
    },
  ];

  const later: RecommendedActionItem[] = [
    {
      id: 'act-ltr-1',
      priority: 'LATER',
      action: 'Evaluate strategic channel partnerships with systems integrators and cloud warehouse consultancies once core direct motion achieves ≥20% win-rate.',
      linkedNeedGap: 'Long-term market expansion and channel leverage',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Collaborators & partner ecosystem alignment',
      marketingMixDimension: 'place',
      suggestedRole: 'VP of Business Development',
      requiredInputs: 'Partner commission economics and technical certification program',
      successMetric: '2 signed referral partners generating qualified inbound opportunities',
      evidenceConfidence: 'low',
      dependencies: ['Direct sales motion validated with closed-won proof'],
    },
    {
      id: 'act-ltr-2',
      priority: 'LATER',
      action: 'Prototype potential product improvements: Real-time autonomous remediation and self-healing pipeline recovery.',
      linkedNeedGap: 'Eliminating manual remediation overhead',
      linkedSegmentId: targetSeg.id,
      linkedSegmentName: targetSeg.name,
      fiveCConsideration: 'Company engineering innovation & product defensibility',
      marketingMixDimension: 'product',
      suggestedRole: 'VP of Engineering',
      requiredInputs: 'Customer feedback backlog, automated write-time rollback architecture',
      successMetric: 'Working prototype demonstrating safe zero-corruption table recovery',
      evidenceConfidence: 'medium',
      dependencies: ['Core detection engine stable in production'],
    },
  ];

  const whatToValidateFirst = [
    'Confirm that target budget holders actually perceive silent pipeline failures as a mission-critical threat rather than a tolerable annoyance.',
    'Verify that the seller can execute pilot deployments within 14 days without exhausting technical engineering capacity.',
    'Test whether prospective buyers will accept the proposed ACV range or if price point requires two-part usage-based structuring.',
    'Validate that closed-won deal data reaches ≥20% win-rate before scaling outbound marketing or hiring dedicated reps.',
  ];

  return { immediate, next, later, whatToValidateFirst };
}

// -----------------------------------------------------------------------------
// 3. COMPLETE EXECUTIVE ICP REPORT COMPOSITION SERVICE
// -----------------------------------------------------------------------------

export function composeExecutiveICPReport(
  seller: SellerProfileContext,
  datasetId: string,
  datasetFilename: string,
  ownerUserId: string,
  totalUploaded: number,
  needGapSummary: DatasetNeedGapSummary,
  fiveC: DetailedFiveCAnalysis,
  stpAnalysis: DatasetSTPAnalysis,
  scoredLeads: LeadICPScore[]
): ExecutiveICPReport {
  const targetSeg = stpAnalysis.segments[0] || {
    id: 'segment-01',
    name: 'Primary Candidate Segment',
    sharedProblem: seller.primaryProblemSolved || 'Operational friction',
    desiredOutcome: seller.valueProposition || 'Optimized operational workflow',
    companyCount: scoredLeads.length,
    datasetShare: 100,
  };

  // Compile 7Ps marketing mix for all identified segments
  const marketingMixBySegment: Record<string, Segment7PsMarketingMix> = {};
  for (const seg of stpAnalysis.segments) {
    marketingMixBySegment[seg.id] = generateSegment7PsMix(
      seller,
      seg.id,
      seg.name,
      seg.sharedProblem,
      seg.desiredOutcome,
      seller.primaryBuyer || 'VP of Data & Engineering'
    );
  }

  // Scoring distribution & metrics
  const tier1Count = scoredLeads.filter((s) => s.tier === 'Tier 1: High Conviction').length;
  const tier2Count = scoredLeads.filter((s) => s.tier === 'Tier 2: Moderate Fit').length;
  const tier3Count = scoredLeads.filter((s) => s.tier === 'Tier 3: Niche / Edge').length;
  const disqualifiedCount = scoredLeads.filter((s) => s.isDisqualified).length;
  const insufficientEvidenceCount = scoredLeads.filter((s) => s.isInsufficientEvidence).length;

  const totalCoverage = scoredLeads.reduce((acc, s) => acc + (s.evidenceCoverage ?? 100), 0);
  const averageEvidenceCoverage = scoredLeads.length > 0 ? Math.round(totalCoverage / scoredLeads.length) : 100;

  const topFitScore = scoredLeads.length > 0 ? Math.max(...scoredLeads.map((s) => s.totalScore)) : 0;
  const totalScoreSum = scoredLeads.reduce((acc, s) => acc + s.totalScore, 0);
  const averageFitScore = scoredLeads.length > 0 ? Number((totalScoreSum / scoredLeads.length).toFixed(1)) : 0;

  const actionPlan = generateIntegratedActionPlan(seller, stpAnalysis, scoredLeads);

  const versionFingerprint = `${datasetId}:${stpAnalysis.versionFingerprint || 'v1'}:${scoredLeads.length}:${new Date().toISOString().slice(0, 10)}`;

  // Governed Hypothesis Classification:
  // An observed win rate >= 20% alone does NOT establish independent statistical validation.
  // We distinguish: observed sales outcomes, customer-backed evidence, provisional hypothesis, and longitudinal validation.
  const leadsWithOutcomesCount = stpAnalysis.segments.reduce((acc, s) => acc + (s.outcomes?.leadsWithKnownOutcomes || 0), 0);
  const totalWonDeals = stpAnalysis.segments.reduce((acc, s) => acc + (s.outcomes?.wonDeals || 0), 0);
  const totalResolvedDeals = stpAnalysis.segments.reduce((acc, s) => acc + ((s.outcomes?.wonDeals || 0) + (s.outcomes?.lostDeals || 0)), 0);
  const aggregateWinRate = totalResolvedDeals > 0 ? Math.round((totalWonDeals / totalResolvedDeals) * 100) : null;
  const hasCustomerOutcomes = leadsWithOutcomesCount > 0 && totalResolvedDeals > 0;

  // By scientific standard, an ICP dossier remains an ICP Hypothesis until multi-cohort longitudinal study satisfies statistical power.
  const isProvisionalHypothesis = true;
  const governanceClassification = hasCustomerOutcomes
    ? `CUSTOMER-BACKED ICP HYPOTHESIS (Observed Win Rate: ${aggregateWinRate ?? 0}%)`
    : 'PROVISIONAL ICP HYPOTHESIS';

  return {
    id: `report-${datasetId}`,
    datasetId,
    datasetFilename,
    ownerUserId,
    sellerOfferingId: seller.id || 'seller-offering-01',
    sellerCompanyName: seller.companyName || 'Seller Organization',
    sellerProductName: seller.productName || 'Core Offering',
    title: `Ideal Customer Profile Strategic Intelligence Report // ${datasetFilename}`,
    generatedAt: new Date().toISOString(),
    analysisVersion: CURRENT_REPORT_MODEL_VERSION,
    versionFingerprint,
    isProvisionalHypothesis,
    governanceClassification,

    summaryMetrics: {
      totalUploaded,
      totalAnalyzed: scoredLeads.length,
      tier1Count,
      tier2Count,
      tier3Count,
      disqualifiedCount,
      insufficientEvidenceCount,
      averageEvidenceCoverage,
      dataQualityStatus: averageEvidenceCoverage >= 80 ? 'OPTIMAL' : averageEvidenceCoverage >= 65 ? 'ACCEPTABLE' : 'NEEDS_VERIFICATION',
    },

    executiveThesis: {
      problemAddressed: seller.primaryProblemSolved || 'Severe operational friction and manual pipeline overhead.',
      targetCohort: `${targetSeg.name} (${targetSeg.companyCount} accounts, ${targetSeg.datasetShare}% of cohort).`,
      recommendedSegmentName: targetSeg.name,
      relevanceRationale: tier1Count > 0
        ? `The offering may address the need pattern in ${targetSeg.name}; confirm capability overlap and buyer economics in discovery before treating fit as validated.`
        : `${targetSeg.name} is a candidate cohort, but the current account evidence does not establish high fit or economic feasibility.`,
      missingInformation: [
        'Multi-cohort longitudinal deal conversion data and statistical power verification',
        'Direct customer willingness-to-pay and unit-economics cost-to-serve metrics',
        'Documented competitor pricing proposals and contract terms',
      ],
      recommendationSummary: tier1Count === 0
        ? `No Tier 1 accounts qualify in this dataset. Gather stronger account and buyer evidence before launching an outbound sprint; the segment remains an ICP Hypothesis.`
        : hasCustomerOutcomes
          ? `Run a measured Tier 1 outbound test supported by observed sales outcomes (win rate: ${aggregateWinRate}% across ${totalResolvedDeals} resolved deals). Maintain hypothesis tracking until longitudinal validation across multiple cohorts is achieved.`
          : `Run a measured Tier 1 outbound test with the qualifying accounts, while treating segment conclusions as a Provisional ICP Hypothesis until customer-backed deal validation is recorded.`,
    },

    needGapSummary,
    fiveCAnalysis: fiveC,
    stpAnalysis,

    scoringSummary: {
      topFitScore,
      averageFitScore,
      highFitCount: tier1Count,
      scoreDistribution: {
        tier1: tier1Count,
        tier2: tier2Count,
        tier3: tier3Count,
        tier4Disqualified: disqualifiedCount,
        insufficientEvidence: insufficientEvidenceCount,
      },
    },

    scoredLeads,
    marketingMixBySegment,
    actionPlan,

    evidenceLimitations: {
      evidenceCoveragePercent: averageEvidenceCoverage,
      unknownAttributes: [
        'Buying intent is strictly marked UNKNOWN unless explicit CRM pipeline or won deals exist.',
        'Gross margins, CAC, and LTV remain unverified without accounting unit-economics records.',
        'Market size is evaluated strictly on the ingested sample; sample proportions are not confused with Total Addressable Market (TAM).',
      ],
      statutoryNotice: 'STATUTORY GOVERNANCE: Per ICP.MODE standards, all recommendations represent an ICP Hypothesis until closed-won deal data establishes statistical validation.',
      brandEquityNotice: 'BRAND EQUITY MEASUREMENT: NOT AVAILABLE (Requires longitudinal consumer/market survey instrumentation).',
    },
  };
}

// -----------------------------------------------------------------------------
// 4. PERSISTENCE REPOSITORIES
// -----------------------------------------------------------------------------

export function createSupabaseReportRepository(client: SupabaseClient): ReportRepository {
  return {
    async assertOwnedDataset(ownerUserId: string, datasetId: string): Promise<void> {
      const { data, error } = await client
        .from('datasets')
        .select('id')
        .eq('id', datasetId)
        .eq('owner_user_id', ownerUserId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to verify dataset ownership: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Dataset ${datasetId} not found or not owned by user.`);
      }
    },

    async getReport(ownerUserId: string, datasetId: string): Promise<ExecutiveICPReport | null> {
      const { data, error } = await client
        .from('icp_reports')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('dataset_id', datasetId)
        .maybeSingle();

      if (error || !data) return null;
      return data.report_json as unknown as ExecutiveICPReport;
    },

    async saveReport(ownerUserId: string, datasetId: string, report: ExecutiveICPReport): Promise<void> {
      const { error } = await client.from('icp_reports').upsert(
        {
          owner_user_id: ownerUserId,
          dataset_id: datasetId,
          seller_offering_id: report.sellerOfferingId,
          version_fingerprint: report.versionFingerprint,
          report_json: report as unknown as Record<string, unknown>,
          evidence_level: report.summaryMetrics.averageEvidenceCoverage >= 70 ? 'high' : 'moderate',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_user_id,dataset_id' }
      );

      if (error) {
        throw new Error(`Failed to persist executive report: ${error.message}`);
      }
    },
  };
}

export class InMemoryReportRepository implements ReportRepository {
  private reports = new Map<string, ExecutiveICPReport>();
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

  async getReport(ownerUserId: string, datasetId: string): Promise<ExecutiveICPReport | null> {
    return this.reports.get(`${ownerUserId}:${datasetId}`) || null;
  }

  async saveReport(ownerUserId: string, datasetId: string, report: ExecutiveICPReport): Promise<void> {
    this.reports.set(`${ownerUserId}:${datasetId}`, report);
  }
}
