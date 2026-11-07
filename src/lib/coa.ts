import { STANDARD_CHART } from './standard-chart';
import { BlyntAccount } from './types/models';

export interface CoaCategory {
  name: string;
  from: number;
  to: number;
  /** The standard account a new code is classified like when nothing more specific is chosen */
  other: string;
}

/** Number ranges of the chart. A new account must stay inside its category's range. */
export const CATEGORIES: CoaCategory[] = [
  { name: 'Revenue', from: 100, to: 199, other: '140' },
  { name: 'Cost of sales', from: 200, to: 299, other: '290' },
  { name: 'Staff costs', from: 300, to: 399, other: '390' },
  { name: 'Administrative expenses', from: 400, to: 499, other: '499' },
  { name: 'Finance costs and tax', from: 500, to: 599, other: '510' },
  { name: 'Bank and cash', from: 600, to: 649, other: '649' },
  { name: 'Fixed assets', from: 650, to: 699, other: '650' },
  { name: 'Current assets', from: 700, to: 749, other: '749' },
  { name: 'Current liabilities', from: 750, to: 799, other: '770' },
  { name: 'Long-term liabilities', from: 800, to: 849, other: '830' },
  { name: 'Equity', from: 850, to: 899, other: '880' },
];

export const categoryOf = (code: string | number) => CATEGORIES.find((c) => Number(code) >= c.from && Number(code) <= c.to) ?? null;

/** Standard accounts a new code in this category can be classified like. */
export const accountsIn = (cat: CoaCategory) => STANDARD_CHART.filter((a) => categoryOf(a.code) === cat);

/** The next free code after the base account, or from the start of the range when the rest is full. */
export function nextCode(existing: { code: string }[], cat: CoaCategory, base = cat.other): string | null {
  const used = new Set(existing.map((a) => Number(a.code)));
  const start = Math.max(cat.from, Number(base) + 1);
  for (let n = start; n <= cat.to; n++) if (!used.has(n)) return String(n);
  for (let n = cat.from; n < start; n++) if (!used.has(n)) return String(n);
  return null;
}

/**
 * A practice's own account. It inherits type, lead, statutory line and schedule from a standard
 * account in the same category (the chosen base, else the category's "Other" account).
 * Returns an error message when the code is not allowed.
 */
export function newAccount(existing: BlyntAccount[], code: string, name: string, firmId: string, baseCode?: string): BlyntAccount | string {
  code = code.trim();
  name = name.trim();
  if (!/^\d{1,6}$/.test(code)) return 'The code must be a number.';
  if (!name) return 'Give the account a name.';
  if (existing.some((a) => a.code === code)) return `Code ${code} is already in the chart.`;
  const cat = categoryOf(code);
  if (!cat) return `Code ${code} is outside every category of the chart.`;
  const want = baseCode ? categoryOf(baseCode) : cat;
  if (want !== cat) return want ? `Code ${code} must be within ${want.from}–${want.to} (${want.name}).` : `Code ${baseCode} is not a standard account.`;
  const parent = STANDARD_CHART.find((a) => a.code === baseCode) ?? STANDARD_CHART.find((a) => a.code === cat.other)!;
  const { used_by_count: _u, ...base } = parent;
  return { ...base, code, name, firm_id: firmId, parent_code: parent.code, is_control: false, is_system: false };
}
