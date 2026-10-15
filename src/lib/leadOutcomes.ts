export type LeadOutcome = 'positive' | 'negative' | 'neutral';

export function classifyLeadStage(value: unknown): LeadOutcome {
  const stage = String(value ?? '').trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
  if (['meeting booked', 'qualified', 'replied', 'won', 'closed won'].includes(stage)) return 'positive';
  if (['not interested', 'lost', 'closed lost'].includes(stage)) return 'negative';
  return 'neutral';
}

export function databaseLeadStage(value: unknown): string {
  const stage = String(value ?? '').trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    'meeting booked': 'opportunity', replied: 'contacted', 'not interested': 'disqualified',
    'closed won': 'won', 'closed lost': 'lost',
  };
  return aliases[stage] || (['new', 'qualified', 'disqualified', 'contacted', 'opportunity', 'won', 'lost'].includes(stage) ? stage : 'new');
}
