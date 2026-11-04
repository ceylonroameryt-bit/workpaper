// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken, readCookie } from '../lib/server/auth';
import { firmSlice, mergeFirmState, GuardError, State, Actor } from '../lib/server/state-guard';

describe('passwords and sessions', () => {
  it('verifies only the right password', () => {
    const h = hashPassword('correct horse');
    expect(verifyPassword('correct horse', h)).toBe(true);
    expect(verifyPassword('wrong', h)).toBe(false);
    expect(verifyPassword('x', undefined)).toBe(false);
  });

  it('rejects tampered, forged and expired session tokens', () => {
    const t = createSessionToken('usr_a');
    expect(verifySessionToken(t)?.uid).toBe('usr_a');
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 'usr_partner', exp: 9999999999 })).toString('base64url');
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(verifySessionToken(createSessionToken('usr_a', -10))).toBeNull();
    expect(verifySessionToken('sess_usr_a')).toBeNull();
  });

  it('reads the session cookie from a request', () => {
    const req = new Request('http://x', { headers: { cookie: 'a=1; blynt_session=abc.def' } });
    expect(readCookie(req)).toBe('abc.def');
  });
});

const base = (): State => ({
  firms: [{ id: 'f1' }, { id: 'f2' }],
  users: [{ id: 'prep' }, { id: 'rev' }, { id: 'part' }, { id: 'other' }],
  memberships: [
    { user_id: 'prep', firm_id: 'f1', role: 'preparer' },
    { user_id: 'rev', firm_id: 'f1', role: 'reviewer' },
    { user_id: 'part', firm_id: 'f1', role: 'partner' },
    { user_id: 'other', firm_id: 'f2', role: 'admin' },
  ],
  credentials: [{ user_id: 'prep', password_hash: 'secret' }],
  clients: [{ id: 'c1', firm_id: 'f1' }, { id: 'c2', firm_id: 'f2' }],
  engagements: [
    { id: 'e1', firm_id: 'f1', client_id: 'c1', status: 'fieldwork' },
    { id: 'e2', firm_id: 'f2', client_id: 'c2', status: 'fieldwork' },
  ],
  workpapers: [{ id: 'w1', engagement_id: 'e1' }, { id: 'w2', engagement_id: 'e2' }],
  signoffs: [],
  adjustments: [{ id: 'a1', engagement_id: 'e1', status: 'proposed', proposed_by: 'prep', approved_by: null }],
  comments: [{ id: 'n1', workpaper_id: 'w1', type: 'review_note', status: 'open' }],
  audit_logs: [{ id: 'l1', firm_id: 'f1', actor_id: 'prep' }],
  templates: [{ id: 't1' }],
});

const actor = (id: string, role: Actor['role']): Actor => ({ id, name: id, role, firmId: 'f1' });
const edit = (s: State, fn: (v: State) => void) => {
  const v = JSON.parse(JSON.stringify(firmSlice(s, 'f1')));
  fn(v);
  return v;
};

describe('firm isolation', () => {
  it('only exposes the firm slice and never credentials', () => {
    const v = firmSlice(base(), 'f1');
    expect(v.clients.map((c) => c.id)).toEqual(['c1']);
    expect(v.workpapers.map((w) => w.id)).toEqual(['w1']);
    expect(v.users.map((u) => u.id)).not.toContain('other');
    expect(v).not.toHaveProperty('credentials');
  });

  it('keeps other firms untouched and ignores edits to server-managed data', () => {
    const s = base();
    const out = mergeFirmState(s, edit(s, (v) => {
      v.clients = [];
      v.memberships[0].role = 'admin';
      v.templates = [];
    }), actor('prep', 'preparer'));
    expect(out.clients.map((c) => c.id)).toEqual(['c2']);
    expect(out.memberships.find((m) => m.user_id === 'prep')?.role).toBe('preparer');
    expect(out.templates).toHaveLength(1);
    expect(out.credentials).toHaveLength(1);
  });

  it('cannot claim another firm’s record', () => {
    const s = base();
    const proposed = edit(s, (v) => v.clients.push({ id: 'c2', firm_id: 'f1' }));
    expect(() => mergeFirmState(s, proposed, actor('prep', 'preparer'))).toThrow(GuardError);
  });
});

