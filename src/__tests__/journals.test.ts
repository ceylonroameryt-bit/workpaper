// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({ syncIn: async () => {}, syncOut: async () => {}, currentVersion: () => 1, hasDatabase: () => false }));

import { db } from '../lib/server/db';
import { createJournal, journalAction, deleteJournal, registerTotals, autoReverseInto } from '../lib/server/journals';
import { leadFigures } from '../lib/workpapers/engine';
import { templateFor } from '../lib/workpapers/templates';
import { mergeFirmState, GuardError } from '../lib/server/state-guard';

const FIRM = 'firm_blynt_uk';
const ENG = 'eng_harlow_fy26';
const preparer = { id: 'usr_test_preparer', name: 'Preparer', role: 'preparer' as const, firmId: FIRM };
const reviewer = { id: 'usr_test_reviewer', name: 'Reviewer', role: 'reviewer' as const, firmId: FIRM };
// Dr Office rent £500, Cr Accruals £500 (an accrual: profit and net assets both fall £500)
const accrual = (over: Record<string, unknown> = {}) => ({
  type: 'adjusting',
  date: '2026-09-30',
  narrative: 'Accrue September rent',
  lines: [
    { blynt_code: '400', debit_p: '500.00', credit_p: '0', narrative: 'Rent' },
    { blynt_code: '760', debit_p: '0', credit_p: '500.00', narrative: 'Accrual' },
  ],
  ...over,
});
const creditors = () => leadFigures(ENG, templateFor('K-20')!).reduce((a, l) => a + l.final, 0n);

beforeEach(() => db.seed(true));

describe('manual journals (JNL-01)', () => {
  it('a journal must balance, have a type, a narrative and a date inside the period', () => {
    expect(() => createJournal(preparer, ENG, accrual({ lines: [{ blynt_code: '400', debit_p: '500', credit_p: '0' }, { blynt_code: '760', debit_p: '0', credit_p: '499' }] }))).toThrow(/balance/);
    expect(() => createJournal(preparer, ENG, accrual({ type: 'whatever' }))).toThrow(/type/);
    expect(() => createJournal(preparer, ENG, accrual({ narrative: ' ' }))).toThrow(/narrative/);
    expect(() => createJournal(preparer, ENG, accrual({ date: '2027-01-01' }))).toThrow(/inside the period/);
    expect(() => createJournal(preparer, ENG, accrual({ lines: [{ blynt_code: '9999', debit_p: '1', credit_p: '0' }, { blynt_code: '760', debit_p: '0', credit_p: '1' }] }))).toThrow(/account/);
  });

  it('rejects part-pence amounts and absurdly large ones instead of rounding or accepting them', () => {
    const l = (d: string, c: string) => [{ blynt_code: '400', debit_p: d, credit_p: '0' }, { blynt_code: '760', debit_p: '0', credit_p: c }];
    expect(() => createJournal(preparer, ENG, accrual({ lines: l('10.005', '10.005') }))).toThrow(/pence/);
    expect(() => createJournal(preparer, ENG, accrual({ lines: l('99999999999.99', '99999999999.99') }))).toThrow(/too large/);
    expect(() => createJournal(preparer, ENG, accrual({ lines: l('10.50', '10.50') }))).not.toThrow();
  });

  it('an archived client’s journals are read-only', () => {
    const eng = db.engagements.find((e) => e.id === ENG)!;
    db.clients.find((c) => c.id === eng.client_id)!.archived_at = '2026-10-01T00:00:00Z';
    expect(() => createJournal(preparer, ENG, accrual())).toThrow(/archived/);
  });

  it('saving a journal changes the adjusted TB straight away', () => {
    const before = creditors();
    const j = createJournal(preparer, ENG, accrual());
    expect(j.status).toBe('accepted');
    expect(creditors()).toBe(before - 50000n); // credit of £500 on accruals
    expect(db.audit_logs.some((a) => a.entity_id === j.id && a.action === 'CREATE_JOURNAL')).toBe(true);
  });

  it('only unapproved journals can be deleted; approved ones are reversed instead', () => {
    const j = createJournal(preparer, ENG, accrual());
    const before = creditors();
    journalAction(reviewer, j.id, { action: 'approve' });
    expect(() => deleteJournal(preparer, j.id)).toThrow(/reverse/i);
    const rev = journalAction(reviewer, j.id, { action: 'reverse' });
    expect(db.adjustments.find((a) => a.id === j.id)!.status).toBe('reversed');
    expect(rev.reverses_id).toBe(j.id);
    expect(creditors()).toBe(before + 50000n); // the reversal cancels it

    const k = createJournal(preparer, ENG, accrual());
    deleteJournal(preparer, k.id);
    expect(db.adjustments.some((a) => a.id === k.id)).toBe(false);
    expect(db.audit_logs.find((a) => a.entity_id === k.id && a.action === 'DELETE_JOURNAL')!.before_json).toContain('760');
  });
});

