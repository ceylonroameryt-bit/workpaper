import { db } from '@/lib/server/db';
import { BlyntAccount } from '@/lib/types/models';

export interface MappingSuggestion {
  blynt_code: string;
  name: string;
  confidence: number;
  reason: string;
  lead_letter: string;
}

/**
 * Intelligent semantic mapping of source accounts to Blynt Standard Chart of Accounts (COA).
 * Ground Rule 2 compliant: Produces high-accuracy classifications for UK GAAP / FRS 102 / IFRS trial balances.
 */
export function matchBlyntAccount(
  sourceName: string,
  sourceType: string = '',
  sourceCode: string = ''
): MappingSuggestion | null {
  const code = (sourceCode || '').trim();
  const byName = matchByName(sourceName, sourceType);
  const codeMatch = db.blynt_accounts.find((ba) => ba.code === code);
  if (!codeMatch) return strip(byName);

  const fromCode: MappingSuggestion = {
    blynt_code: codeMatch.code,
    name: codeMatch.name,
    confidence: 100,
    reason: `Code ${code} and the account name both point to ${codeMatch.name}`,
    lead_letter: codeMatch.lead_letter,
  };
  // A client's nominal code only coincides with the Blynt chart by chance, so the name decides
  if (byName.fallback) {
    return { ...fromCode, confidence: 85, reason: `Code ${code} matches ${codeMatch.name} in the Blynt chart; the name gives no other clue` };
  }
  if (byName.blynt_code === codeMatch.code || byName.lead_letter === codeMatch.lead_letter) return fromCode;
  // Name and code disagree (e.g. "Business Current Account" on code 1200 = Trade Debtors): follow the name, ask for a check
  return {
    ...strip(byName),
    confidence: Math.min(byName.confidence, 80),
    reason: `${byName.reason}. Code ${code} is ${codeMatch.name} in the Blynt chart, so check this`,
  };
}

const strip = ({ fallback: _f, ...s }: MappingSuggestion & { fallback?: boolean }): MappingSuggestion => s;

