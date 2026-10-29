// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({
  syncIn: async () => {},
  syncOut: async () => {},
  currentVersion: () => 1,
  hasDatabase: () => false,
}));

import { db } from '../lib/server/db';
import { createSessionToken, SESSION_COOKIE } from '../lib/server/auth';
import {
  XERO_SCOPES,
  authorizeUrl,
  createState,
  readState,
  encryptToken,
  decryptToken,
  parseTrialBalance,
} from '../lib/server/xero';
import { GET as connect } from '../app/api/v1/integrations/xero/connect/route';
import { GET as callback } from '../app/api/v1/integrations/xero/callback/route';
import { POST as sync } from '../app/api/v1/integrations/xero/sync/route';
import { DELETE as disconnect } from '../app/api/v1/integrations/xero/connection/route';

const FIRM = 'firm_blynt_uk';
const CLIENT = 'cli_harlow';
const ENG = 'eng_harlow_fy26';
const cookie = (uid = 'usr_admin') => `${SESSION_COOKIE}=${createSessionToken(uid)}`;
const get = (url: string, uid?: string) => new Request(`http://localhost${url}`, { headers: uid === undefined ? {} : { cookie: cookie(uid) } });
const post = (url: string, body: unknown, method = 'POST', uid = 'usr_admin') =>
  new Request(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', cookie: cookie(uid) }, body: JSON.stringify(body) });

// Recorded shapes of Xero's responses (values invented)
const ACCOUNTS = {
  Accounts: [
    { AccountID: 'acc-090', Code: '090', Name: 'Business Bank Account', Type: 'BANK', Class: 'ASSET' },
    { AccountID: 'acc-200', Code: '200', Name: 'Sales', Type: 'REVENUE', Class: 'REVENUE' },
    { AccountID: 'acc-429', Code: '429', Name: 'General Expenses', Type: 'EXPENSE', Class: 'EXPENSE' },
    { AccountID: 'acc-970', Code: '970', Name: 'Owner A Funds Introduced', Type: 'EQUITY', Class: 'EQUITY' },
  ],
};
const row = (label: string, id: string, ytdDebit: string, ytdCredit: string) => ({
  RowType: 'Row',
  Cells: [
    { Value: label, Attributes: [{ Value: id, Id: 'account' }] },
    { Value: '' }, { Value: '' },
    { Value: ytdDebit, Attributes: [{ Value: id, Id: 'account' }] },
    { Value: ytdCredit, Attributes: [{ Value: id, Id: 'account' }] },
  ],
});
const trialBalance = (expenses = '2500.00', funds = '10000.00') => ({
  Reports: [
    {
      ReportID: 'TrialBalance',
      ReportName: 'Trial Balance',
      ReportDate: '30 September 2026',
      Rows: [
        { RowType: 'Header', Cells: [{ Value: 'Account' }, { Value: 'Debit' }, { Value: 'Credit' }, { Value: 'YTD Debit' }, { Value: 'YTD Credit' }] },
        { RowType: 'Section', Title: 'Revenue', Rows: [row('Sales (200)', 'acc-200', '', '12500.00')] },
        { RowType: 'Section', Title: 'Expenses', Rows: [row('General Expenses (429)', 'acc-429', expenses, '')] },
        {
          RowType: 'Section',
          Title: 'Assets',
          Rows: [row('Business Bank Account (090)', 'acc-090', String((12500 - Number(expenses) + Number(funds)).toFixed(2)), '')],
        },
        { RowType: 'Section', Title: 'Equity', Rows: [row('Owner A Funds Introduced (970)', 'acc-970', '', funds)] },
        { RowType: 'Section', Title: '', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total' }, { Value: '' }, { Value: '' }, { Value: '22500.00' }, { Value: '22500.00' }] }] },
      ],
    },
  ],
});

/** A fake Xero: answers the token, connections and accounting endpoints and records each call. */
function fakeXero(opts: { tb?: () => unknown; tokenError?: string } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let tokenCount = 0;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === 'https://identity.xero.com/connect/token') {
      if (opts.tokenError) return json({ error: opts.tokenError }, 400);
      tokenCount++;
      return json({ access_token: `access-${tokenCount}`, refresh_token: `refresh-${tokenCount}`, expires_in: 1800, token_type: 'Bearer' });
    }
    if (url === 'https://api.xero.com/connections') return json([{ id: 'conn-1', tenantId: 'tenant-1', tenantType: 'ORGANISATION', tenantName: 'Harlow Demo Ltd' }]);
    if (url.startsWith('https://api.xero.com/api.xro/2.0/Organisation')) return json({ Organisations: [{ Name: 'Harlow Demo Ltd', ShortCode: '!aB3cD' }] });
    if (url.startsWith('https://api.xero.com/api.xro/2.0/Accounts')) return json(ACCOUNTS);
    if (url.startsWith('https://api.xero.com/api.xro/2.0/Reports/TrialBalance')) return json((opts.tb ?? trialBalance)());
    return json({ error: 'unexpected' }, 404);
  });
  vi.stubGlobal('fetch', impl);
  return { calls, impl };
}

