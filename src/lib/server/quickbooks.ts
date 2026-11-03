import crypto from 'crypto';
import { db } from './db';
import { ServiceError } from './services';
import { importTrialBalance, ImportResult, TbLineInput } from './tb-import';
import { encryptToken, decryptToken } from './xero';
import { UserRole } from '../types/models';

/**
 * QuickBooks Online connection (DAT-01): the same shape as the Xero connection. OAuth 2.0 with
 * Intuit, encrypted tokens with silent refresh, and a trial balance pull through the shared
 * import pipeline. The signed OAuth state and token encryption are shared with xero.ts.
 *
 * Configure with QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI and QBO_ENV
 * (sandbox | production).
 */

const AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const MINOR_VERSION = '75';
const apiBase = () =>
  process.env.QBO_ENV === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';

export const QBO_SCOPES = ['com.intuit.quickbooks.accounting'];

export interface QboConnection {
  id: string;
  firm_id: string;
  client_id: string;
  realm_id: string; // the QuickBooks company id
  company_name: string;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: string;
  connected_by: string;
  connected_at: string;
  last_synced_at: string | null;
}

export class QboReconnectError extends ServiceError {
  constructor() {
    super('The QuickBooks connection has expired or was revoked. Reconnect QuickBooks for this client.', 409, 'QBO_RECONNECT');
  }
}

export function qboConfig() {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : null;
}

function requireConfig() {
  const c = qboConfig();
  if (!c) throw new ServiceError('QuickBooks is not set up yet. Add QBO_CLIENT_ID, QBO_CLIENT_SECRET and QBO_REDIRECT_URI.', 503, 'QBO_NOT_CONFIGURED');
  return c;
}

export function qboAuthorizeUrl(state: string): string {
  const c = requireConfig();
  const q = new URLSearchParams({ client_id: c.clientId, response_type: 'code', scope: QBO_SCOPES.join(' '), redirect_uri: c.redirectUri, state });
  return `${AUTHORIZE_URL}?${q}`;
}

// ── Intuit HTTP calls ──

interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const c = requireConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body.error === 'invalid_grant') throw new QboReconnectError();
    throw new ServiceError(`QuickBooks sign-in failed (${body.error || res.status}).`, 502, 'QBO_ERROR');
  }
  return body as TokenSet;
}

async function qboGet<T>(realmId: string, path: string, accessToken: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${apiBase()}/v3/company/${realmId}/${path}${sep}minorversion=${MINOR_VERSION}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (res.status === 401) throw new QboReconnectError();
  if (res.status === 429) throw new ServiceError('QuickBooks is limiting requests right now. Try again in a minute.', 429, 'QBO_RATE_LIMIT');
  if (!res.ok) throw new ServiceError(`QuickBooks returned an error (${res.status}).`, 502, 'QBO_ERROR');
  return (await res.json()) as T;
}

// ── Trial balance report → import lines ──

interface QboAccount {
  Id: string;
  Name: string;
  AcctNum?: string;
  AccountType: string;
}

interface QboColData {
  value?: string;
  id?: string;
}

interface QboRow {
  type?: string;
  ColData?: QboColData[];
  Rows?: { Row?: QboRow[] };
}

const QBO_TYPES: Record<string, string> = {
  Bank: 'Bank',
  'Accounts Receivable': 'Current Asset',
  'Other Current Asset': 'Current Asset',
  'Fixed Asset': 'Fixed Asset',
  'Other Asset': 'Non-current Asset',
  'Accounts Payable': 'Current Liability',
  'Credit Card': 'Current Liability',
  'Other Current Liability': 'Current Liability',
  'Long Term Liability': 'Non-current Liability',
  Equity: 'Equity',
  Income: 'Revenue',
  'Other Income': 'Other Income',
  'Cost of Goods Sold': 'Cost of Sales',
  Expense: 'Expense',
  'Other Expense': 'Expense',
};

