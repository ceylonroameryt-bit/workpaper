// What the practice set-up step asks for, by legal structure. Shared by the
// onboarding page and the server so both apply the same rules.
export type Structure = 'llp' | 'ltd' | 'partnership' | 'sole';
export type Jurisdiction = 'england_wales' | 'scotland' | 'northern_ireland' | string;

export interface StructureFields {
  legalLabel: string;
  legalPlaceholder: string;
  tradingLabel: string;
  companyNumber: boolean;
  companyPlaceholder: (j: Jurisdiction) => string;
  addressLabel: string;
  regulatorHint: string;
}

// Companies House prefixes: LLPs OC/SO/NC; companies digits/SC/NI
const LLP_PREFIX: Record<string, string> = { england_wales: 'OC', scotland: 'SO', northern_ireland: 'NC' };
const LTD_PREFIX: Record<string, string> = { england_wales: '', scotland: 'SC', northern_ireland: 'NI' };

const FIELDS: Record<Structure, StructureFields> = {
  llp: {
    legalLabel: 'Registered LLP name',
    legalPlaceholder: 'Wright and Co LLP',
    tradingLabel: 'Trading name',
    companyNumber: true,
    companyPlaceholder: (j) => `${LLP_PREFIX[j] ?? 'OC'}123456`,
    addressLabel: 'Registered office',
    regulatorHint: 'The body your designated members are registered with.',
  },
  ltd: {
    legalLabel: 'Registered company name',
    legalPlaceholder: 'Wright Accountants Ltd',
    tradingLabel: 'Trading name',
    companyNumber: true,
    companyPlaceholder: (j) => (LTD_PREFIX[j] ? `${LTD_PREFIX[j]}123456` : '01234567'),
    addressLabel: 'Registered office',
    regulatorHint: 'The body your directors are registered with.',
  },
  partnership: {
    legalLabel: 'Partnership name',
    legalPlaceholder: 'Wright & Co',
    tradingLabel: 'Trading name',
    companyNumber: false,
    companyPlaceholder: () => '',
    addressLabel: 'Principal place of business',
    regulatorHint: 'The body your partners are registered with.',
  },
  sole: {
    legalLabel: 'Your full name',
    legalPlaceholder: 'Jane Wright',
    tradingLabel: 'Trading as',
    companyNumber: false,
    companyPlaceholder: () => '',
    addressLabel: 'Business address',
    regulatorHint: 'The body you hold your practising certificate with.',
  },
};

export const structureFields = (s: string): StructureFields => FIELDS[(s as Structure) in FIELDS ? (s as Structure) : 'llp'];

/** '' when valid, otherwise a message to show. */
export function companyNumberError(structure: string, value: string, jurisdiction: Jurisdiction): string {
  if (!structureFields(structure).companyNumber) return '';
  const v = value.replace(/\s/g, '').toUpperCase();
  if (!v) return 'Enter your Companies House number.';
  if (structure === 'llp') {
    const prefix = LLP_PREFIX[jurisdiction] ?? 'OC';
    return new RegExp(`^${prefix}\\d{6}$`).test(v) ? '' : `LLP numbers start ${prefix} followed by 6 digits, e.g. ${prefix}123456.`;
  }
  const prefix = LTD_PREFIX[jurisdiction] ?? '';
  if (prefix) return new RegExp(`^${prefix}\\d{6}$`).test(v) ? '' : `Company numbers here start ${prefix} followed by 6 digits, e.g. ${prefix}123456.`;
  return /^\d{8}$/.test(v) ? '' : 'Company numbers are 8 digits, e.g. 01234567.';
}
