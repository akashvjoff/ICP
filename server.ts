import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PLANS, PAID_PLAN_IDS, BILLING_INTERVALS, BILLING_CURRENCIES } from './src/config/plans.ts';
import {
  classifyCompanyWithAI,
  runStrategicMarketingAnalysis,
  suggestSellerOnboardingContext,
} from './src/server/gemini.ts';
import { calculateDeterministicICPScore, batchScoreLeads } from './src/lib/scoring.ts';
import { OfferingProfile } from './src/types/offering.ts';
import { NormalizedLead } from './src/types/lead.ts';
import { SAMPLE_OFFERING, SAMPLE_LEADS, SAMPLE_STRATEGIC_ANALYSIS, SAMPLE_SCORES } from './src/lib/mockData.ts';
import {
  createSupabaseUploadRepository,
  getBearerToken,
  persistPreparedUpload,
  prepareUpload,
  UploadValidationError,
} from './src/server/upload.ts';
import {
  createRequireAuthenticatedUser,
  createVerifyAuth,
  createUserScopedSupabase as createScopedSupabaseClient,
  type AuthenticatedRequest,
} from './src/server/authMiddleware.ts';
import { companyAnalysisRequestSchema, type CompanyAnalysisEnvelope } from './src/types/companyIntelligence.ts';
import { CompanyAnalysisError, createCompanyAnalyzer } from './src/server/companyAnalyzer.ts';
import {
  analyzeCompanyWithCache,
  createSupabaseCompanyAnalysisRepository,
  InMemoryCompanyAnalysisRepository,
} from './src/server/companyIntelligenceService.ts';
import { enrichFromPublicWebsite } from './src/server/websiteEnrichment.ts';
import {
  createSupabaseAnalysisJobRepository,
  InMemoryAnalysisJobRepository,
  startJob,
  pauseJob,
  resumeJob,
  cancelJob,
  retryFailedLeads,
  calculateJobProgress,
  type AnalysisJobRepository,
  type LeadForAnalysis,
} from './src/server/analysisJobService.ts';
import { startAnalysisWorker } from './src/server/analysisWorker.ts';
import {
  analyzeLeadNeedGap,
  toScoringNeedGap,
  aggregateDatasetNeedGaps,
  synthesizeDetailedFiveC,
  createSupabaseStrategicAnalysisRepository,
  InMemoryStrategicAnalysisRepository,
  type StrategicAnalysisRepository,
  type SellerProfileContext,
} from './src/server/strategicAnalysisService.ts';
import {
  buildDatasetSTPAnalysis,
  createSupabaseSTPRepository,
  InMemorySTPRepository,
  type STPRepository,
} from './src/server/stpService.ts';
import {
  createSupabaseScoringRepository,
  InMemoryScoringRepository,
  type ScoringRepository,
} from './src/server/scoringService.ts';
import {
  validateScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
  CURRENT_SCORING_MODEL_VERSION,
} from './src/lib/scoring.ts';
import {
  composeExecutiveICPReport,
  createSupabaseReportRepository,
  InMemoryReportRepository,
  CURRENT_REPORT_MODEL_VERSION,
  type ReportRepository,
} from './src/server/reportService.ts';
import type { ExecutiveICPReport } from './src/types/analysis.ts';
import { canExport, COMPANY_COLUMNS, CONTACT_COLUMNS, encodeExport, exportFilename, exportQuerySchema, selectExportRows, type ExportContact } from './src/server/exportService.ts';
import { captureServerFailure, trackServerEvent } from './src/server/telemetry.ts';
import { deleteAccountData, exportAccountData } from './src/server/accountDataService.ts';
import { billingPeriodStart, canAnalyzeCompany, cancelDodoSubscription, createCheckout, createPortalLink, getBillingUsage, getEntitlements, processDodoWebhook } from './src/server/billingService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.post('/api/billing/webhook/dodo', express.raw({ type: 'application/json', limit: '1mb' }), async (req: Request, res: Response) => {
  if (!serverSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'Billing storage is unavailable.' });
  try {
    const headers = {
      'webhook-id': String(req.header('webhook-id') || ''),
      'webhook-timestamp': String(req.header('webhook-timestamp') || ''),
      'webhook-signature': String(req.header('webhook-signature') || ''),
    };
    await processDodoWebhook(serverSupabase, (req.body as Buffer).toString('utf8'), headers);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Billing] Rejected webhook:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(400).json({ error: 'Invalid webhook.' });
  }
});
app.use(express.json({ limit: '10mb' }));

// Server-side Supabase client (using service role or anon key if present)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseServiceKey &&
  !supabaseUrl.includes('YOUR_PROJECT_ID') &&
  supabaseUrl.startsWith('https://')
);

const serverSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;
let companyAnalyzer: ReturnType<typeof createCompanyAnalyzer> | null = null;

function getCompanyAnalyzer() {
  companyAnalyzer ||= createCompanyAnalyzer(process.env);
  return companyAnalyzer;
}

async function reserveDailyCompany(ownerUserId: string): Promise<boolean> {
  if (!serverSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('AI budget service is unavailable.');
  const configuredLimit = Number.parseInt(process.env.AI_DAILY_COMPANIES_PER_USER || '200', 10);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 200;
  const { data, error } = await serverSupabase.rpc('reserve_ai_daily_company', {
    p_owner_user_id: ownerUserId, p_limit: limit,
  });
  if (error) throw error;
  return data === true;
}

function createUserScopedSupabase(accessToken: string): SupabaseClient {
  return createScopedSupabaseClient(supabaseUrl, supabaseAnonKey, accessToken);
}

async function getSavedSellerOffering(req: AuthenticatedRequest): Promise<{ seller: SellerProfileContext; offering: OfferingProfile }> {
  const client = createUserScopedSupabase(req.accessToken!);
  const { data, error } = await client.from('seller_profiles')
    .select('id, company_name, website, product_description, main_customer_problem, primary_buyer, onboarding_data')
    .eq('owner_user_id', req.user!.id).maybeSingle();
  if (error) throw error;
  const details = (data?.onboarding_data || {}) as Record<string, unknown>;
  const problem = String(data?.main_customer_problem || details.currentCustomerProblem || '').trim();
  const capabilities = Array.isArray(details.coreFeatures) ? details.coreFeatures.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
  if (!data || !problem || capabilities.length === 0) throw new Error('Complete your offering problem and capabilities in your profile before analysis.');
  const seller: SellerProfileContext = {
    id: data.id, companyName: data.company_name, website: data.website || '',
    productName: String(details.productName || ''), productDescription: data.product_description || '',
    valueProposition: String(details.mainBenefit || ''), primaryProblemSolved: problem,
    mainCustomerProblem: problem, keyCapabilities: capabilities,
    primaryBuyer: data.primary_buyer || '',
  };
  const offering: OfferingProfile = {
    id: data.id, companyName: data.company_name, website: data.website || '',
    productName: seller.productName || data.company_name, category: String(details.industry || ''),
    businessModel: 'B2B SaaS', pricingModel: 'Annual Contract Value (ACV)', typicalACV: '',
    valueProposition: seller.valueProposition || '', primaryProblemSolved: problem,
    keyCapabilities: capabilities, buyerPersonas: [],
    icpHypothesis: { targetHeadcount: '', targetIndustries: [], targetGeographies: [], criticalTriggerEvents: [], hypothesisRationale: 'Requires customer validation.', isValidated: false },
    createdAt: '', updatedAt: '',
  };
  return { seller, offering };
}

function respondToDatasetReadError(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (/^Dataset (?:.+ not found or not owned by user\.|not found or access denied\.)$/.test(message)) {
    return res.status(404).json({ error: 'Dataset not found.' });
  }
  return res.status(500).json({ error: fallback });
}

const verifyAuth = createVerifyAuth({ serverSupabase });
const requireAuthenticatedUser = createRequireAuthenticatedUser({
  isSupabaseConfigured,
  serverSupabase,
  isProduction: isProd,
  allowProductionDemo: process.env.ALLOW_PRODUCTION_DEMO === 'true',
});

function billingClient(): SupabaseClient {
  if (!serverSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Billing storage is unavailable.');
  return serverSupabase;
}
function planLimit(res: Response, error: string) { return res.status(402).json({ code: 'PLAN_LIMIT', error }); }

app.post('/api/billing/checkout', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.accessToken === 'demo-token') return res.status(401).json({ error: 'Sign in to choose a plan.' });
    const { plan: currentPlan } = await getEntitlements(billingClient(), req.user!.id);
    if (currentPlan.id !== 'free') return res.status(409).json({ error: 'Manage your existing subscription from Settings → Billing before choosing another plan.' });
    const url = await createCheckout(req.body, { id: req.user!.id, email: req.user!.email });
    return res.json({ url });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Choose a valid paid plan and billing interval.' });
    console.error('[Billing] Checkout failed:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(503).json({ error: 'Checkout is unavailable right now. Please try again.' });
  }
});

