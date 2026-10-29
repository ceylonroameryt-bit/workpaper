import { UserRole } from '../types/models';

/**
 * Firm isolation and role rules for the whole-workspace sync (/api/v1/state).
 * The browser only ever sees its own firm's slice, and a save may only change that
 * slice, within what the signed-in user's role allows.
 */

type Row = Record<string, any>;
export type State = Record<string, Row[]>;

export interface Actor {
  id: string;
  name: string;
  role: UserRole;
  firmId: string;
  clientIds?: string[] | null;
}

export class GuardError extends Error {
  status = 403;
}

// Server-managed: a browser save never changes these
const SERVER_MANAGED = ['firms', 'users', 'memberships', 'credentials', 'invites', 'uploads', 'xero_connections', 'blynt_accounts', 'templates'];

const REVIEWER_UP: UserRole[] = ['reviewer', 'manager', 'partner', 'admin'];
const PARTNER_UP: UserRole[] = ['partner', 'admin'];
const MANAGER_UP: UserRole[] = ['manager', 'partner', 'admin'];

const rows = (s: State, k: string): Row[] => (Array.isArray(s?.[k]) ? s[k] : []);
const ids = (list: Row[], key = 'id') => new Set(list.map((r) => r[key]));
const keyOf = (k: string, r: Row) => (k === 'view_prefs' ? `${r.user_id}|${r.scope}|${r.key}` : k === 'attachment_links' ? `${r.attachment_id}|${JSON.stringify(r.anchor_json)}` : r.id);

/**
 * Clients a member may see: null means all of the firm's clients (admins and partners, or
 * members with no assignment list); otherwise only the clients they are assigned to.
 */
export function visibleClientIds(m: { role: UserRole; client_ids?: string[] } | undefined): string[] | null {
  if (!m || PARTNER_UP.includes(m.role) || !Array.isArray(m.client_ids)) return null;
  return m.client_ids;
}