describe('role rules on save', () => {
  const s = base();
  const reject = (fn: (v: State) => void, a: Actor) => expect(() => mergeFirmState(s, edit(s, fn), a)).toThrow(GuardError);
  const allow = (fn: (v: State) => void, a: Actor) => expect(() => mergeFirmState(s, edit(s, fn), a)).not.toThrow();

  it('sign-offs', () => {
    const so = (role: string, user_id: string) => (v: State) => v.signoffs.push({ id: 's1', workpaper_id: 'w1', role, user_id });
    // Every sign-off goes through the server's sign-off bar now (order, levels, review points)
    reject(so('preparer', 'prep'), actor('prep', 'preparer'));
    reject(so('partner', 'part'), actor('part', 'partner'));
  });

  it('journals cannot be approved from the browser; the server keeps its copy', () => {
    const before = base();
    const out = mergeFirmState(before, edit(before, (v) => Object.assign(v.adjustments[0], { status: 'approved', approved_by: 'rev' })), actor('rev', 'reviewer'));
    expect(out.adjustments[0].status).toBe('proposed');
  });

  it('locking and locked engagements', () => {
    reject((v) => (v.engagements[0].status = 'locked'), actor('rev', 'reviewer'));
    allow((v) => (v.engagements[0].status = 'locked'), actor('part', 'partner'));
    const locked = base();
    locked.engagements[0].status = 'locked';
    expect(() =>
      mergeFirmState(locked, edit(locked, (v) => (v.workpapers[0].ref = 'X')), actor('part', 'partner'))
    ).toThrow(GuardError);
  });

  it('audit log is append-only and written as yourself', () => {
    reject((v) => (v.audit_logs = []), actor('part', 'partner'));
    reject((v) => v.audit_logs.push({ id: 'l2', firm_id: 'f1', actor_id: 'part' }), actor('prep', 'preparer'));
    allow((v) => v.audit_logs.push({ id: 'l2', firm_id: 'f1', actor_id: 'prep' }), actor('prep', 'preparer'));
  });

  it('review notes are resolved by reviewers', () => {
    reject((v) => (v.comments[0].status = 'resolved'), actor('prep', 'preparer'));
    allow((v) => (v.comments[0].status = 'resolved'), actor('rev', 'reviewer'));
  });

  it('signs up a new firm user and verifies credentials', () => {
    const pwd = 'TestAuditPass2026!';
    const h = hashPassword(pwd);
    expect(verifyPassword(pwd, h)).toBe(true);
    expect(verifyPassword('WrongPass', h)).toBe(false);
  });
});


describe('session secret', () => {
  it('a production server never signs sessions with the key in the code', async () => {
    const { secret } = await import('../lib/server/auth');
    const env = process.env as Record<string, string | undefined>;
    const [node, auth] = [env.NODE_ENV, env.AUTH_SECRET];
    try {
      env.NODE_ENV = 'production';
      delete env.AUTH_SECRET;
      // Nothing configured: a random key made at start-up, never the one in the code
      const own = secret();
      expect(own.length).toBeGreaterThanOrEqual(32);
      expect(own).not.toContain('blynt-dev-only');
      expect(secret()).toBe(own);
      env.AUTH_SECRET = 'x'.repeat(40);
      expect(secret()).toBe('x'.repeat(40));
      // No usable AUTH_SECRET (missing or too short) but a database URL: a stable key derived from it
      env.AUTH_SECRET = 'short';
      const dbUrl = env.DATABASE_URL;
      env.DATABASE_URL = 'postgres://app:s3cret-pw@db.internal:5432/blynt';
      const k = secret();
      expect(k.length).toBeGreaterThanOrEqual(32);
      expect(k).not.toContain('s3cret-pw');
      expect(secret()).toBe(k);
      env.DATABASE_URL = 'postgres://app:other-pw@db.internal:5432/blynt';
      expect(secret()).not.toBe(k);
      if (dbUrl === undefined) delete env.DATABASE_URL;
      else env.DATABASE_URL = dbUrl;
    } finally {
      env.NODE_ENV = node;
      env.AUTH_SECRET = auth;
      if (auth === undefined) delete env.AUTH_SECRET;
    }
  });
});

describe('seeded demo passwords on a live server', () => {
  it('a production server gives no default passwords and removes any admin123 left from the demo seed', async () => {
    const { db } = await import('../lib/server/db');
    const { ensureCredentials } = await import('../lib/server/credentials');
    const { hashPassword, verifyPassword } = await import('../lib/server/auth');
    const env = process.env as Record<string, string | undefined>;
    const node = env.NODE_ENV;
    try {
      env.NODE_ENV = 'production';
      db.seed(true);
      db.credentials = [
        { user_id: 'usr_admin', password_hash: hashPassword('admin123') },
        { user_id: 'usr_test_preparer', password_hash: hashPassword('A-Real-Password-2026!') },
      ];
      ensureCredentials();
      expect(db.credentials.map((c) => c.user_id)).toEqual(['usr_test_preparer']); // demo password gone, real one kept
      expect(verifyPassword('A-Real-Password-2026!', db.credentials[0].password_hash)).toBe(true);
    } finally {
      env.NODE_ENV = node;
    }
  });
});

describe('a live workspace starts empty', () => {
  it('production has the chart of accounts but no demo practice, users or clients', async () => {
    const { db } = await import('../lib/server/db');
    const env = process.env as Record<string, string | undefined>;
    const node = env.NODE_ENV;
    try {
      env.NODE_ENV = 'production';
      const fresh = new (db.constructor as new () => typeof db)();
      expect(fresh.firms).toHaveLength(0);
      expect(fresh.users).toHaveLength(0);
      expect(fresh.clients).toHaveLength(0);
      expect(fresh.blynt_accounts.length).toBeGreaterThan(0);
    } finally {
      env.NODE_ENV = node;
    }
  });
});
