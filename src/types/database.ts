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
  original_file_size_bytes?: number | null;
  invalid_row_count?: number;
  duplicate_row_count?: number;
  column_mapping?: Record<string, string>;
  parse_warnings?: string[];
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
  employee_count?: number | null;
  annual_revenue?: number | null;
  company_type_raw?: string | null;
  business_model_raw: string | null;
  product_raw: string | null;
  geography: string | null;
  lead_status: 'new' | 'qualified' | 'disqualified' | 'contacted' | 'opportunity' | 'won' | 'lost';
  deal_value: number | null;
  currency: string | null;
  retention_months: number | null;
  notes: string | null;
  customer_pain?: string | null;
  reason_won_lost?: string | null;
  analysis_eligible?: boolean;
  analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  validation_warnings?: string[];
  user_corrected_description?: string | null;
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
  model_version: string | null;
  provider?: string;
  input_hash?: string | null;
  analysis_json?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
  website_source_url?: string | null;
  website_fetched_at?: string | null;
  website_extraction_json?: Record<string, unknown> | null;
  user_corrected_description?: string | null;
  need_gap_json?: Record<string, unknown> | null;
  analyzed_at: string;
}

export interface DbDatasetStrategicAnalysis {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  seller_offering_id: string | null;
  need_gap_summary: Record<string, unknown>;
  five_c_analysis: Record<string, unknown>;
  lead_analyses_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbDatasetSTPAnalysis {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  seller_offering_id: string | null;
  stp_analysis_json: Record<string, unknown>;
  segments_count: number;
  created_at: string;
  updated_at: string;
}


export interface DbAnalysisJob {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  status: 'pending' | 'queued' | 'running' | 'processing' | 'paused' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  total_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
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
  dataset_id?: string;
  lead_id: string;
  fit_score: number;
  coverage_score: number;
  intent_score_nullable: number | null;
  fit_tier: string;
  scoring_breakdown: Record<string, unknown>;
  is_disqualified?: boolean;
  disqualification_reason?: string | null;
  model_version?: string;
  created_at: string;
  updated_at?: string;
}

export interface DbIcpReport {
  id: string;
  owner_user_id: string;
  dataset_id: string;
  seller_offering_id?: string | null;
  version_fingerprint?: string | null;
  report_json: Record<string, unknown>;
  evidence_level: 'high' | 'moderate' | 'low' | 'exploratory';
  created_at: string;
  updated_at?: string;
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
      dataset_strategic_analyses: {
        Row: DbDatasetStrategicAnalysis;
        Insert: Omit<DbDatasetStrategicAnalysis, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DbDatasetStrategicAnalysis, 'id' | 'owner_user_id'>>;
      };
    };
  };
}
