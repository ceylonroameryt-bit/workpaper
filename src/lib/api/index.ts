import { MOCK_BANK_REC, MOCK_TEMPLATES, CURRENT_USER, TEAM_MEMBERS } from '../mock';
import { db } from '../server/db';

import {
  Client,
  EngagementSummary,
  WorkpaperItem,
  BankRecWorkpaperData,
  TrialBalanceItem,
  ReviewNoteItem,
  LockBlockerItem,
  TemplateCardItem,
  AuditLogItem,
  UserProfile,
  ProcedureCheckItem,
} from '../types';

/**
 * /lib/api layer
 * Structured so a real backend / fetch / REST client can replace these async mocks.
 */

export async function getCurrentUser(): Promise<UserProfile> {
  return CURRENT_USER;
}

export async function getTeamMembers(): Promise<UserProfile[]> {
  return TEAM_MEMBERS;
}

export async function getClients(): Promise<Client[]> {
  return [...db.clients];
}

export async function getClientById(id: string): Promise<Client | undefined> {
  return db.clients.find((c) => c.id === id);
}

const STAGE_LABELS: Record<string, EngagementSummary['stage']> = {
  planning: 'Planning',
  fieldwork: 'Fieldwork',
  review: 'Review',
  locked: 'Locked',
} as Record<string, EngagementSummary['stage']>;

export function engagementSummary(engagementId: string): EngagementSummary {
  const eng = db.engagements.find((e) => e.id === engagementId);
  const client = eng ? db.clients.find((c) => c.id === eng.client_id) : undefined;
  const papers = db.workpapers.filter((w) => w.engagement_id === engagementId);
  const periodEnd = eng ? new Date(eng.period_end) : null;
  return {
    id: engagementId,
    clientId: client?.id ?? '',
    clientName: client?.name ?? 'Untitled engagement',
    period: periodEnd ? `FY ${periodEnd.getFullYear()}` : '—',
    yearEnd: periodEnd
      ? periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    framework: eng?.framework ?? '—',
    stage: STAGE_LABELS[eng?.status ?? 'planning'] ?? 'Planning',
    totalWorkpapers: papers.length,
    preparedWorkpapers: papers.filter((w: any) => w.status === 'prepared' || w.status === 'signed_off').length,
    reviewedWorkpapers: papers.filter((w: any) => w.status === 'signed_off').length,
    openReviewNotes: db.comments.filter(
      (c) => c.type === 'review_note' && c.status === 'open' && papers.some((w) => w.id === c.workpaper_id)
    ).length,
    partnerLockStatus: eng?.locked_at ? 'Locked' : 'Not started',
    materialityCents: 0,
    performanceMaterialityCents: 0,
    team: TEAM_MEMBERS,
  } as EngagementSummary;
}

export async function getEngagement(engagementId: string): Promise<EngagementSummary> {
  return engagementSummary(engagementId);
}

const PAPER_AREAS: Record<string, string> = { F: 'Fixed assets', B: 'Cash and bank' };
const PAPER_STATUS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  prepared: 'Prepared',
  signed_off: 'Signed off',
  needs_you: 'Needs attention',
  stale: 'Needs attention',
};

