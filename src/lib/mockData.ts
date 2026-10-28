import { OfferingProfile } from '../types/offering';
import { NormalizedLead } from '../types/lead';
import { FullStrategicAnalysis } from '../types/analysis';
import { LeadICPScore } from '../types/scoring';

export const SAMPLE_OFFERING: OfferingProfile = {
  id: 'offering-01',
  companyName: 'Synthetix Data Cloud',
  website: 'https://synthetix.io',
  productName: 'DataReliability Engine',
  category: 'Data Observability & Pipeline Testing',
  businessModel: 'B2B SaaS',
  pricingModel: 'Annual Contract Value (ACV)',
  typicalACV: '$36,000 / yr',
  valueProposition: 'Helps data teams catch broken transformations and schema drift before they affect downstream reporting.',
  primaryProblemSolved: 'Data engineering teams spend time investigating broken transformations and schema drift after dashboards fail.',
  keyCapabilities: [
    'Automated schema anomaly detection across dbt models',
    'Real-time query lineage tracking to root-cause failures',
    'Pre-merge PR data regression testing in CI/CD',
    'Incident SLA alerting to Slack and PagerDuty'
  ],
  buyerPersonas: [
    {
      id: 'persona-1',
      title: 'VP of Data Engineering',
      department: 'Data & Analytics',
      seniority: 'VP',
      coreMotivation: 'Guaranteed pipeline uptime and reducing team turnover caused by 2 AM incident fire drills.',
      primaryFriction: 'Fear of complex vendor agent installations and invasive database access.',
      hasBudgetAuthority: true
    },
    {
      id: 'persona-2',
      title: 'Head of Business Intelligence',
      department: 'Product Analytics',
      seniority: 'Director',
      coreMotivation: 'Executive trust in C-suite metrics and board reporting accuracy.',
      primaryFriction: 'Has to constantly explain why revenue numbers changed retrospectively.',
      hasBudgetAuthority: false
    }
  ],
  icpHypothesis: {
    targetHeadcount: '150–1,500 FTE',
    targetIndustries: ['FinTech', 'E-Commerce / Retail Tech', 'HealthTech', 'B2B SaaS'],
    targetGeographies: ['North America', 'Western Europe'],
    criticalTriggerEvents: [
      'Migrating from legacy data warehouse to Snowflake/Databricks',
      'Recent hiring of VP of Data or Head of Analytics',
      'High growth in active user data volume (>10M events/day)'
    ],
    hypothesisRationale: 'Companies with 150+ headcount have built dedicated data teams and multiple operational consumers. Silent pipeline breakages directly impact revenue decisions.',
    isValidated: false
  },
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-15T14:30:00Z'
};