/** The parts of the workspace that belong to one firm (users without credentials), narrowed to a user's assigned clients when given. */
export function firmSlice(state: State, firmId: string, userId?: string): State {
  const members = rows(state, 'memberships').filter((m) => m.firm_id === firmId);
  const userIds = ids(members, 'user_id');
  const assigned = userId ? visibleClientIds(members.find((m) => m.user_id === userId) as any) : null;
  const clients = rows(state, 'clients').filter((c) => c.firm_id === firmId && (!assigned || assigned.includes(c.id)));
  const engagements = rows(state, 'engagements').filter((e) => e.firm_id === firmId && (!assigned || assigned.includes(e.client_id)));
  const engIds = ids(engagements);
  const lists = rows(state, 'mapping_lists').filter((l) => l.firm_id === firmId);
  const listIds = ids(lists);
  const snapshots = rows(state, 'tb_snapshots').filter((s) => engIds.has(s.engagement_id));
  const snapIds = ids(snapshots);
  const workpapers = rows(state, 'workpapers').filter((w) => engIds.has(w.engagement_id));
  const wpIds = ids(workpapers);
  const attachments = rows(state, 'attachments').filter((a) => engIds.has(a.engagement_id));
  const attIds = ids(attachments);
  const adjustments = rows(state, 'adjustments').filter((a) => engIds.has(a.engagement_id));
  const mappings = rows(state, 'account_mappings').filter((m) => engIds.has(m.engagement_id));
  const comments = rows(state, 'comments').filter((c) => wpIds.has(c.workpaper_id));

  // Entities an AI lineage row may point at
  const entityIds = new Set([...engIds, ...wpIds, ...attIds, ...ids(adjustments), ...ids(mappings), ...ids(comments)]);

  return {
    firms: rows(state, 'firms').filter((f) => f.id === firmId),
    users: rows(state, 'users').filter((u) => userIds.has(u.id)),
    memberships: members,
    clients,
    engagements,
    blynt_accounts: rows(state, 'blynt_accounts'),
    templates: rows(state, 'templates'),
    mapping_lists: lists,
    mapping_rules: rows(state, 'mapping_rules').filter((r) => listIds.has(r.mapping_list_id)),
    tb_snapshots: snapshots,
    tb_lines: rows(state, 'tb_lines').filter((l) => snapIds.has(l.snapshot_id)),
    account_mappings: mappings,
    adjustments,
    workpapers,
    procedures: rows(state, 'procedures').filter((p) => wpIds.has(p.workpaper_id)),
    comments,
    attachments,
    attachment_links: rows(state, 'attachment_links').filter((l) => attIds.has(l.attachment_id)),
    signoffs: rows(state, 'signoffs').filter((s) => wpIds.has(s.workpaper_id)),
    view_prefs: rows(state, 'view_prefs').filter((v) => userIds.has(v.user_id)),
    audit_logs: rows(state, 'audit_logs').filter((a) => a.firm_id === firmId),
    ai_lineage: rows(state, 'ai_lineage').filter((a) => entityIds.has(a.entity_id)),
    learned_rules: rows(state, 'learned_rules').filter((r) => r.firm_id === firmId),
    ai_action_logs: rows(state, 'ai_action_logs').filter((a) => a.firm_id === firmId),
    ai_review_findings: rows(state, 'ai_review_findings').filter((f) => engIds.has(f.engagement_id)),
    schedule_versions: rows(state, 'schedule_versions').filter((v) => wpIds.has(v.workpaper_id)),
    checklist_items: rows(state, 'checklist_items').filter((c) => engIds.has(c.engagement_id)),
    statutory_notes: rows(state, 'statutory_notes').filter((n) => engIds.has(n.engagement_id)),
    transactions: rows(state, 'transactions').filter((t) => engIds.has(t.engagement_id)),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function changed(before: Row[], after: Row[], k: string) {
  const prev = new Map(before.map((r) => [keyOf(k, r), r]));
  const added: Row[] = [];
  const updated: { before: Row; after: Row }[] = [];
  for (const r of after) {
    const p = prev.get(keyOf(k, r));
    if (!p) added.push(r);
    else if (!same(p, r)) updated.push({ before: p, after: r });
  }
  const nextKeys = new Set(after.map((r) => keyOf(k, r)));
  const removed = before.filter((r) => !nextKeys.has(keyOf(k, r)));
  return { added, updated, removed };
}

function deny(msg: string): never {
  throw new GuardError(msg);
}

const signoffRolesFor = (role: UserRole): string[] =>
  PARTNER_UP.includes(role) ? ['preparer', 'reviewer', 'partner'] : REVIEWER_UP.includes(role) ? ['preparer', 'reviewer'] : ['preparer'];

/** Checks role rules between the firm's current slice and the browser's proposed slice. */
export function checkRules(before: State, after: State, actor: Actor) {
  // Audit log is append-only and new entries must be written as the signed-in user
  const audit = changed(rows(before, 'audit_logs'), rows(after, 'audit_logs'), 'audit_logs');
  if (audit.updated.length || audit.removed.length) deny('The audit log cannot be edited or deleted.');
  for (const a of audit.added) {
    if (a.actor_id !== actor.id) deny('Audit entries must be recorded as the signed-in user.');
  }

  // AUD-03: the AI action log decides when auto-accept is allowed, so it is append-only too
  const aiLog = changed(rows(before, 'ai_action_logs'), rows(after, 'ai_action_logs'), 'ai_action_logs');
  if (aiLog.updated.length || aiLog.removed.length) deny('The AI action log cannot be edited or deleted.');
  for (const a of aiLog.added) {
    if (a.decided_by !== actor.id) deny('AI decisions must be recorded as the signed-in user.');
  }

  // Locked engagements: only a partner or admin may lock or unlock, and nothing inside may change
  const eng = changed(rows(before, 'engagements'), rows(after, 'engagements'), 'engagements');
  for (const { before: b, after: a } of eng.updated) {
    if ((b.status === 'locked') !== (a.status === 'locked') && !PARTNER_UP.includes(actor.role)) {
      deny('Only an engagement partner or admin can lock or unlock an engagement.');
    }
  }
  if (eng.removed.length && !PARTNER_UP.includes(actor.role)) deny('Only a partner or admin can delete an engagement.');
  const stillLocked = new Set(
    rows(after, 'engagements').filter((e) => e.status === 'locked' && rows(before, 'engagements').some((b) => b.id === e.id && b.status === 'locked')).map((e) => e.id)
  );
  // Archived clients: archiving goes through the API (audited), and their files are read-only
  const cli = changed(rows(before, 'clients'), rows(after, 'clients'), 'clients');
  for (const { before: b, after: a } of cli.updated) {
    if ((b.archived_at ?? null) !== (a.archived_at ?? null)) deny('Archive or restore a client from the client list.');
  }
  const archivedClients = new Set(rows(before, 'clients').filter((c) => c.archived_at).map((c) => c.id));
  for (const e of rows(before, 'engagements')) if (archivedClients.has(e.client_id)) stillLocked.add(e.id);
  const wpEng = new Map([...rows(before, 'workpapers'), ...rows(after, 'workpapers')].map((w) => [w.id, w.engagement_id]));
  for (const k of ['workpapers', 'adjustments', 'account_mappings', 'tb_snapshots', 'signoffs', 'procedures', 'comments', 'transactions']) {
    const c = changed(rows(before, k), rows(after, k), k);
    for (const r of [...c.added, ...c.updated.map((u) => u.after), ...c.removed]) {
      const engId = r.engagement_id ?? wpEng.get(r.workpaper_id);
      if (engId && stillLocked.has(engId)) deny('This engagement is locked or its client is archived. Unlock or restore it before making changes.');
    }
  }

  // Sign-offs: only as yourself, only at a level your role allows
  const so = changed(rows(before, 'signoffs'), rows(after, 'signoffs'), 'signoffs');
  for (const s of so.added) {
    if (s.user_id !== actor.id) deny('You can only sign off as yourself.');
    if (!signoffRolesFor(actor.role).includes(s.role)) deny(`Your role (${actor.role}) cannot give a ${s.role} sign-off.`);
  }
  for (const { before: b, after: a } of so.updated) {
    // Marking a sign-off stale (because the paper changed) is allowed for anyone editing
    const { stale_at: _a, stale_reason: _b, ...restBefore } = b;
    const { stale_at: _c, stale_reason: _d, ...restAfter } = a;
    if (!same(restBefore, restAfter)) deny('A sign-off cannot be altered.');
  }
  for (const s of so.removed) {
    if (s.user_id !== actor.id && !PARTNER_UP.includes(actor.role)) deny('Only the signer or a partner can remove a sign-off.');
  }

  // Adjustments: proposed as yourself; approved/posted by a reviewer or above who did not propose it
  const adj = changed(rows(before, 'adjustments'), rows(after, 'adjustments'), 'adjustments');
  for (const a of adj.added) {
    if (a.proposed_by !== actor.id) deny('Adjustments must be proposed as the signed-in user.');
    if (a.status !== 'proposed') deny('New adjustments start as proposed.');
  }
  for (const { before: b, after: a } of adj.updated) {
    if (b.status !== a.status && (a.status === 'approved' || a.status === 'posted')) {
      if (!REVIEWER_UP.includes(actor.role)) deny('Only a reviewer or above may approve or post adjustments.');
      if (a.proposed_by === actor.id) deny('You cannot approve an adjustment you proposed.');
      if (a.status === 'approved' && a.approved_by !== actor.id) deny('Approvals must be recorded as the signed-in user.');
    }
  }

  // Review notes may only be resolved by a reviewer or above
  const com = changed(rows(before, 'comments'), rows(after, 'comments'), 'comments');
  for (const { before: b, after: a } of com.updated) {
    if (a.type === 'review_note' && b.status !== a.status && a.status === 'resolved' && !REVIEWER_UP.includes(actor.role)) {
      deny('Review notes may only be resolved by a reviewer or partner.');
    }
  }

  // DAT-09: a practice rule only runs once a manager or above has approved it
  const rules = changed(rows(before, 'learned_rules'), rows(after, 'learned_rules'), 'learned_rules');
  for (const r of [...rules.added, ...rules.updated.map((u) => u.after)]) {
    const prev = rules.updated.find((u) => u.after === r)?.before;
    const nowLive = r.scope === 'practice' && r.active && r.approved_by_manager;
    const wasLive = prev && prev.scope === 'practice' && prev.active && prev.approved_by_manager;
    if (nowLive && !wasLive && !MANAGER_UP.includes(actor.role)) deny('A practice rule needs a manager to approve it.');
  }

  // Mapping confirmations are recorded as the signed-in user
  const map = changed(rows(before, 'account_mappings'), rows(after, 'account_mappings'), 'account_mappings');
  for (const m of [...map.added, ...map.updated.map((u) => u.after)]) {
    const prev = map.updated.find((u) => u.after === m)?.before;
    if (m.status === 'confirmed' && prev?.status !== 'confirmed' && m.confirmed_by && m.confirmed_by !== actor.id) {
      deny('Mappings must be confirmed as the signed-in user.');
    }
  }
}

/**
 * Builds the new full workspace from a browser save: the actor's firm slice is replaced by
 * the proposed slice (after rule checks), everything else is left exactly as it was.
 */
export function mergeFirmState(full: State, proposed: State, actor: Actor): State {
  const before = firmSlice(full, actor.firmId, actor.id);

  // Pin firm ownership on top-level records and drop anything that points outside the firm
  const pinned: State = {};
  for (const k of Object.keys(before)) pinned[k] = rows(proposed, k).map((r) => ({ ...r }));
  for (const k of ['clients', 'engagements', 'mapping_lists', 'audit_logs']) {
    for (const r of pinned[k]) r.firm_id = actor.firmId;
  }
  for (const k of SERVER_MANAGED) pinned[k] = before[k] ?? [];

  // Records whose ids belong to another firm cannot be claimed
  for (const k of ['clients', 'engagements', 'mapping_lists']) {
    const mine = ids(before[k]);
    const taken = new Set(rows(full, k).filter((r) => !mine.has(r.id)).map((r) => r.id));
    if (pinned[k].some((r) => taken.has(r.id))) deny('That record belongs to another firm.');
  }
  const after = firmSlice(
    { ...pinned, memberships: before.memberships, users: before.users, firms: before.firms },
    actor.firmId,
    actor.id
  );

  checkRules(before, after, actor);

  // Replace the firm's rows, keep every other firm's rows untouched
  const out: State = {};
  const keys = new Set([...Object.keys(full), ...Object.keys(after)]);
  for (const k of keys) {
    if (SERVER_MANAGED.includes(k) || !(k in after)) {
      out[k] = rows(full, k);
      continue;
    }
    const mine = new Set(before[k].map((r) => keyOf(k, r)));
    const others = rows(full, k).filter((r) => !mine.has(keyOf(k, r)));
    out[k] = [...others, ...after[k]];
  }
  return out;
}

/** What the browser is allowed to see. */
export const publicSlice = (full: State, firmId: string, userId?: string) => firmSlice(full, firmId, userId);
