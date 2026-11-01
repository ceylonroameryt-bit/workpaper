import { db } from './db';
import { ServiceError, services } from './services';
import { Actor } from './state-guard';
import { toPence } from '../money';
import { PACKS, packForClient } from '../workpapers/templates';
import { companyNumberError, structureForCompanyType, structureFields, UK_POSTCODE, UK_VAT } from '../practice-structure';
import { Client, CompanyType, PracticeDefaults } from '../types/models';

/**
 * Client profile (Build Order step 2) and the practice defaults. A client's answers decide which
 * working papers its engagements get; saving them brings every open engagement into line.
 */

const VAT_SCHEMES: NonNullable<Client['vat_scheme']>[] = ['standard', 'flat_rate', 'cash', 'annual'];
const SERVICES: NonNullable<Client['services']> = ['year_end', 'management', 'vat', 'payroll', 'quarterly', 'corporation_tax'];
const canManage = (actor: Actor) => ['manager', 'partner', 'admin'].includes(actor.role) || db.firms.find((f) => f.id === actor.firmId)?.owner_user_id === actor.id;

export interface PaperChanges {
  engagement_id: string;
  added: string[];
  removed: string[];
  kept: string[]; // no longer needed, but someone has worked on them, so they stay
}

/** A paper nobody has touched: not started, no ticked procedures, sign-offs or comments. */
function untouched(wpId: string): boolean {
  const wp = db.workpapers.find((w) => w.id === wpId);
  return (
    wp?.status === 'not_started' &&
    !db.procedures.some((p) => p.workpaper_id === wpId && (p.done_by || p.not_applicable_reason)) &&
    !db.signoffs.some((s) => s.workpaper_id === wpId) &&
    !db.comments.some((c) => c.workpaper_id === wpId)
  );
}

/** Brings one open engagement's papers in line with the client's profile. */
function syncPapers(engagementId: string, client: Client): PaperChanges {
  const want = new Set(packForClient(client));
  const have = db.workpapers.filter((w) => w.engagement_id === engagementId);
  const out: PaperChanges = { engagement_id: engagementId, added: [], removed: [], kept: [] };
  for (const ref of want) {
    if (!have.some((w) => w.ref === ref) && db.addWorkpaper(engagementId, ref)) out.added.push(ref);
  }
  for (const wp of have) {
    if (want.has(wp.ref)) continue;
    if (untouched(wp.id)) {
      db.workpapers = db.workpapers.filter((w) => w.id !== wp.id);
      db.procedures = db.procedures.filter((p) => p.workpaper_id !== wp.id);
      out.removed.push(wp.ref);
    } else out.kept.push(wp.ref);
  }
  return out;
}

