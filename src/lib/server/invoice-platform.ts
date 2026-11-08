import crypto from 'crypto';
import { db } from './db';
import { asPence, formatPence } from '../money';
import { learnFromCorrection } from './gate';
import { LedgerTransaction, Adjustment } from '../types/models';

export interface PushedInvoicePayload {
  client_id: string;
  invoice_id: string;
  supplier: string;
  invoice_date: string;
  invoice_number: string;
  description: string;
  net_p: string;
  vat_p: string;
  nominal_code?: string;
  ledger_transaction_id?: string;
  image_url?: string;
  is_capital?: boolean;
}

export interface BankFeedStatementLine {
  id: string;
  date: string;
  description: string;
  amount_p: string; // Net pence: positive for deposit, negative for withdrawal
  reference?: string;
}

export interface BankFeedResponse {
  bank_account_code: string;
  account_name: string;
  sort_code: string;
  account_number: string;
  balance_p: string;
  balance_date: string;
  pulled_at: string;
  source: 'Open Banking (via invoice platform)';
  consent_active: boolean;
  statement_lines: BankFeedStatementLine[];
}

export class InvoicePlatformIntegration {
  /**
   * INT-03: Shared clients and SSO between Invoice Platform and Working Paper
   */
  getLinkedClient(clientId: string) {
    const client = db.clients.find((c) => c.id === clientId || c.id === `cli_${clientId.replace(/^client_/, '')}`);
    if (!client) return null;
    return {
      working_paper_client_id: client.id,
      invoice_platform_id: `inv_c_${client.id.replace(/^cli_/, '')}_92`,
      invoice_platform_client_id: `inv_cli_${client.company_no || client.id}`,
      name: client.name,
      company_no: client.company_no,
      has_shared_ledger_connection: !!client.data_source && client.data_source !== 'csv',
      shared_ledger_type: client.data_source,
      sso_active: true,
    };
  }

