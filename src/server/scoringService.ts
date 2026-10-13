import { SupabaseClient } from '@supabase/supabase-js';
import { NormalizedLead } from '../types/lead';
import { OfferingProfile, SellerProductContext } from '../types/offering';
import { LeadICPScore, ScoringWeights } from '../types/scoring';
import {
  calculateDeterministicICPScore,
  batchScoreLeads,
  DEFAULT_SCORING_WEIGHTS,
  validateScoringWeights,
  CURRENT_SCORING_MODEL_VERSION,
} from '../lib/scoring';
import { FullStrategicAnalysis, DetailedFiveCAnalysis, CustomerSegment } from '../types/analysis';
import { CompanyIntelligence, CompanyAnalysisEnvelope } from '../types/companyIntelligence';
import { LeadForAnalysis } from './analysisJobService';

export interface ScoringRepository {
  assertOwnedDataset(userId: string, datasetId: string): Promise<void>;
  getScoringConfig(userId: string, datasetId: string): Promise<ScoringWeights | null>;
  saveScoringConfig(userId: string, datasetId: string, weights: ScoringWeights): Promise<void>;
  getLeadScores(userId: string, datasetId: string): Promise<LeadICPScore[]>;
  getSingleLeadScore(userId: string, leadId: string): Promise<LeadICPScore | null>;
  saveLeadScores(userId: string, datasetId: string, scores: LeadICPScore[]): Promise<void>;
}