export const SAMPLE_LEADS: NormalizedLead[] = [
  {
    id: 'lead-01',
    companyName: 'Finova Payments',
    domain: 'finovapay.com',
    industry: 'FinTech & Payments Infrastructure',
    headcount: 420,
    annualRevenue: '$65M',
    description: 'Real-time multi-currency settlement gateway for cross-border digital merchants.',
    country: 'United States',
    technologies: ['Snowflake', 'dbt', 'AWS Redshift', 'Kubernetes', 'PostgreSQL'],
    ingestedAt: '2026-03-20T08:15:00Z',
    isClean: true,
    aiClassification: {
      detectedIndustry: 'FinTech',
      businessModel: 'B2B SaaS',
      primaryProducts: ['Cross-border API Gateway', 'Real-time Reconciliation Engine'],
      targetAudience: 'Global eCommerce platforms and payment aggregators',
      perceivedPainPoints: [
        'Regulatory reporting penalties due to data latency',
        'Complex multi-warehouse reconciliation errors',
        'High compliance audit pressure'
      ],
      buyingMaturity: 'Enterprise Mature',
      confidenceScore: 0.94
    }
  },
  {
    id: 'lead-02',
    companyName: 'Loomis Health Analytics',
    domain: 'loomishealth.io',
    industry: 'Digital Health & Clinical Telemetry',
    headcount: 280,
    annualRevenue: '$40M',
    description: 'Patient outcome prediction models and remote clinical telemetry data pipelines.',
    country: 'United States',
    technologies: ['Databricks', 'Apache Spark', 'Snowflake', 'dbt', 'GCP BigQuery'],
    ingestedAt: '2026-03-20T08:15:00Z',
    isClean: true,
    aiClassification: {
      detectedIndustry: 'HealthTech',
      businessModel: 'B2B SaaS',
      primaryProducts: ['Clinical Telemetry Engine', 'Patient Risk Predictive Scoring'],
      targetAudience: 'Hospital networks and clinical research organizations',
      perceivedPainPoints: [
        'Strict HIPAA compliance invariants on data transformations',
        'Model drift caused by corrupted upstream telemetry inputs'
      ],
      buyingMaturity: 'Scaling',
      confidenceScore: 0.91
    }
  },
  {
    id: 'lead-03',
    companyName: 'Velociraptor Commerce',
    domain: 'velociraptor.shop',
    industry: 'E-Commerce / Direct-to-Consumer',
    headcount: 650,
    annualRevenue: '$110M',
    description: 'Omnichannel apparel marketplace operating across North America and Europe.',
    country: 'United Kingdom',
    technologies: ['Snowflake', 'Fivetran', 'Looker', 'Shopify Plus'],
    ingestedAt: '2026-03-20T08:15:00Z',
    isClean: true,
    aiClassification: {
      detectedIndustry: 'E-Commerce',
      businessModel: 'E-Commerce/Retail',
      primaryProducts: ['Apparel Marketplace', 'Dynamic Pricing Inventory'],
      targetAudience: 'Retail consumers and wholesale vendors',
      perceivedPainPoints: [
        'Inventory stockout reporting inconsistencies during flash sales',
        'High ad-spend attribution variance due to broken pixel pipelines'
      ],
      buyingMaturity: 'Scaling',
      confidenceScore: 0.88
    }
  },
  {
    id: 'lead-04',
    companyName: 'Kestrel Security Ops',
    domain: 'kestrelsec.io',
    industry: 'Cybersecurity Threat Detection',
    headcount: 180,
    annualRevenue: '$24M',
    description: 'Cloud posture management and threat detection for Kubernetes microservices.',
    country: 'Canada',
    technologies: ['Databricks', 'Kafka', 'ClickHouse', 'AWS Athena'],
    ingestedAt: '2026-03-20T08:15:00Z',
    isClean: true,
    aiClassification: {
      detectedIndustry: 'Cybersecurity',
      businessModel: 'B2B SaaS',
      primaryProducts: ['Runtime K8s Threat Sensor', 'CSPM Posture Dashboard'],
      targetAudience: 'DevSecOps and SOC security engineers',
      perceivedPainPoints: [
        'Terabyte-scale log ingestion dropped events',
        'Real-time streaming pipeline bottlenecks'
      ],
      buyingMaturity: 'Scaling',
      confidenceScore: 0.89
    }
  },
  {
    id: 'lead-05',
    companyName: 'Beacon Local Logistics',
    domain: 'beaconlogistics.net',
    industry: 'Freight Forwarding & Regional Trucking',
    headcount: 85,
    annualRevenue: '$12M',
    description: 'Midwest regional freight broker and dispatch service.',
    country: 'United States',
    technologies: ['Excel', 'QuickBooks', 'Legacy AS400 TMS'],
    ingestedAt: '2026-03-20T08:15:00Z',
    isClean: true,
    aiClassification: {
      detectedIndustry: 'Logistics',
      businessModel: 'Professional Services',
      primaryProducts: ['Regional Dispatch', 'Freight Brokerage'],
      targetAudience: 'Industrial manufacturers and regional truckers',
      perceivedPainPoints: [
        'Manual phone dispatching',
        'Paper bill of lading delays'
      ],
      buyingMaturity: 'Early',
      confidenceScore: 0.82
    }
  }
];

