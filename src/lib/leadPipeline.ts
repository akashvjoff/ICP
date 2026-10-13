import Papa from 'papaparse';
import type { Cell } from 'exceljs';
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

const OPTIONAL_MAPPING_FIELDS: Array<keyof ColumnMapping> = [
  'industry',
  'companyType',
  'headcount',
  'country',
  'product',
  'businessModel',
  'leadStage',
  'dealValue',
  'currency',
  'annualRevenue',
  'retentionMonths',
  'customerPain',
  'reasonWonLost',
  'description',
  'technologies',
];

const ALLOWED_LEAD_STATUSES = new Set([
  'new',
  'qualified',
  'disqualified',
  'contacted',
  'opportunity',
  'won',
  'lost',
]);

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function sanitizeUntrustedCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (/^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-\d+(?:\.\d+)?$/.test(text))) {
    return `'${text}`;
  }
  return text;
}

function parseOptionalNumber(
  value: unknown,
  fieldLabel: string,
  warnings: string[],
  integer = false
): number | null {
  if (!hasValue(value)) return null;
  const text = String(value).trim();
  const normalized = text.replace(/[$,£€₹\s]/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    warnings.push(`${fieldLabel} "${text}" is not a valid number and was stored as blank.`);
    return null;
  }
  const parsed = integer ? Number.parseInt(normalized, 10) : Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    warnings.push(`${fieldLabel} "${text}" must be zero or greater and was stored as blank.`);
    return null;
  }
  return parsed;
}

export function validateUniqueMapping(mapping: ColumnMapping): string[] {
  const used = new Map<string, string>();
  const errors: string[] = [];
  Object.entries(mapping).forEach(([target, source]) => {
    if (!source) return;
    const existing = used.get(source);
    if (existing) {
      errors.push(`Column "${source}" cannot map to both ${existing} and ${target}.`);
    } else {
      used.set(source, target);
    }
  });
  return errors;
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
    // 9. Company Type
    else if (!mapping.companyType && (
      h.lower === 'company type' ||
      h.lower === 'organization type' ||
      h.lower === 'account type'
    )) {
      mapping.companyType = h.raw;
    }
    // 10. Business Model
    else if (!mapping.businessModel && (
      h.lower.includes('business model') ||
      h.lower.includes('model') ||
      h.lower.includes('b2b')
    )) {
      mapping.businessModel = h.raw;
    }
    // 11. Product / Service
    else if (!mapping.product && (
      h.lower.includes('product') ||
      h.lower.includes('offering') ||
      h.lower.includes('service')
    )) {
      mapping.product = h.raw;
    }
    // 12. Deal Value / Opportunity
    else if (!mapping.dealValue && (
      h.lower.includes('deal value') ||
      h.lower.includes('deal_value') ||
      h.lower.includes('acv') ||
      h.lower.includes('amount')
    )) {
      mapping.dealValue = h.raw;
    }
    // 13. Currency
    else if (!mapping.currency && (
      h.lower === 'currency' ||
      h.lower === 'currency code' ||
      h.lower === 'iso currency'
    )) {
      mapping.currency = h.raw;
    }
    // 14. Retention
    else if (!mapping.retentionMonths && (
      h.lower.includes('retention') ||
      h.lower.includes('months retained') ||
      h.lower.includes('tenure')
    )) {
      mapping.retentionMonths = h.raw;
    }
    // 15. Lead Stage / Status
    else if (!mapping.leadStage && (
      h.lower.includes('stage') ||
      h.lower.includes('lead_status') ||
      h.lower.includes('pipeline status')
    )) {
      mapping.leadStage = h.raw;
    }
    // 16. Customer Pain
    else if (!mapping.customerPain && (
      h.lower.includes('pain') ||
      h.lower.includes('problem') ||
      h.lower.includes('challenge') ||
      h.lower.includes('need')
    )) {
      mapping.customerPain = h.raw;
    }
    // 17. Reason Won / Lost
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
 * Validates file metadata and parses CSV or XLSX without executing formulas.
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

  return parseLeadBytes(fileName, new Uint8Array(await file.arrayBuffer()), fileSizeBytes);
}

