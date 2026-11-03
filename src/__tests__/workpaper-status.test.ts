// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({ syncIn: async () => {}, syncOut: async () => {}, currentVersion: () => 1, hasDatabase: () => false }));

import { db } from '../lib/server/db';
import { evaluatePaper, paperStatus } from '../lib/workpapers/engine';
import { blankPaperData, templateFor } from '../lib/workpapers/templates';

// A bank paper on an engagement with a mapped trial balance
const bankPaper = () => {
  const wp = db.workpapers.find((w) => w.ref === 'B-10' && evaluatePaper(w)?.totals.ledger)!;
  wp.status = 'in_progress';
  wp.data_json = blankPaperData(templateFor('B-10')!);
  return wp;
};
const firmOf = (wp: { engagement_id: string }) => db.firms.find((f) => f.id === db.engagements.find((e) => e.id === wp.engagement_id)!.firm_id)!;

beforeEach(() => db.seed(true));

describe('status engine (WPS-04)', () => {
  it('a blank schedule is Not started and shows its TB balance and difference', () => {
    const wp = bankPaper();
    const r = evaluatePaper(wp)!;
    expect(r.totals.ledger).not.toBe(0n);
    expect(r.totals.difference).toBe(-r.totals.ledger);
    expect(paperStatus(wp)).toBe('not_started');
  });

  it('turns Unreconciled when work starts, and Reconciled once the difference clears', () => {
    const wp = bankPaper();
    const ledger = evaluatePaper(wp)!.totals.ledger;
    wp.data_json.statement_p = (ledger - 500n).toString(); // £5 out
    expect(paperStatus(wp)).toBe('unreconciled');
    wp.data_json.statement_p = ledger.toString();
    expect(paperStatus(wp)).toBe('reconciled');
  });

  it('uses the practice tolerance from settings (default £1)', () => {
    const wp = bankPaper();
    const ledger = evaluatePaper(wp)!.totals.ledger;
    wp.data_json.statement_p = (ledger - 80n).toString(); // 80p out
    expect(paperStatus(wp)).toBe('reconciled');
    const firm = firmOf(wp);
    firm.settings = { ...firm.settings, defaults: { tolerance_p: '50', review_threshold_p: '50000', signoff_levels: 2 } };
    expect(paperStatus(wp)).toBe('unreconciled');
  });

  it('never overrides a sign-off status', () => {
    const wp = bankPaper();
    wp.status = 'prepared';
    wp.data_json.statement_p = '1';
    expect(paperStatus(wp)).toBe('prepared');
  });
});
