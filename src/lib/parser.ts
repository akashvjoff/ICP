/**
 * Parser Adapter for Lead Ingestion
 * Bridges raw inputs with the leadPipeline normalization engine
 */
import {
  autoDetectColumns,
  normalizeCompanyDomain,
  parseLeadFile,
  processLeadPipeline,
  generateSampleCsvContent,
} from './leadPipeline';
import { RawLeadRecord, NormalizedLead, ColumnMapping } from '../types/lead';

export {
  autoDetectColumns,
  normalizeCompanyDomain,
  parseLeadFile,
  processLeadPipeline,
  generateSampleCsvContent,
};

export interface ParseResult {
  headers: string[];
  rawRows: RawLeadRecord[];
  detectedMapping: ColumnMapping;
  errors: string[];
}

export async function parseCSVString(csvContent: string): Promise<ParseResult> {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const file = new File([blob], 'leads.csv', { type: 'text/csv' });
  const result = await parseLeadFile(file);
  return {
    headers: result.headers,
    rawRows: result.rawRows,
    detectedMapping: result.detectedMapping,
    errors: result.parseErrors,
  };
}

export function normalizeRawLead(raw: RawLeadRecord, mapping: ColumnMapping, index: number): NormalizedLead {
  const res = processLeadPipeline([raw], mapping, { maxTotalRows: 1, maxAiEnrichedDemo: 1 });
  if (res.validLeads.length > 0) {
    return res.validLeads[0];
  }

  // Fallback if invalid
  const companyName = String(mapping.companyName ? raw[mapping.companyName] || `Lead ${index + 1}` : `Lead ${index + 1}`).trim();
  const rawDomain = mapping.domain && raw[mapping.domain] ? String(raw[mapping.domain]).trim() : null;
  const normalizedDomain = normalizeCompanyDomain(rawDomain);

  return {
    id: `lead-${Date.now()}-${index}`,
    companyName,
    domain: normalizedDomain,
    website: rawDomain,
    hasValidDomain: Boolean(normalizedDomain),
    industry: 'General Enterprise',
    headcount: null,
    annualRevenue: null,
    description: `${companyName} record`,
    country: 'Global',
    technologies: [],
    isAiEnriched: true,
    enrichmentTier: normalizedDomain ? 'full' : 'limited',
    isClean: true,
    isDuplicate: false,
    rawRow: raw,
    ingestedAt: new Date().toISOString(),
  };
}
