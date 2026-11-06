// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/server/db';
import { buildAccounts } from '../lib/workpapers/accounts';

const ENG = 'eng_acc_test';
const map = (code: string, pence: number, status = 'confirmed') =>
  ({ id: `m_${code}_${status}`, engagement_id: ENG, source_code: code, source_name: code, balance_p: String(pence), blynt_code: code, status }) as any;

beforeEach(() => {
  db.seed(true);
  db.engagements.push({ id: ENG, client_id: 'cli_harlow', period_start: '2025-04-06', period_end: '2026-04-05', prior_engagement_id: null } as any);
  db.account_mappings.push(
    map('100', -10000), // sales (credit)
    map('200', 6000), // purchases
    map('600', 14000), // bank
    map('750', -3000), // trade payables
    map('850', -5000), // share capital
    map('890', -2000), // retained earnings
  );
});

describe('accounts from the trial balance', () => {
  it('builds profit, balance sheet and capital that agree', () => {
    const a = buildAccounts(ENG);
    expect(a.pl.map((l) => [l.label, l.amount])).toEqual([['Turnover', 10000n], ['Cost of sales', -6000n]]);
    expect(a.grossProfit?.amount).toBe(4000n);
    expect(a.profit.amount).toBe(4000n);
    expect(a.bs.current.map((l) => l.label)).toEqual(['Cash at bank and in hand']);
    expect(a.bs.creditorsShort[0]).toMatchObject({ label: 'Creditors: trade', amount: 3000n });
    expect(a.netAssets.amount).toBe(11000n);
    expect(a.capitalAndReserves.amount).toBe(11000n);
    expect(a.unmappedPence).toBe(0n);
    expect(a.hasPrior).toBe(false);
  });

  it('includes journals in the TB and reports balances not yet mapped', () => {
    db.adjustments.push({ id: 'adj_t', engagement_id: ENG, status: 'approved', lines: [{ blynt_code: '400', debit_p: '500', credit_p: '0' }, { blynt_code: '760', debit_p: '0', credit_p: '500' }] } as any);
    db.account_mappings.push(map('999', 700, 'suggested'));
    const a = buildAccounts(ENG);
    expect(a.profit.amount).toBe(3500n);
    expect(a.bs.creditorsShort.find((l) => l.label === 'Accruals and deferred income')?.amount).toBe(500n);
    expect(a.netAssets.amount).toBe(a.capitalAndReserves.amount);
    expect(a.unmappedPence).toBe(700n);
  });
});

describe('accounts edge cases', () => {
  it('treats a code missing from the chart as unmapped and hides an empty prior year', () => {
    db.engagements.find((e) => e.id === ENG)!.prior_engagement_id = 'eng_empty_prior';
    db.engagements.push({ id: 'eng_empty_prior', client_id: 'cli_harlow', period_end: '2025-04-05', prior_engagement_id: null } as any);
    db.account_mappings.push(map('1010', 900)); // old four-digit chart code
    const a = buildAccounts(ENG);
    expect(a.unmappedPence).toBe(900n);
    expect(a.hasPrior).toBe(false);
  });

  it('a saved workspace gets the current standard chart and keeps the practice’s own accounts', () => {
    const own = { code: '455', name: 'Practice addition', type: 'Overhead', normal_balance: 'Debit', lead_letter: 'E', is_control: false, is_system: false } as any;
    db.importState({ blynt_accounts: [{ code: '1010', name: 'Old bank', is_system: true } as any, own] });
    expect(db.blynt_accounts.some((x) => x.code === '1010')).toBe(false);
    expect(db.blynt_accounts.some((x) => x.code === '600')).toBe(true);
    expect(db.blynt_accounts.some((x) => x.code === '455')).toBe(true);
  });
});
