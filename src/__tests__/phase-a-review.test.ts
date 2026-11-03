// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory store: routes never touch the workspace file, and uploaded files live in this map
const files = new Map<string, { mime: string; filename: string; bytes: Buffer }>();
vi.mock('@/lib/server/store', () => ({
  syncIn: async () => {},
  syncOut: async () => {},
  currentVersion: () => 1,
  hasDatabase: () => false,
  saveFile: async (f: { id: string; mime: string; filename: string; bytes: Buffer }) => void files.set(f.id, f),
  readFile: async (id: string) => files.get(id) ?? null,
}));

import { db } from '../lib/server/db';
import { createSessionToken, hashPassword, SESSION_COOKIE, MFA_COOKIE } from '../lib/server/auth';
import { firmSlice, mergeFirmState, GuardError, State, Actor } from '../lib/server/state-guard';
import { services } from '../lib/server/services';
import { totpCode } from '../lib/server/totp';
import { GET as getWorkpaper, PATCH as patchWorkpaper } from '../app/api/v1/workpapers/[id]/route';
import { GET as templateOptions } from '../app/api/v1/workpapers/[id]/template-options/route';
import { POST as resolveComment } from '../app/api/v1/comments/[id]/resolve/route';
import { POST as approveAdjustment } from '../app/api/v1/adjustments/[id]/approve/route';
import { DELETE as deleteAttachment } from '../app/api/v1/attachments/[id]/route';
import { GET as getFile } from '../app/api/v1/files/[key]/route';
import { POST as importTb } from '../app/api/v1/engagements/[id]/imports/route';
import { POST as signup } from '../app/api/v1/auth/signup/route';
import { GET as listInvites } from '../app/api/v1/invites/route';
import { POST as login } from '../app/api/v1/auth/login/route';
import { GET as mfaSetup } from '../app/api/v1/auth/mfa/setup/route';
import { POST as mfaVerify } from '../app/api/v1/auth/mfa/verify/route';

const FIRM = 'firm_blynt_uk';
const ENG = 'eng_harlow_fy26';
const admin: Actor = { id: 'usr_admin', name: 'Dev Administrator', role: 'admin', firmId: FIRM };

