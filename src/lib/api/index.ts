import { db } from '../server/db';

import {
  EngagementSummary,
  WorkpaperItem,
  ReviewNoteItem,
} from '../types';

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
    team: [],
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

