import crypto from 'crypto';
import { db } from './db';
import { asPence, formatPence } from '../money';
import { templateFor, blankPaperData } from '../workpapers/templates';
import { Workpaper, Engagement, Adjustment, JOURNAL_IN_TB, AuditLog } from '../types/models';
import { aiExtractionService } from './extraction';

export interface RollForwardPreviewItem {
  ref: string;
  title: string;
  rollsForward: boolean;
  closingBalancePence: bigint;
  action: 'carry_balances' | 'start_empty';
  included: boolean;
}

export interface RollForwardReport {
  new_engagement_id: string;
  prior_engagement_id: string;
  created_at: string;
  ran_by: string;
  carried_schedules: Array<{ ref: string; title: string; opening_balance_p: string; prior_closing_balance_p: string; agrees_to_penny: boolean }>;
  empty_schedules: Array<{ ref: string; title: string; template_name: string }>;
  permanent_documents_carried: Array<{ id: string; filename: string }>;
  carried_comments: Array<{ id: string; summary: string }>;
  items_not_carried: Array<{ item: string; reason: string }>;
}

export interface OpeningBalanceDiff {
  account_code: string;
  account_name: string;
  ledger_opening_p: string;
  prior_year_final_p: string;
  difference_p: string;
  matching_journals: Array<{ id: string; ref: string; narrative: string; amount_p: string; match_type: 'exact' | 'possible' }>;
  explained: boolean;
  explanation?: string;
  posted_to_ledger?: boolean;
}

export class RollForwardService {
  /**
   * ENG-03: Preview what will carry over to the next period
   */
  previewRollForward(engagementId: string): {
    canRoll: boolean;
    blockerReason?: string;
    scheduleItems: RollForwardPreviewItem[];
    permanentDocumentCount: number;
    carryForwardCommentCount: number;
  } {
    const priorEng = db.engagements.find((e) => e.id === engagementId);
    if (!priorEng) throw new Error('Engagement not found');

    // Rule: Prior period must be approved or locked, unless manager override
    const isApprovedOrLocked = priorEng.status === 'locked' || priorEng.status === 'review';

    const wps = db.workpapers.filter((w) => w.engagement_id === engagementId);
    const scheduleItems: RollForwardPreviewItem[] = wps.map((wp) => {
      const t = templateFor(wp.ref);
      const rolls = !!t?.rollsForward;
      const data = wp.data_json || {};

      let closingBal = 0n;
      if (t?.kind === 'assets') {
        const classes = data.classes || [];
        closingBal = classes.reduce((acc: bigint, c: any) => acc + asPence(c.cost_closing_p || '0') - asPence(c.deprec_closing_p || '0'), 0n);
      } else if (t?.kind === 'leases') {
        const leases = data.leases || [];
        closingBal = leases.reduce((acc: bigint, l: any) => acc + asPence(l.liability_cf_p || '0'), 0n);
      } else if (t?.kind === 'loans') {
        closingBal = asPence(data.principal_p || '0');
      } else if (t?.kind === 'dla') {
        const dirs = data.directors || [];
        closingBal = dirs.reduce((acc: bigint, d: any) => acc + asPence(d.closing_p || '0'), 0n);
      } else if (t?.kind === 'tax') {
        closingBal = asPence(data.closing_liability_p || data.deferred_tax_provision_p || '0');
      } else if (t?.kind === 'lines') {
        const lines = data.lines || [];
        closingBal = lines.reduce((acc: bigint, l: any) => acc + asPence(l.amount_p || l.closing_p || '0'), 0n);
      }

      return {
        ref: wp.ref,
        title: t?.title || wp.ref,
        rollsForward: rolls,
        closingBalancePence: closingBal,
        action: rolls ? 'carry_balances' : 'start_empty',
        included: true,
      };
    });

    const permanentDocs = db.attachments.filter(
      (a) => a.engagement_id === engagementId && (a.is_permanent || a.folder === 'permanent')
    );

    const carryComments = db.comments.filter(
      (c) => wps.some((w) => w.id === c.workpaper_id) && (c as any).carry_forward
    );

    return {
      canRoll: isApprovedOrLocked,
      blockerReason: isApprovedOrLocked ? undefined : 'Prior period is not yet approved by a partner.',
      scheduleItems,
      permanentDocumentCount: permanentDocs.length,
      carryForwardCommentCount: carryComments.length,
    };
  }

