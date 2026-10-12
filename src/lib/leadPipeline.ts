import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import {
  RawLeadRecord,
  NormalizedLead,
  ColumnMapping,
  IngestionError,
  DuplicateGroup,
  LeadValidationSummary,
} from '../types/lead';
import {
  UPLOAD_CONFIG,
  isAllowedExtension,
  detectPiiColumns,
} from './uploadConfig';

// ------------------------------------------------------------------------------
// ZOD VALIDATION SCHEMAS
// ------------------------------------------------------------------------------

/**
 * Zod schema verifying that at least ONE reliable company identifier exists:
 * Either company_name is present and non-empty, OR domain/website is present and non-empty.
 */
export const LeadRowValidator = z
  .object({
    companyName: z.string().trim().optional().nullable(),
    domain: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      const hasName = Boolean(data.companyName && data.companyName.trim().length > 0);
      const hasDomain = Boolean(data.domain && data.domain.trim().length > 0);
      return hasName || hasDomain;
    },
    {
      message: 'Record must include at least a Company Name OR a Website/Domain.',
      path: ['companyIdentifier'],
    }
  );

export interface ParseFileInput {
  file: File;
}

export interface ParseResult {
  fileName: string;
  fileSizeBytes: number;
  headers: string[];
  rawRows: RawLeadRecord[];
  detectedMapping: ColumnMapping;
  piiColumnsDetected: string[];
  parseErrors: string[];
}

export interface PipelineProcessResult {
  validLeads: NormalizedLead[];
  invalidRows: IngestionError[];
  duplicateGroups: DuplicateGroup[];
  summary: LeadValidationSummary;
}

// ------------------------------------------------------------------------------
// DOMAIN NORMALIZATION LOGIC
// ------------------------------------------------------------------------------

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * Normalizes a raw website/domain string.
 * Strips protocol, www prefix, path, query params, hash, and trailing slashes.
 * Returns null if invalid or missing - NEVER invents a domain.
 */
