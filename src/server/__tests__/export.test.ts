import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { canExport, COMPANY_COLUMNS, CONTACT_COLUMNS, encodeExport, exportFilename, exportQuerySchema, selectExportRows, type ExportContact } from '../exportService';
import { PLANS } from '../../config/plans';
import type { LeadForAnalysis } from '../analysisJobService';
import type { LeadICPScore } from '../../types/scoring';
import type { DatasetSTPAnalysis } from '../../types/analysis';

const leads = [
  { id: 'a', company_name: 'Alpha', normalized_domain: 'alpha.test', industry_raw: 'Software', employee_count: 20, analysis_status: 'completed', geography: 'India' },
  { id: 'b', company_name: 'Beta', normalized_domain: 'beta.test', industry_raw: 'Software', employee_count: 50, analysis_status: 'completed', geography: 'India' },
  { id: 'c', company_name: 'Gamma', normalized_domain: 'gamma.test', industry_raw: 'Retail', employee_count: 10, analysis_status: 'pending', geography: 'India' },
] as LeadForAnalysis[];
const scores = [
  { leadId: 'a', totalScore: 90, tier: 'Tier 1: High Conviction', evidenceCoverage: 95, primaryStrengths: ['Fit'], recommendedAction: 'Immediate Outreach' },
  { leadId: 'b', totalScore: 16.5, tier: 'Tier 4: Disqualified', evidenceCoverage: 80, isDisqualified: true, disqualificationReason: 'Outside target' },
  { leadId: 'c', totalScore: 99, tier: 'Tier 1: High Conviction', evidenceCoverage: 95 },
] as LeadICPScore[];
const stp = { segments: [{ id: 'top', name: 'Manual prospecting', primaryCompanyIds: ['a', 'b', 'c'] }] } as DatasetSTPAnalysis;
const contacts = [
  { lead_id: 'a', first_name: 'Asha', last_name: 'Rao', email: 'asha@example.com', lead_stage: 'Replied' },
  { lead_id: 'a', first_name: 'Amit', last_name: 'Roy', email: 'amit@example.com', lead_stage: 'New' },
  { lead_id: 'b', first_name: 'Bela', last_name: 'Sen', email: 'bela@example.com', lead_stage: 'Not Interested' },
] as ExportContact[];

test('export uses current filters and sort, omits pending scores, and excludes disqualified segment support', () => {
  const sorted = selectExportRows(leads, scores, stp, contacts, exportQuerySchema.parse({ sort: 'scoreAsc' }));
  assert.deepEqual(sorted.map(row => row.Company), ['Beta', 'Alpha', 'Gamma']);
  assert.equal(sorted[0].Segment, '');
  assert.equal(sorted[1].Segment, 'Manual prospecting');
  assert.equal(sorted[2].Tier, 'PENDING');
  const tierOne = selectExportRows(leads, scores, stp, contacts, exportQuerySchema.parse({ tier: 'tier1', search: 'alpha' }));
  assert.deepEqual(tierOne.map(row => row.Company), ['Alpha']);
  const segment = selectExportRows(leads, scores, stp, contacts, exportQuerySchema.parse({ segmentId: 'top' }));
  assert.deepEqual(segment.map(row => row.Company), ['Alpha']);
  const dashboard = selectExportRows(leads, scores, stp, contacts, exportQuerySchema.parse({ analyzedOnly: 'true', sort: 'score_desc', limit: 1 }));
  assert.deepEqual(dashboard.map(row => row.Company), ['Alpha']);
});

test('contacts export repeats company score for each uploaded contact and presets override view filters', () => {
  const rows = selectExportRows(leads, scores, stp, contacts, exportQuerySchema.parse({ preset: 'tier1_contacts', tier: 'tier4', search: 'beta' }));
  assert.deepEqual(rows.map(row => row['First name']), ['Asha', 'Amit']);
  assert.ok(rows.every(row => row.Score === 90 && row.Segment === 'Manual prospecting'));
  const analyzed = selectExportRows(leads, scores, stp, contacts, exportQuerySchema.parse({ preset: 'all_analyzed' }));
  assert.deepEqual(analyzed.map(row => row.Company), ['Alpha', 'Beta']);
  assert.equal(canExport({ id: 'owner' }, 'contacts', rows.length, PLANS[1], exportQuerySchema.parse({ preset: 'tier1_contacts' })), true);
  assert.equal(canExport({ id: 'owner' }, 'contacts', rows.length, PLANS[0], exportQuerySchema.parse({ preset: 'tier1_contacts' })), false);
});

test('CSV has UTF-8 BOM and spreadsheet-safe cells; XLSX contains the selected columns', async () => {
  const row = { Company: '=HYPERLINK("unsafe")', Domain: 'alpha.test' };
  const csv = await encodeExport([row], COMPANY_COLUMNS, 'csv');
  assert.ok(csv.toString('utf8').startsWith('\uFEFF'));
  assert.ok(csv.toString('utf8').includes("'=HYPERLINK"));
  const xlsx = await encodeExport([row], CONTACT_COLUMNS, 'xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx as never);
  assert.equal(workbook.worksheets[0].getCell('A2').value, "'=HYPERLINK(\"unsafe\")");
  assert.equal(exportFilename('My Leads.csv', 'Tier 1', new Date('2026-10-15T00:00:00Z')), 'figuredit_my_leads_tier_1_2026-10-15');
});