app.get('/api/billing/status', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const client = billingClient();
    const { plan, subscription } = await getEntitlements(client, req.user!.id);
    const periodStart = subscription?.current_period_end && subscription.interval === 'annual'
      ? new Date(new Date(subscription.current_period_end).setUTCFullYear(new Date(subscription.current_period_end).getUTCFullYear() - 1)).toISOString()
      : billingPeriodStart(subscription?.interval || null);
    const usage = await getBillingUsage(client, req.user!.id, periodStart);
    return res.json({ plan: plan.id, subscription: subscription && {
      status: subscription.status, interval: subscription.interval, current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
    }, usage, limits: { datasets: plan.datasetsPerMonth, companies: plan.companiesPerDataset, rows: plan.uploadRowLimit } });
  } catch { return res.status(503).json({ error: 'Billing status is unavailable.' }); }
});

app.post('/api/billing/portal', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try { return res.json({ url: await createPortalLink(billingClient(), req.user!.id) }); }
  catch { return res.status(503).json({ error: 'The subscription portal is unavailable.' }); }
});

app.post('/api/billing/cancel', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await cancelDodoSubscription(billingClient(), req.user!.id);
    return res.json({ requested: true, message: 'Cancellation requested. Your plan updates after Dodo confirms it.' });
  } catch { return res.status(503).json({ error: 'Could not schedule cancellation.' }); }
});

const inMemoryJobRepository = new InMemoryAnalysisJobRepository();
const inMemoryCompanyAnalysisRepository = new InMemoryCompanyAnalysisRepository();
const inMemoryStrategicAnalysisRepository = new InMemoryStrategicAnalysisRepository();
const inMemorySTPRepository = new InMemorySTPRepository();

function getJobRepository(req: AuthenticatedRequest): AnalysisJobRepository {
  if (req.accessToken && req.accessToken !== 'demo-token' && isSupabaseConfigured) {
    const scopedClient = createUserScopedSupabase(req.accessToken);
    return createSupabaseAnalysisJobRepository(scopedClient);
  }
  return inMemoryJobRepository;
}

function getWritableJobRepository(req: AuthenticatedRequest): AnalysisJobRepository {
  if (req.accessToken && req.accessToken !== 'demo-token' && serverSupabase && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createSupabaseAnalysisJobRepository(serverSupabase);
  }
  return getJobRepository(req);
}

function getCompanyAnalysisRepository(req: AuthenticatedRequest) {
  if (req.accessToken && req.accessToken !== 'demo-token' && isSupabaseConfigured) {
    const scopedClient = createUserScopedSupabase(req.accessToken);
    return createSupabaseCompanyAnalysisRepository(scopedClient);
  }
  return inMemoryCompanyAnalysisRepository;
}

function getStrategicAnalysisRepository(req: AuthenticatedRequest): StrategicAnalysisRepository {
  if (req.accessToken && req.accessToken !== 'demo-token' && isSupabaseConfigured) {
    const scopedClient = createUserScopedSupabase(req.accessToken);
    return createSupabaseStrategicAnalysisRepository(scopedClient);
  }
  return inMemoryStrategicAnalysisRepository;
}

function getSTPRepository(req: AuthenticatedRequest): STPRepository {
  if (req.accessToken && req.accessToken !== 'demo-token' && isSupabaseConfigured) {
    const scopedClient = createUserScopedSupabase(req.accessToken);
    return createSupabaseSTPRepository(scopedClient);
  }
  return inMemorySTPRepository;
}

const inMemoryScoringRepository = new InMemoryScoringRepository();

function getScoringRepository(req: AuthenticatedRequest): ScoringRepository {
  if (req.accessToken && req.accessToken !== 'demo-token' && isSupabaseConfigured) {
    const scopedClient = createUserScopedSupabase(req.accessToken);
    return createSupabaseScoringRepository(scopedClient);
  }
  return inMemoryScoringRepository;
}

const inMemoryReportRepository = new InMemoryReportRepository();

function getReportRepository(req: AuthenticatedRequest): ReportRepository {
  if (req.accessToken && req.accessToken !== 'demo-token' && isSupabaseConfigured) {
    const scopedClient = createUserScopedSupabase(req.accessToken);
    return createSupabaseReportRepository(scopedClient);
  }
  return inMemoryReportRepository;
}

app.use(verifyAuth);

// Health Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

const waitlistSchema = z.object({
  email: z.email().max(254).transform(value => value.trim().toLowerCase()),
  plan: z.enum(PAID_PLAN_IDS),
  interval: z.enum(BILLING_INTERVALS).default('monthly'),
  currency: z.enum(BILLING_CURRENCIES).default('INR'),
});

app.post('/api/waitlist', async (req: Request, res: Response) => {
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and plan.' });
  if (!isSupabaseConfigured || !supabaseAnonKey) return res.status(503).json({ error: 'The waitlist is temporarily unavailable.' });
  const anonymousClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await anonymousClient.from('waitlist').insert(parsed.data);
  if (error && error.code !== '23505') {
    console.error('[Waitlist] Insert failed:', error.code);
    return res.status(503).json({ error: 'We could not add you right now. Please try again.' });
  }
  if (!error) trackServerEvent('waitlist_joined');
  return res.status(201).json({ success: true });
});

app.post('/api/analytics/signup', requireAuthenticatedUser, (_req: AuthenticatedRequest, res: Response) => {
  trackServerEvent('signup_completed');
  res.status(204).end();
});

app.delete('/api/datasets/:id', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  if (!serverSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY || req.accessToken === 'demo-token') {
    return res.status(503).json({ error: 'Dataset deletion is unavailable right now.' });
  }
  if (!z.uuid().safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid dataset ID.' });
  try {
    const { data, error } = await serverSupabase.from('datasets').delete()
      .eq('id', req.params.id).eq('owner_user_id', req.user!.id).select('id');
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: 'Dataset not found.' });
    return res.status(204).end();
  } catch {
    return res.status(500).json({ error: 'The dataset could not be deleted. Please try again.' });
  }
});

app.get('/api/account/export', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  if (!serverSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY || req.accessToken === 'demo-token') {
    return res.status(503).json({ error: 'Account export is unavailable right now.' });
  }
  try {
    const data = await exportAccountData(serverSupabase, req.user!.id, req.user!.email);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="figuredit_my_data.json"');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(JSON.stringify(data));
  } catch {
    return res.status(500).json({ error: 'Your data could not be exported. Please try again.' });
  }
});

app.delete('/api/account', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm.' });
  if (!serverSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY || req.accessToken === 'demo-token') {
    return res.status(503).json({ error: 'Account deletion is unavailable right now.' });
  }
  try {
    await deleteAccountData(serverSupabase, req.user!.id, req.user!.email);
    return res.status(204).end();
  } catch {
    return res.status(500).json({ error: 'Your account could not be deleted. Please contact support.' });
  }
});

