/**
 * Working paper template library.
 * Exactly corresponds to the Working Paper Platform v1.1 Specification
 * (REC-01 to REC-17, WPS-01 to WPS-05, STD-01 to STD-05).
 * 
 * Every paper has the same shape: objective, lead figures from the Blynt chart,
 * schedule, checks, procedures, evidence, conclusion and sign-off.
 * The schedule kind decides how the schedule is laid out and calculated.
 */

export type ScheduleKind =
  | 'reconciliation'
  | 'assets'
  | 'lines'
  | 'checklist'
  | 'vat'
  | 'payroll'
  | 'leases'
  | 'dla'
  | 'loans'
  | 'tax';

export interface LeadDef {
  code: string; // Blynt chart code, matched by prefix (e.g. "15" covers 1500-1599)
  label: string;
}

export interface LineColumn {
  key: string;
  label: string;
  money?: boolean; // default true
  inTotal?: boolean; // counts towards the line total (default true for money columns)
}

export interface AlternativeTemplate {
  id: string;
  name: string;
  description: string;
  kind?: ScheduleKind;
}

export interface TemplateDef {
  ref: string;
  recRef?: string; // e.g. "REC-02", "REC-03"
  area: string; // area letter
  areaName: string;
  title: string;
  version: number;
  summary: string;
  objective: string;
  assertions: string[];
  leads: LeadDef[];
  /** Credit-balance areas (creditors, income, equity, tax) show the TB as a positive figure. */
  creditArea?: boolean;
  kind: ScheduleKind;
  /** For 'lines': the columns of each line. */
  columns?: LineColumn[];
  /** For 'checklist': the questions. */
  questions?: string[];
  /** For 'checklist': whether to show the materiality calculator (A-10). */
  materiality?: boolean;
  procedures: string[];
  allTypes?: boolean;
  rollsForward?: boolean; // True if carries multi-year balances (ENG-03)
  hiddenUnder?: string[]; // Standards under which this schedule is hidden (e.g. FRS 105 for deferred tax)
  alternativeTemplates?: AlternativeTemplate[];
}

