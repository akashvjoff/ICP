import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  parseLeadBytes,
  processLeadPipeline,
  validateUniqueMapping,
  type PipelineProcessResult,
  type ParseResult,
} from '../lib/leadPipeline';
import { UPLOAD_CONFIG } from '../lib/uploadConfig';
import type { ColumnMapping, NormalizedLead } from '../types/lead';

const mappingKeys = [
  'companyName', 'domain', 'industry', 'headcount', 'annualRevenue', 'description',
  'country', 'technologies', 'companyType', 'businessModel', 'product', 'leadStage',
  'city', 'firstName', 'lastName', 'jobTitle', 'seniority', 'email', 'emailStatus', 'phone', 'linkedinUrl',
  'dealValue', 'currency', 'retentionMonths', 'customerPain', 'reasonWonLost',
] as const;

const columnMappingSchema = z.object(
  Object.fromEntries(mappingKeys.map((key) => [key, z.string().trim().min(1).max(255).optional()])) as Record<
    typeof mappingKeys[number],
    z.ZodOptional<z.ZodString>
  >
).partial();

export const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255).regex(/\.(csv|xlsx)$/i, 'Only .csv and .xlsx files are supported.'),
  fileSizeBytes: z.number().int().positive().max(UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES),
  fileBase64: z.string().min(1).max(7_100_000),
  mapping: columnMappingSchema,
  skipDuplicates: z.boolean().default(true),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export class UploadValidationError extends Error {
  constructor(message: string, public readonly statusCode = 422) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

export interface PreparedUpload {
  parsed: ParseResult;
  pipeline: PipelineProcessResult;
  mapping: ColumnMapping;
}

export function getBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  const token = authorizationHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new UploadValidationError('The uploaded file payload is not valid base64.');
  }
  return new Uint8Array(Buffer.from(normalized, 'base64'));
}

export async function prepareUpload(input: unknown): Promise<PreparedUpload> {
  const validated = uploadRequestSchema.safeParse(input);
  if (!validated.success) {
    throw new UploadValidationError(validated.error.issues[0]?.message || 'Invalid upload request.');
  }

  const mapping = validated.data.mapping as ColumnMapping;
  const mappingErrors = validateUniqueMapping(mapping);
  if (mappingErrors.length > 0) throw new UploadValidationError(mappingErrors.join(' '));
  if (!mapping.companyName && !mapping.domain) {
    throw new UploadValidationError('Map at least Company Name or Website/Domain.');
  }

  const bytes = decodeBase64(validated.data.fileBase64);
  let parsed: ParseResult;
  try {
    parsed = await parseLeadBytes(validated.data.fileName, bytes, validated.data.fileSizeBytes);
  } catch (error) {
    throw new UploadValidationError(error instanceof Error ? error.message : 'Unable to parse the uploaded file.');
  }

  const unknownMappedColumns = Object.values(mapping).filter(
    (source): source is string => Boolean(source) && !parsed.headers.includes(source as string)
  );
  if (unknownMappedColumns.length > 0) {
    throw new UploadValidationError(`Mapped column not found in file: ${unknownMappedColumns.join(', ')}.`);
  }

  let pipeline: PipelineProcessResult;
  try {
    pipeline = processLeadPipeline(parsed.rawRows, mapping, {
      maxTotalRows: UPLOAD_CONFIG.MAX_ROWS_PER_DATASET,
      maxAiEnrichedDemo: UPLOAD_CONFIG.MAX_AI_ENRICHED_ROWS_DEMO,
      skipDuplicates: true,
      piiColumnsToScrub: parsed.piiColumnsDetected,
    });
  } catch (error) {
    throw new UploadValidationError(error instanceof Error ? error.message : 'Unable to validate uploaded rows.');
  }

  if (pipeline.validLeads.length === 0) {
    throw new UploadValidationError('No valid company records remain after validation.');
  }

  return { parsed, pipeline, mapping };
}

export interface UploadRepository {
  createDataset(ownerUserId: string, values: Record<string, unknown>): Promise<{ id: string }>;
  insertLeads(ownerUserId: string, datasetId: string, values: Array<Record<string, unknown>>): Promise<Array<{ id: string }>>;
  insertContacts(ownerUserId: string, datasetId: string, values: Array<Record<string, unknown>>): Promise<void>;
  createQueuedJob(ownerUserId: string, datasetId: string, totalCount: number, skippedCount?: number): Promise<{ id: string; status: string }>;
  deleteDataset(ownerUserId: string, datasetId: string): Promise<void>;
}