export function normalizeCompanyDomain(rawDomain: string | null | undefined): string | null {
  if (!rawDomain) return null;
  let str = String(rawDomain).trim().toLowerCase();
  if (!str) return null;

  // Remove leading protocols
  str = str.replace(/^https?:\/\//i, '');
  // Remove ftp or mailto if present
  str = str.replace(/^(ftp|mailto):\/\//i, '');
  // Remove www. or www[0-9].
  str = str.replace(/^www[0-9]?\./i, '');
  // Remove paths, query strings, hashes
  str = str.split('/')[0];
  str = str.split('?')[0];
  str = str.split('#')[0];
  // Remove port numbers e.g. :8080
  str = str.split(':')[0];
  // Remove trailing dots or slashes
  str = str.replace(/[./]+$/, '');

  // Validate basic domain structure with at least one dot
  if (!str.includes('.') || !DOMAIN_REGEX.test(str)) {
    return null;
  }

  return str;
}

// ------------------------------------------------------------------------------
// COLUMN AUTO-DETECTION
// ------------------------------------------------------------------------------

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lowerHeaders = headers.map((h) => ({ raw: h, lower: h.toLowerCase().trim() }));

  for (const h of lowerHeaders) {
    // 1. Company Name
    if (!mapping.companyName && (
      h.lower === 'company' ||
      h.lower === 'company name' ||
      h.lower === 'account' ||
      h.lower === 'account name' ||
      h.lower === 'organization' ||
      h.lower === 'name' ||
      h.lower.includes('company_name')
    )) {
      mapping.companyName = h.raw;
    }
    // 2. Domain / Website
    else if (!mapping.domain && (
      h.lower === 'domain' ||
      h.lower === 'website' ||
      h.lower === 'company domain' ||
      h.lower === 'url' ||
      h.lower === 'web' ||
      h.lower.includes('website_url') ||
      h.lower.includes('domain_name')
    )) {
      mapping.domain = h.raw;
    }
    // 3. Industry / Vertical
    else if (!mapping.industry && (
      h.lower.includes('industry') ||
      h.lower.includes('vertical') ||
      h.lower.includes('sector') ||
      h.lower.includes('category')
    )) {
      mapping.industry = h.raw;
    }
    // 4. Headcount / Company Size
    else if (!mapping.headcount && (
      h.lower.includes('headcount') ||
      h.lower.includes('employee') ||
      h.lower.includes('size') ||
      h.lower.includes('fte') ||
      h.lower.includes('staff')
    )) {
      mapping.headcount = h.raw;
    }
    // 5. Annual Revenue / ARR
    else if (!mapping.annualRevenue && (
      h.lower.includes('revenue') ||
      h.lower.includes('arr') ||
      h.lower.includes('sales') ||
      h.lower.includes('turnover')
    )) {
      mapping.annualRevenue = h.raw;
    }
    // 6. Geography / Country
    else if (!mapping.country && (
      h.lower.includes('country') ||
      h.lower.includes('geography') ||
      h.lower.includes('location') ||
      h.lower.includes('hq') ||
      h.lower.includes('region')
    )) {
      mapping.country = h.raw;
    }
    // 7. Tech Stack / Technologies
    else if (!mapping.technologies && (
      h.lower.includes('tech') ||
      h.lower.includes('stack') ||
      h.lower.includes('tools') ||
      h.lower.includes('software')
    )) {
      mapping.technologies = h.raw;
    }
    // 8. Description / Notes
    else if (!mapping.description && (
      h.lower.includes('desc') ||
      h.lower.includes('summary') ||
      h.lower.includes('about') ||
      h.lower.includes('overview') ||
      h.lower.includes('notes')
    )) {
      mapping.description = h.raw;
    }
    // 9. Business Model
    else if (!mapping.businessModel && (
      h.lower.includes('business model') ||
      h.lower.includes('model') ||
      h.lower.includes('b2b')
    )) {
      mapping.businessModel = h.raw;
    }
    // 10. Product / Service
    else if (!mapping.product && (
      h.lower.includes('product') ||
      h.lower.includes('offering') ||
      h.lower.includes('service')
    )) {
      mapping.product = h.raw;
    }
    // 11. Deal Value / Opportunity
    else if (!mapping.dealValue && (
      h.lower.includes('deal value') ||
      h.lower.includes('deal_value') ||
      h.lower.includes('acv') ||
      h.lower.includes('amount')
    )) {
      mapping.dealValue = h.raw;
    }
    // 12. Lead Stage / Status
    else if (!mapping.leadStage && (
      h.lower.includes('stage') ||
      h.lower.includes('lead_status') ||
      h.lower.includes('pipeline status')
    )) {
      mapping.leadStage = h.raw;
    }
    // 13. Customer Pain
    else if (!mapping.customerPain && (
      h.lower.includes('pain') ||
      h.lower.includes('problem') ||
      h.lower.includes('challenge') ||
      h.lower.includes('need')
    )) {
      mapping.customerPain = h.raw;
    }
    // 14. Reason Won / Lost
    else if (!mapping.reasonWonLost && (
      h.lower.includes('won') ||
      h.lower.includes('lost') ||
      h.lower.includes('churn')
    )) {
      mapping.reasonWonLost = h.raw;
    }
  }

  // Sensible fallbacks if headers weren't named identically
  if (!mapping.companyName && headers.length > 0) {
    mapping.companyName = headers[0];
  }
  if (!mapping.domain && headers.length > 1) {
    // If second column has domain-like name
    const secondLower = headers[1].toLowerCase();
    if (secondLower.includes('web') || secondLower.includes('url') || secondLower.includes('site') || secondLower.includes('domain')) {
      mapping.domain = headers[1];
    }
  }

  return mapping;
}

// ------------------------------------------------------------------------------
// FILE PARSING ENGINE (CSV & XLSX)
// ------------------------------------------------------------------------------

/**
 * Validates file meta (size, extension) and parses CSV, TSV, or XLSX.
 */
export async function parseLeadFile(file: File): Promise<ParseResult> {
  const fileName = file.name;
  const fileSizeBytes = file.size;

  // 1. Extension Validation
  if (!isAllowedExtension(fileName)) {
    throw new Error(
      `Unsupported file extension for "${fileName}". Please provide a .csv or .xlsx spreadsheet.`
    );
  }

  // 2. File Size Validation (5MB limit)
  if (fileSizeBytes > UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of ${UPLOAD_CONFIG.MAX_FILE_SIZE_LABEL}.`
    );
  }

  // 3. Empty File Validation
  if (fileSizeBytes === 0) {
    throw new Error(`The file "${fileName}" is empty (0 bytes).`);
  }

  const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');

  if (isExcel) {
    return parseExcelFile(file);
  } else {
    return parseCsvFile(file);
  }
}

/**
 * Parse Excel .xlsx or .xls file using sheetjs
 */
async function parseExcelFile(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel workbook contains no sheets.');
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      throw new Error(`First sheet "${firstSheetName}" is empty or unreadable.`);
    }

    // Convert sheet to json 2D array of rows
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      blankrows: false,
    });

    if (!jsonData || jsonData.length === 0) {
      throw new Error(`The Excel spreadsheet "${file.name}" contains no data rows.`);
    }

    // First row is headers
    const rawHeaderRow = jsonData[0] || [];
    const headers = rawHeaderRow.map((h, i) => (h !== undefined && h !== null ? String(h).trim() : `Column_${i + 1}`));

    if (headers.length === 0) {
      throw new Error('No column headers detected in the Excel sheet.');
    }

    // Subsequent rows are data
    const rawRows: RawLeadRecord[] = [];
    for (let r = 1; r < jsonData.length; r++) {
      const rowArr = jsonData[r] || [];
      // Skip totally blank rows
      if (rowArr.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')) {
        continue;
      }

      const rowObj: RawLeadRecord = {};
      headers.forEach((hdr, idx) => {
        const val = rowArr[idx];
        rowObj[hdr] = val !== undefined && val !== null ? String(val).trim() : '';
      });
      rawRows.push(rowObj);
    }

    if (rawRows.length === 0) {
      throw new Error(`No lead records found under the headers in "${file.name}".`);
    }

    const detectedMapping = autoDetectColumns(headers);
    const piiColumnsDetected = detectPiiColumns(headers);

    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      headers,
      rawRows,
      detectedMapping,
      piiColumnsDetected,
      parseErrors: [],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to parse Excel file.';
    throw new Error(`Excel Parse Error: ${msg}`);
  }
}

/**
 * Parse CSV / TSV / TXT file using PapaParse with automatic delimiter detection
 */
async function parseCsvFile(file: File): Promise<ParseResult> {
  const content = await file.text();

  if (!content.trim()) {
    throw new Error(`The file "${file.name}" is completely blank.`);
  }

  return new Promise((resolve, reject) => {
    Papa.parse<RawLeadRecord>(content, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      delimitersToGuess: [',', '\t', ';', '|'],
      complete: (results) => {
        const headers = (results.meta.fields || []).map((h) => h.trim());

        if (headers.length === 0) {
          reject(new Error(`No column headers detected in "${file.name}". Please ensure the first row contains column names.`));
          return;
        }

        const rawRows = results.data;
        if (!rawRows || rawRows.length === 0) {
          reject(new Error(`No lead rows detected in "${file.name}".`));
          return;
        }

        const detectedMapping = autoDetectColumns(headers);
        const piiColumnsDetected = detectPiiColumns(headers);
        const parseErrors = results.errors.map((e) => `Line ${e.row}: ${e.message}`);

        resolve({
          fileName: file.name,
          fileSizeBytes: file.size,
          headers,
          rawRows,
          detectedMapping,
          piiColumnsDetected,
          parseErrors,
        });
      },
      error: (err: Error) => {
        reject(new Error(`CSV Parse Error: ${err.message}`));
      },
    });
  });
}

// ------------------------------------------------------------------------------
// LEAD NORMALIZATION & QUALITY PIPELINE
// ------------------------------------------------------------------------------

/**
 * Processes raw rows using the finalized column mapping, performs validation,
 * domain normalization, duplicate detection, and quotas (up to 500 rows, 100 AI limit).
 */
export function processLeadPipeline(
  rawRows: RawLeadRecord[],
  mapping: ColumnMapping,
  options: {
    maxTotalRows?: number;
    maxAiEnrichedDemo?: number;
    skipDuplicates?: boolean;
    piiColumnsToScrub?: string[];
  } = {}
): PipelineProcessResult {
  const maxTotalRows = options.maxTotalRows ?? UPLOAD_CONFIG.MAX_ROWS_PER_DATASET;
  const maxAiEnrichedDemo = options.maxAiEnrichedDemo ?? UPLOAD_CONFIG.MAX_AI_ENRICHED_ROWS_DEMO;
  const piiColumns = options.piiColumnsToScrub ?? [];

  const validLeads: NormalizedLead[] = [];
  const invalidRows: IngestionError[] = [];

  // Data structures for duplicate tracking
  const domainLeadMap = new Map<string, NormalizedLead[]>();
  const nameLeadMap = new Map<string, NormalizedLead[]>();

  // Cap at maxTotalRows (e.g. 500)
  const rowsToProcess = rawRows.slice(0, maxTotalRows);

  rowsToProcess.forEach((raw, index) => {
    const rowNum = index + 1;

    // Scrub PII from raw audit object if configured
    const sanitizedRaw: RawLeadRecord = { ...raw };
    piiColumns.forEach((col) => {
      if (sanitizedRaw[col] !== undefined) {
        sanitizedRaw[col] = '[REDACTED_PII]';
      }
    });

    // Extract identifiers according to mapping
    const rawCompanyName = mapping.companyName && raw[mapping.companyName] !== undefined
      ? String(raw[mapping.companyName]).trim()
      : '';
    const rawWebsite = mapping.domain && raw[mapping.domain] !== undefined
      ? String(raw[mapping.domain]).trim()
      : '';

    // ZOD Schema Validation: requires at least name OR domain
    const validationCheck = LeadRowValidator.safeParse({
      companyName: rawCompanyName,
      domain: rawWebsite,
    });

    if (!validationCheck.success) {
      invalidRows.push({
        rowNumber: rowNum,
        companyName: rawCompanyName || undefined,
        domain: rawWebsite || undefined,
        reason: 'Missing required identifier: row contains neither a valid Company Name nor a Website/Domain.',
        raw: sanitizedRaw,
      });
      return;
    }

    // Normalize domain
    const normalizedDomain = normalizeCompanyDomain(rawWebsite);
    const hasValidDomain = Boolean(normalizedDomain);

    // Final company name: if missing but domain present, derive friendly display name from domain
    let companyName = rawCompanyName;
    if (!companyName && normalizedDomain) {
      // Derive friendly name e.g. "stripe.com" -> "Stripe"
      const domainParts = normalizedDomain.split('.')[0];
      companyName = domainParts.charAt(0).toUpperCase() + domainParts.slice(1);
    } else if (!companyName) {
      companyName = `Account ${rowNum}`;
    }

    // Optional Firmographics
    const industry = mapping.industry && raw[mapping.industry]
      ? String(raw[mapping.industry]).trim()
      : 'General Enterprise / Tech';

    // Parse headcount
    let headcount: number | null = null;
    if (mapping.headcount && raw[mapping.headcount] !== undefined) {
      const cleaned = String(raw[mapping.headcount]).replace(/[^0-9]/g, '');
      if (cleaned) headcount = parseInt(cleaned, 10);
    }

    // Revenue
    const annualRevenue = mapping.annualRevenue && raw[mapping.annualRevenue]
      ? String(raw[mapping.annualRevenue]).trim()
      : null;

    // Description
    const description = mapping.description && raw[mapping.description]
      ? String(raw[mapping.description]).trim()
      : `${companyName} operating in ${industry}.`;

    // Country / Geography
    const country = mapping.country && raw[mapping.country]
      ? String(raw[mapping.country]).trim()
      : 'Global';

    // Technologies
    let technologies: string[] = [];
    if (mapping.technologies && raw[mapping.technologies]) {
      technologies = String(raw[mapping.technologies])
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // Optional Commercials
    const companyType = mapping.companyType && raw[mapping.companyType] ? String(raw[mapping.companyType]).trim() : undefined;
    const businessModel = mapping.businessModel && raw[mapping.businessModel] ? String(raw[mapping.businessModel]).trim() : undefined;
    const productRaw = mapping.product && raw[mapping.product] ? String(raw[mapping.product]).trim() : undefined;
    const leadStage = mapping.leadStage && raw[mapping.leadStage] ? String(raw[mapping.leadStage]).trim() : 'new';
    
    let dealValue: number | null = null;
    if (mapping.dealValue && raw[mapping.dealValue]) {
      const numVal = parseFloat(String(raw[mapping.dealValue]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(numVal)) dealValue = numVal;
    }

    const currency = mapping.currency && raw[mapping.currency] ? String(raw[mapping.currency]).trim() : 'USD';

    let retentionMonths: number | null = null;
    if (mapping.retentionMonths && raw[mapping.retentionMonths]) {
      const numRet = parseInt(String(raw[mapping.retentionMonths]).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(numRet)) retentionMonths = numRet;
    }

    const customerPain = mapping.customerPain && raw[mapping.customerPain] ? String(raw[mapping.customerPain]).trim() : undefined;
    const reasonWonLost = mapping.reasonWonLost && raw[mapping.reasonWonLost] ? String(raw[mapping.reasonWonLost]).trim() : undefined;

    // AI Enrichment Tier Assignment:
    // Only the first `maxAiEnrichedDemo` valid rows get AI enrichment in free tier
    const validIndex = validLeads.length;
    const isAiEnriched = validIndex < maxAiEnrichedDemo;
    let enrichmentTier: NormalizedLead['enrichmentTier'] = 'stored_only';

    if (isAiEnriched) {
      enrichmentTier = hasValidDomain ? 'full' : 'limited';
    }

    const lead: NormalizedLead = {
      id: `lead-${Date.now()}-${validIndex}`,
      companyName,
      domain: normalizedDomain, // null if no valid domain - NEVER INVENT A DOMAIN
      website: rawWebsite || null,
      hasValidDomain,
      industry,
      headcount,
      annualRevenue,
      description,
      country,
      technologies,
      companyType,
      businessModel,
      productRaw,
      leadStage,
      dealValue,
      currency,
      retentionMonths,
      customerPain,
      reasonWonLost,
      isAiEnriched,
      enrichmentTier,
      isClean: true,
      isDuplicate: false,
      validationWarnings: [],
      rawRow: sanitizedRaw,
      ingestedAt: new Date().toISOString(),
    };

    if (!hasValidDomain) {
      lead.validationWarnings?.push('No valid company domain provided. AI enrichment capability will be limited.');
    }

    // Duplicate tracking
    if (normalizedDomain) {
      const existing = domainLeadMap.get(normalizedDomain) || [];
      existing.push(lead);
      domainLeadMap.set(normalizedDomain, existing);
    }

    const normalizedNameKey = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedNameKey) {
      const existing = nameLeadMap.get(normalizedNameKey) || [];
      existing.push(lead);
      nameLeadMap.set(normalizedNameKey, existing);
    }

    validLeads.push(lead);
  });

  // ----------------------------------------------------------------------------
  // DUPLICATE GROUP IDENTIFICATION
  // ----------------------------------------------------------------------------
  const duplicateGroups: DuplicateGroup[] = [];

  // 1. Check exact normalized domain collisions
  domainLeadMap.forEach((matchedLeads, domainKey) => {
    if (matchedLeads.length > 1) {
      duplicateGroups.push({
        key: `dup-domain-${domainKey}`,
        type: 'exact_domain',
        normalizedDomain: domainKey,
        leads: matchedLeads,
      });

      // Mark individual leads as duplicate
      matchedLeads.forEach((l, idx) => {
        if (idx > 0) {
          l.isDuplicate = true;
          l.duplicateReason = `Exact domain match with ${matchedLeads[0].companyName} (${domainKey})`;
          l.duplicateGroupKey = `dup-domain-${domainKey}`;
        }
      });
    }
  });

  // 2. Check exact company name collisions where domain is absent or different
  nameLeadMap.forEach((matchedLeads, nameKey) => {
    if (matchedLeads.length > 1) {
      // Check if not already caught by exact domain
      const domains = new Set(matchedLeads.map((l) => l.domain).filter(Boolean));
      if (domains.size > 1 || domains.size === 0) {
        duplicateGroups.push({
          key: `dup-name-${nameKey}`,
          type: domains.size > 1 ? 'uncertain' : 'exact_name',
          companyName: matchedLeads[0].companyName,
          leads: matchedLeads,
        });

        matchedLeads.forEach((l, idx) => {
          if (idx > 0 && !l.isDuplicate) {
            l.isDuplicate = true;
            l.duplicateReason = domains.size > 1
              ? `Uncertain duplicate: Same name (${l.companyName}) but different domains.`
              : `Exact name collision (${l.companyName}).`;
            l.duplicateGroupKey = `dup-name-${nameKey}`;
          }
        });
      }
    }
  });

  // Filter out duplicates if skipDuplicates is true
  let finalLeads = validLeads;
  if (options.skipDuplicates) {
    finalLeads = validLeads.filter((l) => !l.isDuplicate);
  }

  const duplicateRowsCount = validLeads.filter((l) => l.isDuplicate).length;
  const aiEligibleCount = finalLeads.filter((l) => l.isAiEnriched).length;
  const storedOnlyCount = finalLeads.filter((l) => !l.isAiEnriched).length;

  return {
    validLeads: finalLeads,
    invalidRows,
    duplicateGroups,
    summary: {
      totalRowsParsed: rawRows.length,
      validRowsCount: finalLeads.length,
      invalidRowsCount: invalidRows.length,
      duplicateRowsCount,
      aiEligibleCount,
      storedOnlyCount,
      hasPiiAlert: piiColumns.length > 0,
      piiColumnsDetected: piiColumns,
    },
  };
}

// ------------------------------------------------------------------------------
// DOWNLOADABLE SAMPLE TEMPLATE GENERATOR
// ------------------------------------------------------------------------------

export function generateSampleCsvContent(): string {
  const headers = [
    'Company Name',
    'Domain',
    'Industry',
    'Headcount',
    'Annual Revenue',
    'Country',
    'Technologies',
    'Business Model',
    'Lead Stage',
    'Deal Value',
    'Customer Pain',
  ];

  const sampleRows = [
    [
      'AeroSync Cloud',
      'aerosync.io',
      'Cloud Infrastructure',
      '420',
      '$35,000,000',
      'United States',
      'Kubernetes, Snowflake, AWS, Datadog',
      'B2B SaaS',
      'qualified',
      '65000',
      'Multi-cloud cost runaway and unpredictable egress fees',
    ],
    [
      'FinPulse Systems',
      'finpulse.com',
      'FinTech',
      '850',
      '$72,000,000',
      'United Kingdom',
      'Postgres, Python, Docker, dbt',
      'Enterprise Software',
      'opportunity',
      '120000',
      'Struggling with real-time risk assessment and regulatory latency',
    ],
    [
      'NovaBio Logistics',
      'novabio.health',
      'Healthcare / BioTech',
      '210',
      '$18,000,000',
      'Germany',
      'AWS, Snowflake, Salesforce',
      'B2B SaaS',
      'new',
      '45000',
      'Cold-chain sensor telemetry fragmentation',
    ],
    [
      'MetricForge Analytics',
      'metricforge.co',
      'Developer Tools',
      '95',
      '$8,500,000',
      'Canada',
      'ClickHouse, Go, React, GCP',
      'B2B SaaS',
      'contacted',
      '30000',
      'Slow developer onboarding and telemetry ingestion bottleneck',
    ],
    [
      'Apex Industrial Supply',
      'apexsupply.com',
      'Manufacturing',
      '1400',
      '$110,000,000',
      'United States',
      'SAP, Oracle, Excel',
      'Professional Services',
      'disqualified',
      '80000',
      'Legacy ERP lock-in with manual inventory reconciliations',
    ],
  ];

  const csvLines = [
    headers.join(','),
    ...sampleRows.map((row) =>
      row
        .map((val) => {
          if (val.includes(',') || val.includes('"')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(',')
    ),
  ];

  return csvLines.join('\n');
}
