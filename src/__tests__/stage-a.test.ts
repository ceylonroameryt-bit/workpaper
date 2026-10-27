// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Routes run against the in-memory db only; nothing is written to disk or Postgres
vi.mock('@/lib/server/store', () => ({
  syncIn: async () => {},
  syncOut: async () => {},
  currentVersion: () => 1,
  hasDatabase: () => false,
}));

import { db } from '../lib/server/db';
import { services } from '../lib/server/services';
import { totpCode, verifyTotp, generateTotpSecret } from '../lib/server/totp';
import {
  createChallengeToken,
  verifySessionToken,
  hashPassword,
  SESSION_COOKIE,
  MFA_COOKIE,
} from '../lib/server/auth';
import { createInvite, acceptInvite } from '../lib/server/invites';
import { firmSlice, mergeFirmState, GuardError, State, Actor } from '../lib/server/state-guard';
import { requireEngagementAccess } from '../lib/server/api-helpers';
import { runGated, learnFromCorrection, accuracy } from '../lib/server/gate';
import { POST as login } from '../app/api/v1/auth/login/route';
import { POST as mfaVerify } from '../app/api/v1/auth/mfa/verify/route';
import { GET as mfaSetup } from '../app/api/v1/auth/mfa/setup/route';
import { POST as importTb } from '../app/api/v1/engagements/[id]/imports/route';
import { matchBlyntAccount } from '../lib/mapping/auto-mapper';

const FIRM = 'firm_blynt_uk';
const admin: Actor = { id: 'usr_admin', name: 'Dev Administrator', role: 'admin', firmId: FIRM };

const json = (url: string, body: unknown, cookie?: string) =>
  new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

/** "name=value" pairs from every Set-Cookie header, ready to send back. */
const cookiesFrom = (res: Response) =>
  (res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') || ''])
    .map((c) => c.split(';')[0])
    .filter((c) => c && !c.endsWith('='))
    .join('; ');

beforeEach(() => {
  db.seed(true);
  db.credentials = db.users.map((u) => ({ user_id: u.id, password_hash: hashPassword('admin123') }));
  process.env.MFA_REQUIRED = 'true'; // these tests cover the enforced flow
});

describe('Step 1 · A user can be invited, set up MFA, log in and see only their assigned clients', () => {
  it('TOTP codes verify within one step of drift and reject wrong codes', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    expect(verifyTotp(secret, totpCode(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 120_000), now)).toBe(false);
    expect(verifyTotp(secret, '000000x', now)).toBe(false);
  });

  it('a password-only MFA challenge is never accepted as a session', () => {
    expect(verifySessionToken(createChallengeToken('usr_admin'))).toBeNull();
  });

  it('rejects unknown emails and wrong passwords (no fallback accounts)', async () => {
    expect((await login(json('/api/v1/auth/login', { email: 'someone-admin@x.com', password: 'admin123' }))).status).toBe(401);
    expect((await login(json('/api/v1/auth/login', { email: 'admin@blynt.co.uk', password: 'password' }))).status).toBe(401);
  });

  it('invite → accept → password → MFA set-up → session, seeing only assigned clients', async () => {
    const { token } = createInvite(admin, { email: 'new.preparer@blynt.co.uk', name: 'New Preparer', role: 'preparer', client_ids: ['cli_harlow'] });
    acceptInvite(token, 'A-Long-Enough-Pass1!');
    expect(() => acceptInvite(token, 'A-Long-Enough-Pass1!')).toThrow(); // single use

    // Password step: no session yet, MFA set-up owed
    const r1 = await login(json('/api/v1/auth/login', { email: 'new.preparer@blynt.co.uk', password: 'A-Long-Enough-Pass1!' }));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ mfa: 'setup' });
    const challenge = cookiesFrom(r1);
    expect(challenge).toContain(`${MFA_COOKIE}=`);
    expect(challenge).not.toContain(`${SESSION_COOKIE}=`);

    const setup = await mfaSetup(new Request('http://localhost/api/v1/auth/mfa/setup', { headers: { cookie: challenge } }));
    const { secret } = await setup.json();

    expect((await mfaVerify(json('/api/v1/auth/mfa/verify', { code: '123456' === totpCode(secret) ? '654321' : '123456' }, challenge))).status).toBe(401);
    const ok = await mfaVerify(json('/api/v1/auth/mfa/verify', { code: totpCode(secret) }, challenge));
    expect(ok.status).toBe(200);
    const session = cookiesFrom(ok);
    expect(session).toContain(`${SESSION_COOKIE}=`);

    const user = db.users.find((u) => u.email === 'new.preparer@blynt.co.uk')!;
    expect(user.mfa_enabled).toBe(true);
    expect(db.audit_logs.some((a) => a.actor_id === user.id && a.action === 'MFA_ENROLLED')).toBe(true);

    // Only the assigned client and its engagements reach the browser
    const view = firmSlice(db.exportState() as State, FIRM, user.id);
    expect(view.clients.map((c) => c.id)).toEqual(['cli_harlow']);
    expect(view.engagements.every((e) => e.client_id === 'cli_harlow')).toBe(true);
    expect(view).not.toHaveProperty('credentials');
    expect(view).not.toHaveProperty('invites');

    // ...and the API refuses other clients' engagements
    const req = new Request('http://localhost/x', { headers: { cookie: session } });
    expect(() => requireEngagementAccess(req, 'eng_harlow_fy26')).not.toThrow();
    expect(() => requireEngagementAccess(req, 'eng_acme_fy26')).toThrow(/not found/i);

    // Next sign-in asks for the code, not set-up
    const r2 = await login(json('/api/v1/auth/login', { email: 'new.preparer@blynt.co.uk', password: 'A-Long-Enough-Pass1!' }));
    expect(await r2.json()).toEqual({ mfa: 'verify' });
  });

  it('only admins and partners can invite, and only admins can invite admins', () => {
    const preparer: Actor = { id: 'usr_test_preparer', name: 'P', role: 'preparer', firmId: FIRM };
    const partner: Actor = { id: 'usr_test_partner', name: 'D', role: 'partner', firmId: FIRM };
    expect(() => createInvite(preparer, { email: 'a@b.co', name: 'A', role: 'preparer' })).toThrow();
    expect(() => createInvite(partner, { email: 'a@b.co', name: 'A', role: 'admin' })).toThrow();
  });
});