function toLeadInsert(lead: NormalizedLead): Record<string, unknown> {
  return {
    id: randomUUID(),
    company_name: lead.companyName,
    normalized_domain: lead.domain,
    website: lead.website || null,
    industry_raw: lead.industry || null,
    company_size_raw: lead.headcountRaw || null,
    employee_count: lead.headcount,
    employee_count_min: lead.headcountMin ?? null,
    employee_count_max: lead.headcountMax ?? null,
    annual_revenue: lead.annualRevenueValue ?? null,
    company_type_raw: lead.companyType || null,
    business_model_raw: lead.businessModel || null,
    product_raw: lead.productRaw || null,
    geography: lead.country || null,
    lead_status: lead.leadStage || 'new',
    deal_value: lead.dealValue ?? null,
    currency: lead.currency || null,
    retention_months: lead.retentionMonths ?? null,
    notes: lead.description || null,
    customer_pain: lead.customerPain || null,
    reason_won_lost: lead.reasonWonLost || null,
    analysis_eligible: Boolean(lead.isAiEnriched),
    analysis_status: lead.isAiEnriched ? 'pending' : 'skipped',
    validation_warnings: lead.validationWarnings || [],
    user_corrected_description: null,
    raw_row: lead.rawRow || {},
  };
}

export async function persistPreparedUpload(
  repository: UploadRepository,
  ownerUserId: string,
  prepared: PreparedUpload
): Promise<{ datasetId: string; analysisJobId: string; leadIds: string[] }> {
  const { parsed, pipeline, mapping } = prepared;
  const dataset = await repository.createDataset(ownerUserId, {
    name: parsed.fileName.replace(/\.[^/.]+$/, ''),
    original_filename: parsed.fileName,
    original_file_size_bytes: parsed.fileSizeBytes,
    row_count: pipeline.validLeads.length,
    invalid_row_count: pipeline.invalidRows.length,
    duplicate_row_count: pipeline.summary.duplicateRowsCount,
    column_mapping: mapping,
    parse_warnings: parsed.parseErrors,
    status: 'processing',
  });

  try {
    const inserted = await repository.insertLeads(
      ownerUserId,
      dataset.id,
      pipeline.validLeads.map(toLeadInsert)
    );
    await repository.insertContacts(ownerUserId, dataset.id, inserted.flatMap((row, index) =>
      (pipeline.validLeads[index]?.contacts || []).filter((contact) =>
        contact.firstName || contact.lastName || contact.email || contact.phone || contact.linkedinUrl
      ).map((contact) => ({
        lead_id: row.id, first_name: contact.firstName, last_name: contact.lastName,
        job_title: contact.jobTitle, seniority: contact.seniority, email: contact.email,
        email_status: contact.emailStatus, phone: contact.phone, linkedin_url: contact.linkedinUrl,
        lead_stage: contact.leadStage, city: contact.city, country: contact.country,
      }))
    ));
    const totalAiEligible = pipeline.validLeads.filter((lead) => lead.isAiEnriched).length;
    const skippedCount = pipeline.validLeads.length - totalAiEligible;
    const job = await repository.createQueuedJob(
      ownerUserId,
      dataset.id,
      totalAiEligible,
      skippedCount
    );
    return { datasetId: dataset.id, analysisJobId: job.id, leadIds: inserted.map((lead) => lead.id) };
  } catch (error) {
    await repository.deleteDataset(ownerUserId, dataset.id).catch(() => undefined);
    throw error;
  }
}

export function createSupabaseUploadRepository(client: SupabaseClient): UploadRepository {
  return {
    async createDataset(ownerUserId, values) {
      const { data, error } = await client
        .from('datasets')
        .insert({ ...values, owner_user_id: ownerUserId })
        .select('id')
        .single();
      if (error || !data) throw error || new Error('Dataset insert returned no row.');
      return data;
    },
    async insertLeads(ownerUserId, datasetId, values) {
      const inserted: Array<{ id: string }> = [];
      for (let index = 0; index < values.length; index += 100) {
        const chunk = values.slice(index, index + 100).map((lead) => ({
          ...lead,
          owner_user_id: ownerUserId,
          dataset_id: datasetId,
        }));
        const { error } = await client.from('leads').insert(chunk);
        if (error) throw error;
        inserted.push(...values.slice(index, index + 100).map((lead) => ({ id: String(lead.id) })));
      }
      return inserted;
    },
    async createQueuedJob(ownerUserId, datasetId, totalCount, skippedCount = 0) {
      const { data, error } = await client
        .from('analysis_jobs')
        .insert({
          owner_user_id: ownerUserId,
          dataset_id: datasetId,
          status: 'queued',
          total_count: totalCount,
          completed_count: 0,
          failed_count: 0,
          skipped_count: skippedCount,
          last_error: null,
        })
        .select('id, status')
        .single();
      if (error || !data) throw error || new Error('Analysis job insert returned no row.');
      return data;
    },
    async insertContacts(ownerUserId, datasetId, values) {
      for (let index = 0; index < values.length; index += 100) {
        const chunk = values.slice(index, index + 100).map((contact) => ({ ...contact, owner_user_id: ownerUserId, dataset_id: datasetId }));
        const { error } = await client.from('lead_contacts').insert(chunk);
        if (error) throw error;
      }
    },
    async deleteDataset(ownerUserId, datasetId) {
      const { error } = await client
        .from('datasets')
        .delete()
        .eq('id', datasetId)
        .eq('owner_user_id', ownerUserId);
      if (error) throw error;
    },
  };
}