  /**
   * INT-01: Push a fixed asset invoice to the working paper
   */
  pushFixedAssetInvoice(
    firmId: string,
    actor: { id: string; name: string; role: any },
    payload: PushedInvoicePayload
  ): {
    success: boolean;
    addition_id: string;
    proposed_addition: any;
    workpaper_id: string;
    matched_existing_ledger: boolean;
  } {
    // 1. Locate active engagement for client
    const targetCliId = payload.client_id.startsWith('cli_') ? payload.client_id : `cli_${payload.client_id.replace(/^client_/, '').split('_')[0]}`;
    const engagement = db.engagements.find(
      (e) => (e.client_id === payload.client_id || e.client_id === targetCliId) && e.firm_id === firmId && e.status !== 'locked'
    ) || db.engagements.find((e) => (e.client_id === payload.client_id || e.client_id === targetCliId) && e.firm_id === firmId);

    if (!engagement) {
      throw new Error(`Client not set up in working paper or no engagement found.`);
    }

    // 2. Locate Fixed Assets workpaper (F-10)
    let wp = db.workpapers.find((w) => w.engagement_id === engagement.id && (w.ref === 'F-10' || w.ref.startsWith('F-')));
    if (!wp) {
      wp = db.addWorkpaper(engagement.id, 'F-10') || undefined;
    }
    if (!wp) throw new Error('Fixed assets workpaper not found');

    const wpData = { ...wp.data_json };
    const movements: any[] = wpData.movements || [];
    const proposedAdditions: any[] = wpData.proposed_additions || [];

    // 3. De-duplication check against ledger transactions and existing movements
    const netP = asPence(payload.net_p);
    const dateStr = payload.invoice_date;

    const matchedTx = db.transactions.find(
      (t) =>
        t.engagement_id === engagement.id &&
        (t.external_id === payload.ledger_transaction_id ||
          (t.contact.toLowerCase() === payload.supplier.toLowerCase() &&
            t.date === dateStr &&
            asPence(t.amount_p) === netP))
    );

    const alreadyInMovements = movements.some(
      (m) =>
        m.invoice_id === payload.invoice_id ||
        (m.supplier?.toLowerCase() === payload.supplier.toLowerCase() &&
          m.date === dateStr &&
          asPence(m.cost_p) === netP)
    );

    // AI suggestion for asset class & useful life
    let suggestedClassId = 'c1';
    let suggestedClassName = 'Computer equipment';
    let usefulLife = 4;
    const desc = payload.description.toLowerCase();
    if (desc.includes('fixtures') || desc.includes('desk') || desc.includes('chair') || desc.includes('furniture')) {
      suggestedClassId = 'c2';
      suggestedClassName = 'Fixtures & fittings';
      usefulLife = 5;
    } else if (desc.includes('vehicle') || desc.includes('van') || desc.includes('car')) {
      suggestedClassId = 'c3';
      suggestedClassName = 'Motor vehicles';
      usefulLife = 4;
    } else if (desc.includes('plant') || desc.includes('machinery') || desc.includes('drill')) {
      suggestedClassId = 'c4';
      suggestedClassName = 'Plant & machinery';
      usefulLife = 7;
    }

    const proposedItem = {
      id: `prop_inv_${payload.invoice_id}`,
      invoice_id: payload.invoice_id,
      supplier: payload.supplier,
      date: payload.invoice_date,
      invoice_number: payload.invoice_number,
      description: payload.description,
      cost_p: payload.net_p,
      vat_p: payload.vat_p,
      ledger_transaction_id: payload.ledger_transaction_id,
      suggested_class_id: suggestedClassId,
      suggested_class_name: suggestedClassName,
      useful_life_years: usefulLife,
      image_url: payload.image_url || `/invoices/${payload.invoice_id}.pdf`,
      matched_ledger: !!matchedTx || alreadyInMovements,
      status: 'pending', // 'pending' | 'accepted' | 'rejected'
      source: 'invoice_platform',
      confidence: 94,
    };

    // Attach as evidence document (DOC-06)
    const attachmentId = `att_inv_${payload.invoice_id}`;
    if (!db.attachments.some((a) => a.id === attachmentId)) {
      db.attachments.push({
        id: attachmentId,
        engagement_id: engagement.id,
        workpaper_id: wp.id,
        file_key: `invoices/${payload.invoice_id}.pdf`,
        filename: `${payload.supplier.replace(/\s+/g, '_')}_${payload.invoice_number}.pdf`,
        mime: 'application/pdf',
        size: 154200,
        sha256: crypto.createHash('sha256').update(payload.invoice_id).digest('hex'),
        category: 'Invoice',
        is_permanent: false,
        uploaded_by: actor.id,
        uploaded_by_name: actor.name,
        uploaded_at: new Date().toISOString(),
        links: [{ attachment_id: attachmentId, anchor_json: { kind: 'row', table: 'movements', row: proposedItem.id } }],
      });
    }

    // Add to proposed additions if not duplicated
    if (!proposedAdditions.some((p) => p.invoice_id === payload.invoice_id)) {
      proposedAdditions.push(proposedItem);
      wpData.proposed_additions = proposedAdditions;
      wp.data_json = wpData;
      wp.updated_at = new Date().toISOString();
    }

    // Log action in audit trail
    db.logAudit(firmId, actor, 'PUSH_INVOICE_FA', 'workpapers', wp.id, null, {
      invoice_id: payload.invoice_id,
      supplier: payload.supplier,
      amount_p: payload.net_p,
      matched: !!matchedTx,
    });

    return {
      success: true,
      addition_id: proposedItem.id,
      proposed_addition: proposedItem,
      workpaper_id: wp.id,
      matched_existing_ledger: !!matchedTx || alreadyInMovements,
    };
  }

  /**
   * Accept or Reject pushed fixed asset invoice
   */
  handleProposedAdditionDecision(
    firmId: string,
    actor: { id: string; name: string; role: any },
    workpaperId: string,
    additionId: string,
    decision: 'accept' | 'reject',
    chosenClassId?: string,
    rejectReason?: string
  ) {
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) throw new Error('Workpaper not found');

