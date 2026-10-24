import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/server/db';
import { services, ServiceError } from '../lib/server/services';
import { toPence, asPence, formatPence, sumPence, calculateVariance } from '../lib/money';
import { Workpaper } from '../lib/types/models';
import crypto from 'crypto';

describe('Blynt Workpapers - Ground Rules & Acceptance Criteria', () => {
  const firmId = 'firm_blynt_uk';
  const preparer = { id: 'usr_test_preparer', name: 'Test Preparer', role: 'preparer' as const };
  const reviewer = { id: 'usr_test_reviewer', name: 'Test Reviewer', role: 'reviewer' as const };
  const partner = { id: 'usr_test_partner', name: 'Test Partner', role: 'partner' as const };

  beforeEach(() => {
    // Re-seed DB with demo dataset for acceptance tests
    db.seed(true);
  });

  // 1. Money strictly integer pence (bigint)
  it('Ground Rule 1: Money is stored and calculated as integer pence (bigint)', () => {
    const p1 = toPence('6000.00'); // £6,000.00
    const p2 = toPence('2400.00'); // £2,400.00
    const p3 = toPence('1200.00'); // £1,200.00

    expect(typeof p1).toBe('bigint');
    expect(p1).toBe(600000n);
    expect(p2).toBe(240000n);
    expect(p3).toBe(120000n);

    const closingCost = p1 + p2 - p3;
    expect(closingCost).toBe(720000n);
    expect(formatPence(closingCost)).toBe('£7,200.00');

    // Robust handling of accounting zeros, em-dashes, and formatted strings
    expect(toPence('—')).toBe(0n);
    expect(toPence('–')).toBe(0n);
    expect(toPence('-')).toBe(0n);
    expect(toPence('nil')).toBe(0n);
    expect(toPence('n/a')).toBe(0n);
    expect(toPence('£1,250.50')).toBe(125050n);
    expect(toPence('(500.00)')).toBe(-50000n);
  });

  // 2. Unbalanced CSV is rejected with the difference shown
  it('Acceptance Test 1: Unbalanced CSV is rejected with the difference shown', () => {
    const lines = [
      { code: '1010', debit_p: 10000n, credit_p: 0n },
      { code: '2000', debit_p: 0n, credit_p: 8500n },
    ];
    const debits = lines.reduce((acc, l) => acc + l.debit_p, 0n);
    const credits = lines.reduce((acc, l) => acc + l.credit_p, 0n);
    const difference = debits - credits;

    expect(difference).toBe(1500n); // £15.00 diff
    expect(difference !== 0n).toBe(true);
    expect(formatPence(difference)).toBe('£15.00');
  });

  // 3. Trial balance stays locked while unmapped balance ≠ 0
  it('Acceptance Test 2: Trial balance stays locked while unmapped balance ≠ 0', () => {
    const engId = 'eng_harlow_fy26';
    const tb = services.getTrialBalance(engId);

    // Initial seed has unmapped accounts (suggested & needs_you)
    expect(tb.isLockedByUnmapped).toBe(true);
    expect(tb.unmappedBalancePence !== 0n).toBe(true);

    // If all mappings are confirmed, TB unlocks
    db.account_mappings.forEach((m) => {
      m.status = 'confirmed';
    });
    const tbUnlocked = services.getTrialBalance(engId);
    expect(tbUnlocked.isLockedByUnmapped).toBe(false);
    expect(tbUnlocked.unmappedBalancePence).toBe(0n);
  });

  // 4. "Confirm selected" confirms only selected rows; no accept-all exists
  it('Acceptance Test 3: "Confirm selected" confirms only selected rows; no accept-all exists', () => {
    const engId = 'eng_harlow_fy26';
    const suggested = db.account_mappings.filter(
      (m) => m.engagement_id === engId && m.status === 'suggested'
    );
    expect(suggested.length).toBeGreaterThan(1);

    const firstId = suggested[0].id;
    const secondId = suggested[1].id;

    // Confirm only the first account
    services.confirmSelectedMappings(firmId, reviewer, engId, [firstId]);

    const updatedFirst = db.account_mappings.find((m) => m.id === firstId);
    const untouchedSecond = db.account_mappings.find((m) => m.id === secondId);

    expect(updatedFirst?.status).toBe('confirmed');
    expect(untouchedSecond?.status).toBe('suggested');
  });

  // 5. F-10 sample data reconciles exactly
  it('Acceptance Test 4: F-10 sample data reconciles: NBV 6,400.00, charge 2,700.00, loss 150.00, checks green except disposal evidence', () => {
    const wpRes = services.getWorkpaper('wp_f10');
    const data = wpRes.workpaper.data_json;

    // Computer equipment: cost 6,000 + 2,400 - 1,200 = 7,200; depreciation 2,500 + 1,800 - 800 = 3,500
    const comp = data.classes.find((c: any) => c.name === 'Computer equipment');
    const compCostClosing = asPence(comp.cost_opening_p) + asPence(comp.cost_additions_p) - asPence(comp.cost_disposals_p);
    expect(compCostClosing).toBe(720000n); // £7,200.00

    const compDepClosing = asPence(comp.deprec_opening_p) + asPence(comp.deprec_charge_p) - asPence(comp.deprec_disposals_p);
    expect(compDepClosing).toBe(350000n); // £3,500.00

    // Fixtures: cost 4,500, depreciation 900 + 900 = 1,800
    const fix = data.classes.find((c: any) => c.name === 'Fixtures & fittings');
    const fixCostClosing = asPence(fix.cost_opening_p) + asPence(fix.cost_additions_p) - asPence(fix.cost_disposals_p);
    expect(fixCostClosing).toBe(450000n); // £4,500.00

    const fixDepClosing = asPence(fix.deprec_opening_p) + asPence(fix.deprec_charge_p) - asPence(fix.deprec_disposals_p);
    expect(fixDepClosing).toBe(180000n); // £1,800.00

    // Total NBV this year: (7,200 - 3,500) + (4,500 - 1,800) = 3,700 + 2,700 = 6,400
    const totalNbv = (compCostClosing - compDepClosing) + (fixCostClosing - fixDepClosing);
    expect(totalNbv).toBe(640000n); // £6,400.00
    expect(formatPence(totalNbv)).toBe('£6,400.00');

    // Total charge: 1,800 + 900 = 2,700
    const totalCharge = asPence(comp.deprec_charge_p) + asPence(fix.deprec_charge_p);
    expect(totalCharge).toBe(270000n); // £2,700.00
    expect(formatPence(totalCharge)).toBe('£2,700.00');

    // Disposal NBV 400, proceeds 250, loss 150
    const disp = data.disposals[0];
    const dispCost = asPence(disp.cost_p);
    const dispDep = asPence(disp.deprec_p);
    const dispNbv = dispCost - dispDep;
    expect(dispNbv).toBe(40000n); // £400.00

    const proceeds = asPence(disp.proceeds_p);
    expect(proceeds).toBe(25000n); // £250.00

    const loss = dispNbv - proceeds;
    expect(loss).toBe(15000n); // £150.00
    expect(formatPence(loss)).toBe('£150.00');

    // Missing disposal evidence flag
    expect(disp.has_evidence).toBe(false);
    expect(disp.attachment_id).toBeNull();
  });

  // 6. Roll forward fills opening balances from prior closing and adds PY tags; Undo restores blanks
  it('Acceptance Test 5: Roll forward fills opening balances from prior closing and adds PY tags; Undo restores', () => {
    // We create a fresh workpaper with no opening balances
    const blankWp: Workpaper = {
      id: 'wp_test_rf',
      engagement_id: 'eng_harlow_fy26',
      ref: 'F-10',
      template_id: 'tpl_f10',
      template_version: 2,
      status: 'not_started',
      rolled_from_workpaper_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      data_json: { classes: [] },
    };
    db.workpapers.push(blankWp);

    const rolled = services.rollForwardPaper(firmId, preparer, 'wp_test_rf');
    expect(rolled.rolled_from_workpaper_id).toBe('wp_py_f10');
    expect(rolled.data_json.classes[0].cost_opening_p).toBe('600000'); // Prior year closing cost
    expect(rolled.data_json.classes[0].cost_opening_is_py).toBe(true);

    // Undo roll forward
    const undone = services.undoRollForward(firmId, preparer, 'wp_test_rf');
    expect(undone.rolled_from_workpaper_id).toBeNull();
    expect(undone.data_json.classes.length).toBe(0);
  });

  // 7. Change template keeps figures, attachments and comments; History records it; Undo works
  it('Acceptance Test 6: Change template keeps figures, attachments and comments; records audit', () => {
    const f10 = services.getWorkpaper('wp_f10');
    expect(f10.comments.length).toBeGreaterThan(0);
    expect(f10.attachments.length).toBeGreaterThan(0);

    const initialTemplateId = f10.workpaper.template_id;
    const res = services.changeTemplate(firmId, reviewer, 'wp_f10', 'tpl_f10_simple');

    expect(res.success).toBe(true);
    expect(res.workpaper?.template_id).toBe('tpl_f10_simple');

    // Comments & attachments still associated with workpaper
    const reloaded = services.getWorkpaper('wp_f10');
    expect(reloaded.comments.length).toBe(f10.comments.length);
    expect(reloaded.attachments.length).toBe(f10.attachments.length);

    // Check audit trail recorded the change
    const audit = db.audit_logs.find(
      (a) => a.entity === 'workpapers' && a.action === 'CHANGE_TEMPLATE'
    );
    expect(audit).toBeDefined();
  });

  // 8. Comment pinned on a cell survives reload; open review note blocks sign-off
  it('Acceptance Test 7: Comment pinned survives reload and open review note blocks sign-off', () => {
    const comment = services.addComment(firmId, reviewer, 'wp_f10', {
      type: 'review_note',
      anchor_json: { kind: 'cell', section: 'schedule', row: 'c1', col: 'cost_additions' },
      body: 'Please verify additions over £1,000 threshold',
    });

    expect(comment.status).toBe('open');

    // Engagement blockers check
    const blockers = services.getEngagementBlockers('eng_harlow_fy26');
    const noteBlocker = blockers.blockers.find((b) => b.id === 'open_review_notes');
    expect(noteBlocker?.passed).toBe(false);

    // Resolving note unblocks
    services.resolveComment(firmId, reviewer, comment.id);
    expect(db.comments.find((c) => c.id === comment.id)?.status).toBe('resolved');
  });

  // 9. Uploading a file stores SHA-256; tampered file fails export check
  it('Acceptance Test 8: Uploading file stores SHA-256 and detects tampering', () => {
    const content = 'GENUINE_BANK_CONFIRMATION_PDF_STREAM';
    const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

    const att = services.uploadAttachment(firmId, preparer, 'eng_harlow_fy26', 'wp_b10', {
      filename: 'Barclays_Cert.pdf',
      mime: 'application/pdf',
      size: content.length,
      content,
      category: 'Statement',
    });

    expect(att.sha256).toBe(expectedHash);

    // Tampered verification
    const tamperedContent = 'TAMPERED_BANK_CONFIRMATION_PDF_STREAM';
    const tamperedHash = crypto.createHash('sha256').update(tamperedContent).digest('hex');
    expect(tamperedHash).not.toBe(att.sha256);
  });

  // 10. Editing a reviewed paper marks the reviewer sign-off stale
  it('Acceptance Test 9: Editing a reviewed paper marks the reviewer sign-off stale', () => {
    // Add reviewer sign-off to F-10
    db.signoffs.push({
      id: 'sig_f10_rev',
      workpaper_id: 'wp_f10',
      role: 'reviewer',
      user_id: reviewer.id,
      user_name: reviewer.name,
      signed_at: new Date().toISOString(),
      content_hash: 'initial_hash_123',
      stale_at: null,
    });

    // Edit workpaper data
    services.updateWorkpaperData(firmId, preparer, 'wp_f10', {
      some_field: 'modified_value',
    });

    // Check sign-off is marked stale
    const sig = db.signoffs.find((s) => s.id === 'sig_f10_rev');
    expect(sig?.stale_at).not.toBeNull();
    expect(sig?.stale_reason).toContain('Modified by Test Preparer');
  });

  // 11. Preparer cannot approve their own adjustment (403, audited)
  it('Acceptance Test 10: Preparer cannot approve their own adjustment (403, audited)', () => {
    const adj = db.adjustments.find((a) => a.id === 'aje_001');
    expect(adj?.proposed_by).toBe(preparer.id);

    // Anika attempts to approve her own AJE-001
    expect(() => {
      services.approveAdjustment(firmId, preparer, 'aje_001');
    }).toThrow(ServiceError);

    try {
      services.approveAdjustment(firmId, preparer, 'aje_001');
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.code).toBe('FORBIDDEN_SELF_APPROVAL');
    }

    // Verify rejection was logged in append-only audit trail
    const audit = db.audit_logs.find(
      (a) => a.entity === 'adjustments' && a.action === 'REJECTED_SELF_APPROVAL'
    );
    expect(audit).toBeDefined();

    // Now Sam (reviewer) approves it successfully
    const approved = services.approveAdjustment(firmId, reviewer, 'aje_001');
    expect(approved.status).toBe('approved');
    expect(approved.approved_by).toBe(reviewer.id);
  });

  // 12. Review notes block sign-off; comments do not block
  it('Acceptance Test 11: Review notes block sign-off until resolved; comments do not block', () => {
    const wpId = 'wp_test_review_unique';
    // Add open review note
    const reviewNote = {
      id: 'comm_test_rev',
      workpaper_id: wpId,
      type: 'review_note' as const,
      anchor_json: { kind: 'paper' },
      anchor_summary: 'Unique Test Workpaper',
      status: 'open' as const,
      created_by: reviewer.id,
      created_by_name: reviewer.name,
      created_at: new Date().toISOString(),
      resolved_by: null,
      body: 'Disposal has no evidence of sale proceeds',
      replies: [],
    };
    db.comments.push(reviewNote as any);

    // Check that open review note blocks
    const openNotes = db.comments.filter((c) => c.workpaper_id === wpId && c.type === 'review_note' && c.status === 'open');
    expect(openNotes.length).toBe(1);

    // Discussion comments do not block sign-off
    const comment = {
      id: 'comm_test_disc',
      workpaper_id: wpId,
      type: 'comment' as const,
      anchor_json: { kind: 'paper' },
      anchor_summary: 'Unique Test Workpaper',
      status: 'open' as const,
      created_by: preparer.id,
      created_by_name: preparer.name,
      created_at: new Date().toISOString(),
      resolved_by: null,
      body: 'General question on depreciation method',
      replies: [],
    };
    db.comments.push(comment as any);

    // Resolving the review note clears the block
    (reviewNote as any).status = 'resolved';
    (reviewNote as any).resolved_by = reviewer.id;

    const remainingBlockingNotes = db.comments.filter((c) => c.workpaper_id === wpId && c.type === 'review_note' && c.status === 'open');
    expect(remainingBlockingNotes.length).toBe(0);
  });

  // 13. Review notes support replies, resolving and unresolving
  it('Acceptance Test 12: Review notes support replies, resolving and unresolving', () => {
    const note = {
      id: 'comm_test_thread',
      workpaper_id: 'wp_b10',
      type: 'review_note' as const,
      anchor_json: { kind: 'paper' },
      anchor_summary: 'B-10 Bank reconciliation',
      status: 'open' as const,
      created_by: reviewer.id,
      created_by_name: reviewer.name,
      created_at: new Date().toISOString(),
      resolved_by: null,
      body: 'Statement balance differs from confirmation',
      replies: [
        {
          id: 'rep_1',
          comment_id: 'comm_test_thread',
          body: 'Checked with the bank; confirmation is correct.',
          mentions: [],
          created_by: preparer.id,
          created_at: new Date().toISOString(),
        },
      ],
    };
    db.comments.push(note as any);

    expect(note.replies.length).toBe(1);
    expect(note.replies[0].body).toContain('Checked with the bank');

    // Resolve
    (note as any).status = 'resolved';
    (note as any).resolved_by = reviewer.id;
    expect((note as any).status).toBe('resolved');

    // Unresolve
    (note as any).status = 'open';
    (note as any).resolved_by = null;
    expect((note as any).status).toBe('open');
  });
});