const amount = (v: string | undefined) => {
  const n = Number(String(v || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * QuickBooks' TrialBalance report has columns Account, Debit, Credit; each data row's first cell
 * carries the account id. Many companies don't use account numbers, so lines without one get a
 * stable code from the QuickBooks id (QB-35) and are mapped by name and type.
 */
export function parseQboTrialBalance(report: unknown, accounts: QboAccount[]): TbLineInput[] {
  const byId = new Map(accounts.map((a) => [a.Id, a]));
  const r = report as { Columns?: { Column?: { ColTitle?: string }[] }; Rows?: { Row?: QboRow[] } };
  const titles = r?.Columns?.Column?.map((c) => (c.ColTitle || '').toLowerCase()) ?? [];
  const debitCol = titles.indexOf('debit') >= 0 ? titles.indexOf('debit') : 1;
  const creditCol = titles.indexOf('credit') >= 0 ? titles.indexOf('credit') : 2;

  const lines: TbLineInput[] = [];
  const walk = (rows: QboRow[]) => {
    for (const row of rows) {
      if (row.Rows?.Row) walk(row.Rows.Row);
      const cells = row.ColData;
      if (!cells || row.type === 'Section') continue;
      const id = cells[0]?.id;
      if (!id) continue; // totals have no account id
      const acc = byId.get(id);
      const net = amount(cells[debitCol]?.value) - amount(cells[creditCol]?.value);
      lines.push({
        code: acc?.AcctNum || `QB-${id}`,
        name: acc?.Name || cells[0]?.value || '',
        type: (acc && QBO_TYPES[acc.AccountType]) || 'General',
        debit: (net > 0 ? net : 0).toFixed(2),
        credit: (net < 0 ? -net : 0).toFixed(2),
        external_id: id,
      } as TbLineInput);
    }
  };
  walk(r?.Rows?.Row ?? []);
  return lines.filter((l) => Number(l.debit) !== 0 || Number(l.credit) !== 0);
}

// ── Connections ──

type Actor = { id: string; name: string; role: UserRole; firmId: string };

/** Finishes the OAuth flow: swaps the code for tokens and links the QuickBooks company to the client. */
export async function completeQboConnection(actor: Actor, clientId: string, code: string, realmId: string): Promise<QboConnection> {
  if (!/^\d+$/.test(realmId)) throw new ServiceError('QuickBooks did not say which company was shared.', 400, 'QBO_NO_COMPANY');
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: requireConfig().redirectUri });
  const info = await qboGet<{ CompanyInfo?: { CompanyName?: string } }>(realmId, `companyinfo/${realmId}`, tokens.access_token).catch(() => null);

  const now = new Date();
  db.qbo_connections = db.qbo_connections.filter((c) => !(c.firm_id === actor.firmId && c.client_id === clientId));
  const conn: QboConnection = {
    id: `qc_${crypto.randomUUID()}`,
    firm_id: actor.firmId,
    client_id: clientId,
    realm_id: realmId,
    company_name: info?.CompanyInfo?.CompanyName || `QuickBooks company ${realmId}`,
    access_token_enc: encryptToken(tokens.access_token),
    refresh_token_enc: encryptToken(tokens.refresh_token),
    expires_at: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
    connected_by: actor.id,
    connected_at: now.toISOString(),
    last_synced_at: null,
  };
  db.qbo_connections.push(conn);

  const client = db.clients.find((c) => c.id === clientId);
  if (client) {
    client.data_source = 'quickbooks';
    client.reconnect_needed = false;
  }
  db.logAudit(actor.firmId, actor, 'QBO_CONNECTED', 'clients', clientId, null, { realm_id: realmId, company_name: conn.company_name });
  return conn;
}

/** A usable access token, refreshing (and saving the rotated refresh token) when it has expired. */
async function accessTokenFor(conn: QboConnection): Promise<string> {
  if (new Date(conn.expires_at).getTime() - 60_000 > Date.now()) return decryptToken(conn.access_token_enc);
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decryptToken(conn.refresh_token_enc) });
    conn.access_token_enc = encryptToken(t.access_token);
    conn.refresh_token_enc = encryptToken(t.refresh_token);
    conn.expires_at = new Date(Date.now() + t.expires_in * 1000).toISOString();
    return t.access_token;
  } catch (err) {
    if (err instanceof QboReconnectError) {
      const client = db.clients.find((c) => c.id === conn.client_id);
      if (client) client.reconnect_needed = true;
    }
    throw err;
  }
}

/** Pulls the trial balance for the engagement period and imports it (DAT-01, DAT-06). */
export async function pullQboTrialBalance(actor: Actor, engagementId: string): Promise<ImportResult> {
  const eng = db.engagements.find((e) => e.id === engagementId);
  if (!eng) throw new ServiceError('Engagement not found', 404, 'NOT_FOUND');
  const conn = db.qbo_connections.find((c) => c.firm_id === actor.firmId && c.client_id === eng.client_id);
  if (!conn) throw new ServiceError('This client is not connected to QuickBooks yet.', 409, 'QBO_NOT_CONNECTED');

  const token = await accessTokenFor(conn);
  const [accounts, report] = await Promise.all([
    qboGet<{ QueryResponse?: { Account?: QboAccount[] } }>(conn.realm_id, `query?query=${encodeURIComponent('select * from Account maxresults 1000')}`, token),
    qboGet<unknown>(conn.realm_id, `reports/TrialBalance?start_date=${eng.period_start}&end_date=${eng.period_end}`, token),
  ]);
  const lines = parseQboTrialBalance(report, accounts.QueryResponse?.Account ?? []);
  const out = importTrialBalance(actor, engagementId, lines, 'quickbooks');
  if (out.status < 400) conn.last_synced_at = new Date().toISOString();
  return out;
}

export function disconnectQbo(actor: Actor, clientId: string) {
  const before = db.qbo_connections.length;
  db.qbo_connections = db.qbo_connections.filter((c) => !(c.firm_id === actor.firmId && c.client_id === clientId));
  if (db.qbo_connections.length === before) throw new ServiceError('This client is not connected to QuickBooks.', 404, 'NOT_FOUND');
  db.logAudit(actor.firmId, actor, 'QBO_DISCONNECTED', 'clients', clientId, null, null);
}
