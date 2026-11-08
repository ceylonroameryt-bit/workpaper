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

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const NAME: Record<Frequency, string> = { year_end: 'Year', quarterly: 'Quarter', monthly: 'Month' };

/** "Year ended 31 Mar 2026", or "Short period ended …" when the start was moved. */
export function periodLabel(e: { period_start: string; period_end: string; frequency?: Frequency }): string {
  const f = e.frequency ?? 'year_end';
  const standard = periodStart(e.period_end, FREQUENCY_MONTHS[f]);
  const name = e.period_start === standard ? NAME[f] : e.period_start < standard ? 'Long period' : 'Short period';
  return `${name} ended ${fmt(e.period_end)}`;
}

/** The same date a year earlier; 29 February falls back to the 28th. */
export const sameDayLastYear = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4).replace('-02-29', '-02-28')}`;
