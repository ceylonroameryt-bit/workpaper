/**
 * Blynt Workpapers Data Models
 * Exactly matches the database schema & ground rules.
 */

export type UserRole = 'preparer' | 'reviewer' | 'manager' | 'partner' | 'admin';

export type StatusKey =
  | 'not_started'
  | 'in_progress'
  | 'prepared'
  | 'signed_off'
  | 'needs_you'
  | 'stale'
  | 'waiting_on_client'
  | 'ai_suggestion';

export interface StatusMeta {
  key: StatusKey;
  symbol: string;
  label: string;
  colorClass: string;
  bgClass: string;
}

export const STATUS_DEFINITIONS: Record<StatusKey, StatusMeta> = {
  not_started: {
    key: 'not_started',
    symbol: '○',
    label: 'Not started',
    colorClass: 'text-[#5B6478]',
    bgClass: 'bg-[#F4F5F7]',
  },
  in_progress: {
    key: 'in_progress',
    symbol: '◑',
    label: 'In progress',
    colorClass: 'text-[#1D4E89]',
    bgClass: 'bg-[#EAF5FC]',
  },
  prepared: {
    key: 'prepared',
    symbol: '●',
    label: 'Prepared',
    colorClass: 'text-[#102654]',
    bgClass: 'bg-[#EAF5FC]',
  },
  signed_off: {
    key: 'signed_off',
    symbol: '✓',
    label: 'Signed off',
    colorClass: 'text-[#0B6B52]',
    bgClass: 'bg-[#E6F4EF]',
  },
  needs_you: {
    key: 'needs_you',
    symbol: '!',
    label: 'Needs you',
    colorClass: 'text-[#B8432F]',
    bgClass: 'bg-[#FFF1EE]',
  },
  stale: {
    key: 'stale',
    symbol: '⚠',
    label: 'Stale',
    colorClass: 'text-[#6B4700]',
    bgClass: 'bg-[#FFF4DB]',
  },
  waiting_on_client: {
    key: 'waiting_on_client',
    symbol: '◷',
    label: 'Waiting on client',
    colorClass: 'text-[#5B6478]',
    bgClass: 'bg-[#F4F5F7]',
  },
  ai_suggestion: {
    key: 'ai_suggestion',
    symbol: '✦',
    label: 'AI suggestion',
    colorClass: 'text-[#A23A27]',
    bgClass: 'bg-[#FFF1EE]',
  },
};

export type CompanyType =
  | 'Sole trader'
  | 'Partnership'
  | 'LLP (FRS 102 + LLP SORP)'
  | 'Micro-entity (FRS 105)'
  | 'Small company (FRS 102 1A)'
  | 'Medium/large (FRS 102)'
  | 'IFRS company/group'
  | 'Charity (SORP)'
  | 'Academy trust';

export type DataSource = 'blynt' | 'xero' | 'quickbooks' | 'csv' | 'freeagent' | 'sage';

export interface Firm {
  id: string;
  name: string;
  created_at: string;
  owner_user_id?: string; // the person who created the firm; may run set-up and invite
  // Practice onboarding wizard; absent on firms created before it existed (treated as done)
  onboarding?: { step: number; completed_at: string | null };
  profile?: PracticeProfile;
  // ADM-02 practice settings; DAT-08 gate thresholds per AI output type
  settings?: {
    gate?: Partial<Record<AiActionLogItem['output_type'], { ready?: number; check?: number; auto_accept?: boolean }>>;
    work?: PracticeWorkProfile;
    defaults?: PracticeDefaults;
  };
}

export type Regulator = 'ICAEW' | 'ACCA' | 'ICAS' | 'CAI' | 'AAT' | 'CIMA' | 'ATT' | 'CIOT';

export interface PracticeProfile {
  legal_name: string;
  trading_name?: string;
  structure: 'llp' | 'ltd' | 'partnership' | 'sole';
  company_number?: string;
  address_line: string;
  postcode: string;
  jurisdiction: 'england_wales' | 'scotland' | 'northern_ireland';
  regulator: Regulator;
  registration_number?: string;
  vat_registered?: boolean;
  vat_number?: string;
  phone?: string;
  logo_attachment_id?: string;
}

