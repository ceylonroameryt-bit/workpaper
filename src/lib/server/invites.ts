import crypto from 'crypto';
import { db } from './db';
import { hashPassword } from './auth';
import { ServiceError } from './services';
import { Actor } from './state-guard';
import { canSetUpPractice } from './onboarding';
import { Invite, UserRole } from '../types/models';
import { passwordError } from '../validation';

/**
 * ADM-01 user invites. An admin or partner invites by email with a role and, below
 * partner, the clients the person may see. The raw token goes only into the invite
 * link; the server keeps its SHA-256.
 */

const INVITE_TTL_DAYS = 7;
const ROLES: UserRole[] = ['preparer', 'reviewer', 'manager', 'partner', 'admin'];
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function createInvite(
  actor: Actor,
  data: { email: string; name: string; role: UserRole; client_ids?: string[] }
): { invite: Omit<Invite, 'token_hash'>; token: string } {
  if (!canSetUpPractice(actor, db.firms.find((f) => f.id === actor.firmId))) throw new ServiceError('Only an admin or partner can invite users.', 403, 'FORBIDDEN');
  const email = String(data.email || '').trim().toLowerCase();
  const name = String(data.name || '').trim();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ServiceError('Enter a name and a valid email address.');
  if (!ROLES.includes(data.role)) throw new ServiceError('Choose a valid role.');
  if (data.role === 'admin' && actor.role !== 'admin') throw new ServiceError('Only an admin can invite another admin.', 403, 'FORBIDDEN');
  if (db.users.some((u) => u.email.toLowerCase() === email)) throw new ServiceError('A user with that email already exists.', 409, 'CONFLICT');

  // Partners and admins see every client; everyone else only what they are assigned
  // (no list = all clients, chosen explicitly by the inviter)
  let clientIds: string[] | undefined;
  if (data.role !== 'admin' && data.role !== 'partner' && Array.isArray(data.client_ids)) {
    clientIds = [...new Set(data.client_ids)];
    const firmClients = new Set(db.clients.filter((c) => c.firm_id === actor.firmId).map((c) => c.id));
    if (clientIds.some((id) => !firmClients.has(id))) throw new ServiceError('One of those clients is not in your practice.');
  }

  // A new invite to the same address replaces any earlier unaccepted one
  db.invites = db.invites.filter((i) => !(i.firm_id === actor.firmId && i.email === email && !i.accepted_at));

  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const invite: Invite = {
    id: `inv_${crypto.randomUUID()}`,
    firm_id: actor.firmId,
    email,
    name,
    role: data.role,
    client_ids: clientIds,
    token_hash: sha256(token),
    invited_by: actor.id,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + INVITE_TTL_DAYS * 86400_000).toISOString(),
    accepted_at: null,
  };
  db.invites.push(invite);
  const { token_hash: _h, ...safe } = invite;
  db.logAudit(actor.firmId, actor, 'INVITE_USER', 'invites', invite.id, null, safe);
  return { invite: safe, token };
}

function findOpenInvite(token: string): Invite {
  const hash = sha256(String(token || ''));
  const invite = db.invites.find((i) => i.token_hash === hash);
  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    throw new ServiceError('This invitation is invalid or has expired. Ask your practice admin for a new one.', 404, 'INVITE_INVALID');
  }
  return invite;
}

/** What the accept page may show before the person sets a password. */
export function describeInvite(token: string) {
  const i = findOpenInvite(token);
  const firm = db.firms.find((f) => f.id === i.firm_id);
  return { email: i.email, name: i.name, role: i.role, firm_name: firm?.name ?? '' };
}

/** Creates the user, membership and password. MFA is set up at their first sign-in. */
export function acceptInvite(token: string, password: string) {
  const invite = findOpenInvite(token);
  const badPassword = passwordError(String(password || ''), { email: invite.email, name: invite.name });
  if (badPassword) throw new ServiceError(badPassword);
  if (db.users.some((u) => u.email.toLowerCase() === invite.email)) throw new ServiceError('A user with that email already exists.', 409, 'CONFLICT');

  const user = {
    id: `usr_${crypto.randomUUID()}`,
    email: invite.email,
    name: invite.name,
    initials: invite.name.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
    title: invite.role[0].toUpperCase() + invite.role.slice(1),
    mfa_enabled: false,
  };
  db.users.push(user);
  db.memberships.push({ user_id: user.id, firm_id: invite.firm_id, role: invite.role, ...(invite.client_ids ? { client_ids: invite.client_ids } : {}) });
  db.credentials.push({ user_id: user.id, password_hash: hashPassword(password) });
  invite.accepted_at = new Date().toISOString();
  db.logAudit(invite.firm_id, { id: user.id, name: user.name, role: invite.role }, 'ACCEPT_INVITE', 'invites', invite.id, { accepted_at: null }, { accepted_at: invite.accepted_at, user_id: user.id });
  return user;
}

/** Changes which clients a non-partner member may see. */
export function setClientAssignments(actor: Actor, userId: string, clientIds: string[]) {
  if (!canSetUpPractice(actor, db.firms.find((f) => f.id === actor.firmId))) throw new ServiceError('Only an admin or partner can change client access.', 403, 'FORBIDDEN');
  const m = db.memberships.find((x) => x.user_id === userId && x.firm_id === actor.firmId);
  if (!m) throw new ServiceError('User not found', 404, 'NOT_FOUND');
  const firmClients = new Set(db.clients.filter((c) => c.firm_id === actor.firmId).map((c) => c.id));
  const next = [...new Set(clientIds)].filter((id) => firmClients.has(id));
  const before = { client_ids: m.client_ids ?? null };
  m.client_ids = next;
  db.logAudit(actor.firmId, actor, 'SET_CLIENT_ACCESS', 'memberships', userId, before, { client_ids: next });
  return m;
}
