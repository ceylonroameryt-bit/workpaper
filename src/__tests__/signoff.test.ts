// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({ syncIn: async () => {}, syncOut: async () => {}, currentVersion: () => 1, hasDatabase: () => false }));

import { db } from '../lib/server/db';
import { signOff, unreview, myWork, mentionsIn } from '../lib/server/signoff';
import { evaluatePaper } from '../lib/workpapers/engine';
import { blankPaperData, templateFor } from '../lib/workpapers/templates';
import { diffData } from '../lib/workpapers/diff';
import { mergeFirmState, GuardError } from '../lib/server/state-guard';

const FIRM = 'firm_blynt_uk';
const prep = { id: 'usr_test_preparer', name: 'Marcus Vance', role: 'preparer' as const, firmId: FIRM };
const rev = { id: 'usr_test_reviewer', name: 'Sarah Jenkins', role: 'reviewer' as const, firmId: FIRM };
const partner = { id: 'usr_test_partner', name: 'David Thorne', role: 'partner' as const, firmId: FIRM };

/** A bank paper with a TB balance, reconciled to the statement, procedures done, no sign-offs. */
function reconciledBank() {
  const wp = db.workpapers.find((w) => w.ref === 'B-10' && evaluatePaper(w)?.totals.ledger)!;
  db.signoffs = db.signoffs.filter((s) => s.workpaper_id !== wp.id);
  db.comments = db.comments.filter((c) => c.workpaper_id !== wp.id);
  wp.status = 'in_progress';
  wp.data_json = { ...blankPaperData(templateFor('B-10')!), statement_p: evaluatePaper(wp)!.totals.ledger.toString() };
  db.procedures.filter((p) => p.workpaper_id === wp.id).forEach((p) => {
    p.done_by = 'usr_test_preparer';
    p.done_at = '2026-10-01T00:00:00Z';
  });
  return wp;
}
const audited = (wpId: string) => db.audit_logs.filter((a) => a.entity_id === wpId).map((a) => a.action);

beforeEach(() => db.seed(true));

describe('Step 7 · the bank schedule end to end (REV-01, REV-02, AUD-02)', () => {
  it('reconciled → prepared → reviewed → unreviewed → changed → re-reviewed, every step audited', () => {
    const wp = reconciledBank();
    signOff(prep, wp.id, 'prepare');
    signOff(rev, wp.id, 'review');
    expect(wp.status).toBe('signed_off');

    unreview(rev, wp.id, 'Client sent a later statement');
    expect(db.signoffs.filter((s) => s.workpaper_id === wp.id && !s.stale_at).map((s) => s.role)).toEqual(['preparer']);
    expect(wp.data_json.changed_after_review).toBe(true);

    wp.data_json = { ...wp.data_json, bank_name: 'Barclays Business' }; // the change
    signOff(rev, wp.id, 'review');
    expect(wp.data_json.changed_after_review).toBe(false);

    expect(audited(wp.id)).toEqual(expect.arrayContaining(['SIGN_OFF_PREPARED', 'SIGN_OFF_REVIEWED', 'UNREVIEW_WORKPAPER']));
    expect(audited(wp.id).filter((a) => a === 'SIGN_OFF_REVIEWED')).toHaveLength(2);
    // A version is kept at every sign-off and the unreview
    expect(db.schedule_versions.filter((v) => v.workpaper_id === wp.id)).toHaveLength(4);
  });

  it('a review point blocks the Reviewed tick until it is cleared', () => {
    const wp = reconciledBank();
    signOff(prep, wp.id, 'prepare');
    db.comments.push({ id: 'c_rp', workpaper_id: wp.id, type: 'review_note', anchor_json: {}, status: 'open', created_by: rev.id, created_by_name: rev.name, created_at: '2026-10-02T00:00:00Z', resolved_by: null, body: 'Vouch the outstanding cheque' } as any);
    expect(() => signOff(rev, wp.id, 'review')).toThrow(/review point/);
    db.comments.find((c) => c.id === 'c_rp')!.status = 'resolved';
    expect(() => signOff(rev, wp.id, 'review')).not.toThrow();
  });
});

