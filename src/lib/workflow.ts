import { db } from './server/db';
import { paperStatus } from './workpapers/engine';

export type StepState = 'todo' | 'doing' | 'done' | 'blocked';

export interface WorkflowStep {
  key: string;
  title: string;
  /** What the done/total counts, for the legend: "6 of 7 mappings" */
  unit: string;
  detail: string;
  state: StepState;
  done: number;
  total: number;
  href: string;
  blockedBy?: string;
}

/**
 * The steps of one client year, from importing the trial balance to sign-off. Every status is worked
 * out from the engagement's own records, so nothing is ticked by hand and nothing can drift.
 */
export function buildWorkflow(engagementId: string): WorkflowStep[] {
  const base = `/engagements/${engagementId}`;
  const eng = db.engagements.find((e) => e.id === engagementId);
  const imported = db.tb_snapshots.some((s) => s.engagement_id === engagementId);
  const maps = db.account_mappings.filter((m) => m.engagement_id === engagementId);
  const confirmed = maps.filter((m) => m.status === 'confirmed').length;
  const journals = db.adjustments.filter((a) => a.engagement_id === engagementId && a.status !== 'rejected' && a.status !== 'reversed');
  const posted = journals.filter((a) => a.status === 'posted' || a.status === 'approved').length;
  const papers = db.workpapers.filter((w) => w.engagement_id === engagementId && w.applicable !== false);
  const paperIds = new Set(papers.map((w) => w.id));
  const finished = papers.filter((w) => ['reconciled', 'prepared', 'signed_off'].includes(paperStatus(w))).length;
  const notes = db.comments.filter((c) => paperIds.has(c.workpaper_id) && c.type === 'review_note');
  const openNotes = notes.filter((c) => c.status === 'open').length;
  const signed = papers.filter((w) => paperStatus(w) === 'signed_off').length;
  const locked = eng?.status === 'locked';

  const progress = (done: number, total: number): StepState => (total > 0 && done >= total ? 'done' : done > 0 ? 'doing' : 'todo');
  const gate = (ok: boolean, state: StepState, why: string) => (ok ? { state } : { state: 'blocked' as StepState, blockedBy: why });

  return [
    {
      key: 'import', unit: 'imports', title: 'Import the trial balance', detail: imported ? 'Trial balance imported' : 'Upload a file or pull from Xero or QuickBooks',
      state: imported ? 'done' : 'todo', done: imported ? 1 : 0, total: 1, href: `${base}/trial-balance`,
    },
    {
      key: 'map', unit: 'mappings', title: 'Map accounts to the chart', detail: `${confirmed} of ${maps.length} confirmed`,
      ...gate(imported, progress(confirmed, maps.length), 'Import the trial balance first'), done: confirmed, total: maps.length, href: `${base}/mapping`,
    },
    {
      key: 'journals', unit: 'journals', title: 'Post adjusting journals', detail: journals.length ? `${posted} of ${journals.length} posted or approved` : 'None needed yet',
      ...gate(imported, journals.length ? progress(posted, journals.length) : 'todo', 'Import the trial balance first'), done: posted, total: journals.length, href: `${base}/journals`,
    },
    {
      key: 'papers', unit: 'working papers', title: 'Complete the working papers', detail: `${finished} of ${papers.length} reconciled or prepared`,
      ...gate(maps.length > 0 && confirmed === maps.length, progress(finished, papers.length), 'Confirm every mapping first'), done: finished, total: papers.length, href: `${base}/workpapers`,
    },
    {
      key: 'review', unit: 'review points', title: 'Clear review points', detail: notes.length ? `${notes.length - openNotes} of ${notes.length} resolved` : 'No review points raised',
      ...gate(papers.length > 0 && finished === papers.length, notes.length && openNotes === 0 ? 'done' : progress(notes.length - openNotes, notes.length), 'Finish the working papers first'), done: notes.length - openNotes, total: notes.length, href: `${base}/review`,
    },
    {
      key: 'signoff', unit: 'sign-offs', title: 'Sign off and lock the year', detail: locked ? 'Locked' : `${signed} of ${papers.length} papers signed off`,
      ...gate(papers.length > 0 && finished === papers.length && openNotes === 0, locked ? 'done' : progress(signed, papers.length), 'Clear review points first'), done: locked ? papers.length : signed, total: papers.length, href: `${base}/sign-off`,
    },
  ];
}
