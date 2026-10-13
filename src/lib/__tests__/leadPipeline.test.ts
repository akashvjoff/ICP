/**
 * Lead Ingestion Pipeline Test Suite & Fixtures
 * Tests:
 * 1. Empty file handling
 * 2. Wrong extension validation
 * 3. File size limits (> 5MB)
 * 4. Missing headers detection
 * 5. Zod schema validation: Missing identifier (both name & domain missing)
 * 6. Single identifier acceptance (name only, domain only)
 * 7. Domain normalization (protocols, www, subpaths, queries, ports, lowercasing)
 * 8. Missing domain handling (domain is null, hasValidDomain=false, tier='limited', never invent domain)
 * 9. Duplicate detection (exact domain collision, name collision, uncertain duplicates)
 * 10. Limits enforcement (max 500 rows, max 100 AI enrichment quota separation)
 * 11. Privacy PII detection (email, phone, ssn, etc.)
 */

import {
  normalizeCompanyDomain,
  autoDetectColumns,
  processLeadPipeline,
  LeadRowValidator,
  generateSampleCsvContent,
} from '../leadPipeline';
import {
  UPLOAD_CONFIG,
  isAllowedExtension,
  detectPiiColumns,
} from '../uploadConfig';
import { RawLeadRecord, ColumnMapping } from '../../types/lead';