// Mock/Sample Leads Route
app.get('/api/sample-data', (req: Request, res: Response) => {
  res.json({
    offering: SAMPLE_OFFERING,
    leads: SAMPLE_LEADS,
    analysis: SAMPLE_STRATEGIC_ANALYSIS,
    scores: SAMPLE_SCORES,
  });
});

// Authenticated upload boundary. The original bytes are parsed and validated again
// on the server; ownership always comes from the verified Supabase access token.
app.post('/api/uploads', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.accessToken === 'demo-token') return res.status(401).json({ error: 'Sign in to save a dataset.' });
    const { plan, subscription } = await getEntitlements(billingClient(), req.user!.id);
    const prepared = await prepareUpload(req.body);
    if (plan.id === 'free' && !prepared.parsed.fileName.toLowerCase().endsWith('.csv')) {
      return planLimit(res, 'The Free plan accepts CSV files only.');
    }
    if (prepared.parsed.rawRows.length > plan.uploadRowLimit) {
      return planLimit(res, `The ${plan.name} plan accepts up to ${plan.uploadRowLimit} rows per file.`);
    }
    const scopedClient = createUserScopedSupabase(req.accessToken!);
    let countQuery = scopedClient.from('datasets').select('id', { head: true, count: 'exact' }).eq('owner_user_id', req.user!.id);
    if (plan.id !== 'free') countQuery = countQuery.gte('created_at', billingPeriodStart(subscription?.interval || null));
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    if (plan.datasetsPerMonth !== null && (count ?? 0) >= plan.datasetsPerMonth) {
      return planLimit(res, `Your ${plan.name} plan has reached its dataset limit.`);
    }
    const result = await persistPreparedUpload(
      createSupabaseUploadRepository(serverSupabase || scopedClient),
      req.user!.id,
      prepared
    );

    trackServerEvent('dataset_uploaded');

    return res.status(201).json({
      success: true,
      ...result,
      summary: prepared.pipeline.summary,
      parseWarnings: prepared.parsed.parseErrors,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error && /PLAN_LIMIT/.test(error.message)) return planLimit(res, 'Your plan limit has been reached.');
    if (error instanceof Error && error.message === 'Your Free workspace already has a dataset.') {
      return res.status(403).json({ error: error.message });
    }
    console.error('[Upload] Persistence failed without logging uploaded row data.');
    return res.status(500).json({ error: 'The dataset could not be saved. No partial upload was retained.' });
  }
});