export const SAMPLE_STRATEGIC_ANALYSIS: FullStrategicAnalysis = {
  offeringId: 'offering-01',
  analyzedAt: '2026-03-20T09:00:00Z',
  cohortHypothesisSummary: 'Strong clustering around modern data stack operators (Snowflake/dbt). FinTech and Clinical HealthTech demonstrate highest need urgency driven by compliance and monetary impact of silent pipeline failures.',
  needGaps: [
    {
      leadId: 'lead-01',
      companyName: 'Finova Payments',
      identifiedNeed: 'Automated reconciliation and data pipeline observability before regulatory ledger settlement.',
      gapMagnitude: 'Acute',
      urgencyDriver: 'Recent audit findings requiring real-time lineage of financial transaction logs.',
      offeringCapabilityMatch: 'Automated dbt schema anomaly detection & query lineage directly maps to ledger verification.',
      consequenceOfInaction: 'Regulatory non-compliance fines and retroactive balance sheet restatements.',
      gapScore: 94
    },
    {
      leadId: 'lead-02',
      companyName: 'Loomis Health Analytics',
      identifiedNeed: 'Continuous clinical telemetry validation preventing corrupted patient outcome model inference.',
      gapMagnitude: 'Acute',
      urgencyDriver: 'FDA clinical model submission requires auditable data pipeline transformation integrity.',
      offeringCapabilityMatch: 'Pre-merge PR regression testing in CI/CD could help detect transformation changes.',
      consequenceOfInaction: 'Erroneous clinical telemetry risk scoring and halted hospital enterprise pilots.',
      gapScore: 91
    },
    {
      leadId: 'lead-03',
      companyName: 'Velociraptor Commerce',
      identifiedNeed: 'Inventory and ad attribution pipeline drift alerts during high-velocity promotional drops.',
      gapMagnitude: 'Moderate',
      urgencyDriver: 'Marketing team reporting discrepancies between Shopify and Snowflake Looker dashboards.',
      offeringCapabilityMatch: 'Real-time anomaly detection and Slack incident routing for data engineers.',
      consequenceOfInaction: 'Wasted ad budget and inventory stockouts.',
      gapScore: 78
    },
    {
      leadId: 'lead-04',
      companyName: 'Kestrel Security Ops',
      identifiedNeed: 'Pipeline monitoring for high-throughput streaming threat intelligence logs.',
      gapMagnitude: 'Moderate',
      urgencyDriver: 'Engineering team burdened with maintaining custom Prometheus alerts on Kafka topics.',
      offeringCapabilityMatch: 'Automated anomaly detection across transformation pipelines.',
      consequenceOfInaction: 'Delayed security incident detection windows.',
      gapScore: 72
    },
    {
      leadId: 'lead-05',
      companyName: 'Beacon Local Logistics',
      identifiedNeed: 'No modern data stack present; primary operations run on spreadsheets and legacy TMS.',
      gapMagnitude: 'Negligible',
      urgencyDriver: 'None. Firm is not operating modern cloud data pipelines.',
      offeringCapabilityMatch: 'No compatibility with legacy non-cloud TMS spreadsheets.',
      consequenceOfInaction: 'None relevant to offering.',
      gapScore: 12
    }
  ],
  fiveC: {
    company: {
      internalCapabilities: 'Synthetix possesses native dbt integrations, automated PR regression testing, and SOC 2 Type II compliance.',
      resourceReadiness: 'High engineering readiness for Snowflake / Databricks environments.',
      strategicPriority: 'Capture mid-market FinTech and HealthTech accounts with 200–800 headcount.'
    },
    customers: {
      economicBuyer: 'VP of Data Engineering / Head of Platform Infrastructure.',
      championPersona: 'Senior Analytics Engineer or Lead Data Platform Engineer.',
      primaryObstacle: 'Vendor fatigue and concern over read-access credential scopes.',
      decisionCycleEstimate: '35–55 days for mid-market; 90+ days for enterprise.'
    },
    competitors: {
      currentAlternative: 'Monte Carlo Data, Great Expectations (open-source), homegrown SQL test suites.',
      switchingFriction: 'Medium to High if existing custom SQL dbt tests already exist.',
      differentiationAdvantage: 'Zero-agent CI/CD pre-merge testing prevents corrupted data before it reaches production tables.'
    },
    collaborators: {
      systemIntegrators: 'Boutique Modern Data Stack consultancies (e.g., Montreal Analytics, Brooklyn Data Co).',
      ecosystemPartners: 'dbt Labs Technology Partner program, Snowflake Partner Network.'
    },
    context: {
      regulatoryFactors: 'Stricter SEC cybersecurity disclosures and healthcare HIPAA data integrity mandates.',
      economicClimate: 'Data team budgets require proof of hard ROI: replacing 1-2 junior test engineers or stopping $100k outages.',
      technologicalShifts: 'Rapid migration from legacy Hadoop/On-prem to Snowflake & Databricks Lakehouse.'
    }
  },
  stpSegments: [
    {
      id: 'stp-1',
      segmentName: 'Regulated Data Ops (FinTech & HealthTech)',
      problemDefinition: 'Mission-critical compliance pipelines where broken transformations carry immediate legal and financial exposure.',
      leadCount: 2,
      averageNeedScore: 92.5,
      targetAttractiveness: 'Tier 1 Priority',
      recommendedPositioningAngle: 'The zero-compromise audit-grade data reliability platform for regulated engineering teams.',
      valueNarrative: 'Guarantee transformation invariants before financial or clinical ledgers settle.',
      matchedLeadIds: ['lead-01', 'lead-02']
    },
    {
      id: 'stp-2',
      segmentName: 'High-Velocity Product & Commerce Analytics',
      problemDefinition: 'Fast-growing marketplaces where ad spend and inventory decisions depend on real-time Looker dashboards.',
      leadCount: 2,
      averageNeedScore: 75.0,
      targetAttractiveness: 'Tier 2 Secondary',
      recommendedPositioningAngle: 'Prevent dashboard fire drills and eliminate revenue attribution blind spots.',
      valueNarrative: 'Keep growth marketing and product executives trusting their real-time numbers.',
      matchedLeadIds: ['lead-03', 'lead-04']
    },
    {
      id: 'stp-3',
      segmentName: 'Traditional Legacy Services',
      problemDefinition: 'Non-cloud infrastructure with manual operational workflows.',
      leadCount: 1,
      averageNeedScore: 12.0,
      targetAttractiveness: 'Avoid',
      recommendedPositioningAngle: 'Not a fit for cloud data observability.',
      valueNarrative: 'Out of scope.',
      matchedLeadIds: ['lead-05']
    }
  ],
  marketingMix: {
    productResonance: 'Strong feature alignment with modern data teams (dbt CI/CD regression tests). Needs SOC 2 bridge.',
    priceAcceptability: 'Pricing fit needs validation with the buyer and their budget.',
    placeChannelFit: 'Direct outbound to VP Data Engineering combined with dbt community co-marketing.',
    promotionHook: '"How could earlier dbt alerts help before a monthly ledger audit?"'
  }
};

