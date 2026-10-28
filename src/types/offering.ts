export interface BuyerPersona {
  id: string;
  title: string;
  department: string;
  seniority: 'C-Level' | 'VP' | 'Director' | 'Manager' | 'Individual Contributor';
  coreMotivation: string;
  primaryFriction: string;
  hasBudgetAuthority: boolean;
}

export interface BuyerRole {
  id: string;
  role: string;
  seniority: 'C-Level' | 'VP' | 'Director' | 'Manager' | 'Practitioner';
  motivation: string;
  isDecisionMaker: boolean;
}

export interface SellerProductContext {
  id: string;
  isComplete: boolean;
  completionScore: number; // 0 - 100%
  lastSavedAt: string;

  // STEP 1: YOUR COMPANY
  companyName: string;
  website: string;
  industry: string;
  geography: string;

  // STEP 2: WHAT YOU SELL
  productName: string;
  productDescription: string;
  coreFeatures: string[];
  mainBenefit: string;
  businessModel: 'B2B SaaS' | 'Enterprise Software' | 'Tech-Enabled Services' | 'Marketplace' | 'API/DevTool' | 'Professional Services';
  indicativePricing: string; // e.g. "$36,000 / year"

  // STEP 3: WHO YOU HELP
  existingCustomers: string;
  targetBusinessTypes: string[];
  typicalCompanySize: string; // e.g. "50–500 FTE"
  targetGeography: string[];
  buyerRoles: BuyerRole[];
  usersVsDecisionMakers: {
    dailyUsers: string;
    decisionMakers: string;
    budgetHolders: string;
  };

  // STEP 4: THE CUSTOMER PROBLEM (Need Gap Framework)
  currentCustomerProblem: string; // Current state / Frustrating situation
  idealCustomerOutcome: string;   // Ideal state / Breakthrough
  problemIntensity: 'Critical / Mission-Critical' | 'Significant / High-Priority' | 'Moderate / Nice-to-Have';
  motivationToChange: string;     // Trigger to take action now
  purchaseInvolvement: string;    // Perceived friction, switching costs, implementation risk
  whyCustomersChoose: string;     // Why they choose your product
  mainAlternatives: string;       // Main alternatives (competitors, spreadsheets, in-house)
  pointOfParity: string;          // What table-stakes features you match
  pointOfDifference: string;      // Unfair advantage or proprietary differentiator
}

