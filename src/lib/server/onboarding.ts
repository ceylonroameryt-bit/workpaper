import { db } from './db';
import { ServiceError } from './services';
import { Actor } from './state-guard';
import { toPence } from '../money';
import { Firm, PracticeDefaults, PracticeProfile, PracticeWorkProfile, Regulator } from '../types/models';

/**
 * Practice onboarding wizard (after firm sign-up). Steps 0-2 are required and saved to the
 * firm; steps 3-4 (team invites, first clients) use the invites and clients APIs; step 5 is
 * the review, which completes set-up.
 */

export const ONBOARDING_STEPS = 6;

const REGULATORS: Regulator[] = ['ICAEW', 'ACCA', 'ICAS', 'CAI', 'AAT', 'CIMA', 'ATT', 'CIOT'];
const STRUCTURES: PracticeProfile['structure'][] = ['llp', 'ltd', 'partnership', 'sole'];
const JURISDICTIONS: PracticeProfile['jurisdiction'][] = ['england_wales', 'scotland', 'northern_ireland'];
const STANDARDS: PracticeWorkProfile['standards'] = ['FRS 105', 'FRS 102 1A', 'FRS 102', 'IFRS', 'Charities SORP'];
const SERVICES: PracticeWorkProfile['services'] = ['year_end', 'management', 'vat', 'payroll', 'quarterly', 'corporation_tax'];
const SOFTWARE: PracticeWorkProfile['software'] = ['xero', 'qbo', 'sage', 'freeagent', 'spreadsheets'];
const CLIENT_COUNTS: PracticeWorkProfile['client_count'][] = ['1-50', '51-200', '201-500', '500+'];
const TEAM_SIZES: PracticeWorkProfile['team_size'][] = ['1', '2-10', '11-50', '50+'];
const YEAR_ENDS: PracticeDefaults['year_end'][] = ['per_client', '03-31', '12-31'];
const DEFAULT_STANDARDS: PracticeDefaults['standard'][] = ['FRS 105', 'FRS 102 1A', 'FRS 102'];

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const opt = (v: unknown, max = 200) => str(v, max) || undefined;
const pick = <T extends string>(v: unknown, allowed: readonly T[], label: string): T => {
  if (!allowed.includes(v as T)) throw new ServiceError(`Choose a ${label}.`);
  return v as T;
};
const pickMany = <T extends string>(v: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => allowed.includes(x)))] : [];

/** Admins, partners and the person who created the firm may run set-up. */
export function canSetUpPractice(actor: Actor, firm: Firm | undefined): boolean {
  return Boolean(firm && (actor.role === 'admin' || actor.role === 'partner' || firm.owner_user_id === actor.id));
}

function firmFor(actor: Actor): Firm {
  const firm = db.firms.find((f) => f.id === actor.firmId);
  if (!firm) throw new ServiceError('Practice not found', 404, 'NOT_FOUND');
  if (!canSetUpPractice(actor, firm)) throw new ServiceError('Only a practice admin or partner can change practice set-up.', 403, 'FORBIDDEN');
  return firm;
}

export function getOnboarding(actor: Actor) {
  const firm = db.firms.find((f) => f.id === actor.firmId);
  if (!firm) throw new ServiceError('Practice not found', 404, 'NOT_FOUND');
  return {
    firm_name: firm.name,
    onboarding: firm.onboarding ?? { step: ONBOARDING_STEPS, completed_at: firm.created_at },
    profile: firm.profile ?? null,
    work: firm.settings?.work ?? null,
    defaults: firm.settings?.defaults ?? null,
    can_edit: canSetUpPractice(actor, firm),
  };
}