export async function parseLeadBytes(
  fileName: string,
  bytes: Uint8Array,
  declaredSizeBytes = bytes.byteLength
): Promise<ParseResult> {
  if (!isAllowedExtension(fileName)) {
    throw new Error(`Unsupported file extension for "${fileName}". Please provide a .csv or .xlsx spreadsheet.`);
  }
  if (declaredSizeBytes !== bytes.byteLength) {
    throw new Error('Uploaded file size did not match the received content. Please select the file again.');
  }
  if (bytes.byteLength > UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds the maximum allowed limit of ${UPLOAD_CONFIG.MAX_FILE_SIZE_LABEL}.`);
  }
  if (bytes.byteLength === 0) {
    throw new Error(`The file "${fileName}" is empty (0 bytes).`);
  }
  return fileName.toLowerCase().endsWith('.xlsx')
    ? parseExcelBytes(fileName, bytes)
    : parseCsvText(fileName, new TextDecoder('utf-8', { fatal: false }).decode(bytes), bytes.byteLength);
}

/**
 * Parse an Excel .xlsx file using SheetJS with formula extraction disabled.
 */
function excelCellText(cell: Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'formula' in value) {
    return sanitizeUntrustedCell(`=${String(value.formula)}`);
  }
  if (typeof value === 'object' && 'richText' in value) {
    return sanitizeUntrustedCell(value.richText.map((part) => part.text).join(''));
  }
  if (typeof value === 'object' && 'text' in value) {
    return sanitizeUntrustedCell(String(value.text));
  }
  return sanitizeUntrustedCell(cell.text || String(value));
}

async function parseExcelBytes(fileName: string, bytes: Uint8Array): Promise<ParseResult> {
  try {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const workbookBytes = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(workbookBytes);

    if (workbook.worksheets.length === 0) {
      throw new Error('Excel workbook contains no sheets.');
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('The first Excel worksheet is empty or unreadable.');
    }

    if (worksheet.actualRowCount === 0) {
      throw new Error(`The Excel spreadsheet "${fileName}" contains no data rows.`);
    }

    const headerRow = worksheet.getRow(1);
    const columnCount = Math.max(headerRow.cellCount, worksheet.actualColumnCount);
    const headers = Array.from({ length: columnCount }, (_, index) => {
      const text = excelCellText(headerRow.getCell(index + 1));
      return text || `Column_${index + 1}`;
    });

    if (headers.length === 0) {
      throw new Error('No column headers detected in the Excel sheet.');
    }
    if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
      throw new Error('Duplicate column headers were detected. Rename duplicate headers and upload the file again.');
    }

    // Subsequent rows are data
    const rawRows: RawLeadRecord[] = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const cellValues = headers.map((_, index) => excelCellText(row.getCell(index + 1)));
      if (cellValues.every((value) => value === '')) {
        continue;
      }

      const rowObj: RawLeadRecord = {};
      headers.forEach((hdr, idx) => {
        rowObj[hdr] = cellValues[idx];
      });
      rawRows.push(rowObj);
    }

    if (rawRows.length === 0) {
      throw new Error(`No lead records found under the headers in "${fileName}".`);
    }

    const detectedMapping = autoDetectColumns(headers);
    const piiColumnsDetected = detectPiiColumns(headers);

    return {
      fileName,
      fileSizeBytes: bytes.byteLength,
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
 * Parse CSV text using PapaParse with safe delimiter detection.
 */
async function parseCsvText(fileName: string, content: string, fileSizeBytes: number): Promise<ParseResult> {
  if (!content.trim()) {
    throw new Error(`The file "${fileName}" is completely blank.`);
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
          reject(new Error(`No column headers detected in "${fileName}". Please ensure the first row contains column names.`));
          return;
        }

        if (!results.data || results.data.length === 0) {
          reject(new Error(`No lead rows detected in "${fileName}".`));
          return;
        }

        if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
          reject(new Error('Duplicate column headers were detected. Rename duplicate headers and upload the file again.'));
          return;
        }
        const rawRows = results.data.map((row) => Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key.trim(), sanitizeUntrustedCell(value)])
        ));
        const detectedMapping = autoDetectColumns(headers);
        const piiColumnsDetected = detectPiiColumns(headers);
        const parseErrors = results.errors.map((e) => `Line ${e.row}: ${e.message}`);

        resolve({
          fileName,
          fileSizeBytes,
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
  let missingOptionalValuesCount = 0;
  let recordsWithMissingOptionalValues = 0;

  const mappingErrors = validateUniqueMapping(mapping);
  if (mappingErrors.length > 0) {
    throw new Error(mappingErrors.join(' '));
  }
  if (!mapping.companyName && !mapping.domain) {
    throw new Error('Map at least Company Name or Website/Domain before validating records.');
  }

  // Data structures for duplicate tracking
  const domainLeadMap = new Map<string, NormalizedLead[]>();
  const nameLeadMap = new Map<string, NormalizedLead[]>();

  rawRows.forEach((raw, index) => {
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

    const normalizedDomain = normalizeCompanyDomain(rawWebsite);

    // ZOD Schema Validation: requires a name or a syntactically valid domain.
    const validationCheck = LeadRowValidator.safeParse({
      companyName: rawCompanyName,
      domain: normalizedDomain,
    });

    if (!validationCheck.success) {
      invalidRows.push({
        rowNumber: rowNum,
        companyName: rawCompanyName || undefined,
        domain: rawWebsite || undefined,
        reason: rawWebsite
          ? 'Missing required identifier: the Website/Domain value is invalid and Company Name is blank.'
          : 'Missing required identifier: row contains neither a Company Name nor a Website/Domain.',
        raw: sanitizedRaw,
      });
      return;
    }

    const hasValidDomain = Boolean(normalizedDomain);

    if (validLeads.length >= maxTotalRows) {
      invalidRows.push({
        rowNumber: rowNum,
        companyName: rawCompanyName || undefined,
        domain: normalizedDomain || rawWebsite || undefined,
        reason: `Valid-record limit exceeded. A dataset can store at most ${maxTotalRows} valid records.`,
        raw: sanitizedRaw,
      });
      return;
    }

    // Final company name: if missing but domain present, derive friendly display name from domain
    let companyName = rawCompanyName;
    if (!companyName && normalizedDomain) {
      // Derive friendly name e.g. "stripe.com" -> "Stripe"
      companyName = normalizedDomain;
    }

    const validationWarnings: string[] = [];
    const mappedOptionalFields = OPTIONAL_MAPPING_FIELDS.filter((field) => Boolean(mapping[field]));
    const rowMissingCount = mappedOptionalFields.filter((field) => {
      const source = mapping[field];
      return source ? !hasValue(raw[source]) : false;
    }).length;
    missingOptionalValuesCount += rowMissingCount;
    if (rowMissingCount > 0) recordsWithMissingOptionalValues += 1;

    // Optional Firmographics
    const industry = mapping.industry && hasValue(raw[mapping.industry])
      ? String(raw[mapping.industry]).trim()
      : '';

    // Parse headcount
    const headcount = mapping.headcount
      ? parseOptionalNumber(raw[mapping.headcount], 'Employees', validationWarnings, true)
      : null;

    // Revenue
    const annualRevenue = mapping.annualRevenue && hasValue(raw[mapping.annualRevenue])
      ? String(raw[mapping.annualRevenue]).trim()
      : null;
    const annualRevenueValue = mapping.annualRevenue
      ? parseOptionalNumber(raw[mapping.annualRevenue], 'Annual revenue', validationWarnings)
      : null;

    // Description
    const description = mapping.description && hasValue(raw[mapping.description])
      ? String(raw[mapping.description]).trim()
      : '';

    // Country / Geography
    const country = mapping.country && hasValue(raw[mapping.country])
      ? String(raw[mapping.country]).trim()
      : '';

    // Technologies
    let technologies: string[] = [];
    if (mapping.technologies && raw[mapping.technologies]) {
      technologies = String(raw[mapping.technologies])
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // Optional Commercials
    const companyType = mapping.companyType && hasValue(raw[mapping.companyType]) ? String(raw[mapping.companyType]).trim() : undefined;
    const businessModel = mapping.businessModel && hasValue(raw[mapping.businessModel]) ? String(raw[mapping.businessModel]).trim() : undefined;
    const productRaw = mapping.product && hasValue(raw[mapping.product]) ? String(raw[mapping.product]).trim() : undefined;
    const rawLeadStage = mapping.leadStage && hasValue(raw[mapping.leadStage])
      ? String(raw[mapping.leadStage]).trim().toLowerCase()
      : 'new';
    const leadStage = ALLOWED_LEAD_STATUSES.has(rawLeadStage) ? rawLeadStage : 'new';
    if (rawLeadStage !== leadStage) {
      validationWarnings.push(`Lead status "${rawLeadStage}" is unsupported and was normalized to "new".`);
    }

    const dealValue = mapping.dealValue
      ? parseOptionalNumber(raw[mapping.dealValue], 'Deal value', validationWarnings)
      : null;

    const rawCurrency = mapping.currency && hasValue(raw[mapping.currency])
      ? String(raw[mapping.currency]).trim().toUpperCase()
      : null;
    const currency = rawCurrency && /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : null;
    if (rawCurrency && !currency) {
      validationWarnings.push(`Currency "${rawCurrency}" is not a three-letter ISO code and was stored as blank.`);
    }

    const retentionMonths = mapping.retentionMonths
      ? parseOptionalNumber(raw[mapping.retentionMonths], 'Retention months', validationWarnings, true)
      : null;

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
      annualRevenueValue,
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
      analysisStatus: isAiEnriched ? 'pending' : 'skipped',
      isClean: true,
      isDuplicate: false,
      validationWarnings,
      rawRow: sanitizedRaw,
      ingestedAt: new Date().toISOString(),
    };

    if (!hasValidDomain) {
      lead.validationWarnings?.push('No valid company domain provided. Later enrichment capability will be limited.');
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

  // 2. Flag exact normalized-name collisions for review, but never auto-merge them.
  nameLeadMap.forEach((matchedLeads, nameKey) => {
    if (matchedLeads.length > 1) {
      // Check if not already caught by exact domain
      const domains = new Set(matchedLeads.map((l) => l.domain).filter(Boolean));
      if (domains.size > 1 || domains.size === 0) {
        duplicateGroups.push({
          key: `dup-name-${nameKey}`,
          type: 'uncertain',
          companyName: matchedLeads[0].companyName,
          leads: matchedLeads,
        });

        matchedLeads.forEach((lead) => {
          lead.validationWarnings?.push(`Possible duplicate name: ${lead.companyName}. Review manually; this record was not auto-merged.`);
        });
      }
    }
  });

  // Filter out duplicates if skipDuplicates is true
  let finalLeads = validLeads;
  if (options.skipDuplicates) {
    finalLeads = validLeads.filter((l) => !l.isDuplicate);
  }

  // Allocate the later-analysis allowance only after exact-domain duplicates
  // have been removed so that up to 100 distinct stored records are eligible.
  finalLeads.forEach((lead, index) => {
    lead.isAiEnriched = index < maxAiEnrichedDemo;
    lead.enrichmentTier = lead.isAiEnriched
      ? (lead.hasValidDomain ? 'full' : 'limited')
      : 'stored_only';
  });

  const duplicateRowsCount = duplicateGroups.reduce(
    (count, group) => count + Math.max(0, group.leads.length - 1),
    0
  );
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
      missingOptionalValuesCount,
      recordsWithMissingOptionalValues,
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