describe('sign-off rules (REV-01)', () => {
  it('follows the order, checks the role and stops one person ticking two levels', () => {
    const wp = reconciledBank();
    expect(() => signOff(rev, wp.id, 'review')).toThrow(/prepared first/);
    expect(() => signOff(prep, wp.id, 'approve')).toThrow(/partner/);
    signOff(rev, wp.id, 'prepare');
    expect(() => signOff(rev, wp.id, 'review')).toThrow(/two levels/);
  });

  it('prepared needs the paper reconciled', () => {
    const wp = reconciledBank();
    wp.data_json.statement_p = '1';
    expect(() => signOff(prep, wp.id, 'prepare')).toThrow(/Reconciled/);
  });

  it('with 2 sign-off levels, Reviewed is the last tick', () => {
    const wp = reconciledBank();
    db.firms.find((f) => f.id === FIRM)!.settings = { defaults: { tolerance_p: '100', review_threshold_p: '50000', signoff_levels: 2 } };
    signOff(prep, wp.id, 'prepare');
    signOff(rev, wp.id, 'review');
    expect(() => signOff(partner, wp.id, 'approve')).toThrow(/2 sign-off levels/);
  });

  it('unreview needs a reason of 10 characters and removes the review and approval ticks', () => {
    const wp = reconciledBank();
    signOff(prep, wp.id, 'prepare');
    signOff(rev, wp.id, 'review');
    signOff(partner, wp.id, 'approve');
    expect(() => unreview(rev, wp.id, 'short')).toThrow(/10 characters/);
    unreview(rev, wp.id, 'Late adjustment from the client');
    expect(db.signoffs.filter((s) => s.workpaper_id === wp.id && !s.stale_at).map((s) => s.role)).toEqual(['preparer']);
  });
});

describe('reviewed schedules are read-only, and sign-offs come only from the server', () => {
  it('the browser cannot edit a reviewed paper, add a sign-off or remove one', () => {
    const wp = reconciledBank();
    signOff(prep, wp.id, 'prepare');
    signOff(rev, wp.id, 'review');
    const before = db.exportState() as any;
    const edit = (f: (s: any) => void) => {
      const after = JSON.parse(JSON.stringify(before));
      f(after);
      return () => mergeFirmState(before, after, { ...prep, role: 'preparer' });
    };
    expect(edit((s) => (s.workpapers.find((w: any) => w.id === wp.id).data_json.statement_p = '5'))).toThrow(/Unreview/);
    expect(edit((s) => s.signoffs.push({ ...s.signoffs[0], id: 'sig_x', user_id: prep.id }))).toThrow(GuardError);
    expect(edit((s) => (s.signoffs = s.signoffs.filter((x: any) => x.workpaper_id !== wp.id)))).toThrow(GuardError);
  });
});

describe('changes and versions', () => {
  it('lists each changed field with its old and new value', () => {
    expect(diffData({ statement_p: '100', bank_name: 'A', sections: [{ rows: [{ amount_p: '5' }] }] }, { statement_p: '120', bank_name: 'A', sections: [{ rows: [{ amount_p: '7' }] }] })).toEqual([
      { field: 'statement_p', before: '100', after: '120' },
      { field: 'sections.0.rows.0.amount_p', before: '5', after: '7' },
    ]);
  });
});

describe('@mentions and My work (REV-03, REV-04)', () => {
  it('finds tagged colleagues by name in a comment', () => {
    expect(mentionsIn('Can @Sarah Jenkins check this? cc @David', FIRM)).toEqual(['usr_test_reviewer', 'usr_test_partner']);
  });

  it('My work lists assigned papers, mentions, review points, changes after my review and journals to approve', () => {
    const wp = reconciledBank();
    wp.assignee_id = rev.id;
    wp.due_date = '2020-01-01';
    db.comments.push({ id: 'c_m', workpaper_id: wp.id, type: 'comment', anchor_json: {}, status: 'open', created_by: prep.id, created_by_name: prep.name, created_at: '2026-10-02T00:00:00Z', resolved_by: null, body: '@Sarah Jenkins please look', mentions: [rev.id] } as any);
    signOff(prep, wp.id, 'prepare');
    signOff(rev, wp.id, 'review');
    unreview(partner, wp.id, 'Partner wants another look');
    const items = myWork({ ...rev });
    const kinds = items.map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(['assigned', 'mention', 'changed_after_review']));
    expect(items.find((i) => i.kind === 'assigned')!.overdue).toBe(true);
    expect(myWork(prep).some((i) => i.kind === 'journal_to_approve')).toBe(false); // preparers don't approve
  });
});
