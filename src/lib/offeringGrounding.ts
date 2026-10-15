const genericWords = new Set([
  'about', 'account', 'accounts', 'business', 'company', 'customer', 'customers', 'data', 'improve',
  'management', 'operational', 'operations', 'platform', 'process', 'product', 'service',
  'software', 'solution', 'solutions', 'system', 'teams', 'through', 'using', 'with',
]);

function terms(value: string): Set<string> {
  return new Set((value.toLowerCase().match(/[a-z]{3,}/g) || [])
    .filter(word => !genericWords.has(word))
    .map(word => word.slice(0, 6)));
}

export function hasOfferingOverlap(candidate: string, problem: string, capabilities: string[]): boolean {
  const offeringTerms = terms([problem, ...capabilities].join(' '));
  if (!offeringTerms.size) return false;
  const candidateTerms = terms(candidate);
  if ([...candidateTerms].some(term => offeringTerms.has(term))) return true;
  const accountData = new Set(['enrich', 'firmog', 'crm', 'databa', 'record', 'dedupl', 'sync']);
  return [...offeringTerms].some(term => accountData.has(term)) && [...candidateTerms].some(term => accountData.has(term));
}

const quantifiedClaimPattern = /(?:[$₹]\s*\d[\d,.]*(?:k|m)?|\b\d+(?:\.\d+)?\+?\s*(?:%|percent|hours?|minutes?|days?|weeks?|months?|x\b))/gi;
export function hasUnsupportedStat(claim: string, suppliedText: string): boolean {
  return [...claim.matchAll(quantifiedClaimPattern)].some(match => !suppliedText.toLowerCase().includes(match[0].toLowerCase()));
}

export function shortProblemLabel(problem: string): string {
  const clean = problem.replace(/\s*\(Hypothesis\)$/i, '').split(/[.!?;]/)[0]
    .replace(/\s+Cohort$/i, '').replace(/^(Friction in|Gap between|Need for)\s+/i, '').trim();
  if (clean.length <= 60) return clean || 'Unverified problem';
  return clean.slice(0, 60).replace(/\s+\S*$/, '').trim() || clean.slice(0, 60);
}