beforeEach(() => {
  db.seed(true);
  process.env.XERO_CLIENT_ID = 'test-client-id';
  process.env.XERO_CLIENT_SECRET = 'test-client-secret';
  process.env.XERO_REDIRECT_URI = 'http://localhost:3000/api/v1/integrations/xero/callback';
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.XERO_CLIENT_ID;
  delete process.env.XERO_CLIENT_SECRET;
  delete process.env.XERO_REDIRECT_URI;
});

describe('Xero client', () => {
  it('builds the consent URL with read-only scopes and offline access', () => {
    const url = new URL(authorizeUrl('state-123'));
    expect(url.origin + url.pathname).toBe('https://login.xero.com/identity/connect/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/v1/integrations/xero/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-123');
    const scopes = url.searchParams.get('scope')!.split(' ');
    expect(scopes).toEqual(XERO_SCOPES);
    expect(scopes).toContain('offline_access');
    expect(scopes.every((s) => !s.endsWith('accounting.transactions') && !s.endsWith('accounting.settings'))).toBe(true); // read-only
    // Retired for apps created on or after 2 March 2026 (Xero returns invalid_scope)
    for (const retired of ['accounting.transactions', 'accounting.transactions.read', 'accounting.reports.read']) expect(scopes).not.toContain(retired);
    // Needs Xero's approval, so not requested until we use it
    expect(scopes).not.toContain('accounting.journals.read');
    expect(scopes).toContain('accounting.reports.trialbalance.read');
  });

  it('signs the OAuth state and rejects tampering and expiry', () => {
    const s = createState({ firmId: FIRM, userId: 'usr_admin', clientId: CLIENT });
    expect(readState(s)).toMatchObject({ firmId: FIRM, userId: 'usr_admin', clientId: CLIENT });
    expect(readState(s.slice(0, -2) + 'xx')).toBeNull();
    expect(readState(createState({ firmId: FIRM, userId: 'usr_admin', clientId: CLIENT }, -1))).toBeNull();
  });

  it('encrypts tokens at rest', () => {
    const enc = encryptToken('secret-refresh-token');
    expect(enc).not.toContain('secret-refresh-token');
    expect(decryptToken(enc)).toBe('secret-refresh-token');
    expect(encryptToken('x')).not.toBe(encryptToken('x')); // fresh IV each time
  });

  it('turns Xero’s trial balance report into balanced import lines with codes and types', () => {
    const lines = parseTrialBalance(trialBalance(), ACCOUNTS.Accounts);
    expect(lines).toEqual([
      { code: '200', name: 'Sales', type: 'Revenue', debit: '0.00', credit: '12500.00', external_id: 'acc-200' },
      { code: '429', name: 'General Expenses', type: 'Expense', debit: '2500.00', credit: '0.00', external_id: 'acc-429' },
      { code: '090', name: 'Business Bank Account', type: 'Bank', debit: '20000.00', credit: '0.00', external_id: 'acc-090' },
      { code: '970', name: 'Owner A Funds Introduced', type: 'Equity', debit: '0.00', credit: '10000.00', external_id: 'acc-970' },
    ]);
  });
});