const cookieFor = (uid: string) => `${SESSION_COOKIE}=${createSessionToken(uid)}`;
const req = (url: string, method = 'GET', cookie?: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** A user in a second, unrelated practice. */
function outsider() {
  db.firms.push({ id: 'firm_other', name: 'Other LLP', created_at: '2026-01-01T00:00:00Z' });
  db.users.push({ id: 'usr_other', email: 'other@other.test', name: 'Other Person', initials: 'OP', title: 'Admin', mfa_enabled: false });
  db.memberships.push({ user_id: 'usr_other', firm_id: 'firm_other', role: 'admin' });
  return cookieFor('usr_other');
}

/** A preparer in the same practice who is assigned a different client only. */
function unassignedPreparer() {
  db.users.push({ id: 'usr_lim', email: 'lim@blynt.test', name: 'Limited Prep', initials: 'LP', title: 'Prep', mfa_enabled: false });
  db.memberships.push({ user_id: 'usr_lim', firm_id: FIRM, role: 'preparer', client_ids: ['cli_acme'] });
  return cookieFor('usr_lim');
}

const harlowWorkpaper = () => db.workpapers.find((w) => w.engagement_id === ENG)!;
const harlowAdjustment = () => {
  const adj = {
    id: 'adj_review_test', engagement_id: ENG, ref: 'AJ-T', description: 'Test', type: 'correcting',
    status: 'proposed', proposed_by: 'usr_test_preparer', approved_by: null, lines: [],
  } as any;
  db.adjustments.push(adj);
  return adj;
};

beforeEach(() => {
  db.seed(true);
  db.credentials = db.users.map((u) => ({ user_id: u.id, password_hash: hashPassword('Seed-Password-1!') }));
  files.clear();
  delete process.env.MFA_REQUIRED;
});

describe('A · records looked up by id belong to the caller', () => {
  it('another practice cannot read or change a workpaper', async () => {
    const other = outsider();
    const wp = harlowWorkpaper();
    expect((await getWorkpaper(req(`/x`, 'GET', other), params(wp.id))).status).toBe(404);
    expect((await patchWorkpaper(req(`/x`, 'PATCH', other, { data_json: {} }), params(wp.id))).status).toBe(404);
    expect((await templateOptions(req(`/x`, 'GET', other), params(wp.id))).status).toBe(404);
  });

  it('workpaper reads need a signed-in user', async () => {
    expect((await getWorkpaper(req(`/x`), params(harlowWorkpaper().id))).status).toBe(401);
    expect((await templateOptions(req(`/x`), params(harlowWorkpaper().id))).status).toBe(401);
  });

  it('a preparer cannot open a workpaper on a client they are not assigned to', async () => {
    const lim = unassignedPreparer();
    expect((await getWorkpaper(req(`/x`, 'GET', lim), params(harlowWorkpaper().id))).status).toBe(404);
  });

  it('the owning practice can still read its workpaper', async () => {
    expect((await getWorkpaper(req(`/x`, 'GET', cookieFor('usr_admin')), params(harlowWorkpaper().id))).status).toBe(200);
  });

  it('another practice cannot resolve a comment, approve an adjustment or delete an attachment', async () => {
    const other = outsider();
    const adj = harlowAdjustment();
    expect((await resolveComment(req(`/x`, 'POST', other), params('com_f10_disp'))).status).toBe(404);
    expect((await approveAdjustment(req(`/x`, 'POST', other), params(adj.id))).status).toBe(404);
    expect((await deleteAttachment(req(`/x`, 'DELETE', other), params('att_inv_dell'))).status).toBe(404);
    expect(db.attachments.some((a) => a.id === 'att_inv_dell')).toBe(true);
    expect(db.adjustments.find((a) => a.id === adj.id)!.status).toBe('proposed');
  });
});

describe('B · uploaded files are only served to people who can see them', () => {
  it('another practice cannot download a file attached to this practice’s engagement', async () => {
    files.set('file_secret', { mime: 'application/pdf', filename: 'secret.pdf', bytes: Buffer.from('%PDF') });
    db.attachments.find((a) => a.id === 'att_inv_dell')!.file_key = 'file_secret';
    const keyParams = { params: Promise.resolve({ key: 'file_secret' }) };
    expect((await getFile(req('/x', 'GET', outsider()), keyParams)).status).toBe(404);
    expect((await getFile(req('/x', 'GET', cookieFor('usr_admin')), keyParams)).status).toBe(200);
  });
});

describe('C · trial balance import rejects bad input instead of guessing', () => {
  const imp = (lines: unknown[]) => importTb(req(`/x`, 'POST', cookieFor('usr_admin'), { lines }), params(ENG));
  const ok = { code: '3000', name: 'Share Capital', type: 'Equity', debit: '0', credit: '100.00' };

  it('a line with a code but no name is a 400, not a crash', async () => {
    const res = await imp([{ code: '1200', debit: '100.00', credit: '0' }, ok]);
    expect(res.status).toBe(400);
  });

  it('an amount that is not a number is rejected, not read as something else', async () => {
    const res = await imp([{ code: '1200', name: 'Bank', debit: '1O0.00', credit: '0' }, ok]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/1O0\.00/);
  });

  it('the same account code twice is rejected', async () => {
    const res = await imp([
      { code: '1200', name: 'Bank', debit: '50.00', credit: '0' },
      { code: '1200', name: 'Bank again', debit: '50.00', credit: '0' },
      ok,
    ]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/1200/);
  });
});

describe('D · change detection describes credit balances the way accountants read them', () => {
  it('share capital going from £10,500 to £10,750 credit is an increase', () => {
    db.tb_lines.push({ id: 'l1', snapshot_id: 'snap_prior', source_code: '3000', source_name: 'Share Capital', source_type: 'Equity', debit_p: '0', credit_p: '1050000' });
    const [d] = services.diffSnapshots('snap_prior', [{ code: '3000', name: 'Share Capital', net_p: -1075000n }]);
    expect(d.direction).toBe('increased');
  });

  it('a debit balance shrinking is a decrease', () => {
    db.tb_lines.push({ id: 'l2', snapshot_id: 'snap_prior', source_code: '1200', source_name: 'Bank', source_type: 'Bank', debit_p: '50000', credit_p: '0' });
    const [d] = services.diffSnapshots('snap_prior', [{ code: '1200', name: 'Bank', net_p: 20000n }]);
    expect(d.direction).toBe('decreased');
  });
});

describe('E0 · re-seeding the workspace does not duplicate records', () => {
  it('every collection has unique ids after seeding twice', () => {
    db.seed(true);
    db.seed(true);
    const state = db.exportState() as Record<string, { id?: string }[]>;
    const dupes = Object.entries(state)
      .filter(([, rows]) => rows.some((r) => r?.id))
      .filter(([, rows]) => new Set(rows.map((r) => r.id)).size !== rows.length)
      .map(([k]) => k);
    expect(dupes).toEqual([]);
  });
});

describe('E · the AI action log cannot be rewritten from the browser', () => {
  const full = () => db.exportState() as State;
  const edit = (s: State, fn: (v: State) => void) => {
    const v = JSON.parse(JSON.stringify(firmSlice(s, FIRM, admin.id)));
    fn(v);
    return v;
  };
  const row = (by: string) => ({
    id: `act_${by}`, firm_id: FIRM, engagement_id: ENG, output_type: 'mapping', inputs_used: '', confidence: 95,
    model_version: 'x', outcome: 'accepted', decided_by: by, decided_by_name: by, decided_at: '2026-10-01T00:00:00Z',
  });

  it('existing rows cannot be edited or deleted', () => {
    db.ai_action_logs.push(row('usr_admin') as any);
    const s = full();
    expect(() => mergeFirmState(s, edit(s, (v) => (v.ai_action_logs[0].outcome = 'rejected')), admin)).toThrow(GuardError);
    expect(() => mergeFirmState(s, edit(s, (v) => (v.ai_action_logs = [])), admin)).toThrow(GuardError);
  });

  it('new rows must be recorded as the signed-in user', () => {
    const s = full();
    expect(() => mergeFirmState(s, edit(s, (v) => v.ai_action_logs.push(row('usr_test_reviewer'))), admin)).toThrow(GuardError);
    expect(() => mergeFirmState(s, edit(s, (v) => v.ai_action_logs.push(row('usr_admin'))), admin)).not.toThrow();
  });
});

describe('F · sign-up and invites', () => {
  it('sign-up refuses a role that does not exist', async () => {
    const res = await signup(req('/x', 'POST', undefined, {
      fullName: 'Role Test', workEmail: 'role.test@example.test', firmName: 'Role LLP', role: 'superuser', password: 'Tidy-Ledger-2026!',
    }));
    expect(res.status).toBe(400);
  });

  it('only people who can invite see the pending invite list', async () => {
    expect((await listInvites(req('/x', 'GET', cookieFor('usr_test_preparer')))).status).toBe(403);
    expect((await listInvites(req('/x', 'GET', cookieFor('usr_admin')))).status).toBe(200);
  });
});

describe('G · an MFA code works once', () => {
  it('replaying the same code is refused', async () => {
    process.env.MFA_REQUIRED = 'true';
    const r1 = await login(req('/x', 'POST', undefined, { email: 'admin@blynt.co.uk', password: 'Seed-Password-1!' }));
    const challenge = (r1.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith(MFA_COOKIE))!;
    const { secret } = await (await mfaSetup(req('/x', 'GET', challenge))).json();
    const code = totpCode(secret);
    expect((await mfaVerify(req('/x', 'POST', challenge, { code }))).status).toBe(200);

    // Sign in again and try the same code inside its 30-second window
    const r2 = await login(req('/x', 'POST', undefined, { email: 'admin@blynt.co.uk', password: 'Seed-Password-1!' }));
    const challenge2 = (r2.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith(MFA_COOKIE))!;
    expect((await mfaVerify(req('/x', 'POST', challenge2, { code }))).status).toBe(401);
  });
});
