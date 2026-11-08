// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/server/db';
import { PACKS, templateFor } from '../lib/workpapers/templates';
import { evaluatePaper } from '../lib/workpapers/engine';
import { analyticalReview, analyticalRows } from '../lib/workpapers/analytical';

const ENG = 'eng_review_test';
const PRIOR = 'eng_review_prior';
const map = (eng: string, code: string, pence: number) =>
  ({ id: `m_${eng}_${code}`, engagement_id: eng, source_code: code, source_name: code, balance_p: String(pence), blynt_code: code, status: 'confirmed' }) as any;

beforeEach(() => {
  db.seed(true);
  db.engagements.push(
    { id: ENG, client_id: 'cli_harlow', firm_id: 'x', period_start: '2025-04-06', period_end: '2026-04-05', prior_engagement_id: PRIOR } as any,
    { id: PRIOR, client_id: 'cli_harlow', firm_id: 'x', period_start: '2024-04-06', period_end: '2025-04-05', prior_engagement_id: null } as any
  );
  db.account_mappings.push(
    map(ENG, '100', -2000000), // sales £20,000
    map(PRIOR, '100', -1000000), // £10,000 last year: up 100%
    map(ENG, '470', 105000), // insurance £1,050
    map(PRIOR, '470', 100000), // £1,000 last year: up 5%, below threshold
    map(ENG, '482', 200000) // legal £2,000, nil last year
  );
});

const row = (view: 'pl' | 'bs', code: string, data = {}) =>
  analyticalRows(analyticalReview(ENG, view, data)).find((r) => r.key === code)!;

describe('analytical reviews', () => {
  it('compares each account with the prior year and flags significant movements', () => {
    expect(row('pl', '100')).toMatchObject({ current: 2000000n, prior: 1000000n, variance: 1000000n, percent: 100, significant: true });
    expect(row('pl', '470').significant).toBe(false); // 5% is under 10%
    expect(row('pl', '482')).toMatchObject({ prior: 0n, percent: null, significant: true }); // nil last year needs only the amount
    expect(row('pl', '470', { threshold_pct: 1, threshold_p: '1000' }).significant).toBe(true);
  });

  it('needs every significant movement explained before the paper passes', () => {
    const wp = db.addWorkpaper(ENG, 'Z-30')!;
    const check = () => evaluatePaper(wp)!.checks.find((c) => c.id === 'explained')!;
    expect(check()).toMatchObject({ passed: false, detail: '2 of 2 still need an explanation.' });
    wp.data_json.comments = { '100': 'New contract won', '482': 'One-off dispute' };
    expect(check().passed).toBe(true);
    expect(evaluatePaper(wp)!.draftConclusion).toContain('2 flagged');
  });

  it('shows categories instead of accounts when asked, under main headings, with their own flags', () => {
    db.account_mappings.push(map(ENG, '600', 500000), map(PRIOR, '600', 900000), map(ENG, '750', -100000), map(PRIOR, '750', -100000));
    const bs = analyticalReview(ENG, 'bs', {});
    expect(bs.sections.map((s) => s.heading)).toEqual(['Assets', 'Liabilities']);
    expect(bs.sections[0]).toMatchObject({ current: 500000n, prior: 900000n });
    expect(bs.priorEnd).toBe('2025-04-05');
    expect(bs.sections[0].blocks[0].heading).toBeNull();
    const cash = bs.sections[0].blocks[0].rows[0];
    expect(cash).toMatchObject({ key: 'line:Cash at bank and in hand', code: null, variance: -400000n, significant: true });

    const byAccount = analyticalReview(ENG, 'bs', { show_accounts: true });
    expect(byAccount.sections[0].blocks[0]).toMatchObject({ heading: 'Cash at bank and in hand' });
    expect(byAccount.sections[0].blocks[0].rows[0].key).toBe('600');
  });
});

describe('statutory information', () => {
  it('checks directors, shareholders, shares and dates', () => {
    const wp = db.addWorkpaper(ENG, 'R-20')!;
    const failed = () => evaluatePaper(wp)!.checks.filter((c) => !c.passed).map((c) => c.id);
    expect(failed()).toEqual(['director', 'shareholder']);
    wp.data_json.officers = [
      { id: 'a', surname: 'Abeles', is_director: true, is_shareholder: true, shares: '100000', appointed: '2023-03-20' },
      { id: 'b', surname: 'Sweny', is_shareholder: true, shares: '1005' },
    ];
    expect(failed()).toEqual([]);
    expect(evaluatePaper(wp)!.totals.shares).toBe(101005n);
    wp.data_json.officers[1].shares = '';
    wp.data_json.officers[0].resigned = '2020-01-01';
    expect(failed()).toEqual(['director', 'shares', 'dates']);
  });

  it('is only in company packs, and every pack has both analytical reviews', () => {
    for (const [type, refs] of Object.entries(PACKS)) {
      expect(refs, type).toEqual(expect.arrayContaining(['Z-30', 'Z-40']));
      expect(refs.includes('R-20'), type).toBe(['Micro-entity (FRS 105)', 'Small company (FRS 102 1A)', 'Medium/large (FRS 102)', 'IFRS company/group'].includes(type));
    }
    expect(templateFor('R-20')?.rollsForward).toBe(true);
  });
});