describe('Connecting a client to Xero', () => {
  it('says so plainly when Xero is not configured', async () => {
    delete process.env.XERO_CLIENT_ID;
    const res = await connect(get(`/api/v1/integrations/xero/connect?clientId=${CLIENT}`, 'usr_admin'));
    expect(res.status).toBe(503);
  });

  it('only for a client the user can see', async () => {
    db.users.push({ id: 'usr_lim', email: 'l@x.test', name: 'L', initials: 'L', title: 'P', mfa_enabled: false });
    db.memberships.push({ user_id: 'usr_lim', firm_id: FIRM, role: 'preparer', client_ids: ['cli_acme'] });
    expect((await connect(get(`/api/v1/integrations/xero/connect?clientId=${CLIENT}`, 'usr_lim'))).status).toBe(404);
  });

  it('redirects to Xero, then the callback stores encrypted tokens and links the organisation', async () => {
    const res = await connect(get(`/api/v1/integrations/xero/connect?clientId=${CLIENT}`, 'usr_admin'));
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get('location')!);
    expect(to.hostname).toBe('login.xero.com');
    const state = to.searchParams.get('state')!;

    const xero = fakeXero();
    const back = await callback(get(`/api/v1/integrations/xero/callback?code=auth-code&state=${encodeURIComponent(state)}`, 'usr_admin'));
    expect(back.status).toBe(302);
    expect(back.headers.get('location')).toContain(`/clients/${CLIENT}?xero=connected`);

    // Code exchanged with client credentials, never sent to the browser
    const tokenCall = xero.calls.find((c) => c.url === 'https://identity.xero.com/connect/token')!;
    expect(String(tokenCall.init?.body)).toContain('grant_type=authorization_code');
    expect((tokenCall.init!.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`);

    const conn = db.xero_connections.find((c) => c.client_id === CLIENT)!;
    expect(conn).toMatchObject({ firm_id: FIRM, tenant_id: 'tenant-1', tenant_name: 'Harlow Demo Ltd', short_code: '!aB3cD' });
    expect(conn.access_token_enc).not.toContain('access-1');
    expect(decryptToken(conn.refresh_token_enc)).toBe('refresh-1');
    expect(db.clients.find((c) => c.id === CLIENT)).toMatchObject({ data_source: 'xero', reconnect_needed: false });
    expect(db.audit_logs.some((a) => a.action === 'XERO_CONNECTED' && a.entity_id === CLIENT)).toBe(true);
  });

  it('a forged or expired state is refused and nothing is stored', async () => {
    fakeXero();
    const res = await callback(get(`/api/v1/integrations/xero/callback?code=x&state=forged`, 'usr_admin'));
    expect(res.headers.get('location')).toContain('xero=error');
    expect(db.xero_connections).toHaveLength(0);
  });

  it('the person finishing the callback must be the one who started it', async () => {
    const state = createState({ firmId: FIRM, userId: 'usr_admin', clientId: CLIENT });
    fakeXero();
    const res = await callback(get(`/api/v1/integrations/xero/callback?code=x&state=${encodeURIComponent(state)}`, 'usr_test_preparer'));
    expect(res.headers.get('location')).toContain('xero=error');
    expect(db.xero_connections).toHaveLength(0);
  });

  it('a declined consent comes back as a clear message', async () => {
    const state = createState({ firmId: FIRM, userId: 'usr_admin', clientId: CLIENT });
    const res = await callback(get(`/api/v1/integrations/xero/callback?error=access_denied&state=${encodeURIComponent(state)}`, 'usr_admin'));
    expect(res.headers.get('location')).toContain(`/clients/${CLIENT}?xero=declined`);
  });
});

describe('Pulling the trial balance from Xero', () => {
  async function connected() {
    const state = createState({ firmId: FIRM, userId: 'usr_admin', clientId: CLIENT });
    fakeXero();
    await callback(get(`/api/v1/integrations/xero/callback?code=c&state=${encodeURIComponent(state)}`, 'usr_admin'));
  }

  it('pulls the TB at the period end, imports it and maps every account', async () => {
    await connected();
    const xero = fakeXero();
    const res = await sync(post('/api/v1/integrations/xero/sync', { engagementId: ENG }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.lineCount).toBe(4);
    const tbCall = xero.calls.find((c) => c.url.includes('/Reports/TrialBalance'))!;
    expect(tbCall.url).toContain('date=2026-09-30');
    expect((tbCall.init!.headers as Record<string, string>)['xero-tenant-id']).toBe('tenant-1');
    expect(db.tb_snapshots.find((s) => s.id === body.snapshot.id)!.source).toBe('xero');
    expect(db.account_mappings.filter((m) => m.engagement_id === ENG)).toHaveLength(4);
  });

  it('a late posting in Xero shows up on the next pull', async () => {
    await connected();
    fakeXero();
    await sync(post('/api/v1/integrations/xero/sync', { engagementId: ENG }));
    fakeXero({ tb: () => trialBalance('2750.00') });
    const body = await (await sync(post('/api/v1/integrations/xero/sync', { engagementId: ENG }))).json();
    expect(body.changes.find((c: any) => c.account_code === '429')).toMatchObject({ diff_p: '25000', direction: 'increased' });
  });

  it('refreshes an expired access token and keeps the rotated refresh token', async () => {
    await connected();
    const conn = db.xero_connections[0];
    conn.expires_at = new Date(Date.now() - 1000).toISOString();
    const xero = fakeXero();
    expect((await sync(post('/api/v1/integrations/xero/sync', { engagementId: ENG }))).status).toBe(201);
    const refresh = xero.calls.find((c) => c.url === 'https://identity.xero.com/connect/token')!;
    expect(String(refresh.init?.body)).toContain('grant_type=refresh_token');
    expect(decryptToken(db.xero_connections[0].refresh_token_enc)).toBe('refresh-1');
    expect(new Date(db.xero_connections[0].expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('a revoked or expired connection marks the client as needing reconnection', async () => {
    await connected();
    db.xero_connections[0].expires_at = new Date(Date.now() - 1000).toISOString();
    fakeXero({ tokenError: 'invalid_grant' });
    const res = await sync(post('/api/v1/integrations/xero/sync', { engagementId: ENG }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('XERO_RECONNECT');
    expect(db.clients.find((c) => c.id === CLIENT)!.reconnect_needed).toBe(true);
  });

  it('a client with no Xero connection gets a clear error', async () => {
    const res = await sync(post('/api/v1/integrations/xero/sync', { engagementId: ENG }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('XERO_NOT_CONNECTED');
  });

  it('another practice cannot pull or disconnect this client', async () => {
    await connected();
    db.firms.push({ id: 'firm_other', name: 'O', created_at: '2026-01-01T00:00:00Z' });
    db.users.push({ id: 'usr_other', email: 'o@o.test', name: 'O', initials: 'O', title: 'A', mfa_enabled: false });
    db.memberships.push({ user_id: 'usr_other', firm_id: 'firm_other', role: 'admin' });
    expect((await sync(post('/api/v1/integrations/xero/sync', { engagementId: ENG }, 'POST', 'usr_other'))).status).toBe(404);
    expect((await disconnect(post(`/api/v1/integrations/xero/connection?clientId=${CLIENT}`, {}, 'DELETE', 'usr_other'))).status).toBe(404);
    expect(db.xero_connections).toHaveLength(1);
  });

  it('disconnecting removes the stored tokens', async () => {
    await connected();
    fakeXero();
    const res = await disconnect(post(`/api/v1/integrations/xero/connection?clientId=${CLIENT}`, {}, 'DELETE'));
    expect(res.status).toBe(200);
    expect(db.xero_connections).toHaveLength(0);
    expect(db.audit_logs.some((a) => a.action === 'XERO_DISCONNECTED')).toBe(true);
  });

  it('tokens never reach the browser', async () => {
    await connected();
    const { firmSlice } = await import('../lib/server/state-guard');
    expect(firmSlice(db.exportState() as any, FIRM)).not.toHaveProperty('xero_connections');
  });
});
