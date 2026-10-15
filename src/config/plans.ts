export const PAID_PLAN_IDS = ['starter', 'pro'] as const;
export type PaidPlanId = typeof PAID_PLAN_IDS[number];

export const PLANS = [
  { id: 'free', name: 'Free', monthlyPriceInr: 0, datasetsPerMonth: 1, companiesPerDataset: 25, uploadRowLimit: 25, formats: ['CSV'], features: ['1 dataset', '25 AI-analyzed companies', '25-row CSV upload'] },
  { id: 'starter', name: 'Starter', monthlyPriceInr: 1999, datasetsPerMonth: 3, companiesPerDataset: 100, uploadRowLimit: 100, formats: ['CSV', 'XLSX'], features: ['3 datasets per month', '100 companies each', 'CSV + XLSX + contacts export'] },
  { id: 'pro', name: 'Pro', monthlyPriceInr: 4999, datasetsPerMonth: null, companiesPerDataset: 500, uploadRowLimit: 500, formats: ['CSV', 'XLSX'], features: ['Unlimited datasets', '500 companies each', 'Unwatermarked PDF'] },
] as const;

export const annualPriceInr = (monthlyPriceInr: number) => monthlyPriceInr * 10;
// Display estimate only; checkout will use its own live currency conversion when launched.
export const approximateUsd = (priceInr: number) => Math.round(priceInr / 95.2);
