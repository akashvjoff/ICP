import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseLeadFile, processLeadPipeline, parseEmployeeRange } from '../leadPipeline';
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

test('parses employee ranges and open-ended counts', () => {
  assert.deepEqual(parseEmployeeRange('1-10'), { min: 1, max: 10, midpoint: 6 });
  assert.deepEqual(parseEmployeeRange('201-500'), { min: 201, max: 500, midpoint: 351 });
  assert.deepEqual(parseEmployeeRange('1001-5000'), { min: 1001, max: 5000, midpoint: 3001 });
  assert.deepEqual(parseEmployeeRange('10,000+'), { min: 10000, max: null, midpoint: 10000 });
  assert.deepEqual(parseEmployeeRange('1k-5k'), { min: 1000, max: 5000, midpoint: 3000 });
});

test('merges contact rows by domain and selects the most common company values', async () => {
  const parsed = await parseLeadFile(csvFile('First Name,Last Name,Job Title,Seniority,Company,Website,Industry,Employees,Email,Email Status,Phone,City,Country,LinkedIn URL,Lead Stage\nAna,Lee,VP,VP,Acme,acme.test,SaaS,201-500,ana@acme.test,Verified,123,Delhi,India,https://linkedin.com/in/ana,Contacted\nBen,Ray,Director,Director,Acme,https://www.acme.test,SaaS,201-500,ben@acme.test,Verified,456,Mumbai,India,https://linkedin.com/in/ben,Replied\nCal,Kim,Manager,Manager,Acme,acme.test,Other,1-10,cal@acme.test,Verified,789,Delhi,India,https://linkedin.com/in/cal,New'));
  assert.equal(parsed.detectedMapping.jobTitle, 'Job Title');
  assert.equal(parsed.detectedMapping.seniority, 'Seniority');
  assert.equal(parsed.detectedMapping.leadStage, 'Lead Stage');
  assert.equal(parsed.detectedMapping.city, 'City');
  assert.equal(parsed.detectedMapping.country, 'Country');
  const result = processLeadPipeline(parsed.rawRows, parsed.detectedMapping, { skipDuplicates: true });
  assert.equal(result.validLeads.length, 1);
  assert.equal(result.validLeads[0].headcount, 351);
  assert.equal(result.validLeads[0].industry, 'SaaS');
  assert.equal(result.validLeads[0].contacts?.length, 3);
  assert.equal(result.validLeads[0].contacts?.[1].leadStage, 'Replied');
  assert.equal(result.summary.conflictCount, 2);
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
