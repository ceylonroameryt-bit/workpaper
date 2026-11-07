import { STANDARD_CHART } from './standard-chart';
import { BlyntAccount } from './types/models';

const num = (c: string) => Number(c);
const standard = () => [...STANDARD_CHART].sort((a, b) => num(a.code) - num(b.code));

/** Codes a new account may take inside the section headed by a standard account, e.g. 100 → 101–119. */
export function sectionRange(baseCode: string): { from: number; to: number } | null {
  const chart = standard();
  const i = chart.findIndex((a) => a.code === baseCode);
  if (i < 0) return null;
  const next = chart[i + 1] ? num(chart[i + 1].code) : num(baseCode) + 100;
  return { from: num(baseCode) + 1, to: next - 1 };
}

/**
 * A practice's own account: it sits inside one standard section and inherits that section's
 * type, lead, statutory line and schedule. Returns an error message when the code is not allowed.
 */
export function newAccount(existing: BlyntAccount[], code: string, name: string, firmId: string): BlyntAccount | string {
  code = code.trim();
  name = name.trim();
  if (!/^\d{1,6}$/.test(code)) return 'The code must be a number.';
  if (!name) return 'Give the account a name.';
  if (existing.some((a) => a.code === code)) return `Code ${code} is already in the chart.`;
  const parent = standard().filter((a) => num(a.code) < num(code)).pop();
  if (!parent) return `Code ${code} is not inside a section of the chart.`;
  const r = sectionRange(parent.code)!;
  if (num(code) > r.to) return `Code ${code} is outside the ${parent.code} section (${r.from}–${r.to}).`;
  const { used_by_count: _u, ...base } = parent;
  return { ...base, code, name, firm_id: firmId, is_control: false, is_system: false };
}