app.get('/api/datasets/:id/export', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = exportQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid export options.' });
  if (!req.accessToken || req.accessToken === 'demo-token') return res.status(401).json({ error: 'Sign in to export your dataset.' });
  const userId = req.user!.id;
  const datasetId = req.params.id;
  const query = parsed.data;
  try {
    const scopedClient = createUserScopedSupabase(req.accessToken);
    const { data: dataset, error: datasetError } = await scopedClient.from('datasets')
      .select('id, original_filename').eq('id', datasetId).eq('owner_user_id', userId).maybeSingle();
    if (datasetError) throw datasetError;
    if (!dataset) return res.status(404).json({ error: 'Dataset not found.' });
    const { plan } = await getEntitlements(billingClient(), userId);
    const requestedMode = query.preset === 'tier1_contacts' ? 'contacts' : query.mode;
    if (!canExport(req.user!, requestedMode, query.limit || 0, plan, query)) return planLimit(res, 'Upgrade to export contacts, XLSX, or filtered results.');

    const [leads, scores, stp] = await Promise.all([
      getJobRepository(req).getDatasetLeads(userId, datasetId),
      getScoringRepository(req).getLeadScores(userId, datasetId).then(scores => scores.filter(score => score.modelVersion === CURRENT_SCORING_MODEL_VERSION)),
      getSTPRepository(req).getDatasetSTPAnalysis(userId, datasetId),
    ]);
    if (query.segmentId && !stp?.segments.some(segment => segment.id === query.segmentId)) {
      return res.status(404).json({ error: 'Segment not found in this dataset.' });
    }

    const mode = query.preset === 'tier1_contacts' ? 'contacts' : query.mode;
    const contacts: ExportContact[] = [];
    if (mode === 'contacts') {
      if (!serverSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(503).json({ error: 'Contact export is temporarily unavailable.' });
      }
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await serverSupabase.from('lead_contacts')
          .select('lead_id, first_name, last_name, job_title, seniority, email, email_status, phone, linkedin_url, lead_stage, city, country')
          .eq('owner_user_id', userId).eq('dataset_id', datasetId)
          .order('created_at', { ascending: true }).order('id', { ascending: true })
          .range(offset, offset + 999);
        if (error) throw error;
        contacts.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
    }
    const rows = selectExportRows(leads, scores, stp, contacts, query);
    if (!canExport(req.user!, mode, rows.length, plan, query)) return planLimit(res, 'Your plan does not include this export.');
    const columns = mode === 'contacts' ? CONTACT_COLUMNS : COMPANY_COLUMNS;
    const data = await encodeExport(rows, columns, query.format);
    const filter = query.preset || [
      query.segmentId && stp?.segments.find(segment => segment.id === query.segmentId)?.name,
      query.tier !== 'all' && query.tier,
      query.coverage !== 'all' && query.coverage,
      query.search,
    ].filter(Boolean).join('_') || 'all';
    const filename = `${exportFilename(dataset.original_filename, filter)}.${query.format}`;
    res.setHeader('Content-Type', query.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    trackServerEvent('export_clicked');
    return res.send(data);
  } catch (error) {
    console.error('[Export] Failed to prepare dataset export:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({ error: 'The export could not be prepared. Please try again.' });
  }
});

// Structured, authenticated company intelligence. The server removes personal
// contact fields before any provider call and persists only schema-valid output.
app.post('/api/ai/company-intelligence', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  const validated = companyAnalysisRequestSchema.safeParse(req.body);
  if (!validated.success) {
    return res.status(422).json({
      error: validated.error.issues[0]?.message || 'Invalid company analysis request.',
      code: 'INVALID_REQUEST',
    });
  }

  const { leadId, ...requestedInput } = validated.data;
  try {
    const scopedClient = createUserScopedSupabase(req.accessToken!);
    const { data: lead, error: leadError } = await scopedClient
      .from('leads')
      .select('dataset_id, company_name, normalized_domain, website, industry_raw, employee_count, company_size_raw, geography, company_type_raw, business_model_raw, product_raw, notes, user_corrected_description')
      .eq('id', leadId)
      .eq('owner_user_id', req.user!.id)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) return res.status(404).json({ error: 'Company record not found.', code: 'COMPANY_NOT_FOUND' });
    const { data: priorAnalysis, error: priorError } = await scopedClient.from('company_analyses')
      .select('analyzed_at').eq('lead_id', leadId).eq('owner_user_id', req.user!.id).eq('analysis_status', 'completed').maybeSingle();
    if (priorError) throw priorError;
    const isRecentRerun = priorAnalysis?.analyzed_at && Date.parse(priorAnalysis.analyzed_at) > Date.now() - 30 * 86400_000;
    if (!isRecentRerun && !(await canAnalyzeCompany(billingClient(), req.user!.id, lead.dataset_id))) return planLimit(res, 'Your plan has reached its AI company limit for this dataset.');

    const correction = String(lead.user_corrected_description || requestedInput.userCorrectedDescription || '').trim();
    const uploadedDescription = correction || String(lead.product_raw || lead.notes || requestedInput.companyProductDescription || '');
    let websiteEvidence: Awaited<ReturnType<typeof enrichFromPublicWebsite>>;
    const domain = String(lead.normalized_domain || lead.website || requestedInput.companyDomain || '');
    try {
      websiteEvidence = domain
        ? await enrichFromPublicWebsite(domain, { enabled: process.env.COMPANY_WEBSITE_ENRICHMENT_ENABLED !== 'false' })
        : {
            status: 'failed', sourceUrl: null, fetchedAt: null, title: null,
            metaDescription: null, headings: [], mainContent: '', pagesFetched: [],
            reason: 'No public company domain was supplied.',
          };
    } catch (error) {
      websiteEvidence = {
        status: 'failed', sourceUrl: null, fetchedAt: null, title: null,
        metaDescription: null, headings: [], mainContent: '', pagesFetched: [],
        reason: error instanceof Error ? error.message : 'Website retrieval failed.',
      };
    }

    const publicWebsiteText = websiteEvidence.status === 'fetched'
      ? [websiteEvidence.title, websiteEvidence.metaDescription, ...websiteEvidence.headings, websiteEvidence.mainContent]
          .filter(Boolean).join('\n').slice(0, 12_000)
      : '';
    const { seller } = await getSavedSellerOffering(req);
    const input = {
      ...requestedInput,
      sellerProductContext: {
        companyName: seller.companyName, productName: seller.productName,
        productDescription: seller.productDescription, currentCustomerProblem: seller.primaryProblemSolved,
        coreFeatures: seller.keyCapabilities, mainBenefit: seller.valueProposition,
      },
      companyName: String(lead.company_name),
      companyDomain: domain,
      companyProductDescription: uploadedDescription,
      companyAttributes: {
        industry: lead.industry_raw,
        employee_count: lead.employee_count ?? lead.company_size_raw,
        geography: lead.geography,
        company_type: lead.company_type_raw,
        business_model: lead.business_model_raw,
      },
      userCorrectedDescription: correction,
      publicWebsiteText,
      publicWebsiteUrl: websiteEvidence.status === 'fetched' ? websiteEvidence.sourceUrl || undefined : undefined,
      publicWebsiteFetchedAt: websiteEvidence.status === 'fetched' ? websiteEvidence.fetchedAt || undefined : undefined,
      publicWebsiteFetchStatus: websiteEvidence.status,
    };
    if (!(await reserveDailyCompany(req.user!.id))) {
      return res.status(429).json({ error: 'Daily company analysis budget reached. Try again tomorrow.', code: 'DAILY_BUDGET' });
    }
    const result = await analyzeCompanyWithCache(
      createSupabaseCompanyAnalysisRepository(scopedClient),
      getCompanyAnalyzer(),
      req.user!.id,
      leadId,
      input,
      websiteEvidence,
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message.includes('PLAN_LIMIT')) return planLimit(res, 'Your plan has reached its AI company limit.');
    if (error instanceof CompanyAnalysisError) {
      captureServerFailure(error, { provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3.5-flash' });
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    captureServerFailure(error, { provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3.5-flash' });
    console.error('[Company Intelligence] Analysis failed without logging company input or prompt data.');
    return res.status(500).json({ error: 'Company analysis failed.', code: 'ANALYSIS_FAILED' });
  }
});

app.get('/api/ai/company-intelligence/:leadId', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scopedClient = createUserScopedSupabase(req.accessToken!);
    const [{ data: lead, error: leadError }, { data: stored, error: analysisError }] = await Promise.all([
      scopedClient.from('leads').select('id, user_corrected_description')
        .eq('id', req.params.leadId).eq('owner_user_id', req.user!.id).maybeSingle(),
      scopedClient.from('company_analyses').select('analysis_json, provider, model_version, analyzed_at, website_source_url, website_fetched_at, website_extraction_json, error_code, error_message')
        .eq('lead_id', req.params.leadId).eq('owner_user_id', req.user!.id).maybeSingle(),
    ]);
    if (leadError) throw leadError;
    if (!lead) return res.status(404).json({ error: 'Company record not found.' });
    if (analysisError && analysisError.code !== 'PGRST116') throw analysisError;
    return res.json({
      success: true,
      analysis: stored?.provider === 'mock' ? null : stored?.analysis_json || null,
      provider: stored?.provider || null,
      modelVersion: stored?.model_version || null,
      analyzedAt: stored?.analyzed_at || null,
      sourceMode: stored?.website_source_url ? 'both' : 'uploaded_only',
      websiteEvidence: stored?.website_extraction_json
        ? { ...stored.website_extraction_json, source: 'live' }
        : null,
      userCorrectedDescription: lead.user_corrected_description || '',
      error: stored?.error_message || null,
      errorCode: stored?.error_code || null,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to load saved company intelligence.' });
  }
});

app.patch('/api/ai/company-intelligence/:leadId/description', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : null;
  if (description === null || description.length > 8_000) {
    return res.status(422).json({ error: 'Description must be text no longer than 8,000 characters.' });
  }
  try {
    const scopedClient = createUserScopedSupabase(req.accessToken!);
    const { data, error } = await scopedClient.from('leads')
      .update({ user_corrected_description: description || null })
      .eq('id', req.params.leadId)
      .eq('owner_user_id', req.user!.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Company record not found.' });
    return res.json({ success: true, description });
  } catch {
    return res.status(500).json({ error: 'Unable to save the company description correction.' });
  }
});

// ------------------------------------------------------------------------------
// RESUMABLE BATCH ANALYSIS JOB PROCESSING ENDPOINTS (Prompt 9)
// ------------------------------------------------------------------------------

// 1. Start an analysis job
app.post('/api/analysis-jobs/:id/start', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobRepo = getWritableJobRepository(req);
    const existing = await jobRepo.getJob(req.user!.id, req.params.id);
    if (existing && !(await canAnalyzeCompany(billingClient(), req.user!.id, existing.dataset_id))) return planLimit(res, 'Your plan has reached its AI company limit.');
    await getSavedSellerOffering(req);
    const job = await startJob(jobRepo, req.user!.id, req.params.id);
    const progress = calculateJobProgress(job);
    return res.json({ success: true, job, progress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to start analysis job.';
    return res.status(400).json({ error: msg });
  }
});

// Browser clients cannot drive or override server-side analysis batches.
app.post('/api/analysis-jobs/:id/process-batch', requireAuthenticatedUser, (_req: AuthenticatedRequest, res: Response) => {
  return res.status(410).json({ error: 'Analysis batches now run automatically on the server.' });
});

// 3. Get job status
app.get('/api/analysis-jobs/:id', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobRepo = getJobRepository(req);
    const job = await jobRepo.getJob(req.user!.id, req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Analysis job not found.' });
    }
    const progress = calculateJobProgress(job);
    return res.json({ success: true, job, progress });
  } catch {
    return res.status(500).json({ error: 'Unable to load analysis job.' });
  }
});

// 4. Get or initialize job by dataset ID
app.get('/api/analysis-jobs/by-dataset/:datasetId', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (isSupabaseConfigured) {
      await getStrategicAnalysisRepository(req).assertOwnedDataset(req.user!.id, req.params.datasetId);
    }
    const jobRepo = getWritableJobRepository(req);
    let job = await jobRepo.getJobByDataset(req.user!.id, req.params.datasetId);
    const leads = await jobRepo.getDatasetLeads(req.user!.id, req.params.datasetId);

    if (!job && leads.length > 0) {
      const eligibleCount = leads.filter((l) => l.analysis_eligible).length;
      const skippedCount = leads.length - eligibleCount;
      job = await jobRepo.createJob(req.user!.id, req.params.datasetId, eligibleCount, skippedCount);
    }

    const progress = job ? calculateJobProgress(job) : { remainingCount: 0, percent: 0 };
    return res.json({ success: true, job: job || null, leads, progress });
  } catch (error) {
    return respondToDatasetReadError(res, error, 'Unable to load dataset analysis state.');
  }
});

// 5. Pause processing
app.post('/api/analysis-jobs/:id/pause', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobRepo = getWritableJobRepository(req);
    const job = await pauseJob(jobRepo, req.user!.id, req.params.id);
    const progress = calculateJobProgress(job);
    return res.json({ success: true, job, progress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to pause analysis job.';
    return res.status(400).json({ error: msg });
  }
});

