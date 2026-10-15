import type { SupabaseClient } from '@supabase/supabase-js';
import {
  companyIntelligenceSchema,
  type CompanyAnalysisEnvelope,
  type CompanyAnalysisInput,
  type CompanyIntelligence,
} from '../types/companyIntelligence';
import {
  CompanyAnalysisError,
  createCompanyAnalysisHash,
  sanitizeCompanyAnalysisInput,
  type CompanyAnalyzer,
} from './companyAnalyzer';

export interface CompanyAnalysisRepository {
  assertOwnedLead(ownerUserId: string, leadId: string): Promise<void>;
  findCached(ownerUserId: string, inputHash: string): Promise<CompanyAnalysisEnvelope | null>;
  saveCompleted(
    ownerUserId: string,
    leadId: string,
    inputHash: string,
    envelope: CompanyAnalysisEnvelope,
    input: CompanyAnalysisInput,
  ): Promise<void>;
  saveFailed(ownerUserId: string, leadId: string, inputHash: string, error: CompanyAnalysisError): Promise<void>;
}

function confidenceNumber(analysis: CompanyIntelligence): number {
  const scores = {
    high: 0.9,
    medium: 0.65,
    low: 0.35,
  } as const;
  return scores[analysis.data_quality.confidence];
}

export async function analyzeCompanyWithCache(
  repository: CompanyAnalysisRepository,
  analyzer: CompanyAnalyzer,
  ownerUserId: string,
  leadId: string,
  rawInput: CompanyAnalysisInput,
  websiteEvidence?: CompanyAnalysisEnvelope['websiteEvidence'],
): Promise<CompanyAnalysisEnvelope> {
  const input = sanitizeCompanyAnalysisInput(rawInput);
  const inputHash = createCompanyAnalysisHash(input);
  await repository.assertOwnedLead(ownerUserId, leadId);

  const cached = await repository.findCached(ownerUserId, inputHash);
  if (cached && cached.provider === analyzer.providerName) {
    const cachedEnvelope = {
      ...cached,
      cached: true,
      userCorrectedDescription: input.userCorrectedDescription || cached.userCorrectedDescription,
      websiteEvidence: websiteEvidence || cached.websiteEvidence,
    };
    await repository.saveCompleted(ownerUserId, leadId, inputHash, cachedEnvelope, input);
    return cachedEnvelope;
  }

  try {
    const generated = await analyzer.analyze(input);
    const envelope: CompanyAnalysisEnvelope = {
      analysis: companyIntelligenceSchema.parse(generated.analysis),
      provider: analyzer.providerName,
      modelVersion: generated.modelVersion,
      analyzedAt: new Date().toISOString(),
      cached: false,
      sourceMode: input.publicWebsiteText
        ? (input.companyProductDescription || input.userCorrectedDescription ? 'both' : 'public_website')
        : 'uploaded_only',
      userCorrectedDescription: input.userCorrectedDescription || '',
      websiteEvidence: websiteEvidence && { ...websiteEvidence, source: 'live' },
    };
    await repository.saveCompleted(ownerUserId, leadId, inputHash, envelope, input);
    return envelope;
  } catch (error) {
    const visibleError = error instanceof CompanyAnalysisError
      ? error
      : new CompanyAnalysisError('NETWORK_FAILURE', 'Company analysis failed unexpectedly.', 502, true);
    await repository.saveFailed(ownerUserId, leadId, inputHash, visibleError).catch(() => undefined);
    throw visibleError;
  }
}

