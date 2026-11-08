import { asPence } from '../money';
import { db } from '../server/db';
import { AccountsLine, buildAccounts } from './accounts';

export type AnalyticalView = 'pl' | 'bs';

export interface AnalyticalRow {
  key: string; // where its comment is stored: the account code, or line:<label> for a category
  code: string | null;
  name: string;
  current: bigint;
  prior: bigint | null;
  variance: bigint | null;
  percent: number | null; // null when there is no prior figure to compare with
  significant: boolean;
}

/** Rows under one category heading; the heading is null when categories are themselves the rows. */
export interface AnalyticalBlock {
  heading: string | null;
  current: bigint;
  prior: bigint | null;
  rows: AnalyticalRow[];
}

export interface AnalyticalSection {
  heading: string;
  current: bigint;
  prior: bigint | null;
  blocks: AnalyticalBlock[];
}

const abs = (n: bigint) => (n < 0n ? -n : n);
const sum = (lines: AccountsLine[], hasPrior: boolean) => ({
  current: lines.reduce((t, l) => t + l.amount, 0n),
  prior: hasPrior ? lines.reduce((t, l) => t + (l.prior ?? 0n), 0n) : null,
});

/** The P&L shows accounts by default, because nearly every overhead shares one statutory line. */
export const showsAccounts = (view: AnalyticalView, data: { show_accounts?: unknown }) => (typeof data.show_accounts === 'boolean' ? data.show_accounts : view === 'pl');

/**
 * This year against last year, by category or by account. A movement is flagged when it reaches both the
 * percentage and the amount set on the paper; one from a nil prior balance only needs the amount.
 */
export function analyticalReview(engagementId: string, view: AnalyticalView, data: { threshold_pct?: unknown; threshold_p?: unknown; show_accounts?: unknown }) {
  const a = buildAccounts(engagementId);
  const pct = Number(data.threshold_pct ?? 10) || 0;
  const minimum = asPence((data.threshold_p as string | undefined) ?? '100000');
  const eng = db.engagements.find((e) => e.id === engagementId);
  const priorEnd = db.engagements.find((e) => e.id === eng?.prior_engagement_id)?.period_end ?? '';

  const row = (key: string, code: string | null, name: string, current: bigint, prior: bigint | null): AnalyticalRow => {
    const variance = prior === null ? null : current - prior;
    const percent = variance === null || !prior ? null : (Number(variance) / Number(abs(prior))) * 100;
    const significant = variance !== null && variance !== 0n && abs(variance) >= minimum && (percent === null || Math.abs(percent) >= pct);
    return { key, code, name, current, prior, variance, percent, significant };
  };

  const byAccount = showsAccounts(view, data);
  const section = (heading: string, lines: AccountsLine[]): AnalyticalSection => ({
    heading,
    ...sum(lines, a.hasPrior),
    blocks: byAccount
      ? lines.map((l) => ({ heading: l.label, current: l.amount, prior: l.prior, rows: l.review.map((x) => row(x.code, x.code, x.name, x.amount, x.prior)) }))
      : [{ heading: null, ...sum(lines, a.hasPrior), rows: lines.map((l) => row(`line:${l.label}`, null, l.label, l.amount, l.prior)) }],
  });

  const sections =
    view === 'pl'
      ? [section('Profit and loss', a.pl)]
      : [
          section('Assets', [...a.bs.fixed, ...a.bs.current]),
          section('Liabilities', [...a.bs.creditorsShort, ...a.bs.creditorsLong, ...a.bs.provisions]),
          section('Capital and reserves', a.bs.equity),
          section('Suspense and clearing', a.bs.suspense),
        ];

  return {
    hasPrior: a.hasPrior,
    unmappedPence: a.unmappedPence,
    periodEnd: a.periodEnd,
    priorEnd: a.hasPrior ? priorEnd : '',
    sections: sections.filter((s) => s.blocks.some((b) => b.rows.length > 0)),
  };
}

export const analyticalRows = (review: ReturnType<typeof analyticalReview>) => review.sections.flatMap((s) => s.blocks).flatMap((b) => b.rows);
