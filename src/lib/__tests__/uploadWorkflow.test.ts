import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseLeadFile, processLeadPipeline } from '../leadPipeline';
import { UPLOAD_CONFIG } from '../uploadConfig';

function csvFile(contents: string, name = 'synthetic-leads.csv'): File {
  return new File([contents], name, { type: 'text/csv' });
}

test('parses a valid CSV and detects common headers', async () => {
  const parsed = await parseLeadFile(csvFile('Company,Website,Employees\nAcme Labs,HTTPS://WWW.ACME.TEST/about,0'));
  assert.equal(parsed.rawRows.length, 1);
  assert.equal(parsed.detectedMapping.companyName, 'Company');
  assert.equal(parsed.detectedMapping.domain, 'Website');
});

test('parses a valid XLSX without evaluating formula cells', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Leads');
  sheet.addRow(['Company Name', 'Domain', 'Employees']);
  sheet.addRow(['Northstar Synthetic', 'northstar.test', 42]);
  sheet.addRow(['Formula Synthetic', 'formula.test', { formula: '1+1', result: 2 }]);
  const bytes = await workbook.xlsx.writeBuffer();
  const file = new File([bytes], 'synthetic-leads.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseLeadFile(file);
  assert.equal(parsed.rawRows.length, 2);
  assert.equal(parsed.rawRows[0]['Company Name'], 'Northstar Synthetic');
});

test('marks a row without either company identifier invalid', () => {
  const result = processLeadPipeline([{ Company: '  ', Domain: '' }], { companyName: 'Company', domain: 'Domain' });
  assert.equal(result.validLeads.length, 0);
  assert.equal(result.invalidRows.length, 1);
});

test('accepts missing optional fields and preserves blank values', () => {
  const result = processLeadPipeline([{ Company: 'Optional Fields Synthetic' }], { companyName: 'Company' });
  assert.equal(result.validLeads.length, 1);
  assert.equal(result.validLeads[0].headcount, null);
  assert.equal(result.validLeads[0].annualRevenue, null);
});

test('normalizes and skips duplicate domains without merging similar names', () => {
  const rows = [
    { Company: 'Acme One', Domain: 'https://WWW.ACME.TEST/path' },
    { Company: 'Acme Two', Domain: 'acme.test' },
    { Company: 'Acme One Holdings', Domain: 'acme-holdings.test' },
  ];
  const result = processLeadPipeline(rows, { companyName: 'Company', domain: 'Domain' }, { skipDuplicates: true });
  assert.equal(result.summary.duplicateRowsCount, 1);
  assert.deepEqual(result.validLeads.map((lead) => lead.domain), ['acme.test', 'acme-holdings.test']);
});

test('invalid numeric values become blank while zero stays zero', () => {
  const rows = [
    { Company: 'Bad Number Synthetic', Employees: 'many', Value: 'unknown' },
    { Company: 'Zero Synthetic', Employees: '0', Value: '0' },
  ];
  const result = processLeadPipeline(rows, { companyName: 'Company', headcount: 'Employees', dealValue: 'Value' });
  assert.equal(result.validLeads[0].headcount, null);
  assert.equal(result.validLeads[0].dealValue, null);
  assert.ok(result.validLeads[0].validationWarnings?.length);
  assert.equal(result.validLeads[1].headcount, 0);
  assert.equal(result.validLeads[1].dealValue, 0);
});

test('rejects invalid and oversized files', async () => {
  await assert.rejects(() => parseLeadFile(csvFile('Company\nAcme', 'leads.txt')), /Unsupported file extension/);
  const oversized = new File([new Uint8Array(UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES + 1)], 'large.csv', { type: 'text/csv' });
  await assert.rejects(() => parseLeadFile(oversized), /exceeds the maximum/);
});

test('stores at most 500 valid records and reports every excess row', () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    Company: `Synthetic Company ${index + 1}`,
    Domain: `synthetic-${index + 1}.test`,
  }));
  const result = processLeadPipeline(rows, { companyName: 'Company', domain: 'Domain' });
  assert.equal(result.validLeads.length, 500);
  assert.equal(result.invalidRows.length, 1);
  assert.match(result.invalidRows[0].reason, /500 valid records/);
  assert.equal(result.summary.aiEligibleCount, 100);
});
