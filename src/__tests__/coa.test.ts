import { describe, it, expect } from 'vitest';
import { newAccount, nextCode, categoryOf, CATEGORIES, newAccountBase, similarAccounts, accountsForClient } from '@/lib/coa';
import { matchBlyntAccount, getStatutoryDetails } from '@/lib/mapping/auto-mapper';
import { db } from '@/lib/server/db';
import { OWNER_ACCOUNTS, STANDARD_CHART } from '@/lib/standard-chart';
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

  it('recommends a code for an expense the chart lacks, skips used codes and spots duplicates', () => {
    const rec = (name: string, codes = chart) => {
      const base = newAccountBase(name)!;
      return nextCode(codes, categoryOf(base)!, base);
    };
    const with421 = [...chart, { ...chart[0], code: '421', name: 'Cleaning and waste removal' }];
    const with331 = [...chart, { ...chart[0], code: '331', name: 'Entertainment - 100% business' }];
    expect(rec('Cleaning & Waste Removal')).toBe('421');
    expect(rec('Cleaning', with421)).toBe('422');
    expect(rec('Entertainment-100% business')).toBe('331');
    expect(rec('Entertainment - client', with331)).toBe('332');
    expect(newAccount(chart, '420', 'Dup', 'f1')).toMatch(/Next free: 421/);
    expect(similarAccounts(with421, 'Cleaning')[0].code).toBe('421');
    expect(similarAccounts(chart, 'Cleaning')).toEqual([]);
  });

  it('shows each client the chart for its business type and its own accounts, leaving the blueprint alone', () => {
    const own = newAccount(chart, '331', 'Entertainment', 'f1', '330', 'ems') as (typeof chart)[number];
    const all = [...chart, ...OWNER_ACCOUNTS, own];
    const codes = (id: string, company_type: string) => accountsForClient(all, { id, company_type }).map((a) => a.code);

    const sole = codes('ems', 'Sole trader');
    expect(sole).toEqual(expect.arrayContaining(['851', '852', '331', '100']));
    expect(sole).not.toContain('850');
    expect(sole).not.toContain('795');
    expect(sole).not.toContain('853');

    const ltd = codes('other', 'Small company (FRS 102 1A)');
    expect(ltd).toEqual(expect.arrayContaining(['850', '795']));
    expect(ltd).not.toContain('851');
    expect(ltd).not.toContain('331'); // another client's account
    expect(codes('x', 'Partnership')).toContain('855');
    expect(codes('x', 'LLP (FRS 102 + LLP SORP)')).toContain('858');
    expect(accountsForClient(all)).toHaveLength(all.length); // the library still shows everything
    expect(STANDARD_CHART).toHaveLength(96);
  });

  it('maps owner accounts by business type only', () => {
    expect(matchBlyntAccount('Owner A Drawings', 'Equity', '880', 'sole')!.blynt_code).toBe('852');
    expect(matchBlyntAccount('Owner A Funds Introduced', 'Equity', '881', 'sole')!.blynt_code).toBe('851');
    expect(matchBlyntAccount('Partners Current Account', 'Equity', '', 'partnership')!.blynt_code).toBe('854');
    expect(matchBlyntAccount('Drawings', 'Equity', '', 'ltd')!.blynt_code).toBe('890');
    expect(getStatutoryDetails('852').is_credit_area).toBe(false);
  });

  it('adds owner accounts on load without replacing a practice account on the same code', () => {
    const mine = { ...chart[0], code: '851', name: 'My account', is_system: false, firm_id: 'f1' };
    db.importState({ blynt_accounts: [mine] });
    expect(db.blynt_accounts.filter((a) => a.code === '851').map((a) => a.name)).toEqual(['My account']);
    expect(db.blynt_accounts.some((a) => a.code === '852')).toBe(true);
    db.importState({ blynt_accounts: [] });
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
    const foreign = JSON.parse(JSON.stringify(firmSlice(full, 'f1', 'u1')));
    foreign.blynt_accounts.push({ code: '105', name: 'Online sales', client_id: 'someone_elses' });
    expect(() => mergeFirmState(full, foreign, actor)).toThrow(GuardError);
  });
});
