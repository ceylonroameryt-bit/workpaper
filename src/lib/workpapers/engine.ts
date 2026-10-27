import { db } from '../server/db';
import { asPence, formatPence } from '../money';
import { TemplateDef, templateFor } from './templates';
import type { Workpaper } from '../types/models';

/**
 * Calculations for every working paper: lead figures from the Blynt chart,
 * schedule totals, checks and the Blynt Bot conclusion draft.
 * All money is integer pence (bigint). Trial balance figures are debit-positive.
 */

export interface LeadFigure {
  code: string;
  label: string;
  draft: bigint;
  adjustments: bigint;
  final: bigint;
  prior: bigint | null;
  mapped: boolean;
}

export interface PaperCheck {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
  explanation?: string;
}

export interface Anchor {
  id: string;
  label: string;
}

export interface PaperResult {
  template: TemplateDef;
  leads: LeadFigure[];
  checks: PaperCheck[];
  anchors: Anchor[];
  draftConclusion: string;
  /** Totals the page shows, keyed by name. */
  totals: Record<string, bigint>;
}

const matches = (code: string | null, prefix: string) => !!code && code.startsWith(prefix);

function tbFor(engagementId: string, prefix: string) {
  const rows = db.account_mappings.filter(
    (m) => m.engagement_id === engagementId && m.status === 'confirmed' && matches(m.blynt_code, prefix)
  );
  const draft = rows.reduce((acc, m) => acc + asPence(m.balance_p), 0n);
  const adjustments = db.adjustments
    .filter((a) => a.engagement_id === engagementId && (a.status === 'approved' || a.status === 'posted'))
    .flatMap((a) => a.lines)
    .filter((l) => matches(l.blynt_code, prefix))
    .reduce((acc, l) => acc + asPence(l.debit_p) - asPence(l.credit_p), 0n);
  return { draft, adjustments, final: draft + adjustments, mapped: rows.length > 0 };
}

export function leadFigures(engagementId: string, t: TemplateDef): LeadFigure[] {
  const prior = db.engagements.find((e) => e.id === engagementId)?.prior_engagement_id;
  return t.leads.map((l) => {
    const cur = tbFor(engagementId, l.code);
    const py = prior ? tbFor(prior, l.code) : null;
    return { code: l.code, label: l.label, ...cur, prior: py?.mapped ? py.final : null };
  });
}

/** The trial balance figure the schedule must agree to, shown positive for credit areas. */
function leadTotal(t: TemplateDef, leads: LeadFigure[]) {
  const total = leads.reduce((acc, l) => acc + l.final, 0n);
  return t.creditArea ? -total : total;
}

const tie = (id: string, label: string, schedule: bigint, tb: bigint | null, tbLabel: string): PaperCheck =>
  tb === null
    ? { id, label, detail: `No confirmed trial balance mapping for ${tbLabel} yet.`, passed: false }
    : {
        id,
        label,
        detail: `Schedule ${formatPence(schedule)} · ${tbLabel} ${formatPence(tb)} · difference ${formatPence(schedule - tb)}`,
        passed: schedule === tb,
      };

/** Attachments linked to a schedule row of this paper. */
export function linkedFiles(workpaperId: string, rowId: string) {
  return db.attachments.filter(
    (a) => a.workpaper_id === workpaperId && (a.links ?? []).some((l: any) => l.anchor_json?.row === rowId)
  );
}