describe('Step 1 · Any test write appears in the audit log and cannot be edited', () => {
  it('records who, role, when, old and new value, and reason; edits and deletes are refused', () => {
    const entry = db.logAudit(FIRM, admin, 'TEST_WRITE', 'clients', 'cli_harlow', { name: 'A' }, { name: 'B' }, 'test');
    expect(entry).toMatchObject({ actor_id: 'usr_admin', actor_role: 'admin', reason: 'test' });
    expect(JSON.parse(entry.before_json!)).toEqual({ name: 'A' });
    expect(() => {
      (entry as any).action = 'X';
    }).toThrow();

    const full = db.exportState() as State;
    const edit = (fn: (v: State) => void) => {
      const v = JSON.parse(JSON.stringify(firmSlice(full, FIRM, admin.id)));
      fn(v);
      return v;
    };
    expect(() => mergeFirmState(full, edit((v) => (v.audit_logs.find((a) => a.id === entry.id)!.action = 'X')), admin)).toThrow(GuardError);
    expect(() => mergeFirmState(full, edit((v) => (v.audit_logs = v.audit_logs.filter((a) => a.id !== entry.id))), admin)).toThrow(GuardError);
  });
});

describe('Step 2 · A client and engagement can be created', () => {
  it('creates both and audits them; an engagement cannot be made for an unassigned client', () => {
    const c = services.createClient(FIRM, admin, { name: 'New Co Ltd', company_no: '01234567', company_type: 'ltd', year_end: '2026-12-31', data_source: 'csv' });
    const e = services.createEngagement(FIRM, admin, { client_id: c.id, period_start: '2026-01-01', period_end: '2026-12-31', framework: 'FRS 105', template_pack_id: 'pack' });
    expect(db.audit_logs.some((a) => a.entity_id === e.id && a.action === 'CREATE_ENGAGEMENT')).toBe(true);
    expect(() =>
      services.createEngagement(FIRM, admin, { client_id: c.id, period_start: '2026-01-01', period_end: '2026-12-31', framework: 'FRS 105', template_pack_id: 'pack' }, ['cli_harlow'])
    ).toThrow(/not found/i);
  });
});