export function updateClientProfile(actor: Actor & { clientIds?: string[] | null }, clientId: string, d: any) {
  const client = services.getClient(actor.firmId, clientId, actor.clientIds ?? null);
  if (!client) throw new ServiceError('Client not found', 404, 'NOT_FOUND');
  if (client.archived_at) throw new ServiceError('This client is archived. Restore it before changing its profile.', 409, 'ARCHIVED');

  if (!(d?.company_type in PACKS)) throw new ServiceError('Choose a company type.');
  // A field left out keeps its stored answer, so a partial save can't drop VAT or payroll papers
  const vat = typeof d.vat_registered === 'boolean' ? d.vat_registered : client.vat_registered !== false;
  const text = (k: string, max = 200) => (typeof d[k] === 'string' ? d[k].trim().slice(0, max) || undefined : client[k]);
  const jurisdiction = ['england_wales', 'scotland', 'northern_ireland'].includes(d.jurisdiction) ? d.jurisdiction : client.jurisdiction ?? 'england_wales';
  // Companies and LLPs are on the Companies House register; sole traders and partnerships are not
  const structure = structureForCompanyType(d.company_type);
  const companyNo = structureFields(structure).companyNumber ? text('company_no', 12)?.toUpperCase().replace(/\s/g, '') : undefined;
  if (companyNo) {
    const err = companyNumberError(structure, companyNo, jurisdiction);
    if (err) throw new ServiceError(err);
  }
  const postcode = text('postcode', 10)?.toUpperCase();
  if (postcode && !UK_POSTCODE.test(postcode)) throw new ServiceError('Enter a valid UK postcode.');
  const vatNumber = vat ? text('vat_number', 20)?.toUpperCase().replace(/\s/g, '') : undefined;
  if (vatNumber && !UK_VAT.test(vatNumber)) throw new ServiceError('Enter a valid UK VAT number.');
  if (vat && d.vat_scheme !== undefined && !VAT_SCHEMES.includes(d.vat_scheme)) throw new ServiceError('Choose a VAT scheme.');
  if (d.signoff_levels !== undefined && d.signoff_levels !== null && ![1, 2, 3].includes(d.signoff_levels)) throw new ServiceError('Choose the sign-off levels.');
  const firmUsers = new Set(db.memberships.filter((m) => m.firm_id === actor.firmId).map((m) => m.user_id));

  const before = { ...client };
  Object.assign(client, {
    company_type: d.company_type as CompanyType,
    company_no: companyNo,
    trading_name: text('trading_name'),
    address_line: text('address_line', 300),
    postcode,
    jurisdiction,
    year_end: typeof d.year_end === 'string' && d.year_end ? d.year_end : client.year_end,
    vat_registered: vat,
    vat_scheme: vat ? d.vat_scheme ?? client.vat_scheme ?? 'standard' : undefined,
    vat_number: vatNumber,
    payroll: typeof d.payroll === 'boolean' ? d.payroll : client.payroll !== false,
    services: Array.isArray(d.services) ? SERVICES.filter((s) => d.services.includes(s)) : client.services,
    signoff_levels: 'signoff_levels' in d ? d.signoff_levels ?? undefined : client.signoff_levels,
    team_user_ids: Array.isArray(d.team_user_ids) ? d.team_user_ids.filter((u: string) => firmUsers.has(u)) : client.team_user_ids,
  });

  const papers = db.engagements
    .filter((e) => e.client_id === client.id && e.status !== 'locked')
    .map((e) => syncPapers(e.id, client));
  db.logAudit(actor.firmId, actor, 'UPDATE_CLIENT_PROFILE', 'clients', client.id, before, { ...client, papers });
  return { client, papers };
}

/** Practice settings skeleton: reconciliation tolerance, review threshold and sign-off levels. */
export function saveFirmDefaults(actor: Actor, d: any): PracticeDefaults {
  if (!canManage(actor)) throw new ServiceError('Only a manager, partner or admin can change practice settings.', 403, 'FORBIDDEN');
  const firm = db.firms.find((f) => f.id === actor.firmId);
  if (!firm) throw new ServiceError('Practice not found', 404, 'NOT_FOUND');
  let tolerance: bigint, review: bigint;
  try {
    tolerance = toPence(String(d?.tolerance ?? ''));
    review = toPence(String(d?.review_threshold ?? ''));
  } catch {
    throw new ServiceError('Enter the tolerance and review threshold as amounts.');
  }
  if (tolerance < 0n || tolerance > 100_000n) throw new ServiceError('Set a tolerance between £0 and £1,000.');
  if (review <= 0n) throw new ServiceError('Set a review threshold above £0.');
  const levels = Number(d?.signoff_levels);
  if (![1, 2, 3].includes(levels)) throw new ServiceError('Choose the sign-off levels.');

  const before = firm.settings?.defaults ?? null;
  const defaults: PracticeDefaults = { tolerance_p: tolerance.toString(), review_threshold_p: review.toString(), signoff_levels: levels as 1 | 2 | 3 };
  firm.settings = { ...firm.settings, defaults };
  db.logAudit(actor.firmId, actor, 'UPDATE_PRACTICE_DEFAULTS', 'firms', firm.id, before, defaults);
  return defaults;
}