export interface PracticeWorkProfile {
  standards: ('FRS 105' | 'FRS 102 1A' | 'FRS 102' | 'IFRS' | 'Charities SORP')[];
  services: ('year_end' | 'management' | 'vat' | 'payroll' | 'quarterly' | 'corporation_tax')[];
  software: ('xero' | 'qbo' | 'sage' | 'freeagent' | 'spreadsheets')[];
  client_count: '1-50' | '51-200' | '201-500' | '500+';
  team_size: '1' | '2-10' | '11-50' | '50+';
}

export interface PracticeDefaults {
  year_end: 'per_client' | '03-31' | '12-31';
  standard: 'FRS 105' | 'FRS 102 1A' | 'FRS 102';
  tolerance_p: string; // pence; differences below this count as reconciled
  review_threshold_p: string; // pence; movements above this are flagged
  signoff_levels: 1 | 2 | 3; // preparer / + reviewer / + partner
}

export interface User {
  id: string;
  email: string;
  name: string;
  initials: string;
  title: string;
  mfa_enabled: boolean;
  avatar?: string;
}

export interface Membership {
  user_id: string;
  firm_id: string;
  role: UserRole;
  client_ids?: string[]; // ADM-01: clients a non-partner may see; absent = all
}

// ADM-01: invitation to join a practice. Server-only (the token hash never reaches the browser).
export interface Invite {
  id: string;
  firm_id: string;
  email: string;
  name: string;
  role: UserRole;
  client_ids?: string[];
  token_hash: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
}

export interface Client {
  id: string;
  firm_id?: string;
  name: string;
  company_no?: string;
  company_type?: CompanyType;
  year_end?: string;
  yearEnd?: string;
  data_source?: DataSource;
  reconnect_needed?: boolean;
  industry?: string;
  framework?: string;
  currentEngagementId?: string;
  // Archived clients drop out of everyday lists and their files become read-only; nothing is deleted
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;
  [key: string]: any;
}

export interface Engagement {
  id: string;
  client_id: string;
  firm_id: string;
  period_start: string;
  period_end: string;
  framework: string;
  template_pack_id: string;
  status: 'planning' | 'fieldwork' | 'review' | 'locked';
  locked_at: string | null;
  locked_by?: string | null;
  prior_engagement_id: string | null;
}

export interface BlyntAccount {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Cost of Sales' | 'Overhead';
  normal_balance: 'Debit' | 'Credit';
  lead_letter: string; // e.g. "A", "B", "C", "D", "E", "F", "K", "Q", "Z"
  is_control: boolean;
  is_system: boolean;
  used_by_count?: number;
}

export interface MappingList {
  id: string;
  firm_id: string;
  company_type: CompanyType;
  version: number;
  status: 'draft' | 'published';
  rule_count?: number;
  clients_using?: number;
}

export interface MappingRule {
  id: string;
  mapping_list_id: string;
  source_system: DataSource;
  source_code: string;
  source_name_pattern: string;
  blynt_code: string;
  scope: 'client' | 'firm';
}

export interface TbSnapshot {
  id: string;
  engagement_id: string;
  source: DataSource;
  as_at: string;
  raw_json: string;
  sha256: string;
  created_by: string;
  created_at: string;
  prior_snapshot_id?: string | null;
  changes?: TbSnapshotDiff[]; // DAT-06: movements since the previous snapshot (late postings)
}

export interface TbLine {
  id: string;
  snapshot_id: string;
  source_code: string;
  source_name: string;
  source_type: string;
  debit_p: string; // stored as string for exact bigint serialization
  credit_p: string;
}

export interface AccountMapping {
  id: string;
  engagement_id: string;
  source_code: string;
  source_name: string;
  source_type: string;
  balance_p: string; // Net balance in pence (string for bigint)
  blynt_code: string | null;
  status: 'suggested' | 'confirmed' | 'needs_you';
  confidence: number; // 0 - 100
  method: 'rule' | 'ai' | 'manual';
  statutory_line?: string;
  schedule_ref?: string;
  cash_flow_category?: string;
  ai_reason?: string;
  evidence_used?: string;
  sign_mismatch?: boolean;
  gate?: 'ready' | 'check' | 'exception';
  ai_alternatives?: { blynt_code: string; name: string; reason: string; confidence: number }[];
  confirmed_by: string | null;
  confirmed_at: string | null;
  comment_count?: number;
}