export interface OfferingProfile {
  id: string;
  companyName: string;
  website: string;
  productName: string;
  category: string;
  businessModel: 'B2B SaaS' | 'Enterprise Software' | 'Tech-Enabled Services' | 'Marketplace' | 'API/DevTool';
  pricingModel: 'Per Seat/Month' | 'Usage-Based' | 'Annual Contract Value (ACV)' | 'Tiered Flat Rate';
  typicalACV: string;
  valueProposition: string;
  primaryProblemSolved: string;
  keyCapabilities: string[];
  buyerPersonas: BuyerPersona[];
  icpHypothesis: {
    targetHeadcount: string;
    targetIndustries: string[];
    targetGeographies: string[];
    criticalTriggerEvents: string[];
    hypothesisRationale: string;
    isValidated: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_SELLER_CONTEXT: SellerProductContext = {
  id: 'seller-ctx-new', isComplete: false, completionScore: 0, lastSavedAt: '',
  companyName: '', website: '', industry: '', geography: '',
  productName: '', productDescription: '', coreFeatures: [], mainBenefit: '',
  businessModel: 'B2B SaaS', indicativePricing: '',
  existingCustomers: '', targetBusinessTypes: [], typicalCompanySize: '', targetGeography: [],
  buyerRoles: [], usersVsDecisionMakers: { dailyUsers: '', decisionMakers: '', budgetHolders: '' },
  currentCustomerProblem: '', idealCustomerOutcome: '',
  problemIntensity: 'Moderate / Nice-to-Have', motivationToChange: '', purchaseInvolvement: '',
  whyCustomersChoose: '', mainAlternatives: '', pointOfParity: '', pointOfDifference: '',
};

export const DEFAULT_SELLER_CONTEXT: SellerProductContext = {
  id: 'seller-ctx-default',
  isComplete: true,
  completionScore: 100,
  lastSavedAt: new Date().toISOString(),

  // Step 1: Your Company
  companyName: 'Synthetix Data Cloud',
  website: 'https://synthetix.io',
  industry: 'Enterprise B2B Software',
  geography: 'North America & Western Europe',

  // Step 2: What You Sell
  productName: 'DataReliability Engine',
  productDescription: 'Continuous data contract testing and schema anomaly detection for modern cloud data warehouses.',
  coreFeatures: [
    'Automated schema drift detection before warehouse ingestion',
    'Bidirectional dbt model and Snowflake synchronization checks',
    'Real-time Slack & PagerDuty alerts with root-cause traces',
    'Zero-copy anomaly simulation sandbox',
  ],
  mainBenefit: 'Helps teams catch schema changes before they disrupt important reports.',
  businessModel: 'B2B SaaS',
  indicativePricing: '$36,000 / year ($3,000/mo billed annually)',

  // Step 3: Who You Help
  existingCustomers: 'FinTech scaleups, healthcare data teams, enterprise e-commerce platforms',
  targetBusinessTypes: ['FinTech', 'HealthTech', 'E-commerce', 'High-Growth B2B SaaS'],
  typicalCompanySize: '150–1,500 FTE',
  targetGeography: ['United States', 'Canada', 'United Kingdom', 'European Union'],
  buyerRoles: [
    {
      id: 'br-1',
      role: 'VP of Data & Analytics',
      seniority: 'VP',
      motivation: 'More confidence in C-suite reporting with fewer surprise data incidents.',
      isDecisionMaker: true,
    },
    {
      id: 'br-2',
      role: 'Lead Analytics Engineer',
      seniority: 'Practitioner',
      motivation: 'Confidence when pushing changes to dbt without breaking downstream dashboards.',
      isDecisionMaker: false,
    },
  ],
  usersVsDecisionMakers: {
    dailyUsers: 'Analytics Engineers, Data Engineers, and BI Developers',
    decisionMakers: 'VP of Data / Head of Engineering',
    budgetHolders: 'Chief Technology Officer (CTO) or Chief Data Officer (CDO)',
  },

  // Step 4: The Customer Problem
  currentCustomerProblem: 'Data pipelines silently fail or corrupt columns when upstream engineering services change schemas without notice, misleading executive dashboards.',
  idealCustomerOutcome: 'Zero surprise pipeline failures with proactive schema contract verification and automated stakeholder notifications.',
  problemIntensity: 'Critical / Mission-Critical',
  motivationToChange: 'An embarrassing CEO or board-level dashboard error caused by broken data models.',
  purchaseInvolvement: 'Moderate friction: requires read-only IAM warehouse access and deployment review.',
  whyCustomersChoose: 'Designed to flag schema changes without modifying existing queries.',
  mainAlternatives: 'Homegrown Python/dbt assert scripts, Monte Carlo (enterprise pricing hurdle), or manual spot-checking.',
  pointOfParity: 'Standard schema validation and anomaly tracking alerts.',
  pointOfDifference: 'Bidirectional CI/CD contract simulation that catches breaks before warehouse write commits.',
};

/**
 * Calculates completion score and checks for missing required product context.
 */
export function calculateContextCompletion(ctx: Partial<SellerProductContext>): {
  score: number;
  isComplete: boolean;
  missingFields: string[];
} {
  const requirements: Array<{ field: keyof SellerProductContext; label: string; minLen?: number }> = [
    { field: 'companyName', label: 'Company Name', minLen: 2 },
    { field: 'industry', label: 'Company Industry', minLen: 2 },
    { field: 'productName', label: 'Product Name', minLen: 2 },
    { field: 'productDescription', label: 'Product Description', minLen: 10 },
    { field: 'mainBenefit', label: 'Main Benefit', minLen: 5 },
    { field: 'currentCustomerProblem', label: 'Customer Problem', minLen: 10 },
    { field: 'idealCustomerOutcome', label: 'Ideal Customer Outcome', minLen: 10 },
  ];

  const missing: string[] = [];
  let filledCount = 0;

  for (const req of requirements) {
    const val = ctx[req.field];
    if (typeof val === 'string' && val.trim().length >= (req.minLen || 1)) {
      filledCount++;
    } else {
      missing.push(req.label);
    }
  }

  // Also check coreFeatures and buyerRoles
  if (!ctx.coreFeatures || ctx.coreFeatures.length === 0 || !ctx.coreFeatures.some(f => f.trim().length > 0)) {
    missing.push('Core Features');
  } else {
    filledCount++;
  }

  if (!ctx.buyerRoles || ctx.buyerRoles.length === 0) {
    missing.push('Buyer Roles');
  } else {
    filledCount++;
  }

  const totalChecks = requirements.length + 2;
  const score = Math.round((filledCount / totalChecks) * 100);
  const isComplete = missing.length === 0;

  return { score, isComplete, missingFields: missing };
}

/**
 * Converts a SellerProductContext to the legacy OfferingProfile format.
 */
export function contextToOfferingProfile(ctx: SellerProductContext): OfferingProfile {
  return {
    id: ctx.id,
    companyName: ctx.companyName,
    website: ctx.website,
    productName: ctx.productName,
    category: ctx.industry,
    businessModel: (ctx.businessModel === 'Professional Services' ? 'Tech-Enabled Services' : ctx.businessModel) as OfferingProfile['businessModel'],
    pricingModel: 'Annual Contract Value (ACV)',
    typicalACV: ctx.indicativePricing,
    valueProposition: ctx.mainBenefit,
    primaryProblemSolved: ctx.currentCustomerProblem,
    keyCapabilities: ctx.coreFeatures,
    buyerPersonas: ctx.buyerRoles.map((br, idx) => ({
      id: br.id || `persona-${idx}`,
      title: br.role,
      department: 'Data & Analytics',
      seniority: (br.seniority === 'Practitioner' ? 'Individual Contributor' : br.seniority) as BuyerPersona['seniority'],
      coreMotivation: br.motivation,
      primaryFriction: ctx.purchaseInvolvement,
      hasBudgetAuthority: br.isDecisionMaker,
    })),
    icpHypothesis: {
      targetHeadcount: ctx.typicalCompanySize,
      targetIndustries: ctx.targetBusinessTypes,
      targetGeographies: ctx.targetGeography,
      criticalTriggerEvents: [ctx.motivationToChange],
      hypothesisRationale: `${ctx.whyCustomersChoose} Over alternatives: ${ctx.mainAlternatives}. Edge: ${ctx.pointOfDifference}`,
      isValidated: false,
    },
    createdAt: ctx.lastSavedAt,
    updatedAt: ctx.lastSavedAt,
  };
}