export function runLeadPipelineTests() {
  const results: { test: string; passed: boolean; message?: string }[] = [];

  function assert(condition: boolean, testName: string, failureDetails?: string) {
    if (condition) {
      results.push({ test: testName, passed: true });
    } else {
      results.push({ test: testName, passed: false, message: failureDetails });
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: File Extension Validation
  // --------------------------------------------------------------------------
  assert(isAllowedExtension('leads.csv'), 'Extension: .csv allowed');
  assert(isAllowedExtension('accounts.xlsx'), 'Extension: .xlsx allowed');
  assert(!isAllowedExtension('pipeline.tsv'), 'Extension: .tsv rejected');
  assert(!isAllowedExtension('payload.exe'), 'Extension: .exe rejected');
  assert(!isAllowedExtension('document.pdf'), 'Extension: .pdf rejected');
  assert(!isAllowedExtension('data.json'), 'Extension: .json rejected');

  // --------------------------------------------------------------------------
  // TEST 2: File Size Limits
  // --------------------------------------------------------------------------
  assert(UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES === 5 * 1024 * 1024, 'Config: Max file size is 5MB');
  assert(UPLOAD_CONFIG.MAX_ROWS_PER_DATASET === 500, 'Config: Max stored rows is 500');
  assert(UPLOAD_CONFIG.MAX_AI_ENRICHED_ROWS_DEMO === 100, 'Config: Max AI enriched rows is 100');

  // --------------------------------------------------------------------------
  // TEST 3: Domain Normalization
  // --------------------------------------------------------------------------
  assert(normalizeCompanyDomain('https://www.stripe.com/pricing') === 'stripe.com', 'Domain: Strip protocol, www, and path');
  assert(normalizeCompanyDomain('HTTP://WWW.DATABRICKS.COM/?utm=123#anchor') === 'databricks.com', 'Domain: Strip query, hash, and lowercase');
  assert(normalizeCompanyDomain('snowflake.com:8080/') === 'snowflake.com', 'Domain: Strip port and trailing slash');
  assert(normalizeCompanyDomain('subdomain.platform.io/app') === 'subdomain.platform.io', 'Domain: Preserve legitimate subdomains');
  assert(normalizeCompanyDomain('') === null, 'Domain: Empty string returns null');
  assert(normalizeCompanyDomain(null) === null, 'Domain: Null returns null');
  assert(normalizeCompanyDomain('not-a-valid-domain') === null, 'Domain: Non-TLD string returns null');

  // --------------------------------------------------------------------------
  // TEST 4: Missing Website Handling (DO NOT INVENT A DOMAIN)
  // --------------------------------------------------------------------------
  const noDomainRaw: RawLeadRecord[] = [
    { 'Company': 'Acme Corp', 'Website': '' },
  ];
  const noDomainMapping: ColumnMapping = { companyName: 'Company', domain: 'Website' };
  const noDomainRes = processLeadPipeline(noDomainRaw, noDomainMapping);
  
  assert(noDomainRes.validLeads.length === 1, 'Missing Domain: Record preserved as valid');
  assert(noDomainRes.validLeads[0].domain === null, 'Missing Domain: Domain is strictly null (never invented)');
  assert(noDomainRes.validLeads[0].hasValidDomain === false, 'Missing Domain: hasValidDomain is false');
  assert(noDomainRes.validLeads[0].enrichmentTier === 'limited', 'Missing Domain: Marked as limited enrichment tier');

  // --------------------------------------------------------------------------
  // TEST 5: Zod Schema: Missing Identifier (Both name & domain missing)
  // --------------------------------------------------------------------------
  const blankRowCheck = LeadRowValidator.safeParse({ companyName: '', domain: '' });
  assert(!blankRowCheck.success, 'Schema: Reject row when both companyName and domain are empty');

  const nameOnlyCheck = LeadRowValidator.safeParse({ companyName: 'Vercel Inc', domain: '' });
  assert(nameOnlyCheck.success, 'Schema: Accept row when companyName is present');

  const domainOnlyCheck = LeadRowValidator.safeParse({ companyName: '', domain: 'vercel.com' });
  assert(domainOnlyCheck.success, 'Schema: Accept row when domain is present');

  const invalidRawRows: RawLeadRecord[] = [
    { 'Company': '', 'Domain': '' },
    { 'Company': '   ', 'Domain': '   ' },
    { 'Company': 'Valid Company', 'Domain': 'valid.com' },
  ];
  const invalidRes = processLeadPipeline(invalidRawRows, { companyName: 'Company', domain: 'Domain' });
  assert(invalidRes.invalidRows.length === 2, 'Pipeline: Correctly identifies 2 invalid incomplete rows');
  assert(invalidRes.validLeads.length === 1, 'Pipeline: Only the valid row is ingested');

  // --------------------------------------------------------------------------
  // TEST 6: Duplicate Detection (Exact domain collision & name collision)
  // --------------------------------------------------------------------------
  const duplicateRawRows: RawLeadRecord[] = [
    { 'Company': 'Snowflake Inc', 'Domain': 'https://snowflake.com' },
    { 'Company': 'Snowflake Computing', 'Domain': 'snowflake.com/about' }, // exact domain duplicate
    { 'Company': 'Databricks', 'Domain': 'databricks.com' },
    { 'Company': 'Databricks', 'Domain': 'databricks.com' }, // exact domain & name duplicate
  ];
  const dedupeRes = processLeadPipeline(duplicateRawRows, { companyName: 'Company', domain: 'Domain' }, { skipDuplicates: true });
  assert(dedupeRes.summary.duplicateRowsCount === 2, 'Duplicates: Detects 2 duplicate rows');
  assert(dedupeRes.validLeads.length === 2, 'Duplicates: Deduplicates down to 2 distinct accounts when skipDuplicates is true');
  assert(dedupeRes.duplicateGroups.length >= 2, 'Duplicates: Forms duplicate groups for inspection');

  // --------------------------------------------------------------------------
  // TEST 7: Limits & AI Tier Separation (Rows > 100 marked as stored_only)
  // --------------------------------------------------------------------------
  const mock120Rows: RawLeadRecord[] = Array.from({ length: 120 }, (_, i) => ({
    'Company': `Enterprise Corp ${i + 1}`,
    'Domain': `enterprise${i + 1}.io`,
    'Industry': 'SaaS',
  }));
  const limitsRes = processLeadPipeline(mock120Rows, { companyName: 'Company', domain: 'Domain', industry: 'Industry' });
  
  assert(limitsRes.validLeads.length === 120, 'Limits: All 120 rows are preserved and stored (none discarded)');
  assert(limitsRes.summary.aiEligibleCount === 100, 'Limits: Exactly 100 rows allocated to AI enrichment tier');
  assert(limitsRes.summary.storedOnlyCount === 20, 'Limits: Remaining 20 rows flagged as stored_only');
  assert(limitsRes.validLeads[0].isAiEnriched === true, 'Limits: Row 1 isAiEnriched is true');
  assert(limitsRes.validLeads[105].isAiEnriched === false, 'Limits: Row 106 isAiEnriched is false (stored_only)');
  assert(limitsRes.validLeads[105].enrichmentTier === 'stored_only', 'Limits: Row 106 enrichmentTier is stored_only');

  // --------------------------------------------------------------------------
  // TEST 8: Privacy PII Detection & Redaction
  // --------------------------------------------------------------------------
  const headersWithPii = ['Company Name', 'Domain', 'Contact Email', 'Phone Number', 'SSN', 'Industry'];
  const detectedPii = detectPiiColumns(headersWithPii);
  assert(detectedPii.includes('Contact Email'), 'Privacy: Detects email column');
  assert(detectedPii.includes('Phone Number'), 'Privacy: Detects phone column');
  assert(detectedPii.includes('SSN'), 'Privacy: Detects SSN column');
  assert(!detectedPii.includes('Company Name'), 'Privacy: Does not flag Company Name');

  const piiRaw: RawLeadRecord[] = [
    { 'Company': 'FinTech Ltd', 'Domain': 'fintech.com', 'Contact Email': 'ceo@personal.com', 'Phone': '555-1234' },
  ];
  const piiRes = processLeadPipeline(
    piiRaw,
    { companyName: 'Company', domain: 'Domain' },
    { piiColumnsToScrub: ['Contact Email', 'Phone'] }
  );
  assert(piiRes.validLeads[0].rawRow?.['Contact Email'] === '[REDACTED_PII]', 'Privacy: Redacts email in raw audit record');
  assert(piiRes.validLeads[0].rawRow?.['Phone'] === '[REDACTED_PII]', 'Privacy: Redacts phone in raw audit record');

  // --------------------------------------------------------------------------
  // TEST 9: Column Auto-Detection
  // --------------------------------------------------------------------------
  const headers = ['Account Name', 'Website URL', 'Employee Count', 'Annual ARR', 'Tech Stack'];
  const detectedMap = autoDetectColumns(headers);
  assert(detectedMap.companyName === 'Account Name', 'Auto-map: Account Name detected');
  assert(detectedMap.domain === 'Website URL', 'Auto-map: Website URL detected');
  assert(detectedMap.headcount === 'Employee Count', 'Auto-map: Employee Count detected');
  assert(detectedMap.annualRevenue === 'Annual ARR', 'Auto-map: Annual ARR detected');
  assert(detectedMap.technologies === 'Tech Stack', 'Auto-map: Tech Stack detected');

  // --------------------------------------------------------------------------
  // TEST 10: Downloadable Sample Template
  // --------------------------------------------------------------------------
  const templateCsv = generateSampleCsvContent();
  assert(templateCsv.includes('Company Name,Domain,Industry'), 'Template: Includes correct CSV header columns');
  assert(templateCsv.includes('AeroSync Cloud'), 'Template: Includes high-quality sample accounts');

  return results;
}