export const TEMPLATES: TemplateDef[] = [
  // A-10 Planning & Materiality (STD-01, WPS-01)
  {
    ref: 'A-10',
    area: 'A',
    areaName: 'Planning',
    title: 'Planning and materiality',
    version: 4,
    summary: 'Materiality, risks, team briefing.',
    objective: 'Plan the engagement: set materiality, identify key risks and brief the team before fieldwork starts.',
    assertions: ['Planning', 'Risk assessment'],
    leads: [
      { code: '40', label: 'Revenue' },
      { code: '41', label: 'Export revenue' },
    ],
    creditArea: true,
    kind: 'checklist',
    materiality: true,
    questions: [
      'Engagement letter signed and on file for this year',
      'Independence and ethics confirmed for every team member',
      'Prior year file and points forward reviewed',
      'Key risks identified and audit responses planned',
      'Team briefing held and recorded',
    ],
    procedures: [
      'Set overall and performance materiality and record the benchmark used.',
      'Document significant risks and the planned response to each.',
      'Brief the team on risks, materiality and statutory deadlines.',
    ],
    allTypes: true,
  },

  // B-10 Bank and Cash Reconciliation (REC-02)
  {
    ref: 'B-10',
    recRef: 'REC-02',
    area: 'B',
    areaName: 'Cash and bank',
    title: 'Bank and cash reconciliation',
    version: 3,
    summary: 'Ledger to statement, uncleared items, bank confirmation.',
    objective: 'Confirm bank balances exist, are complete, and are correctly cut off at the period end.',
    assertions: ['Existence', 'Completeness', 'Accuracy', 'Cut-off'],
    leads: [
      { code: '1000', label: 'Petty cash' },
      { code: '1010', label: 'Bank current account' },
      { code: '1020', label: 'Bank deposit account' },
    ],
    kind: 'reconciliation',
    rollsForward: false,
    alternativeTemplates: [
      { id: 'alt_b10_conf', name: 'Balance confirmation only', description: 'Direct third-party bank confirmation letter reconciliation' },
    ],
    procedures: [
      'Agree ledger balance to trial balance.',
      'Agree statement balance to bank statement PDF or Open Banking feed.',
      'Vouch uncleared items to after-date statement.',
      'Flag uncleared items older than 30 days for follow-up.',
    ],
    allTypes: true,
  },

  // C-10 Trade Debtors & Recoverability (REC-07)
  {
    ref: 'C-10',
    recRef: 'REC-07',
    area: 'C',
    areaName: 'Debtors',
    title: 'Trade debtors and recoverability',
    version: 3,
    summary: 'Aged debtors listing, recoverability, after-date bank receipts.',
    objective: 'Confirm trade debtors exist, are recoverable, and are stated net of any required bad debt provision.',
    assertions: ['Existence', 'Valuation', 'Rights'],
    leads: [
      { code: '1200', label: 'Trade debtors control' },
      { code: '1210', label: 'Allowance for bad debts' },
    ],
    kind: 'lines',
    rollsForward: false,
    alternativeTemplates: [
      { id: 'alt_c10_simple', name: 'Simple listing', description: 'Unaged customer balance listing' },
    ],
    columns: [
      { key: 'current', label: 'Current' },
      { key: 'd30', label: '31–60 days' },
      { key: 'd60', label: '61–90 days' },
      { key: 'd90', label: '90+ days' },
      { key: 'after_date', label: 'After-date receipts', inTotal: false },
    ],
    procedures: [
      'Agree aged debtors report to the control account balance.',
      'Review balances over 90 days with post period-end bank receipts.',
      'Propose bad debt provision for old balances with no receipts.',
      'Flag credit balances in debtors for reclassification to creditors.',
    ],
  },

  // C-20 Prepayments and Accrued Income (REC-09)
  {
    ref: 'C-20',
    recRef: 'REC-09',
    area: 'C',
    areaName: 'Debtors',
    title: 'Prepayments and accrued income',
    version: 2,
    summary: 'Itemised prepayments with service period release calculations.',
    objective: 'Confirm prepayments represent goods or services paid for in advance of the period end.',
    assertions: ['Cut-off', 'Valuation', 'Accuracy'],
    leads: [
      { code: '1400', label: 'Prepayments and accrued income' },
    ],
    kind: 'lines',
    rollsForward: false,
    alternativeTemplates: [
      { id: 'alt_c20_simple', name: 'Simple listing', description: 'Itemised balance list without formula calculation' },
    ],
    columns: [
      { key: 'invoice_date', label: 'Invoice Date', money: false, inTotal: false },
      { key: 'supplier', label: 'Supplier', money: false, inTotal: false },
      { key: 'period_covered', label: 'Period Covered', money: false, inTotal: false },
      { key: 'total_amount', label: 'Total Invoice' },
      { key: 'prepaid_amount', label: 'Prepaid c/f' },
    ],
    procedures: [
      'Inspect invoices crossing the year end (insurance, rent, software).',
      'Recalculate the pro-rata portion prepaid.',
      'Confirm prior-year prepayments reversed in the current year.',
    ],
  },

  // C-30 Other Debtors and Prepayments (REC-17)
  {
    ref: 'C-30',
    recRef: 'REC-17',
    area: 'C',
    areaName: 'Debtors',
    title: 'Other debtors and sundry balances',
    version: 2,
    summary: 'Itemised listing of other receivables, unpaid share capital, and deposits.',
    objective: 'Confirm other debtors are genuine, recoverable, and properly classified.',
    assertions: ['Existence', 'Classification'],
    leads: [
      { code: '1410', label: 'Other debtors and deposits' },
    ],
    kind: 'lines',
    rollsForward: false,
    columns: [
      { key: 'description', label: 'Description', money: false, inTotal: false },
      { key: 'amount', label: 'Amount' },
    ],
    procedures: [
      'Agree other debtors listing to the ledger.',
      'Verify recoverability of deposits and sundry receivables.',
    ],
  },

  // D-10 Stock and Work in Progress (REC-14)
  {
    ref: 'D-10',
    recRef: 'REC-14',
    area: 'D',
    areaName: 'Stock',
    title: 'Stock and work in progress',
    version: 2,
    summary: 'Count results, valuation at lower of cost and NRV, gross margin check.',
    objective: 'Confirm stock exists and is valued at the lower of cost and net realisable value.',
    assertions: ['Existence', 'Valuation', 'Completeness'],
    leads: [
      { code: '1300', label: 'Stock and work in progress' },
    ],
    kind: 'lines',
    rollsForward: false,
    alternativeTemplates: [
      { id: 'alt_d10_wip', name: 'Detailed valuation & WIP by job', description: 'Work in progress listing broken down by job contract' },
    ],
    columns: [
      { key: 'category', label: 'Category', money: false, inTotal: false },
      { key: 'qty', label: 'Quantity', money: false, inTotal: false },
      { key: 'amount', label: 'Cost Valuation' },
    ],
    procedures: [
      'Attend or review stock count sheets and agree count totals to the summary.',
      'Test unit costs to purchase invoices.',
      'Compare gross margin against prior year and budget (flag movements >5 points).',
    ],
  },

  // D-20 Director's Loan Account (REC-11)
  {
    ref: 'D-20',
    recRef: 'REC-11',
    area: 'D',
    areaName: 'Director’s loan',
    title: 'Director’s loan account',
    version: 2,
    summary: 'Per-director movements, s455 tax charge, benefit-in-kind >£10k review.',
    objective: 'Confirm director loan balances, track movements, and assess s455 and BIK tax implications.',
    assertions: ['Existence', 'Valuation', 'Disclosure'],
    leads: [
      { code: '1220', label: 'Director’s loan account (debtors)' },
      { code: '2150', label: 'Director’s loan account (creditors)' },
    ],
    kind: 'dla',
    rollsForward: true,
    alternativeTemplates: [
      { id: 'alt_d20_bal', name: 'Balance only', description: 'Simple closing balance confirmation without transaction grouping' },
    ],
    procedures: [
      'Reconcile opening balance to prior-year final accounts.',
      'Classify movements between drawings, salary, expenses, and dividends.',
      'Calculate s455 tax liability if overdrawn at year end and not repaid within 9 months.',
      'Flag any point in the year where balance exceeded £10,000 for benefit-in-kind review.',
    ],
  },

  // E-10 Share Capital and Dividends (REC-12)
  {
    ref: 'E-10',
    recRef: 'REC-12',
    area: 'E',
    areaName: 'Equity and reserves',
    title: 'Share capital and dividends',
    version: 2,
    summary: 'Share register, issues, buybacks, and distributable reserves test.',
    objective: 'Confirm share capital matches Companies House and dividends are supported by distributable profits.',
    assertions: ['Accuracy', 'Presentation', 'Legality'],
    leads: [
      { code: '3000', label: 'Called up share capital' },
      { code: '3010', label: 'Share premium account' },
    ],
    creditArea: true,
    kind: 'lines',
    rollsForward: true,
    columns: [
      { key: 'class', label: 'Share Class', money: false, inTotal: false },
      { key: 'number', label: 'Number of Shares', money: false, inTotal: false },
      { key: 'nominal_val', label: 'Nominal Value', money: false, inTotal: false },
      { key: 'amount', label: 'Total Paid Up' },
    ],
    procedures: [
      'Agree share capital to Companies House confirmation statement.',
      'Inspect board minutes for all dividends declared in the period.',
      'Perform distributable reserves check at each dividend payment date.',
    ],
  },

  // E-20 Reserves Movement (REC-12)
  {
    ref: 'E-20',
    recRef: 'REC-12',
    area: 'E',
    areaName: 'Equity and reserves',
    title: 'Reserves movement',
    version: 2,
    summary: 'Profit and loss reserves, capital redemption, revaluation reserves.',
    objective: 'Reconcile movements in reserves to comprehensive income and distributions.',
    assertions: ['Completeness', 'Accuracy'],
    leads: [
      { code: '3100', label: 'Profit and loss reserve' },
      { code: '3200', label: 'Revaluation reserve' },
    ],
    creditArea: true,
    kind: 'lines',
    rollsForward: true,
    columns: [
      { key: 'reserve_name', label: 'Reserve Type', money: false, inTotal: false },
      { key: 'opening', label: 'Opening b/f', inTotal: false },
      { key: 'profit', label: 'Profit for Year', inTotal: false },
      { key: 'dividends', label: 'Dividends Paid', inTotal: false },
      { key: 'closing', label: 'Closing c/f' },
    ],
    procedures: [
      'Agree opening reserves to prior-year signed accounts.',
      'Reconcile current-year movement to profit after tax less dividends.',
    ],
  },

  // F-10 Fixed Assets Register and Depreciation (REC-03)
  {
    ref: 'F-10',
    recRef: 'REC-03',
    area: 'F',
    areaName: 'Fixed assets',
    title: 'Fixed assets and depreciation',
    version: 2,
    summary: 'Cost, additions, disposals, depreciation policies and NBV by class.',
    objective: 'Confirm fixed assets exist, are owned, are depreciated in accordance with policies, and NBV agrees to ledger.',
    assertions: ['Existence', 'Rights', 'Valuation', 'Completeness'],
    leads: [
      { code: '1500', label: 'Plant and machinery (cost)' },
      { code: '1510', label: 'Fixtures, fittings and equipment (cost)' },
      { code: '1700', label: 'Accumulated depreciation' },
      { code: '6900', label: 'Depreciation charge' },
      { code: '6950', label: 'Profit or loss on disposal' },
    ],
    kind: 'assets',
    rollsForward: true,
    alternativeTemplates: [
      { id: 'alt_f10_detail', name: 'Per-asset detailed register', description: 'Itemised asset-by-asset schedule with serial numbers' },
      { id: 'alt_f10_summary', name: 'Movement summary only', description: 'Class-level roll forward summary' },
    ],
    procedures: [
      'Agree opening cost and depreciation to prior-year accounts.',
      'Vouch additions over capitalisation threshold to purchase invoices.',
      'Inspect disposal evidence and confirm profit/loss calculation.',
      'Perform proof in total of depreciation charge against stated policy.',
    ],
  },

  // G-10 Investments and Investment Property (REC-17)
  {
    ref: 'G-10',
    recRef: 'REC-17',
    area: 'G',
    areaName: 'Investments',
    title: 'Investments and investment property',
    version: 2,
    summary: 'Subsidiaries, listed investments, investment property at fair value.',
    objective: 'Confirm investments exist and are valued in accordance with FRS 102/105.',
    assertions: ['Existence', 'Valuation'],
    leads: [
      { code: '1600', label: 'Investments in subsidiaries and associates' },
      { code: '1650', label: 'Investment property' },
    ],
    kind: 'lines',
    rollsForward: true,
    alternativeTemplates: [
      { id: 'alt_g10_fairvalue', name: 'Fair value model (FRS 102)', description: 'Annual independent valuation revaluation model' },
    ],
    columns: [
      { key: 'holding', label: 'Holding / Property', money: false, inTotal: false },
      { key: 'cost_bf', label: 'Cost b/f', inTotal: false },
      { key: 'revaluation', label: 'Fair Value Movement', inTotal: false },
      { key: 'closing', label: 'Fair Value c/f' },
    ],
    procedures: [
      'Confirm ownership of shares or property deeds.',
      'Inspect independent valuation report (flag if older than 12 months).',
      'Record fair value movements in profit and loss.',
    ],
  },

  // I-10 Revenue (Analysis & Cut-off)
  {
    ref: 'I-10',
    area: 'I',
    areaName: 'Income',
    title: 'Revenue and cut-off',
    version: 2,
    summary: 'Turnover by stream, analytical review, cut-off testing.',
    objective: 'Confirm revenue is complete, accurate, and recorded in the correct accounting period.',
    assertions: ['Occurrence', 'Completeness', 'Cut-off'],
    leads: [
      { code: '4000', label: 'UK sales' },
      { code: '4100', label: 'Export / other income' },
    ],
    creditArea: true,
    kind: 'lines',
    rollsForward: false,
    columns: [
      { key: 'stream', label: 'Revenue Stream', money: false, inTotal: false },
      { key: 'amount', label: 'Current Period' },
      { key: 'prior', label: 'Prior Year', inTotal: false },
    ],
    procedures: [
      'Perform analytical review comparing turnover streams with prior period.',
      'Test sales cut-off either side of the year end.',
      'Reconcile turnover to output VAT returns where applicable.',
    ],
  },

  // K-10 Trade Creditors and Unrecorded Liabilities (REC-08)
  {
    ref: 'K-10',
    recRef: 'REC-08',
    area: 'K',
    areaName: 'Creditors',
    title: 'Trade creditors and unrecorded liabilities',
    version: 3,
    summary: 'Aged creditors listing, supplier statements, search for unrecorded liabilities.',
    objective: 'Confirm trade creditors are complete and liabilities at year end are fully recorded.',
    assertions: ['Completeness', 'Accuracy', 'Cut-off'],
    leads: [
      { code: '2000', label: 'Trade creditors control' },
    ],
    creditArea: true,
    kind: 'lines',
    rollsForward: false,
    alternativeTemplates: [
      { id: 'alt_k10_simple', name: 'Simple listing', description: 'Unaged supplier balance list' },
    ],
    columns: [
      { key: 'supplier', label: 'Supplier', money: false, inTotal: false },
      { key: 'ledger_bal', label: 'Ledger Balance' },
      { key: 'statement_bal', label: 'Statement Balance', inTotal: false },
      { key: 'variance', label: 'Difference', inTotal: false },
    ],
    procedures: [
      'Agree aged creditors listing to the control account.',
      'Reconcile major supplier balances to external supplier statements.',
      'Search for unrecorded liabilities in bank payments 60 days after period end.',
      'Flag debit balances in creditors for reclassification to debtors.',
    ],
  },

  // K-20 Accruals and Deferred Income (REC-09)
  {
    ref: 'K-20',
    recRef: 'REC-09',
    area: 'K',
    areaName: 'Creditors',
    title: 'Accruals and deferred income',
    version: 2,
    summary: 'Itemised accruals with post-period reversal verification.',
    objective: 'Confirm accruals represent genuine liabilities incurred before the period end.',
    assertions: ['Completeness', 'Cut-off'],
    leads: [
      { code: '2100', label: 'Accruals and deferred income' },
    ],
    creditArea: true,
    kind: 'lines',
    rollsForward: false,
    alternativeTemplates: [
      { id: 'alt_k20_simple', name: 'Simple listing', description: 'Simple accruals schedule' },
    ],
    columns: [
      { key: 'item', label: 'Accrual Item', money: false, inTotal: false },
      { key: 'supplier', label: 'Supplier / Payee', money: false, inTotal: false },
      { key: 'amount', label: 'Accrued Amount' },
    ],
    procedures: [
      'Review recurring items missing at year end (utilities, telephone, audit fee).',
      'Verify calculation basis against subsequent bills or agreements.',
      'Confirm prior-year accruals reversed in the current period.',
    ],
  },

  // L-10 Leases (REC-04)
  {
    ref: 'L-10',
    recRef: 'REC-04',
    area: 'L',
    areaName: 'Loans and leases',
    title: 'Lease commitments and right-of-use assets',
    version: 2,
    summary: 'Lease terms, right-of-use asset amortisation or operating lease commitments.',
    objective: 'Confirm leases are accounted for under the applicable standard (operating / finance vs right-of-use).',
    assertions: ['Classification', 'Completeness', 'Accuracy'],
    leads: [
      { code: '2400', label: 'Lease liabilities (due < 1 year)' },
      { code: '2410', label: 'Lease liabilities (due > 1 year)' },
    ],
    creditArea: true,
    kind: 'leases',
    rollsForward: true,
    alternativeTemplates: [
      { id: 'alt_l10_commit', name: 'Commitments-only schedule (FRS 105)', description: 'Simple commitments note disclosure without balance sheet liability' },
    ],
    procedures: [
      'Extract lessor, term, break dates, and payments from the lease agreement.',
      'Under FRS 102 (from Jan 2026), calculate right-of-use asset and lease liability.',
      'Disclose commitments split: within 1 year, 2–5 years, and over 5 years.',
    ],
  },

  // L-20 Loans Schedule (REC-10)
  {
    ref: 'L-20',
    recRef: 'REC-10',
    area: 'L',
    areaName: 'Loans and leases',
    title: 'Loans and borrowing facilities',
    version: 2,
    summary: 'Bank loans, repayment schedule, interest charges, maturity analysis.',
    objective: 'Confirm loans exist, balances agree to statements, and repayment splits are accurate.',
    assertions: ['Existence', 'Accuracy', 'Classification'],
    leads: [
      { code: '2500', label: 'Bank loans due within one year' },
      { code: '2510', label: 'Bank loans due after one year' },
    ],
    creditArea: true,
    kind: 'loans',
    rollsForward: true,
    alternativeTemplates: [
      { id: 'alt_l20_gov', name: 'Fixed-term government loan', description: 'Bounce back or recovery loan balance verification' },
    ],
    procedures: [
      'Agree loan balances to bank loan statements and confirmations.',
      'Verify split between due within 1 year, 1–5 years, and over 5 years.',
      'Check interest calculation against agreed rate and term.',
      'Flag secured borrowings for the statutory security note.',
    ],
  },

  // L-30 Hire Purchase (REC-10)
  {
    ref: 'L-30',
    recRef: 'REC-10',
    area: 'L',
    areaName: 'Loans and leases',
    title: 'Hire purchase agreements',
    version: 2,
    summary: 'HP contracts, capital repayments, and interest allocation.',
    objective: 'Confirm HP obligations are correctly stated net of future finance charges.',
    assertions: ['Completeness', 'Accuracy'],
    leads: [
      { code: '2520', label: 'Hire purchase liabilities' },
    ],
    creditArea: true,
    kind: 'loans',
    rollsForward: true,
    procedures: [
      'Extract terms from HP contracts (cash price, deposit, instalments).',
      'Allocate finance charges over the term using actuarial or sum-of-digits method.',
    ],
  },

  // P-10 Costs and Overheads Analytical Review
  {
    ref: 'P-10',
    area: 'P',
    areaName: 'Costs and overheads',
    title: 'Costs and overheads analysis',
    version: 2,
    summary: 'Cost of sales and overheads analytical review against prior year.',
    objective: 'Confirm expenses are complete, accurate, and relate to business trading.',
    assertions: ['Occurrence', 'Accuracy', 'Classification'],
    leads: [
      { code: '5000', label: 'Cost of sales' },
      { code: '6000', label: 'Administrative overheads' },
      { code: '6100', label: 'Utilities and facilities' },
    ],
    kind: 'lines',
    rollsForward: false,
    columns: [
      { key: 'category', label: 'Cost Category', money: false, inTotal: false },
      { key: 'amount', label: 'This Year' },
      { key: 'prior', label: 'Prior Year', inTotal: false },
    ],
    procedures: [
      'Analyse overheads by category and explain movements exceeding threshold.',
      'Run capital vs revenue detector on repair and maintenance expenses (AIX-02).',
    ],
  },

  // P-20 Payroll Reconciliation (REC-05)
  {
    ref: 'P-20',
    recRef: 'REC-05',
    area: 'P',
    areaName: 'Costs and overheads',
    title: 'Payroll and PAYE/NIC reconciliation',
    version: 2,
    summary: '12-month payroll summary extraction, wages proof, P32/pension reconciliation.',
    objective: 'Confirm payroll costs agree to payroll reports, and period-end liabilities are correct.',
    assertions: ['Completeness', 'Accuracy', 'Cut-off'],
    leads: [
      { code: '6200', label: 'Staff wages and salaries' },
      { code: '2300', label: 'PAYE and NIC control' },
      { code: '2350', label: 'Pensions payable' },
    ],
    kind: 'payroll',
    rollsForward: false,
    alternativeTemplates: [
      { id: 'alt_p20_dir', name: 'Directors-only payroll', description: 'Simplified directors remuneration proof' },
    ],
    procedures: [
      'Extract 12 monthly payroll summaries, P32s, and pension reports.',
      'Reconcile wages expense vs gross pay + employer NIC + pension contributions.',
      'Reconcile PAYE/NIC liability to month 12 P32 less payments made to HMRC.',
      'Reconcile pension control account to contributions due less bank payments.',
    ],
  },

  // Q-10 Provisions (REC-17)
  {
    ref: 'Q-10',
    recRef: 'REC-17',
    area: 'Q',
    areaName: 'Provisions',
    title: 'Provisions and liabilities',
    version: 2,
    summary: 'Warranty provisions, legal claims, restructuring provisions.',
    objective: 'Confirm provisions comply with FRS 102/105 recognition criteria.',
    assertions: ['Valuation', 'Obligation'],
    leads: [
      { code: '2600', label: 'Provisions for liabilities' },
    ],
    creditArea: true,
    kind: 'lines',
    rollsForward: true,
    columns: [
      { key: 'provision', label: 'Provision Nature', money: false, inTotal: false },
      { key: 'opening', label: 'Opening b/f', inTotal: false },
      { key: 'utilized', label: 'Utilized in Year', inTotal: false },
      { key: 'added', label: 'New Provision', inTotal: false },
      { key: 'closing', label: 'Closing c/f' },
    ],
    procedures: [
      'Confirm present legal or constructive obligation exists at period end.',
      'Verify reliable estimate of amount required to settle.',
    ],
  },

  // Q-20 Grants and Deferred Income (REC-17)
  {
    ref: 'Q-20',
    recRef: 'REC-17',
    area: 'Q',
    areaName: 'Provisions',
    title: 'Grants and deferred income',
    version: 2,
    summary: 'Government and capital grants, release schedule against asset depreciation.',
    objective: 'Confirm grants are recognised in income systematically over the useful life of the asset.',
    assertions: ['Accuracy', 'Cut-off'],
    leads: [
      { code: '2650', label: 'Deferred capital grants' },
    ],
    creditArea: true,
    kind: 'lines',
    rollsForward: true,
    columns: [
      { key: 'grant', label: 'Grant Scheme', money: false, inTotal: false },
      { key: 'closing', label: 'Deferred Balance c/f' },
    ],
    procedures: [
      'Inspect grant terms and conditions for performance obligations.',
      'Reconcile annual release to depreciation on the subsidised asset.',
    ],
  },

  // R-10 Related Parties and Intercompany (REC-15)
  {
    ref: 'R-10',
    recRef: 'REC-15',
    area: 'R',
    areaName: 'Related parties',
    title: 'Related parties and intercompany balances',
    version: 2,
    summary: 'Related party register, intercompany balances, transaction disclosures.',
    objective: 'Ensure all related party transactions and period-end balances are fully identified and disclosed.',
    assertions: ['Completeness', 'Disclosure'],
    leads: [
      { code: '1250', label: 'Amounts owed by group undertakings' },
      { code: '2160', label: 'Amounts owed to group undertakings' },
    ],
    kind: 'lines',
    rollsForward: true,
    columns: [
      { key: 'party', label: 'Related Party', money: false, inTotal: false },
      { key: 'relationship', label: 'Relationship', money: false, inTotal: false },
      { key: 'balance', label: 'Period-End Balance' },
    ],
    procedures: [
      'Identify related parties from director and shareholder registers.',
      'Compare intercompany balances with group entity files where available.',
      'Draft related party transactions disclosure note (STD-04).',
    ],
  },

  // S-10 Suspense, Clearing and Wages Control (REC-16)
  {
    ref: 'S-10',
    recRef: 'REC-16',
    area: 'S',
    areaName: 'Suspense',
    title: 'Suspense and clearing accounts (must be zero)',
    version: 2,
    summary: 'Must-be-zero check on suspense, clearing, and net wages control accounts.',
    objective: 'Ensure suspense and clearing accounts are cleared to zero at period end.',
    assertions: ['Completeness', 'Accuracy'],
    leads: [
      { code: '9999', label: 'Suspense and clearing accounts' },
    ],
    kind: 'lines',
    rollsForward: false,
    columns: [
      { key: 'account', label: 'Account Name', money: false, inTotal: false },
      { key: 'balance', label: 'Closing Balance' },
    ],
    procedures: [
      'Check suspense and clearing account balances: must strictly equal £0.00 (£0.01 tolerance).',
      'If non-zero, identify individual postings and propose reclassification journals.',
    ],
  },

  // T-10 Corporation Tax Provision (REC-13)
  {
    ref: 'T-10',
    recRef: 'REC-13',
    area: 'T',
    areaName: 'Tax',
    title: 'Corporation tax provision',
    version: 2,
    summary: 'Tax computation, current year charge, prior year true-up, liability c/f.',
    objective: 'Confirm corporation tax liability agrees to the tax computation.',
    assertions: ['Completeness', 'Accuracy'],
    leads: [
      { code: '2250', label: 'Corporation tax liability' },
      { code: '500', label: 'Corporation tax charge' },
    ],
    creditArea: true,
    kind: 'tax',
    rollsForward: true,
    alternativeTemplates: [
      { id: 'alt_t10_import', name: 'Import from tax software', description: 'Direct import of CT computation XML/CSV' },
    ],
    procedures: [
      'Agree prior-year payment to HMRC and establish over/under provision.',
      'Calculate current-year CT charge using current small profits rate / marginal relief.',
      'Post tax charge journal to adjusted trial balance.',
    ],
  },

  // T-20 VAT Control and Reconciliation (REC-06)
  {
    ref: 'T-20',
    recRef: 'REC-06',
    area: 'T',
    areaName: 'Tax',
    title: 'VAT control and returns reconciliation',
    version: 2,
    summary: 'VAT control account vs returns filed, open period VAT, scheme reasonableness check.',
    objective: 'Confirm VAT control account agrees to returns filed and open period liability.',
    assertions: ['Completeness', 'Accuracy', 'Cut-off'],
    leads: [
      { code: '2200', label: 'VAT control liability' },
    ],
    creditArea: true,
    kind: 'vat',
    rollsForward: false,
    alternativeTemplates: [
      { id: 'alt_t20_flat', name: 'Flat rate scheme surplus', description: 'Flat rate percentage calculation and surplus journal' },
      { id: 'alt_t20_cash', name: 'Cash accounting scheme', description: 'Cash accounting debtor/creditor VAT adjustment' },
    ],
    procedures: [
      'Reconcile returns filed during the year to VAT payments/repayments in the bank.',
      'Calculate open period VAT from period end to return date.',
      'Perform output VAT reasonableness test against standard-rated turnover.',
    ],
  },

  // T-30 Deferred Tax (REC-13) - FRS 102 only, hidden under FRS 105
  {
    ref: 'T-30',
    recRef: 'REC-13',
    area: 'T',
    areaName: 'Tax',
    title: 'Deferred tax timing differences',
    version: 2,
    summary: 'Timing differences between fixed asset NBV and capital allowance tax pools.',
    objective: 'Confirm deferred tax asset/liability under FRS 102.',
    assertions: ['Valuation', 'Completeness'],
    leads: [
      { code: '2280', label: 'Deferred tax provision' },
    ],
    creditArea: true,
    kind: 'tax',
    rollsForward: true,
    hiddenUnder: ['Micro-entity (FRS 105)', 'Sole trader', 'Partnership'],
    alternativeTemplates: [
      { id: 'alt_t30_losses', name: 'Including trading losses and short-term timing differences', description: 'Full deferred tax timing schedule' },
    ],
    procedures: [
      'Compare fixed asset NBV with tax written-down value of capital allowance pools.',
      'Apply enacted corporation tax rate (19%–25%) to taxable timing differences.',
      'Propose deferred tax movement journal to profit and loss.',
    ],
  },

  // Z-10 Completion Checklist (REV-05)
  {
    ref: 'Z-10',
    area: 'Z',
    areaName: 'Completion',
    title: 'Audit completion checklist',
    version: 5,
    summary: 'Subsequent events, going concern, representations, completion.',
    objective: 'Confirm all procedures are complete, subsequent events checked, and file is ready for partner sign-off.',
    assertions: ['Presentation', 'Going concern'],
    leads: [],
    kind: 'checklist',
    questions: [
      'Post balance sheet events reviewed up to the approval date (AIX-07)',
      'Going concern assessment documented and supported for 12 months from approval',
      'Management representation letter obtained and signed',
      'Final analytical review completed and explained',
      'All review points and audit queries cleared (REV-03)',
      'Distributable reserves confirmed adequate for all dividends paid (REC-12)',
    ],
    procedures: [
      'Review board minutes and bank payments after year end for subsequent events.',
      'Confirm going concern basis is appropriate and document key assumptions.',
      'Ensure all schedules are signed off as Reviewed before partner sign-off.',
    ],
    allTypes: true,
  },

  // Z-20 Statutory Disclosure Checklist (STD-03)
  {
    ref: 'Z-20',
    recRef: 'STD-03',
    area: 'Z',
    areaName: 'Completion',
    title: 'FRS 102 1A disclosure checklist',
    version: 2,
    summary: 'Required notes for small companies under FRS 102 Section 1A.',
    objective: 'Confirm the accounts include every disclosure required for a small company under FRS 102 Section 1A.',
    assertions: ['Presentation', 'Disclosure'],
    leads: [],
    kind: 'checklist',
    questions: [
      'Accounting policies note included (turnover, depreciation, tax, leases)',
      'Average number of employees disclosed during the period',
      'Directors’ advances, credits, and guarantees disclosed (REC-11)',
      'Financial commitments, guarantees and contingencies disclosed (REC-04, REC-10)',
      'Related party transactions disclosed where not under normal market conditions (REC-15)',
    ],
    procedures: [
      'Review draft statutory notes against FRS 102 Section 1A requirements.',
      'Ensure figures cited in notes match the approved working paper schedules.',
    ],
  },
];

