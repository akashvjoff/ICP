import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, DbSellerProfile, DbDataset, DbLead, DbCompanyAnalysis, DbSegment, DbLeadScore, DbIcpReport, DbScoringConfig, DbAnalysisJob } from '../types/database';
import type { DatasetSTPAnalysis } from '../types/analysis';

// Environment variables (Vite build-time or server-injected runtime config fallback)
const runtimeConfig = (typeof window !== 'undefined' && (window as unknown as { __ICP_CONFIG__?: { supabaseUrl?: string; supabaseAnonKey?: string } }).__ICP_CONFIG__) || {};
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || runtimeConfig.supabaseUrl || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeConfig.supabaseAnonKey || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('YOUR_SUPABASE') &&
  !supabaseUrl.includes('YOUR_PROJECT_ID') &&
  supabaseUrl.startsWith('https://')
);

// Live Supabase client
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Format raw Auth or Postgres errors into clear, friendly neo-brutalist error messages.
 */
export function formatSupabaseError(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';
  const msg = typeof error === 'string' ? error : (error as { message?: string }).message || '';
  
  if (msg.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please verify and try again.';
  }
  if (msg.includes('User already registered')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Your email address has not been confirmed yet. Please check your inbox or request a new verification link.';
  }
  if (msg.includes('Password should be at least')) {
    return 'Password is too short. Please use at least 8 characters.';
  }
  if (/email address.*invalid|invalid email/i.test(msg)) {
    return 'Enter a deliverable email address. Placeholder and testing domains may be rejected by the email provider.';
  }
  if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
    return 'Too many attempts. Please pause for a few seconds before trying again.';
  }
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
    return 'Unable to connect to Supabase. Check your network connection or verify VITE_SUPABASE_URL.';
  }
  return msg || 'Authentication request failed.';
}

export interface WorkspaceUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isDemoUser: boolean;
}

export const DEFAULT_DEMO_USER: WorkspaceUser = {
  id: 'usr-demo-01',
  email: 'alex@synthetix.io',
  name: 'Alex Vance',
  role: 'Founder',
  isDemoUser: true,
};

