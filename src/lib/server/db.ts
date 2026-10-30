import crypto from 'crypto';
import {
  Firm,
  User,
  Membership,
  UserRole,
  Client,
  Engagement,
  BlyntAccount,
  MappingList,
  MappingRule,
  TbSnapshot,
  TbLine,
  AccountMapping,
  Adjustment,
  AdjustmentLine,
  Template,
  Workpaper,
  Procedure,
  Comment,
  CommentReply,
  Attachment,
  AttachmentLink,
  Signoff,
  ViewPrefs,
  AuditLog,
  AiLineage,
  CompanyType,
  LearnedRule,
  AiActionLogItem,
  AiReviewFinding,
  ScheduleVersion,
  DisclosureChecklistItem,
  StatutoryNoteItem,
  LedgerTransaction,
  Invite,
} from '../types/models';
import { toPence, sumPence } from '../money';
import type { XeroConnection as XeroConnectionRecord } from './xero';
import type { QboConnection as QboConnectionRecord } from './quickbooks';
import { packFor, templateFor, blankPaperData } from '../workpapers/templates';
import { getStatutoryDetails } from '../mapping/auto-mapper';

export interface ServerSession {
  user: User;
  membership: Membership;
}

// In-Memory Database with strict RLS (firm_id) and insert-only audit log
class Database {
  firms: Firm[] = [];
  users: User[] = [];
  memberships: Membership[] = [];
  clients: Client[] = [];
  engagements: Engagement[] = [];
  blynt_accounts: BlyntAccount[] = [];
  mapping_lists: MappingList[] = [];
  mapping_rules: MappingRule[] = [];
  tb_snapshots: TbSnapshot[] = [];
  tb_lines: TbLine[] = [];
  account_mappings: AccountMapping[] = [];
  adjustments: Adjustment[] = [];
  templates: Template[] = [];
  workpapers: Workpaper[] = [];
  procedures: Procedure[] = [];
  comments: Comment[] = [];
  attachments: Attachment[] = [];
  attachment_links: AttachmentLink[] = [];
  signoffs: Signoff[] = [];
  view_prefs: ViewPrefs[] = [];
  audit_logs: AuditLog[] = []; // APPEND ONLY!
  ai_lineage: AiLineage[] = [];
  // v1.1 Collections
  learned_rules: LearnedRule[] = [];
  ai_action_logs: AiActionLogItem[] = [];
  ai_review_findings: AiReviewFinding[] = [];
  schedule_versions: ScheduleVersion[] = [];
  checklist_items: DisclosureChecklistItem[] = [];
  statutory_notes: StatutoryNoteItem[] = [];
  transactions: LedgerTransaction[] = [];
  invites: Invite[] = []; // Server-only, like credentials
  // Server-only: which practice uploaded each stored file, so downloads can be checked
  uploads: { file_key: string; firm_id: string; uploaded_by: string; uploaded_at: string }[] = [];
  // Server-only: Xero connections with encrypted tokens (see xero.ts)
  xero_connections: XeroConnectionRecord[] = [];
  // Server-only: QuickBooks Online connections with encrypted tokens (see quickbooks.ts)
  qbo_connections: QboConnectionRecord[] = [];
  // Server-only: password hashes. Never sent to the browser (see state-guard.ts)
  credentials: { user_id: string; password_hash: string; mfa_secret?: string; mfa_pending_secret?: string; mfa_last_step?: number }[] = [];

  constructor() {
    this.seed(true);
  }

  // Collections that hold workspace data (persisted to Postgres)
  static readonly COLLECTIONS = [
    'firms', 'users', 'memberships', 'clients', 'engagements', 'blynt_accounts',
    'mapping_lists', 'mapping_rules', 'tb_snapshots', 'tb_lines', 'account_mappings',
    'adjustments', 'templates', 'workpapers', 'procedures', 'comments', 'attachments',
    'attachment_links', 'signoffs', 'view_prefs', 'audit_logs', 'ai_lineage', 'credentials',
    'learned_rules', 'ai_action_logs', 'ai_review_findings', 'schedule_versions', 'checklist_items', 'statutory_notes',
    'transactions', 'invites', 'uploads', 'xero_connections', 'qbo_connections',
  ] as const;

  exportState(): Record<string, unknown[]> {
    const out: Record<string, unknown[]> = {};
    for (const k of Database.COLLECTIONS) out[k] = (this as any)[k];
    return out;
  }

  importState(state: Record<string, unknown[]> | null | undefined) {
    if (!state) return;
    for (const k of Database.COLLECTIONS) {
      if (Array.isArray(state[k])) (this as any)[k] = state[k];
    }
  }

  // Working papers for a new engagement, from the pack for its company type
  createEngagementWorkpapers(engagementId: string, companyType?: string, includeOptional = true) {
    for (const ref of packFor(companyType, includeOptional)) this.addWorkpaper(engagementId, ref);
  }

  addWorkpaper(engagementId: string, ref: string) {
    const t = templateFor(ref);
    if (!t) return null;
    const wpId = `wp_${engagementId}_${ref.replace('-', '').toLowerCase()}`;
    const existing = this.workpapers.find((w) => w.id === wpId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const wp: Workpaper = {
      id: wpId,
      engagement_id: engagementId,
      ref,
      template_id: `tpl_${ref.replace('-', '').toLowerCase()}`,
      template_version: t.version,
      data_json: blankPaperData(t),
      status: 'not_started',
      rolled_from_workpaper_id: null,
      created_at: now,
      updated_at: now,
    };
    this.workpapers.push(wp);
    t.procedures.forEach((text, idx) => {
      this.procedures.push({
        id: `proc_${wpId}_${idx + 1}`,
        workpaper_id: wpId,
        text,
        done_by: null,
        done_at: null,
        not_applicable_reason: null,
      });
    });
    return wp;
  }

  // Remove all client/engagement data, keeping firm, team and reference library
  clearWorkspaceData() {
    this.clients = [];
    this.engagements = [];
    this.mapping_lists = [];
    this.mapping_rules = [];
    this.tb_snapshots = [];
    this.tb_lines = [];
    this.account_mappings = [];
    this.adjustments = [];
    this.workpapers = [];
    this.procedures = [];
    this.comments = [];
    this.attachments = [];
    this.attachment_links = [];
    this.signoffs = [];
    this.view_prefs = [];
    this.audit_logs = [];
    this.ai_lineage = [];
    this.learned_rules = [];
    this.ai_action_logs = [];
    this.ai_review_findings = [];
    this.schedule_versions = [];
    this.checklist_items = [];
    this.statutory_notes = [];
    this.transactions = [];
  }

  // Delete a specific client and cascade remove associated engagements and workpapers
  deleteClient(clientId: string) {
    this.clients = this.clients.filter((c) => c.id !== clientId);
    const engIds = this.engagements.filter((e) => e.client_id === clientId).map((e) => e.id);
    this.engagements = this.engagements.filter((e) => e.client_id !== clientId);
    this.account_mappings = this.account_mappings.filter((m) => !engIds.includes(m.engagement_id));
    this.transactions = this.transactions.filter((t) => !engIds.includes(t.engagement_id));
    this.tb_snapshots = this.tb_snapshots.filter((s) => !engIds.includes(s.engagement_id));
    this.tb_lines = this.tb_lines.filter((l) => !engIds.some((eid) => l.snapshot_id?.includes(eid)));
    this.adjustments = this.adjustments.filter((a) => !engIds.includes(a.engagement_id));
    const wpIds = this.workpapers.filter((w) => engIds.includes(w.engagement_id)).map((w) => w.id);
    this.workpapers = this.workpapers.filter((w) => !engIds.includes(w.engagement_id));
    this.procedures = this.procedures.filter((p) => !wpIds.includes(p.workpaper_id));
    this.comments = this.comments.filter((c) => !wpIds.includes(c.workpaper_id) && (c as any).client_id !== clientId);
    this.signoffs = this.signoffs.filter((s) => !wpIds.includes(s.workpaper_id));
  }

  // Ground Rule 4: Append-only audit log
  logAudit(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    action: string,
    entity: string,
    entityId: string,
    before: any = null,
    after: any = null,
    reason: string | null = null
  ) {
    const entry: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      firm_id: firmId,
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action,
      entity,
      entity_id: entityId,
      before_json: before ? JSON.stringify(before) : null,
      after_json: after ? JSON.stringify(after) : null,
      at: new Date().toISOString(),
      reason,
    };
    // Immutable once written (AUD-01); the sync guard also refuses edits from the browser
    this.audit_logs.push(Object.freeze(entry) as AuditLog);
    return entry;
  }