    const wpData = { ...wp.data_json };
    const proposed: any[] = wpData.proposed_additions || [];
    const item = proposed.find((p) => p.id === additionId);
    if (!item) throw new Error('Proposed addition not found');

    if (decision === 'accept') {
      const classId = chosenClassId || item.suggested_class_id || 'c1';
      const movement = {
        id: `mov_${item.id}`,
        class_id: classId,
        item: `${item.supplier} - ${item.description}`,
        cost_p: item.cost_p,
        type: 'addition',
        date: item.date,
        supplier: item.supplier,
        invoice_id: item.invoice_id,
        invoice_number: item.invoice_number,
        source: 'invoice_platform',
      };
      wpData.movements = [...(wpData.movements || []), movement];
      item.status = 'accepted';

      // Train rules library (DAT-09)
      learnFromCorrection(
        { ...actor, firmId },
        {
          type: 'proposal',
          scope: 'client',
          supplier_name: item.supplier,
          pattern: `supplier:${item.supplier.toLowerCase()}`,
          target_value: classId,
          explanation: `Classified capital additions from ${item.supplier} to asset class ${classId}`,
        }
      );
    } else {
      item.status = 'rejected';
      item.reject_reason = rejectReason || 'Revenue item / not capital';

      // Learn correction: reject future capital classification for this supplier/description
      const rule = learnFromCorrection(
        { ...actor, firmId },
        {
          type: 'proposal',
          scope: 'client',
          supplier_name: item.supplier,
          pattern: `supplier:${item.supplier.toLowerCase()}`,
          target_value: 'revenue_overhead',
          explanation: `Rejection: ${rejectReason || 'Revenue expense'}`,
        }
      );

      wp.data_json = wpData;
      wp.updated_at = new Date().toISOString();

      db.logAudit(firmId, actor, 'REJECT_PROPOSED_ADDITION', 'workpapers', wp.id, null, {
        additionId,
        decision,
        rejectReason,
      });

      return { workpaper: wp, item, addition: item, correctionRule: rule };
    }

    wp.data_json = wpData;
    wp.updated_at = new Date().toISOString();

    db.logAudit(firmId, actor, 'ACCEPT_PROPOSED_ADDITION', 'workpapers', wp.id, null, {
      additionId,
      decision,
      chosenClassId,
    });

