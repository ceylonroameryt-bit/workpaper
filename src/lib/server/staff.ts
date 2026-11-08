import { db } from './db';
import { ServiceError } from './services';
import { Actor } from './state-guard';
import { canSetUpPractice } from './onboarding';
import { UserRole } from '../types/models';

/**
 * Staff management (ADM-01): who is in the practice, their role, whether they can sign in, which
 * clients they see, and when they last signed in (from the audit log's LOGIN entries).
 */

const ROLES: UserRole[] = ['readonly', 'preparer', 'reviewer', 'manager', 'partner', 'admin'];

export function listStaff(actor: Actor) {
  const lastLogin = new Map<string, string>();
  for (const a of db.audit_logs) {
    if (a.action === 'LOGIN' && a.firm_id === actor.firmId && a.at > (lastLogin.get(a.entity_id) ?? '')) lastLogin.set(a.entity_id, a.at);
  }
  return db.memberships
    .filter((m) => m.firm_id === actor.firmId)
    .map((m) => {
      const u = db.users.find((x) => x.id === m.user_id);
      return {
        id: m.user_id,
        name: u?.name ?? '',
        email: u?.email ?? '',
        initials: u?.initials ?? '',
        role: m.role,
        status: m.status ?? 'active',
        // Partners and admins always see every client (see visibleClientIds)
        access: m.client_ids && !['partner', 'admin'].includes(m.role) ? ('limited' as const) : ('all' as const),
        client_ids: m.client_ids ?? null,
        client_count: m.client_ids && !['partner', 'admin'].includes(m.role) ? m.client_ids.length : db.clients.filter((c) => c.firm_id === actor.firmId && !c.archived_at).length,
        mfa_enabled: Boolean(u?.mfa_enabled),
        last_login_at: lastLogin.get(m.user_id) ?? null,
      };
    });
}

const toggled = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));

/**
 * A client's team and who can open the client stay together: adding someone with limited access
 * gives them this client, and taking them off removes it. Only an admin or partner can change
 * access, so anyone else's edit changes the team alone.
 */
export function syncTeamAccess(actor: Actor, clientId: string, before: string[], after: string[], inviteIds?: unknown) {
  if (!canSetUpPractice(actor, db.firms.find((f) => f.id === actor.firmId))) return;
  for (const m of db.memberships) {
    if (m.firm_id !== actor.firmId || !m.client_ids || ['partner', 'admin'].includes(m.role)) continue;
    const on = after.includes(m.user_id);
    if (on === before.includes(m.user_id)) continue;
    const was = { client_ids: m.client_ids };
    m.client_ids = toggled(m.client_ids, clientId, on);
    db.logAudit(actor.firmId, actor, 'SET_CLIENT_ACCESS', 'memberships', m.user_id, was, { client_ids: m.client_ids });
  }
  if (!Array.isArray(inviteIds)) return;
  for (const i of db.invites) {
    if (i.firm_id !== actor.firmId || i.accepted_at) continue;
    const on = inviteIds.includes(i.id);
    i.team_client_ids = toggled(i.team_client_ids ?? [], clientId, on);
    if (i.client_ids) i.client_ids = toggled(i.client_ids, clientId, on);
  }
}

export function updateStaff(actor: Actor, userId: string, d: { name?: unknown; role?: unknown; status?: unknown; client_ids?: unknown }) {
  if (!canSetUpPractice(actor, db.firms.find((f) => f.id === actor.firmId))) throw new ServiceError('Only an admin or partner can change staff.', 403, 'FORBIDDEN');
  const m = db.memberships.find((x) => x.user_id === userId && x.firm_id === actor.firmId);
  const user = db.users.find((u) => u.id === userId);
  if (!m || !user) throw new ServiceError('User not found', 404, 'NOT_FOUND');
  if (d.role !== undefined && !ROLES.includes(d.role as UserRole)) throw new ServiceError('Choose a role.');
  if (userId === actor.id && ((d.role !== undefined && d.role !== m.role) || d.status === 'deactivated')) {
    throw new ServiceError('You can’t change your own role or deactivate yourself.', 409, 'SELF');
  }
  if (d.role !== undefined && !ROLES.includes(d.role as UserRole)) throw new ServiceError('Choose a role.');
  if (d.status !== undefined && d.status !== 'active' && d.status !== 'deactivated') throw new ServiceError('Choose a status.');

  const before = { name: user.name, role: m.role, status: m.status ?? 'active', client_ids: m.client_ids ?? null };
  if (typeof d.name === 'string' && d.name.trim()) user.name = d.name.trim().slice(0, 100);
  if (d.role !== undefined) m.role = d.role as UserRole;
  if (d.status !== undefined) m.status = d.status as 'active' | 'deactivated';
  if (d.client_ids === null) delete m.client_ids;
  else if (Array.isArray(d.client_ids)) {
    const firmClients = db.clients.filter((c) => c.firm_id === actor.firmId);
    const previous = m.client_ids;
    const next = [...new Set(d.client_ids as string[])].filter((id) => firmClients.some((c) => c.id === id));
    m.client_ids = next;
    for (const c of firmClients) {
      // Adding a client puts them on its team; without access they can't stay on one
      if (!next.includes(c.id)) c.team_user_ids = c.team_user_ids?.filter((u) => u !== userId);
      else if (!previous?.includes(c.id)) c.team_user_ids = toggled(c.team_user_ids ?? [], userId, true);
    }
  }
  db.logAudit(actor.firmId, actor, 'UPDATE_STAFF', 'memberships', userId, before, {
    name: user.name,
    role: m.role,
    status: m.status ?? 'active',
    client_ids: m.client_ids ?? null,
  });
  return listStaff(actor).find((r) => r.id === userId)!;
}