export async function getWorkpapers(
  engagementId: string,
  filter?: 'all' | 'mine' | 'needs_review' | 'flagged'
): Promise<WorkpaperItem[]> {
  const signer = (wpId: string, role: string) =>
    db.signoffs.filter((s) => s.workpaper_id === wpId && s.role === role && !s.stale_at).pop()?.user_name ?? '—';
  let list: WorkpaperItem[] = db.workpapers
    .filter((w) => w.engagement_id === engagementId)
    .map((w) => ({
      id: w.id,
      ref: w.ref,
      name: (w.data_json?.title as string) || w.ref,
      area: PAPER_AREAS[w.ref.charAt(0)] ?? 'General',
      preparer: signer(w.id, 'preparer'),
      reviewer: signer(w.id, 'reviewer'),
      status: PAPER_STATUS[w.status] ?? w.status,
      notesCount: db.comments.filter((c) => c.workpaper_id === w.id && c.status === 'open').length,
      updatedAt: new Date(w.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      flaggedByAi: false,
    }));
  if (filter === 'needs_review') {
    list = list.filter((w) => w.status === 'Prepared' || w.status === 'Needs attention');
  }
  return list;
}

export async function getWorkpaperById(
  engagementId: string,
  workpaperId: string
): Promise<BankRecWorkpaperData | null> {
  // 1. Direct match for Barclays bank reconciliation
  if (workpaperId === 'wp_b10' || workpaperId === 'B-10' || workpaperId === 'b-10') {
    return {
      ...MOCK_BANK_REC,
      area: 'Cash & Cash Equivalents',
      standardRef: 'ISA (UK) 505 / 500',
      framework: 'ISA (UK)',
      businessType: 'General Commercial',
      tbBindings: ['1010 Cash & Equivalents'],
    };
  }

  // 2. Check in MOCK_TEMPLATES (51 UK standards across all sectors)
  const template = MOCK_TEMPLATES.find(
    (t) =>
      t.id === workpaperId ||
      t.leadRef?.toLowerCase() === workpaperId.toLowerCase() ||
      t.id.toLowerCase() === workpaperId.toLowerCase()
  );

  const wp: WorkpaperItem | undefined = undefined as WorkpaperItem | undefined;

  if (template) {
    const procedures: ProcedureCheckItem[] = (
      template.keyProcedures && template.keyProcedures.length > 0
        ? template.keyProcedures
        : [
            'Agree schedule balances to general ledger nominal accounts without variance',
            'Vouch supporting documentation and third-party certifications',
            'Verify compliance with UK statutory disclosure and filing requirements',
            'Recalculate mathematical footing, cross-casts, and tax apportionments',
          ]
    ).map((proc: string, idx: number) => ({
      id: `proc_${idx + 1}`,
      title: proc,
      description: `Working paper procedure under ${template.standardRef || 'the applicable UK standard'}.`,
      status: idx === 0 || idx === 1 ? 'Done' : 'Pending',
      completedBy: idx === 0 || idx === 1 ? CURRENT_USER.name : undefined,
      completedAt: idx === 0 || idx === 1 ? 'Today at 09:30' : undefined,
    }));

    const rawBindings =
      template.tbBindings && template.tbBindings.length > 0
        ? template.tbBindings
        : [`TB Lead Account for ${template.leadRef || 'WP'}`];

    const scheduleRows = rawBindings.map((binding: string, idx: number) => {
      const priorYear = 14500000 + idx * 5600000;
      const draftTb = 16800000 + idx * 6200000;
      const adjustments = idx === 1 ? -412000 : 0;
      const audited = draftTb + adjustments;
      const variancePercent = Number((((audited - priorYear) / priorYear) * 100).toFixed(1));
      return {
        id: `row_${idx + 1}`,
        accountCode: binding.split(' ')[0] || `GL-${1000 + idx * 10}`,
        description: binding,
        priorYearCents: priorYear,
        draftTbCents: draftTb,
        adjustmentsCents: adjustments,
        auditedCents: audited,
        variancePercent,
        tickmark: '✓',
        notes: idx === 1 ? 'Adjusted per AJE-004' : 'Footed and agreed to trial balance',
      };
    });

    const totalAudited = scheduleRows.reduce((sum: number, r: any) => sum + r.auditedCents, 0);

    return {
      ...MOCK_BANK_REC,
      id: template.id,
      ref: template.leadRef || 'WP-01',
      title: template.name,
      area: template.area,
      standardRef: template.standardRef,
      framework: template.framework,
      businessType: template.businessType,
      tbBindings: template.tbBindings,
      ledgerBalanceCents: totalAudited,
      bankBalanceCents: totalAudited,
      adjustedBankBalanceCents: totalAudited,
      outstandingChequesTotalCents: 0,
      depositsInTransitTotalCents: 0,
      differenceCents: 0,
      ties: true,
      procedures,
      scheduleRows,
      conclusionText: `Testing of ${template.name} performed in accordance with ${template.standardRef || 'applicable UK standards'}. All balances tie to general ledger nominals with zero unadjusted differences. No material misstatements noted.`,
      aiSuggestedConclusion: `Based on automated recalculation, supporting document vouching, and nominal tie-out to ${template.tbBindings?.join(', ') || 'trial balance'}, ${template.name} reflects true and fair value under ${template.framework || 'UK GAAP'}.`,
      evidence: {
        documentName: `${(template.leadRef || 'WP').replace(/[^a-zA-Z0-9]/g, '_')}_Statutory_Audit_Evidence_FY26.pdf`,
        page: 1,
        extractedValueCents: totalAudited,
        matchStatus: 'Exact Match (100%)',
        sourceSnippet: `Statutory verification schedule for ${template.name} tied directly to Trial Balance accounts: ${template.tbBindings?.join(', ') || 'N/A'}.`,
      },
      aiLineage: {
        sourceFile: `${(template.leadRef || 'WP').replace(/[^a-zA-Z0-9]/g, '_')}_Evidence_FY26.pdf`,
        pageNumber: 1,
        locationDescription: `Primary Schedule Tie-Out (${template.leadRef || 'General'})`,
        promptVersion: 'v3.5-uk-standard',
        acceptedBy: 'Reviewer',
        acceptedAt: 'Today at 09:42',
        confidence: 0.99,
      },
    };
  }

  // 4. Fallback for workpaper in MOCK_WORKPAPERS
  if (wp) {
    return {
      ...MOCK_BANK_REC,
      id: wp.id,
      ref: wp.ref,
      title: wp.name,
      area: wp.area,
      standardRef: 'UK Statutory Practice',
      framework: 'FRS 102',
    };
  }

  // 5. General fallback
  return {
    ...MOCK_BANK_REC,
    id: workpaperId,
    ref: 'WP-GEN',
    title: `Workpaper ${workpaperId}`,
    area: 'General workpaper',
    standardRef: 'UK Standard',
  };
}

export async function getTrialBalance(_engagementId: string): Promise<TrialBalanceItem[]> {
  return [];
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function getReviewNotes(engagementId: string, workpaperId?: string): Promise<ReviewNoteItem[]> {
  const papers = db.workpapers.filter((w) => w.engagement_id === engagementId);
  return db.comments
    .filter((c) => papers.some((w) => w.id === c.workpaper_id) && (!workpaperId || c.workpaper_id === workpaperId))
    .sort((x, y) => y.created_at.localeCompare(x.created_at))
    .map((c) => {
      const wp = papers.find((w) => w.id === c.workpaper_id)!;
      return {
        id: c.id,
        workpaperId: wp.id,
        workpaperRef: wp.ref,
        workpaperTitle: (wp.data_json?.title as string) || wp.ref,
        cellRef: c.anchor_summary || 'Whole paper',
        author: { name: c.created_by_name },
        createdAt: fmtWhen(c.created_at),
        content: c.body,
        text: c.body,
        type: c.type,
        status: c.status === 'resolved' ? 'Resolved' : c.type === 'client_query' ? 'Waiting on client' : 'Open',
        replies: (c.replies ?? []).map((r) => ({
          id: r.id,
          author: { name: r.created_by_name },
          content: r.body,
          text: r.body,
          createdAt: fmtWhen(r.created_at),
        })),
      } as ReviewNoteItem;
    });
}

export async function getSignOffBlockers(_engagementId: string): Promise<LockBlockerItem[]> {
  return [];
}

export async function getTemplates(
  category?: 'Built-in' | 'Your firm' | 'Drafts'
): Promise<TemplateCardItem[]> {
  if (category) {
    return MOCK_TEMPLATES.filter((t) => t.category === category);
  }
  return [...MOCK_TEMPLATES];
}

export async function getAuditLogs(_engagementId: string): Promise<AuditLogItem[]> {
  return [];
}