describe('proposed journals (JNL-02 framework)', () => {
  it('a proposal stays in Draft and changes nothing until accepted; rejecting needs a reason', () => {
    const before = creditors();
    const p = createJournal(preparer, ENG, accrual({ type: 'proposed_by_ai', source_schedule: 'K-20', calculation: 'Rent for September not yet invoiced' }));
    expect(p.status).toBe('proposed');
    expect(creditors()).toBe(before);
    journalAction(preparer, p.id, { action: 'accept' });
    expect(creditors()).toBe(before - 50000n);

    const q = createJournal(preparer, ENG, accrual({ type: 'proposed_by_ai' }));
    expect(() => journalAction(preparer, q.id, { action: 'reject' })).toThrow(/reason/);
    journalAction(preparer, q.id, { action: 'reject', reason: 'Already invoiced in October' });
    expect(db.adjustments.find((a) => a.id === q.id)).toMatchObject({ status: 'rejected', reject_reason: 'Already invoiced in October' });
  });
});

describe('journal register (JNL-04)', () => {
  it('approval needs a reviewer who did not prepare it', () => {
    const j = createJournal(preparer, ENG, accrual());
    expect(() => journalAction(preparer, j.id, { action: 'approve' })).toThrow();
    journalAction(reviewer, j.id, { action: 'approve' });
    expect(db.adjustments.find((a) => a.id === j.id)).toMatchObject({ status: 'approved', approved_by: reviewer.id });
  });

  it('totals the effect on profit and on net assets', () => {
    createJournal(preparer, ENG, accrual());
    // A reclass between two assets moves neither figure
    createJournal(preparer, ENG, accrual({ type: 'reclassification', narrative: 'Reclass petty cash', lines: [{ blynt_code: '600', debit_p: '20', credit_p: '0' }, { blynt_code: '620', debit_p: '0', credit_p: '20' }] }));
    const t = registerTotals(ENG);
    expect(t.profit_p).toBe(-50000n);
    expect(t.net_assets_p).toBe(-50000n);
  });

  it('auto-reverse puts the reversing journal on the first day of the next period', () => {
    const j = createJournal(preparer, ENG, accrual({ auto_reverse: true }));
    journalAction(reviewer, j.id, { action: 'approve' });
    const eng = db.engagements.find((e) => e.id === ENG)!;
    const next = { ...eng, id: 'eng_harlow_fy27', period_start: '2026-10-01', period_end: '2027-09-30', status: 'planning' as const, prior_engagement_id: ENG };
    db.engagements.push(next);
    const made = autoReverseInto(next.id);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ engagement_id: next.id, date: '2026-10-01', reverses_id: j.id, status: 'accepted' });
    expect(made[0].lines.find((l) => l.blynt_code === '760')!.debit_p).toBe('50000');
    expect(autoReverseInto(next.id)).toHaveLength(0); // never twice
  });

  it('the browser cannot write journals; only the server can', () => {
    const before = db.exportState() as any;
    const after = JSON.parse(JSON.stringify(before));
    after.adjustments.push({ ...after.adjustments[0], id: 'aje_sneaky', status: 'approved' });
    const out = mergeFirmState(before, after, { id: preparer.id, name: 'P', role: 'preparer', firmId: FIRM }) as any;
    expect(out.adjustments.some((a: any) => a.id === 'aje_sneaky')).toBe(false);
  });
});

void GuardError;
