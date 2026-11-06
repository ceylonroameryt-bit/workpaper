import { db } from './db';
import { ServiceError } from './services';
import { Actor, visibleClientIds } from './state-guard';
import { evaluatePaper, levelsFor, paperStatus } from '../workpapers/engine';
export { levelsFor };
import { paperFingerprint } from '../workpapers/diff';
export { mentionsIn } from '../mentions';
import { Signoff, UserRole, Workpaper } from '../types/models';

/**
 * Sign-off workflow (REV-01, REV-02, AUD-02) and My work (REV-03, REV-04). Prepared, Reviewed
 * and Approved in order, by role, at the practice's (or client's) number of levels. A reviewed
 * paper is read-only until someone unreviews it with a reason. Every tick and unreview keeps a
 * version and goes in the audit log.
 */

type Action = 'prepare' | 'review' | 'approve';
const ROLE_OF: Record<Action, Signoff['role']> = { prepare: 'preparer', review: 'reviewer', approve: 'partner' };
const LABEL: Record<Action, string> = { prepare: 'Prepared', review: 'Reviewed', approve: 'Approved' };
const LEVEL: Record<Action, number> = { prepare: 1, review: 2, approve: 3 };
const MAY: Record<Action, UserRole[]> = {
  prepare: ['preparer', 'reviewer', 'manager', 'partner', 'admin'],
  review: ['reviewer', 'manager', 'partner', 'admin'],
  approve: ['partner', 'admin'],
};

const live = (wpId: string) => db.signoffs.filter((s) => s.workpaper_id === wpId && !s.stale_at);

function paperFor(actor: Actor, wpId: string) {
  const wp = db.workpapers.find((w) => w.id === wpId);
  const eng = wp && db.engagements.find((e) => e.id === wp.engagement_id && e.firm_id === actor.firmId);
  if (!wp || !eng) throw new ServiceError('Workpaper not found', 404, 'NOT_FOUND');
  if (eng.status === 'locked') throw new ServiceError('This engagement is locked. Unlock it before signing.', 409, 'LOCKED');
  if (db.clients.find((c) => c.id === eng.client_id)?.archived_at) throw new ServiceError('This client is archived. Restore it before signing.', 409, 'ARCHIVED');
  return { wp, eng };
}

function keepVersion(actor: Actor, wp: Workpaper, reason: string, role?: Signoff['role']) {
  db.schedule_versions.push({
    id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    workpaper_id: wp.id,
    version_number: db.schedule_versions.filter((v) => v.workpaper_id === wp.id).length + 1,
    snapshot_data_json: JSON.parse(JSON.stringify(wp.data_json)),
    status: wp.status,
    role,
    created_by_user_id: actor.id,
    created_by_name: actor.name,
    reason,
    created_at: new Date().toISOString(),
  });
}

export function signOff(actor: Actor, wpId: string, action: Action): Signoff {
  const { wp } = paperFor(actor, wpId);
  if (!(action in ROLE_OF)) throw new ServiceError('Unknown sign-off.');
  const role = ROLE_OF[action];
  const levels = levelsFor(wp);
  if (LEVEL[action] > levels) throw new ServiceError(`This practice uses ${levels} sign-off level${levels === 1 ? '' : 's'}; ${LABEL[action]} is not needed.`, 409);
  if (!MAY[action].includes(actor.role)) {
    throw new ServiceError(action === 'approve' ? 'Only a partner or admin can approve.' : action === 'review' ? 'Only a reviewer, manager or partner can review.' : 'Your role cannot sign this paper.', 403, 'FORBIDDEN');
  }
  const ticks = live(wp.id);
  if (ticks.some((s) => s.role === role)) throw new ServiceError(`Already ${LABEL[action].toLowerCase()}.`, 409);
  if (ticks.some((s) => s.user_id === actor.id)) throw new ServiceError('The same person cannot sign two levels on one schedule.', 409);

  if (action === 'prepare') {
    const pending = db.procedures.filter((p) => p.workpaper_id === wp.id && !p.done_at && !p.not_applicable_reason).length;
    if (pending) throw new ServiceError(`${pending} procedure(s) still to do.`, 409);
    if (Number(wp.data_json.values_to_confirm_count || 0) > 0) throw new ServiceError('Confirm the AI values first (DAT-08).', 409);
    // Reconciled, or a paper with no difference to clear (checklists), or not applicable
    const hasDifference = evaluatePaper(wp)?.totals.difference !== undefined;
    if (wp.applicable !== false && hasDifference && paperStatus({ ...wp, status: 'in_progress' }) !== 'reconciled') {
      throw new ServiceError('The schedule must be Reconciled before it is prepared.', 409);
    }
  } else {
    if (!ticks.some((s) => s.role === 'preparer')) throw new ServiceError('The schedule must be prepared first.', 409);
    if (action === 'approve' && !ticks.some((s) => s.role === 'reviewer')) throw new ServiceError('The schedule must be reviewed first.', 409);
    const open = db.comments.filter((c) => c.workpaper_id === wp.id && c.type === 'review_note' && c.status === 'open').length;
    if (open) throw new ServiceError(`${open} open review point(s) must be cleared first (REV-03).`, 409);
  }

  const s: Signoff = {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    workpaper_id: wp.id,
    role,
    user_id: actor.id,
    user_name: actor.name,
    signed_at: new Date().toISOString(),
    content_hash: paperFingerprint(wp.data_json),
    stale_at: null,
  };
  db.signoffs.push(s);
  wp.status = action === 'prepare' ? 'prepared' : 'signed_off';
  if (action !== 'prepare') wp.data_json = { ...wp.data_json, changed_after_review: false };
  keepVersion(actor, wp, LABEL[action], role);
  db.logAudit(actor.firmId, actor, `SIGN_OFF_${LABEL[action].toUpperCase()}`, 'workpapers', wp.id, null, s);
  return s;
}