/** Standard packs assigned by company type and accounting framework */
export const PACKS: Record<string, string[]> = {
  'Sole trader': ['A-10', 'B-10', 'C-10', 'K-10', 'I-10', 'P-10', 'Z-10'],
  'Partnership': ['A-10', 'B-10', 'C-10', 'F-10', 'K-10', 'E-10', 'I-10', 'P-10', 'Z-10'],
  'LLP (FRS 102 + LLP SORP)': [
    'A-10', 'B-10', 'C-10', 'C-20', 'F-10', 'K-10', 'K-20', 'E-10', 'E-20', 'I-10', 'P-10', 'P-20', 'T-10', 'T-20', 'T-30', 'Z-10'
  ],
  'Micro-entity (FRS 105)': [
    'A-10', 'B-10', 'C-10', 'C-20', 'D-10', 'D-20', 'E-10', 'F-10', 'I-10', 'K-10', 'K-20', 'L-10', 'L-20', 'P-10', 'P-20', 'S-10', 'T-10', 'T-20', 'Z-10'
  ],
  'Small company (FRS 102 1A)': [
    'A-10', 'B-10', 'C-10', 'C-20', 'C-30', 'D-10', 'D-20', 'E-10', 'E-20', 'F-10', 'G-10', 'I-10', 'K-10', 'K-20', 'L-10', 'L-20', 'L-30', 'P-10', 'P-20', 'Q-10', 'Q-20', 'R-10', 'S-10', 'T-10', 'T-20', 'T-30', 'Z-10', 'Z-20'
  ],
  'Medium/large (FRS 102)': [
    'A-10', 'B-10', 'C-10', 'C-20', 'C-30', 'D-10', 'D-20', 'E-10', 'E-20', 'F-10', 'G-10', 'I-10', 'K-10', 'K-20', 'L-10', 'L-20', 'L-30', 'P-10', 'P-20', 'Q-10', 'Q-20', 'R-10', 'S-10', 'T-10', 'T-20', 'T-30', 'Z-10'
  ],
  'IFRS company/group': [
    'A-10', 'B-10', 'C-10', 'C-20', 'C-30', 'D-10', 'D-20', 'E-10', 'E-20', 'F-10', 'G-10', 'I-10', 'K-10', 'K-20', 'L-10', 'L-20', 'L-30', 'P-10', 'P-20', 'Q-10', 'Q-20', 'R-10', 'S-10', 'T-10', 'T-20', 'T-30', 'Z-10'
  ],
  'Charity (SORP)': [
    'A-10', 'B-10', 'C-10', 'F-10', 'K-10', 'E-10', 'I-10', 'P-10', 'Z-10'
  ],
  'Academy trust': [
    'A-10', 'B-10', 'C-10', 'F-10', 'K-10', 'E-10', 'I-10', 'P-10', 'Z-10'
  ],
};

