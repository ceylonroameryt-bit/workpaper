import { db } from './db';
import { ServiceError } from './services';
import { Actor } from './state-guard';
import { structureFields, companyNumberError, UK_POSTCODE, UK_VAT } from '../practice-structure';
import { Firm, PracticeProfile, Regulator } from '../types/models';

/**
 * Practice onboarding wizard (after firm sign-up). Step 0 (practice details) is required and
 * saved to the firm; step 1 (team invites) uses the invites API; step 2 is the review, which
 * completes set-up.
 */

export const ONBOARDING_STEPS = 3;

const REGULATORS: Regulator[] = ['ICAEW', 'ACCA', 'ICAS', 'CAI', 'AAT', 'CIMA', 'ATT', 'CIOT'];
const STRUCTURES: PracticeProfile['structure'][] = ['llp', 'ltd', 'partnership', 'sole'];
const JURISDICTIONS: PracticeProfile['jurisdiction'][] = ['england_wales', 'scotland', 'northern_ireland'];

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const opt = (v: unknown, max = 200) => str(v, max) || undefined;
const pick = <T extends string>(v: unknown, allowed: readonly T[], label: string): T => {
  if (!allowed.includes(v as T)) throw new ServiceError(`Choose a ${label}.`);
  return v as T;
};

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
    can_edit: canSetUpPractice(actor, firm),
  };
}

function parseProfile(d: any): PracticeProfile {
  const legal = str(d.legal_name);
  if (!legal) throw new ServiceError('Enter your practice’s legal name.');
  const address = str(d.address_line, 300);
  const postcode = str(d.postcode, 10).toUpperCase();
  if (!address || !postcode) throw new ServiceError('Enter your registered office address and postcode.');
  if (!UK_POSTCODE.test(postcode)) throw new ServiceError('Enter a valid UK postcode.');
  const structure = pick(d.structure, STRUCTURES, 'practice structure');
  const jurisdiction = pick(d.jurisdiction, JURISDICTIONS, 'country');
  // LLPs and companies are on the Companies House register; partnerships and sole practitioners are not
  const companyNo = structureFields(structure).companyNumber ? (opt(d.company_number, 12) ?? '').toUpperCase().replace(/\s/g, '') : undefined;
  const companyErr = companyNumberError(structure, companyNo ?? '', jurisdiction);
  if (companyErr) throw new ServiceError(companyErr);
  const vatRegistered = d.vat_registered !== false;
  const vat = vatRegistered ? opt(d.vat_number, 20)?.toUpperCase().replace(/\s/g, '') : undefined;
  if (vatRegistered && !vat) throw new ServiceError('Enter your VAT number, or choose not registered.');
  if (vat && !UK_VAT.test(vat)) throw new ServiceError('Enter a valid UK VAT number.');
  return {
    legal_name: legal,
    trading_name: opt(d.trading_name),
    structure,
    company_number: companyNo,
    address_line: address,
    postcode,
    jurisdiction,
    regulator: pick(d.regulator, REGULATORS, 'supervisory body'),
    registration_number: opt(d.registration_number, 30),
    vat_registered: vatRegistered,
    vat_number: vat,
    phone: opt(d.phone, 30),
    logo_attachment_id: opt(d.logo_attachment_id, 100),
  };
}

/** Saves one required step and moves the wizard on. */
export function saveOnboardingStep(actor: Actor, step: number, data: unknown) {
  const firm = firmFor(actor);
  const before = { profile: firm.profile ?? null, onboarding: firm.onboarding ?? null };
  const d = (data && typeof data === 'object' ? data : {}) as any;

  if (step === 0) {
    firm.profile = parseProfile(d);
    // The practice's legal name is the firm name shown across the app
    firm.name = firm.profile.trading_name || firm.profile.legal_name;
  } else if (step !== 1 && step !== 2) {
    throw new ServiceError('Unknown set-up step.');
  }

  const done = firm.onboarding?.completed_at ?? null;
  firm.onboarding = { step: Math.max(firm.onboarding?.step ?? 0, step + 1), completed_at: done };
  db.logAudit(actor.firmId, actor, 'PRACTICE_SETUP_STEP', 'firms', firm.id, before, {
    step,
    profile: firm.profile ?? null,
    onboarding: firm.onboarding,
  });
  return getOnboarding(actor);
}

/** Finishes set-up. Practice details must have been saved. */
export function completeOnboarding(actor: Actor) {
  const firm = firmFor(actor);
  if (!firm.profile) {
    throw new ServiceError('Finish your practice details first.');
  }
  const before = { onboarding: firm.onboarding ?? null };
  firm.onboarding = { step: ONBOARDING_STEPS, completed_at: firm.onboarding?.completed_at ?? new Date().toISOString() };
  db.logAudit(actor.firmId, actor, 'PRACTICE_SETUP_COMPLETE', 'firms', firm.id, before, { onboarding: firm.onboarding });
  return getOnboarding(actor);
}