// 6. Resume processing
app.post('/api/analysis-jobs/:id/resume', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobRepo = getWritableJobRepository(req);
    const existing = await jobRepo.getJob(req.user!.id, req.params.id);
    if (existing && !(await canAnalyzeCompany(billingClient(), req.user!.id, existing.dataset_id))) return planLimit(res, 'Your plan has reached its AI company limit.');
    const job = await resumeJob(jobRepo, req.user!.id, req.params.id);
    const progress = calculateJobProgress(job);
    return res.json({ success: true, job, progress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to resume analysis job.';
    return res.status(400).json({ error: msg });
  }
});

// 7. Retry failed leads
app.post('/api/analysis-jobs/:id/retry-failed', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobRepo = getWritableJobRepository(req);
    const job = await retryFailedLeads(jobRepo, req.user!.id, req.params.id);
    const progress = calculateJobProgress(job);
    return res.json({ success: true, job, progress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to retry failed leads.';
    return res.status(400).json({ error: msg });
  }
});

// 8. Cancel processing
app.post('/api/analysis-jobs/:id/cancel', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobRepo = getWritableJobRepository(req);
    const job = await cancelJob(jobRepo, req.user!.id, req.params.id);
    const progress = calculateJobProgress(job);
    return res.json({ success: true, job, progress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to cancel analysis job.';
    return res.status(400).json({ error: msg });
  }
});

// AI Company Classification Endpoint
app.post('/api/ai/classify-company', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyName, domain, description, industry } = req.body || {};
    if (!companyName || typeof companyName !== 'string' || !domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'companyName and domain are required strings.' });
    }
    if (companyName.length > 255 || domain.length > 255) {
      return res.status(400).json({ error: 'companyName and domain must not exceed 255 characters.' });
    }

    if (!(await reserveDailyCompany(req.user!.id))) {
      return res.status(429).json({ error: 'Daily company analysis budget reached. Try again tomorrow.' });
    }
    const classification = await classifyCompanyWithAI(companyName, domain, String(description || ''), industry);
    res.json({ success: true, classification });
  } catch (error) {
    console.error('Error in /api/ai/classify-company:', error);
    res.status(500).json({ error: 'Failed to classify company.' });
  }
});

// Strategic Marketing Analysis: Need Gap & 5C Cohort Engine
// ------------------------------------------------------------------------------

// Get saved dataset strategic analysis
app.get('/api/strategic-analysis/dataset/:datasetId', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stratRepo = getStrategicAnalysisRepository(req);
    const datasetId = req.params.datasetId;
    const userId = req.user!.id;

    await stratRepo.assertOwnedDataset(userId, datasetId);
    const strategicAnalysis = await stratRepo.getDatasetStrategicAnalysis(userId, datasetId);

    return res.json({
      success: true,
      strategicAnalysis: strategicAnalysis || null,
    });
  } catch (error) {
    return respondToDatasetReadError(res, error, 'Failed to retrieve strategic analysis.');
  }
});

// Run or refresh dataset strategic analysis (Need Gap + 5C)
app.post('/api/strategic-analysis/dataset/:datasetId/run', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobRepo = getJobRepository(req);
    const stratRepo = getStrategicAnalysisRepository(req);
    const analysisRepo = getCompanyAnalysisRepository(req);
    const datasetId = req.params.datasetId;
    const userId = req.user!.id;

    await stratRepo.assertOwnedDataset(userId, datasetId);

    const leads = (await jobRepo.getDatasetLeads(userId, datasetId)).filter(lead => lead.analysis_status === 'completed');
    if (!leads.length) {
      return res.status(400).json({ error: 'No company leads found in this dataset.' });
    }

    const { seller: sellerProfile } = await getSavedSellerOffering(req);

    // Evaluate each lead's need gap using stored company intelligence
    const leadNeedGaps = await Promise.all(
      leads.map(async (lead) => {
        let envelope = null;
        if ('getLeadAnalysis' in analysisRepo && typeof (analysisRepo as unknown as { getLeadAnalysis: (u: string, l: string) => unknown }).getLeadAnalysis === 'function') {
          envelope = (analysisRepo as unknown as { getLeadAnalysis: (u: string, l: string) => unknown }).getLeadAnalysis(userId, lead.id) as CompanyAnalysisEnvelope | null;
        }
        const gap = analyzeLeadNeedGap(sellerProfile, lead, envelope);
        await stratRepo.saveLeadNeedGap(userId, lead.id, gap);
        return gap;
      })
    );

    // Pure deterministic dataset-level aggregation
    const needGapSummary = aggregateDatasetNeedGaps(datasetId, leadNeedGaps, sellerProfile);

    // Institutional 5C stakeholder synthesis
    const fiveC = synthesizeDetailedFiveC(sellerProfile, leadNeedGaps, leads);

    const strategicAnalysis = {
      datasetId,
      ownerUserId: userId,
      sellerOfferingId: sellerProfile.id || 'seller-offering-default',
      needGapSummary,
      fiveC,
      companyNeedGaps: Object.fromEntries(leadNeedGaps.map((g) => [g.leadId, g])),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await stratRepo.saveDatasetStrategicAnalysis(userId, datasetId, strategicAnalysis);

    return res.json({
      success: true,
      strategicAnalysis,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to run strategic analysis.';
    return res.status(500).json({ error: msg });
  }
});

// Get lead need gap analysis
app.get('/api/strategic-analysis/lead/:leadId', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stratRepo = getStrategicAnalysisRepository(req);
    const userId = req.user!.id;
    const leadId = req.params.leadId;

    const needGap = await stratRepo.getLeadNeedGap(userId, leadId);
    return res.json({
      success: true,
      needGap: needGap || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve lead need gap.';
    return res.status(500).json({ error: msg });
  }
});

// ------------------------------------------------------------------------------
// Segmentation, Targeting & Positioning (STP) Cohort Engine (Prompt 11)
// ------------------------------------------------------------------------------

// Get saved dataset STP analysis
app.get('/api/stp/dataset/:datasetId', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stpRepo = getSTPRepository(req);
    const stratRepo = getStrategicAnalysisRepository(req);
    const jobRepo = getJobRepository(req);
    const datasetId = req.params.datasetId;
    const userId = req.user!.id;

    await stpRepo.assertOwnedDataset(userId, datasetId);
    let stpAnalysis = await stpRepo.getDatasetSTPAnalysis(userId, datasetId);

    // If not yet synthesized, check if strategic analysis exists and dynamically generate STP
    if (!stpAnalysis) {
      const stratAnalysis = await stratRepo.getDatasetStrategicAnalysis(userId, datasetId);
      if (stratAnalysis) {
        const leads = await jobRepo.getDatasetLeads(userId, datasetId);
        if (leads.length > 0) {
          const sellerProfile: SellerProfileContext = {
            id: stratAnalysis.sellerOfferingId,
            companyName: 'Seller Organization',
            keyCapabilities: stratAnalysis.needGapSummary.matchingSellerBenefits.map((b) => b.sellerBenefit),
          };
          stpAnalysis = buildDatasetSTPAnalysis(
            sellerProfile,
            datasetId,
            stratAnalysis.needGapSummary,
            stratAnalysis.fiveC,
            leads,
            stratAnalysis.companyNeedGaps
          );
          await stpRepo.saveDatasetSTPAnalysis(userId, datasetId, stpAnalysis);
        }
      }
    }

    return res.json({
      success: true,
      stpAnalysis: stpAnalysis || null,
    });
  } catch (error) {
    return respondToDatasetReadError(res, error, 'Failed to retrieve STP analysis.');
  }
});

