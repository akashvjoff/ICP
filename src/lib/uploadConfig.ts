/**
 * Upload Limits & Configuration
 * Stage: MVP 1
 */

export const UPLOAD_CONFIG = {
  // Hard limits
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB per file
  MAX_FILE_SIZE_LABEL: '5 MB',
  MAX_ROWS_PER_DATASET: 500, // Maximum allowed rows per dataset
  MAX_AI_ENRICHED_ROWS_DEMO: 100, // Maximum AI-enriched rows in free/demo tier

  // Supported extensions
  ALLOWED_EXTENSIONS: ['.csv', '.xlsx'] as const,
  ALLOWED_MIME_TYPES: [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],

  // PII detection patterns - Personal data must NEVER be passed to AI models
  PII_PATTERNS: [
    /\b(email|e-mail|mail)\b/i,
    /\b(phone|telephone|mobile|cell|cellphone|fax)\b/i,
    /\b(ssn|social security|national id|passport)\b/i,
    /\b(first[ _]?name|last[ _]?name|full[ _]?name|contact[ _]?name|person)\b/i,
    /\b(home[ _]?address|personal[ _]?address|zipcode|postal[ _]?code)\b/i,
  ],
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function isAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return UPLOAD_CONFIG.ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function detectPiiColumns(headers: string[]): string[] {
  return headers.filter((header) =>
    UPLOAD_CONFIG.PII_PATTERNS.some((pattern) => pattern.test(header.trim()))
  );
}