export function createSupabaseCompanyAnalysisRepository(client: SupabaseClient): CompanyAnalysisRepository {
  return {
    async assertOwnedLead(ownerUserId, leadId) {
      const { data, error } = await client
        .from('leads')
        .select('id')
        .eq('id', leadId)
        .eq('owner_user_id', ownerUserId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new CompanyAnalysisError('EMPTY_INFORMATION', 'The requested company record was not found.', 404);
      }
    },

    async findCached(ownerUserId, inputHash) {
      const { data, error } = await client
        .from('company_analyses')
        .select('analysis_json, provider, model_version, analyzed_at, website_source_url, website_fetched_at, website_extraction_json, user_corrected_description')
        .eq('owner_user_id', ownerUserId)
        .eq('input_hash', inputHash)
        .eq('analysis_status', 'completed')
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.analysis_json) return null;
      const parsed = companyIntelligenceSchema.safeParse(data.analysis_json);
      if (!parsed.success) return null;
      return {
        analysis: parsed.data,
        provider: data.provider || 'unknown',
        modelVersion: data.model_version || 'unknown',
        analyzedAt: data.analyzed_at,
        cached: true,
        sourceMode: data.website_source_url
          ? (parsed.data.product_summary.origin === 'uploaded' ? 'both' : 'public_website')
          : 'uploaded_only',
        websiteEvidence: data.website_extraction_json
          ? { ...data.website_extraction_json, source: 'live' } as CompanyAnalysisEnvelope['websiteEvidence']
          : undefined,
        userCorrectedDescription: data.user_corrected_description || '',
      };
    },

    async saveCompleted(ownerUserId, leadId, inputHash, envelope, input) {
      const { analysis } = envelope;
      const { error } = await client.from('company_analyses').upsert({
        owner_user_id: ownerUserId,
        lead_id: leadId,
        industry: analysis.industry.value === 'unknown' ? null : analysis.industry.value,
        company_type: analysis.company_type.value === 'unknown' ? null : analysis.company_type.value,
        business_model: analysis.business_model.value === 'unknown' ? null : analysis.business_model.value,
        products: analysis.products.value,
        target_customers: analysis.target_customers.value,
        possible_needs: analysis.potential_business_needs.value,
        company_summary: analysis.product_summary.value === 'unknown' ? null : analysis.product_summary.value,
        evidence: analysis.evidence,
        attribute_confidence: confidenceNumber(analysis),
        analysis_status: 'completed',
        model_version: envelope.modelVersion,
        provider: envelope.provider,
        input_hash: inputHash,
        analysis_json: analysis,
        error_code: null,
        error_message: null,
        website_source_url: envelope.websiteEvidence?.sourceUrl || null,
        website_fetched_at: envelope.websiteEvidence?.fetchedAt || null,
        website_extraction_json: envelope.websiteEvidence || null,
        user_corrected_description: input.userCorrectedDescription || null,
        analyzed_at: envelope.analyzedAt,
      }, { onConflict: 'lead_id' });
      if (error) throw error;
      if (input.userCorrectedDescription) {
        const { error: leadError } = await client.from('leads')
          .update({ user_corrected_description: input.userCorrectedDescription })
          .eq('id', leadId)
          .eq('owner_user_id', ownerUserId);
        if (leadError) throw leadError;
      }
    },

    async saveFailed(ownerUserId, leadId, inputHash, error) {
      const { error: databaseError } = await client.from('company_analyses').upsert({
        owner_user_id: ownerUserId,
        lead_id: leadId,
        analysis_status: 'failed',
        model_version: 'unavailable',
        provider: 'unavailable',
        input_hash: inputHash,
        analysis_json: null,
        error_code: error.code,
        error_message: error.message,
        analyzed_at: new Date().toISOString(),
      }, { onConflict: 'lead_id' });
      if (databaseError) throw databaseError;
    },
  };
}

export class InMemoryCompanyAnalysisRepository implements CompanyAnalysisRepository {
  private cache: Map<string, CompanyAnalysisEnvelope> = new Map();
  private leadAnalyses: Map<string, CompanyAnalysisEnvelope> = new Map();

  async assertOwnedLead(_ownerUserId: string, _leadId: string): Promise<void> {
    // Valid for demo/test mode
  }

  async findCached(ownerUserId: string, inputHash: string): Promise<CompanyAnalysisEnvelope | null> {
    const item = this.cache.get(`${ownerUserId}:${inputHash}`);
    return item ? structuredClone(item) : null;
  }

  async saveCompleted(
    ownerUserId: string,
    leadId: string,
    inputHash: string,
    envelope: CompanyAnalysisEnvelope,
    _input: CompanyAnalysisInput,
  ): Promise<void> {
    this.cache.set(`${ownerUserId}:${inputHash}`, structuredClone(envelope));
    this.leadAnalyses.set(`${ownerUserId}:${leadId}`, structuredClone(envelope));
  }

  async saveFailed(_ownerUserId: string, _leadId: string, _inputHash: string, _error: CompanyAnalysisError): Promise<void> {
    // Recorded in memory
  }

  getLeadAnalysis(ownerUserId: string, leadId: string): CompanyAnalysisEnvelope | null {
    const item = this.leadAnalyses.get(`${ownerUserId}:${leadId}`);
    return item ? structuredClone(item) : null;
  }
}
