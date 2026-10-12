/**
 * Supabase Database Types & Entity Definitions
 * Stage: MVP 1
 */

export interface DbSellerProfile {
  id: string;
  owner_user_id: string;
  company_name: string;
  website: string | null;
  product_description: string | null;
  target_market: string | null;
  offering_type: string | null;
  geography: string | null;
  price_range: string | null;
  primary_buyer: string | null;
  main_customer_problem: string | null;
  onboarding_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbDataset {
  id: string;
  owner_user_id: string;
  name: string;
  original_filename: string;
  row_count: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface DbLead {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  company_name: string;
  normalized_domain: string | null;
  website: string | null;
  industry_raw: string | null;
  company_size_raw: string | null;
  business_model_raw: string | null;
  product_raw: string | null;
  geography: string | null;
  lead_status: 'new' | 'qualified' | 'disqualified' | 'contacted' | 'opportunity' | 'won' | 'lost';
  deal_value: number | null;
  currency: string;
  retention_months: number | null;
  notes: string | null;
  raw_row: Record<string, unknown>;
  created_at: string;
}

export interface DbCompanyAnalysis {
  id: string;
  owner_user_id: string;
  lead_id: string;
  industry: string | null;
  company_type: string | null;
  business_model: string | null;
  products: string[];
  target_customers: string[];
  possible_needs: string[];
  company_summary: string | null;
  evidence: Record<string, unknown>;
  attribute_confidence: number | null;
  analysis_status: 'pending' | 'completed' | 'failed';
  model_version: string;
  analyzed_at: string;
}

export interface DbAnalysisJob {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  total_count: number;
  completed_count: number;
  failed_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSegment {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  name: string;
  description: string | null;
  shared_needs: string[];
  selection_basis: string | null;
  company_count: number;
  evidence_level: 'high' | 'moderate' | 'low' | 'exploratory';
  created_at: string;
}

export interface DbScoringConfig {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  weight_config: {
    needUrgency: number;
    capabilityMatch: number;
    stakeholderFeasibility: number;
    firmographicAlignment: number;
  };
  threshold_config: {
    tier1: number;
    tier2: number;
    disqualified: number;
  };
  created_at: string;
  updated_at: string;
}

export interface DbLeadScore {
  id: string;
  owner_user_id: string;
  lead_id: string;
  fit_score: number;
  coverage_score: number;
  intent_score_nullable: number | null;
  fit_tier: 'Tier 1 - Strong Fit' | 'Tier 2 - Moderate Fit' | 'Disqualified';
  scoring_breakdown: Record<string, unknown>;
  created_at: string;
}

export interface DbIcpReport {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  report_json: Record<string, unknown>;
  evidence_level: 'high' | 'moderate' | 'low' | 'exploratory';
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      seller_profiles: {
        Row: DbSellerProfile;
        Insert: Omit<DbSellerProfile, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DbSellerProfile, 'id' | 'owner_user_id'>>;
      };
      datasets: {
        Row: DbDataset;
        Insert: Omit<DbDataset, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DbDataset, 'id' | 'owner_user_id'>>;
      };
      leads: {
        Row: DbLead;
        Insert: Omit<DbLead, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DbLead, 'id' | 'owner_user_id'>>;
      };
      company_analyses: {
        Row: DbCompanyAnalysis;
        Insert: Omit<DbCompanyAnalysis, 'id' | 'analyzed_at'> & {
          id?: string;
          analyzed_at?: string;
        };
        Update: Partial<Omit<DbCompanyAnalysis, 'id' | 'owner_user_id'>>;
      };
      analysis_jobs: {
        Row: DbAnalysisJob;
        Insert: Omit<DbAnalysisJob, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DbAnalysisJob, 'id' | 'owner_user_id'>>;
      };
      segments: {
        Row: DbSegment;
        Insert: Omit<DbSegment, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DbSegment, 'id' | 'owner_user_id'>>;
      };
      scoring_configs: {
        Row: DbScoringConfig;
        Insert: Omit<DbScoringConfig, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DbScoringConfig, 'id' | 'owner_user_id'>>;
      };
      lead_scores: {
        Row: DbLeadScore;
        Insert: Omit<DbLeadScore, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DbLeadScore, 'id' | 'owner_user_id'>>;
      };
      icp_reports: {
        Row: DbIcpReport;
        Insert: Omit<DbIcpReport, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DbIcpReport, 'id' | 'owner_user_id'>>;
      };
    };
  };
}