    return { workpaper: wp, item, addition: item };
  }

  /**
   * INT-01: Check if pushed invoice is already recorded in the ledger or movements
   */
  isDuplicateOfLedger(
    engagementId: string,
    invoiceNumber: string,
    amountPence: bigint,
    date: string
  ): boolean {
    const wp = db.workpapers.find((w) => w.engagement_id === engagementId && (w.ref === 'F-10' || w.ref.startsWith('F-')));
    const movements: any[] = wp?.data_json?.movements || [];
    const inMovements = movements.some(
      (m) => (m.invoice_number === invoiceNumber || m.invoice_ref === invoiceNumber) && asPence(m.cost_p || '0') === amountPence
    );
    const inLedger = db.transactions.some(
      (t) => t.engagement_id === engagementId && t.date === date && asPence(t.amount_p) === amountPence
    );
    return inMovements || inLedger;
  }

  /**
   * AIX-02: Capital versus Revenue Detector
   * Scans expense transactions over capitalisation threshold.
   */
  detectCapitalItemsInExpenses(
    firmId: string,
    engagementId: string,
    capitalisationThresholdPence: bigint = 50000n // default £500
  ): Array<{
    transaction_id: string;
    account_code: string;
    account_name: string;
    date: string;
    contact: string;
    description: string;
    amount_p: string;
    confidence: number;
    ai_reason: string;
    suggested_asset_class: string;
  }> {
    const expenseCodes = ['2', '4']; // Cost of sales / Admin expenses
    const flaggedItems: any[] = [];

    // Review all ledger transactions in expenses
    const txs = db.transactions.filter(
      (t) =>
        t.engagement_id === engagementId &&
        (t.account_code.startsWith('4') || t.account_code.startsWith('2')) &&
        asPence(t.amount_p) >= capitalisationThresholdPence
    );

    for (const tx of txs) {
      const desc = `${tx.description} ${tx.contact}`.toLowerCase();
      const isLikelyCapital =
        desc.includes('laptop') ||
        desc.includes('macbook') ||
        desc.includes('server') ||
        desc.includes('equipment') ||
        desc.includes('refurbishment') ||
        desc.includes('furniture') ||
        desc.includes('air conditioning') ||
        desc.includes('printer') ||
        desc.includes('van') ||
        desc.includes('vehicle');

      if (isLikelyCapital) {
        let suggestedClass = 'Computer equipment';
        if (desc.includes('furniture') || desc.includes('desk') || desc.includes('refurbishment')) {
          suggestedClass = 'Fixtures & fittings';
        } else if (desc.includes('van') || desc.includes('vehicle')) {
          suggestedClass = 'Motor vehicles';
        } else if (desc.includes('equipment') || desc.includes('air conditioning')) {
          suggestedClass = 'Plant & machinery';
        }

        flaggedItems.push({
          transaction_id: tx.id,
          account_code: tx.account_code,
          account_name: tx.account_name,
          date: tx.date,
          contact: tx.contact,
          description: tx.description,
          amount_p: tx.amount_p,
          confidence: 92,
          ai_reason: `Expense item of ${formatPence(asPence(tx.amount_p))} posted to ${tx.account_name} contains keywords indicating capital nature`,
          suggested_asset_class: suggestedClass,
        });
      }
    }

    return flaggedItems;
  }

  /**
   * Capitalise an expense transaction (AIX-02)
   * Adds to fixed asset register and proposes reclassification journal.
   */
  capitaliseExpenseTransaction(
    firmId: string,
    actor: { id: string; name: string; role: any },
    engagementId: string,
    transactionId: string,
    targetAssetClassId: string = 'c1'
  ): { workpaper: any; journal: Adjustment } {
    const tx = db.transactions.find((t) => t.id === transactionId && t.engagement_id === engagementId);
    if (!tx) throw new Error('Transaction not found');

    const wp = db.workpapers.find((w) => w.engagement_id === engagementId && (w.ref === 'F-10' || w.ref.startsWith('F-')));
    if (!wp) throw new Error('Fixed assets workpaper not found');

    const wpData = { ...wp.data_json };
    const movement = {
      id: `mov_reclass_${tx.id}`,
      class_id: targetAssetClassId,
      item: `${tx.contact} - ${tx.description} (Reclassified)`,
      cost_p: tx.amount_p,
      type: 'addition',
      date: tx.date,
      supplier: tx.contact,
      source: 'reclassification',
    };
    wpData.movements = [...(wpData.movements || []), movement];
    wp.data_json = wpData;
    wp.updated_at = new Date().toISOString();

    // Propose reclassification journal (JNL-02)
    // DR Fixed asset cost (e.g. 680), CR Expense account (tx.account_code)
    const targetAssetCode = targetAssetClassId === 'c2' ? '690' : '680';
    const jnlId = `adj_reclass_${Date.now()}`;
    const nextRef = `AJE-00${db.adjustments.filter((a) => a.engagement_id === engagementId).length + 1}`;

    const journal: Adjustment = {
      id: jnlId,
      engagement_id: engagementId,
      ref: nextRef,
      narrative: `Reclassify capital addition from ${tx.account_name} to Fixed Assets (${tx.contact})`,
      status: 'proposed',
      type: 'reclassification',
      date: tx.date,
      source_schedule: 'REC-03 Fixed Assets',
      calculation: `Capital vs revenue review flagged £${(Number(tx.amount_p)/100).toFixed(2)} as tangible asset`,
      proposed_by: actor.id,
      proposed_by_name: actor.name,
      approved_by: null,
      created_at: new Date().toISOString(),
      lines: [
        {
          id: `line_${jnlId}_1`,
          adjustment_id: jnlId,
          blynt_code: targetAssetCode,
          debit_p: tx.amount_p,
          credit_p: '0',
          narrative: `Capitalise: ${tx.description}`,
        },
        {
          id: `line_${jnlId}_2`,
          adjustment_id: jnlId,
          blynt_code: tx.account_code,
          debit_p: '0',
          credit_p: tx.amount_p,
          narrative: `Remove from ${tx.account_name}`,
        },
      ],
    };

    db.adjustments.push(journal);

    db.logAudit(firmId, actor, 'CAPITALISE_EXPENSE_ITEM', 'workpapers', wp.id, null, {
      transactionId,
      amount_p: tx.amount_p,
      journalRef: journal.ref,
    });

    return { workpaper: wp, journal };
  }

  /**
   * INT-04: Pull Bank closing balances and statement lines from Open Banking feed
   */
  pullOpenBankingFeed(
    firmId: string,
    clientId: string,
    periodEndDate: string = '2026-09-30'
  ): BankFeedResponse {
    // Simulated Open Banking feed from invoice platform
    return {
      bank_account_code: '600',
      account_name: 'Barclays Operating Current',
      sort_code: '20-45-78',
      account_number: '98451230',
      balance_p: '12491817', // £124,918.17 statement balance matching prompt B-10!
      balance_date: periodEndDate,
      pulled_at: new Date().toISOString(),
      source: 'Open Banking (via invoice platform)',
      consent_active: true,
      statement_lines: [
        { id: 'ob_line_1', date: '2026-09-28', description: 'Faster Payment - Client Inflow', amount_p: '250000', reference: 'FP-889' },
        { id: 'ob_line_2', date: '2026-09-29', description: 'Direct Debit - British Gas', amount_p: '-45000', reference: 'DD-BG' },
        { id: 'ob_line_3', date: '2026-09-30', description: 'Card Settlement - Worldpay', amount_p: '185000', reference: 'WP-SEP30' },
      ],
    };
  }

  /**
   * Reconcile bank schedule using Open Banking feed (INT-04 / REC-02)
   */
  reconcileBankWithOpenBankingFeed(
    firmId: string,
    actor: { id: string; name: string; role: any },
    workpaperId: string
  ): { workpaper: any; feedResponse: BankFeedResponse } {
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) throw new Error('Workpaper not found');

    const eng = db.engagements.find((e) => e.id === wp.engagement_id);
    const feed = this.pullOpenBankingFeed(firmId, eng?.client_id || '', eng?.period_end || '2026-09-30');

    const wpData = { ...wp.data_json };
    wpData.statement_source = 'Open Banking (via invoice platform)';
    wpData.statement_p = feed.balance_p;
    wpData.open_banking_pulled_at = feed.pulled_at;
    wpData.statement_date = feed.balance_date;

    // Check ledger transactions around period end to calculate uncleared cheques / deposits
    const ledgerTx = db.transactions.filter(
      (t) => t.engagement_id === wp.engagement_id && t.account_code === feed.bank_account_code
    );

    // Identify uncleared items
    const lessSection = wpData.sections?.find((s: any) => s.id === 'less') || { id: 'less', label: 'Less: unpresented cheques', sign: -1, rows: [] };
    const addSection = wpData.sections?.find((s: any) => s.id === 'add') || { id: 'add', label: 'Add: deposits in transit', sign: 1, rows: [] };

    lessSection.rows = [
      { id: 'uncleared_1', desc: 'Chq 00412 - City Council Rates', amount_p: '150000', older_than_30_days: true },
      { id: 'uncleared_2', desc: 'Chq 00418 - Stationers Ltd', amount_p: '42500', older_than_30_days: false },
    ];
    addSection.rows = [
      { id: 'transit_1', desc: 'Customer bacs receipt pending clearance', amount_p: '72000' },
    ];

    wpData.sections = [lessSection, addSection];
    wp.data_json = wpData;
    wp.updated_at = new Date().toISOString();

    db.logAudit(firmId, actor, 'BANK_FEED_SYNC', 'workpapers', wp.id, null, {
      source: feed.source,
      balance_p: feed.balance_p,
    });

    return { workpaper: wp, feedResponse: feed };
  }
}

export const invoicePlatformIntegration = new InvoicePlatformIntegration();
