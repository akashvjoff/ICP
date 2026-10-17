export const sampleIndustries = ['saas', 'logistics', 'healthcare', 'retail', 'manufacturing'] as const;
export type SampleIndustry = typeof sampleIndustries[number];
export const selectedSampleKey = 'figuredit_selected_sample';

export function suggestedSample(industry: string): SampleIndustry {
  const value = industry.toLowerCase();
  if (/health|medical|clinic/.test(value)) return 'healthcare';
  if (/logistic|supply|transport|freight/.test(value)) return 'logistics';
  if (/retail|commerce|shop/.test(value)) return 'retail';
  if (/manufactur|industrial|factory/.test(value)) return 'manufacturing';
  return 'saas';
}
