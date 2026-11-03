import { db } from './db';
import { ServiceError, services } from './services';
import { Actor } from './state-guard';
import { toPence } from '../money';
export { registerTotals } from '../workpapers/engine';
import { Adjustment, AdjustmentLine } from '../types/models';

/**
 * Journals (JNL-01, JNL-02 framework, JNL-04). Manual journals count in the adjusted TB as
 * soon as they're saved; proposals from schedules or the AI stay in Draft until accepted.
 * Approved journals are never deleted, only reversed. Only the server writes journals.
 */

export const JOURNAL_TYPES = ['adjusting', 'reclassification', 'client_posted', 'proposed_by_ai'] as const;

const dayAfter = (d: string) => new Date(new Date(`${d}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

function openEngagement(actor: Actor, engagementId: string) {
  const eng = db.engagements.find((e) => e.id === engagementId && e.firm_id === actor.firmId);
  if (!eng) throw new ServiceError('Engagement not found', 404, 'NOT_FOUND');
  if (eng.status === 'locked') throw new ServiceError('This engagement is locked. Unlock it before changing journals.', 409, 'LOCKED');
  return eng;
}

function findJournal(actor: Actor, id: string) {
  const j = db.adjustments.find((a) => a.id === id);
  const eng = j && db.engagements.find((e) => e.id === j.engagement_id && e.firm_id === actor.firmId);
  if (!j || !eng) throw new ServiceError('Journal not found', 404, 'NOT_FOUND');
  return { j, eng };
}

const nextRef = (engagementId: string) => `AJE-${String(db.adjustments.filter((a) => a.engagement_id === engagementId).length + 1).padStart(3, '0')}`;

export function createJournal(actor: Actor, engagementId: string, d: any): Adjustment {
  const eng = openEngagement(actor, engagementId);
  if (!JOURNAL_TYPES.includes(d?.type)) throw new ServiceError('Choose a journal type.');
  const narrative = String(d.narrative ?? '').trim().slice(0, 500);
  if (!narrative) throw new ServiceError('Enter a narrative for the journal.');
  const date = String(d.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < eng.period_start || date > eng.period_end) {
    throw new ServiceError(`The journal date must be inside the period (${eng.period_start} to ${eng.period_end}).`);
  }
  const raw: any[] = Array.isArray(d.lines) ? d.lines : [];
  if (raw.length < 2) throw new ServiceError('A journal needs at least two lines.');
  const codes = new Set(db.blynt_accounts.map((a) => a.code));
  let dr = 0n;
  let cr = 0n;
  const id = `aje_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const lines: AdjustmentLine[] = raw.map((l, i) => {
    if (!codes.has(l.blynt_code)) throw new ServiceError(`Line ${i + 1}: choose an account from the chart.`);
    const debit = toPence(String(l.debit_p || '0'));
    const credit = toPence(String(l.credit_p || '0'));
    if (debit < 0n || credit < 0n || (debit > 0n && credit > 0n)) throw new ServiceError(`Line ${i + 1}: enter a debit or a credit, not both.`);
    dr += debit;
    cr += credit;
    return { id: `${id}_l${i + 1}`, adjustment_id: id, blynt_code: l.blynt_code, debit_p: debit.toString(), credit_p: credit.toString(), narrative: String(l.narrative ?? '').slice(0, 200) };
  });
  if (dr !== cr || dr === 0n) throw new ServiceError(`The journal must balance: debits ${dr} and credits ${cr} (pence).`);

  const proposal = d.type === 'proposed_by_ai' || Boolean(d.source_schedule);
  const j: Adjustment = {
    id,
    engagement_id: engagementId,
    ref: nextRef(engagementId),
    type: d.type,
    date,
    narrative,
    status: proposal ? 'proposed' : 'accepted',
    proposed_by: actor.id,
    proposed_by_name: actor.name,
    approved_by: null,
    created_at: new Date().toISOString(),
    lines,
    source_schedule: d.source_schedule ? String(d.source_schedule).slice(0, 20) : undefined,
    calculation: d.calculation ? String(d.calculation).slice(0, 1000) : undefined,
    evidence: Array.isArray(d.evidence) ? d.evidence.filter((e: any) => db.uploads.some((u) => u.file_key === e?.file_key && u.firm_id === actor.firmId)).map((e: any) => ({ file_key: e.file_key, filename: String(e.filename ?? 'file').slice(0, 200) })) : [],
    auto_reverse: Boolean(d.auto_reverse),
  };
  db.adjustments.push(j);
  db.logAudit(actor.firmId, actor, 'CREATE_JOURNAL', 'adjustments', j.id, null, j);
  return j;
}

/** A journal with every line's debit and credit swapped. */
function reversal(actor: Actor, j: Adjustment, engagementId: string, date: string): Adjustment {
  const id = `aje_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    ...j,
    id,
    engagement_id: engagementId,
    ref: nextRef(engagementId),
    date,
    narrative: `Reversal of ${j.ref}: ${j.narrative}`.slice(0, 500),
    status: 'accepted',
    proposed_by: actor.id,
    proposed_by_name: actor.name,
    approved_by: null,
    approved_by_name: null,
    created_at: new Date().toISOString(),
    lines: j.lines.map((l, i) => ({ ...l, id: `${id}_l${i + 1}`, adjustment_id: id, debit_p: l.credit_p, credit_p: l.debit_p })),
    auto_reverse: false,
    reverses_id: j.id,
    evidence: j.evidence,
  };
}

export function journalAction(actor: Actor, id: string, d: { action?: string; reason?: string }): Adjustment {
  const { j, eng } = findJournal(actor, id);
  openEngagement(actor, eng.id);
  const before = { ...j };
  const log = (action: string, extra: Record<string, unknown> = {}) => db.logAudit(actor.firmId, actor, action, 'adjustments', j.id, before, { ...j, ...extra });

  switch (d.action) {
    case 'accept':
      if (j.status !== 'proposed') throw new ServiceError('Only a draft proposal can be accepted.', 409);
      j.status = 'accepted';
      log('ACCEPT_JOURNAL');
      return j;
    case 'reject': {
      if (j.status !== 'proposed') throw new ServiceError('Only a draft proposal can be rejected.', 409);
      const reason = String(d.reason ?? '').trim();
      if (!reason) throw new ServiceError('Give a reason for rejecting the proposal.');
      j.status = 'rejected';
      j.reject_reason = reason.slice(0, 500);
      log('REJECT_JOURNAL', { reason });
      return j;
    }
    case 'approve':
      if (j.status !== 'proposed' && j.status !== 'accepted') throw new ServiceError('Only a draft or accepted journal can be approved.', 409);
      // Role and "not your own journal" checks, audited, live in the existing approval
      return services.approveAdjustment(actor.firmId, actor, j.id);
    case 'reverse': {
      if (j.status !== 'approved' && j.status !== 'posted') throw new ServiceError('Only an approved journal can be reversed.', 409);
      const r = reversal(actor, j, j.engagement_id, j.date ?? eng.period_end);
      db.adjustments.push(r);
      j.status = 'reversed';
      j.reversed_by_id = r.id;
      log('REVERSE_JOURNAL', { reversal_id: r.id });
      db.logAudit(actor.firmId, actor, 'CREATE_JOURNAL', 'adjustments', r.id, null, r);
      return r;
    }
    default:
      throw new ServiceError('Unknown journal action.');
  }
}

export function deleteJournal(actor: Actor, id: string) {
  const { j, eng } = findJournal(actor, id);
  openEngagement(actor, eng.id);
  if (!['proposed', 'accepted', 'rejected'].includes(j.status)) throw new ServiceError('An approved journal cannot be deleted. Reverse it instead.', 409);
  db.adjustments = db.adjustments.filter((a) => a.id !== j.id);
  db.logAudit(actor.firmId, actor, 'DELETE_JOURNAL', 'adjustments', j.id, j, null);
}

/**
 * Auto-reverse (JNL-04): approved journals marked auto-reverse in the period that ends the day
 * before this engagement starts are reversed here, dated its first day. Safe to call twice.
 */
export function autoReverseInto(engagementId: string): Adjustment[] {
  const eng = db.engagements.find((e) => e.id === engagementId);
  if (!eng) return [];
  const prior = db.engagements.filter((e) => e.client_id === eng.client_id && e.id !== eng.id && dayAfter(e.period_end) === eng.period_start);
  const done = new Set(db.adjustments.filter((a) => a.engagement_id === eng.id).map((a) => a.reverses_id));
  const actor = { id: 'system', name: 'Auto-reverse', role: 'admin' as const, firmId: eng.firm_id };
  const made: Adjustment[] = [];
  for (const j of db.adjustments.filter((a) => prior.some((p) => p.id === a.engagement_id) && a.auto_reverse && (a.status === 'approved' || a.status === 'posted'))) {
    if (done.has(j.id)) continue;
    const r = reversal(actor, j, eng.id, eng.period_start);
    db.adjustments.push(r);
    db.logAudit(eng.firm_id, actor, 'AUTO_REVERSE_JOURNAL', 'adjustments', r.id, null, r);
    made.push(r);
  }
  return made;
}