export const SAMPLE_SCORES: LeadICPScore[] = [
  {
    leadId: 'lead-01',
    companyName: 'Finova Payments',
    domain: 'finovapay.com',
    totalScore: 91.5,
    tier: 'Tier 1: High Conviction',
    confidence: 0.94,
    isHypothesisOnly: true,
    breakdown: [
      {
        criterion: 'Need Urgency & Financial Consequence',
        weightPct: 35,
        maxPoints: 35,
        awardedPoints: 33.5,
        auditRationale: 'Acute need identified in financial ledger reconciliation; regulatory penalty risk creates immediate buying window.'
      },
      {
        criterion: 'Offering Capability Match',
        weightPct: 25,
        maxPoints: 25,
        awardedPoints: 24.0,
        auditRationale: 'Native Snowflake and dbt stack detected; direct coverage by Synthetix automated lineage engine.'
      },
      {
        criterion: 'Stakeholder & Economic Feasibility',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 18.0,
        auditRationale: '420 FTE and $65M revenue ensures established VP of Data Engineering with $50k+ discretionary tool budget.'
      },
      {
        criterion: 'Firmographic & Stack Alignment',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 16.0,
        auditRationale: 'Ideal headcount sweet spot (150–1,500 FTE); active technology adoption in North America.'
      }
    ],
    primaryStrengths: [
      'Active Snowflake & dbt stack',
      'Acute monetary impact of pipeline downtime',
      'High buying maturity and executive sponsorship'
    ],
    primaryDisqualifiers: [],
    recommendedAction: 'Immediate Outreach',
    scoredAt: '2026-03-20T09:15:00Z'
  },
  {
    leadId: 'lead-02',
    companyName: 'Loomis Health Analytics',
    domain: 'loomishealth.io',
    totalScore: 88.0,
    tier: 'Tier 1: High Conviction',
    confidence: 0.91,
    isHypothesisOnly: true,
    breakdown: [
      {
        criterion: 'Need Urgency & Financial Consequence',
        weightPct: 35,
        maxPoints: 35,
        awardedPoints: 32.0,
        auditRationale: 'FDA model submission timeline imposes strict deadlines on auditable data transformations.'
      },
      {
        criterion: 'Offering Capability Match',
        weightPct: 25,
        maxPoints: 25,
        awardedPoints: 23.0,
        auditRationale: 'Databricks and Spark stack supported by CI/CD pre-merge test suite.'
      },
      {
        criterion: 'Stakeholder & Economic Feasibility',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 17.0,
        auditRationale: '280 FTE well-funded digital health scaleup; clear decision makers in clinical telemetry.'
      },
      {
        criterion: 'Firmographic & Stack Alignment',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 16.0,
        auditRationale: 'High alignment with healthtech ICP hypothesis parameters.'
      }
    ],
    primaryStrengths: [
      'Regulatory compliance urgency (FDA/HIPAA)',
      'High data engineering team density',
      'Modern Databricks lakehouse deployment'
    ],
    primaryDisqualifiers: [],
    recommendedAction: 'Immediate Outreach',
    scoredAt: '2026-03-20T09:15:00Z'
  },
  {
    leadId: 'lead-03',
    companyName: 'Velociraptor Commerce',
    domain: 'velociraptor.shop',
    totalScore: 76.5,
    tier: 'Tier 2: Moderate Fit',
    confidence: 0.88,
    isHypothesisOnly: true,
    breakdown: [
      {
        criterion: 'Need Urgency & Financial Consequence',
        weightPct: 35,
        maxPoints: 35,
        awardedPoints: 26.5,
        auditRationale: 'Moderate urgency around reporting discrepancies; business continues operating despite errors.'
      },
      {
        criterion: 'Offering Capability Match',
        weightPct: 25,
        maxPoints: 25,
        awardedPoints: 21.0,
        auditRationale: 'Compatible with Snowflake and Looker, though ad-pixel pipelines require custom integration.'
      },
      {
        criterion: 'Stakeholder & Economic Feasibility',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 16.0,
        auditRationale: '650 FTE provides budget, but e-commerce margins often scrutinize infrastructure software costs.'
      },
      {
        criterion: 'Firmographic & Stack Alignment',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 13.0,
        auditRationale: 'Headcount matches profile; UK geography introduces minor time zone support delay.'
      }
    ],
    primaryStrengths: [
      'Modern Snowflake data warehouse',
      'High data transaction volume'
    ],
    primaryDisqualifiers: [
      'Margin sensitivity may extend sales cycle',
      'Secondary need urgency compared to regulated accounts'
    ],
    recommendedAction: 'Nurture Campaign',
    scoredAt: '2026-03-20T09:15:00Z'
  },
  {
    leadId: 'lead-04',
    companyName: 'Kestrel Security Ops',
    domain: 'kestrelsec.io',
    totalScore: 71.0,
    tier: 'Tier 2: Moderate Fit',
    confidence: 0.89,
    isHypothesisOnly: true,
    breakdown: [
      {
        criterion: 'Need Urgency & Financial Consequence',
        weightPct: 35,
        maxPoints: 35,
        awardedPoints: 23.5,
        auditRationale: 'Engineering friction is real, but team prefers internal DIY scripts in Prometheus/Grafana.'
      },
      {
        criterion: 'Offering Capability Match',
        weightPct: 25,
        maxPoints: 25,
        awardedPoints: 19.5,
        auditRationale: 'ClickHouse and Kafka streaming require higher integration effort than batch dbt.'
      },
      {
        criterion: 'Stakeholder & Economic Feasibility',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 14.5,
        auditRationale: '180 FTE has early budget authority; VP of Eng is target buyer.'
      },
      {
        criterion: 'Firmographic & Stack Alignment',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 13.5,
        auditRationale: 'B2B SaaS with high technical literacy.'
      }
    ],
    primaryStrengths: [
      'High technical competence',
      'Cloud-native Kubernetes architecture'
    ],
    primaryDisqualifiers: [
      'DIY engineering bias',
      'Streaming infrastructure requires non-standard connectors'
    ],
    recommendedAction: 'Further Discovery',
    scoredAt: '2026-03-20T09:15:00Z'
  },
  {
    leadId: 'lead-05',
    companyName: 'Beacon Local Logistics',
    domain: 'beaconlogistics.net',
    totalScore: 16.5,
    tier: 'Tier 4: Disqualified',
    confidence: 0.82,
    isHypothesisOnly: true,
    breakdown: [
      {
        criterion: 'Need Urgency & Financial Consequence',
        weightPct: 35,
        maxPoints: 35,
        awardedPoints: 3.5,
        auditRationale: 'No cloud data pipeline problem exists; operational pains are operational and manual.'
      },
      {
        criterion: 'Offering Capability Match',
        weightPct: 25,
        maxPoints: 25,
        awardedPoints: 2.0,
        auditRationale: 'Synthetix cannot integrate with Excel spreadsheets or legacy on-premise AS400 TMS.'
      },
      {
        criterion: 'Stakeholder & Economic Feasibility',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 4.0,
        auditRationale: 'No data engineering department or budget allocation.'
      },
      {
        criterion: 'Firmographic & Stack Alignment',
        weightPct: 20,
        maxPoints: 20,
        awardedPoints: 7.0,
        auditRationale: 'Headcount below 100 FTE; non-technical industrial trucking vertical.'
      }
    ],
    primaryStrengths: [],
    primaryDisqualifiers: [
      'No cloud data warehouse present',
      'No data engineering roles in company',
      'Zero compatibility with legacy tech stack'
    ],
    recommendedAction: 'Archive / Ignore',
    scoredAt: '2026-03-20T09:15:00Z'
  }
];
