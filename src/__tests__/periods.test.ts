import { describe, it, expect } from 'vitest';
import { periodStart, FREQUENCY_MONTHS } from '../lib/periods';

describe('period generation', () => {
  it('a year, quarter or month ending on a month end starts the day after the previous one', () => {
    expect(periodStart('2026-03-31', FREQUENCY_MONTHS.year_end)).toBe('2025-04-01');
    expect(periodStart('2026-03-31', FREQUENCY_MONTHS.quarterly)).toBe('2026-01-01');
    expect(periodStart('2026-03-31', FREQUENCY_MONTHS.monthly)).toBe('2026-03-01');
    expect(periodStart('2026-02-28', FREQUENCY_MONTHS.monthly)).toBe('2026-02-01');
    expect(periodStart('2024-02-29', FREQUENCY_MONTHS.year_end)).toBe('2023-03-01'); // leap year
  });

  it('works for a mid-month year end', () => {
    expect(periodStart('2026-09-15', FREQUENCY_MONTHS.year_end)).toBe('2025-09-16');
    expect(periodStart('2026-05-30', FREQUENCY_MONTHS.quarterly)).toBe('2026-03-01'); // Feb has no 31st: clamped
  });
});

describe('period labels', () => {
  it('names the period by its frequency and end date', async () => {
    const { periodLabel } = await import('../lib/periods');
    expect(periodLabel({ period_start: '2025-04-01', period_end: '2026-03-31' })).toBe('Year ended 31 Mar 2026');
    expect(periodLabel({ period_start: '2026-01-01', period_end: '2026-03-31', frequency: 'quarterly' })).toBe('Quarter ended 31 Mar 2026');
    expect(periodLabel({ period_start: '2026-03-01', period_end: '2026-03-31', frequency: 'monthly' })).toBe('Month ended 31 Mar 2026');
    // A first period that isn't a standard length says so
    expect(periodLabel({ period_start: '2025-01-15', period_end: '2026-03-31' })).toBe('Long period ended 31 Mar 2026');
    expect(periodLabel({ period_start: '2025-10-01', period_end: '2026-03-31' })).toBe('Short period ended 31 Mar 2026');
  });
});
