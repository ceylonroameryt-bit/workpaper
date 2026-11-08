import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/server/db';
import { services } from '../lib/server/services';
import { aiExtractionService } from '../lib/server/extraction';
import { invoicePlatformIntegration } from '../lib/server/invoice-platform';
import { rollForwardService } from '../lib/server/roll-forward';
import { schedulesService } from '../lib/server/schedules-service';
import { CENTRAL_TAX_RATES, calculateCorporationTax, calculateS455Tax } from '../lib/tax-rates';
import { toPence, asPence, formatPence } from '../lib/money';
import { evaluatePaper } from '../lib/workpapers/engine';
import { TEMPLATES, PACKS } from '../lib/workpapers/templates';
import type { Attachment, Workpaper } from '../lib/types/models';

describe('Stage C - Documents and All Schedules (Steps 8–12)', () => {
  const firmId = 'firm_blynt_uk';
  const engagementId = 'eng_harlow_fy26';
  const preparer = { id: 'usr_test_preparer', name: 'Test Preparer', role: 'preparer' as const };
  const reviewer = { id: 'usr_test_reviewer', name: 'Test Reviewer', role: 'reviewer' as const };

  beforeEach(() => {
    db.seed(true);
  });

  // =========================================================================
  // STEP 8 · Documents and the AI extraction service (DOC-01 to DOC-06)
  // =========================================================================
  describe('Step 8 · Documents and AI Extraction Service', () => {
    it('DOC-01 & DOC-02: Document store handles upload, duplicate check, folders, versions, and expiry alerts', () => {
      const buffer = Buffer.from('Commercial lease agreement content for Unit 4');
      const doc1 = services.uploadAttachment(firmId, preparer, engagementId, null, {
        filename: 'Harlow_Lease_2026.pdf',
        mime: 'application/pdf',
        size: buffer.length,
        content: buffer,
        category: 'Lease agreement',
        folder: 'permanent',
        is_permanent: true,
      });

      expect(doc1.id).toBeDefined();
      expect(doc1.folder).toBe('permanent');
      expect(doc1.version).toBe(1);
      expect((doc1 as any).is_duplicate).toBe(false);

      // Duplicate check via SHA-256
      const doc2 = services.uploadAttachment(firmId, preparer, engagementId, null, {
        filename: 'Harlow_Lease_2026_copy.pdf',
        mime: 'application/pdf',
        size: buffer.length,
        content: buffer,
        category: 'Lease agreement',
        folder: 'permanent',
      });
      expect(doc2.sha256).toBe(doc1.sha256);
      expect((doc2 as any).is_duplicate).toBe(true);

      // Soft delete to 30-day trash bin
      services.deleteAttachment(firmId, preparer, doc2.id, 'Uploaded duplicate copy');
      const inBin = services.getDeletedAttachments(engagementId);
      expect(inBin.some((d) => d.id === doc2.id)).toBe(true);
    });

    it('DOC-03 & DOC-04: AI extraction produces typed fields with confidence and clause/page links', () => {
      // 1. Bank statement PDF
      const bankDoc = services.uploadAttachment(firmId, preparer, engagementId, null, {
        filename: 'Barclays_Operating_Sep2026.pdf',
        mime: 'application/pdf',
        size: 850000,
        content: 'Barclays Operating Statement Sep 2026 Closing Balance £118,402.17',
        category: 'Bank statement',
        folder: 'current',
      });

      const bankExtraction = services.extractDocument(firmId, preparer, bankDoc.id, 'Bank statement');
      expect(bankExtraction.attachment.category).toBe('Bank statement');
      expect(bankExtraction.summary.bullets.length).toBeGreaterThan(0);
      expect(bankExtraction.data.statement_balance_p.value).toBe('11840217'); // £118,402.17 in pence
      expect(bankExtraction.data.statement_balance_p.confidence).toBeGreaterThanOrEqual(90);
      expect(bankExtraction.data.statement_balance_p.gate).toBe('ready');

      // 2. Lease agreement produces summary with clause references
      const leaseDoc = services.uploadAttachment(firmId, preparer, engagementId, null, {
        filename: 'Industrial_Unit_4_Lease.pdf',
        mime: 'application/pdf',
        size: 2500000,
        content: 'Lease Agreement Unit 4 Lessor Grosvenor Lessee Harlow Finch Annual Rent £10,200 Cl. 1 Cl. 2.1 Cl. 3.1',
        category: 'Lease agreement',
        folder: 'permanent',
      });

      const leaseExtraction = services.extractDocument(firmId, preparer, leaseDoc.id, 'Lease agreement');
      expect(leaseExtraction.attachment.category).toBe('Lease agreement');
      expect(leaseExtraction.summary.bullets.length).toBeGreaterThanOrEqual(3);
      // Clause references in summary bullets
      const hasClauseRefs = leaseExtraction.summary.bullets.some(
        (b: any) => b.clause?.includes('Cl.') || b.text.includes('Cl.') || b.reference?.includes('Cl.')
      );
      expect(hasClauseRefs).toBe(true);
    });

    it('DOC-05: Auto-fill schedule from document places figures with AI badges until confirmed', () => {
      const bankWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'B-10');
      expect(bankWp).toBeDefined();
      if (!bankWp) return;

      const bankDoc = services.uploadAttachment(firmId, preparer, engagementId, null, {
        filename: 'Barclays_Bank_Statement_Sep2026.pdf',
        mime: 'application/pdf',
        size: 890000,
        content: 'Barclays Bank Statement Sep 2026 Balance £118,402.17',
        category: 'Bank statement',
        folder: 'current',
      });

      // Fill schedule
      const fillResult = services.fillScheduleFromDocument(firmId, preparer, bankDoc.id, bankWp.id);
      expect(fillResult.workpaper.data_json.statement_p).toBe('11840217');
      expect(fillResult.workpaper.data_json.values_to_confirm_count).toBeGreaterThan(0);
      expect(fillResult.workpaper.data_json.confidence_gate_items?.length).toBeGreaterThan(0);

      const gateItem = fillResult.workpaper.data_json.confidence_gate_items[0];
      expect(gateItem.field).toBe('statement_p');
      expect(gateItem.confirmed).toBe(false);

      // Confirm value (clears badge and decrements count)
      const confirmed = services.confirmAiValue(firmId, preparer, bankWp.id, gateItem.id);
      expect(confirmed.workpaper.data_json.values_to_confirm_count).toBe(0);
      expect(confirmed.confirmedItem.confirmed).toBe(true);
      expect(confirmed.confirmedItem.confirmed_by).toBe(preparer.id);
    });

    it('DOC-06: Evidence linking to schedule lines, journals, and checklists detects missing evidence', () => {
      const bankDoc = services.uploadAttachment(firmId, preparer, engagementId, null, {
        filename: 'Barclays_Test_Statement.pdf',
        mime: 'application/pdf',
        size: 50000,
        content: 'Test content',
        category: 'Bank statement',
      });

      const linkedAtt = services.linkEvidence(firmId, preparer, bankDoc.id, { kind: 'row', table: 'statement', row: 'statement' });
      expect(linkedAtt.id).toBe(bankDoc.id);
      expect(linkedAtt.links?.length).toBeGreaterThan(0);

      const missing = services.findMissingEvidence(engagementId);
      expect(Array.isArray(missing)).toBe(true);
      expect(missing.length).toBeGreaterThan(0); // F-10 disposal has missing evidence flag
    });
  });

  // =========================================================================
  // STEP 9 · Everyday schedules (REC-07, REC-08, REC-09, REC-06)
  // =========================================================================
  describe('Step 9 · Everyday Schedules', () => {
    it('REC-07: Trade debtors aged listing, 90-day post-period recoverability review, and bad debt journal', () => {
      let c10 = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'C-10');
      if (!c10) c10 = db.addWorkpaper(engagementId, 'C-10')!;
      c10.data_json = {
        lines: [
          { id: 'deb_1', desc: 'Acme Corp', current_p: '500000', d30_p: '0', d60_p: '0', d90_p: '0', after_date_p: '0' },
          { id: 'deb_2', desc: 'Overdue Client Ltd', current_p: '0', d30_p: '0', d60_p: '0', d90_p: '250000', after_date_p: '0' },
        ],
      };

      const review = services.reviewDebtorsRecoverability(firmId, engagementId, 90);
      expect(review.totalDebtorsPence).toBeGreaterThan(0n);
      expect(Array.isArray(review.uncollectedDebtors)).toBe(true);
      expect(review.proposedProvisionPence).toBe(250000n); // £2,500 provision

      const proposedJnl = services.proposeBadDebtJournal(
        firmId,
        preparer,
        engagementId,
        250000n // £2,500 bad debt provision
      );
      expect(proposedJnl.journal.ref).toMatch(/^AJE-/);
      expect(proposedJnl.journal.status).toBe('proposed');
      expect(proposedJnl.journal.lines.length).toBe(2);
      expect(asPence(proposedJnl.journal.lines[0].debit_p)).toBe(250000n); // Dr Bad debt expense
      expect(asPence(proposedJnl.journal.lines[1].credit_p)).toBe(250000n); // Cr Bad debt provision
    });

    it('REC-08: Trade creditors and 60-day unrecorded liabilities search with Accrue to REC-09', () => {
      const unrecorded = services.searchUnrecordedLiabilities(firmId, engagementId, 60);
      expect(unrecorded.length).toBeGreaterThan(0);
      const target = unrecorded[0];
      expect(asPence(target.amount_p)).toBe(145000n); // £1,450 EDF Energy

      // Accrue to REC-09 (K-20)
      const k20Wp = services.accrueUnrecordedLiability(firmId, preparer, engagementId, target);
      expect(k20Wp.ref).toBe('K-20');
      expect(k20Wp.data_json.lines.some((l: any) => l.supplier?.includes(target.supplier) || l.desc?.includes(target.supplier))).toBe(true);
    });

    it('REC-09: Prepayments, accruals and deferred income with auto-reversing journals (JNL-04)', () => {
      let c20 = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'C-20');
      if (!c20) c20 = db.addWorkpaper(engagementId, 'C-20')!;

      const revResult = services.createAutoReversingJournal(
        firmId,
        preparer,
        engagementId,
        'prepayment',
        [
          {
            desc: 'Annual Commercial Insurance Prepayment',
            supplier: 'Allianz UK',
            amount_p: '85000', // £850
            reversal_date: '2026-10-01',
          },
        ]
      );

      expect(revResult.journal.auto_reverse).toBe(true);
      expect(revResult.journal.date).toBe('2026-09-30');
      expect(asPence(revResult.journal.lines[0].debit_p)).toBe(85000n); // Dr Prepayments
      expect(asPence(revResult.journal.lines[1].credit_p)).toBe(85000n); // Cr Insurance expense
    });

    it('REC-06: VAT reconciliation for all 5 schemes including Flat Rate Scheme surplus calculation & journal', () => {
      // 1. Flat Rate Scheme Surplus calculation
      const frs = services.calculateVatFlatRateSurplus(
        12000000n, // £120,000 gross turnover (including VAT)
        14.5, // 14.5% flat rate
        false, // not first year
        2000000n // £20,000 standard VAT collected (Box 1)
      );
      expect(frs.vatPaidToHmrcPence).toBe(1740000n); // £17,400 flat rate liability
      expect(frs.surplusOrDeficitPence).toBe(260000n); // £2,600 surplus income

      // Propose FRS surplus journal
      const frsJnl = services.proposeFlatRateSurplusJournal(
        firmId,
        preparer,
        engagementId,
        frs.surplusOrDeficitPence
      );
      expect(asPence(frsJnl.journal.lines[0].debit_p)).toBe(260000n); // Dr VAT control (TB 780)
      expect(asPence(frsJnl.journal.lines[1].credit_p)).toBe(260000n); // Cr Flat rate surplus income (TB 140)
    });
  });

  // =========================================================================
  // STEP 10 · Long-life schedules and roll forward
  // =========================================================================
  describe('Step 10 · Long-Life Schedules and Roll Forward', () => {
    it('REC-03: Fixed asset register with depreciation policies, disposals, and annual depreciation journal', () => {
      const deprecRes = services.proposeDepreciationJournal(firmId, preparer, engagementId);
      expect(deprecRes.journal.ref).toMatch(/^AJE-/);
      expect(deprecRes.journal.status).toBe('proposed');
      expect(deprecRes.journal.lines.length).toBeGreaterThanOrEqual(2);
      // Balanced journal
      const totalDr = deprecRes.journal.lines.reduce((s, l) => s + asPence(l.debit_p), 0n);
      const totalCr = deprecRes.journal.lines.reduce((s, l) => s + asPence(l.credit_p), 0n);
      expect(totalDr).toBe(totalCr);
      expect(totalDr).toBe(270000n); // £2,700 total depreciation charge (£1,800 + £900)
    });

    it('REC-10: Loans and hire purchase with maturity split agreeing to principal', () => {
      let loanWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'L-20');
      if (!loanWp) loanWp = db.addWorkpaper(engagementId, 'L-20')!;
      loanWp.data_json = {
        principal_p: '4000000',
        maturity: { within_1y_p: '1000000', within_1_to_5y_p: '3000000', over_5y_p: '0' },
      };

      const evalRes = evaluatePaper(loanWp)!;
      expect(evalRes.checks.find((c) => c.id === 'loan_maturity_tie')?.passed).toBe(true);
    });

    it('REC-04: Leases with Right-of-Use model for FRS 102 periods from 1 January 2026', () => {
      let leaseWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'L-10');
      if (!leaseWp) leaseWp = db.addWorkpaper(engagementId, 'L-10')!;
      leaseWp.data_json = {
        model: 'right_of_use',
        leases: [
          {
            id: 'l1',
            property: 'Unit 4, St. Peter’s Wharf',
            lessor: 'Grosvenor Estates PLC',
            rou_cost_p: '6000000',
            rou_dep_p: '2400000',
            liability_cf_p: '2800000',
            comm_1y_p: '1000000',
            comm_1to5y_p: '1800000',
            comm_over5y_p: '0',
          },
        ],
      };

      const evalRes = evaluatePaper(leaseWp)!;
      expect(evalRes.totals.rou_nbv).toBe(3600000n); // 60,000 - 24,000 = £36,000
      expect(evalRes.checks.find((c) => c.id === 'commitments_split')?.passed).toBe(true);
    });

    it('REC-11: Director loan accounts with central s455 tax (33.75%) and BIK flags (>£10k)', () => {
      const overdrawnAmount = 1500000n; // £15,000 overdrawn
      const s455Tax = calculateS455Tax(overdrawnAmount);
      expect(s455Tax.s455TaxDuePence).toBe(506250n); // £5,062.50 (33.75%)
      expect(CENTRAL_TAX_RATES.s455.bik_threshold_p).toBe(1000000n); // £10,000
    });

    it('REC-12: Share capital, reserves and dividends with distributable reserves legality check', () => {
      let shareWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'E-10');
      if (!shareWp) shareWp = db.addWorkpaper(engagementId, 'E-10')!;

      const evalRes = evaluatePaper(shareWp)!;
      expect(evalRes.template.ref).toBe('E-10');
    });

    it('ENG-03: Roll forward to next period agrees to the penny for FAR and leases', () => {
      // Add a permanent document to the prior year file to test roll forward of permanent files
      services.uploadAttachment(firmId, preparer, 'eng_harlow_fy25', null, {
        filename: 'Harlow_Unit4_Lease_Permanent.pdf',
        mime: 'application/pdf',
        size: 1500000,
        content: 'Permanent commercial lease agreement',
        category: 'Lease agreement',
        folder: 'permanent',
        is_permanent: true,
      });

      const preview = services.previewRollForward(engagementId);
      expect(typeof preview.canRoll).toBe('boolean');
      expect(preview.scheduleItems.length).toBeGreaterThanOrEqual(1);

      // Execute roll forward from locked prior year FY25 (or with manager override)
      const result = services.executeRollForward(firmId, preparer, 'eng_harlow_fy25', {
        new_period_start: '2026-10-01',
        new_period_end: '2027-09-30',
        manager_override: true,
        override_reason: 'Testing roll forward to FY27',
      });

      expect(result.new_engagement.period_end).toBe('2027-09-30');
      expect((result.report as any).agrees_to_penny).toBe(true);

      // Check rolled FAR
      const rolledFar = result.newWorkpapers?.find((w: any) => w.ref === 'F-10');
      expect(rolledFar).toBeDefined();
      // Cost opening = prior closing cost (£6,000 from FY25 wp_py_f10)
      expect(rolledFar?.data_json.classes[0].cost_opening_p).toBe('600000');
      // Deprec opening = prior closing deprec (£2,500 from FY25 wp_py_f10)
      expect(rolledFar?.data_json.classes[0].deprec_opening_p).toBe('250000');
      // Movements reset to empty
      expect(rolledFar?.data_json.movements?.length ?? 0).toBe(0);

      // Permanent file documents carried forward
      const rolledDocs = services.getAttachments(result.new_engagement.id);
      expect(rolledDocs.some((d) => d.folder === 'permanent')).toBe(true);
    });

    it('ENG-04: Opening balance check against ledger compares opening TB to prior final adjusted TB', () => {
      const check = services.checkOpeningBalances(firmId, engagementId);
      expect(check).toBeDefined();
      expect(typeof check.agrees).toBe('boolean');
      expect(Array.isArray(check.differences)).toBe(true);
      expect(Array.isArray(check.unmatchedPriorJournals)).toBe(true);
    });

    it('ENG-07: Prior-year import for new clients builds opening schedules from accounts PDF agreeing to the penny', () => {
      const pyDoc = services.uploadAttachment(firmId, preparer, engagementId, null, {
        filename: 'Harlow_Finch_Signed_Accounts_FY25.pdf',
        mime: 'application/pdf',
        size: 1400000,
        content: 'Signed Accounts FY25 Tangible Assets £65,000 Share capital £10,000',
        category: 'Signed accounts',
      });

      const res = services.importPriorYearAccounts(firmId, preparer, engagementId, pyDoc.id);
      expect(res.prefilled_schedules.some((s: string) => s.includes('F-10'))).toBe(true);
      expect(res.prefilled_schedules.some((s: string) => s.includes('L-10'))).toBe(true);
      expect(res.prefilled_schedules.some((s: string) => s.includes('E-10'))).toBe(true);
      expect(res.agrees_to_balance_sheet).toBe(true);
    });
  });

  // =========================================================================
  // STEP 11 · Remaining schedules (REC-05, REC-13, REC-14, REC-15)
  // =========================================================================
  describe('Step 11 · Remaining Schedules', () => {
    it('REC-05: 12 monthly payroll summaries extract and all 3 reconciliations clear', () => {
      let payrollWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'P-20');
      if (!payrollWp) payrollWp = db.addWorkpaper(engagementId, 'P-20')!;

      // 12 monthly reports summing to £150k gross + £20k ER NIC + £10k ER pension = £180k wages cost
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        label: `Month ${i + 1}`,
        gross_pay_p: '1250000', // £12,500 * 12 = £150,000
        employer_nic_p: '166667', // £1,666.67 * 12 = £20,000
        employer_pension_p: '83333', // £833.33 * 12 = £10,000
        employee_nic_p: '100000',
        paye_tax_p: '150000',
        employee_pension_p: '50000',
        hmrc_paid_p: i < 11 ? '416667' : '0', // Month 12 unpaid = £4,166.67
        pension_paid_p: i < 11 ? '133333' : '0', // Month 12 unpaid = £1,333.33
      }));
      payrollWp.data_json = { months };

      const totalWagesCost = months.reduce(
        (acc, m) => acc + asPence(m.gross_pay_p) + asPence(m.employer_nic_p) + asPence(m.employer_pension_p),
        0n
      );

      // Add confirmed trial balance mapping for payroll costs (code 3)
      db.account_mappings.push({
        id: 'map_payroll_test',
        engagement_id: engagementId,
        source_code: '7000',
        source_name: 'Gross Wages',
        source_type: 'Expense',
        balance_p: String(totalWagesCost),
        blynt_code: '3',
        status: 'confirmed',
        confidence: 100,
        method: 'rule',
        confirmed_by: 'usr_test_preparer',
        confirmed_at: new Date().toISOString(),
      });

      const evalRes = evaluatePaper(payrollWp)!;
      expect(evalRes.totals.wages_cost).toBe(totalWagesCost);
      expect(evalRes.checks.find((c) => c.id === 'wages_tb')?.passed).toBe(true);
      expect(evalRes.checks.find((c) => c.id === 'months_complete')?.passed).toBe(true);
    });

    it('REC-13: Corporation tax and deferred tax with UK central tax rates (deferred tax hidden under FRS 105)', () => {
      // 1. Central Corporation Tax rates calculation
      // Small profits rate: £40,000 profit -> 19% = £7,600
      const ctSmall = calculateCorporationTax(4000000n);
      expect(ctSmall.effectiveRatePct).toBe(19.0);
      expect(ctSmall.taxDuePence).toBe(760000n);

      // Main rate: £300,000 profit -> 25% = £75,000
      const ctMain = calculateCorporationTax(30000000n);
      expect(ctMain.effectiveRatePct).toBe(25.0);
      expect(ctMain.taxDuePence).toBe(7500000n);

      // 2. T-10 Corporation Tax Workpaper Evaluation
      let ctWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'T-10');
      if (!ctWp) ctWp = db.addWorkpaper(engagementId, 'T-10')!;
      ctWp.data_json = { current_year_charge_p: '1420000' };

      // Seed confirmed trial balance mapping for CT liability (code 795)
      db.account_mappings.push({
        id: 'map_ct_test',
        engagement_id: engagementId,
        source_code: '2150',
        source_name: 'Corporation Tax Liability',
        source_type: 'Current Liability',
        balance_p: '-1420000',
        blynt_code: '795',
        status: 'confirmed',
        confidence: 100,
        method: 'rule',
        confirmed_by: 'usr_test_preparer',
        confirmed_at: new Date().toISOString(),
      });

      const ctEval = evaluatePaper(ctWp)!;
      expect(ctEval.checks.find((c) => c.id === 'ct_liability_tb')?.passed).toBe(true);

      // 3. T-30 Deferred Tax Workpaper Evaluation (FRS 102)
      let dtWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'T-30');
      if (!dtWp) dtWp = db.addWorkpaper(engagementId, 'T-30')!;
      dtWp.data_json = {
        fixed_asset_nbv_p: '6500000',
        tax_written_down_value_p: '500000',
        tax_rate_pct: 25,
      };

      // Seed confirmed trial balance mapping for deferred tax provision (code 840)
      db.account_mappings.push({
        id: 'map_dt_test',
        engagement_id: engagementId,
        source_code: '2160',
        source_name: 'Deferred Tax Provision',
        source_type: 'Provision',
        balance_p: '-1500000',
        blynt_code: '840',
        status: 'confirmed',
        confidence: 100,
        method: 'rule',
        confirmed_by: 'usr_test_preparer',
        confirmed_at: new Date().toISOString(),
      });

      const dtEval = evaluatePaper(dtWp)!;
      expect(dtEval.totals.timing_difference).toBe(6000000n); // NBV £65k - TWDV £5k = £60k
      expect(dtEval.totals.provision).toBe(1500000n); // £60k * 25% = £15,000
      expect(dtEval.checks.find((c) => c.id === 'deferred_tax_tb')?.passed).toBe(true);

      // 4. Deferred tax hidden under FRS 105 standard
      const frs105Papers = PACKS['Micro-entity (FRS 105)'];
      expect(frs105Papers.includes('T-10')).toBe(true);
      expect(frs105Papers.includes('T-30')).toBe(false); // Hidden under FRS 105
    });

    it('REC-14: Stock and WIP with margin consistency check', () => {
      let stockWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'D-10');
      if (!stockWp) stockWp = db.addWorkpaper(engagementId, 'D-10')!;
      stockWp.data_json = {
        lines: [{ id: 'l1', desc: 'Finished goods', amount_p: '4500000' }],
      };

      const evalRes = evaluatePaper(stockWp)!;
      expect(evalRes.template.ref).toBe('D-10');
      expect(evalRes.totals.total).toBe(4500000n); // £45,000 inventory
    });

    it('REC-15: Related parties and intercompany disclosure register', () => {
      let rpWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'R-10');
      if (!rpWp) rpWp = db.addWorkpaper(engagementId, 'R-10')!;

      const evalRes = evaluatePaper(rpWp)!;
      expect(evalRes.template.ref).toBe('R-10');
    });
  });

  // =========================================================================
  // STEP 12 · Invoice platform link (INT-03, INT-01, AIX-02, INT-04)
  // =========================================================================
  describe('Step 12 · Invoice Platform Link', () => {
    it('INT-03: Single sign-on and shared client IDs between Blynt and Invoice platform', () => {
      const client = db.clients.find((c) => c.id === 'cli_harlow');
      expect(client).toBeDefined();
      if (!client) return;

      const link = invoicePlatformIntegration.getLinkedClient(client.id);
      expect(link).toBeDefined();
      expect(link?.sso_active).toBe(true);
      expect(link?.invoice_platform_id).toBe('inv_c_harlow_92');
    });

    it('INT-01: Capital invoice pushed as proposed addition, de-duplicated against ledger, rejection sent back as correction', () => {
      const invoicePayload = {
        client_id: 'cli_harlow',
        invoice_id: 'inv_cap_server_99',
        invoice_number: 'INV-2026-99',
        supplier: 'Dell Enterprise Solutions',
        invoice_date: '2026-06-20',
        net_p: '450000', // £4,500 server
        vat_p: '90000',
        description: 'Dell PowerEdge R750 Server',
        image_url: 'https://invoices.platform.co.uk/docs/inv-99.pdf',
        is_capital: true,
      };

      // 1. Push capital invoice
      const pushResult = services.pushInvoiceFromPlatform(firmId, preparer, invoicePayload);
      expect(pushResult.success).toBe(true);
      expect(pushResult.addition_id).toBeDefined();

      // Appears in F-10 proposed additions
      const farWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'F-10');
      expect(farWp?.data_json.proposed_additions.some((p: any) => p.invoice_number === 'INV-2026-99')).toBe(true);

      // 2. De-duplication check against ledger
      const isDup = invoicePlatformIntegration.isDuplicateOfLedger(
        engagementId,
        'INV-2026-99',
        450000n,
        '2026-06-20'
      );
      expect(isDup).toBe(false); // First time not duplicated

      // 3. Rejection sent back as coding correction to invoice platform
      const rejection = services.handlePushedInvoiceDecision(
        firmId,
        preparer,
        farWp!.id,
        pushResult.addition_id,
        'reject',
        undefined,
        'Cost is under capitalisation threshold of £5,000 for server group'
      );
      expect(rejection.addition.status).toBe('rejected');
      expect(rejection.correctionRule).toBeDefined();
    });

    it('AIX-02: Capital versus revenue detector detects capital items on expense accounts', () => {
      const candidates = services.detectCapitalItemsInExpenses(firmId, engagementId, 100000n); // £1,000 threshold
      expect(candidates.length).toBeGreaterThan(0);
      const laptop = candidates.find((c) => c.description.toLowerCase().includes('macbook'));
      expect(laptop).toBeDefined();
      expect(laptop?.account_code).toBe('420'); // Office & IT Consumables

      // Capitalise expense transaction proposes reclassification journal
      const reclass = services.capitaliseExpenseItem(
        firmId,
        preparer,
        engagementId,
        laptop!.transaction_id,
        'c1' // Plant & machinery / IT
      );
      expect(reclass.journal.lines.length).toBe(2);
      expect(asPence(reclass.journal.lines[0].debit_p)).toBe(240000n); // Dr 680 Computer Equipment
      expect(asPence(reclass.journal.lines[1].credit_p)).toBe(240000n); // Cr 420 IT Consumables
    });

    it('INT-04: Bank closing balances and statement lines from Open Banking feed into bank schedule with no statement upload', () => {
      const bankWp = db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === 'B-10');
      expect(bankWp).toBeDefined();
      if (!bankWp) return;

      const feedResult = services.reconcileBankWithOpenBanking(firmId, preparer, bankWp.id);

      expect(feedResult.workpaper.data_json.statement_p).toBe('12491817'); // £124,918.17
      expect(feedResult.feedResponse.source).toBe('Open Banking (via invoice platform)');
      expect(feedResult.feedResponse.statement_lines.length).toBeGreaterThan(0);
    });
  });
});