function parseProfile(d: any): PracticeProfile {
  const legal = str(d.legal_name);
  if (!legal) throw new ServiceError('Enter your practice’s legal name.');
  const address = str(d.address_line, 300);
  const postcode = str(d.postcode, 10).toUpperCase();
  if (!address || !postcode) throw new ServiceError('Enter your registered office address and postcode.');
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(postcode)) throw new ServiceError('Enter a valid UK postcode.');
  const structure = pick(d.structure, STRUCTURES, 'practice structure');
  const companyNo = opt(d.company_number, 10)?.toUpperCase();
  // LLPs and companies are on the Companies House register; partnerships and sole practitioners are not
  if ((structure === 'llp' || structure === 'ltd') && !companyNo) throw new ServiceError('Enter your Companies House number.');
  if (companyNo && !/^(OC|SC|NI|SO|NC|R0)?\d{6,8}$/.test(companyNo.replace(/\s/g, ''))) throw new ServiceError('Enter a valid Companies House number.');
  const vatRegistered = d.vat_registered !== false;
  const vat = vatRegistered ? opt(d.vat_number, 20)?.toUpperCase().replace(/\s/g, '') : undefined;
  if (vatRegistered && !vat) throw new ServiceError('Enter your VAT number, or choose not registered.');
  if (vat && !/^(GB)?(\d{9}|\d{12})$/.test(vat)) throw new ServiceError('Enter a valid UK VAT number.');
  return {
    legal_name: legal,
    trading_name: opt(d.trading_name),
    structure,
    company_number: structure === 'llp' || structure === 'ltd' ? companyNo : undefined,
    address_line: address,
    postcode,
    jurisdiction: pick(d.jurisdiction, JURISDICTIONS, 'country'),
    regulator: pick(d.regulator, REGULATORS, 'supervisory body'),
    registration_number: opt(d.registration_number, 30),
    vat_registered: vatRegistered,
    vat_number: vat,
    phone: opt(d.phone, 30),
    logo_attachment_id: opt(d.logo_attachment_id, 100),
  };
}

function parseWork(d: any): PracticeWorkProfile {
  const standards = pickMany(d.standards, STANDARDS);
  if (!standards.length) throw new ServiceError('Choose at least one reporting standard.');
  const services = pickMany(d.services, SERVICES);
  if (!services.length) throw new ServiceError('Choose at least one service.');
  return {
    standards,
    services,
    software: pickMany(d.software, SOFTWARE),
    client_count: pick(d.client_count, CLIENT_COUNTS, 'number of clients'),
    team_size: pick(d.team_size, TEAM_SIZES, 'team size'),
  };
}

function parseDefaults(d: any): PracticeDefaults {
  const tolerance = toPence(String(d.tolerance ?? ''));
  const review = toPence(String(d.review_threshold ?? ''));
  if (tolerance < 0n || tolerance > 100_000n) throw new ServiceError('Set a tolerance between £0 and £1,000.');
  if (review <= 0n) throw new ServiceError('Set a review threshold above £0.');
  const levels = Number(d.signoff_levels);
  if (![1, 2, 3].includes(levels)) throw new ServiceError('Choose your sign-off levels.');
  return {
    year_end: pick(d.year_end, YEAR_ENDS, 'default year end'),
    standard: pick(d.standard, DEFAULT_STANDARDS, 'default standard'),
    tolerance_p: tolerance.toString(),
    review_threshold_p: review.toString(),
    signoff_levels: levels as 1 | 2 | 3,
  };
}

/** Saves one required step and moves the wizard on. */
export function saveOnboardingStep(actor: Actor, step: number, data: unknown) {
  const firm = firmFor(actor);
  const before = { profile: firm.profile ?? null, settings: firm.settings ?? null, onboarding: firm.onboarding ?? null };
  const d = (data && typeof data === 'object' ? data : {}) as any;

  if (step === 0) {
    firm.profile = parseProfile(d);
    // The practice's legal name is the firm name shown across the app
    firm.name = firm.profile.trading_name || firm.profile.legal_name;
  } else if (step === 1) {
    firm.settings = { ...firm.settings, work: parseWork(d) };
  } else if (step === 2) {
    firm.settings = { ...firm.settings, defaults: parseDefaults(d) };
  } else if (step !== 3 && step !== 4 && step !== 5) {
    throw new ServiceError('Unknown set-up step.');
  }

  const done = firm.onboarding?.completed_at ?? null;
  firm.onboarding = { step: Math.max(firm.onboarding?.step ?? 0, step + 1), completed_at: done };
  db.logAudit(actor.firmId, actor, 'PRACTICE_SETUP_STEP', 'firms', firm.id, before, {
    step,
    profile: firm.profile ?? null,
    settings: firm.settings ?? null,
    onboarding: firm.onboarding,
  });
  return getOnboarding(actor);
}

/** Finishes set-up. Steps 0-2 must have been saved. */
export function completeOnboarding(actor: Actor) {
  const firm = firmFor(actor);
  if (!firm.profile || !firm.settings?.work || !firm.settings?.defaults) {
    throw new ServiceError('Finish practice details, work profile and defaults first.');
  }
  const before = { onboarding: firm.onboarding ?? null };
  firm.onboarding = { step: ONBOARDING_STEPS, completed_at: firm.onboarding?.completed_at ?? new Date().toISOString() };
  db.logAudit(actor.firmId, actor, 'PRACTICE_SETUP_COMPLETE', 'firms', firm.id, before, { onboarding: firm.onboarding });
  return getOnboarding(actor);
}