  seed(withDemo = false) {
    this.firms = [];
    this.users = [];
    this.memberships = [];
    this.clients = [];
    this.engagements = [];
    this.blynt_accounts = [];
    this.mapping_lists = [];
    this.mapping_rules = [];
    this.tb_snapshots = [];
    this.tb_lines = [];
    this.account_mappings = [];
    this.adjustments = [];
    this.templates = [];
    this.workpapers = [];
    this.procedures = [];
    this.comments = [];
    this.attachments = [];
    this.attachment_links = [];
    this.signoffs = [];
    this.view_prefs = [];
    this.audit_logs = [];
    this.ai_lineage = [];
    this.learned_rules = [];
    this.ai_action_logs = [];
    this.ai_review_findings = [];
    this.schedule_versions = [];
    this.checklist_items = [];
    this.statutory_notes = [];
    this.transactions = [];
    this.invites = [];
    this.uploads = [];
    this.xero_connections = [];
    this.qbo_connections = [];

    const firmId = 'firm_blynt_uk';
    this.firms = [
      { id: firmId, name: 'Blynt Practice & Co LLP', created_at: '2026-01-01T00:00:00Z' },
    ];

    // Development Admin & Professional auditors
    this.users = [
      { id: 'usr_admin', email: 'admin@blynt.co.uk', name: 'Dev Administrator', initials: 'AD', title: 'System Administrator', mfa_enabled: false },
      { id: 'usr_test_preparer', email: 'marcus.vance@blynt.co.uk', name: 'Marcus Vance', initials: 'MV', title: 'Senior Associate / Preparer', mfa_enabled: false },
      { id: 'usr_test_reviewer', email: 'sarah.jenkins@blynt.co.uk', name: 'Sarah Jenkins', initials: 'SJ', title: 'Audit Manager', mfa_enabled: false },
      { id: 'usr_test_partner', email: 'david.thorne@blynt.co.uk', name: 'David Thorne', initials: 'DT', title: 'Engagement Partner', mfa_enabled: false },
    ];

    this.memberships = [
      { user_id: 'usr_admin', firm_id: firmId, role: 'admin' },
      { user_id: 'usr_test_preparer', firm_id: firmId, role: 'preparer' },
      { user_id: 'usr_test_reviewer', firm_id: firmId, role: 'reviewer' },
      { user_id: 'usr_test_partner', firm_id: firmId, role: 'partner' },
    ];

    // Standard Blynt Chart of Accounts
    this.blynt_accounts = [
      // Assets 1000 - 1999
      { code: '1000', name: 'Petty Cash', type: 'Asset', normal_balance: 'Debit', lead_letter: 'B', is_control: false, is_system: true },
      { code: '1010', name: 'Barclays Current Account', type: 'Asset', normal_balance: 'Debit', lead_letter: 'B', is_control: true, is_system: true },
      { code: '1020', name: 'Barclays Reserve Account', type: 'Asset', normal_balance: 'Debit', lead_letter: 'B', is_control: false, is_system: true },
      { code: '1200', name: 'Trade Debtors Control', type: 'Asset', normal_balance: 'Debit', lead_letter: 'C', is_control: true, is_system: true },
      { code: '1210', name: 'Bad Debt Provision', type: 'Asset', normal_balance: 'Credit', lead_letter: 'C', is_control: false, is_system: true },
      { code: '1300', name: 'Finished Goods Stock', type: 'Asset', normal_balance: 'Debit', lead_letter: 'D', is_control: true, is_system: true },
      { code: '1400', name: 'Prepayments', type: 'Asset', normal_balance: 'Debit', lead_letter: 'E', is_control: false, is_system: true },
      { code: '1500', name: 'Plant & Equipment Cost', type: 'Asset', normal_balance: 'Debit', lead_letter: 'F', is_control: true, is_system: true },
      { code: '1510', name: 'Computer Equipment Cost', type: 'Asset', normal_balance: 'Debit', lead_letter: 'F', is_control: false, is_system: true },
      { code: '1520', name: 'Fixtures & Fittings Cost', type: 'Asset', normal_balance: 'Debit', lead_letter: 'F', is_control: false, is_system: true },
      { code: '1700', name: 'Accumulated Depreciation', type: 'Asset', normal_balance: 'Credit', lead_letter: 'F', is_control: true, is_system: true },
      { code: '1710', name: 'Computer Equip Accumulated Deprec', type: 'Asset', normal_balance: 'Credit', lead_letter: 'F', is_control: false, is_system: true },
      { code: '1720', name: 'Fixtures & Fittings Accumulated Deprec', type: 'Asset', normal_balance: 'Credit', lead_letter: 'F', is_control: false, is_system: true },
      // Liabilities 2000 - 2999
      { code: '2000', name: 'Trade Creditors Control', type: 'Liability', normal_balance: 'Credit', lead_letter: 'K', is_control: true, is_system: true },
      { code: '2100', name: 'Accruals', type: 'Liability', normal_balance: 'Credit', lead_letter: 'K', is_control: false, is_system: true },
      { code: '2200', name: 'VAT Liability Control', type: 'Liability', normal_balance: 'Credit', lead_letter: 'T', is_control: true, is_system: true },
      { code: '2300', name: 'PAYE & NIC Payable', type: 'Liability', normal_balance: 'Credit', lead_letter: 'T', is_control: false, is_system: true },
      { code: '2600', name: 'Bank Loan (Long Term)', type: 'Liability', normal_balance: 'Credit', lead_letter: 'L', is_control: false, is_system: true },
      // Equity 3000 - 3999
      { code: '3000', name: 'Called Up Share Capital', type: 'Equity', normal_balance: 'Credit', lead_letter: 'Z', is_control: false, is_system: true },
      { code: '3100', name: 'Profit and Loss Account (Reserves)', type: 'Equity', normal_balance: 'Credit', lead_letter: 'Z', is_control: true, is_system: true },
      // Revenue 4000 - 4999
      { code: '4000', name: 'Sales Revenue - UK General', type: 'Revenue', normal_balance: 'Credit', lead_letter: 'A', is_control: false, is_system: true },
      { code: '4100', name: 'Sales Revenue - Export', type: 'Revenue', normal_balance: 'Credit', lead_letter: 'A', is_control: false, is_system: true },
      // Cost of Sales 5000 - 5999
      { code: '5000', name: 'Direct Materials & Components', type: 'Cost of Sales', normal_balance: 'Debit', lead_letter: 'A', is_control: false, is_system: true },
      { code: '5100', name: 'Direct Subcontract Wages', type: 'Cost of Sales', normal_balance: 'Debit', lead_letter: 'A', is_control: false, is_system: true },
      // Overheads 6000 - 6999
      { code: '6000', name: 'Office Rent & Rates', type: 'Overhead', normal_balance: 'Debit', lead_letter: 'E', is_control: false, is_system: true },
      { code: '6100', name: 'Light, Heat & Power', type: 'Overhead', normal_balance: 'Debit', lead_letter: 'E', is_control: false, is_system: true },
      { code: '6200', name: 'Staff Salaries', type: 'Overhead', normal_balance: 'Debit', lead_letter: 'T', is_control: false, is_system: true },
      { code: '6900', name: 'Depreciation Charge for Year', type: 'Overhead', normal_balance: 'Debit', lead_letter: 'F', is_control: true, is_system: true },
      { code: '6950', name: 'Loss / (Profit) on Disposal of Assets', type: 'Overhead', normal_balance: 'Debit', lead_letter: 'F', is_control: false, is_system: true },
    ];

    // Clean slate: if demo data is not requested, keep workspace clean and empty
    if (!withDemo) {
      return;
    }

    // Client Portfolio
    this.clients = [
      {
        id: 'cli_mb_therapy',
        firm_id: firmId,
        name: 'MB Therapy Ltd',
        company_no: '14829104',
        company_type: 'Small company (FRS 102 1A)',
        year_end: '2026-09-30',
        data_source: 'csv',
        reconnect_needed: false,
      },
      {
        id: 'cli_harlow',
        firm_id: firmId,
        name: 'Harlow & Finch Fine Goods Ltd',
        company_no: '09876543',
        company_type: 'Small company (FRS 102 1A)',
        year_end: '2026-09-30',
        data_source: 'csv',
        reconnect_needed: false,
      },
      {
        id: 'cli_acme',
        firm_id: firmId,
        name: 'Acme Precision Engineering Ltd',
        company_no: '08942150',
        company_type: 'Small company (FRS 102 1A)',
        year_end: '2026-03-31',
        data_source: 'xero',
        reconnect_needed: false,
      },
      {
        id: 'cli_meridian',
        firm_id: firmId,
        name: 'Meridian Logistics & Freight LLP',
        company_no: 'OC345678',
        company_type: 'LLP (FRS 102 + LLP SORP)',
        year_end: '2026-02-28',
        data_source: 'quickbooks',
        reconnect_needed: false,
      },
      {
        id: 'cli_apex',
        firm_id: firmId,
        name: 'Apex BioPharma Technologies Ltd',
        company_no: '12345678',
        company_type: 'Micro-entity (FRS 105)',
        year_end: '2026-04-30',
        data_source: 'csv',
        reconnect_needed: false,
      },
      {
        id: 'cli_kensington',
        firm_id: firmId,
        name: 'Kensington Heritage Trust',
        company_no: 'CE012345',
        company_type: 'Charity (SORP)',
        year_end: '2026-05-31',
        data_source: 'freeagent',
        reconnect_needed: false,
      },
      {
        id: 'cli_vanguard',
        firm_id: firmId,
        name: 'Vanguard Industrial Group plc',
        company_no: '04561234',
        company_type: 'Medium/large (FRS 102)',
        year_end: '2026-12-31',
        data_source: 'sage',
        reconnect_needed: false,
      },
      {
        id: 'cli_solaris',
        firm_id: firmId,
        name: 'Solaris Renewables Group Ltd',
        company_no: '11223344',
        company_type: 'IFRS company/group',
        year_end: '2026-09-30',
        data_source: 'quickbooks',
        reconnect_needed: true,
      },
    ];

    // MB Therapy Engagements
    const mbPriorEngId = 'eng_mb_therapy_fy25';
    this.engagements.push({
      id: mbPriorEngId,
      client_id: 'cli_mb_therapy',
      firm_id: firmId,
      period_start: '2024-10-01',
      period_end: '2025-09-30',
      framework: 'FRS 102 1A',
      template_pack_id: 'pack_small_co',
      status: 'locked',
      locked_at: '2025-11-20T10:00:00Z',
      locked_by: 'usr_test_partner',
      prior_engagement_id: null,
    });

    const mbEngId = 'eng_mb_therapy_fy26';
    this.engagements.push({
      id: mbEngId,
      client_id: 'cli_mb_therapy',
      firm_id: firmId,
      period_start: '2025-10-01',
      period_end: '2026-09-30',
      framework: 'FRS 102 1A',
      template_pack_id: 'pack_small_co',
      status: 'fieldwork',
      locked_at: null,
      prior_engagement_id: mbPriorEngId,
    });

    // Prior year engagement (Harlow)
    const clientId = 'cli_harlow';
    const priorEngId = 'eng_harlow_fy25';
    this.engagements.push({
      id: priorEngId,
      client_id: clientId,
      firm_id: firmId,
      period_start: '2024-10-01',
      period_end: '2025-09-30',
      framework: 'FRS 102 1A',
      template_pack_id: 'pack_small_co',
      status: 'locked',
      locked_at: '2025-11-15T14:30:00Z',
      locked_by: 'usr_test_partner',
      prior_engagement_id: null,
    });

    // Current engagement (Harlow)
    const engId = 'eng_harlow_fy26';
    this.engagements.push({
      id: engId,
      client_id: clientId,
      firm_id: firmId,
      period_start: '2025-10-01',
      period_end: '2026-09-30',
      framework: 'FRS 102 1A',
      template_pack_id: 'pack_small_co',
      status: 'fieldwork',
      locked_at: null,
      prior_engagement_id: priorEngId,
    });

    // Acme Precision Engineering engagement
    const acmeEngId = 'eng_acme_fy26';
    this.engagements.push({
      id: acmeEngId,
      client_id: 'cli_acme',
      firm_id: firmId,
      period_start: '2025-04-01',
      period_end: '2026-03-31',
      framework: 'FRS 102 1A',
      template_pack_id: 'pack_small_co',
      status: 'fieldwork',
      locked_at: null,
      prior_engagement_id: null,
    });

    // Meridian Logistics engagement
    this.engagements.push({
      id: 'eng_meridian_fy26',
      client_id: 'cli_meridian',
      firm_id: firmId,
      period_start: '2025-03-01',
      period_end: '2026-02-28',
      framework: 'FRS 102 + LLP SORP',
      template_pack_id: 'pack_llp',
      status: 'review',
      locked_at: null,
      prior_engagement_id: null,
    });

    // Apex BioPharma engagement
    this.engagements.push({
      id: 'eng_apex_fy26',
      client_id: 'cli_apex',
      firm_id: firmId,
      period_start: '2025-05-01',
      period_end: '2026-04-30',
      framework: 'FRS 105',
      template_pack_id: 'pack_micro',
      status: 'fieldwork',
      locked_at: null,
      prior_engagement_id: null,
    });

    // Kensington Heritage engagement
    this.engagements.push({
      id: 'eng_kensington_fy26',
      client_id: 'cli_kensington',
      firm_id: firmId,
      period_start: '2025-06-01',
      period_end: '2026-05-31',
      framework: 'Charities SORP (FRS 102)',
      template_pack_id: 'pack_charity',
      status: 'planning',
      locked_at: null,
      prior_engagement_id: null,
    });

    // Vanguard Industrial engagement
    this.engagements.push({
      id: 'eng_vanguard_fy26',
      client_id: 'cli_vanguard',
      firm_id: firmId,
      period_start: '2026-01-01',
      period_end: '2026-12-31',
      framework: 'Medium/large (FRS 102)',
      template_pack_id: 'pack_small_co',
      status: 'planning',
      locked_at: null,
      prior_engagement_id: null,
    });

    // Templates: F-10 Fixed Assets & B-10 Bank Rec
    this.templates = [
      {
        id: 'tpl_f10',
        key: 'fixed-assets-register',
        name: 'Fixed assets: register and depreciation',
        area_letter: 'F',
        company_types: [
          'Small company (FRS 102 1A)',
          'Medium/large (FRS 102)',
          'Micro-entity (FRS 105)',
          'LLP (FRS 102 + LLP SORP)',
        ],
        version: 2,
        is_builtin: true,
        status: 'published',
        used_by_count: 14,
        schema_json: {
          key: 'fixed-assets-register',
          area: 'F',
          version: 2,
          parts: {
            objective:
              'Verify the existence, ownership, valuation and depreciation of property, plant and equipment under FRS 102 s.17.',
            lead: ['1500', '1700', '6900', '6950'],
            schedule: {
              type: 'grid',
              rows: 'classes',
              columns: ['cost_opening', 'cost_additions', 'cost_disposals', 'cost_closing'],
            },
            checks: [
              { id: 'cost_tb', rule: 'closing_cost == tb(1500)', severity: 'blocker' },
              { id: 'deprec_tb', rule: 'closing_depreciation == tb(1700)', severity: 'blocker' },
              { id: 'charge_tb', rule: 'charge == tb(6900)', severity: 'blocker' },
              { id: 'additions_evidence', rule: 'additions_have_evidence', severity: 'blocker' },
              { id: 'disposals_evidence', rule: 'disposals_have_evidence', severity: 'blocker' },
            ],
            procedures: [
              'Agree closing cost and accumulated depreciation to trial balance accounts 1500 and 1700.',
              'Vouch all capital additions over £1,000 to purchase invoices and verify appropriate capitalisation classification.',
              'Inspect evidence of disposal proceeds and verify calculation of profit/loss on disposal.',
              'Perform proof in total calculation of depreciation charge based on accounting policy rates.',
            ],
            attachments: { required: [{ for: 'additions', over_p: 100000 }] },
            conclusion: { required: true },
          },
        },
      },
      {
        id: 'tpl_f10_simple',
        key: 'fixed-assets-simple',
        name: 'Fixed assets: simple (micro-entity)',
        area_letter: 'F',
        company_types: ['Micro-entity (FRS 105)'],
        version: 1,
        is_builtin: true,
        status: 'published',
        used_by_count: 5,
        schema_json: {
          key: 'fixed-assets-simple',
          area: 'F',
          version: 1,
          parts: {
            objective: 'Micro-entity summary verification of tangibles under FRS 105.',
            lead: ['1500', '1700'],
          },
        },
      },
      {
        id: 'tpl_b10',
        key: 'bank-reconciliation',
        name: 'Bank reconciliation and subsequent clearance',
        area_letter: 'B',
        company_types: [
          'Sole trader',
          'Partnership',
          'LLP (FRS 102 + LLP SORP)',
          'Micro-entity (FRS 105)',
          'Small company (FRS 102 1A)',
          'Medium/large (FRS 102)',
          'IFRS company/group',
        ],
        version: 2,
        is_builtin: true,
        status: 'published',
        used_by_count: 32,
        schema_json: {
          key: 'bank-reconciliation',
          area: 'B',
          version: 2,
        },
      },
    ];

    // Prior year F-10 paper (for roll forward verification)
    const pyWorkpaperId = 'wp_py_f10';
    this.workpapers.push({
      id: pyWorkpaperId,
      engagement_id: priorEngId,
      ref: 'F-10',
      template_id: 'tpl_f10',
      template_version: 2,
      status: 'signed_off',
      rolled_from_workpaper_id: null,
      created_at: '2025-10-10T09:00:00Z',
      updated_at: '2025-11-14T16:00:00Z',
      data_json: {
        classes: [
          {
            name: 'Computer equipment',
            cost_opening_p: '500000',
            cost_additions_p: '100000',
            cost_disposals_p: '0',
            cost_closing_p: '600000', // £6,000
            deprec_opening_p: '150000',
            deprec_charge_p: '100000',
            deprec_disposals_p: '0',
            deprec_closing_p: '250000', // £2,500
            nbv_this_year_p: '350000',
            deprec_rate: '25% straight line',
          },
          {
            name: 'Fixtures & fittings',
            cost_opening_p: '450000',
            cost_additions_p: '0',
            cost_disposals_p: '0',
            cost_closing_p: '450000', // £4,500
            deprec_opening_p: '0',
            deprec_charge_p: '90000',
            deprec_disposals_p: '0',
            deprec_closing_p: '90000', // £900
            nbv_this_year_p: '360000',
            deprec_rate: '20% straight line',
          },
        ],
        summary: {
          total_closing_cost_p: '1050000', // £10,500
          total_closing_deprec_p: '340000', // £3,400
          total_nbv_p: '710000', // £7,100 (matches prompt prior year NBV!)
        },
      },
    });

    // Current Year F-10 Workpaper matching sample data in prompt:
    // Computer equipment: cost 6,000 + 2,400 - 1,200 = 7,200; depreciation 2,500 + 1,800 - 800 = 3,500
    // Fixtures: cost 4,500, depreciation 900 + 900 = 1,800
    // NBV 6,400 (last year 7,100); charge 2,700; disposal NBV 400, proceeds 250, loss 150.
    const f10Id = 'wp_f10';
    this.workpapers.push({
      id: f10Id,
      engagement_id: engId,
      ref: 'F-10',
      template_id: 'tpl_f10',
      template_version: 2,
      status: 'in_progress',
      rolled_from_workpaper_id: pyWorkpaperId,
      created_at: '2026-10-01T09:00:00Z',
      updated_at: '2026-10-23T10:00:00Z',
      data_json: {
        objective:
          'To test existence, valuation and completeness of tangible fixed assets, verify depreciation calculations according to disclosed policy, and vouch additions and disposals.',
        classes: [
          {
            id: 'c1',
            name: 'Computer equipment',
            cost_opening_p: '600000',
            cost_opening_is_py: true,
            cost_additions_p: '240000',
            cost_disposals_p: '120000',
            cost_closing_p: '720000', // 6,000 + 2,400 - 1,200 = 7,200
            deprec_opening_p: '250000',
            deprec_opening_is_py: true,
            deprec_charge_p: '180000',
            deprec_disposals_p: '80000',
            deprec_closing_p: '350000', // 2,500 + 1,800 - 800 = 3,500
            nbv_this_year_p: '370000',
            nbv_prior_year_p: '350000',
            deprec_method: 'Straight line',
            deprec_rate: '25%',
          },
          {
            id: 'c2',
            name: 'Fixtures & fittings',
            cost_opening_p: '450000',
            cost_opening_is_py: true,
            cost_additions_p: '0',
            cost_disposals_p: '0',
            cost_closing_p: '450000', // 4,500
            deprec_opening_p: '90000',
            deprec_opening_is_py: true,
            deprec_charge_p: '90000',
            deprec_disposals_p: '0',
            deprec_closing_p: '180000', // 900 + 900 = 1,800
            nbv_this_year_p: '270000',
            nbv_prior_year_p: '360000',
            deprec_method: 'Straight line',
            deprec_rate: '20%',
          },
        ],
        additions: [
          {
            id: 'add_1',
            date: '2026-03-15',
            item: 'Dell PowerEdge R750 Server & Workstations',
            supplier: 'Dell Technologies UK',
            asset_class: 'Computer equipment',
            cost_p: '240000', // £2,400.00
            attachment_id: 'att_inv_dell',
            invoice_ref: 'INV-DELL-9811',
            has_evidence: true,
          },
        ],
        disposals: [
          {
            id: 'disp_1',
            date: '2026-06-20',
            item: 'Legacy Apple iMac Workstations (x2)',
            asset_class: 'Computer equipment',
            cost_p: '120000', // £1,200.00
            deprec_p: '80000', // £800.00
            nbv_out_p: '40000', // £400.00
            proceeds_p: '25000', // £250.00
            loss_p: '15000', // £150.00 (calculated: 400 - 250)
            attachment_id: null, // Note: Missing disposal evidence per sample data test!
            has_evidence: false,
          },
        ],
        proof_in_total: {
          computer_expected_p: '180000',
          fixtures_expected_p: '90000',
          total_expected_charge_p: '270000',
          actual_charge_p: '270000',
          variance_p: '0',
        },
        conclusion: {
          text: 'Substantive testing of tangible fixed assets was completed in accordance with FRS 102 section 17. Additions were vouched to supplier invoice. Proof in total confirms depreciation charge of £2,700.00 is mathematically sound.',
          ai_draft:
            '✦ suggestion: Additions of £2,400.00 vouched to invoice. Proof in total agrees to depreciation charge of £2,700.00. Outstanding item: obtain bank credit evidence for £250.00 disposal proceeds.',
          ai_status: 'draft',
        },
      },
    });

    // Procedures for F-10
    this.procedures.push(
      {
        id: 'proc_f10_1',
        workpaper_id: f10Id,
        text: 'Agree closing cost and accumulated depreciation to trial balance accounts 1500 and 1700.',
        done_by: 'usr_test_preparer',
        done_at: '2026-10-23T11:00:00Z',
        not_applicable_reason: null,
      },
      {
        id: 'proc_f10_2',
        workpaper_id: f10Id,
        text: 'Vouch capital additions over £1,000 threshold to supplier invoices.',
        done_by: 'usr_test_preparer',
        done_at: '2026-10-23T11:15:00Z',
        not_applicable_reason: null,
      },
      {
        id: 'proc_f10_3',
        workpaper_id: f10Id,
        text: 'Inspect evidence of disposal proceeds and verify loss calculation.',
        done_by: null,
        done_at: null,
        not_applicable_reason: null,
      },
      {
        id: 'proc_f10_4',
        workpaper_id: f10Id,
        text: 'Perform proof in total calculation of depreciation charge against policy.',
        done_by: 'usr_test_preparer',
        done_at: '2026-10-23T11:30:00Z',
        not_applicable_reason: null,
      }
    );

    // B-10 Bank Rec Workpaper
    const b10Id = 'wp_b10';
    this.workpapers.push({
      id: b10Id,
      engagement_id: engId,
      ref: 'B-10',
      template_id: 'tpl_b10',
      template_version: 2,
      status: 'prepared',
      rolled_from_workpaper_id: null,
      created_at: '2026-10-01T09:00:00Z',
      updated_at: '2026-10-23T09:42:00Z',
      data_json: {
        title: 'Bank reconciliation - Barclays Operating',
        ledger_balance_p: '11840217', // £118,402.17
        bank_balance_p: '12491817', // £124,918.17
        outstanding_cheques_total_p: '723600', // £7,236.00
        deposits_in_transit_total_p: '72000', // £720.00
        adjusted_bank_balance_p: '11840217', // £118,402.17
        difference_p: '0',
        ties: true,
      },
    });

    // Procedures for B-10
    this.procedures.push(
      {
        id: 'proc_b10_1',
        workpaper_id: b10Id,
        text: 'Agree general ledger balance to trial balance line 1010 without variance.',
        done_by: 'usr_test_preparer',
        done_at: '2026-10-23T09:30:00Z',
        not_applicable_reason: null,
      },
      {
        id: 'proc_b10_2',
        workpaper_id: b10Id,
        text: 'Agree bank statement closing balance to bank confirmation certificate.',
        done_by: 'usr_test_preparer',
        done_at: '2026-10-23T09:35:00Z',
        not_applicable_reason: null,
      },
      {
        id: 'proc_b10_3',
        workpaper_id: b10Id,
        text: 'Inspect subsequent clearance of outstanding cheques on October statements.',
        done_by: 'usr_test_preparer',
        done_at: '2026-10-23T09:40:00Z',
        not_applicable_reason: null,
      }
    );

    // Initial Signoff for B-10
    this.signoffs.push({
      id: 'sig_b10_prep',
      workpaper_id: b10Id,
      role: 'preparer',
      user_id: 'usr_test_preparer',
      user_name: 'Test Preparer',
      signed_at: '2026-10-23T09:42:00Z',
      content_hash: 'hash_b10_v1_confirmed',
      stale_at: null,
    });

    // Populate all remaining workpapers for the small company pack
    this.createEngagementWorkpapers(engId, 'Small company (FRS 102 1A)');

    // Attachments
    const dellSha = crypto.createHash('sha256').update('DELL_SERVER_INVOICE_CONTENT_FY26').digest('hex');
    this.attachments.push({
      id: 'att_inv_dell',
      engagement_id: engId,
      workpaper_id: f10Id,
      file_key: 'uploads/harlow_fy26/Dell_PowerEdge_Invoice_9811.pdf',
      filename: 'Dell_PowerEdge_Invoice_9811.pdf',
      mime: 'application/pdf',
      size: 142080,
      sha256: dellSha,
      category: 'Invoice',
      is_permanent: false,
      uploaded_by: 'usr_test_preparer',
      uploaded_by_name: 'Test Preparer',
      uploaded_at: '2026-10-23T10:15:00Z',
    });

    // Comments & Pins
    this.comments.push({
      id: 'com_f10_disp',
      workpaper_id: f10Id,
      type: 'review_note',
      anchor_json: { kind: 'row', table: 'disposals', row: 'disp_1' },
      anchor_summary: 'Disposals: Legacy Apple iMac Workstations',
      status: 'open',
      created_by: 'usr_test_reviewer',
      created_by_name: 'Test Reviewer',
      created_at: '2026-10-23T11:45:00Z',
      resolved_by: null,
      body: 'Please attach bank statement credit or sales receipt for the £250.00 disposal proceeds before sign-off.',
      replies: [
        {
          id: 'rep_1',
          comment_id: 'com_f10_disp',
          body: 'Client has requested the remittance advice from the equipment recycling vendor; waiting on document.',
          mentions: ['usr_test_reviewer'],
          created_by: 'usr_test_preparer',
          created_by_name: 'Test Preparer',
          created_at: '2026-10-23T12:00:00Z',
        },
      ],
    });

    // Proposed adjustment: AJE-001 (Proposed by Anika)
    this.adjustments.push({
      id: 'aje_001',
      engagement_id: engId,
      ref: 'AJE-001',
      narrative: 'Accrue unrecorded audit fee invoice for September 2026',
      status: 'proposed',
      proposed_by: 'usr_test_preparer',
      proposed_by_name: 'Test Preparer',
      approved_by: null,
      created_at: '2026-10-22T14:00:00Z',
      lines: [
        {
          id: 'line_1',
          adjustment_id: 'aje_001',
          blynt_code: '6000',
          debit_p: '500000', // £5,000.00
          credit_p: '0',
          narrative: 'Audit fee expense',
        },
        {
          id: 'line_2',
          adjustment_id: 'aje_001',
          blynt_code: '2100',
          debit_p: '0',
          credit_p: '500000', // £5,000.00
          narrative: 'Accruals',
        },
      ],
    });

    // Initial Trial Balance Snapshot for Harlow FY26
    const snapId = 'snap_h26_01';
    const rawData = JSON.stringify({
      company: 'Test Company Ltd',
      period: 'Year ended 30 Sep 2026',
      lines: 28,
    });
    const snapHash = crypto.createHash('sha256').update(rawData).digest('hex');

    this.tb_snapshots.push({
      id: snapId,
      engagement_id: engId,
      source: 'csv',
      as_at: '2026-09-30',
      raw_json: rawData,
      sha256: snapHash,
      created_by: 'usr_test_preparer',
      created_at: '2026-10-01T08:00:00Z',
    });

    // Seed Trial Balance Lines & Mappings (All in Pence)
    const seedLines: {
      code: string;
      name: string;
      type: string;
      debit_p: bigint;
      credit_p: bigint;
      blynt_code: string | null;
      status: 'suggested' | 'confirmed' | 'needs_you';
      confidence: number;
    }[] = [
      { code: '1010', name: 'Barclays Operating Account', type: 'Bank', debit_p: 95535000n, credit_p: 0n, blynt_code: '1010', status: 'confirmed', confidence: 100 },
      { code: '1020', name: 'Barclays High Yield Reserve', type: 'Bank', debit_p: 35000000n, credit_p: 0n, blynt_code: '1020', status: 'confirmed', confidence: 100 },
      { code: '1200', name: 'Sales Ledger Control Account', type: 'Current Asset', debit_p: 248950000n, credit_p: 0n, blynt_code: '1200', status: 'confirmed', confidence: 100 },
      { code: '1210', name: 'Allowance for Doubtful Debts', type: 'Current Asset', debit_p: 0n, credit_p: 12500000n, blynt_code: '1210', status: 'confirmed', confidence: 100 },
      { code: '1300', name: 'Finished Warehouse Stock', type: 'Current Asset', debit_p: 182400000n, credit_p: 0n, blynt_code: '1300', status: 'confirmed', confidence: 100 },
      { code: '1410', name: 'Prepaid Commercial Rates & Insurance', type: 'Current Asset', debit_p: 3240000n, credit_p: 0n, blynt_code: '1400', status: 'confirmed', confidence: 100 },
      { code: '1500', name: 'Plant and Warehouse Machinery Cost', type: 'Fixed Asset', debit_p: 450000000n, credit_p: 0n, blynt_code: '1500', status: 'confirmed', confidence: 100 },
      { code: '1510', name: 'Computer Equipment at Cost', type: 'Fixed Asset', debit_p: 720000n, credit_p: 0n, blynt_code: '1500', status: 'confirmed', confidence: 100 }, // £7,200.00 matches F-10!
      { code: '1520', name: 'Fixtures and Office Fittings Cost', type: 'Fixed Asset', debit_p: 450000n, credit_p: 0n, blynt_code: '1500', status: 'confirmed', confidence: 100 }, // £4,500.00 matches F-10!
      { code: '1700', name: 'Plant Machinery Accumulated Deprec', type: 'Fixed Asset', debit_p: 0n, credit_p: 180000000n, blynt_code: '1700', status: 'confirmed', confidence: 100 },
      { code: '1710', name: 'Computer Equip Accumulated Deprec', type: 'Fixed Asset', debit_p: 0n, credit_p: 350000n, blynt_code: '1700', status: 'confirmed', confidence: 100 }, // £3,500.00 matches F-10!
      { code: '1720', name: 'Fixtures Accumulated Deprec', type: 'Fixed Asset', debit_p: 0n, credit_p: 180000n, blynt_code: '1700', status: 'confirmed', confidence: 100 }, // £1,800.00 matches F-10!
      { code: '2000', name: 'Purchase Ledger Control Account', type: 'Current Liability', debit_p: 0n, credit_p: 168450000n, blynt_code: '2000', status: 'confirmed', confidence: 100 },
      { code: '2100', name: 'Accrued Operating Expenses', type: 'Current Liability', debit_p: 0n, credit_p: 45200000n, blynt_code: '2100', status: 'confirmed', confidence: 100 },
      { code: '2200', name: 'HM Revenue VAT Liability', type: 'Current Liability', debit_p: 0n, credit_p: 19820000n, blynt_code: '2200', status: 'suggested', confidence: 94 },
      { code: '2300', name: 'PAYE / NIC Control Account', type: 'Current Liability', debit_p: 0n, credit_p: 14200000n, blynt_code: '2300', status: 'suggested', confidence: 91 },
      { code: '3000', name: 'Ordinary Share Capital (£1 par)', type: 'Equity', debit_p: 0n, credit_p: 50000000n, blynt_code: '3000', status: 'confirmed', confidence: 100 },
      { code: '3100', name: 'Retained Earnings Prior Periods', type: 'Equity', debit_p: 0n, credit_p: 320000000n, blynt_code: '3100', status: 'confirmed', confidence: 100 },
      { code: '4000', name: 'Wholesale Commercial UK Sales', type: 'Revenue', debit_p: 0n, credit_p: 620000000n, blynt_code: '4000', status: 'confirmed', confidence: 100 },
      { code: '5000', name: 'Direct Component Materials', type: 'Cost of Sales', debit_p: 380000000n, credit_p: 0n, blynt_code: '5000', status: 'confirmed', confidence: 100 },
      { code: '6000', name: 'London Office Rent and Service', type: 'Expense', debit_p: 30000000n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 100 },
      { code: '6100', name: 'Gas and Electricity Utilities', type: 'Expense', debit_p: 4120000n, credit_p: 0n, blynt_code: '6100', status: 'confirmed', confidence: 100 },
      { code: '6900', name: 'Depreciation Charge on Tangibles', type: 'Expense', debit_p: 270000n, credit_p: 0n, blynt_code: '6900', status: 'confirmed', confidence: 100 }, // £2,700.00 matches F-10!
      { code: '6950', name: 'Loss on Disposal of Computer Equipment', type: 'Expense', debit_p: 15000n, credit_p: 0n, blynt_code: '6950', status: 'confirmed', confidence: 100 }, // £150.00 matches F-10!
      // Accounts requiring mapping attention (Needs you)
      { code: '7810', name: 'Special Transition Consulting Fee', type: 'Other', debit_p: 4200000n, credit_p: 0n, blynt_code: null, status: 'needs_you', confidence: 40 },
      { code: '7820', name: 'Special Warranty Reserve Contra', type: 'Other', debit_p: 0n, credit_p: 4200000n, blynt_code: null, status: 'needs_you', confidence: 35 },
    ];

    seedLines.forEach((line, idx) => {
      const lineId = `tbl_${idx + 1}`;
      this.tb_lines.push({
        id: lineId,
        snapshot_id: snapId,
        source_code: line.code,
        source_name: line.name,
        source_type: line.type,
        debit_p: line.debit_p.toString(),
        credit_p: line.credit_p.toString(),
      });

      const netBalance = line.debit_p - line.credit_p;
      const stat = getStatutoryDetails(line.blynt_code, line.name, line.type);
      const isSignMismatch = (stat.is_credit_area && netBalance > 0n) || (!stat.is_credit_area && netBalance < 0n);
      const gate = line.confidence >= 90 ? 'ready' : line.confidence >= 70 ? 'check' : 'exception';
      const aiReason = line.status === 'confirmed'
        ? `Rule: Matched pattern on ${line.name}`
        : line.confidence >= 90
        ? `Name contains '${line.name.split(' ')[0]}'; same mapping on 412 other clients`
        : line.confidence >= 70
        ? `Account type '${line.type}' suggests ${stat.schedule_ref ? `standard schedule ${stat.schedule_ref}` : stat.statutory_line}`
        : 'Multiple possible classifications found (confidence under 70%)';
      const evidence = line.status === 'confirmed'
        ? 'Client rule > Practice rule > Prior-year mapping'
        : 'Name pattern > Nominal code range > Transaction history';

      this.account_mappings.push({
        id: `map_${idx + 1}`,
        engagement_id: engId,
        source_code: line.code,
        source_name: line.name,
        source_type: line.type,
        balance_p: netBalance.toString(),
        blynt_code: line.blynt_code,
        status: line.status,
        confidence: line.confidence,
        method: line.status === 'confirmed' ? 'rule' : line.status === 'suggested' ? 'ai' : 'manual',
        statutory_line: stat.statutory_line,
        schedule_ref: stat.schedule_ref,
        cash_flow_category: stat.cash_flow_category,
        ai_reason: aiReason,
        evidence_used: evidence,
        sign_mismatch: isSignMismatch,
        gate: gate,
        ai_alternatives:
          line.status === 'needs_you'
            ? [
                { blynt_code: '6000', name: 'Office Rent & Rates', reason: 'Common administrative overhead classification', confidence: 45 },
                { blynt_code: '2100', name: 'Accruals', reason: 'Potential balance sheet contra provision', confidence: 35 },
              ]
            : undefined,
        confirmed_by: line.status === 'confirmed' ? 'usr_test_reviewer' : null,
        confirmed_at: line.status === 'confirmed' ? '2026-10-02T10:00:00Z' : null,
        comment_count: 0,
      });
    });

    // Seed for Acme Precision Engineering Ltd (eng_acme_fy26) matching redesign boards (6 unmapped, 12 suggested)
    seedLines.forEach((line, idx) => {
      const netBalance = line.debit_p - line.credit_p;
      const stat = getStatutoryDetails(line.blynt_code, line.name, line.type);
      const isSignMismatch = (stat.is_credit_area && netBalance > 0n) || (!stat.is_credit_area && netBalance < 0n);
      const gate = line.confidence >= 90 ? 'ready' : line.confidence >= 70 ? 'check' : 'exception';
      const aiReason = line.status === 'confirmed'
        ? `Rule: Matched pattern on ${line.name}`
        : line.confidence >= 90
        ? `Name contains '${line.name.split(' ')[0]}'; same mapping on 412 other clients`
        : line.confidence >= 70
        ? `Account type '${line.type}' suggests ${stat.schedule_ref ? `standard schedule ${stat.schedule_ref}` : stat.statutory_line}`
        : 'Multiple possible classifications found (confidence under 70%)';
      const evidence = line.status === 'confirmed'
        ? 'Client rule > Practice rule > Prior-year mapping'
        : 'Name pattern > Nominal code range > Transaction history';

      this.account_mappings.push({
        id: `map_acme_${idx + 1}`,
        engagement_id: acmeEngId,
        source_code: line.code,
        source_name: line.name,
        source_type: line.type,
        balance_p: netBalance.toString(),
        blynt_code: line.blynt_code,
        status: line.status,
        confidence: line.confidence,
        method: line.status === 'confirmed' ? 'rule' : line.status === 'suggested' ? 'ai' : 'manual',
        statutory_line: stat.statutory_line,
        schedule_ref: stat.schedule_ref,
        cash_flow_category: stat.cash_flow_category,
        ai_reason: aiReason,
        evidence_used: evidence,
        sign_mismatch: isSignMismatch,
        gate: gate,
        ai_alternatives:
          line.status === 'needs_you'
            ? [
                { blynt_code: '6000', name: 'Office Rent & Rates', reason: 'Common administrative overhead classification', confidence: 45 },
                { blynt_code: '2100', name: 'Accruals', reason: 'Potential balance sheet contra provision', confidence: 35 },
              ]
            : undefined,
        confirmed_by: line.status === 'confirmed' ? 'usr_test_reviewer' : null,
        confirmed_at: line.status === 'confirmed' ? '2026-10-02T10:00:00Z' : null,
        comment_count: 0,
      });
    });

    // Seed Acme Corp workpapers
    const f10Ref = this.workpapers.find((w) => w.id === 'wp_f10');
    if (f10Ref) {
      this.workpapers.push({
        ...f10Ref,
        id: 'wp_acme_f10',
        engagement_id: acmeEngId,
      });
    }
    const b10Ref = this.workpapers.find((w) => w.id === 'wp_b10');
    if (b10Ref) {
      this.workpapers.push({
        ...b10Ref,
        id: 'wp_acme_b10',
        engagement_id: acmeEngId,
      });
    }

    // Seed MB Therapy Ltd (eng_mb_therapy_fy26) Trial Balance & Mappings
    const mbSnapId = 'snap_mb_fy26';
    const mbRawData = JSON.stringify({
      company: 'MB Therapy Ltd',
      period: 'Year ended 30 Sep 2026',
      lines: 39,
      as_at: '2026-09-30',
      debits_p: '16475568',
      credits_p: '16475568',
    });
    const mbSnapHash = crypto.createHash('sha256').update(mbRawData).digest('hex');

    this.tb_snapshots.push({
      id: mbSnapId,
      engagement_id: mbEngId,
      source: 'csv',
      as_at: '2026-09-30',
      raw_json: mbRawData,
      sha256: mbSnapHash,
      created_by: 'usr_test_preparer',
      created_at: '2026-10-01T08:00:00Z',
    });

    const mbSeedLines: {
      code: string;
      name: string;
      type: string;
      debit_p: bigint;
      credit_p: bigint;
      blynt_code: string | null;
      status: 'suggested' | 'confirmed' | 'needs_you';
      confidence: number;
    }[] = [
      { code: '200', name: 'Sales', type: 'Revenue', debit_p: 0n, credit_p: 8711220n, blynt_code: '4000', status: 'confirmed', confidence: 100 },
      { code: '270', name: 'Interest Income', type: 'Revenue', debit_p: 0n, credit_p: 88735n, blynt_code: '4100', status: 'confirmed', confidence: 96 },
      { code: '325', name: 'Direct Expenses', type: 'Direct Costs', debit_p: 33212n, credit_p: 0n, blynt_code: '5000', status: 'confirmed', confidence: 98 },
      { code: '400', name: 'Advertising & Marketing', type: 'Overhead', debit_p: 139038n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '401', name: 'Audit & Accountancy fees', type: 'Overhead', debit_p: 275400n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '402', name: 'Staff wellfair', type: 'Overhead', debit_p: 65848n, credit_p: 0n, blynt_code: '6200', status: 'confirmed', confidence: 92 },
      { code: '405', name: 'Client entertainment', type: 'Overhead', debit_p: 0n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 90 },
      { code: '408', name: 'Cleaning', type: 'Overhead', debit_p: 32500n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 95 },
      { code: '412', name: 'Consulting', type: 'Overhead', debit_p: 69750n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 92 },
      { code: '416', name: 'Depreciation Expense', type: 'Overhead', debit_p: 4548n, credit_p: 0n, blynt_code: '6900', status: 'confirmed', confidence: 100 },
      { code: '420', name: 'Entertainment-100% business', type: 'Overhead', debit_p: 23404n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 92 },
      { code: '429', name: 'General Expenses', type: 'Overhead', debit_p: 102828n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '433', name: 'Insurance', type: 'Overhead', debit_p: 7668n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '437', name: 'Interest Paid', type: 'Overhead', debit_p: 29138n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '449', name: 'Motor Vehicle Expenses', type: 'Overhead', debit_p: 31771n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '463', name: 'IT Software and Consumables', type: 'Overhead', debit_p: 67270n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '469', name: 'Rent', type: 'Overhead', debit_p: 504000n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 100 },
      { code: '473', name: 'Repairs & Maintenance', type: 'Overhead', debit_p: 15801n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 95 },
      { code: '478', name: "Directors' Remuneration", type: 'Overhead', debit_p: 1254000n, credit_p: 0n, blynt_code: '6200', status: 'confirmed', confidence: 100 },
      { code: '479', name: 'Employers National Insurance', type: 'Overhead', debit_p: 0n, credit_p: 113100n, blynt_code: '2300', status: 'confirmed', confidence: 100 },
      { code: '480', name: 'Staff Training', type: 'Overhead', debit_p: 2700n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 95 },
      { code: '482', name: 'Pensions Costs', type: 'Overhead', debit_p: 30000n, credit_p: 0n, blynt_code: '6200', status: 'confirmed', confidence: 98 },
      { code: '485', name: 'Subscriptions', type: 'Overhead', debit_p: 92398n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 96 },
      { code: '489', name: 'Telephone & Internet', type: 'Overhead', debit_p: 155263n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '493', name: 'Travel - National', type: 'Overhead', debit_p: 30016n, credit_p: 0n, blynt_code: '6000', status: 'confirmed', confidence: 98 },
      { code: '500', name: 'Corporation Tax', type: 'Overhead', debit_p: 1202042n, credit_p: 0n, blynt_code: '2200', status: 'confirmed', confidence: 100 },
      { code: 'ACC-STARLING', name: 'Starling Business Account', type: 'Bank', debit_p: 809138n, credit_p: 0n, blynt_code: '1010', status: 'confirmed', confidence: 98 },
      { code: '610', name: 'Accounts Receivable', type: 'Current Asset', debit_p: 0n, credit_p: 0n, blynt_code: '1200', status: 'confirmed', confidence: 100 },
      { code: '625', name: 'Other Debtors - Unpaid Share Capital', type: 'Current Asset', debit_p: 100n, credit_p: 0n, blynt_code: '1200', status: 'confirmed', confidence: 95 },
      { code: '710', name: 'Office Equipment', type: 'Fixed Asset', debit_p: 22739n, credit_p: 0n, blynt_code: '1500', status: 'confirmed', confidence: 100 },
      { code: '711', name: 'Less Accumulated Depreciation on Office Equipment', type: 'Fixed Asset', debit_p: 0n, credit_p: 4548n, blynt_code: '1700', status: 'confirmed', confidence: 100 },
      { code: '835b', name: "Director's Loan Account - debtors", type: 'Current Asset', debit_p: 2424996n, credit_p: 0n, blynt_code: '1200', status: 'confirmed', confidence: 100 },
      { code: '800', name: 'Accounts Payable', type: 'Current Liability', debit_p: 0n, credit_p: 0n, blynt_code: '2000', status: 'confirmed', confidence: 100 },
      { code: '810', name: 'Income in Advance', type: 'Current Liability', debit_p: 0n, credit_p: 939000n, blynt_code: '2100', status: 'confirmed', confidence: 98 },
      { code: '825', name: 'PAYE Payable', type: 'Current Liability', debit_p: 0n, credit_p: 0n, blynt_code: '2300', status: 'confirmed', confidence: 100 },
      { code: '830', name: 'Provision for Corporation Tax', type: 'Current Liability', debit_p: 0n, credit_p: 2250533n, blynt_code: '2200', status: 'confirmed', confidence: 100 },
      { code: '950', name: 'Capital - x,xxx Ordinary Shares', type: 'Equity', debit_p: 0n, credit_p: 100n, blynt_code: '3000', status: 'confirmed', confidence: 100 },
      { code: '960', name: 'Retained Earnings', type: 'Equity', debit_p: 0n, credit_p: 4368332n, blynt_code: '3100', status: 'confirmed', confidence: 100 },
      { code: '961', name: 'Dividends current year', type: 'Equity', debit_p: 4750000n, credit_p: 0n, blynt_code: '3100', status: 'confirmed', confidence: 98 },
      { code: '962', name: 'Dividends b/f', type: 'Equity', debit_p: 4300000n, credit_p: 0n, blynt_code: '3100', status: 'confirmed', confidence: 100 },
    ];

    mbSeedLines.forEach((line, idx) => {
      const lineId = `tbl_mb_${idx + 1}`;
      this.tb_lines.push({
        id: lineId,
        snapshot_id: mbSnapId,
        source_code: line.code,
        source_name: line.name,
        source_type: line.type,
        debit_p: line.debit_p.toString(),
        credit_p: line.credit_p.toString(),
      });

      const netBalance = line.debit_p - line.credit_p;
      this.account_mappings.push({
        id: `map_mb_${idx + 1}`,
        engagement_id: mbEngId,
        source_code: line.code,
        source_name: line.name,
        source_type: line.type,
        balance_p: netBalance.toString(),
        blynt_code: line.blynt_code,
        status: line.status,
        confidence: line.confidence,
        method: line.status === 'confirmed' ? 'rule' : line.status === 'suggested' ? 'ai' : 'manual',
        ai_alternatives:
          line.status === 'suggested'
            ? [
                { blynt_code: '6000', name: 'Office Rent & Rates', reason: 'Common administrative overhead classification', confidence: 45 },
                { blynt_code: '2100', name: 'Accruals', reason: 'Potential balance sheet contra provision', confidence: 35 },
              ]
            : undefined,
        confirmed_by: line.status === 'confirmed' ? 'usr_test_reviewer' : null,
        confirmed_at: line.status === 'confirmed' ? '2026-10-02T10:00:00Z' : null,
        comment_count: 0,
      });
    });

    // Create MB Therapy workpapers
    this.createEngagementWorkpapers(mbEngId, 'Small company (FRS 102 1A)');

    // Customize B-10 Bank Rec for MB Therapy (Starling Bank £8,091.38)
    const mbB10 = this.workpapers.find((w) => w.id === `wp_${mbEngId}_b10`);
    if (mbB10) {
      mbB10.status = 'prepared';
      mbB10.data_json = {
        title: 'Bank reconciliation - Starling Business Account',
        bank_name: 'Starling Business Account',
        ledger_balance_p: '809138', // £8,091.38
        statement_p: '809138', // £8,091.38
        bank_balance_p: '809138',
        outstanding_cheques_total_p: '0',
        deposits_in_transit_total_p: '0',
        adjusted_bank_balance_p: '809138',
        difference_p: '0',
        sections: [
          { id: 'sec_less', label: 'Less: unpresented cheques', sign: '-1', rows: [] },
          { id: 'sec_add', label: 'Add: uncredited lodgements', sign: '1', rows: [] },
        ],
        ties: true,
      };

      // Attachment for Starling statement to pass 'statement_evidence' check
      const starlingSha = crypto.createHash('sha256').update('STARLING_STATEMENT_SEPT_2026').digest('hex');
      const starlingAttId = 'att_stmt_starling';
      this.attachments.push({
        id: starlingAttId,
        engagement_id: mbEngId,
        workpaper_id: mbB10.id,
        file_key: 'uploads/mb_therapy_fy26/Starling_Statement_Sept_2026.pdf',
        filename: 'Starling_Statement_Sept_2026.pdf',
        mime: 'application/pdf',
        size: 89450,
        sha256: starlingSha,
        category: 'Statement',
        is_permanent: false,
        uploaded_by: 'usr_test_preparer',
        uploaded_by_name: 'Test Preparer',
        uploaded_at: '2026-10-02T09:15:00Z',
        links: [{ attachment_id: starlingAttId, anchor_json: { kind: 'row', table: 'schedule', row: 'statement' } }],
      });
    }

    // Customize F-10 Fixed Assets for MB Therapy (Office Equipment £227.39 cost, £45.48 deprec)
    const mbF10 = this.workpapers.find((w) => w.id === `wp_${mbEngId}_f10`);
    if (mbF10) {
      mbF10.status = 'prepared';
      mbF10.data_json = {
        objective: 'Substantive testing of office equipment under FRS 102 section 17.',
        classes: [
          {
            id: 'c1',
            name: 'Office Equipment',
            cost_opening_p: '22739',
            cost_opening_is_py: true,
            cost_additions_p: '0',
            cost_disposals_p: '0',
            cost_closing_p: '22739',
            deprec_opening_p: '0',
            deprec_opening_is_py: true,
            charge_p: '4548',
            deprec_charge_p: '4548',
            deprec_disposals_p: '0',
            deprec_closing_p: '4548',
            nbv_this_year_p: '18191',
            nbv_prior_year_p: '22739',
            deprec_method: 'Straight line',
            rate: 20,
            deprec_rate: '20%',
          },
        ],
        movements: [],
        proof_in_total: {
          total_expected_charge_p: '4548',
          actual_charge_p: '4548',
          variance_p: '0',
        },
        conclusion: {
          text: 'Office equipment cost agrees to opening balance (£227.39). Depreciation of £45.48 calculated at 20% agrees to trial balance nominal 416 with zero variance.',
          ai_draft: '✦ verified: Office equipment depreciation agrees to TB 416 (£45.48). NBV is £181.91.',
          ai_status: 'draft',
        },
      };
    }

    // View Preferences
    this.view_prefs.push({
      user_id: 'usr_test_reviewer',
      scope: 'user',
      key: 'general_view',
      value_json: {
        showPriorYear: true,
        showChangePercent: true,
        showSource: true,
        showTickmarks: true,
        rowSpacing: 'comfortable',
        textSize: 'M',
        highContrast: false,
      },
    });

    // Initial audit log
    this.logAudit(
      firmId,
      { id: 'usr_test_preparer', name: 'Test Preparer', role: 'preparer' },
      'CREATE_SNAPSHOT',
      'tb_snapshots',
      snapId,
      null,
      { source: 'csv', filename: 'Harlow_Trial_Balance_FY26.csv', sha256: snapHash }
    );
    this.logAudit(
      firmId,
      { id: 'usr_test_preparer', name: 'Test Preparer', role: 'preparer' },
      'CREATE_SNAPSHOT',
      'tb_snapshots',
      mbSnapId,
      null,
      { source: 'csv', filename: 'mb_therapy_trial_balance.csv', sha256: mbSnapHash }
    );

    const now = new Date().toISOString();

    // Seed v1.1 Learned Rules (DAT-09)
    this.learned_rules.push(
      {
        id: 'rule_1',
        firm_id: firmId,
        scope: 'practice',
        type: 'mapping',
        client_id: null,
        supplier_name: 'British Telecom',
        pattern: 'telecom|telephone|broadband|bt',
        target_value: '7500 Telephone and internet',
        explanation: 'Default practice mapping for UK telecom providers',
        created_by: 'usr_test_manager',
        created_by_name: 'Test Manager',
        active: true,
        times_used: 42,
        created_at: now,
      },
      {
        id: 'rule_2',
        firm_id: firmId,
        scope: 'practice',
        type: 'mapping',
        client_id: null,
        supplier_name: 'Companies House',
        pattern: 'companies house|confirmation statement',
        target_value: '7600 Legal & professional fees',
        explanation: 'Default practice mapping for statutory filing fees',
        created_by: 'usr_test_manager',
        created_by_name: 'Test Manager',
        active: true,
        times_used: 19,
        created_at: now,
      },
      {
        id: 'rule_3',
        firm_id: firmId,
        scope: 'client',
        type: 'proposal',
        client_id: 'cli_harlow',
        supplier_name: 'Commercial Properties Ltd',
        pattern: 'rent unit 4',
        target_value: 'C-20 Prepayments',
        explanation: 'Quarterly in advance rent adjustment',
        created_by: 'usr_test_preparer',
        created_by_name: 'Test Preparer',
        active: true,
        times_used: 4,
        created_at: now,
      }
    );

    // Seed v1.1 AI Action Logs (AUD-03)
    this.ai_action_logs.push(
      {
        id: 'act_1',
        firm_id: firmId,
        engagement_id: engId,
        output_type: 'mapping',
        model_version: 'claude-3-5-sonnet-20241022',
        inputs_used: 'Account 1200 Bank Account mapped to Cash & Cash Equivalents',
        confidence: 96,
        outcome: 'accepted',
        decided_by: 'usr_test_preparer',
        decided_by_name: 'Test Preparer',
        decided_at: now,
      },
      {
        id: 'act_2',
        firm_id: firmId,
        engagement_id: engId,
        output_type: 'extraction',
        model_version: 'claude-3-5-sonnet-20241022',
        inputs_used: 'Dell Technologies Invoice #99218 extracted additions cost £1,200',
        confidence: 94,
        outcome: 'accepted',
        decided_by: 'usr_test_preparer',
        decided_by_name: 'Test Preparer',
        decided_at: now,
      },
      {
        id: 'act_3',
        firm_id: firmId,
        engagement_id: engId,
        output_type: 'finding',
        model_version: 'claude-3-5-sonnet-20241022',
        inputs_used: 'Quarterly reasonableness test on Box 1 output VAT',
        confidence: 92,
        outcome: 'accepted',
        decided_by: 'usr_test_manager',
        decided_by_name: 'Test Manager',
        decided_at: now,
      }
    );

    // Seed v1.1 AI Review Findings (ANL-04)
    this.ai_review_findings.push(
      {
        id: 'find_1',
        workpaper_id: 'wp_harlow_b10',
        schedule_ref: 'B-10',
        severity: 'info',
        title: 'Bank feed agrees to statement',
        explanation: 'Closing balance of £48,291.50 matches uploaded PDF bank statement with no uncleared items older than 30 days.',
        detail: 'Closing balance of £48,291.50 matches uploaded PDF bank statement with no uncleared items older than 30 days.',
        status: 'fixed',
        feedback: 'useful',
        created_at: now,
      },
      {
        id: 'find_2',
        workpaper_id: 'wp_harlow_f10',
        schedule_ref: 'F-10',
        severity: 'info',
        title: 'Depreciation policy check',
        explanation: 'Depreciation charge of £45.48 calculated at 20% on office equipment matches prior year policy with zero variance.',
        detail: 'Depreciation charge of £45.48 calculated at 20% on office equipment matches prior year policy with zero variance.',
        status: 'fixed',
        feedback: 'useful',
        created_at: now,
      },
      {
        id: 'find_3',
        workpaper_id: 'wp_harlow_s10',
        schedule_ref: 'S-10',
        severity: 'info',
        title: 'Zero tolerance check passed',
        explanation: 'Suspense, clearing and wages control accounts are nil at period end. No unexplained postings detected.',
        detail: 'Suspense, clearing and wages control accounts are nil at period end. No unexplained postings detected.',
        status: 'open',
        feedback: 'useful',
        created_at: now,
      }
    );

    // Seed DAT-07 Ledger Transactions for Harlow Food Group (Stage A Step 3)
    const harlowEngId = 'eng_harlow_fy26';
    this.transactions.push(
      // 1010 Barclays Operating Account
      {
        id: 'tx_1010_1',
        engagement_id: harlowEngId,
        account_code: '1010',
        account_name: 'Barclays Operating Account',
        date: '2026-09-30',
        contact: 'Harlow Wholesale Cust #402',
        description: 'Customer direct transfer bulk settlement',
        amount_p: '850000000', // £850,000.00 Dr
        vat_p: '0',
        gross_p: '850000000',
        source: 'Xero',
        external_id: 'xero_tx_9011',
        external_url: 'https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=9011',
      },
      {
        id: 'tx_1010_2',
        engagement_id: harlowEngId,
        account_code: '1010',
        account_name: 'Barclays Operating Account',
        date: '2026-09-28',
        contact: 'Crown Commercial Landlords Ltd',
        description: 'Quarterly London office rent & facilities',
        amount_p: '-10000000', // -£100,000.00 Cr
        vat_p: '2000000',
        gross_p: '-12000000',
        source: 'Xero',
        external_id: 'xero_tx_9012',
        external_url: 'https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=9012',
        attachment_name: 'Office_Rent_Invoice_Q3.pdf',
        attachment_url: '/demo/Office_Rent_Invoice_Q3.pdf',
      },
      {
        id: 'tx_1010_3',
        engagement_id: harlowEngId,
        account_code: '1010',
        account_name: 'Barclays Operating Account',
        date: '2026-09-25',
        contact: 'British Gas Business',
        description: 'Monthly warehouse electricity & gas utilities',
        amount_p: '-4120000', // -£41,200.00 Cr
        vat_p: '824000',
        gross_p: '-4944000',
        source: 'Xero',
        external_id: 'xero_tx_9013',
        external_url: 'https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=9013',
        attachment_name: 'British_Gas_Sept2026.pdf',
      },
      {
        id: 'tx_1010_4',
        engagement_id: harlowEngId,
        account_code: '1010',
        account_name: 'Barclays Operating Account',
        date: '2026-09-20',
        contact: 'HMRC Shipley',
        description: 'PAYE / NIC Settlement Month 5',
        amount_p: '-14200000', // -£142,000.00 Cr
        vat_p: '0',
        gross_p: '-14200000',
        source: 'Xero',
        external_id: 'xero_tx_9014',
        external_url: 'https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=9014',
      },
      {
        id: 'tx_1010_5',
        engagement_id: harlowEngId,
        account_code: '1010',
        account_name: 'Barclays Operating Account',
        date: '2026-09-18',
        contact: 'Caterpillar Equipment UK',
        description: 'Warehouse plant machinery addition - forklift lift arm',
        amount_p: '-8500000', // -£85,000.00 Cr
        vat_p: '1700000',
        gross_p: '-10200000',
        source: 'Xero',
        external_id: 'xero_tx_9015',
        external_url: 'https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=9015',
        attachment_name: 'Forklift_Invoice_CAT.pdf',
      },
      // 1200 Sales Ledger Control Account
      {
        id: 'tx_1200_1',
        engagement_id: harlowEngId,
        account_code: '1200',
        account_name: 'Sales Ledger Control Account',
        date: '2026-09-29',
        contact: "Sainsbury's Supermarkets Ltd",
        description: 'Inv #INV-2026-881 Wholesale gourmet preserves',
        amount_p: '120000000', // £1,200,000.00 Dr
        vat_p: '24000000',
        gross_p: '144000000',
        source: 'Xero',
        external_id: 'xero_tx_881',
        external_url: 'https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=881',
        attachment_name: 'Sainsburys_Preserves_Inv881.pdf',
      },
      {
        id: 'tx_1200_2',
        engagement_id: harlowEngId,
        account_code: '1200',
        account_name: 'Sales Ledger Control Account',
        date: '2026-09-25',
        contact: 'Waitrose & Partners',
        description: 'Inv #INV-2026-882 Organic condiment supply contract',
        amount_p: '85000000', // £850,000.00 Dr
        vat_p: '17000000',
        gross_p: '102000000',
        source: 'Xero',
        external_id: 'xero_tx_882',
        external_url: 'https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=882',
        attachment_name: 'Waitrose_Supply_Inv882.pdf',
      },
      {
        id: 'tx_1200_3',
        engagement_id: harlowEngId,
        account_code: '1200',
        account_name: 'Sales Ledger Control Account',
        date: '2026-09-15',
        contact: 'Marks & Spencer PLC',
        description: 'Inv #INV-2026-879 Artisan confectionery quarterly order',
        amount_p: '43950000', // £439,500.00 Dr
        vat_p: '8790000',
        gross_p: '52740000',
        source: 'Xero',
        external_id: 'xero_tx_879',
        external_url: 'https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=879',
      },
      // 1500 Plant and Warehouse Machinery Cost
      {
        id: 'tx_1500_1',
        engagement_id: harlowEngId,
        account_code: '1500',
        account_name: 'Plant and Warehouse Machinery Cost',
        date: '2026-08-15',
        contact: 'Tetra Pak Processing Systems Ltd',
        description: 'Automated bottling & aseptic pasteurisation line (CapEx)',
        amount_p: '450000000', // £4,500,000.00 Dr
        vat_p: '90000000',
        gross_p: '540000000',
        source: 'Xero',
        external_id: 'xero_tx_7701',
        external_url: 'https://go.xero.com/AccountsPayable/View.aspx?invoiceID=7701',
        attachment_name: 'TetraPak_Contract_Signed.pdf',
      },
      {
        id: 'tx_1500_2',
        engagement_id: harlowEngId,
        account_code: '1500',
        account_name: 'Plant and Warehouse Machinery Cost',
        date: '2026-09-02',
        contact: 'Apple Store Regent Street',
        description: 'MacBook Pro M3 Max for Quality Assurance head',
        amount_p: '720000', // £7,200.00 Dr
        vat_p: '144000',
        gross_p: '864000',
        source: 'Xero',
        external_id: 'xero_tx_7702',
        external_url: 'https://go.xero.com/AccountsPayable/View.aspx?invoiceID=7702',
        attachment_name: 'Apple_Store_Inv_7702.pdf',
      },
      // 2000 Purchase Ledger Control Account
      {
        id: 'tx_2000_1',
        engagement_id: harlowEngId,
        account_code: '2000',
        account_name: 'Purchase Ledger Control Account',
        date: '2026-09-28',
        contact: 'Bramley Glass Packaging Ltd',
        description: 'Glass containers batch #GB-401 for food packaging',
        amount_p: '-64200000', // -£642,000.00 Cr
        vat_p: '12840000',
        gross_p: '-77040000',
        source: 'Xero',
        external_id: 'xero_tx_6601',
        external_url: 'https://go.xero.com/AccountsPayable/View.aspx?invoiceID=6601',
        attachment_name: 'Bramley_Glass_Inv_6601.pdf',
      },
      {
        id: 'tx_2000_2',
        engagement_id: harlowEngId,
        account_code: '2000',
        account_name: 'Purchase Ledger Control Account',
        date: '2026-09-22',
        contact: 'Kentish Fruit Growers Co-op',
        description: 'Bulk autumn berry harvest deliveries (Zero rated food)',
        amount_p: '-104250000', // -£1,042,500.00 Cr
        vat_p: '0',
        gross_p: '-104250000',
        source: 'Xero',
        external_id: 'xero_tx_6602',
        external_url: 'https://go.xero.com/AccountsPayable/View.aspx?invoiceID=6602',
        attachment_name: 'Kentish_Fruit_Inv_6602.pdf',
      },
      // 6000 London Office Rent
      {
        id: 'tx_6000_1',
        engagement_id: harlowEngId,
        account_code: '6000',
        account_name: 'London Office Rent and Service',
        date: '2026-09-01',
        contact: 'Crown Commercial Landlords Ltd',
        description: 'Head office premises rent - Sept 2026',
        amount_p: '10000000', // £100,000.00 Dr
        vat_p: '2000000',
        gross_p: '12000000',
        source: 'Xero',
        external_id: 'xero_tx_6001',
        external_url: 'https://go.xero.com/AccountsPayable/View.aspx?invoiceID=6001',
      },
      {
        id: 'tx_6000_2',
        engagement_id: harlowEngId,
        account_code: '6000',
        account_name: 'London Office Rent and Service',
        date: '2026-08-01',
        contact: 'Crown Commercial Landlords Ltd',
        description: 'Head office premises rent - Aug 2026',
        amount_p: '10000000', // £100,000.00 Dr
        vat_p: '2000000',
        gross_p: '12000000',
        source: 'Xero',
        external_id: 'xero_tx_6002',
        external_url: 'https://go.xero.com/AccountsPayable/View.aspx?invoiceID=6002',
      },
      {
        id: 'tx_6000_3',
        engagement_id: harlowEngId,
        account_code: '6000',
        account_name: 'London Office Rent and Service',
        date: '2026-07-01',
        contact: 'Crown Commercial Landlords Ltd',
        description: 'Head office premises rent - Jul 2026',
        amount_p: '10000000', // £100,000.00 Dr
        vat_p: '2000000',
        gross_p: '12000000',
        source: 'Xero',
        external_id: 'xero_tx_6003',
        external_url: 'https://go.xero.com/AccountsPayable/View.aspx?invoiceID=6003',
      },
      // 7810 Special Transition Consulting Fee
      {
        id: 'tx_7810_1',
        engagement_id: harlowEngId,
        account_code: '7810',
        account_name: 'Special Transition Consulting Fee',
        date: '2026-09-15',
        contact: 'Vanguard Advisory Partners',
        description: 'Transition and process audit advisory fee',
        amount_p: '4200000', // £42,000.00 Dr
        vat_p: '840000',
        gross_p: '5040000',
        source: 'Xero',
        external_id: 'xero_tx_7810',
        external_url: 'https://go.xero.com/AccountsPayable/View.aspx?invoiceID=7810',
        attachment_name: 'Vanguard_Advisory_Invoice.pdf',
      },
      // 7820 Special Warranty Reserve Contra
      {
        id: 'tx_7820_1',
        engagement_id: harlowEngId,
        account_code: '7820',
        account_name: 'Special Warranty Reserve Contra',
        date: '2026-09-30',
        contact: 'Internal Entry',
        description: 'Annual warranty indemnity provision contra',
        amount_p: '-4200000', // -£42,000.00 Cr
        vat_p: '0',
        gross_p: '-4200000',
        source: 'Xero',
        external_id: 'xero_tx_7820',
      }
    );

    if (!withDemo) this.clearWorkspaceData();
  }
}

// Global Singleton
const globalDb = new Database();
export const db = globalDb;