describe('Client archive', () => {
  const manager: Actor = { id: 'usr_test_reviewer', name: 'M', role: 'manager', firmId: FIRM };
  const preparer: Actor = { id: 'usr_test_preparer', name: 'P', role: 'preparer', firmId: FIRM };

  it('managers archive and restore; preparers cannot; both are audited with the reason', () => {
    expect(() => services.setClientArchived(FIRM, preparer, 'cli_harlow', true)).toThrow(/manager, partner or admin/);
    const c = services.setClientArchived(FIRM, manager, 'cli_harlow', true, 'Disengaged');
    expect(c).toMatchObject({ archived_by: manager.id, archive_reason: 'Disengaged' });
    expect(db.audit_logs.some((a) => a.action === 'ARCHIVE_CLIENT' && a.entity_id === 'cli_harlow' && a.reason === 'Disengaged')).toBe(true);
    services.setClientArchived(FIRM, manager, 'cli_harlow', false);
    expect(db.clients.find((x) => x.id === 'cli_harlow')!.archived_at).toBeNull();
    expect(db.audit_logs.some((a) => a.action === 'RESTORE_CLIENT')).toBe(true);
  });

  it('an archived client gets no new engagements and its files are read-only', () => {
    services.setClientArchived(FIRM, admin, 'cli_harlow', true);
    expect(() =>
      services.createEngagement(FIRM, admin, { client_id: 'cli_harlow', period_start: '2026-01-01', period_end: '2026-12-31', framework: 'FRS 105', template_pack_id: 'p' })
    ).toThrow(/archived/);

    const full = db.exportState() as State;
    const edit = (fn: (v: State) => void) => {
      const v = JSON.parse(JSON.stringify(firmSlice(full, FIRM, admin.id)));
      fn(v);
      return v;
    };
    const wp = (full.workpapers as any[]).find((w) => w.engagement_id === 'eng_harlow_fy26');
    expect(() => mergeFirmState(full, edit((v) => (v.workpapers.find((w) => w.id === wp.id)!.ref = 'X')), admin)).toThrow(/archived/);
    // Archiving itself only goes through the audited API
    expect(() => mergeFirmState(full, edit((v) => (v.clients.find((c) => c.id === 'cli_harlow')!.archived_at = null)), admin)).toThrow(/client list/);
  });
});

describe('Step 3 · A late posting is detected on refresh', () => {
  it('the second import records which accounts moved since the first', async () => {
    const eng = 'eng_harlow_fy26';
    const cookie = `${SESSION_COOKIE}=${(await import('../lib/server/auth')).createSessionToken('usr_admin')}`;
    const tb = (rent: string) => [
      { code: '1200', name: 'Business Current Account', type: 'Bank', debit: '10000.00', credit: '0' },
      { code: '6000', name: 'Office Rent', type: 'Expense', debit: rent, credit: '0' },
      { code: '3000', name: 'Share Capital', type: 'Equity', debit: '0', credit: String(10000 + Number(rent)) },
    ];
    await importTb(json(`/api/v1/engagements/${eng}/imports`, { lines: tb('500.00') }, cookie), { params: Promise.resolve({ id: eng }) });
    const res = await importTb(json(`/api/v1/engagements/${eng}/imports`, { lines: tb('750.00') }, cookie), { params: Promise.resolve({ id: eng }) });
    const body = await res.json();
    expect(res.status).toBe(201);
    const rent = body.changes.find((c: any) => c.account_code === '6000');
    expect(rent).toMatchObject({ prior_amount_p: '50000', new_amount_p: '75000', diff_p: '25000', direction: 'increased' });
    expect(body.changes.some((c: any) => c.account_code === '1200')).toBe(false);
  });
});