// Run or refresh dataset STP analysis
app.post('/api/stp/dataset/:datasetId/run', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobRepo = getJobRepository(req);
    const stratRepo = getStrategicAnalysisRepository(req);
    const stpRepo = getSTPRepository(req);
    const analysisRepo = getCompanyAnalysisRepository(req);
    const datasetId = req.params.datasetId;
    const userId = req.user!.id;

    await stpRepo.assertOwnedDataset(userId, datasetId);

    const leads = (await jobRepo.getDatasetLeads(userId, datasetId)).filter(lead => lead.analysis_status === 'completed');
    if (!leads.length) {
      return res.status(400).json({ error: 'No company leads found in this dataset.' });
    }

    const { seller: sellerProfile } = await getSavedSellerOffering(req);

    // Ensure we have strategic analysis (need gap summary & 5C)
    let stratAnalysis = await stratRepo.getDatasetStrategicAnalysis(userId, datasetId);
    let companyNeedGaps: Record<string, any> = {};

    if (!stratAnalysis) {
      const leadNeedGaps = await Promise.all(
        leads.map(async (lead) => {
          let envelope = null;
          if ('getLeadAnalysis' in analysisRepo && typeof (analysisRepo as unknown as { getLeadAnalysis: (u: string, l: string) => unknown }).getLeadAnalysis === 'function') {
            envelope = (analysisRepo as unknown as { getLeadAnalysis: (u: string, l: string) => unknown }).getLeadAnalysis(userId, lead.id) as CompanyAnalysisEnvelope | null;
          }
          const gap = analyzeLeadNeedGap(sellerProfile, lead, envelope);
          await stratRepo.saveLeadNeedGap(userId, lead.id, gap);
          return gap;
        })
      );
      const needGapSummary = aggregateDatasetNeedGaps(datasetId, leadNeedGaps, sellerProfile);
      const fiveC = synthesizeDetailedFiveC(sellerProfile, leadNeedGaps, leads);
      stratAnalysis = {
        datasetId,
        ownerUserId: userId,
        sellerOfferingId: sellerProfile.id || 'seller-offering-default',
        needGapSummary,
        fiveC,
        companyNeedGaps: Object.fromEntries(leadNeedGaps.map((g) => [g.leadId, g])),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await stratRepo.saveDatasetStrategicAnalysis(userId, datasetId, stratAnalysis);
      companyNeedGaps = stratAnalysis.companyNeedGaps;
    } else {
      companyNeedGaps = stratAnalysis.companyNeedGaps || {};
    }

    // Pure deterministic STP generation
    const stpAnalysis = buildDatasetSTPAnalysis(
      sellerProfile,
      datasetId,
      stratAnalysis.needGapSummary,
      stratAnalysis.fiveC,
      leads,
      companyNeedGaps
    );

    await stpRepo.saveDatasetSTPAnalysis(userId, datasetId, stpAnalysis);

    return res.json({
      success: true,
      stpAnalysis,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to run STP analysis.';
    return res.status(500).json({ error: msg });
  }
});

// Get individual segment details
app.get('/api/stp/segments/:segmentId', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stpRepo = getSTPRepository(req);
    const userId = req.user!.id;
    const segmentId = req.params.segmentId;

    const segment = await stpRepo.getSegment(userId, segmentId);
    return res.json({
      success: true,
      segment: segment || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve segment.';
    return res.status(500).json({ error: msg });
  }
});

// ------------------------------------------------------------------------------
// Deterministic Multi-Attribute ICP Fit Scoring Engine (Prompt 12)
// ------------------------------------------------------------------------------

// Get scoring configuration for dataset
app.get('/api/scoring/dataset/:datasetId/config', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scoringRepo = getScoringRepository(req);
    const userId = req.user!.id;
    const datasetId = req.params.datasetId;

    await scoringRepo.assertOwnedDataset(userId, datasetId);
    const savedConfig = await scoringRepo.getScoringConfig(userId, datasetId);

    return res.json({
      success: true,
      weights: savedConfig || DEFAULT_SCORING_WEIGHTS,
      modelVersion: CURRENT_SCORING_MODEL_VERSION,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve scoring config.';
    return res.status(500).json({ error: msg });
  }
});

// Save updated scoring configuration for dataset
app.post('/api/scoring/dataset/:datasetId/config', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scoringRepo = getScoringRepository(req);
    const userId = req.user!.id;
    const datasetId = req.params.datasetId;
    const rawWeights = req.body?.weights;

    if (!rawWeights) {
      return res.status(400).json({ error: 'weights object is required.' });
    }

    const weights = {
      needUrgencyWeight: Number(rawWeights.needUrgencyWeight ?? DEFAULT_SCORING_WEIGHTS.needUrgencyWeight),
      capabilityMatchWeight: Number(rawWeights.capabilityMatchWeight ?? DEFAULT_SCORING_WEIGHTS.capabilityMatchWeight),
      stakeholderFeasibilityWeight: Number(rawWeights.stakeholderFeasibilityWeight ?? DEFAULT_SCORING_WEIGHTS.stakeholderFeasibilityWeight),
      firmographicAlignmentWeight: Number(rawWeights.firmographicAlignmentWeight ?? DEFAULT_SCORING_WEIGHTS.firmographicAlignmentWeight),
    };

    const validation = validateScoringWeights(weights);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    await scoringRepo.assertOwnedDataset(userId, datasetId);
    await scoringRepo.saveScoringConfig(userId, datasetId, weights);

    return res.json({
      success: true,
      weights,
      modelVersion: CURRENT_SCORING_MODEL_VERSION,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to save scoring config.';
    return res.status(500).json({ error: msg });
  }
});

// Get persisted lead scores for dataset
app.get('/api/scoring/dataset/:datasetId', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scoringRepo = getScoringRepository(req);
    const userId = req.user!.id;
    const datasetId = req.params.datasetId;

    await scoringRepo.assertOwnedDataset(userId, datasetId);
    const scores = await scoringRepo.getLeadScores(userId, datasetId);

    return res.json({
      success: true,
      scores,
      modelVersion: CURRENT_SCORING_MODEL_VERSION,
    });
  } catch (error) {
    return respondToDatasetReadError(res, error, 'Failed to retrieve lead scores.');
  }
});