export function createSupabaseScoringRepository(client: SupabaseClient): ScoringRepository {
  return {
    async assertOwnedDataset(userId: string, datasetId: string): Promise<void> {
      const { data, error } = await client
        .from('datasets')
        .select('id')
        .eq('id', datasetId)
        .eq('owner_user_id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to verify dataset ownership: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Dataset ${datasetId} not found or not owned by user.`);
      }
    },

    async getScoringConfig(userId: string, datasetId: string): Promise<ScoringWeights | null> {
      const { data, error } = await client
        .from('scoring_configs')
        .select('weight_config')
        .eq('owner_user_id', userId)
        .eq('dataset_id', datasetId)
        .maybeSingle();

      if (error) {
        console.warn('Error reading scoring config from Supabase:', error.message);
        return null;
      }
      if (!data?.weight_config) return null;

      const wc = data.weight_config as Record<string, number>;
      return {
        needUrgencyWeight: typeof wc.needUrgency === 'number' ? wc.needUrgency : (wc.needUrgencyWeight ?? DEFAULT_SCORING_WEIGHTS.needUrgencyWeight),
        capabilityMatchWeight: typeof wc.capabilityMatch === 'number' ? wc.capabilityMatch : (wc.capabilityMatchWeight ?? DEFAULT_SCORING_WEIGHTS.capabilityMatchWeight),
        stakeholderFeasibilityWeight: typeof wc.stakeholderFeasibility === 'number' ? wc.stakeholderFeasibility : (wc.stakeholderFeasibilityWeight ?? DEFAULT_SCORING_WEIGHTS.stakeholderFeasibilityWeight),
        firmographicAlignmentWeight: typeof wc.firmographicAlignment === 'number' ? wc.firmographicAlignment : (wc.firmographicAlignmentWeight ?? DEFAULT_SCORING_WEIGHTS.firmographicAlignmentWeight),
      };
    },

    async saveScoringConfig(userId: string, datasetId: string, weights: ScoringWeights): Promise<void> {
      const validation = validateScoringWeights(weights);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid scoring weights.');
      }

      const { error } = await client.from('scoring_configs').upsert(
        {
          owner_user_id: userId,
          dataset_id: datasetId,
          weight_config: {
            needUrgency: weights.needUrgencyWeight,
            capabilityMatch: weights.capabilityMatchWeight,
            stakeholderFeasibility: weights.stakeholderFeasibilityWeight,
            firmographicAlignment: weights.firmographicAlignmentWeight,
          },
          threshold_config: {
            tier1: 80,
            tier2: 65,
            tier3: 45,
            disqualified: 45,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_user_id,dataset_id' }
      );

      if (error) {
        throw new Error(`Failed to persist scoring config: ${error.message}`);
      }
    },

    async getLeadScores(userId: string, datasetId: string): Promise<LeadICPScore[]> {
      const { data, error } = await client
        .from('lead_scores')
        .select('*')
        .eq('owner_user_id', userId)
        .eq('dataset_id', datasetId)
        .order('fit_score', { ascending: false });

      if (error) {
        console.warn('Error reading lead scores:', error.message);
        return [];
      }
      if (!data) return [];

      return data.map((row) => {
        const breakdown = (row.scoring_breakdown || {}) as Record<string, any>;
        return {
          leadId: row.lead_id,
          companyName: breakdown.companyName || 'Scored Lead',
          domain: breakdown.domain || null,
          totalScore: Number(row.fit_score),
          tier: row.fit_tier as any,
          confidence: Number(breakdown.confidence ?? 0.85),
          isHypothesisOnly: Boolean(breakdown.isHypothesisOnly ?? true),
          breakdown: Array.isArray(breakdown.items) ? breakdown.items : [],
          primaryStrengths: Array.isArray(breakdown.primaryStrengths) ? breakdown.primaryStrengths : [],
          primaryDisqualifiers: Array.isArray(breakdown.primaryDisqualifiers) ? breakdown.primaryDisqualifiers : [],
          recommendedAction: breakdown.recommendedAction || (row.fit_score >= 80 ? 'Immediate Outreach' : 'Further Discovery'),
          scoredAt: row.created_at,
          evidenceCoverage: Number(row.coverage_score ?? 100),
          isInsufficientEvidence: Number(row.coverage_score ?? 100) < 70,
          intentScore: row.intent_score_nullable !== null ? Number(row.intent_score_nullable) : null,
          intentLabel: breakdown.intentLabel || 'BUYING INTENT: UNKNOWN',
          isDisqualified: Boolean(row.is_disqualified),
          disqualificationReason: row.disqualification_reason || null,
          disqualificationEvidence: breakdown.disqualificationEvidence || null,
          disqualificationConstraint: breakdown.disqualificationConstraint || null,
          missingFields: Array.isArray(breakdown.missingFields) ? breakdown.missingFields : [],
          modelVersion: row.model_version || CURRENT_SCORING_MODEL_VERSION,
        };
      });
    },

    async getSingleLeadScore(userId: string, leadId: string): Promise<LeadICPScore | null> {
      const { data, error } = await client
        .from('lead_scores')
        .select('*')
        .eq('owner_user_id', userId)
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error || !data) return null;

      const breakdown = (data.scoring_breakdown || {}) as Record<string, any>;
      return {
        leadId: data.lead_id,
        companyName: breakdown.companyName || 'Scored Lead',
        domain: breakdown.domain || null,
        totalScore: Number(data.fit_score),
        tier: data.fit_tier as any,
        confidence: Number(breakdown.confidence ?? 0.85),
        isHypothesisOnly: Boolean(breakdown.isHypothesisOnly ?? true),
        breakdown: Array.isArray(breakdown.items) ? breakdown.items : [],
        primaryStrengths: Array.isArray(breakdown.primaryStrengths) ? breakdown.primaryStrengths : [],
        primaryDisqualifiers: Array.isArray(breakdown.primaryDisqualifiers) ? breakdown.primaryDisqualifiers : [],
        recommendedAction: breakdown.recommendedAction || 'Further Discovery',
        scoredAt: data.created_at,
        evidenceCoverage: Number(data.coverage_score ?? 100),
        isInsufficientEvidence: Number(data.coverage_score ?? 100) < 70,
        intentScore: data.intent_score_nullable !== null ? Number(data.intent_score_nullable) : null,
        intentLabel: breakdown.intentLabel || 'BUYING INTENT: UNKNOWN',
        isDisqualified: Boolean(data.is_disqualified),
        disqualificationReason: data.disqualification_reason || null,
        disqualificationEvidence: breakdown.disqualificationEvidence || null,
        disqualificationConstraint: breakdown.disqualificationConstraint || null,
        missingFields: Array.isArray(breakdown.missingFields) ? breakdown.missingFields : [],
        modelVersion: data.model_version || CURRENT_SCORING_MODEL_VERSION,
      };
    },

    async saveLeadScores(userId: string, datasetId: string, scores: LeadICPScore[]): Promise<void> {
      if (!scores.length) return;

      const rows = scores.map((s) => ({
        owner_user_id: userId,
        dataset_id: datasetId,
        lead_id: s.leadId,
        fit_score: s.totalScore,
        coverage_score: s.evidenceCoverage ?? 100,
        intent_score_nullable: s.intentScore ?? null,
        fit_tier: s.tier,
        is_disqualified: Boolean(s.isDisqualified),
        disqualification_reason: s.disqualificationReason || null,
        model_version: s.modelVersion || CURRENT_SCORING_MODEL_VERSION,
        scoring_breakdown: {
          companyName: s.companyName,
          domain: s.domain,
          confidence: s.confidence,
          isHypothesisOnly: s.isHypothesisOnly,
          items: s.breakdown,
          primaryStrengths: s.primaryStrengths,
          primaryDisqualifiers: s.primaryDisqualifiers,
          recommendedAction: s.recommendedAction,
          intentLabel: s.intentLabel,
          disqualificationEvidence: s.disqualificationEvidence,
          disqualificationConstraint: s.disqualificationConstraint,
          missingFields: s.missingFields,
          segmentId: s.segmentId,
          segmentName: s.segmentName,
        },
        updated_at: new Date().toISOString(),
      }));

      const { error } = await client
        .from('lead_scores')
        .upsert(rows, { onConflict: 'lead_id' });

      if (error) {
        throw new Error(`Failed to persist lead scores: ${error.message}`);
      }
    },
  };
}

