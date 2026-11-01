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