export interface AdjustmentLine {
  id: string;
  adjustment_id: string;
  blynt_code: string;
  debit_p: string; // string for bigint
  credit_p: string;
  narrative?: string;
}

export interface Adjustment {
  id: string;
  engagement_id: string;
  ref: string; // e.g. AJE-001
  narrative: string;
  status: 'proposed' | 'approved' | 'posted';
  proposed_by: string;
  proposed_by_name: string;
  approved_by: string | null;
  approved_by_name?: string | null;
  created_at: string;
  lines: AdjustmentLine[];
}

export interface Template {
  id: string;
  key: string;
  name: string;
  area_letter: string;
  company_types: CompanyType[];
  version: number;
  schema_json: Record<string, any>;
  status: 'published' | 'draft';
  used_by_count?: number;
  is_builtin?: boolean;
}

export interface Workpaper {
  id: string;
  engagement_id: string;
  ref: string; // e.g. "F-10", "B-10"
  template_id: string;
  template_version: number;
  data_json: Record<string, any>;
  status: StatusKey;
  rolled_from_workpaper_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Procedure {
  id: string;
  workpaper_id: string;
  text: string;
  done_by: string | null;
  done_at: string | null;
  not_applicable_reason: string | null;
}

export type AnchorJson =
  | { kind: 'cell'; section: string; row: string; col: string }
  | { kind: 'text'; section: string; start: number; end: number }
  | { kind: 'row'; table: string; row: string }
  | { kind: 'file'; attachment_id: string }
  | { kind: 'paper' };

export interface Comment {
  id: string;
  workpaper_id: string;
  type: 'comment' | 'review_note' | 'client_query';
  anchor_json: AnchorJson;
  anchor_summary?: string;
  status: 'open' | 'resolved';
  created_by: string;
  created_by_name: string;
  created_at: string;
  resolved_by: string | null;
  resolved_by_name?: string | null;
  resolved_at?: string | null;
  body: string;
  replies?: CommentReply[];
}

export interface CommentReply {
  id: string;
  comment_id: string;
  body: string;
  mentions: string[];
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export type AttachmentCategory =
  | 'Invoice'
  | 'Register'
  | 'Statement'
  | 'Photo'
  | 'Board minute'
  | 'Valuation'
  | 'Confirmation'
  | 'From client'
  | 'Other';

export interface Attachment {
  id: string;
  engagement_id: string;
  workpaper_id: string | null;
  file_key: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  category: AttachmentCategory;
  is_permanent: boolean;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  links?: AttachmentLink[];
}

export interface AttachmentLink {
  attachment_id: string;
  anchor_json: AnchorJson;
}

export interface Signoff {
  id: string;
  workpaper_id: string;
  role: 'preparer' | 'reviewer' | 'partner';
  user_id: string;
  user_name: string;
  signed_at: string;
  content_hash: string;
  stale_at: string | null;
  stale_reason?: string | null;
}

export interface ViewPrefs {
  user_id: string;
  scope: 'user' | 'firm';
  key: string;
  value_json: {
    showPriorYear?: boolean;
    showChangePercent?: boolean;
    showSource?: boolean;
    showTickmarks?: boolean;
    rowSpacing?: 'comfortable' | 'compact';
    textSize?: 'S' | 'M' | 'L';
    highContrast?: boolean;
    inactivityTimeoutMinutes?: number;
    selectedClientId?: string;
    onboardingCompleted?: boolean;
    primaryCompanyType?: string;
    jurisdiction?: string;
    [key: string]: any;
  };
}

export interface AuditLog {
  id: string;
  firm_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  entity: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  at: string;
  reason?: string | null; // AUD-01: why, where the action asks for one (unreview, unlock, corrections)
}

export interface AiLineage {
  id: string;
  entity: string;
  entity_id: string;
  field: string;
  source_attachment_id: string | null;
  page: number | null;
  model: string;
  prompt_version: string;
  accepted_by: string;
  accepted_at: string;
}

// ==========================================
// v1.1 SPECIFICATION MODELS (Build Order v1.1)
// ==========================================

export type ConfidenceGate = 'Ready' | 'Check' | 'Exception';

export interface EvidenceLink {
  title: string;
  url?: string;
  attachment_id?: string;
  page?: number;
  clause?: string;
}

export interface AiOutputMeta {
  confidence: number; // 0 - 100
  gate: ConfidenceGate;
  reason: string;
  evidence_links?: EvidenceLink[];
  auto_accepted?: boolean;
  source_type?: string;
}

export type RuleScope = 'supplier' | 'client' | 'practice';
export type RuleType = 'mapping' | 'extraction' | 'tagging' | 'proposal' | 'review' | 'na_choice';

export interface LearnedRule {
  id: string;
  firm_id: string;
  client_id?: string | null;
  supplier_name?: string | null;
  type: RuleType;
  scope: RuleScope;
  pattern: string;
  target_value: string;
  explanation?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  times_used: number;
  active: boolean;
  approved_by_manager?: boolean;
}

export interface AiActionLogItem {
  id: string;
  firm_id: string;
  engagement_id: string;
  output_type: 'mapping' | 'extraction' | 'journal' | 'finding' | 'note' | 'commentary';
  item_ref?: string;
  inputs_used: string;
  confidence: number;
  model_version: string;
  outcome: 'accepted' | 'edited' | 'rejected' | 'auto_accepted';
  decided_by: string;
  decided_by_name: string;
  decided_at: string;
  rejection_reason?: string;
}

export interface AiReviewFinding {
  id: string;
  workpaper_id: string;
  engagement_id?: string;
  schedule_ref?: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  explanation?: string;
  detail?: string;
  evidence_links?: EvidenceLink[];
  status: 'open' | 'fixed' | 'dismissed';
  dismiss_reason?: string;
  rated_useful?: boolean | null;
  feedback?: 'useful' | 'not_useful' | null;
  created_at: string;
}

export interface ScheduleVersion {
  id: string;
  workpaper_id: string;
  version_label?: string;
  version_number?: number;
  signed_by?: string;
  signed_by_name?: string;
  created_by_user_id?: string;
  created_by_name?: string;
  role?: 'preparer' | 'reviewer' | 'partner';
  data_snapshot?: Record<string, any>;
  snapshot_data_json?: Record<string, any>;
  status_at_save?: StatusKey;
  status?: string;
  created_at: string;
  reason?: string;
}

export interface DisclosureChecklistItem {
  id: string;
  engagement_id: string;
  section:
    | 'accounting_policies'
    | 'balance_sheet_notes'
    | 'pl_notes'
    | 'directors'
    | 'related_parties'
    | 'commitments'
    | 'post_balance_sheet'
    | 'going_concern';
  question: string;
  standard_ref: string;
  ai_suggested_answer: 'Yes' | 'No' | 'N/A';
  ai_confidence: number;
  ai_reason: string;
  confirmed_answer: 'Yes' | 'No' | 'N/A' | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  manager_override_reason?: string | null;
  linked_note_id?: string | null;
}

export interface StatutoryNoteItem {
  id: string;
  engagement_id: string;
  note_number: number;
  title: string;
  standard_ref: string;
  why_included: string;
  narrative_html: string;
  figures: { label: string; amount_p: string; workpaper_ref?: string }[];
  status: 'draft' | 'reviewed' | 'updated_needs_review';
  is_custom_wording: boolean;
}

// Stage A DAT-07: Drill down to transactions
export interface LedgerTransaction {
  id: string;
  engagement_id: string;
  account_code: string;
  account_name: string;
  date: string;
  contact: string;
  description: string;
  amount_p: string; // Net pence: debit positive, credit negative
  vat_p: string;
  gross_p: string;
  source: 'Xero' | 'QuickBooks' | 'Bank Feed' | 'CSV Upload';
  external_id?: string;
  external_url?: string;
  attachment_url?: string;
  attachment_name?: string;
  invoice_id?: string;
}

// Stage A DAT-01 / DAT-06: Snapshot change detection between imports
export interface TbSnapshotDiff {
  account_code: string;
  account_name: string;
  prior_amount_p: string;
  new_amount_p: string;
  diff_p: string;
  direction: 'increased' | 'decreased' | 'new';
  affected_schedule_ref?: string;
}