/** Optional papers that only some engagements need */
export const OPTIONAL_REFS = ['C-30', 'D-10', 'G-10', 'L-30', 'Q-10', 'Q-20', 'R-10', 'Z-20'];

export function packFor(companyType: string | undefined, includeOptional = true): string[] {
  const refs = PACKS[companyType ?? ''] ?? PACKS['Small company (FRS 102 1A)'];
  return includeOptional ? refs : refs.filter((r) => !OPTIONAL_REFS.includes(r));
}

export function templateFor(ref: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.ref === ref);
}

/** Blank data for a new paper of this template */
export function blankPaperData(t: TemplateDef): Record<string, any> {
  const base = {
    title: t.title,
    objective: t.objective,
    assertions: t.assertions,
    conclusion: { text: '', bot_dismissed: false },
    explanations: {} as Record<string, string>,
    preparer_notes: '',
    work_done_summary: '',
    values_to_confirm_count: 0,
    confidence_gate_items: [] as any[],
  };

  if (t.kind === 'reconciliation') {
    return {
      ...base,
      bank_name: 'Starling Bank Business Current Account',
      statement_source: 'Upload', // or 'Ledger feed' or 'Open Banking'
      statement_p: '0',
      confirmation_p: '0',
      sections: [
        { id: 'less', label: 'Less: unpresented cheques & uncleared debits', sign: -1, rows: [] },
        { id: 'add', label: 'Add: deposits in transit & uncleared credits', sign: 1, rows: [] },
      ],
    };
  }

  if (t.kind === 'assets') {
    return {
      ...base,
      classes: [
        { id: 'c1', name: 'Office Equipment', rate: '20', cost_opening_p: '0', deprec_opening_p: '0' },
        { id: 'c2', name: 'Computer Equipment', rate: '25', cost_opening_p: '0', deprec_opening_p: '0' },
      ],
      movements: [],
      proposed_additions: [],
      policy: 'Straight line on cost over useful economic life.',
    };
  }

  if (t.kind === 'vat') {
    return {
      ...base,
      scheme: 'standard',
      stagger: 'quarterly',
      flat_rate_pct: 12,
      returns: [
        { id: 'ret_1', period_label: 'Q1 (Dec–Feb)', box1_vat_due: '0', box4_vat_reclaimed: '0', box5_net_vat: '0', paid_date: '2026-04-07', paid_amount_p: '0', matched: true },
        { id: 'ret_2', period_label: 'Q2 (Mar–May)', box1_vat_due: '0', box4_vat_reclaimed: '0', box5_net_vat: '0', paid_date: '2026-07-07', paid_amount_p: '0', matched: true },
        { id: 'ret_3', period_label: 'Q3 (Jun–Aug)', box1_vat_due: '0', box4_vat_reclaimed: '0', box5_net_vat: '0', paid_date: '2026-10-07', paid_amount_p: '0', matched: true },
        { id: 'ret_4', period_label: 'Q4 (Sep–Nov)', box1_vat_due: '0', box4_vat_reclaimed: '0', box5_net_vat: '0', paid_date: null, paid_amount_p: '0', matched: false },
      ],
      open_period_p: '0',
    };
  }

  if (t.kind === 'payroll') {
    return {
      ...base,
      director_remuneration_p: '0',
      average_employees: 2,
      months: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        label: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][i],
        gross_pay_p: '0',
        employer_nic_p: '0',
        employee_nic_p: '0',
        paye_tax_p: '0',
        employer_pension_p: '0',
        employee_pension_p: '0',
        hmrc_paid_p: '0',
        pension_paid_p: '0',
        matched: true,
      })),
    };
  }

  if (t.kind === 'leases') {
    return {
      ...base,
      model: 'right_of_use',
      discount_rate_pct: 5.5,
      leases: [],
    };
  }

  if (t.kind === 'dla') {
    return {
      ...base,
      directors: [
        {
          id: 'dir_1',
          name: 'Managing Director',
          opening_p: '0',
          drawings_p: '0',
          salary_credited_p: '0',
          dividends_credited_p: '0',
          repaid_in_9m_p: '0',
          closing_p: '0',
          max_overdrawn_in_year_p: '0',
          s455_rate_pct: 33.75,
        },
      ],
    };
  }

  if (t.kind === 'loans') {
    return {
      ...base,
      lender: 'Barclays Bank UK',
      principal_p: '0',
      interest_rate_pct: 5.0,
      term_months: 60,
      secured: true,
      maturity: {
        within_1y_p: '0',
        within_1_to_5y_p: '0',
        over_5y_p: '0',
      },
    };
  }

  if (t.kind === 'lines') {
    return { ...base, lines: [] };
  }

  return {
    ...base,
    items: (t.questions ?? []).map((q, i) => ({ id: `q${i + 1}`, question: q, answer: null, comment: '' })),
    ...(t.materiality ? { benchmark_p: '0', benchmark_name: 'Revenue', percent: '1', pm_percent: '75' } : {}),
  };
}