/** Classification from the account name and type alone. `fallback` marks the no-clue default. */
function matchByName(sourceName: string, sourceType: string): MappingSuggestion & { fallback?: boolean } {
  const name = (sourceName || '').toLowerCase().trim();
  const type = (sourceType || '').toLowerCase().trim();

  // 2. Cash and Bank Balances (Lead B: 1000, 1010, 1020)
  if (/petty cash|cash on hand|till float|cash float/i.test(name)) {
    return {
      blynt_code: '1000',
      name: 'Petty Cash',
      confidence: 98,
      reason: 'Petty cash and cash-in-hand control account',
      lead_letter: 'B',
    };
  }
  // Income and expense accounts named after a bank ("Bank Fees", "HSBC charges") are not cash at bank
  const profitAndLoss = /expense|overhead|cost|revenue|income|sales|direct/i.test(type);
  if ((!profitAndLoss && /starling|barclays|hsbc|lloyds|natwest|santander|revolut|tide|monzo|bank|current account|checking|operating account/i.test(name)) || /bank/i.test(type)) {
    return {
      blynt_code: '1010',
      name: 'Barclays Current Account',
      confidence: 98,
      reason: 'Commercial bank operating and current accounts',
      lead_letter: 'B',
    };
  }
  if (/deposit account|reserve account|savings account|treasury|liquidity/i.test(name)) {
    return {
      blynt_code: '1020',
      name: 'Barclays Reserve Account',
      confidence: 96,
      reason: 'High-yield interest and treasury deposit balances',
      lead_letter: 'B',
    };
  }

  // 3. Trade Debtors, Prepayments, and Receivables (Lead C / E: 1200, 1210, 1400)
  if (/doubtful debt|bad debt provision|allowance for doubtful|credit loss/i.test(name)) {
    return {
      blynt_code: '1210',
      name: 'Bad Debt Provision',
      confidence: 98,
      reason: 'Contra-asset provision against impaired trade debtors',
      lead_letter: 'C',
    };
  }
  if (/prepayment|prepaid|advance payment|rates & insurance prepaid/i.test(name)) {
    return {
      blynt_code: '1400',
      name: 'Prepayments',
      confidence: 98,
      reason: 'Prepaid expenses and statutory rate apportionments',
      lead_letter: 'E',
    };
  }
  if (/debtor|receivable|sales ledger|slca|trade debtor|director.*loan.*debtor|unpaid share capital|other debtor/i.test(name) || (type.includes('asset') && /debt/i.test(name))) {
    return {
      blynt_code: '1200',
      name: 'Trade Debtors Control',
      confidence: 98,
      reason: 'Trade and current asset receivables control',
      lead_letter: 'C',
    };
  }

  // 4. Inventories & Stock (Lead D: 1300)
  if (/stock|inventory|work in progress|wip|finished goods|raw materials/i.test(name)) {
    return {
      blynt_code: '1300',
      name: 'Finished Goods Stock',
      confidence: 98,
      reason: 'Commercial trading inventory and stock valuation',
      lead_letter: 'D',
    };
  }

  // 5. Fixed Assets & Accumulated Depreciation (Lead F: 1500, 1510, 1520, 1700, 1710, 1720)
  if (/accumulated dep.*(computer|office equipment|it|hardware|software)|less.*accumulated.*dep.*office/i.test(name)) {
    return {
      blynt_code: '1710',
      name: 'Computer Equip Accumulated Deprec',
      confidence: 99,
      reason: 'Accumulated depreciation contra for IT and office assets',
      lead_letter: 'F',
    };
  }
  if (/accumulated dep.*(plant|machinery)|less.*accumulated.*dep.*plant/i.test(name)) {
    return {
      blynt_code: '1700',
      name: 'Accumulated Depreciation',
      confidence: 98,
      reason: 'Accumulated depreciation contra for plant and machinery',
      lead_letter: 'F',
    };
  }
  if (/accumulated dep.*(fixture|fitting|furniture)/i.test(name)) {
    return {
      blynt_code: '1720',
      name: 'Fixtures & Fittings Accumulated Deprec',
      confidence: 98,
      reason: 'Accumulated depreciation contra for fixtures and leasehold fit-out',
      lead_letter: 'F',
    };
  }
  if (/less.*accumulated.*dep|deprec.*reserve|contra.*asset.*dep/i.test(name)) {
    return {
      blynt_code: '1710',
      name: 'Computer Equip Accumulated Deprec',
      confidence: 95,
      reason: 'Depreciation cumulative allowance contra',
      lead_letter: 'F',
    };
  }
  if (/computer|office equipment|it equipment|laptop|server|technology/i.test(name)) {
    return {
      blynt_code: '1510',
      name: 'Computer Equipment Cost',
      confidence: 98,
      reason: 'Capitalized IT infrastructure and office hardware',
      lead_letter: 'F',
    };
  }
  if (/plant|warehouse machinery|factory equipment|vehicle.*asset/i.test(name)) {
    return {
      blynt_code: '1500',
      name: 'Plant & Equipment Cost',
      confidence: 96,
      reason: 'Capitalized industrial plant and production machinery',
      lead_letter: 'F',
    };
  }
  if (/fixture|fitting|furniture|office refurb/i.test(name)) {
    return {
      blynt_code: '1520',
      name: 'Fixtures & Fittings Cost',
      confidence: 98,
      reason: 'Capitalized commercial fittings and interior furniture',
      lead_letter: 'F',
    };
  }
  if (/fixed asset/i.test(type) || /tangible/i.test(type)) {
    return {
      blynt_code: '1510',
      name: 'Computer Equipment Cost',
      confidence: 92,
      reason: 'Tangible fixed asset capital cost schedule',
      lead_letter: 'F',
    };
  }

  // 6. Current & Statutory Liabilities (Lead K / T / L: 2000, 2100, 2200, 2300, 2600)
  if (/vat|hmrc.*vat|output tax|input tax|value added tax/i.test(name)) {
    return {
      blynt_code: '2200',
      name: 'VAT Liability Control',
      confidence: 99,
      reason: 'Statutory VAT net settlement balance due to HMRC',
      lead_letter: 'T',
    };
  }
  if (/paye|nic|national insurance|payroll payable|pension.*payable|wages.*payable/i.test(name)) {
    return {
      blynt_code: '2300',
      name: 'PAYE & NIC Payable',
      confidence: 99,
      reason: 'Payroll statutory PAYE/NIC withholding and social security liability',
      lead_letter: 'T',
    };
  }
  if (/provision for corporation tax|corporation tax payable|corporation tax liability/i.test(name)) {
    return {
      blynt_code: '2200',
      name: 'VAT Liability Control',
      confidence: 96,
      reason: 'Statutory tax provision balance on balance sheet',
      lead_letter: 'T',
    };
  }
  if (/accrual|accrued|income in advance|deferred income/i.test(name)) {
    return {
      blynt_code: '2100',
      name: 'Accruals',
      confidence: 98,
      reason: 'Period-end expense accruals and deferred revenue balances',
      lead_letter: 'K',
    };
  }
  if (/creditor|payable|purchase ledger|plca|trade creditor|supplier/i.test(name) || (type.includes('liability') && /credit/i.test(name))) {
    return {
      blynt_code: '2000',
      name: 'Trade Creditors Control',
      confidence: 98,
      reason: 'Trade creditors control account and supplier invoices payable',
      lead_letter: 'K',
    };
  }
  if (/bank loan|mortgage|term loan|long term borrowing/i.test(name)) {
    return {
      blynt_code: '2600',
      name: 'Bank Loan (Long Term)',
      confidence: 97,
      reason: 'Secured and unsecured bank financing facility liabilities',
      lead_letter: 'L',
    };
  }

  // 7. Equity & Reserves (Lead Z: 3000, 3100)
  if (/share capital|ordinary share|called up|equity capital/i.test(name) || (type.includes('equity') && /capital/i.test(name))) {
    return {
      blynt_code: '3000',
      name: 'Called Up Share Capital',
      confidence: 99,
      reason: 'Statutory issued and paid-up share capital equity',
      lead_letter: 'Z',
    };
  }
  if (/retained earning|profit and loss account|reserves|dividend|dividends current|dividends b\/f/i.test(name) || type.includes('equity')) {
    return {
      blynt_code: '3100',
      name: 'Profit and Loss Account (Reserves)',
      confidence: 98,
      reason: 'Accumulated distributable reserves and profit-and-loss equity balance',
      lead_letter: 'Z',
    };
  }

  // 8. Cost of Sales & Direct Costs (Lead A: 5000, 5100)
  if (/direct expense|direct cost|cost of sales|cos|material|component|carriage in|production/i.test(name) || /cost of sales|direct cost/i.test(type)) {
    return {
      blynt_code: '5000',
      name: 'Direct Materials & Components',
      confidence: 98,
      reason: 'Direct variable materials, production and operational cost of sales',
      lead_letter: 'A',
    };
  }

  // 9. Overheads & Operational Expenses (Lead E / F / T: 6000, 6100, 6200, 6900, 6950)
  // Professional fees & audit/accountancy overheads must match before generic revenue/fees
  if (/depreciation charge|depreciation expense|deprec.*charge|deprec.*expense/i.test(name)) {
    return {
      blynt_code: '6900',
      name: 'Depreciation Charge for Year',
      confidence: 99,
      reason: 'P&L tangible asset amortization and depreciation charge',
      lead_letter: 'F',
    };
  }
  if (/loss.*disposal|profit.*disposal|gain.*disposal/i.test(name)) {
    return {
      blynt_code: '6950',
      name: 'Loss / (Profit) on Disposal of Assets',
      confidence: 99,
      reason: 'Net asset retirement and scrap gain/loss on disposals',
      lead_letter: 'F',
    };
  }
  if (/salary|salaries|wage|director.*remun|staff welfare|staff wellfair|staff training|pension|recruitment/i.test(name)) {
    return {
      blynt_code: '6200',
      name: 'Staff Salaries',
      confidence: 99,
      reason: 'Gross payroll, director emoluments, pension and staff welfare expenses',
      lead_letter: 'T',
    };
  }
  if (/employers national insurance|employers nic|employer nic/i.test(name)) {
    return {
      blynt_code: '2300',
      name: 'PAYE & NIC Payable',
      confidence: 95,
      reason: 'Employers social security contribution and payroll levy',
      lead_letter: 'T',
    };
  }
  if (/light|heat|power|electricity|gas|utilities|water/i.test(name)) {
    return {
      blynt_code: '6100',
      name: 'Light, Heat & Power',
      confidence: 98,
      reason: 'Commercial energy, utilities and facilities consumption',
      lead_letter: 'E',
    };
  }
  if (
    /rent|rate|office|marketing|advertising|audit|accountancy|consulting|cleaning|entertainment|general expense|insurance|interest paid|motor vehicle|travel|software|it |consumable|repair|maintenance|subscription|telephone|internet|communication|legal|bank charge|corporation tax/i.test(name) ||
    /overhead|expense/i.test(type)
  ) {
    return {
      blynt_code: '6000',
      name: 'Office Rent & Rates',
      confidence: 98,
      reason: 'Administrative overhead, audit/professional fees, marketing and operating costs',
      lead_letter: 'E',
    };
  }

  // 10. Revenue & Turnover (Lead A: 4000, 4100)
  // Only match revenue when not an expense/overhead/cost
  if (
    (/sales|turnover|client billing|trading income|consulting income/i.test(name) || /revenue|income/i.test(type)) &&
    !/overhead|expense|cost/i.test(type) &&
    !/audit|accountancy|legal|interest paid/i.test(name)
  ) {
    if (/interest|finance income/i.test(name)) {
      return {
        blynt_code: '4100',
        name: 'Sales Revenue - Export',
        confidence: 96,
        reason: 'Secondary and finance operating income category',
        lead_letter: 'A',
      };
    }
    return {
      blynt_code: '4000',
      name: 'Sales Revenue - UK General',
      confidence: 99,
      reason: 'Primary commercial turnover and trading sales',
      lead_letter: 'A',
    };
  }

  // Fallback: Default to Office Overheads (6000)
  return {
    blynt_code: '6000',
    name: 'Office Rent & Rates',
    confidence: 60,
    reason: 'General operational overhead classification',
    lead_letter: 'E',
    fallback: true,
  };
}

