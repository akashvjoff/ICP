export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function formatHeadcount(count: number | null): string {
  if (!count) return 'Undisclosed';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k FTE`;
  return `${count} FTE`;
}

export function truncateText(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + '…';
}
