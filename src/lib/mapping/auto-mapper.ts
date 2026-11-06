import { db } from '@/lib/server/db';
import { STANDARD_CHART } from '@/lib/standard-chart';
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
      blynt_code: '620',
      name: 'Petty cash',
      confidence: 98,
      reason: 'Petty cash and cash-in-hand control account',
      lead_letter: 'B',
    };
  }
  if (/credit card/i.test(name)) {
    return { blynt_code: '630', name: 'Credit card', confidence: 96, reason: 'Credit card liability', lead_letter: 'B' };
  }
  // Income and expense accounts named after a bank ("Bank Fees", "HSBC charges") are not cash at bank
  const profitAndLoss = /expense|overhead|cost|revenue|income|sales|direct/i.test(type);
  if ((!profitAndLoss && /starling|barclays|hsbc|lloyds|natwest|santander|revolut|tide|monzo|bank|current account|checking|operating account/i.test(name)) || /bank/i.test(type)) {
    return {
      blynt_code: '600',
      name: 'Main bank account',
      confidence: 98,
      reason: 'Commercial bank operating and current accounts',
      lead_letter: 'B',
    };
  }
  if (/deposit account|reserve account|savings account|treasury|liquidity/i.test(name)) {
    return {
      blynt_code: '610',
      name: 'Savings account',
      confidence: 96,
      reason: 'High-yield interest and treasury deposit balances',
      lead_letter: 'B',
    };
  }

  // 3. Trade Debtors, Prepayments, and Receivables (Lead C / E: 1200, 1210, 1400)
  if (/doubtful debt|bad debt provision|allowance for doubtful|credit loss/i.test(name)) {
    return {
      blynt_code: '711',
      name: 'Bad debt provision',
      confidence: 98,
      reason: 'Contra-asset provision against impaired trade debtors',
      lead_letter: 'C',
    };
  }
  if (/prepayment|prepaid|advance payment|rates & insurance prepaid/i.test(name)) {
    return {
      blynt_code: '730',
      name: 'Prepayments',
      confidence: 98,
      reason: 'Prepaid expenses and statutory rate apportionments',
      lead_letter: 'E',
    };
  }
  if (/director.*loan|\bdla\b/i.test(name)) {
    return { blynt_code: '740', name: "Director's loan account - debit", confidence: 90, reason: 'Director loan account: check whether it is owed to or by the director', lead_letter: 'C' };
  }
  if (/other debtor|other receivable/i.test(name)) {
    return { blynt_code: '720', name: 'Other receivables', confidence: 96, reason: 'Other debtors and receivables', lead_letter: 'C' };
  }
  if (/debtor|receivable|sales ledger|slca|trade debtor|director.*loan.*debtor|unpaid share capital|other debtor/i.test(name) || (type.includes('asset') && /debt/i.test(name))) {
    return {
      blynt_code: '710',
      name: 'Trade receivables control',
      confidence: 98,
      reason: 'Trade and current asset receivables control',
      lead_letter: 'C',
    };
  }

  // 4. Inventories & Stock (Lead D: 1300)
  if (/stock|inventory|work in progress|wip|finished goods|raw materials/i.test(name)) {
    return {
      blynt_code: '700',
      name: 'Inventory',
      confidence: 98,
      reason: 'Commercial trading inventory and stock valuation',
      lead_letter: 'D',
    };
  }

  // 5. Fixed Assets & Accumulated Depreciation (Lead F: 1500, 1510, 1520, 1700, 1710, 1720)
  if (/accumulated dep.*(computer|office equipment|it|hardware|software)|less.*accumulated.*dep.*office/i.test(name)) {
    return {
      blynt_code: '681',
      name: 'Computer equipment accumulated depreciation',
      confidence: 99,
      reason: 'Accumulated depreciation contra for IT and office assets',
      lead_letter: 'F',
    };
  }
  if (/accumulated dep.*(plant|machinery)|less.*accumulated.*dep.*plant/i.test(name)) {
    return {
      blynt_code: '661',
      name: 'Plant and equipment accumulated depreciation',
      confidence: 98,
      reason: 'Accumulated depreciation contra for plant and machinery',
      lead_letter: 'F',
    };
  }
  if (/accumulated dep.*(fixture|fitting|furniture)/i.test(name)) {
    return {
      blynt_code: '691',
      name: 'Fixtures and fittings accumulated depreciation',
      confidence: 98,
      reason: 'Accumulated depreciation contra for fixtures and leasehold fit-out',
      lead_letter: 'F',
    };
  }
  if (/less.*accumulated.*dep|deprec.*reserve|contra.*asset.*dep/i.test(name)) {
    return {
      blynt_code: '681',
      name: 'Computer equipment accumulated depreciation',
      confidence: 95,
      reason: 'Depreciation cumulative allowance contra',
      lead_letter: 'F',
    };
  }
  if (/computer|office equipment|it equipment|laptop|server|technology/i.test(name)) {
    return {
      blynt_code: '680',
      name: 'Computer equipment at cost',
      confidence: 98,
      reason: 'Capitalized IT infrastructure and office hardware',
      lead_letter: 'F',
    };
  }
  if (/plant|warehouse machinery|factory equipment|vehicle.*asset/i.test(name)) {
    return {
      blynt_code: '660',
      name: 'Plant and equipment at cost',
      confidence: 96,
      reason: 'Capitalized industrial plant and production machinery',
      lead_letter: 'F',
    };
  }
  if (/fixture|fitting|furniture|office refurb/i.test(name)) {
    return {
      blynt_code: '690',
      name: 'Fixtures and fittings at cost',
      confidence: 98,
      reason: 'Capitalized commercial fittings and interior furniture',
      lead_letter: 'F',
    };
  }
  if (/fixed asset/i.test(type) || /tangible/i.test(type)) {
    return {
      blynt_code: '680',
      name: 'Computer equipment at cost',
      confidence: 92,
      reason: 'Tangible fixed asset capital cost schedule',
      lead_letter: 'F',
    };
  }

  // 6. Current & Statutory Liabilities (Lead K / T / L: 2000, 2100, 2200, 2300, 2600)
  if (/wages.*payable|net wages/i.test(name)) {
    return { blynt_code: '789', name: 'Wages payable control', confidence: 97, reason: 'Net wages payable control', lead_letter: 'T' };
  }
  if (/pension.*payable/i.test(name)) {
    return { blynt_code: '791', name: 'Pension contributions payable', confidence: 97, reason: 'Pension contributions payable', lead_letter: 'T' };
  }
  if (/vat|hmrc.*vat|output tax|input tax|value added tax/i.test(name)) {
    return {
      blynt_code: '780',
      name: 'VAT control',
      confidence: 99,
      reason: 'Statutory VAT net settlement balance due to HMRC',
      lead_letter: 'T',
    };
  }
  if (/paye|nic|national insurance|payroll payable|pension.*payable|wages.*payable/i.test(name)) {
    return {
      blynt_code: '790',
      name: 'PAYE and National Insurance payable',
      confidence: 99,
      reason: 'Payroll statutory PAYE/NIC withholding and social security liability',
      lead_letter: 'T',
    };
  }
  if (/provision for corporation tax|corporation tax payable|corporation tax liability/i.test(name)) {
    return {
      blynt_code: '795',
      name: 'Corporation tax payable',
      confidence: 96,
      reason: 'Statutory tax provision balance on balance sheet',
      lead_letter: 'T',
    };
  }
  if (/accrual|accrued|income in advance|deferred income/i.test(name)) {
    return {
      blynt_code: '760',
      name: 'Accruals',
      confidence: 98,
      reason: 'Period-end expense accruals and deferred revenue balances',
      lead_letter: 'K',
    };
  }
  if (/creditor|payable|purchase ledger|plca|trade creditor|supplier/i.test(name) || (type.includes('liability') && /credit/i.test(name))) {
    return {
      blynt_code: '750',
      name: 'Trade payables control',
      confidence: 98,
      reason: 'Trade creditors control account and supplier invoices payable',
      lead_letter: 'K',
    };
  }
  if (/hire purchase/i.test(name)) {
    return { blynt_code: '810', name: 'Hire purchase liabilities', confidence: 96, reason: 'Hire purchase liabilities', lead_letter: 'L' };
  }
  if (/lease liab/i.test(name)) {
    return { blynt_code: '820', name: 'Lease liabilities', confidence: 96, reason: 'Lease liabilities', lead_letter: 'L' };
  }
  if (/bank loan|mortgage|term loan|long term borrowing/i.test(name)) {
    return {
      blynt_code: '800',
      name: 'Bank loans',
      confidence: 97,
      reason: 'Secured and unsecured bank financing facility liabilities',
      lead_letter: 'L',
    };
  }

  // 7. Equity & Reserves (Lead Z: 3000, 3100)
  if (/share premium/i.test(name)) {
    return { blynt_code: '870', name: 'Share premium', confidence: 99, reason: 'Share premium account', lead_letter: 'Z' };
  }
  if (/share capital|ordinary share|called up|equity capital/i.test(name) || (type.includes('equity') && /capital/i.test(name))) {
    return {
      blynt_code: '850',
      name: 'Ordinary share capital',
      confidence: 99,
      reason: 'Statutory issued and paid-up share capital equity',
      lead_letter: 'Z',
    };
  }
  if (/retained earning|profit and loss account|reserves|dividend|dividends current|dividends b\/f/i.test(name) || type.includes('equity')) {
    return {
      blynt_code: '890',
      name: 'Retained earnings',
      confidence: 98,
      reason: 'Accumulated distributable reserves and profit-and-loss equity balance',
      lead_letter: 'Z',
    };
  }

  // 8. Cost of Sales & Direct Costs (Lead A: 5000, 5100)
  if (/direct expense|direct cost|cost of sales|cos|material|component|carriage in|production/i.test(name) || /cost of sales|direct cost/i.test(type)) {
    return {
      blynt_code: '210',
      name: 'Direct materials and components',
      confidence: 98,
      reason: 'Direct variable materials, production and operational cost of sales',
      lead_letter: 'A',
    };
  }

  // 9. Overheads & Operational Expenses (Lead E / F / T: 6000, 6100, 6200, 6900, 6950)
  // Professional fees & audit/accountancy overheads must match before generic revenue/fees
  if (/depreciation charge|depreciation expense|deprec.*charge|deprec.*expense/i.test(name)) {
    return {
      blynt_code: '492',
      name: 'Depreciation charge for year',
      confidence: 99,
      reason: 'P&L tangible asset amortization and depreciation charge',
      lead_letter: 'F',
    };
  }
  if (/loss.*disposal|profit.*disposal|gain.*disposal/i.test(name)) {
    return {
      blynt_code: '493',
      name: 'Loss / (profit) on asset disposal',
      confidence: 99,
      reason: 'Net asset retirement and scrap gain/loss on disposals',
      lead_letter: 'F',
    };
  }
  if (/salary|salaries|wage|director.*remun|staff welfare|staff wellfair|staff training|pension|recruitment/i.test(name)) {
    return {
      blynt_code: '300',
      name: 'Salaries and wages',
      confidence: 99,
      reason: 'Gross payroll, director emoluments, pension and staff welfare expenses',
      lead_letter: 'T',
    };
  }
  if (/employers national insurance|employers nic|employer nic/i.test(name)) {
    return {
      blynt_code: '310',
      name: "Employer's National Insurance",
      confidence: 95,
      reason: 'Employers social security contribution and payroll levy',
      lead_letter: 'T',
    };
  }
  if (/light|heat|power|electricity|gas|utilities|water/i.test(name)) {
    return {
      blynt_code: '410',
      name: 'Light, heat and power',
      confidence: 98,
      reason: 'Commercial energy, utilities and facilities consumption',
      lead_letter: 'E',
    };
  }
  if (/bank (charge|fee)/i.test(name)) {
    return { blynt_code: '490', name: 'Bank charges', confidence: 97, reason: 'Bank charges and card fees', lead_letter: 'E' };
  }
  if (/interest paid|loan interest/i.test(name)) {
    return { blynt_code: '510', name: 'Loan interest', confidence: 97, reason: 'Interest payable on borrowings', lead_letter: 'E' };
  }
  if (/corporation tax/i.test(name)) {
    return { blynt_code: '550', name: 'Corporation tax expense', confidence: 97, reason: 'Corporation tax charge for the year', lead_letter: 'E' };
  }
  if (/\brent\b|rates/i.test(name)) {
    return { blynt_code: '400', name: 'Office rent and rates', confidence: 97, reason: 'Premises rent and business rates', lead_letter: 'E' };
  }
  if (/insurance/i.test(name)) {
    return { blynt_code: '470', name: 'Insurance', confidence: 97, reason: 'Insurance premiums', lead_letter: 'E' };
  }
  if (/audit|accountancy/i.test(name)) {
    return { blynt_code: '481', name: 'Accountancy fees', confidence: 97, reason: 'Audit and accountancy fees', lead_letter: 'E' };
  }
  if (/legal/i.test(name)) {
    return { blynt_code: '482', name: 'Legal fees', confidence: 97, reason: 'Legal fees', lead_letter: 'E' };
  }
  if (/professional|consulting/i.test(name)) {
    return { blynt_code: '480', name: 'Professional fees', confidence: 97, reason: 'Professional and consultancy fees', lead_letter: 'E' };
  }
  if (/advertising|marketing/i.test(name)) {
    return { blynt_code: '440', name: 'Advertising and marketing', confidence: 97, reason: 'Advertising and marketing', lead_letter: 'E' };
  }
  if (/telephone|internet|communication/i.test(name)) {
    return { blynt_code: '450', name: 'Telephone and internet', confidence: 97, reason: 'Telephone and internet', lead_letter: 'E' };
  }
  if (/software|subscription|\bit\b/i.test(name)) {
    return { blynt_code: '460', name: 'Software and subscriptions', confidence: 97, reason: 'Software and subscriptions', lead_letter: 'E' };
  }
  if (/motor|travel/i.test(name)) {
    return { blynt_code: '430', name: 'Motor and travel expenses', confidence: 97, reason: 'Motor and travel expenses', lead_letter: 'E' };
  }
  if (/repair|maintenance|cleaning/i.test(name)) {
    return { blynt_code: '420', name: 'Repairs and maintenance', confidence: 97, reason: 'Repairs, maintenance and cleaning', lead_letter: 'E' };
  }
  if (
    /rent|rate|office|marketing|advertising|audit|accountancy|consulting|cleaning|entertainment|general expense|insurance|interest paid|motor vehicle|travel|software|it |consumable|repair|maintenance|subscription|telephone|internet|communication|legal|bank charge|corporation tax/i.test(name) ||
    /overhead|expense/i.test(type)
  ) {
    return {
      blynt_code: '499',
      name: 'Other administrative expenses',
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
        blynt_code: '500',
        name: 'Interest received',
        confidence: 96,
        reason: 'Secondary and finance operating income category',
        lead_letter: 'A',
      };
    }
    return {
      blynt_code: '100',
      name: 'Sales revenue - UK general',
      confidence: 99,
      reason: 'Primary commercial turnover and trading sales',
      lead_letter: 'A',
    };
  }

  // Fallback: Other administrative expenses (499)
  return {
    blynt_code: '499',
    name: 'Other administrative expenses',
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

  // The standard chart carries each account's statutory line, schedule and cash flow category.
  // REC-01 is the schedule framework, not a schedule, so income and expense lines leave it blank.
  const acct = STANDARD_CHART.find((a) => a.code === code);
  if (acct?.statutory_line && acct.cash_flow_category) {
    return {
      statutory_line: acct.statutory_line,
      schedule_ref: acct.schedule_ref === 'REC-01' ? '' : (acct.schedule_ref ?? ''),
      cash_flow_category: acct.cash_flow_category,
      is_credit_area: acct.normal_balance === 'Credit',
    };
  }

  return {
    statutory_line: 'Unclassified statutory balance',
    schedule_ref: '',
    cash_flow_category: 'Operating activities',
    is_credit_area: false,
  };
}

