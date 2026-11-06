import { db } from '../server/db';
import { asPence } from '../money';
import { JOURNAL_IN_TB } from '../types/models';

/**
 * Accounts built from an engagement's confirmed trial balance plus journals in the TB,
 * grouped by each chart account's statutory line. Amounts are in pence; debit is positive.
 */

export interface AccountsLine {
  label: string;
  amount: bigint; // shown sign: income, liabilities and capital are positive
  prior: bigint | null;
  accounts: { code: string; name: string; amount: bigint }[];
}

export interface Accounts {
  periodEnd: string;
  hasPrior: boolean;
  pl: AccountsLine[];
  grossProfit: { amount: bigint; prior: bigint | null } | null;
  profitBeforeTax: { amount: bigint; prior: bigint | null };
  profit: { amount: bigint; prior: bigint | null };
  bs: Record<'fixed' | 'current' | 'creditorsShort' | 'creditorsLong' | 'provisions' | 'equity' | 'suspense', AccountsLine[]>;
  netCurrentAssets: { amount: bigint; prior: bigint | null };
  totalLessCurrent: { amount: bigint; prior: bigint | null };
  netAssets: { amount: bigint; prior: bigint | null };
  capitalAndReserves: { amount: bigint; prior: bigint | null };
  unmappedPence: bigint; // balances not yet confirmed to a chart account
}

const SHORT_CREDITORS = new Set([
  'Creditors: amounts due within one year', 'Creditors: trade', 'Accruals and deferred income', 'Other creditors',
  'Other creditors - wages', 'Taxation and social security', 'Corporation tax payable', 'Amounts owed to group undertakings',
]);

/** Final balance per chart code for one engagement. */
function balances(engagementId: string) {
  const by = new Map<string, bigint>();
  const add = (code: string | null | undefined, p: bigint) => code && by.set(code, (by.get(code) ?? 0n) + p);
  let unmapped = 0n;
  const inChart = new Set(db.blynt_accounts.map((a) => a.code));
  for (const m of db.account_mappings.filter((x) => x.engagement_id === engagementId)) {
    // A code no longer in the chart (e.g. from an older chart) is not a usable mapping
    if (m.status === 'confirmed' && m.blynt_code && inChart.has(m.blynt_code)) add(m.blynt_code, asPence(m.balance_p));
    else unmapped += asPence(m.balance_p);
  }
  for (const a of db.adjustments.filter((x) => x.engagement_id === engagementId && JOURNAL_IN_TB.includes(x.status))) {
    for (const l of a.lines) add(l.blynt_code, asPence(l.debit_p) - asPence(l.credit_p));
  }
  return { by, unmapped };
}

type Section = keyof Accounts['bs'] | 'pl';
function sectionOf(code: string, line: string): Section {
  const n = Number(code);
  if (n < 600) return 'pl';
  if (n >= 900) return 'suspense';
  if (n >= 850) return 'equity';
  if (line === 'Creditors: amounts due after one year') return 'creditorsLong';
  if (line === 'Provisions for liabilities') return 'provisions';
  if (SHORT_CREDITORS.has(line)) return 'creditorsShort';
  if (n >= 650 && n < 700) return 'fixed';
  return 'current';
}

// Shown positive: income, creditors, provisions and capital (credit balances)
const CREDIT_SHOWN: Section[] = ['pl', 'creditorsShort', 'creditorsLong', 'provisions', 'equity'];

export function buildAccounts(engagementId: string): Accounts {
  const eng = db.engagements.find((e) => e.id === engagementId);
  const cur = balances(engagementId);
  const priorBalances = eng?.prior_engagement_id ? balances(eng.prior_engagement_id) : null;
  // No prior column when the prior engagement has no figures
  const prev = priorBalances && [...priorBalances.by.values()].some((v) => v !== 0n) ? priorBalances : null;

  const groups = new Map<string, { section: Section; line: AccountsLine; order: number }>();
  const codes = new Set([...cur.by.keys(), ...(prev ? prev.by.keys() : [])]);
  for (const code of [...codes].sort((a, b) => Number(a) - Number(b))) {
    const acc = db.blynt_accounts.find((a) => a.code === code);
    const label = acc?.statutory_line || acc?.name || `Account ${code}`;
    const section = sectionOf(code, label);
    const sign = CREDIT_SHOWN.includes(section) ? -1n : 1n;
    const key = `${section}|${label}`;
    if (!groups.has(key)) groups.set(key, { section, order: Number(code), line: { label, amount: 0n, prior: prev ? 0n : null, accounts: [] } });
    const g = groups.get(key)!;
    const amount = (cur.by.get(code) ?? 0n) * sign;
    g.line.amount += amount;
    if (prev) g.line.prior = (g.line.prior ?? 0n) + (prev.by.get(code) ?? 0n) * sign;
    if (amount !== 0n) g.line.accounts.push({ code, name: acc?.name ?? code, amount });
  }

  const nonZero = (l: AccountsLine) => l.amount !== 0n || (l.prior ?? 0n) !== 0n;
  const lines = (s: Section) => [...groups.values()].filter((g) => g.section === s && nonZero(g.line)).sort((a, b) => a.order - b.order).map((g) => g.line);
  const sum = (ls: AccountsLine[]) => ({ amount: ls.reduce((t, l) => t + l.amount, 0n), prior: prev ? ls.reduce((t, l) => t + (l.prior ?? 0n), 0n) : null });
  const minus = (a: { amount: bigint; prior: bigint | null }, b: { amount: bigint; prior: bigint | null }) => ({ amount: a.amount - b.amount, prior: a.prior === null || b.prior === null ? null : a.prior - b.prior });
  const plus = (a: { amount: bigint; prior: bigint | null }, b: { amount: bigint; prior: bigint | null }) => minus(a, { amount: -b.amount, prior: b.prior === null ? null : -b.prior });

  const pl = lines('pl');
  const gpLines = pl.filter((l) => l.label === 'Turnover' || l.label === 'Cost of sales');
  const bs = {
    fixed: lines('fixed'), current: lines('current'), creditorsShort: lines('creditorsShort'), creditorsLong: lines('creditorsLong'),
    provisions: lines('provisions'), equity: lines('equity'), suspense: lines('suspense'),
  };
  const profit = sum(pl);
  const netCurrentAssets = minus(plus(sum(bs.current), sum(bs.suspense)), sum(bs.creditorsShort));
  const totalLessCurrent = plus(sum(bs.fixed), netCurrentAssets);
  return {
    periodEnd: eng?.period_end ?? '',
    hasPrior: Boolean(prev),
    pl,
    grossProfit: gpLines.length === 2 ? sum(gpLines) : null,
    profitBeforeTax: sum(pl.filter((l) => l.label !== 'Tax on profit')),
    profit,
    bs,
    netCurrentAssets,
    totalLessCurrent,
    netAssets: minus(minus(totalLessCurrent, sum(bs.creditorsLong)), sum(bs.provisions)),
    // The year's profit is not yet closed into reserves, so it is added to capital here
    capitalAndReserves: plus(sum(bs.equity), profit),
    unmappedPence: cur.unmapped,
  };
}
