// Engagement periods (ENG-01): year-end, quarterly and monthly files
export type Frequency = 'year_end' | 'quarterly' | 'monthly';
export const FREQUENCY_MONTHS: Record<Frequency, number> = { year_end: 12, quarterly: 3, monthly: 1 };

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/** First day of a period of `months` months ending on `end` (YYYY-MM-DD). */
export function periodStart(end: string, months: number): string {
  const [y, m, d] = end.split('-').map(Number);
  const lastOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Ending on a month end: start on the 1st, `months` months back
  if (d === lastOfMonth) return iso(y, m - months, 1);
  // Mid-month: the day after the same date `months` back, clamped to that month's length
  const daysThen = new Date(Date.UTC(y, m - 1 - months + 1, 0)).getUTCDate();
  return iso(y, m - 1 - months, Math.min(d, daysThen) + 1);
}
