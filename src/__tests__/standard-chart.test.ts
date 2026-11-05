import { describe, it, expect } from 'vitest';
import { STANDARD_CHART } from '@/lib/standard-chart';
import { db } from '@/lib/server/db';
import { TEMPLATES } from '@/lib/workpapers/templates';
import { matchBlyntAccount } from '@/lib/mapping/auto-mapper';

describe('Blynt standard chart (three-digit, v2)', () => {
  it('has the 96 accounts from the PDF, unique three-digit codes, and seeds the database', () => {
    expect(STANDARD_CHART).toHaveLength(96);
    expect(new Set(STANDARD_CHART.map((a) => a.code)).size).toBe(96);
    for (const a of STANDARD_CHART) {
      expect(a.code).toMatch(/^\d{3}$/);
      expect(['Debit', 'Credit', 'Mixed']).toContain(a.normal_balance);
      expect(a.schedule_ref).toMatch(/^REC-\d\d$/);
    }
    expect(db.blynt_accounts.length).toBeGreaterThanOrEqual(96);
  });

  it('every account code a working paper template refers to exists (or is a prefix of one)', () => {
    for (const t of Object.values(TEMPLATES) as any[]) {
      for (const l of t.leads ?? []) {
        expect(STANDARD_CHART.some((a) => a.code.startsWith(l.code)), `${t.ref} lead ${l.code}`).toBe(true);
      }
    }
  });

  it('maps typical Xero / QuickBooks account names to the new codes', () => {
    const code = (n: string, t = '') => matchBlyntAccount(n, t, '')!.blynt_code;
    expect(code('Business Bank Account', 'Bank')).toBe('600');
    expect(code('Accounts Receivable', 'Current Asset')).toBe('710');
    expect(code('Accounts Payable', 'Current Liability')).toBe('750');
    expect(code('VAT')).toBe('780');
    expect(code('Sales', 'Revenue')).toBe('100');
    expect(code('Insurance', 'Expense')).toBe('470');
    expect(code('Depreciation Expense', 'Expense')).toBe('492');
  });
});
