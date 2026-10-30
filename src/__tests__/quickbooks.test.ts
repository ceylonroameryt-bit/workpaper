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
import { createState } from '../lib/server/xero';
import { QBO_SCOPES, qboAuthorizeUrl, parseQboTrialBalance } from '../lib/server/quickbooks';
import { GET as connect } from '../app/api/v1/integrations/quickbooks/connect/route';
import { GET as callback } from '../app/api/v1/integrations/quickbooks/callback/route';
import { POST as sync } from '../app/api/v1/integrations/quickbooks/sync/route';
import { GET as status, DELETE as disconnect } from '../app/api/v1/integrations/quickbooks/connection/route';
import { firmSlice } from '../lib/server/state-guard';

const FIRM = 'firm_blynt_uk';
const CLIENT = 'cli_harlow';
const ENG = 'eng_harlow_fy26';
const cookie = (uid = 'usr_admin') => `${SESSION_COOKIE}=${createSessionToken(uid)}`;
const get = (url: string, uid = 'usr_admin') => new Request(`http://localhost${url}`, { headers: { cookie: cookie(uid) } });
const post = (url: string, body: unknown, method = 'POST') =>
  new Request(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', cookie: cookie() }, body: JSON.stringify(body) });

// Recorded shapes of QuickBooks Online responses (values invented). Many companies don't use account numbers.
const ACCOUNTS = {
  QueryResponse: {
    Account: [
      { Id: '35', Name: 'Business Current Account', AccountType: 'Bank', Classification: 'Asset' },
      { Id: '79', Name: 'Sales', AcctNum: '4000', AccountType: 'Income', Classification: 'Revenue' },
      { Id: '7', Name: 'Office Expenses', AccountType: 'Expense', Classification: 'Expense' },
      { Id: '33', Name: 'Accounts Payable (Creditors)', AccountType: 'Accounts Payable', Classification: 'Liability' },
    ],
  },
};
const line = (name: string, id: string, debit: string, credit: string) => ({ ColData: [{ value: name, id }, { value: debit }, { value: credit }] });
const trialBalance = (office = '2500.00') => ({
  Header: { ReportName: 'TrialBalance', StartPeriod: '2025-10-01', EndPeriod: '2026-09-30' },
  Columns: { Column: [{ ColTitle: '', ColType: 'Account' }, { ColTitle: 'Debit', ColType: 'Money' }, { ColTitle: 'Credit', ColType: 'Money' }] },
  Rows: {
    Row: [
      line('Business Current Account', '35', (10000 - Number(office) + 2500).toFixed(2), ''),
      line('Accounts Payable (Creditors)', '33', '', '2500.00'),
      line('Sales', '79', '', '10000.00'),
      line('Office Expenses', '7', office, ''),
      { type: 'Section', group: 'GrandTotal', Summary: { ColData: [{ value: 'TOTAL' }, { value: '12500.00' }, { value: '12500.00' }] } },
    ],
  },
});

function fakeQbo(opts: { tb?: () => unknown; tokenError?: string } = {}) {
  const calls: string[] = [];
  let n = 0;
  const json = (body: unknown, s = 200) => new Response(JSON.stringify(body), { status: s, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url === 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer') {
        if (opts.tokenError) return json({ error: opts.tokenError }, 400);
        n++;
        return json({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 3600, x_refresh_token_expires_in: 8726400 });
      }
      const base = 'https://sandbox-quickbooks.api.intuit.com/v3/company/9130';
      if (url.startsWith(`${base}/companyinfo/`)) return json({ CompanyInfo: { CompanyName: 'Harlow Sandbox Ltd' } });
      if (url.startsWith(`${base}/query`)) return json(ACCOUNTS);
      if (url.startsWith(`${base}/reports/TrialBalance`)) return json((opts.tb ?? trialBalance)());
      return json({ error: 'unexpected' }, 404);
    })
  );
  return calls;
}

async function connectHarlow() {
  const state = createState({ firmId: FIRM, userId: 'usr_admin', clientId: CLIENT });
  return callback(get(`/api/v1/integrations/quickbooks/callback?code=abc&realmId=9130&state=${encodeURIComponent(state)}`));
}

beforeEach(() => {
  db.seed(true);
  process.env.QBO_CLIENT_ID = 'qbo-id';
  process.env.QBO_CLIENT_SECRET = 'qbo-secret';
  process.env.QBO_REDIRECT_URI = 'http://localhost:3000/api/v1/integrations/quickbooks/callback';
  process.env.QBO_ENV = 'sandbox';
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ['QBO_CLIENT_ID', 'QBO_CLIENT_SECRET', 'QBO_REDIRECT_URI', 'QBO_ENV']) delete process.env[k];
});