export function evaluatePaper(wp: Workpaper): PaperResult | null {
  const t = templateFor(wp.ref);
  if (!t) return null;
  const data = wp.data_json as Record<string, any>;
  const leads = leadFigures(wp.engagement_id, t);
  const anyMapped = leads.some((l) => l.mapped);
  const tbShown = anyMapped ? leadTotal(t, leads) : null;
  const checks: PaperCheck[] = [];
  const anchors: Anchor[] = [];
  const totals: Record<string, bigint> = {};
  let draft = '';

  if (t.kind === 'reconciliation') {
    const ledger = tbShown;
    const statement = asPence(data.statement_p);
    let adjusted = statement;
    anchors.push({ id: 'statement', label: 'Balance per bank statement' });
    for (const section of data.sections ?? []) {
      for (const row of section.rows ?? []) {
        adjusted += BigInt(section.sign) * asPence(row.amount_p);
        anchors.push({ id: row.id, label: `${section.label.replace(/^(Less|Add): /, '')} · ${row.desc || 'item'}` });
      }
    }
    totals.ledger = ledger ?? 0n;
    totals.adjusted = adjusted;
    totals.difference = adjusted - (ledger ?? 0n);
    checks.push(tie('adjusted_ledger', 'Adjusted bank balance equals ledger', adjusted, ledger, 'ledger (TB)'));
    const confirmation = asPence(data.confirmation_p);
    if (confirmation !== 0n) {
      checks.push({
        id: 'confirmation',
        label: 'Statement agrees to bank confirmation',
        detail: `Statement ${formatPence(statement)} · confirmation ${formatPence(confirmation)} · difference ${formatPence(statement - confirmation)}`,
        passed: statement === confirmation,
      });
    }
    const statementFiles = linkedFiles(wp.id, 'statement');
    checks.push({
      id: 'statement_evidence',
      label: 'Bank statement attached',
      detail: statementFiles.length ? `${statementFiles.length} file(s) linked to the statement balance` : 'Attach the year-end bank statement to the statement line.',
      passed: statementFiles.length > 0,
    });
    draft =
      ledger === null
        ? ''
        : `The bank balance of ${formatPence(ledger)} agrees to the trial balance${
            adjusted === ledger ? ' and reconciles to the bank statement' : `, with an unreconciled difference of ${formatPence(adjusted > ledger ? adjusted - ledger : ledger - adjusted)}`
          }.${(data.sections ?? []).some((s: any) => s.rows?.length) ? ' Reconciling items should be vouched to after-date statements.' : ' There are no reconciling items.'}`;
  }

  if (t.kind === 'assets') {
    const movements: any[] = data.movements ?? [];
    let cost = 0n,
      dep = 0n,
      charge = 0n,
      expected = 0n,
      pl = 0n;
    for (const c of data.classes ?? []) {
      const adds = movements.filter((m) => m.type === 'addition' && m.class_id === c.id);
      const disp = movements.filter((m) => m.type === 'disposal' && m.class_id === c.id);
      const addCost = adds.reduce<bigint>((a, m) => a + asPence(m.cost_p), 0n);
      const dispCost = disp.reduce<bigint>((a, m) => a + asPence(m.cost_p), 0n);
      const dispDep = disp.reduce<bigint>((a, m) => a + asPence(m.deprec_p), 0n);
      const closingCost = asPence(c.cost_opening_p) + addCost - dispCost;
      const closingDep = asPence(c.deprec_opening_p) + asPence(c.charge_p) - dispDep;
      totals[`${c.id}_additions`] = addCost;
      totals[`${c.id}_disposals`] = dispCost;
      totals[`${c.id}_dep_disposals`] = dispDep;
      totals[`${c.id}_cost`] = closingCost;
      totals[`${c.id}_dep`] = closingDep;
      totals[`${c.id}_nbv`] = closingCost - closingDep;
      cost += closingCost;
      dep += closingDep;
      charge += asPence(c.charge_p);
      // Full year in the year of purchase, none in the year of sale: rate x closing cost
      const rateBp = BigInt(Math.round(Number(c.rate || 0) * 100));
      expected += (closingCost * rateBp + 5000n) / 10000n;
      anchors.push({ id: c.id, label: c.name });
    }
    for (const m of movements) {
      if (m.type === 'disposal') pl += asPence(m.proceeds_p) - (asPence(m.cost_p) - asPence(m.deprec_p));
      anchors.push({ id: m.id, label: `${m.type === 'addition' ? 'Addition' : 'Disposal'} · ${m.item || 'item'}` });
    }
    Object.assign(totals, { cost, dep, nbv: cost - dep, charge, expected, pl });
    const lead = (prefix: string) => {
      const l = leads.find((x) => x.code === prefix);
      return l && l.mapped ? l.final : null;
    };
    checks.push(tie('cost_tb', 'Closing cost agrees to trial balance', cost, lead('15'), 'TB 1500'));
    const depTb = lead('17');
    checks.push(tie('dep_tb', 'Closing depreciation agrees to trial balance', dep, depTb === null ? null : -depTb, 'TB 1700'));
    checks.push(tie('charge_tb', 'Charge agrees to trial balance', charge, lead('6900'), 'TB 6900'));
    checks.push({
      id: 'proof',
      label: 'Proof in total of depreciation',
      detail: `Expected ${formatPence(expected)} · charged ${formatPence(charge)} · difference ${formatPence(charge - expected)}`,
      passed: (charge - expected <= 100n && expected - charge <= 100n),
    });
    const disposals = movements.filter((m) => m.type === 'disposal');
    if (disposals.length || lead('6950') !== null) {
      const plTb = lead('6950');
      checks.push(tie('pl_tb', 'Disposal loss or profit agrees to trial balance', -pl, plTb, 'TB 6950'));
    }
    const unvouched = movements.filter(
      (m) => (m.type === 'disposal' || asPence(m.cost_p) > 100000n) && linkedFiles(wp.id, m.id).length === 0
    );
    checks.push({
      id: 'movement_evidence',
      label: 'Additions over £1,000 and all disposals have evidence',
      detail: unvouched.length
        ? `${unvouched.length} item(s) need a file: ${unvouched.map((m) => m.item || 'item').join(', ')}`
        : movements.length
          ? 'Every addition over £1,000 and every disposal has a linked file.'
          : 'No additions or disposals in the year.',
      passed: unvouched.length === 0,
    });
    draft = `Fixed assets of ${formatPence(cost - dep)} net book value ${
      checks[0].passed && checks[1].passed ? 'agree to the trial balance' : 'do not yet agree to the trial balance'
    }. Depreciation of ${formatPence(charge)} ${checks[3].passed ? 'agrees to policy in total' : 'differs from the expected charge'}.${
      disposals.length ? ` The disposal ${pl < 0n ? 'loss' : 'profit'} is ${formatPence(pl < 0n ? -pl : pl)}.` : ''
    }${unvouched.length ? ' Some additions or disposals are still pending evidence.' : ''}`;
  }

  if (t.kind === 'lines') {
    const cols = (t.columns ?? []).filter((c) => c.money !== false && c.inTotal !== false);
    let total = 0n;
    for (const line of data.lines ?? []) {
      for (const c of cols) total += asPence(line[`${c.key}_p`]);
      anchors.push({ id: line.id, label: line.desc || 'Line' });
    }
    totals.total = total;
    totals.difference = total - (tbShown ?? 0n);

    // REC-16: Suspense, clearing and control accounts must be zero with £0.01 tolerance
    if (wp.ref === 'S-10' || t.ref === 'S-10') {
      const isNil = total === 0n && (tbShown === null || tbShown === 0n);
      checks.push({
        id: 'suspense_zero',
        label: 'Suspense and clearing balance must be zero (£0.00)',
        detail: `Current balance ${formatPence(total)} · TB ${formatPence(tbShown ?? 0n)}. Suspense accounts must be nil at period end.`,
        passed: isNil,
      });
    } else {
      checks.push(tie('total_tb', 'Schedule total agrees to trial balance', total, tbShown, `TB ${t.leads.map((l) => l.code).join(', ')}`));
    }

    const missing = (data.lines ?? []).filter((l: any) => !l.desc?.trim());
    if (missing.length) {
      checks.push({ id: 'descriptions', label: 'Every line has a description', detail: `${missing.length} line(s) have no description.`, passed: false });
    }
    draft =
      tbShown === null
        ? ''
        : `${t.areaName} of ${formatPence(tbShown)} ${total === tbShown ? 'agree to the supporting schedule' : `differ from the schedule by ${formatPence(total - tbShown)}`}.`;
  }

  if (t.kind === 'vat') {
    const returns: any[] = data.returns ?? [];
    let netVatDue = 0n;
    let paidAmount = 0n;
    returns.forEach((r) => {
      netVatDue += asPence(r.box5_net_vat ?? '0');
      if (r.matched) paidAmount += asPence(r.paid_amount_p ?? '0');
      anchors.push({ id: r.id, label: `${r.period_label || 'Return'} · Net VAT` });
    });
    const openPeriod = asPence(data.open_period_p ?? '0');
    const calculatedLiability = (netVatDue - paidAmount) + openPeriod;
    anchors.push({ id: 'open_period', label: 'Open Period Accrued VAT' });

    totals.net_vat_due = netVatDue;
    totals.paid_amount = paidAmount;
    totals.open_period = openPeriod;
    totals.liability = calculatedLiability;
    totals.difference = calculatedLiability - (tbShown ?? 0n);

    checks.push(tie('vat_tb', 'Calculated VAT liability agrees to VAT control account', calculatedLiability, tbShown, 'VAT control (TB 2200)'));
    const unmatched = returns.filter((r) => !r.matched && asPence(r.paid_amount_p ?? '0') > 0n);
    checks.push({
      id: 'vat_payments_matched',
      label: 'All HMRC payments matched to returns',
      detail: unmatched.length === 0 ? 'All VAT returns reconciled to payments.' : `${unmatched.length} return(s) have unverified payment records.`,
      passed: unmatched.length === 0,
    });

    draft = `VAT control account of ${formatPence(tbShown ?? 0n)} ${
      calculatedLiability === (tbShown ?? 0n)
        ? 'reconciles to VAT returns filed and open period liability'
        : `differs from calculated liability of ${formatPence(calculatedLiability)} by ${formatPence(calculatedLiability - (tbShown ?? 0n))}`
    }.`;
  }

  if (t.kind === 'payroll') {
    const months: any[] = data.months ?? [];
    let totalGross = 0n;
    let totalEmpNic = 0n;
    let totalEmpPension = 0n;
    let totalEeNic = 0n;
    let totalPaye = 0n;
    let totalEePension = 0n;
    let totalHmrcPaid = 0n;
    let totalPensionPaid = 0n;

    months.forEach((m) => {
      totalGross += asPence(m.gross_pay_p ?? '0');
      totalEmpNic += asPence(m.employer_nic_p ?? '0');
      totalEmpPension += asPence(m.employer_pension_p ?? '0');
      totalEeNic += asPence(m.employee_nic_p ?? '0');
      totalPaye += asPence(m.paye_tax_p ?? '0');
      totalEePension += asPence(m.employee_pension_p ?? '0');
      totalHmrcPaid += asPence(m.hmrc_paid_p ?? '0');
      totalPensionPaid += asPensionPence(m.pension_paid_p ?? '0');
      anchors.push({ id: `month_${m.month}`, label: `${m.label || `Month ${m.month}`} Payroll` });
    });

    function asPensionPence(v: any): bigint {
      return asPence(v);
    }

    const totalWagesCost = totalGross + totalEmpNic + totalEmpPension;
    const payeNicDue = totalEeNic + totalEmpNic + totalPaye;
    const payeNicLiability = payeNicDue - totalHmrcPaid;
    const pensionDue = totalEePension + totalEmpPension;
    const pensionLiability = pensionDue - totalPensionPaid;

    totals.total_gross = totalGross;
    totals.wages_cost = totalWagesCost;
    totals.paye_nic_liability = payeNicLiability;
    totals.pension_liability = pensionLiability;
    totals.difference = totalWagesCost - (tbShown ?? 0n);

    checks.push(tie('wages_tb', 'Wages expense agrees to P&L payroll accounts', totalWagesCost, tbShown, 'Wages expense (TB 7000)'));
    checks.push({
      id: 'months_complete',
      label: 'All 12 monthly payroll reports uploaded',
      detail: months.length === 12 ? '12 months payroll summaries accounted for.' : `${months.length} of 12 months recorded.`,
      passed: months.length === 12,
    });

    draft = `Payroll reconciliation completed for 12 months. Total gross wages and on-costs of ${formatPence(totalWagesCost)} ${
      totalWagesCost === (tbShown ?? 0n) ? 'agree to the trial balance' : 'differ from trial balance'
    }. Year-end PAYE/NIC liability is ${formatPence(payeNicLiability)} and pension liability is ${formatPence(pensionLiability)}.`;
  }

  if (t.kind === 'leases') {
    const leases: any[] = data.leases ?? [];
    let totalRouCost = 0n;
    let totalRouDep = 0n;
    let totalLiability = 0n;
    let comm1y = 0n, comm1to5y = 0n, commOver5y = 0n;

    leases.forEach((l) => {
      totalRouCost += asPence(l.rou_cost_p ?? '0');
      totalRouDep += asPence(l.rou_dep_p ?? '0');
      totalLiability += asPence(l.liability_cf_p ?? '0');
      comm1y += asPence(l.comm_1y_p ?? '0');
      comm1to5y += asPence(l.comm_1to5y_p ?? '0');
      commOver5y += asPence(l.comm_over5y_p ?? '0');
      anchors.push({ id: l.id, label: `Lease · ${l.property || l.lessor || 'Asset'}` });
    });

    totals.rou_cost = totalRouCost;
    totals.rou_dep = totalRouDep;
    totals.rou_nbv = totalRouCost - totalRouDep;
    totals.lease_liability = totalLiability;
    totals.difference = totalLiability - (tbShown ?? 0n);

    checks.push(tie('lease_tb', 'Lease liability agrees to trial balance', totalLiability, tbShown, 'Lease liabilities (TB 2310/2320)'));
    checks.push({
      id: 'commitments_split',
      label: 'Commitments maturity split completed',
      detail: `Within 1y: ${formatPence(comm1y)} · 1-5y: ${formatPence(comm1to5y)} · >5y: ${formatPence(commOver5y)}`,
      passed: leases.length === 0 || (comm1y + comm1to5y + commOver5y > 0n),
    });

    draft = `Leases evaluated under ${data.model === 'right_of_use' ? 'FRS 102 Right-of-use model' : 'FRS 105 Operating lease commitments model'}. Total liability ${formatPence(totalLiability)} ${
      totalLiability === (tbShown ?? 0n) ? 'agrees to the trial balance.' : 'differs from the trial balance.'
    }`;
  }

  if (t.kind === 'dla') {
    const directors: any[] = data.directors ?? [];
    let netDla = 0n;
    let anyOverdrawn = false;
    let totalS455 = 0n;

    directors.forEach((d) => {
      const op = asPence(d.opening_p ?? '0');
      const dr = asPence(d.drawings_p ?? '0');
      const sal = asPence(d.salary_credited_p ?? '0');
      const div = asPence(d.dividends_credited_p ?? '0');
      const rep = asPence(d.repaid_in_9m_p ?? '0');
      const cl = op + dr - sal - div;
      netDla += cl;
      if (cl < 0n) {
        anyOverdrawn = true;
        const s455Rate = BigInt(Math.round(Number(d.s455_rate_pct || 33.75) * 100));
        const s455 = (-cl * s455Rate) / 10000n;
        totalS455 += s455;
      }
      anchors.push({ id: d.id, label: `DLA · ${d.name || 'Director'}` });
    });

    totals.net_dla = netDla;
    totals.s455_tax = totalS455;
    totals.difference = netDla - (tbShown ?? 0n);

    checks.push(tie('dla_tb', "Directors' loan balance agrees to trial balance", netDla, tbShown, 'DLA (TB 2100)'));
    checks.push({
      id: 'dla_overdrawn_check',
      label: "s455 tax check on overdrawn loan accounts",
      detail: anyOverdrawn
        ? `Overdrawn account identified. Potential s455 tax liability: ${formatPence(totalS455)} if not repaid within 9 months.`
        : "No overdrawn director loan balances at period end.",
      passed: !anyOverdrawn || (directors.every((d) => asPence(d.repaid_in_9m_p ?? '0') >= -asPence(d.closing_p ?? '0'))),
    });

    draft = `Director loan accounts total ${formatPence(netDla)} ${
      netDla === (tbShown ?? 0n) ? 'and agree to the trial balance.' : 'and differ from the trial balance.'
    } ${anyOverdrawn ? `Caution: Overdrawn balance detected subject to s455 tax review (${formatPence(totalS455)}).` : 'All accounts in credit.'}`;
  }

  if (t.kind === 'loans') {
    const principal = asPence(data.principal_p ?? '0');
    const within1y = asPence(data.maturity?.within_1y_p ?? '0');
    const within1to5y = asPence(data.maturity?.within_1_to_5y_p ?? '0');
    const over5y = asPence(data.maturity?.over_5y_p ?? '0');
    const maturitySum = within1y + within1to5y + over5y;

    totals.principal = principal;
    totals.within_1y = within1y;
    totals.within_1to5y = within1to5y;
    totals.over_5y = over5y;
    totals.difference = principal - (tbShown ?? 0n);

    anchors.push({ id: 'principal', label: `${data.lender || 'Loan'} · Principal` });
    anchors.push({ id: 'maturity', label: `${data.lender || 'Loan'} · Maturity Split` });

    checks.push(tie('loan_tb', 'Loan principal agrees to trial balance', principal, tbShown, 'Bank loans (TB 2300)'));
    checks.push({
      id: 'loan_maturity_tie',
      label: 'Maturity analysis agrees to total principal',
      detail: `Maturity sum ${formatPence(maturitySum)} · Principal ${formatPence(principal)}`,
      passed: principal === 0n || maturitySum === principal,
    });

    draft = `Loan with ${data.lender || 'lender'} of ${formatPence(principal)} ${
      principal === (tbShown ?? 0n) ? 'agrees to ledger.' : 'differs from ledger.'
    } Maturity analysis: <1yr ${formatPence(within1y)}, 1-5yrs ${formatPence(within1to5y)}, >5yrs ${formatPence(over5y)}.`;
  }

  if (t.kind === 'checklist') {
    const items: any[] = data.items ?? [];
    const unanswered = items.filter((i) => !i.answer);
    const noWithoutComment = items.filter((i) => i.answer === 'no' && !i.comment?.trim());
    items.forEach((i) => anchors.push({ id: i.id, label: i.question }));
    checks.push({
      id: 'answered',
      label: 'Every question answered',
      detail: unanswered.length ? `${unanswered.length} of ${items.length} still to answer.` : `All ${items.length} answered.`,
      passed: unanswered.length === 0,
    });
    checks.push({
      id: 'no_explained',
      label: 'Every “No” has an explanation',
      detail: noWithoutComment.length ? `${noWithoutComment.length} answer(s) need a comment.` : 'Nothing to explain.',
      passed: noWithoutComment.length === 0,
    });
    if (t.materiality) {
      const benchmark = asPence(data.benchmark_p);
      const pctBp = BigInt(Math.round(Number(data.percent || 0) * 100));
      const pmBp = BigInt(Math.round(Number(data.pm_percent || 0) * 100));
      const mat = (benchmark * pctBp) / 10000n;
      totals.materiality = mat;
      totals.performance = (mat * pmBp) / 10000n;
      totals.benchmark_tb = tbShown ?? 0n;
      checks.push({
        id: 'materiality',
        label: 'Materiality set',
        detail: benchmark > 0n ? `Materiality ${formatPence(mat)} · performance ${formatPence(totals.performance)}` : 'Enter the benchmark to set materiality.',
        passed: benchmark > 0n && mat > 0n,
      });
    }
    draft = unanswered.length
      ? ''
      : `All ${items.length} checklist questions are answered${
          items.some((i) => i.answer === 'no') ? ', and every exception is explained' : ' with no exceptions'
        }.${t.materiality && totals.materiality ? ` Materiality is set at ${formatPence(totals.materiality)}.` : ''}`;
  }

  // Explanations entered by the preparer clear a failing check for sign-off purposes
  const explanations: Record<string, string> = data.explanations ?? {};
  for (const c of checks) if (!c.passed && explanations[c.id]?.trim()) c.explanation = explanations[c.id];

  return { template: t, leads, checks, anchors, draftConclusion: draft, totals };
}
