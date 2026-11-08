// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({
  syncIn: async () => {},
  syncOut: async () => {},
  currentVersion: () => 1,
  hasDatabase: () => false,
}));

import { db } from '../lib/server/db';
import { listStaff, updateStaff } from '../lib/server/staff';
import { updateClientProfile } from '../lib/server/client-profile';
import { acceptInvite, cancelInvite, createInvite } from '../lib/server/invites';
import { createSessionToken, SESSION_COOKIE, hashPassword } from '../lib/server/auth';
import { getActorFromRequest } from '../lib/server/api-helpers';
import { POST as login } from '../app/api/v1/auth/login/route';

const FIRM = 'firm_blynt_uk';
const admin = { id: 'usr_admin', name: 'Admin', role: 'admin' as const, firmId: FIRM };
const member = () => db.memberships.find((m) => m.firm_id === FIRM && m.user_id !== 'usr_admin' && m.role === 'preparer')!;

beforeEach(() => {
  db.seed(true);
  process.env.MFA_REQUIRED = 'false';
});

describe('staff management', () => {
  it('lists the practice’s staff with role, status, access, client count and last login', () => {
    const m = member();
    m.client_ids = [db.clients.find((c) => c.firm_id === FIRM)!.id];
    db.logAudit(FIRM, admin, 'LOGIN', 'users', m.user_id, null, { method: 'password' });
    const row = listStaff(admin).find((r) => r.id === m.user_id)!;
    expect(row).toMatchObject({ role: 'preparer', status: 'active', access: 'limited', client_count: 1 });
    expect(row.last_login_at).toBeTruthy();
    expect(listStaff(admin).every((r) => !('password_hash' in r))).toBe(true);
  });

  it('an admin changes role, name and client access; all clients clears the list', () => {
    const m = member();
    const firstClient = db.clients.find((c) => c.firm_id === FIRM)!.id;
    updateStaff(admin, m.user_id, { name: 'Renamed Person', role: 'reviewer', client_ids: [firstClient, 'cli_other_firm'] });
    expect(m).toMatchObject({ role: 'reviewer', client_ids: [firstClient] });
    expect(db.users.find((u) => u.id === m.user_id)!.name).toBe('Renamed Person');
    updateStaff(admin, m.user_id, { client_ids: null });
    expect(m.client_ids).toBeUndefined();
  });

  it('only admins and partners can edit staff; nobody can change their own role or deactivate themselves', () => {
    const m = member();
    const preparer = { id: m.user_id, name: 'P', role: 'preparer' as const, firmId: FIRM };
    expect(() => updateStaff(preparer, 'usr_admin', { role: 'preparer' })).toThrow(/admin or partner/);
    expect(() => updateStaff(admin, 'usr_admin', { status: 'deactivated' })).toThrow(/yourself/);
    expect(() => updateStaff(admin, 'usr_admin', { role: 'preparer' })).toThrow(/yourself/);
    expect(() => updateStaff(admin, m.user_id, { role: 'boss' })).toThrow(/role/);
  });

  it('a deactivated person cannot sign in and their open session stops working', async () => {
    const m = member();
    const user = db.users.find((u) => u.id === m.user_id)!;
    const cred = db.credentials.find((c) => c.user_id === user.id);
    if (cred) cred.password_hash = hashPassword('Long-Password-1!');
    else db.credentials.push({ user_id: user.id, password_hash: hashPassword('Long-Password-1!') });
    const session = new Request('http://localhost/x', { headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(user.id)}` } });
    expect(getActorFromRequest(session).id).toBe(user.id);

    updateStaff(admin, user.id, { status: 'deactivated' });
    expect(() => getActorFromRequest(session)).toThrow(/no longer has access/);
    const res = await login(new Request('http://localhost/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'Long-Password-1!' }) }));
    expect(res.status).toBe(403);

    updateStaff(admin, user.id, { status: 'active' });
    expect(getActorFromRequest(session).id).toBe(user.id);
  });
});

describe('which clients staff work on', () => {
  const clientOf = (i: number) => db.clients.filter((c) => c.firm_id === FIRM)[i];
  const profile = (actor: any, id: string, extra: object) => updateClientProfile(actor, id, { company_type: clientOf(0).company_type, ...extra });

  it('ticking someone with limited access gives them the client; unticking takes it away', () => {
    const m = member();
    const client = clientOf(0);
    m.client_ids = [];
    profile(admin, client.id, { team_user_ids: [m.user_id] });
    expect(m.client_ids).toEqual([client.id]);
    profile(admin, client.id, { team_user_ids: [] });
    expect(m.client_ids).toEqual([]);
  });

  it('someone who can see every client is not limited by being ticked', () => {
    const m = member();
    delete m.client_ids;
    profile(admin, clientOf(0).id, { team_user_ids: [m.user_id] });
    expect(m.client_ids).toBeUndefined();
  });

  it('only an admin or partner can give access by ticking', () => {
    const m = member();
    m.client_ids = [];
    const manager = { id: 'usr_mgr', name: 'M', role: 'manager' as const, firmId: FIRM };
    profile(manager, clientOf(0).id, { team_user_ids: [m.user_id] });
    expect(m.client_ids).toEqual([]);
  });

  it('choosing clients on a person updates those clients’ teams', () => {
    const m = member();
    const [a, b] = [clientOf(0), clientOf(1)];
    m.client_ids = [a.id];
    a.team_user_ids = [m.user_id];
    updateStaff(admin, m.user_id, { client_ids: [b.id] });
    expect(a.team_user_ids).not.toContain(m.user_id);
    expect(b.team_user_ids).toContain(m.user_id);
  });

  it('an invited person joins the ticked client when they accept, and an invitation can be cancelled', () => {
    const client = clientOf(0);
    const { invite, token } = createInvite(admin, { email: 'new.person@example.com', name: 'New Person', role: 'preparer', client_ids: [] });
    profile(admin, client.id, { team_invite_ids: [invite.id] });
    const user = acceptInvite(token, 'Long-Unique-Passphrase-42!');
    expect(client.team_user_ids).toContain(user.id);
    expect(db.memberships.find((m) => m.user_id === user.id)!.client_ids).toEqual([client.id]);

    const other = createInvite(admin, { email: 'other.person@example.com', name: 'Other Person', role: 'preparer' });
    const preparer = { id: member().user_id, name: 'P', role: 'preparer' as const, firmId: FIRM };
    expect(() => cancelInvite(preparer, other.invite.id)).toThrow(/admin or partner/);
    cancelInvite(admin, other.invite.id);
    expect(db.invites.some((i) => i.id === other.invite.id)).toBe(false);
  });
});

describe('readonly role', () => {
  it('a readonly member can read but every write is refused', () => {
    const m = member();
    updateStaff(admin, m.user_id, { role: 'readonly' });
    const cookie = `${SESSION_COOKIE}=${createSessionToken(m.user_id)}`;
    const read = new Request('http://localhost/api/v1/clients', { headers: { cookie } });
    expect(getActorFromRequest(read).role).toBe('readonly');
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(() => getActorFromRequest(new Request('http://localhost/api/v1/state', { method, headers: { cookie } }))).toThrow(/read-only/);
    }
  });
});