// Run or recalculate scores for dataset
app.post('/api/scoring/dataset/:datasetId/run', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scoringRepo = getScoringRepository(req);
    const jobRepo = getJobRepository(req);
    const stratRepo = getStrategicAnalysisRepository(req);
    const stpRepo = getSTPRepository(req);
    const analysisRepo = getCompanyAnalysisRepository(req);
    const userId = req.user!.id;
    const datasetId = req.params.datasetId;

    await scoringRepo.assertOwnedDataset(userId, datasetId);

    const leads = (await jobRepo.getDatasetLeads(userId, datasetId)).filter(lead => lead.analysis_status === 'completed');
    if (!leads.length) {
      return res.status(400).json({ error: 'No company leads found in this dataset.' });
    }

    const rawWeights = req.body?.weights;
    let customWeights = rawWeights ? {
      needUrgencyWeight: Number(rawWeights.needUrgencyWeight ?? DEFAULT_SCORING_WEIGHTS.needUrgencyWeight),
      capabilityMatchWeight: Number(rawWeights.capabilityMatchWeight ?? DEFAULT_SCORING_WEIGHTS.capabilityMatchWeight),
      stakeholderFeasibilityWeight: Number(rawWeights.stakeholderFeasibilityWeight ?? DEFAULT_SCORING_WEIGHTS.stakeholderFeasibilityWeight),
      firmographicAlignmentWeight: Number(rawWeights.firmographicAlignmentWeight ?? DEFAULT_SCORING_WEIGHTS.firmographicAlignmentWeight),
    } : undefined;

    if (!customWeights) {
      const savedConfig = await scoringRepo.getScoringConfig(userId, datasetId);
      if (savedConfig) customWeights = savedConfig;
    }

    const { offering } = await getSavedSellerOffering(req);
    const stratAnalysis = await stratRepo.getDatasetStrategicAnalysis(userId, datasetId);
    const stpAnalysis = await stpRepo.getDatasetSTPAnalysis(userId, datasetId);

    const companyIntelligences: Record<string, any> = {};
    for (const lead of leads) {
      if ('getLeadAnalysis' in analysisRepo && typeof (analysisRepo as any).getLeadAnalysis === 'function') {
        const env = (analysisRepo as any).getLeadAnalysis(userId, lead.id);
        if (env) companyIntelligences[lead.id] = env;
      }
    }

    const normalizedLeads: NormalizedLead[] = leads.map((l) => ({
      id: l.id,
      companyName: l.company_name,
      domain: l.normalized_domain ?? null,
      website: l.website ?? null,
      industry: l.industry_raw || '',
      headcount: l.employee_count ?? null,
      annualRevenue: null,
      description: l.notes || '',
      country: '',
      technologies: [],
      isClean: true,
      ingestedAt: new Date().toISOString(),
      userCorrectedDescription: l.user_corrected_description ?? null,
    }));

    const scores = batchScoreLeads(
      normalizedLeads,
      offering,
      stratAnalysis ? {
        offeringId: stratAnalysis.sellerOfferingId,
        analyzedAt: stratAnalysis.createdAt,
        needGaps: Object.values(stratAnalysis.companyNeedGaps || {}).map(toScoringNeedGap),
        fiveC: stratAnalysis.fiveC as any,
        stpSegments: (stpAnalysis?.segments || []).map((s: any) => ({
          id: s.id,
          segmentName: s.name,
          problemDefinition: s.sharedProblem,
          leadCount: s.companyCount,
          averageNeedScore: 80,
          targetAttractiveness: 'Tier 1 Priority',
          recommendedPositioningAngle: s.name,
          valueNarrative: s.desiredOutcome,
          matchedLeadIds: s.primaryCompanyIds || [],
        })),
        marketingMix: {
          productResonance: 'High',
          priceAcceptability: 'Moderate',
          placeChannelFit: 'Direct Sales',
          promotionHook: 'Operational Efficiency',
        },
        cohortHypothesisSummary: '',
      } : undefined,
      customWeights,
      {
        companyIntelligences,
        fiveC: stratAnalysis?.fiveC,
        segments: stpAnalysis?.segments,
        requireNeedGap: true,
      }
    );

    await scoringRepo.saveLeadScores(userId, datasetId, scores);

    return res.json({
      success: true,
      scores,
      modelVersion: CURRENT_SCORING_MODEL_VERSION,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to run lead scoring.';
    return res.status(500).json({ error: msg });
  }
});

// -----------------------------------------------------------------------------
// EXECUTIVE ICP REPORT & 7Ps MARKETING MIX ENDPOINTS (Prompt 13)
// -----------------------------------------------------------------------------

app.get('/api/reports/dataset/:datasetId/print-access', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await getReportRepository(req).assertOwnedDataset(req.user!.id, req.params.datasetId);
    const { plan } = await getEntitlements(billingClient(), req.user!.id);
    if (plan.id === 'free') return planLimit(res, 'Upgrade to Starter or Pro to save a PDF report.');
    return res.json({ allowed: true, watermark: plan.id !== 'pro' });
  } catch (error) { return respondToDatasetReadError(res, error, 'Unable to check report access.'); }
});

app.get('/api/reports/dataset/:datasetId', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reportRepo = getReportRepository(req);
    const userId = req.user!.id;
    const datasetId = req.params.datasetId;

    await reportRepo.assertOwnedDataset(userId, datasetId);

    const savedReport = await reportRepo.getReport(userId, datasetId);
    if (savedReport) {
      return res.json({
        success: true,
        report: savedReport,
        isCached: true,
      });
    }

    return res.status(404).json({
      error: 'Executive report not found for this dataset. Generate report first.',
      datasetId,
      needsGeneration: true,
    });
  } catch (error) {
    return respondToDatasetReadError(res, error, 'Failed to retrieve executive report.');
  }
});

app.post('/api/reports/dataset/:datasetId/generate', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reportRepo = getReportRepository(req);
    const jobRepo = getJobRepository(req);
    const stratRepo = getStrategicAnalysisRepository(req);
    const stpRepo = getSTPRepository(req);
    const scoringRepo = getScoringRepository(req);
    const userId = req.user!.id;
    const datasetId = req.params.datasetId;

    await reportRepo.assertOwnedDataset(userId, datasetId);

    // 1. Load dataset leads
    const rawLeads = await jobRepo.getDatasetLeads(userId, datasetId);
    const leadsForAnalysis: LeadForAnalysis[] = rawLeads;
    if (!leadsForAnalysis.length) return res.status(400).json({ error: 'No company leads found in this dataset.' });

    // 2. Load or construct seller context
    const { seller, offering } = await getSavedSellerOffering(req);

    // 3. Load or compute Need Gap and 5C
    const stratAnalysis = await stratRepo.getDatasetStrategicAnalysis(userId, datasetId);
    const needGaps = leadsForAnalysis.map((lead) => analyzeLeadNeedGap(seller, lead));
    const needGapSummary = stratAnalysis?.needGapSummary || aggregateDatasetNeedGaps(datasetId, needGaps, seller);
    const fiveC = stratAnalysis?.fiveC || synthesizeDetailedFiveC(seller, needGaps, leadsForAnalysis);

    // 4. Load or compute STP
    let stpAnalysis = await stpRepo.getDatasetSTPAnalysis(userId, datasetId);
    if (!stpAnalysis) {
      const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));
      stpAnalysis = buildDatasetSTPAnalysis(seller, datasetId, needGapSummary, fiveC, leadsForAnalysis, gapsMap);
    }

    // 5. Load or compute Lead ICP Scores
    const analyzedLeads = leadsForAnalysis.filter(lead => lead.analysis_status === 'completed');
    const analyzedIds = new Set(analyzedLeads.map(lead => lead.id));
    let storedScores = (await scoringRepo.getLeadScores(userId, datasetId))
      .filter(score => score.modelVersion === CURRENT_SCORING_MODEL_VERSION && analyzedIds.has(score.leadId));
    if (!storedScores.length && analyzedLeads.length > 0) {
      const normalizedLeads: NormalizedLead[] = analyzedLeads.map((l) => ({
        id: l.id,
        companyName: l.company_name,
        domain: l.normalized_domain ?? null,
        website: l.website ?? null,
        industry: l.industry_raw || '',
        headcount: l.employee_count ?? null,
        annualRevenue: null,
        description: l.notes || '',
        country: '',
        technologies: [],
        isClean: true,
        ingestedAt: new Date().toISOString(),
        userCorrectedDescription: l.user_corrected_description ?? null,
      }));

      storedScores = normalizedLeads.map(lead => {
        const gap = stratAnalysis?.companyNeedGaps?.[lead.id] || needGaps.find(item => item.leadId === lead.id);
        return calculateDeterministicICPScore(lead, offering, gap ? toScoringNeedGap(gap) : undefined, undefined, {
          fiveC, segment: stpAnalysis.segments.find(segment => segment.primaryCompanyIds.includes(lead.id)),
          requireNeedGap: true,
        });
      });
      await scoringRepo.saveLeadScores(userId, datasetId, storedScores);
    }

    // 6. Compose complete Executive ICP Report with 7Ps Marketing Mix
    const datasetFilename = req.body?.datasetFilename || `Pipeline_Cohort_${datasetId.slice(0, 8)}.csv`;
    const report = composeExecutiveICPReport(
      seller,
      datasetId,
      datasetFilename,
      userId,
      leadsForAnalysis.length || storedScores.length,
      needGapSummary,
      fiveC,
      stpAnalysis,
      storedScores,
      leadsForAnalysis
    );

    // 7. Persist to repository
    await reportRepo.saveReport(userId, datasetId, report);

    return res.json({
      success: true,
      report,
      modelVersion: CURRENT_REPORT_MODEL_VERSION,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate executive report.';
    return res.status(500).json({ error: msg });
  }
});


