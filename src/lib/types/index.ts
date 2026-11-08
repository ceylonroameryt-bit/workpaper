export * from './models';

// UI-level helpers and legacy compatibility mapped to models
import { UserRole } from './models';

export type Framework = 'FRS 102' | 'FRS 105' | 'IFRS' | 'Charities SORP' | 'LLP SORP' | 'ISA (UK)';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  email: string;
  avatar: string;
  initials: string;
  isTest?: boolean;
}

export interface EngagementSummary {
  id: string;
  clientId: string;
  clientName: string;
  period: string;
  yearEnd: string;
  framework: string;
  stage: 'Planning' | 'Fieldwork' | 'Review' | 'Partner sign-off' | 'Locked';
  totalWorkpapers: number;
  preparedWorkpapers: number;
  reviewedWorkpapers: number;
  openReviewNotes: number;
  partnerLockStatus: 'Not started' | 'In progress' | 'Locked';
  materialityPence?: bigint;
  performanceMaterialityPence?: bigint;
  materialityCents?: number;
  performanceMaterialityCents?: number;
  team: UserProfile[];
}

export interface LockBlockerItem {
  id: string;
  title: string;
  category: string;
  status: 'Done' | 'Blocked';
  fixLinkText: string;
  fixHref: string;
}

export interface WorkpaperItem {
  id: string;
  ref: string;
  name: string;
  area: string;
  preparer: string;
  reviewer: string;
  status: string;
  notesCount: number;
  updatedAt: string;
  flaggedByAi?: boolean;
  aiSuggestedStatus?: string;
  aiFlagReason?: string;
  templateId?: string;
}

export interface ProcedureCheckItem {
  id: string;
  title: string;
  description?: string;
  status: 'Done' | 'Pending' | 'Not applicable';
  completedBy?: string;
  completedAt?: string;
  notApplicableReason?: string;
}

export interface BankRecWorkpaperData {
  id: string;
  ref: string;
  title: string;
  area?: string;
  standardRef?: string;
  framework?: string;
  businessType?: string;
  tbBindings?: string[];
  ledgerBalanceCents?: number;
  bankBalanceCents?: number;
  adjustedBankBalanceCents?: number;
  outstandingChequesTotalCents?: number;
  depositsInTransitTotalCents?: number;
  differenceCents?: number;
  ties?: boolean;
  procedures?: ProcedureCheckItem[];
  scheduleRows?: any[];
  conclusionText?: string;
  aiSuggestedConclusion?: string;
  evidence?: any;
  aiLineage?: any;
  [key: string]: any;
}

export interface TrialBalanceItem {
  id: string;
  code: string;
  name?: string;
  accountName?: string;
  type?: string;
  leadSchedule?: string;
  workpaperRef?: string;
  closingBalanceCents?: number;
  debitCents?: number;
  creditCents?: number;
  priorYearCents?: number;
  draftTbCents?: number;
  adjustmentsCents?: number;
  auditedCents?: number;
  variancePercent?: number;
  varianceExplanation?: string;
  status?: string;
  commentsCount?: number;
  standardCategory?: string;
  confidenceScore?: number;
  fsLine?: string;
  masterCode?: string;
  [key: string]: any;
}

export interface ReviewNoteItem {
  id: string;
  workpaperId: string;
  workpaperRef: string;
  workpaperName?: string;
  workpaperTitle?: string;
  cellRef?: string;
  author: UserProfile | { name?: string; avatar?: string; title?: string; role?: string } | any;
  authorRole?: string;
  authorAvatar?: string;
  createdAt: string;
  text?: string;
  content?: string;
  status: 'Open' | 'Resolved' | 'In discussion' | 'Waiting on client' | 'Waiting on me' | 'Cleared' | string;
  priority?: 'High' | 'Medium' | 'Low';
  category?: 'Documentation' | 'Calculation' | 'Compliance' | 'Evidence';
  targetCellOrField?: string;
  anchor?: any;
  replies?: Array<{
    id: string;
    author: UserProfile | { name?: string; avatar?: string; title?: string; role?: string } | any;
    authorRole?: string;
    authorAvatar?: string;
    createdAt: string;
    text?: string;
    content?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface AdjustingJournalEntry {
  id: string;
  ref?: string;
  reference?: string;
  narrative?: string;
  title?: string;
  date?: string;
  reason?: string;
  stage: 'Proposed' | 'Approved' | 'Posted' | 'Rejected';
  proposedBy?: string;
  proposedAt?: string;
  preparedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  supportDocument?: string;
  impactSummary?: string;
  workpaperRef?: string;
  lines: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    description?: string;
    debitCents: number;
    creditCents: number;
    debit_p?: string;
    credit_p?: string;
    [key: string]: any;
  }>;
  auditTrail?: any[];
  auditHistory?: any[];
  [key: string]: any;
}

export interface TemplateCardItem {
  id: string;
  name: string;
  area: string;
  leadRef: string;
  version: string | number;
  framework?: string;
  standardRef?: string;
  businessType?: string;
  description: string;
  builtIn?: boolean;
  status?: string;
  usedByCount?: number;
  applicableCompanyTypes?: string[];
  badges?: string[];
  tbBindings?: string[];
  keyProcedures?: string[];
  [key: string]: any;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user?: string;
  userName?: string;
  role?: string;
  userRole?: string;
  action: string;
  details?: string;
  entity?: string;
  category?: string;
  entityType?: string;
  entityName?: string;
  engagementName?: string;
  ipAddress?: string;
  checksum?: string;
  actor_id?: string;
  action_type?: string;
  before?: any;
  after?: any;
  [key: string]: any;
}