export interface StatutoryDetails {
  statutory_line: string;
  schedule_ref: string;
  cash_flow_category: 'Operating activities' | 'Investing activities' | 'Financing activities' | 'Cash and cash equivalents';
  is_credit_area: boolean;
}

export function getStatutoryDetails(
  blyntCode: string | null,
  sourceName: string = '',
  sourceType: string = ''
): StatutoryDetails {
  const code = blyntCode || '';
  const name = sourceName.toLowerCase();

  if (/director.*loan|dla|s455/i.test(name)) {
    return {
      statutory_line: "Other debtors / Creditors: Director's loan account",
      schedule_ref: 'REC-11',
      cash_flow_category: 'Financing activities',
      is_credit_area: false,
    };
  }

  // Whole words only: "Subcontract" contains "contra" but is a cost, not a suspense account
  if (/\b(suspense|clearing|contra|wages control)\b/i.test(name)) {
    return {
      statutory_line: 'Suspense & clearing control (must be zero)',
      schedule_ref: 'REC-16',
      cash_flow_category: 'Operating activities',
      is_credit_area: false,
    };
  }

  if (/lease|hire purchase|hp agreement|right-of-use/i.test(name)) {
    return {
      statutory_line: 'Lease liabilities and commitments',
      schedule_ref: 'REC-04',
      cash_flow_category: 'Financing activities',
      is_credit_area: true,
    };
  }

  if (code.startsWith('10')) {
    return {
      statutory_line: 'Cash at bank and in hand',
      schedule_ref: 'REC-02',
      cash_flow_category: 'Cash and cash equivalents',
      is_credit_area: false,
    };
  }

  if (code === '1200' || code === '1210') {
    return {
      statutory_line: 'Debtors: amounts falling due within one year - trade',
      schedule_ref: 'REC-07',
      cash_flow_category: 'Operating activities',
      is_credit_area: false,
    };
  }

  if (code === '1400') {
    return {
      statutory_line: 'Prepayments and accrued income',
      schedule_ref: 'REC-09',
      cash_flow_category: 'Operating activities',
      is_credit_area: false,
    };
  }

  if (code === '1300') {
    return {
      statutory_line: 'Stocks and work in progress',
      schedule_ref: 'REC-14',
      cash_flow_category: 'Operating activities',
      is_credit_area: false,
    };
  }

  if (code.startsWith('15') || code.startsWith('17')) {
    return {
      statutory_line: 'Tangible fixed assets',
      schedule_ref: 'REC-03',
      cash_flow_category: 'Investing activities',
      is_credit_area: false,
    };
  }

  if (code === '2000') {
    return {
      statutory_line: 'Creditors: amounts falling due within one year - trade',
      schedule_ref: 'REC-08',
      cash_flow_category: 'Operating activities',
      is_credit_area: true,
    };
  }

  if (code === '2100') {
    return {
      statutory_line: 'Accruals and deferred income',
      schedule_ref: 'REC-09',
      cash_flow_category: 'Operating activities',
      is_credit_area: true,
    };
  }

  if (code === '2200') {
    return {
      statutory_line: 'Taxation and social security - VAT liability',
      schedule_ref: 'REC-06',
      cash_flow_category: 'Operating activities',
      is_credit_area: true,
    };
  }

  if (code === '2300') {
    return {
      statutory_line: 'Taxation and social security - PAYE / NIC control',
      schedule_ref: 'REC-05',
      cash_flow_category: 'Operating activities',
      is_credit_area: true,
    };
  }

  if (code === '2600') {
    return {
      statutory_line: 'Creditors: amounts falling due after more than one year - bank loans',
      schedule_ref: 'REC-10',
      cash_flow_category: 'Financing activities',
      is_credit_area: true,
    };
  }

  if (code === '3000') {
    return {
      statutory_line: 'Called up share capital',
      schedule_ref: 'REC-12',
      cash_flow_category: 'Financing activities',
      is_credit_area: true,
    };
  }

  if (code === '3100') {
    return {
      statutory_line: 'Profit and loss account (reserves)',
      schedule_ref: 'REC-12',
      cash_flow_category: 'Financing activities',
      is_credit_area: true,
    };
  }

  // Income and expense lines are covered by P&L analysis (ANL-01); only those with a
  // supporting schedule point at one. REC-01 is the schedule framework, not a schedule.
  if (code === '6200') {
    return {
      statutory_line: 'Administrative expenses',
      schedule_ref: 'REC-05', // payroll
      cash_flow_category: 'Operating activities',
      is_credit_area: false,
    };
  }

  if (code === '6900' || code === '6950') {
    return {
      statutory_line: 'Administrative expenses',
      schedule_ref: 'REC-03', // fixed asset register: depreciation and disposals
      cash_flow_category: 'Operating activities',
      is_credit_area: false,
    };
  }

  if (code.startsWith('4')) {
    return {
      statutory_line: 'Turnover',
      schedule_ref: '',
      cash_flow_category: 'Operating activities',
      is_credit_area: true,
    };
  }

  if (code.startsWith('5')) {
    return {
      statutory_line: 'Cost of sales',
      schedule_ref: '',
      cash_flow_category: 'Operating activities',
      is_credit_area: false,
    };
  }

  if (code.startsWith('6')) {
    return {
      statutory_line: 'Administrative expenses',
      schedule_ref: '',
      cash_flow_category: 'Operating activities',
      is_credit_area: false,
    };
  }

  return {
    statutory_line: 'Unclassified statutory balance',
    schedule_ref: '',
    cash_flow_category: 'Operating activities',
    is_credit_area: false,
  };
}

