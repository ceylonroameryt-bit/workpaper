import { describe, it, expect } from 'vitest';
import { newAccount, nextCode, categoryOf, CATEGORIES } from '@/lib/coa';
import { STANDARD_CHART } from '@/lib/standard-chart';
import { mergeFirmState, firmSlice, GuardError, State } from '@/lib/server/state-guard';

const chart = STANDARD_CHART.map((a) => ({ ...a }));

describe('practice accounts in the chart', () => {
  it('stay inside their section and inherit it', () => {
    // Every "Other" account sits in its own category
    for (const c of CATEGORIES) expect(categoryOf(c.other)).toBe(c);
    const revenue = categoryOf('100')!;
    expect(nextCode(chart, revenue)).toBe('141'); // next after the Other account 140
    expect(nextCode(chart, revenue, '100')).toBe('101');
    const acc = newAccount(chart, '105', 'Online sales', 'f1', '100');
    expect(acc).toMatchObject({ code: '105', type: 'Revenue', lead_letter: 'A', firm_id: 'f1', parent_code: '100', is_system: false });
    expect(newAccount(chart, '150', 'Misc income', 'f1')).toMatchObject({ parent_code: '140' });
    expect(newAccount(chart, '205', 'Wrong range', 'f1', '100')).toMatch(/within 100–199/);
    expect(newAccount(chart, '950', 'System', 'f1')).toMatch(/outside/);
    expect(newAccount(chart, '110', 'Dup', 'f1')).toMatch(/already/);
    expect(newAccount(chart, 'abc', 'x', 'f1')).toMatch(/number/);
  });

  it('the server keeps a firm\'s new account to that firm and refuses a bad one', () => {
    const full: State = { firms: [{ id: 'f1' }, { id: 'f2' }], memberships: [{ firm_id: 'f1', user_id: 'u1', role: 'admin' }], users: [{ id: 'u1' }], blynt_accounts: chart };
    const actor = { id: 'u1', name: 'A', role: 'admin' as const, firmId: 'f1' };
    const v = JSON.parse(JSON.stringify(firmSlice(full, 'f1', 'u1')));
    v.blynt_accounts.push({ code: '105', name: 'Online sales', type: 'Equity', firm_id: 'f2' });
    const out = mergeFirmState(full, v, actor);
    expect(out.blynt_accounts.find((a) => a.code === '105')).toMatchObject({ firm_id: 'f1', type: 'Revenue' });
    expect(firmSlice(out, 'f2').blynt_accounts.some((a) => a.code === '105')).toBe(false);
    const bad = JSON.parse(JSON.stringify(firmSlice(full, 'f1', 'u1')));
    bad.blynt_accounts.push({ code: 'zz', name: 'x' });
    expect(() => mergeFirmState(full, bad, actor)).toThrow(GuardError);
  });
});