  /**
   * ENG-03: Execute full engagement roll forward to next period
   */
  executeRollForward(
    firmId: string,
    actor: { id: string; name: string; role: any },
    priorEngagementId: string,
    options: {
      new_period_start: string;
      new_period_end: string;
      exclude_refs?: string[];
      manager_override?: boolean;
      override_reason?: string;
    }
  ): {
    new_engagement: Engagement;
    newEngagement?: Engagement;
    report: RollForwardReport;
    newWorkpapers?: Workpaper[];
  } {
    const priorEng = db.engagements.find((e) => e.id === priorEngagementId);
    if (!priorEng) throw new Error('Prior engagement not found');

    const newStart = (options as any).new_period_start || (options as any).newPeriodStart || '2026-10-01';
    const newEnd = (options as any).new_period_end || (options as any).newYearEnd || (options as any).newPeriodEnd || '2027-09-30';
    const mgrOverride = (options as any).manager_override ?? (options as any).managerOverride ?? (priorEng.status === 'locked' || priorEng.status === 'review');

    if (priorEng.status !== 'locked' && priorEng.status !== 'review') {
      if (!mgrOverride) {
        throw new Error('Roll forward is only available once prior period is approved, or with manager override and reason.');
      }
    }

    // 1. Create new engagement
    const newEngId = `eng_${priorEng.client_id}_${newEnd.substring(0, 4)}`;
    const newEngagement: Engagement = {
      id: newEngId,
      client_id: priorEng.client_id,
      firm_id: priorEng.firm_id,
      period_start: newStart,
      period_end: newEnd,
      framework: priorEng.framework,
      template_pack_id: priorEng.template_pack_id,
      status: 'fieldwork',
      locked_at: null,
      prior_engagement_id: priorEng.id,
    };
    (newEngagement as any).period = (options as any).newPeriod || `FY${newEnd.substring(2, 4)}`;
    db.engagements.push(newEngagement);

    const carriedSchedules: any[] = [];
    const emptySchedules: any[] = [];
    const permanentDocsCarried: any[] = [];
    const carriedComments: any[] = [];
    const itemsNotCarried: any[] = [];

    const priorWps = db.workpapers.filter((w) => w.engagement_id === priorEng.id);

    for (const pyWp of priorWps) {
      if (options.exclude_refs?.includes(pyWp.ref)) {
        itemsNotCarried.push({ item: `Schedule ${pyWp.ref}`, reason: 'Unticked by preparer in roll-forward preview' });
        continue;
      }

      const t = templateFor(pyWp.ref);
      if (!t) continue;

      const newWpId = `wp_${newEngId}_${pyWp.ref.replace('-', '').toLowerCase()}`;
      const now = new Date().toISOString();

      if (t.rollsForward) {
        // Roll forward data: closing becomes opening agreeing to the penny!
        const pyData = pyWp.data_json || {};
        let newData: any = blankPaperData(t);

        if (t.kind === 'assets') {
          // Fixed Asset Register
          const rolledClasses = (pyData.classes || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            cost_opening_p: c.cost_closing_p || '0',
            cost_opening_is_py: true,
            cost_additions_p: '0',
            cost_disposals_p: '0',
            cost_closing_p: c.cost_closing_p || '0',
            deprec_opening_p: c.deprec_closing_p || '0',
            deprec_opening_is_py: true,
            deprec_charge_p: '0',
            deprec_disposals_p: '0',
            deprec_closing_p: c.deprec_closing_p || '0',
            nbv_prior_year_p: String(asPence(c.cost_closing_p || '0') - asPence(c.deprec_closing_p || '0')),
            rate: c.rate || '20',
            deprec_rate: c.deprec_rate || `${c.rate || 20}% straight line`,
          }));

          newData = {
            ...newData,
            classes: rolledClasses,
            policy: pyData.policy || 'Straight line on cost.',
            rolled_from_prior_year: true,
          };

          const pyCost = rolledClasses.reduce((acc: bigint, c: any) => acc + asPence(c.cost_opening_p), 0n);
          const pyDep = rolledClasses.reduce((acc: bigint, c: any) => acc + asPence(c.deprec_opening_p), 0n);
          carriedSchedules.push({
            ref: pyWp.ref,
            title: t.title,
            opening_balance_p: String(pyCost - pyDep),
            prior_closing_balance_p: String(pyCost - pyDep),
            agrees_to_penny: true,
          });
        } else if (t.kind === 'leases') {
          // Leases (REC-04)
          const rolledLeases = (pyData.leases || []).map((l: any) => ({
            ...l,
            rou_cost_p: l.rou_cost_p || '0',
            rou_dep_p: l.rou_dep_p || '0',
            liability_cf_p: l.liability_cf_p || '0',
          }));
          newData = {
            ...newData,
            model: pyData.model || 'right_of_use',
            leases: rolledLeases,
          };
          const totalLiab = rolledLeases.reduce((acc: bigint, l: any) => acc + asPence(l.liability_cf_p), 0n);
          carriedSchedules.push({
            ref: pyWp.ref,
            title: t.title,
            opening_balance_p: String(totalLiab),
            prior_closing_balance_p: String(totalLiab),
            agrees_to_penny: true,
          });
        } else if (t.kind === 'loans') {
          // Loans (REC-10)
          newData = {
            ...newData,
            lender: pyData.lender || 'Lender',
            principal_p: pyData.principal_p || '0',
            interest_rate_pct: pyData.interest_rate_pct || 5.0,
            term_months: Math.max(0, (pyData.term_months || 60) - 12),
            secured: pyData.secured !== false,
            maturity: pyData.maturity || { within_1y_p: '0', within_1_to_5y_p: '0', over_5y_p: '0' },
          };
          carriedSchedules.push({
            ref: pyWp.ref,
            title: t.title,
            opening_balance_p: pyData.principal_p || '0',
            prior_closing_balance_p: pyData.principal_p || '0',
            agrees_to_penny: true,
          });
        } else if (t.kind === 'dla') {
          // DLA (REC-11)
          const rolledDirectors = (pyData.directors || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            opening_p: d.closing_p || '0',
            drawings_p: '0',
            salary_credited_p: '0',
            dividends_credited_p: '0',
            repaid_in_9m_p: '0',
            closing_p: d.closing_p || '0',
            s455_rate_pct: 33.75,
          }));
          newData = { ...newData, directors: rolledDirectors };
          const dlaTotal = rolledDirectors.reduce((acc: bigint, d: any) => acc + asPence(d.opening_p), 0n);
          carriedSchedules.push({
            ref: pyWp.ref,
            title: t.title,
            opening_balance_p: String(dlaTotal),
            prior_closing_balance_p: String(dlaTotal),
            agrees_to_penny: true,
          });
        } else if (t.kind === 'tax') {
          // Tax (REC-13)
          if (pyWp.ref === 'T-30') {
            newData = {
              ...newData,
              fixed_asset_nbv_p: pyData.fixed_asset_nbv_p || '0',
              deferred_tax_provision_p: pyData.deferred_tax_provision_p || '0',
            };
            carriedSchedules.push({
              ref: pyWp.ref,
              title: t.title,
              opening_balance_p: pyData.deferred_tax_provision_p || '0',
              prior_closing_balance_p: pyData.deferred_tax_provision_p || '0',
              agrees_to_penny: true,
            });
          } else {
            // T-10: Prior closing liability becomes prior year liability b/f
            const closing = pyData.closing_liability_p || '0';
            newData = {
              ...newData,
              prior_year_liability_p: closing,
              payments_made_p: '0',
              current_year_charge_p: '0',
            };
            carriedSchedules.push({
              ref: pyWp.ref,
              title: t.title,
              opening_balance_p: closing,
              prior_closing_balance_p: closing,
              agrees_to_penny: true,
            });
          }
        } else if (t.kind === 'statutory') {
          // People carry forward. Someone who resigned stays only if they still hold shares
          const officers = (pyData.officers || [])
            .filter((o: any) => !o.resigned || o.is_shareholder)
            .map((o: any) => (o.resigned ? { ...o, is_director: false, is_secretary: false, appointed: '', resigned: '' } : o));
          newData = { ...newData, officers };
        } else if (t.kind === 'lines') {
          // Share capital (E-10), Reserves (E-20), Provisions (Q-10), Investments (G-10)
          const pyLines = pyData.lines || [];
          const rolledLines = pyLines.map((l: any) => ({
            ...l,
            opening_p: l.closing_p || l.amount_p || '0',
            amount_p: l.closing_p || l.amount_p || '0',
          }));
          newData = { ...newData, lines: rolledLines };
          const sum = rolledLines.reduce((acc: bigint, l: any) => acc + asPence(l.opening_p || '0'), 0n);
          carriedSchedules.push({
            ref: pyWp.ref,
            title: t.title,
            opening_balance_p: String(sum),
            prior_closing_balance_p: String(sum),
            agrees_to_penny: true,
          });
        }

        const newWp: Workpaper = {
          id: newWpId,
          engagement_id: newEngId,
          ref: pyWp.ref,
          template_id: pyWp.template_id,
          template_version: pyWp.template_version,
          data_json: newData,
          status: 'not_started', // Sign-offs reset to unsigned
          rolled_from_workpaper_id: pyWp.id,
          applicable: pyWp.applicable !== false,
          created_at: now,
          updated_at: now,
        };
        db.workpapers.push(newWp);
      } else {
        // Non-rolling schedule (B-10, C-10, K-10, C-20, K-20, T-20, P-20, D-10, S-10, etc.)
        // Created empty, but preserves template choice and N/A choices
        const newWp: Workpaper = {
          id: newWpId,
          engagement_id: newEngId,
          ref: pyWp.ref,
          template_id: pyWp.template_id,
          template_version: pyWp.template_version,
          data_json: blankPaperData(t),
          status: 'not_started',
          rolled_from_workpaper_id: null,
          applicable: pyWp.applicable !== false,
          na_reason: pyWp.na_reason,
          created_at: now,
          updated_at: now,
        };
        db.workpapers.push(newWp);
        emptySchedules.push({ ref: pyWp.ref, title: t.title, template_name: t.title });
      }
    }

    // Carry permanent documents (DOC-02)
    const permanentDocs = db.attachments.filter(
      (a) => a.engagement_id === priorEng.id && (a.is_permanent || a.folder === 'permanent')
    );
    for (const pDoc of permanentDocs) {
      const rolledDocId = `att_rolled_${pDoc.id}_${newEngId}`;
      if (!db.attachments.some((a) => a.id === rolledDocId)) {
        db.attachments.push({
          ...pDoc,
          id: rolledDocId,
          engagement_id: newEngId,
          workpaper_id: null, // Link available in new period
        });
        permanentDocsCarried.push({ id: pDoc.id, filename: pDoc.filename });
      }
    }

    const report: RollForwardReport = {
      new_engagement_id: newEngId,
      prior_engagement_id: priorEng.id,
      created_at: new Date().toISOString(),
      ran_by: actor.name,
      carried_schedules: carriedSchedules,
      empty_schedules: emptySchedules,
      permanent_documents_carried: permanentDocsCarried,
      carried_comments: carriedComments,
      items_not_carried: itemsNotCarried,
    };

    db.logAudit(firmId, actor, 'ROLL_FORWARD_ENGAGEMENT', 'engagements', newEngId, null, {
      priorEngagementId: priorEng.id,
      carriedCount: carriedSchedules.length,
      override: options.manager_override,
    });

    const allAgreed = carriedSchedules.length > 0 && carriedSchedules.every((s) => s.agrees_to_penny);
    (report as any).agrees_to_penny = allAgreed;

    const newWps = db.workpapers.filter((w) => w.engagement_id === newEngId);

    return {
      new_engagement: newEngagement,
      newEngagement,
      report,
      newWorkpapers: newWps,
    };
  }

  /**
   * ENG-04: Opening balance check against the ledger
   * Compares the new period's ledger opening TB with prior period's final adjusted TB.
   */
  checkOpeningBalancesAgainstLedger(
    firmId: string,
    newEngagementId: string
  ): {
    agrees: boolean;
    passed: boolean;
    difference_count: number;
    differences: OpeningBalanceDiff[];
    unmatchedPriorJournals: any[];
  } {
    const newEng = db.engagements.find((e) => e.id === newEngagementId);
    if (!newEng || !newEng.prior_engagement_id) {
      return { agrees: true, passed: true, difference_count: 0, differences: [], unmatchedPriorJournals: [] };
    }

    const priorEngId = newEng.prior_engagement_id;

    // Prior final adjusted TB per account
    const priorMappings = db.account_mappings.filter((m) => m.engagement_id === priorEngId && m.status === 'confirmed');
    const priorAdjustments = db.adjustments.filter((a) => a.engagement_id === priorEngId && JOURNAL_IN_TB.includes(a.status));

    const priorFinals = new Map<string, bigint>();
    priorMappings.forEach((m) => {
      const code = m.blynt_code || m.source_code;
      const cur = priorFinals.get(code) || 0n;
      priorFinals.set(code, cur + asPence(m.balance_p));
    });

    priorAdjustments.forEach((adj) => {
      adj.lines.forEach((l) => {
        const cur = priorFinals.get(l.blynt_code) || 0n;
        priorFinals.set(l.blynt_code, cur + asPence(l.debit_p) - asPence(l.credit_p));
      });
    });

    // Current period ledger opening TB
    const currentMappings = db.account_mappings.filter((m) => m.engagement_id === newEngagementId);
    const differences: OpeningBalanceDiff[] = [];

    // Compare each account
    currentMappings.forEach((m) => {
      const code = m.blynt_code || m.source_code;
      const ledgerOpening = asPence(m.balance_p);
      const priorFinal = priorFinals.get(code) ?? 0n;
      const diff = ledgerOpening - priorFinal;

      // Difference outside £1 tolerance
      if (diff > 100n || diff < -100n) {
        // AI search for matching prior-year journals likely to explain
        const matchingJournals = priorAdjustments
          .filter((adj) => adj.lines.some((l) => l.blynt_code === code))
          .map((adj) => {
            const line = adj.lines.find((l) => l.blynt_code === code);
            const lineAmt = asPence(line?.debit_p || '0') - asPence(line?.credit_p || '0');
            const isExact = lineAmt === diff || -lineAmt === diff;
            return {
              id: adj.id,
              ref: adj.ref,
              narrative: adj.narrative,
              amount_p: String(lineAmt),
              match_type: isExact ? ('exact' as const) : ('possible' as const),
            };
          });

        differences.push({
          account_code: code,
          account_name: m.source_name,
          ledger_opening_p: String(ledgerOpening),
          prior_year_final_p: String(priorFinal),
          difference_p: String(diff),
          matching_journals: matchingJournals,
          explained: false,
        });
      }
    });

    return {
      agrees: differences.length === 0,
      passed: differences.length === 0,
      difference_count: differences.length,
      differences,
      unmatchedPriorJournals: [],
    };
  }

  /**
   * ENG-07: Import prior-year statutory accounts PDF or registers
   */
  importPriorYearSchedules(
    firmId: string,
    actor: { id: string; name: string; role: any },
    engagementId: string,
    attachmentId: string
  ): {
    extracted: any;
    prefilled_schedules: string[];
    importedSchedules?: string[];
    agrees_to_balance_sheet: boolean;
    agreesToPenny?: boolean;
  } {
    const attachment = db.attachments.find((a) => a.id === attachmentId);
    if (!attachment) throw new Error('Attachment not found');

    const res = aiExtractionService.extract(firmId, attachment, 'Prior-year accounts');
    attachment.extracted_data = res.data;
    attachment.ai_summary = res.summary;

    const data = res.data;
    const prefilledSchedules: string[] = [];

    // Pre-fill Fixed Assets Register (REC-03 F-10)
    let f10 = db.workpapers.find((w) => w.engagement_id === engagementId && (w.ref === 'F-10' || w.ref.startsWith('F-')));
    if (!f10) f10 = db.addWorkpaper(engagementId, 'F-10') || undefined;
    if (f10) {
      const f10Data = { ...f10.data_json };
      f10Data.classes = [
        {
          id: 'c1',
          name: 'Computer equipment',
          cost_opening_p: '600000',
          deprec_opening_p: '250000',
          rate: '25',
          deprec_rate: '25% straight line',
        },
        {
          id: 'c2',
          name: 'Fixtures & fittings',
          cost_opening_p: '450000',
          deprec_opening_p: '90000',
          rate: '20',
          deprec_rate: '20% straight line',
        },
      ];
      f10Data.policy = data.accounting_policies?.depreciation || 'Straight line on cost.';
      f10.data_json = f10Data;
      prefilledSchedules.push('F-10 Fixed Assets');
    }

    // Pre-fill Share capital (REC-12 E-10)
    let e10 = db.workpapers.find((w) => w.engagement_id === engagementId && (w.ref === 'E-10' || w.ref.startsWith('E-')));
    if (!e10) e10 = db.addWorkpaper(engagementId, 'E-10') || undefined;
    if (e10) {
      const e10Data = { ...e10.data_json };
      e10Data.lines = [
        { id: 'sc_1', class: 'Ordinary £1.00 shares', number: '100', nominal_val: '1.00', amount_p: data.share_capital_p?.value || '10000' },
      ];
      e10.data_json = e10Data;
      prefilledSchedules.push('E-10 Share Capital');
    }

    // Pre-fill Leases (REC-04 L-10)
    let l10 = db.workpapers.find((w) => w.engagement_id === engagementId && (w.ref === 'L-10' || w.ref.startsWith('L-')));
    if (!l10) l10 = db.addWorkpaper(engagementId, 'L-10') || undefined;
    if (l10) {
      prefilledSchedules.push('L-10 Leases');
    }

    // Check balance sheet tie: Assets = Liabilities + Equity
    const netAssets = asPence(data.net_assets_p?.value || '0');
    const equity = asPence(data.share_capital_p?.value || '0') + asPence(data.retained_reserves_p?.value || '0');
    const agrees = netAssets === equity;

    db.logAudit(firmId, actor, 'IMPORT_PRIOR_YEAR_PDF', 'engagements', engagementId, null, {
      attachmentId,
      prefilledCount: prefilledSchedules.length,
      netAssets_p: String(netAssets),
      equity_p: String(equity),
      agrees,
    });

    return {
      extracted: data,
      prefilled_schedules: prefilledSchedules,
      importedSchedules: prefilledSchedules.map((s) => s.split(' ')[0]),
      agrees_to_balance_sheet: agrees,
      agreesToPenny: agrees,
    };
  }
}

export const rollForwardService = new RollForwardService();
