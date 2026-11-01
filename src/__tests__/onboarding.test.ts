// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({
  syncIn: async () => {},
  syncOut: async () => {},
  currentVersion: () => 1,
  hasDatabase: () => false,
}));

import { db } from '../lib/server/db';
import { Actor } from '../lib/server/state-guard';
import { getOnboarding, saveOnboardingStep, completeOnboarding } from '../lib/server/onboarding';
import { createInvite } from '../lib/server/invites';
import { POST as signup } from '../app/api/v1/auth/signup/route';
import { MFA_COOKIE, SESSION_COOKIE } from '../lib/server/auth';

const profile = {
  legal_name: 'Wright and Co LLP',
  structure: 'llp',
  company_number: 'OC123456',
  address_line: '12 High Street, Leeds',
  postcode: 'ls1 4ab',
  jurisdiction: 'england_wales',
  regulator: 'ICAEW',
  vat_number: 'GB 123 4567 89',
};

async function newFirm(role = 'manager') {
  const res = await signup(
    new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Alex Wright', workEmail: `alex${Math.random()}@wright.co.uk`, firmName: 'Wright', role, password: 'Long-Password-1!' }),
    })
  );
  const body = await res.json();
  const actor: Actor = { id: body.user.id, name: body.user.name, role: body.role, firmId: body.firm.id };
  return { res, body, actor };
}

beforeEach(() => {
  db.seed(true);
  process.env.MFA_REQUIRED = 'true'; // these tests cover the enforced flow
});

describe('practice onboarding', () => {
  it('sign-up sends the new user to MFA set-up, not straight into a session', async () => {
    const { res, body } = await newFirm();
    expect(res.status).toBe(201);
    expect(body.mfa).toBe('setup');
    const cookie = res.headers.get('set-cookie') || '';
    expect(cookie).toContain(`${MFA_COOKIE}=`);
    expect(cookie).not.toContain(`${SESSION_COOKIE}=`);
  });

  it('a new firm goes straight into the app: there is no set-up wizard to finish', async () => {
    const { actor } = await newFirm();
    expect(getOnboarding(actor).onboarding.completed_at).not.toBeNull();
    const legacy: Actor = { id: 'usr_admin', name: 'A', role: 'admin', firmId: 'firm_blynt_uk' };
    expect(getOnboarding(legacy).onboarding.completed_at).not.toBeNull();
  });

  it('validates and saves practice details from Settings', async () => {
    const { actor } = await newFirm();
    expect(() => completeOnboarding(actor)).toThrow(/first/); // practice details not saved yet
    expect(() => saveOnboardingStep(actor, 0, { ...profile, regulator: '' })).toThrow(/supervisory body/);
    expect(() => saveOnboardingStep(actor, 0, { ...profile, postcode: 'nope' })).toThrow(/postcode/);
    expect(() => saveOnboardingStep(actor, 0, { ...profile, company_number: '' })).toThrow(/Companies House/);
    expect(() => saveOnboardingStep(actor, 0, { ...profile, company_number: '12345678' })).toThrow(/LLP numbers start OC/);
    expect(() => saveOnboardingStep(actor, 0, { ...profile, vat_number: '' })).toThrow(/VAT number/);
    // A sole practitioner who is not VAT registered needs neither
    expect(() => saveOnboardingStep(actor, 0, { ...profile, structure: 'sole', company_number: '', vat_registered: false, vat_number: '' })).not.toThrow();

    saveOnboardingStep(actor, 0, profile);
    const firm = db.firms.find((f) => f.id === actor.firmId)!;
    expect(firm.profile).toMatchObject({ postcode: 'LS1 4AB', vat_number: 'GB123456789' });
    expect(firm.name).toBe('Wright and Co LLP');

    saveOnboardingStep(actor, 1, {}); // team step: invitations go through the invites API
    expect(() => saveOnboardingStep(actor, 5, {})).toThrow(/Unknown/);

    const done = completeOnboarding(actor);
    expect(done.onboarding.completed_at).toBeTruthy();
    expect(db.audit_logs.filter((a) => a.entity_id === actor.firmId && a.action.startsWith('PRACTICE_SETUP')).length).toBe(4); // step 0 twice (sole practitioner check), 1, complete
  });

  it('the firm creator can invite their team even as a manager; other members cannot change set-up', async () => {
    const { actor } = await newFirm('manager');
    expect(() => createInvite(actor, { email: 'p@wright.co.uk', name: 'P', role: 'preparer' })).not.toThrow();

    const other: Actor = { id: 'usr_x', name: 'X', role: 'preparer', firmId: actor.firmId };
    expect(() => saveOnboardingStep(other, 0, profile)).toThrow(/admin or partner/);
  });
});
