import { z } from 'zod';

export const claimOriginSchema = z.enum(['uploaded', 'public_webpage', 'inferred', 'unknown']);
export const confidenceLevelSchema = z.enum(['high', 'medium', 'low']);

const claimMetadata = {
  origin: claimOriginSchema,
  confidence: confidenceLevelSchema,
  source_url: z.string().url().optional(),
  source_field: z.string().trim().min(1).max(120).optional(),
};

export const stringClaimSchema = z.object({
  value: z.string().trim().min(1).max(4_000),
  ...claimMetadata,
}).strict();

export const stringArrayClaimSchema = z.object({
  value: z.array(z.string().trim().min(1).max(500)).max(30),
  ...claimMetadata,
}).strict();

export const evidenceItemSchema = z.object({
  attribute: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1_000),
  origin: claimOriginSchema,
  source_url: z.string().url().optional(),
  source_field: z.string().trim().min(1).max(120).optional(),
}).strict();

export const companyIntelligenceSchema = z.object({
  company_type: stringClaimSchema,
  industry: stringClaimSchema,
  sub_industry: stringClaimSchema,
  business_model: stringClaimSchema,
  product_summary: stringClaimSchema,
  products: stringArrayClaimSchema,
  target_customers: stringArrayClaimSchema,
  value_proposition: stringClaimSchema,
  potential_business_needs: stringArrayClaimSchema,
  potential_buying_roles: stringArrayClaimSchema,
  company_size: stringClaimSchema,
  geography: stringClaimSchema,
  evidence: z.array(evidenceItemSchema).max(50),
  data_quality: z.object({
    completeness: confidenceLevelSchema,
    confidence: confidenceLevelSchema,
    missing_fields: z.array(z.string().trim().min(1).max(120)).max(30),
    limitations: z.array(z.string().trim().min(1).max(500)).max(30),
  }).strict(),
}).strict();

const sellerContextSchema = z.object({
  companyName: z.string().trim().max(200).optional(),
  productName: z.string().trim().max(200).optional(),
  productDescription: z.string().trim().max(4_000).optional(),
  coreFeatures: z.array(z.string().trim().max(500)).max(30).optional(),
  mainBenefit: z.string().trim().max(2_000).optional(),
  businessModel: z.string().trim().max(120).optional(),
  targetBusinessTypes: z.array(z.string().trim().max(200)).max(30).optional(),
  buyerRoles: z.array(z.object({
    role: z.string().trim().max(200),
    seniority: z.string().trim().max(100).optional(),
  }).strip()).max(30).optional(),
  currentCustomerProblem: z.string().trim().max(2_000).optional(),
  idealCustomerOutcome: z.string().trim().max(2_000).optional(),
}).strip();

const safeAttributeValueSchema = z.union([
  z.string().max(4_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(500)).max(30),
  z.null(),
]);

export const companyAnalysisInputSchema = z.object({
  sellerProductContext: sellerContextSchema,
  companyName: z.string().trim().min(1).max(300),
  companyDomain: z.string().trim().max(500).optional().default(''),
  companyProductDescription: z.string().trim().max(8_000).optional().default(''),
  companyAttributes: z.record(z.string().max(120), safeAttributeValueSchema).optional().default({}),
  publicWebsiteText: z.string().trim().max(20_000).optional(),
  publicWebsiteUrl: z.string().url().max(2_000).optional(),
  publicWebsiteFetchedAt: z.string().datetime().optional(),
  publicWebsiteFetchStatus: z.enum(['fetched', 'failed', 'disallowed', 'disabled']).optional(),
  userCorrectedDescription: z.string().trim().max(8_000).optional().default(''),
}).strict().superRefine((value, ctx) => {
  if (!value.companyDomain && !value.companyProductDescription &&
      Object.keys(value.companyAttributes).length === 0 && !value.publicWebsiteText) {
    ctx.addIssue({
      code: 'custom',
      path: ['companyProductDescription'],
      message: 'Provide a domain, product description, company attributes, or safely extracted public website text.',
    });
  }
});

export const companyAnalysisRequestSchema = companyAnalysisInputSchema.extend({
  leadId: z.string().uuid(),
});

export type ClaimOrigin = z.infer<typeof claimOriginSchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type CompanyIntelligence = z.infer<typeof companyIntelligenceSchema>;
export type CompanyAnalysisInput = z.infer<typeof companyAnalysisInputSchema>;
export type CompanyAnalysisRequest = z.infer<typeof companyAnalysisRequestSchema>;

export interface CompanyAnalysisEnvelope {
  analysis: CompanyIntelligence;
  provider: string;
  modelVersion: string;
  analyzedAt: string;
  cached: boolean;
  sourceMode: 'uploaded_only' | 'public_website' | 'both';
  websiteEvidence?: {
    source?: 'live' | 'sample';
    status: 'fetched' | 'failed' | 'disallowed' | 'disabled';
    sourceUrl: string | null;
    fetchedAt: string | null;
    title: string | null;
    metaDescription: string | null;
    headings: string[];
    mainContent: string;
    pagesFetched: string[];
    reason?: string;
  };
  userCorrectedDescription: string;
}