// ------------------------------------------------------------------------------
// DATABASE ACCESS SERVICE (CLIENT SIDE WITH RLS ENFORCEMENT)
// ------------------------------------------------------------------------------
export const dbService = {
  // Seller Profile
  async getSellerProfile(userId: string): Promise<DbSellerProfile | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('seller_profiles')
      .select('*')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsertSellerProfile(userId: string, profile: Partial<DbSellerProfile>): Promise<DbSellerProfile | null> {
    if (!supabase) return null;
    const payload = {
      ...profile,
      owner_user_id: userId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('seller_profiles')
      .upsert(payload, { onConflict: 'owner_user_id' })
      .select()
      .single();

    if (error) throw error;
    return data as DbSellerProfile;
  },

  async saveSellerProductContext(userId: string, ctx: any): Promise<void> {
    if (!supabase) return;
    const payload = {
      owner_user_id: userId,
      company_name: String(ctx.companyName || 'My Company'),
      website: ctx.website ? String(ctx.website) : null,
      product_description: ctx.productDescription ? String(ctx.productDescription) : null,
      target_market: Array.isArray(ctx.targetBusinessTypes) ? ctx.targetBusinessTypes.join(', ') : null,
      offering_type: ctx.businessModel ? String(ctx.businessModel) : 'B2B SaaS',
      geography: ctx.geography ? String(ctx.geography) : null,
      price_range: ctx.indicativePricing ? String(ctx.indicativePricing) : null,
      primary_buyer: Array.isArray(ctx.buyerRoles) ? (ctx.buyerRoles as Array<{ role?: string }>).map(b => b.role).filter(Boolean).join(', ') : null,
      main_customer_problem: ctx.currentCustomerProblem ? String(ctx.currentCustomerProblem) : null,
      onboarding_data: ctx,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('seller_profiles')
      .upsert(payload, { onConflict: 'owner_user_id' });

    if (error) {
      console.warn('Failed to persist seller profile to Supabase:', error.message);
      throw error;
    }
  },

  async loadSellerProductContext(userId: string): Promise<Record<string, unknown> | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('seller_profiles')
      .select('*')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    if (data.onboarding_data && Object.keys(data.onboarding_data).length > 0) {
      return data.onboarding_data;
    }

    // Map columns back if onboarding_data is empty
    return {
      companyName: data.company_name,
      website: data.website || '',
      industry: data.target_market || '',
      geography: data.geography || '',
      productDescription: data.product_description || '',
      businessModel: data.offering_type || 'B2B SaaS',
      indicativePricing: data.price_range || '',
      currentCustomerProblem: data.main_customer_problem || '',
    };
  },

  // Datasets
  async getDatasets(userId: string): Promise<DbDataset[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createDataset(userId: string, dataset: Omit<DbDataset, 'id' | 'created_at' | 'owner_user_id'>): Promise<DbDataset | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('datasets')
      .insert({
        ...dataset,
        owner_user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDataset(userId: string, datasetId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('datasets')
      .delete()
      .eq('id', datasetId)
      .eq('owner_user_id', userId);

    if (error) throw error;
  },

  // Leads
  async getLeads(userId: string, datasetId: string): Promise<DbLead[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createLeadsBatch(userId: string, datasetId: string, leads: Array<Omit<DbLead, 'id' | 'created_at' | 'owner_user_id' | 'dataset_id'>>): Promise<DbLead[]> {
    if (!supabase) return [];
    const payload = leads.map(l => ({
      ...l,
      owner_user_id: userId,
      dataset_id: datasetId,
    }));

    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select();

    if (error) throw error;
    return data || [];
  },

  // Lead Scores
  async getLeadScores(userId: string, leadIds: string[]): Promise<DbLeadScore[]> {
    if (!supabase || leadIds.length === 0) return [];
    const { data, error } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('owner_user_id', userId)
      .in('lead_id', leadIds);

    if (error) throw error;
    return data || [];
  },

  async upsertLeadScoresBatch(userId: string, scores: Array<Omit<DbLeadScore, 'id' | 'created_at' | 'owner_user_id'>>): Promise<void> {
    if (!supabase || scores.length === 0) return;
    const payload = scores.map(s => ({
      ...s,
      owner_user_id: userId,
    }));

    const { error } = await supabase
      .from('lead_scores')
      .upsert(payload, { onConflict: 'lead_id' });

    if (error) throw error;
  },

  // Segments
  async getSegments(userId: string, datasetId: string): Promise<DbSegment[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('dataset_id', datasetId);

    if (error) throw error;
    return data || [];
  },

  async getDatasetSTPAnalysis(userId: string, datasetId: string): Promise<DatasetSTPAnalysis | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('dataset_stp_analyses')
      .select('stp_analysis_json')
      .eq('owner_user_id', userId)
      .eq('dataset_id', datasetId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return (data?.stp_analysis_json as unknown as DatasetSTPAnalysis) || null;
  },

  // ICP Report
  async getIcpReport(userId: string, datasetId: string): Promise<DbIcpReport | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('icp_reports')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('dataset_id', datasetId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Analysis Jobs
  async createAnalysisJob(userId: string, datasetId: string, totalCount: number): Promise<DbAnalysisJob | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('analysis_jobs')
      .insert({
        owner_user_id: userId,
        dataset_id: datasetId,
        status: 'queued',
        total_count: totalCount,
        completed_count: 0,
        failed_count: 0,
        last_error: null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAnalysisJob(userId: string, jobId: string, updates: Partial<DbAnalysisJob>): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('analysis_jobs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('owner_user_id', userId);

    if (error) throw error;
  },

  async getAnalysisJobs(userId: string, datasetId?: string): Promise<DbAnalysisJob[]> {
    if (!supabase) return [];
    let query = supabase
      .from('analysis_jobs')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (datasetId) {
      query = query.eq('dataset_id', datasetId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async updateDataset(userId: string, datasetId: string, updates: Partial<DbDataset>): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('datasets')
      .update(updates)
      .eq('id', datasetId)
      .eq('owner_user_id', userId);

    if (error) throw error;
  },
};

export const supabaseService = dbService;

// ------------------------------------------------------------------------------
// LOCAL STORAGE FALLBACK (Graceful zero-credential demo persistence)
// ------------------------------------------------------------------------------
const STORAGE_KEYS = {
  OFFERING: 'icp_mode_offering',
  LEADS: 'icp_mode_leads',
  ANALYSIS: 'icp_mode_analysis',
  SCORES: 'icp_mode_scores',
  DEMO_MODE: 'icp_mode_is_demo',
};

export const persistenceService = {
  saveOffering(offering: unknown) {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFERING, JSON.stringify(offering));
    } catch {
      // ignore in restricted environments
    }
  },
  loadOffering<T>(): T | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFERING);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  saveLeads(leads: unknown) {
    try {
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
    } catch {}
  },
  loadLeads<T>(): T | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEADS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
};
