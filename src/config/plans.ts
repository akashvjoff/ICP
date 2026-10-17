export const PAID_PLAN_IDS = ['starter', 'pro'] as const;
export type PaidPlanId = typeof PAID_PLAN_IDS[number];
export const BILLING_INTERVALS = ['monthly', 'annual'] as const;
export const BILLING_CURRENCIES = ['INR', 'USD'] as const;
export type BillingInterval = typeof BILLING_INTERVALS[number];
export type BillingCurrency = typeof BILLING_CURRENCIES[number];

export const PLAN_COMPARISON_ROWS = [
  { key: 'datasets', label: 'Datasets / month' },
  { key: 'companies', label: 'AI companies / dataset' },
  { key: 'rows', label: 'Stored rows / dataset' },
  { key: 'csv', label: 'CSV export' },
  { key: 'xlsx', label: 'XLSX export' },
  { key: 'contacts', label: 'Contacts export' },
  { key: 'filtered', label: 'Filtered export' },
  { key: 'segments', label: 'Segments' },
  { key: 'strategy', label: '5C strategy' },
  { key: 'report', label: 'ICP report' },
  { key: 'watermark', label: 'PDF watermark' },
  { key: 'queue', label: 'Priority queue' },
  { key: 'support', label: 'Support' },
] as const;

export const PLANS = [
  {
    id: 'free', name: 'Free', bestFor: 'Finding your first clear ICP signal.',
    prices: { INR: { monthly: 0, annual: 0 }, USD: { monthly: 0, annual: 0 } },
    datasetsPerMonth: 1, companiesPerDataset: 25, uploadRowLimit: 25, formats: ['CSV'],
    features: ['1 dataset', '25 AI-analyzed companies', 'Companies-only CSV (25 rows)', 'Watermarked report', 'Public demo'],
    comparison: { datasets: '1 total', companies: '25', rows: '25', csv: 'Companies only · 25 rows', xlsx: '—', contacts: '—', filtered: '—', segments: '—', strategy: '—', report: 'Watermarked', watermark: 'Yes', queue: 'Standard', support: 'Self-service' },
  },
  {
    id: 'starter', name: 'Starter', bestFor: 'Growing pipelines that need richer exports.',
    prices: { INR: { monthly: 1999, annual: 19990 }, USD: { monthly: 24, annual: 240 } },
    datasetsPerMonth: 3, companiesPerDataset: 100, uploadRowLimit: 100, formats: ['CSV', 'XLSX'],
    features: ['3 datasets per month', '100 AI-analyzed companies each', 'Filtered CSV + XLSX export', 'Contacts export', 'Segments + 5C strategy', 'PDF report'],
    comparison: { datasets: '3', companies: '100', rows: '100', csv: 'Filtered', xlsx: 'Yes', contacts: 'Yes', filtered: 'Yes', segments: 'Yes', strategy: 'Yes', report: 'PDF', watermark: 'Yes', queue: 'Standard', support: 'Standard' },
  },
  {
    id: 'pro', name: 'Pro', bestFor: 'Teams working through larger lead lists.',
    prices: { INR: { monthly: 4999, annual: 49990 }, USD: { monthly: 59, annual: 590 } },
    datasetsPerMonth: null, companiesPerDataset: 500, uploadRowLimit: 500, formats: ['CSV', 'XLSX'],
    features: ['Unlimited datasets', '500 AI-analyzed companies each', 'Everything in Starter', 'Unwatermarked PDF', 'Priority analysis queue', 'Email support'],
    comparison: { datasets: 'Unlimited', companies: '500', rows: '500', csv: 'Filtered', xlsx: 'Yes', contacts: 'Yes', filtered: 'Yes', segments: 'Yes', strategy: 'Yes', report: 'PDF', watermark: 'No', queue: 'Priority', support: 'Email' },
  },
] as const;

export type Plan = typeof PLANS[number];