describe('QuickBooks Online', () => {
  it('builds the Intuit consent URL with the accounting scope', () => {
    const url = new URL(qboAuthorizeUrl('s-1'));
    expect(url.origin + url.pathname).toBe('https://appcenter.intuit.com/connect/oauth2');
    expect(url.searchParams.get('client_id')).toBe('qbo-id');
    expect(url.searchParams.get('scope')).toBe(QBO_SCOPES.join(' '));
    expect(QBO_SCOPES).toContain('com.intuit.quickbooks.accounting');
    expect(url.searchParams.get('state')).toBe('s-1');
  });

  it('turns the trial balance report into lines, using the account number or a stable QB id', () => {
    const lines = parseQboTrialBalance(trialBalance(), ACCOUNTS.QueryResponse.Account);
    expect(lines).toEqual([
      { code: 'QB-35', name: 'Business Current Account', type: 'Bank', debit: '10000.00', credit: '0.00', external_id: '35' },
      { code: 'QB-33', name: 'Accounts Payable (Creditors)', type: 'Current Liability', debit: '0.00', credit: '2500.00', external_id: '33' },
      { code: '4000', name: 'Sales', type: 'Revenue', debit: '0.00', credit: '10000.00', external_id: '79' },
      { code: 'QB-7', name: 'Office Expenses', type: 'Expense', debit: '2500.00', credit: '0.00', external_id: '7' },
    ]);
  });

  it('connect redirects to Intuit; the callback stores encrypted tokens and the company', async () => {
    const res = await connect(get(`/api/v1/integrations/quickbooks/connect?clientId=${CLIENT}`));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('https://appcenter.intuit.com/connect/oauth2');

    fakeQbo();
    const cb = await connectHarlow();
    expect(cb.headers.get('location')).toContain(`/clients/${CLIENT}?qbo=connected`);
    const conn = db.qbo_connections.find((c) => c.client_id === CLIENT)!;
    expect(conn).toMatchObject({ realm_id: '9130', company_name: 'Harlow Sandbox Ltd' });
    expect(conn.access_token_enc).not.toContain('access-1');
    expect(db.clients.find((c) => c.id === CLIENT)!.data_source).toBe('quickbooks');
    const s = await (await status(get(`/api/v1/integrations/quickbooks/connection?clientId=${CLIENT}`))).json();
    expect(s).toMatchObject({ configured: true, connected: true, company_name: 'Harlow Sandbox Ltd' });
    expect(JSON.stringify(s)).not.toContain('token');
  });

  it('a callback from another user is refused', async () => {
    fakeQbo();
    const state = createState({ firmId: FIRM, userId: 'someone_else', clientId: CLIENT });
    const cb = await callback(get(`/api/v1/integrations/quickbooks/callback?code=abc&realmId=9130&state=${encodeURIComponent(state)}`));
    expect(cb.headers.get('location')).toContain('qbo=error');
    expect(db.qbo_connections).toHaveLength(0);
  });

  it('pulls the trial balance for the engagement period through the normal import', async () => {
    const calls = fakeQbo();
    await connectHarlow();
    const res = await sync(post('/api/v1/integrations/quickbooks/sync', { engagementId: ENG }));
    const body = await res.json();
    expect(res.status).toBeLessThan(300);
    const eng = db.engagements.find((e) => e.id === ENG)!;
    const tbCall = calls.find((u) => u.includes('/reports/TrialBalance'))!;
    expect(tbCall).toContain(`start_date=${eng.period_start}`);
    expect(tbCall).toContain(`end_date=${eng.period_end}`);
    expect(db.tb_snapshots.find((s) => s.id === body.snapshot.id)!.source).toBe('quickbooks');
  });

  it('an expired refresh token asks for reconnection', async () => {
    fakeQbo();
    await connectHarlow();
    db.qbo_connections[0].expires_at = new Date(0).toISOString();
    fakeQbo({ tokenError: 'invalid_grant' });
    const res = await sync(post('/api/v1/integrations/quickbooks/sync', { engagementId: ENG }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('QBO_RECONNECT');
    expect(db.clients.find((c) => c.id === CLIENT)!.reconnect_needed).toBe(true);
  });

  it('tokens never reach the browser, and disconnect forgets them', async () => {
    fakeQbo();
    await connectHarlow();
    expect(firmSlice(db.exportState() as any, FIRM)).not.toHaveProperty('qbo_connections');
    const res = await disconnect(post(`/api/v1/integrations/quickbooks/connection?clientId=${CLIENT}`, {}, 'DELETE'));
    expect(res.status).toBe(200);
    expect(db.qbo_connections).toHaveLength(0);
  });
});
