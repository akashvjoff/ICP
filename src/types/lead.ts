/**
 * Lead Data Model & Normalization Definitions
 * Stage: MVP 1
 */

export interface RawLeadRecord {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ColumnMapping {
  // Required identifier: at least one of companyName or domain MUST be mapped
  companyName?: string;
  domain?: string;

  // Optional firmographics
  industry?: string;
  headcount?: string;
  annualRevenue?: string;
  description?: string;
  country?: string;
  technologies?: string;
  companyType?: string;
  businessModel?: string;
  product?: string;

  // Optional commercials & CRM pipeline
  leadStage?: string;
  dealValue?: string;
  currency?: string;
  retentionMonths?: string;
  customerPain?: string;
  reasonWonLost?: string;
}

export type BusinessModelType = 
  | 'B2B SaaS' 
  | 'Enterprise Software' 
  | 'Professional Services' 
  | 'E-Commerce/Retail' 
  | 'FinTech' 
  | 'Healthcare/BioTech' 
  | 'Manufacturing' 
  | 'Unknown';

export interface AIClassification {
  detectedIndustry: string;
  businessModel: BusinessModelType;
  primaryProducts: string[];
  targetAudience: string;
  perceivedPainPoints: string[];
  buyingMaturity: 'Early' | 'Scaling' | 'Enterprise Mature';
  confidenceScore: number;
}

export type EnrichmentTier = 'full' | 'limited' | 'stored_only';

export interface NormalizedLead {
  id: string;
  companyName: string;
  domain: string | null; // null if website was absent - WE NEVER INVENT A DOMAIN
  website?: string | null;
  hasValidDomain?: boolean;
  industry: string;
  headcount: number | null;
  annualRevenue: string | null;
  annualRevenueValue?: number | null;
  description: string;
  country: string;
  technologies: string[];
  aiClassification?: AIClassification;
  
  // Optional CRM & pipeline attributes
  companyType?: string;
  businessModel?: string;
  productRaw?: string;
  leadStage?: string;
  dealValue?: number | null;
  currency?: string | null;
  retentionMonths?: number | null;
  customerPain?: string;
  reasonWonLost?: string;
  userCorrectedDescription?: string | null;

  // AI vs Stored row separation
  isAiEnriched?: boolean; // true for up to 100 rows in free/demo tier
  enrichmentTier?: EnrichmentTier; // 'full' (has domain & within limit), 'limited' (no domain), 'stored_only' (rows > 100)
  analysisStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

  // Data hygiene & duplicates
  isClean: boolean;
  isDuplicate?: boolean;
  duplicateReason?: string;
  duplicateGroupKey?: string;
  validationWarnings?: string[];

  // Original audit record
  rawRow?: RawLeadRecord;
  ingestedAt: string;
}

export interface IngestionError {
  rowNumber: number;
  companyName?: string;
  domain?: string;
  reason: string;
  raw: RawLeadRecord;
}

export interface DuplicateGroup {
  key: string;
  type: 'exact_domain' | 'exact_name' | 'uncertain';
  normalizedDomain?: string;
  companyName?: string;
  leads: NormalizedLead[];
}

export interface LeadValidationSummary {
  totalRowsParsed: number;
  validRowsCount: number;
  invalidRowsCount: number;
  duplicateRowsCount: number;
  aiEligibleCount: number;
  storedOnlyCount: number;
  missingOptionalValuesCount: number;
  recordsWithMissingOptionalValues: number;
  hasPiiAlert: boolean;
  piiColumnsDetected: string[];
}