describe('Step 4 · Account mapping, confidence gate and rules library', () => {
  it('a client code that clashes with the Blynt chart does not override a clear account name', () => {
    // 1200 is Trade Debtors in the Blynt chart; the name says bank
    const bank = matchBlyntAccount('Business Current Account', 'Bank', '1200')!;
    expect(bank.lead_letter).toBe('B');
    expect(bank.confidence).toBeLessThan(90); // goes to Check, not Ready
    expect(bank.reason).toMatch(/check this/);

    // Name agrees with the code: full confidence
    expect(matchBlyntAccount('Sales Ledger Control', 'Current Asset', '1200')).toMatchObject({ blynt_code: '1200', confidence: 100 });
    // Name gives no clue: keep the code, but not Ready
    expect(matchBlyntAccount('Account XJ-9', '', '1200')).toMatchObject({ blynt_code: '1200', confidence: 85 });
  });

  const eng = 'eng_harlow_fy26';
  const line = { code: '7999', name: 'Sundry Odd Costs', type: 'Other' };

  it('a correction on one client maps the same account on the next import without review', () => {
    const m = services.buildMapping(FIRM, eng, 'm1', line, 1000n);
    db.account_mappings.push(m);
    expect(m.status).not.toBe('confirmed');

    services.updateMapping(FIRM, admin, 'm1', '6000');
    const next = services.buildMapping(FIRM, eng, 'm2', line, 1000n);
    expect(next).toMatchObject({ blynt_code: '6000', status: 'confirmed', method: 'rule', gate: 'ready' });

    // The client rule does not leak to another client
    const other = services.buildMapping(FIRM, 'eng_acme_fy26', 'm3', line, 1000n);
    expect(other.method).not.toBe('rule');
  });

  it('accuracy is reported from the AI action log', () => {
    db.ai_action_logs = []; // ignore the demo history
    const a = services.buildMapping(FIRM, eng, 'a1', { code: '7001', name: 'Office Rent', type: 'Expense' }, 1000n);
    const b = services.buildMapping(FIRM, eng, 'b1', { code: '7002', name: 'Petty Cash', type: 'Bank' }, 1000n);
    db.account_mappings.push(a, b);
    expect(a.method).toBe('ai');
    expect(b.method).toBe('ai');
    services.confirmSelectedMappings(FIRM, admin, eng, ['a1']); // accepted as suggested
    services.updateMapping(FIRM, admin, 'b1', '6000'); // edited
    const acc = accuracy(FIRM, 'mapping', eng);
    expect(acc).toMatchObject({ decided: 2, accepted_unchanged: 1, edited: 1, rate: 50 });
  });

  it('a second output type uses the same gate and rules library without changes', () => {
    const extract = (confidence: number) =>
      runGated<number>({
        firmId: FIRM,
        outputType: 'extraction',
        ruleType: 'extraction',
        keys: ['name:closing balance'],
        supplier: 'Barclays',
        decode: Number,
        ai: () => ({ value: 1234, confidence, reason: 'Read from page 2', evidence: 'statement.pdf p2' }),
      });
    expect(extract(96)).toMatchObject({ source: 'ai', gate: 'ready', accepted: false }); // auto-accept off
    expect(extract(80).gate).toBe('check');
    expect(extract(10).gate).toBe('exception');

    learnFromCorrection(admin, { type: 'extraction', scope: 'supplier', supplier_name: 'Barclays', pattern: 'name:closing balance', target_value: '999' });
    expect(extract(10)).toMatchObject({ source: 'rule', value: 999, accepted: true });
  });

  it('practice rules from a preparer wait for manager approval', () => {
    const preparer: Actor = { id: 'usr_test_preparer', name: 'P', role: 'preparer', firmId: FIRM };
    const r = learnFromCorrection(preparer, { type: 'mapping', scope: 'practice', pattern: '*widgets*', target_value: '5000' });
    expect(r.active).toBe(false);
    expect(services.buildMapping(FIRM, eng, 'w1', { code: '8888', name: 'Blue Widgets', type: 'Other' }, 1n).method).not.toBe('rule');
  });
});
