import { describe, it, expect } from 'vitest';
import { ukDate } from '@/lib/dates';

describe('UK dates', () => {
  it('shows day first, and a bare date never moves to another day', () => {
    expect(ukDate('2026-09-30')).toBe('30 Sept 2026');
    expect(ukDate('2026-01-05T23:30:00Z')).toMatch(/^(5|6) Jan 2026$/);
    expect(ukDate('')).toBe('');
    expect(ukDate('not a date')).toBe('not a date');
  });
});
