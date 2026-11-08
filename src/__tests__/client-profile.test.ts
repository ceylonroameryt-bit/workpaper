// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({
  syncIn: async () => {},
  syncOut: async () => {},
  currentVersion: () => 1,
  hasDatabase: () => false,
}));

import { db } from '../lib/server/db';
import { packForClient } from '../lib/workpapers/templates';
import { updateClientProfile, saveFirmDefaults } from '../lib/server/client-profile';
import { createSessionToken, SESSION_COOKIE } from '../lib/server/auth';
import { PATCH } from '../app/api/v1/clients/[id]/route';

const FIRM = 'firm_blynt_uk';
const admin = { id: 'usr_admin', name: 'Admin', role: 'admin' as const, firmId: FIRM };
const CLIENT = 'cli_harlow';
const ENG = 'eng_harlow_fy26';
const refs = (engId: string) => db.workpapers.filter((w) => w.engagement_id === engId).map((w) => w.ref);

beforeEach(() => db.seed(true));

describe('papers follow the client profile', () => {
  it('the standard picks the pack; no VAT drops T-20, no payroll drops P-20', () => {
    const small = packForClient({ company_type: 'Small company (FRS 102 1A)', vat_registered: true, payroll: true });
    expect(small).toContain('T-20');
    expect(small).toContain('P-20');
    const lean = packForClient({ company_type: 'Small company (FRS 102 1A)', vat_registered: false, payroll: false });
    expect(lean).not.toContain('T-20');
    expect(lean).not.toContain('P-20');
    expect(packForClient({ company_type: 'Sole trader' })).toEqual(['A-10', 'B-10', 'C-10', 'K-10', 'I-10', 'P-10', 'Z-10', 'Z-30', 'Z-40']);
  });

  it('saving the profile updates open engagements: adds new papers, removes untouched ones', () => {
    const wp = (ref: string) => db.workpapers.find((w) => w.engagement_id === ENG && w.ref === ref);
    db.workpapers = db.workpapers.filter((w) => !(w.engagement_id === ENG && w.ref === 'T-20'));
    if (wp('P-20')) wp('P-20')!.status = 'not_started';
    db.signoffs = db.signoffs.filter((s) => s.workpaper_id !== wp('P-20')?.id);
    db.comments = db.comments.filter((c) => c.workpaper_id !== wp('P-20')?.id);
    db.procedures.filter((p) => p.workpaper_id === wp('P-20')?.id).forEach((p) => (p.done_by = null));

    const out = updateClientProfile(admin, CLIENT, { company_type: 'Small company (FRS 102 1A)', vat_registered: true, vat_scheme: 'standard', payroll: false });
    expect(refs(ENG)).toContain('T-20'); // VAT registered: added
    expect(refs(ENG)).not.toContain('P-20'); // no payroll and untouched: removed
    expect(out.papers.find((p) => p.engagement_id === ENG)).toMatchObject({ added: ['T-20'], removed: ['P-20'] });
    expect(db.clients.find((c) => c.id === CLIENT)).toMatchObject({ vat_registered: true, payroll: false });
  });

  it('never removes a paper someone has worked on, and leaves locked engagements alone', () => {
    const p20 = db.workpapers.find((w) => w.engagement_id === ENG && w.ref === 'P-20')!;
    p20.status = 'in_progress';
    const locked = db.engagements.find((e) => e.client_id === CLIENT && e.id !== ENG);
    if (locked) locked.status = 'locked';
    const lockedBefore = locked ? refs(locked.id) : [];

    const out = updateClientProfile(admin, CLIENT, { company_type: 'Small company (FRS 102 1A)', vat_registered: true, payroll: false });
    expect(refs(ENG)).toContain('P-20');
    expect(out.papers.find((p) => p.engagement_id === ENG)!.kept).toContain('P-20');
    if (locked) expect(refs(locked.id)).toEqual(lockedBefore);
  });

  it('validates the answers', () => {
    expect(() => updateClientProfile(admin, CLIENT, { company_type: 'Nonsense' })).toThrow(/company type/);
    expect(() => updateClientProfile(admin, CLIENT, { company_type: 'Sole trader', vat_registered: true, vat_scheme: 'odd' })).toThrow(/VAT scheme/);
    expect(() => updateClientProfile(admin, CLIENT, { company_type: 'Sole trader', signoff_levels: 9 })).toThrow(/sign-off/);
    expect(() => updateClientProfile(admin, 'cli_missing', { company_type: 'Sole trader' })).toThrow(/not found/);
  });

  it('saves and checks the client details like practice details', () => {
    const base = { company_type: 'LLP (FRS 102 + LLP SORP)', vat_registered: true, payroll: true, address_line: '1 Mill Lane, York', postcode: 'yo1 7hh', jurisdiction: 'england_wales' };
    expect(() => updateClientProfile(admin, CLIENT, { ...base, company_no: '12345678' })).toThrow(/LLP numbers start OC/);
    expect(() => updateClientProfile(admin, CLIENT, { ...base, company_no: 'OC123456', postcode: 'nope' })).toThrow(/postcode/);
    expect(() => updateClientProfile(admin, CLIENT, { ...base, company_no: 'OC123456', vat_number: '123' })).toThrow(/VAT number/);
    updateClientProfile(admin, CLIENT, { ...base, company_no: 'oc123456', trading_name: 'Mill Lane', vat_number: 'GB 123 4567 89' });
    expect(db.clients.find((c) => c.id === CLIENT)).toMatchObject({ company_no: 'OC123456', postcode: 'YO1 7HH', vat_number: 'GB123456789', trading_name: 'Mill Lane' });
    // Sole traders aren't on the Companies House register
    updateClientProfile(admin, CLIENT, { company_type: 'Sole trader', company_no: 'anything' });
    expect(db.clients.find((c) => c.id === CLIENT)!.company_no).toBeUndefined();
  });

  it('a save that leaves out VAT, payroll or sign-off keeps the stored answers', () => {
    updateClientProfile(admin, CLIENT, { company_type: 'Small company (FRS 102 1A)', vat_registered: true, payroll: true, signoff_levels: 3 });
    updateClientProfile(admin, CLIENT, { company_type: 'Small company (FRS 102 1A)' });
    expect(db.clients.find((c) => c.id === CLIENT)).toMatchObject({ vat_registered: true, payroll: true, signoff_levels: 3 });
    expect(refs(ENG)).toContain('T-20');
  });

  it('the PATCH route saves through the API', async () => {
    const res = await PATCH(
      new Request(`http://localhost/api/v1/clients/${CLIENT}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: `${SESSION_COOKIE}=${createSessionToken('usr_admin')}` },
        body: JSON.stringify({ company_type: 'Sole trader', vat_registered: false, payroll: false, services: ['year_end', 'nonsense'] }),
      }),
      { params: Promise.resolve({ id: CLIENT }) }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).client).toMatchObject({ company_type: 'Sole trader', services: ['year_end'] });
  });
});

describe('practice defaults', () => {
  it('saves tolerance, review threshold and sign-off levels in pence', () => {
    saveFirmDefaults(admin, { tolerance: '1.00', review_threshold: '500', signoff_levels: 2 });
    expect(db.firms.find((f) => f.id === FIRM)!.settings?.defaults).toEqual({ tolerance_p: '100', review_threshold_p: '50000', signoff_levels: 2 });
    expect(() => saveFirmDefaults(admin, { tolerance: '-1', review_threshold: '500', signoff_levels: 2 })).toThrow(/tolerance/);
    expect(() => saveFirmDefaults(admin, { tolerance: 'abc', review_threshold: '500', signoff_levels: 2 })).toThrow(/amount/);
    expect(() => saveFirmDefaults(admin, { tolerance: '1', review_threshold: '12.345', signoff_levels: 2 })).toThrow(/amount/);
    expect(() => saveFirmDefaults({ ...admin, role: 'preparer' as const }, { tolerance: '1', review_threshold: '500', signoff_levels: 2 })).toThrow(/manager/);
  });
});