export class InMemoryScoringRepository implements ScoringRepository {
  private configs = new Map<string, ScoringWeights>();
  private scores = new Map<string, LeadICPScore[]>();
  private datasetOwners = new Map<string, string>();

  setDatasetOwner(datasetId: string, ownerUserId: string): void {
    this.datasetOwners.set(datasetId, ownerUserId);
  }

  async assertOwnedDataset(userId: string, datasetId: string): Promise<void> {
    const owner = this.datasetOwners.get(datasetId);
    if (owner && owner !== userId) {
      throw new Error(`Dataset ${datasetId} not found or not owned by user.`);
    }
  }

  async getScoringConfig(userId: string, datasetId: string): Promise<ScoringWeights | null> {
    return this.configs.get(`${userId}:${datasetId}`) || null;
  }

  async saveScoringConfig(userId: string, datasetId: string, weights: ScoringWeights): Promise<void> {
    const validation = validateScoringWeights(weights);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid weights');
    }
    this.configs.set(`${userId}:${datasetId}`, weights);
  }

  async getLeadScores(userId: string, datasetId: string): Promise<LeadICPScore[]> {
    return this.scores.get(`${userId}:${datasetId}`) || [];
  }

  async getSingleLeadScore(userId: string, leadId: string): Promise<LeadICPScore | null> {
    for (const [key, list] of this.scores.entries()) {
      if (key.startsWith(`${userId}:`)) {
        const found = list.find((s) => s.leadId === leadId);
        if (found) return found;
      }
    }
    return null;
  }

  async saveLeadScores(userId: string, datasetId: string, scores: LeadICPScore[]): Promise<void> {
    const existing = this.scores.get(`${userId}:${datasetId}`) || [];
    const map = new Map<string, LeadICPScore>();
    for (const item of existing) {
      map.set(item.leadId, item);
    }
    for (const item of scores) {
      map.set(item.leadId, item);
    }
    this.scores.set(`${userId}:${datasetId}`, Array.from(map.values()));
  }
}