// Strategic Marketing Analysis Endpoint (Need Gap -> 5C -> STP -> Marketing Mix)
app.post('/api/ai/strategic-analysis', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leads } = req.body || {};
    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'A leads array is required.' });
    }
    if (leads.length > 500) {
      return res.status(400).json({ error: 'A maximum of 500 leads can be submitted for analysis.' });
    }

    const { seller: sellerContext, offering } = await getSavedSellerOffering(req);

    const leadsForAnalysis: LeadForAnalysis[] = leads.map((l: Record<string, unknown>, idx: number) => ({
      id: String(l.id || `lead-${idx}`),
      dataset_id: String(l.datasetId || 'dataset-default'),
      owner_user_id: req.user?.id || 'default-owner',
      company_name: String(l.companyName || l.company_name || 'Target Account'),
      normalized_domain: l.domain ? String(l.domain) : null,
      website: l.website ? String(l.website) : null,
      industry_raw: l.industry ? String(l.industry) : null,
      employee_count: typeof l.headcount === 'number' ? l.headcount : null,
      notes: l.notes ? String(l.notes) : (l.description ? String(l.description) : null),
      user_corrected_description: l.userCorrectedDescription ? String(l.userCorrectedDescription) : null,
      analysis_eligible: true,
      analysis_status: 'completed',
    }));

    const leadNeedGaps = leadsForAnalysis.map((lead) =>
      analyzeLeadNeedGap(sellerContext, lead)
    );
    const detailedNeedGapSummary = aggregateDatasetNeedGaps('dataset-default', leadNeedGaps, sellerContext);
    const detailedFiveC = synthesizeDetailedFiveC(sellerContext, leadNeedGaps, leadsForAnalysis);

    const baseAnalysis = await runStrategicMarketingAnalysis(offering, leads);

    res.json({
      success: true,
      analysis: {
        ...baseAnalysis,
        detailedNeedGapSummary,
        detailedFiveC,
      },
    });
  } catch (error) {
    console.error('Error in /api/ai/strategic-analysis:', error);
    res.status(500).json({ error: 'Failed to run strategic analysis.' });
  }
});

// AI Suggest Onboarding Context Endpoint (Need Gap Framework Assistance)
app.post('/api/ai/suggest-onboarding', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const partialData = req.body || {};
    const suggestions = await suggestSellerOnboardingContext(partialData);
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Error in /api/ai/suggest-onboarding:', error);
    res.status(500).json({ error: 'Failed to generate onboarding suggestions.' });
  }
});

// Deterministic Lead Scoring Endpoint
app.post('/api/leads/score', requireAuthenticatedUser, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leads, offering, analysis, weights } = req.body || {};
    if (!leads || !Array.isArray(leads) || !offering || typeof offering !== 'object') {
      return res.status(400).json({ error: 'leads array and offering object are required.' });
    }
    if (leads.length > 500) {
      return res.status(400).json({ error: 'A maximum of 500 leads can be scored in a single batch.' });
    }

    const scores = batchScoreLeads(leads, offering, analysis, weights);
    res.json({ success: true, scores });
  } catch (error) {
    console.error('Error in /api/leads/score:', error);
    res.status(500).json({ error: 'Failed to score leads.' });
  }
});

// Explicit 404 handler for unhandled API routes (prevents falling through to SPA HTML)
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Vite Middlewares in Dev or Static Serve in Prod
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      const indexPath = path.resolve(__dirname, 'dist', 'index.html');
      const pathname = req.path;
      const knownRoute = ['/', '/demo', '/about', '/auth', '/privacy', '/terms', '/pricing', '/refund-policy', '/contact', '/guides/ideal-customer-profile-from-leads', '/start', '/onboarding', '/dashboard', '/uploads/new', '/companies', '/segments', '/strategy', '/icp/report', '/settings', '/settings/billing'].includes(pathname)
        || /^\/(uploads|companies|segments|strategy)\/[^/]+$/.test(pathname)
        || /^\/icp\/report\/[^/]+$/.test(pathname);
      const publicMeta: Record<string, { title: string; description: string }> = {
        '/': { title: 'FiguredIt — AI-assisted analysis with an explainable, rule-based score', description: 'AI-assisted analysis with an explainable, rule-based score. Find your ideal B2B customers, prioritize leads, and plan your go-to-market strategy with FiguredIt.' },
        '/demo': { title: 'Try the public demo | FiguredIt', description: 'Preview keyword matching on five fictional B2B accounts, then sign in to analyze your own lead list with FiguredIt.' },
        '/about': { title: 'About and Q&A | FiguredIt', description: 'Learn how FiguredIt helps B2B teams find promising companies from their lead lists with AI-assisted analysis and explainable scoring.' },
        '/privacy': { title: 'Privacy notice | FiguredIt', description: 'Read how FiguredIt handles your account, uploaded lead data, AI processing, retention, and deletion requests.' },
        '/terms': { title: 'Terms of use | FiguredIt', description: 'Read the FiguredIt terms of use, including acceptable use, uploaded data ownership, and service limitations.' },
        '/pricing': { title: 'Pricing | FiguredIt', description: 'Simple pricing for explainable ICP discovery. Start free, then join the waitlist for Starter or Pro as your pipeline grows.' },
        '/guides/ideal-customer-profile-from-leads': { title: 'Build an ideal customer profile from a lead list | FiguredIt', description: 'A practical guide for B2B founders and sales teams: clean a lead list, identify evidence, score company fit, and validate your ideal customer profile.' },
        '/refund-policy': { title: 'Refund policy | FiguredIt', description: 'Read FiguredIt’s cancellation and refund policy for paid subscriptions.' },
        '/contact': { title: 'Contact | FiguredIt', description: 'Contact FiguredIt with questions about the product, your account, or your data.' },
      };
      const routeTitles: Record<string, string> = {
        auth: 'Sign in or create an account', start: 'Start your analysis', onboarding: 'Set up your offering', dashboard: 'Dashboard',
        uploads: 'Lead uploads', companies: 'Companies', segments: 'Segments', strategy: 'Strategic analysis',
        icp: 'ICP report', settings: 'Settings',
      };
      try {
        let html = fs.readFileSync(indexPath, 'utf8');
        const meta = publicMeta[pathname];
        const title = meta?.title || `${knownRoute ? routeTitles[pathname.split('/')[1]] : 'Page not found'} | FiguredIt`;
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
        if (meta) {
          html = html.replace('rel="canonical" href="https://figuredit.in/"', `rel="canonical" href="https://figuredit.in${pathname}"`);
          html = html.replace('property="og:url" content="https://figuredit.in/"', `property="og:url" content="https://figuredit.in${pathname}"`);
          html = html.replace(/(<meta name="description" content=")[^"]*(" \/>)/, `$1${meta.description}$2`);
          html = html.replace(/(<meta property="og:title" content=")[^"]*(" \/>)/, `$1${meta.title}$2`);
          html = html.replace(/(<meta property="og:description" content=")[^"]*(" \/>)/, `$1${meta.description}$2`);
          html = html.replace(/(<meta name="twitter:title" content=")[^"]*(" \/>)/, `$1${meta.title}$2`);
          html = html.replace(/(<meta name="twitter:description" content=")[^"]*(" \/>)/, `$1${meta.description}$2`);
        } else {
          html = html.replace(/\s*<link rel="canonical"[^>]*>/, '');
          html = html.replace('</head>', '<meta name="robots" content="noindex" /></head>');
        }
        const publicConfig = {
          supabaseUrl: process.env.VITE_SUPABASE_URL || '',
          supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
        };
        const configScript = `<script>window.__ICP_CONFIG__ = ${JSON.stringify(publicConfig)};</script>`;
        html = html.replace('</head>', `${configScript}</head>`);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(knownRoute ? 200 : 404).send(html);
      } catch {
        res.status(knownRoute ? 200 : 404).sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FiguredIt] Server listening on http://0.0.0.0:${PORT}`);
  });
  if (serverSupabase && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    startAnalysisWorker(serverSupabase);
  }
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
