// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({
  syncIn: async () => {},
  syncOut: async () => {},
  currentVersion: () => 1,
  hasDatabase: () => false,
}));

import { db } from '../lib/server/db';
import { ensureCredentials } from '../lib/server/credentials';
import { hashPassword, createChallengeToken, createTrustedToken, createSessionToken, verifySessionToken, MFA_COOKIE, SESSION_COOKIE, TRUSTED_COOKIE } from '../lib/server/auth';
import { generateBackupCodes } from '../lib/server/totp';
import { createPasswordReset, resetPassword } from '../lib/server/invites';
import { POST as login } from '../app/api/v1/auth/login/route';
import { POST as verify } from '../app/api/v1/auth/mfa/verify/route';
import { POST as regenerate } from '../app/api/v1/account/backup-codes/route';

const FIRM = 'firm_blynt_uk';
const UID = 'usr_test_preparer';
const EMAIL = 'marcus.vance@blynt.co.uk';
const PW = 'Granite!Ledger42';
const admin = { id: 'usr_admin', name: 'Admin', role: 'admin' as const, firmId: FIRM };
const cred = () => db.credentials.find((c) => c.user_id === UID)!;
const user = () => db.users.find((u) => u.id === UID)!;

const post = (url: string, body: object, cookie = '') =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
const signIn = (cookie = '', password = PW) => login(post('/api/v1/auth/login', { email: EMAIL, password }, cookie));
const submitCode = (code: string, remember = false) => verify(post('/api/v1/auth/mfa/verify', { code, remember }, `${MFA_COOKIE}=${createChallengeToken(UID)}`));
const trusted = (uid = UID, v = 0) => `${TRUSTED_COOKIE}=${createTrustedToken(uid, v)}`;

beforeEach(() => {
  db.seed(true);
  ensureCredentials();
  process.env.MFA_REQUIRED = 'true';
  cred().password_hash = hashPassword(PW);
  cred().mfa_secret = 'JBSWY3DPEHPK3PXP';
  cred().mfa_trust_version = 0;
  user().mfa_enabled = true;
});
afterEach(() => {
  process.env.MFA_REQUIRED = 'false';
  vi.useRealTimers();
});

describe('remember this device', () => {
  it('skips only the code: the password is still required', async () => {
    expect((await (await signIn(trusted())).json()).mfa).toBeUndefined();
    expect((await signIn(trusted(), 'wrong-password')).status).toBe(401);
    expect((await (await signIn()).json()).mfa).toBe('verify');
    expect(db.audit_logs.some((a) => a.action === 'LOGIN' && JSON.stringify(a.after_json).includes('trusted_device'))).toBe(true);
  });

  it('is refused for another user, a forged token, an expired one and after a password reset', async () => {
    expect((await (await signIn(trusted('usr_admin'))).json()).mfa).toBe('verify');
    expect((await (await signIn(`${TRUSTED_COOKIE}=${createSessionToken(UID)}`)).json()).mfa).toBe('verify');

    const cookie = trusted();
    vi.useFakeTimers({ now: Date.now() + 31 * 86400_000 });
    expect((await (await signIn(cookie)).json()).mfa).toBe('verify');
    vi.useRealTimers();

    const { token } = createPasswordReset(admin, UID);
    resetPassword(token, PW);
    expect((await (await signIn(cookie)).json()).mfa).toBe('verify');
  });

  it('cannot be used as a session, and is only issued when asked for', async () => {
    expect(verifySessionToken(createTrustedToken(UID, 0))).toBeNull();
    const { codes, hashes } = generateBackupCodes();
    cred().mfa_backup_hashes = hashes;
    const without = await submitCode(codes[0]);
    expect(without.headers.getSetCookie().some((c) => c.startsWith(TRUSTED_COOKIE))).toBe(false);
    const withIt = await submitCode(codes[1], true);
    const set = withIt.headers.getSetCookie().find((c) => c.startsWith(TRUSTED_COOKIE))!;
    expect(set).toContain('Path=/api/v1/auth/login');
    expect(set).toContain('HttpOnly');
  });
});

describe('backup codes', () => {
  it('each works once, and formatting does not matter', async () => {
    const { codes, hashes } = generateBackupCodes();
    expect(new Set(codes).size).toBe(10);
    expect(hashes).not.toContain(codes[0]);
    cred().mfa_backup_hashes = hashes;
    const res = await submitCode(` ${codes[0].toUpperCase().replace('-', ' ')} `);
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((c) => c.startsWith(SESSION_COOKIE))).toBe(true);
    expect(cred().mfa_backup_hashes).toHaveLength(9);
    expect((await submitCode(codes[0])).status).toBe(401);
    expect(db.audit_logs.some((a) => JSON.stringify(a.after_json).includes('password+backup_code'))).toBe(true);
  });

  it('new set-up returns codes once and revokes remembered devices; a backup code cannot complete set-up', async () => {
    const { codes, hashes } = generateBackupCodes();
    cred().mfa_backup_hashes = hashes;
    delete cred().mfa_secret;
    user().mfa_enabled = false;
    cred().mfa_pending_secret = 'JBSWY3DPEHPK3PXP';
    expect((await submitCode(codes[0])).status).toBe(401);

    const { totpCode } = await import('../lib/server/totp');
    const body = await (await submitCode(totpCode('JBSWY3DPEHPK3PXP'))).json();
    expect(body.backup_codes).toHaveLength(10);
    expect(cred().mfa_trust_version).toBe(1);
    expect(JSON.stringify(body)).not.toContain(cred().mfa_backup_hashes![0]);
  });

  it('regenerating replaces the old codes and needs a signed-in, enrolled user', async () => {
    const old = generateBackupCodes();
    cred().mfa_backup_hashes = old.hashes;
    const session = `${SESSION_COOKIE}=${createSessionToken(UID)}`;
    expect((await regenerate(post('/api/v1/account/backup-codes', {}))).status).toBe(401);
    const { backup_codes } = await (await regenerate(post('/api/v1/account/backup-codes', {}, session))).json();
    expect(backup_codes).toHaveLength(10);
    expect((await submitCode(old.codes[0])).status).toBe(401);
    expect((await submitCode(backup_codes[0])).status).toBe(200);

    user().mfa_enabled = false;
    expect((await regenerate(post('/api/v1/account/backup-codes', {}, session))).status).toBe(409);
  });
});