export function unreview(actor: Actor, wpId: string, reason: string) {
  const { wp } = paperFor(actor, wpId);
  const why = String(reason ?? '').trim();
  if (why.length < 10) throw new ServiceError('Give a reason of at least 10 characters to unreview.');
  const higher = live(wp.id).filter((s) => s.role !== 'preparer');
  if (!higher.length) throw new ServiceError('This schedule has not been reviewed.', 409);
  const at = new Date().toISOString();
  for (const s of higher) {
    s.stale_at = at;
    s.stale_reason = `Unreviewed by ${actor.name}: ${why}`.slice(0, 300);
  }
  wp.data_json = { ...wp.data_json, changed_after_review: true, last_unreview_reason: why, last_unreviewed_at: at, last_unreviewed_by: actor.name };
  wp.status = paperStatus({ ...wp, status: 'in_progress' });
  keepVersion(actor, wp, `Unreviewed: ${why}`);
  db.logAudit(actor.firmId, actor, 'UNREVIEW_WORKPAPER', 'workpapers', wp.id, { signoffs: higher.map((s) => s.id) }, { reason: why });
  return wp;
}

export interface WorkItem {
  kind: 'assigned' | 'mention' | 'review_point' | 'changed_after_review' | 'journal_to_approve';
  engagement_id: string;
  workpaper_id?: string;
  ref: string;
  detail: string;
  due?: string;
  overdue: boolean;
}

/** Everything waiting on this person, due dates first (REV-04). */
export function myWork(actor: Actor & { clientIds?: string[] | null }): WorkItem[] {
  const membership = db.memberships.find((m) => m.user_id === actor.id && m.firm_id === actor.firmId);
  const visible = actor.clientIds ?? visibleClientIds(membership as any);
  const engIds = new Set(db.engagements.filter((e) => e.firm_id === actor.firmId && (!visible || visible.includes(e.client_id))).map((e) => e.id));
  const papers = db.workpapers.filter((w) => engIds.has(w.engagement_id));
  const today = new Date().toISOString().slice(0, 10);
  const items: WorkItem[] = [];

  for (const wp of papers) {
    const ticks = live(wp.id);
    const done = ticks.some((s) => s.role === (levelsFor(wp) >= 3 ? 'partner' : levelsFor(wp) === 2 ? 'reviewer' : 'preparer'));
    if (wp.assignee_id === actor.id && !done) {
      items.push({ kind: 'assigned', engagement_id: wp.engagement_id, workpaper_id: wp.id, ref: wp.ref, detail: 'Assigned to you', due: wp.due_date ?? undefined, overdue: Boolean(wp.due_date && wp.due_date < today) });
    }
    const mine = wp.assignee_id === actor.id || ticks.some((s) => s.role === 'preparer' && s.user_id === actor.id);
    for (const c of db.comments.filter((x) => x.workpaper_id === wp.id && x.status === 'open')) {
      if (c.mentions?.includes(actor.id)) items.push({ kind: 'mention', engagement_id: wp.engagement_id, workpaper_id: wp.id, ref: wp.ref, detail: `${c.created_by_name}: ${c.body.slice(0, 120)}`, overdue: false });
      else if (c.type === 'review_note' && mine && c.created_by !== actor.id) items.push({ kind: 'review_point', engagement_id: wp.engagement_id, workpaper_id: wp.id, ref: wp.ref, detail: `Review point from ${c.created_by_name}: ${c.body.slice(0, 120)}`, overdue: false });
    }
    const myStaleReview = db.signoffs.some((s) => s.workpaper_id === wp.id && s.user_id === actor.id && s.role !== 'preparer' && s.stale_at);
    if (myStaleReview && wp.data_json.changed_after_review) {
      items.push({ kind: 'changed_after_review', engagement_id: wp.engagement_id, workpaper_id: wp.id, ref: wp.ref, detail: `Changed after your review: ${wp.data_json.last_unreview_reason ?? ''}`, overdue: false });
    }
  }
  if (['reviewer', 'manager', 'partner', 'admin'].includes(actor.role)) {
    for (const j of db.adjustments.filter((a) => engIds.has(a.engagement_id) && (a.status === 'accepted' || a.status === 'proposed') && a.proposed_by !== actor.id)) {
      items.push({ kind: 'journal_to_approve', engagement_id: j.engagement_id, ref: j.ref, detail: `${j.status === 'proposed' ? 'Draft' : 'To approve'}: ${j.narrative}`, overdue: false });
    }
  }
  return items.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
}
