// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({
  syncIn: async () => {},
  syncOut: async () => {},
  currentVersion: () => 1,
  hasDatabase: () => false,
}));

import { db } from '../lib/server/db';
import { createPasswordReset, resetPassword } from '../lib/server/invites';
import { verifyPassword } from '../lib/server/auth';
import { ensureCredentials } from '../lib/server/credentials';

const FIRM = 'firm_blynt_uk';
const admin = { id: 'usr_admin', name: 'Admin', role: 'admin' as const, firmId: FIRM };
const preparer = { id: 'usr_test_preparer', name: 'Marcus', role: 'preparer' as const, firmId: FIRM };
const NEW_PW = 'Granite!Ledger42';

beforeEach(() => {
  db.seed(true);
  ensureCredentials();
});

describe('admin-issued password reset link', () => {
  it('sets a new password once, and the link then stops working', () => {
    const { token } = createPasswordReset(admin, 'usr_test_preparer');
    const cred = db.credentials.find((c) => c.user_id === 'usr_test_preparer')!;
    expect(cred.reset_token_hash).not.toBe(token); // only the hash is stored

    expect(resetPassword(token, NEW_PW).email).toBe('marcus.vance@blynt.co.uk');
    expect(verifyPassword(NEW_PW, cred.password_hash)).toBe(true);
    expect(() => resetPassword(token, NEW_PW)).toThrow(/invalid or has expired/);
    expect(db.audit_logs.some((a) => a.action === 'RESET_PASSWORD' && a.entity_id === 'usr_test_preparer')).toBe(true);
  });

  it('applies the sign-up password rules and rejects expired links', () => {
    const { token } = createPasswordReset(admin, 'usr_test_preparer');
    expect(() => resetPassword(token, 'short1!A')).toThrow(/12 characters/);
    db.credentials.find((c) => c.user_id === 'usr_test_preparer')!.reset_expires_at = new Date(Date.now() - 1000).toISOString();
    expect(() => resetPassword(token, NEW_PW)).toThrow(/invalid or has expired/);
  });

  it('only an admin or partner of the same practice can create a link', () => {
    expect(() => createPasswordReset(preparer, 'usr_test_reviewer')).toThrow(/admin or partner/);
    expect(() => createPasswordReset({ ...admin, firmId: 'firm_other' }, 'usr_test_preparer')).toThrow();
  });
});
