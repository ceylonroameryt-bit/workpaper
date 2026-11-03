import { CompanyType } from './types/models';
import { PACKS } from './workpapers/templates';

/**
 * Standards library (STD-01): each accounting standard as dated versions, holding what it
 * requires (schedules, disclosures, checklist questions, note templates). This is the
 * structure; the accountant fills the content in alongside the build. Required schedules come
 * from the paper packs, so the index and the library never disagree.
 */

export interface StandardDisclosure {
  code: string;
  title: string;
  requirement: string;
}

export interface StandardVersion {
  id: string;
  code: 'FRS 105' | 'FRS 102 1A' | 'FRS 102';
  name: string;
  version: string;
  effective_from: string; // periods ending on or after this date
  effective_to: string | null; // null = still in force
  company_types: CompanyType[];
  disclosures: StandardDisclosure[];
  checklist: { id: string; question: string }[];
  note_templates: { id: string; title: string; body: string }[];
}

const FRS102_1A_DISCLOSURES: StandardDisclosure[] = [
  { code: '1A.3', title: 'Basis of preparation and true and fair view', requirement: 'Statement that the accounts comply with FRS 102 Section 1A and the Companies Act 2006.' },
  { code: '1A.17', title: 'Tangible fixed assets and depreciation', requirement: 'Measurement at cost or revalued amount; depreciation rates and movements by class.' },
  { code: '1A.33', title: 'Directors’ advances and related parties', requirement: 'Advances, interest rates, security and amounts repaid after the period end.' },
];

export const STANDARDS: StandardVersion[] = [
  {
    id: 'frs105_2024',
    code: 'FRS 105',
    name: 'FRS 105 (Micro-entities)',
    version: '2024 edition',
    effective_from: '2025-01-01',
    effective_to: null,
    company_types: ['Micro-entity (FRS 105)'],
    disclosures: [
      { code: 'FRS 105.3', title: 'Presumed true and fair view', requirement: 'The micro-entity format is legally presumed to give a true and fair view without additional disclosures.' },
      { code: 'FRS 105.12', title: 'No deferred tax', requirement: 'Deferred tax is not recognised; only the current corporation tax liability.' },
    ],
    checklist: [{ id: 'frs105_q1', question: 'Does the company still meet the micro-entity size thresholds for this period and the one before?' }],
    note_templates: [{ id: 'frs105_n1', title: 'Advances, credits and guarantees to directors', body: '' }],
  },
  {
    id: 'frs102_1a_2022',
    code: 'FRS 102 1A',
    name: 'FRS 102 Section 1A (Small entities)',
    version: '2022 edition',
    effective_from: '2023-01-01',
    effective_to: '2025-12-31',
    company_types: ['Small company (FRS 102 1A)'],
    disclosures: FRS102_1A_DISCLOSURES,
    checklist: [{ id: 'frs1021a_q1', question: 'Does the company meet the small company thresholds for this period?' }],
    note_templates: [{ id: 'frs1021a_n1', title: 'Accounting policies', body: '' }],
  },
  {
    id: 'frs102_1a_2024',
    code: 'FRS 102 1A',
    name: 'FRS 102 Section 1A (Small entities)',
    version: '2024 amendments',
    effective_from: '2026-01-01',
    effective_to: null,
    company_types: ['Small company (FRS 102 1A)'],
    disclosures: [
      ...FRS102_1A_DISCLOSURES,
      { code: '1A.20 (2024)', title: 'Leases: right-of-use model', requirement: 'Lease liability and right-of-use asset on the balance sheet; short-term and low-value exemptions.' },
    ],
    checklist: [
      { id: 'frs1021a_q1', question: 'Does the company meet the small company thresholds for this period?' },
      { id: 'frs1021a_q2', question: 'Have leases been moved to the right-of-use model from 1 January 2026?' },
    ],
    note_templates: [{ id: 'frs1021a_n1', title: 'Accounting policies', body: '' }],
  },
  {
    id: 'frs102_full_2024',
    code: 'FRS 102',
    name: 'FRS 102 (full standard)',
    version: '2024 amendments',
    effective_from: '2026-01-01',
    effective_to: null,
    company_types: ['Medium/large (FRS 102)', 'LLP (FRS 102 + LLP SORP)'],
    disclosures: [
      { code: 'Section 7', title: 'Statement of cash flows', requirement: 'Cash flows from operating, investing and financing activities.' },
      { code: 'Section 29', title: 'Income tax and deferred tax', requirement: 'Deferred tax on all timing differences and unused tax losses.' },
    ],
    checklist: [{ id: 'frs102_q1', question: 'Is a cash flow statement required, or is an exemption available?' }],
    note_templates: [{ id: 'frs102_n1', title: 'Accounting policies', body: '' }],
  },
];

/** The version of the standard that applies to a period ending on `periodEnd`; null when none does (e.g. sole traders). */
export function standardFor(companyType: string | undefined, periodEnd: string): StandardVersion | null {
  return (
    STANDARDS.find(
      (s) => s.company_types.includes(companyType as CompanyType) && s.effective_from <= periodEnd && (!s.effective_to || periodEnd <= s.effective_to)
    ) ?? null
  );
}

/** The schedules a standard requires, from the paper pack of its first company type. */
export const requiredSchedules = (s: StandardVersion): string[] => PACKS[s.company_types[0]] ?? [];
