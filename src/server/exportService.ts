import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { LeadForAnalysis } from './analysisJobService';
import type { LeadICPScore } from '../types/scoring';
import type { DatasetSTPAnalysis } from '../types/analysis';
import { analyzedScores, scoreTier } from '../lib/tiers';
import { sanitizeCsvCell } from './reportService';
import type { Plan } from '../config/plans';

export const exportQuerySchema = z.object({
  mode: z.enum(['companies', 'contacts']).default('companies'),
  format: z.enum(['csv', 'xlsx']).default('csv'),
  preset: z.enum(['tier1_contacts', 'all_analyzed']).optional(),
  search: z.string().max(150).default(''),
  tier: z.enum(['all', 'tier1', 'tier2', 'tier3', 'tier4', 'disqualified']).default('all'),
  coverage: z.enum(['all', 'sufficient', 'insufficient']).default('all'),
  sort: z.enum(['scoreDesc', 'scoreAsc', 'score_desc', 'score_asc', 'coverage_desc', 'headcount_desc', 'name', 'created']).default('created'),
  segmentId: z.string().max(150).optional(),
  analyzedOnly: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

export interface ExportContact {
  lead_id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  seniority: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
  lead_stage: string | null;
  city: string | null;
  country: string | null;
}

export type ExportRow = Record<string, string | number>;
export type ExportUser = { id: string; email?: string };

export function canExport(_user: ExportUser, mode: ExportQuery['mode'], rows: number, plan: Plan, query: ExportQuery): boolean {
  if (plan.id !== 'free') return true;
  return mode === 'companies' && query.format === 'csv' && rows <= 25 && !query.preset &&
    !query.search && query.tier === 'all' && query.coverage === 'all' && !query.segmentId &&
    query.analyzedOnly === 'false';
}

export function selectExportRows(
  leads: LeadForAnalysis[], scores: LeadICPScore[], stp: DatasetSTPAnalysis | null,
  contacts: ExportContact[], query: ExportQuery
): ExportRow[] {
  const mode = query.preset === 'tier1_contacts' ? 'contacts' : query.mode;
  const tier = query.preset === 'tier1_contacts' ? 'tier1' : query.tier;
  const activeScores = analyzedScores(scores, leads);
  const byScore = new Map(activeScores.map(score => [score.leadId, score]));
  const bySegment = new Map<string, string>();
  for (const segment of stp?.segments || []) {
    for (const id of segment.primaryCompanyIds) {
      const score = byScore.get(id);
      if (score && scoreTier(score) !== 'disqualified') bySegment.set(id, segment.name);
    }
  }
  const segment = query.segmentId ? stp?.segments.find(item => item.id === query.segmentId) : undefined;
  let selected = leads.filter(lead => {
    const score = byScore.get(lead.id);
    if (query.analyzedOnly === 'true' && !score) return false;
    if (query.preset === 'all_analyzed' && !score) return false;
    if (segment && !segment.primaryCompanyIds.includes(lead.id)) return false;
    if (query.segmentId && !segment) return false;
    if (segment && (!score || scoreTier(score) === 'disqualified')) return false;
    const term = query.preset ? '' : query.search.trim().toLowerCase();
    if (term && ![lead.company_name, lead.normalized_domain, lead.industry_raw].some(value => String(value || '').toLowerCase().includes(term))) return false;
    if ((query.preset !== 'all_analyzed') && tier !== 'all' && (!score || scoreTier(score) !== (tier === 'tier4' ? 'disqualified' : tier))) return false;
    if (!query.preset && query.coverage === 'sufficient' && (!score || (score.evidenceCoverage ?? 100) < 70)) return false;
    if (!query.preset && query.coverage === 'insufficient' && (!score || (score.evidenceCoverage ?? 100) >= 70)) return false;
    return true;
  });
  selected.sort((a, b) => {
    const scoreA = byScore.get(a.id);
    const scoreB = byScore.get(b.id);
    if (query.sort === 'scoreDesc' || query.sort === 'score_desc') return (scoreB?.totalScore ?? -1) - (scoreA?.totalScore ?? -1);
    if (query.sort === 'scoreAsc' || query.sort === 'score_asc') return (scoreA?.totalScore ?? Number.MAX_SAFE_INTEGER) - (scoreB?.totalScore ?? Number.MAX_SAFE_INTEGER);
    if (query.sort === 'coverage_desc') return (scoreB?.evidenceCoverage ?? 100) - (scoreA?.evidenceCoverage ?? 100);
    if (query.sort === 'headcount_desc') return (b.employee_count || 0) - (a.employee_count || 0);
    if (query.sort === 'name') return a.company_name.localeCompare(b.company_name);
    return 0;
  });
  if (query.limit) selected = selected.slice(0, query.limit);
  const companyFields = (lead: LeadForAnalysis) => {
    const score = byScore.get(lead.id);
    return {
      Company: lead.company_name,
      Domain: lead.normalized_domain || '',
      Industry: lead.industry_raw || '',
      Headcount: lead.employee_count ?? '',
      Country: lead.geography || '',
      Score: score?.totalScore ?? '',
      Tier: score?.tier || 'PENDING',
      Coverage: score?.evidenceCoverage ?? '',
      Segment: bySegment.get(lead.id) || '',
      Action: score?.recommendedAction || '',
      Strengths: score?.primaryStrengths?.join('; ') || '',
      'Disqualification reason': score?.disqualificationReason || '',
      Status: lead.analysis_status,
    } satisfies ExportRow;
  };
  if (mode === 'companies') return selected.map(companyFields);
  const contactsByLead = new Map<string, ExportContact[]>();
  for (const contact of contacts) contactsByLead.set(contact.lead_id, [...(contactsByLead.get(contact.lead_id) || []), contact]);
  return selected.flatMap(lead => (contactsByLead.get(lead.id) || []).map(contact => ({
    Company: lead.company_name,
    Domain: lead.normalized_domain || '',
    'First name': contact.first_name || '',
    'Last name': contact.last_name || '',
    'Job title': contact.job_title || '',
    Seniority: contact.seniority || '',
    Email: contact.email || '',
    'Email status': contact.email_status || '',
    Phone: contact.phone || '',
    LinkedIn: contact.linkedin_url || '',
    'Lead stage': contact.lead_stage || '',
    City: contact.city || '',
    Country: contact.country || '',
    Score: byScore.get(lead.id)?.totalScore ?? '',
    Tier: byScore.get(lead.id)?.tier || 'PENDING',
    Segment: bySegment.get(lead.id) || '',
    Action: byScore.get(lead.id)?.recommendedAction || '',
  })));
}

export function exportFilename(dataset: string, filter: string, date = new Date()): string {
  const slug = (value: string) => value.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'all';
  return `figuredit_${slug(dataset)}_${slug(filter)}_${date.toISOString().slice(0, 10)}`;
}

export async function encodeExport(rows: ExportRow[], columns: string[], format: 'csv' | 'xlsx'): Promise<Buffer> {
  const safe = (value: string | number) => typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (format === 'csv') {
    const csv = [columns, ...rows.map(row => columns.map(column => safe(row[column] ?? '')))]
      .map(values => values.map(sanitizeCsvCell).join(',')).join('\r\n');
    return Buffer.from(`\uFEFF${csv}`, 'utf8');
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('FiguredIt Export');
  sheet.addRow(columns);
  rows.forEach(row => sheet.addRow(columns.map(column => safe(row[column] ?? ''))));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export const COMPANY_COLUMNS = ['Company', 'Domain', 'Industry', 'Headcount', 'Country', 'Score', 'Tier', 'Coverage', 'Segment', 'Action', 'Strengths', 'Disqualification reason', 'Status'];
export const CONTACT_COLUMNS = ['Company', 'Domain', 'First name', 'Last name', 'Job title', 'Seniority', 'Email', 'Email status', 'Phone', 'LinkedIn', 'Lead stage', 'City', 'Country', 'Score', 'Tier', 'Segment', 'Action'];
