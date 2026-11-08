import { db } from './server/db';
import { PACKS } from './workpapers/templates';
import { paperStatus } from './workpapers/engine';
import { EngagementWorkflow, UserRole, WorkflowTemplate } from './types/models';

export interface WorkflowOption {
  key: string;
  name: string;
  refs: string[];
  /** Set for a practice-made workflow, which a manager can change */
  custom?: WorkflowTemplate;
}

const MANAGER_UP: UserRole[] = ['manager', 'partner', 'admin'];
export const canCustomise = (role: UserRole) => MANAGER_UP.includes(role);

const defaultName = (companyType?: string) => `UK Working Papers${companyType ? ` - ${companyType}` : ''}`;

/** The standard packs plus the practice's own workflows: what "Add workflow" offers. */
export function workflowOptions(firmId: string): WorkflowOption[] {
  const builtIn = Object.entries(PACKS).map(([type, refs]) => ({ key: `builtin:${type}`, name: defaultName(type), refs }));
  const own = db.workflow_templates.filter((t) => t.firm_id === firmId).map((t) => ({ key: `custom:${t.id}`, name: t.name, refs: t.refs, custom: t }));
  return [...builtIn, ...own.sort((a, b) => a.name.localeCompare(b.name))];
}

/** An engagement's workflows, archived ones included. One made before workflows existed shows its papers as a single default workflow. */
export function allWorkflowsOf(engagementId: string): EngagementWorkflow[] {
  const rows = db.engagement_workflows.filter((w) => w.engagement_id === engagementId);
  if (rows.length) return rows;
  const refs = db.workpapers.filter((w) => w.engagement_id === engagementId).map((w) => w.ref);
  if (!refs.length) return [];
  const eng = db.engagements.find((e) => e.id === engagementId);
  const client = db.clients.find((c) => c.id === eng?.client_id);
  return [{ id: 'default', engagement_id: engagementId, name: defaultName(client?.company_type), refs, created_at: '' }];
}

/** The workflows in use on a year. */
export const workflowsOf = (engagementId: string) => allWorkflowsOf(engagementId).filter((w) => !w.archived_at);

/**
 * Adds a workflow to a client year: creates the papers it needs that the year lacks. Returns the reason
 * when it cannot be added. The first workflow added keeps the year's existing papers as the default one.
 */
export function addWorkflow(engagementId: string, name: string, refs: string[], actor: { id: string; name: string; role: UserRole }): EngagementWorkflow | string {
  const eng = db.engagements.find((e) => e.id === engagementId);
  if (!eng) return 'Engagement not found.';
  if (eng.status === 'locked') return 'This year is locked. Unlock it before adding a workflow.';
  const current = allWorkflowsOf(engagementId);
  if (current.some((w) => w.name.toLowerCase() === name.trim().toLowerCase())) return 'This year already has a workflow with that name.';
  if (!refs.length) return 'Choose at least one working paper.';

  if (!db.engagement_workflows.some((w) => w.engagement_id === engagementId)) db.engagement_workflows.push(...current);
  for (const ref of refs) db.addWorkpaper(engagementId, ref);
  const row: EngagementWorkflow = { id: `wf_${crypto.randomUUID()}`, engagement_id: engagementId, name: name.trim(), refs: [...refs], created_at: new Date().toISOString() };
  db.engagement_workflows.push(row);
  db.logAudit(eng.firm_id, actor, 'ADD_WORKFLOW', 'engagement_workflows', row.id, null, row);
  return row;
}

type Actor = { id: string; name: string; role: UserRole };

/** Archive, restore or delete: managers and above only. Returns the reason when it cannot be done. */
function change(engagementId: string, workflowId: string, actor: Actor, action: 'ARCHIVE_WORKFLOW' | 'RESTORE_WORKFLOW' | 'DELETE_WORKFLOW'): string | null {
  if (!canCustomise(actor.role)) return 'Only a manager or above can archive or delete a workflow.';
  const eng = db.engagements.find((e) => e.id === engagementId);
  if (!eng) return 'Engagement not found.';
  if (eng.status === 'locked') return 'This year is locked. Unlock it first.';
  // A year's default workflow becomes a real row the first time it is changed
  if (!db.engagement_workflows.some((w) => w.engagement_id === engagementId)) db.engagement_workflows.push(...allWorkflowsOf(engagementId));
  const row = db.engagement_workflows.find((w) => w.engagement_id === engagementId && (w.id === workflowId || (workflowId === 'default' && w.created_at === '')));
  if (!row) return 'Workflow not found.';
  const before = { ...row };
  if (action === 'DELETE_WORKFLOW') db.engagement_workflows = db.engagement_workflows.filter((w) => w !== row);
  else row.archived_at = action === 'ARCHIVE_WORKFLOW' ? new Date().toISOString() : null;
  db.logAudit(eng.firm_id, actor, action, 'engagement_workflows', row.id, before, action === 'DELETE_WORKFLOW' ? null : row);
  return null;
}

export const archiveWorkflow = (engagementId: string, workflowId: string, actor: Actor) => change(engagementId, workflowId, actor, 'ARCHIVE_WORKFLOW');
export const restoreWorkflow = (engagementId: string, workflowId: string, actor: Actor) => change(engagementId, workflowId, actor, 'RESTORE_WORKFLOW');
/** Removes the workflow from the year. Its working papers stay. */
export const deleteWorkflow = (engagementId: string, workflowId: string, actor: Actor) => change(engagementId, workflowId, actor, 'DELETE_WORKFLOW');

/** Puts a working paper on a workflow, creating it when the year lacks it. Returns the reason when it cannot. */
export function addPaperToWorkflow(engagementId: string, workflowId: string, ref: string, actor: Actor): string | null {
  const eng = db.engagements.find((e) => e.id === engagementId);
  if (!eng) return 'Engagement not found.';
  if (eng.status === 'locked') return 'This year is locked. Unlock it before adding a working paper.';
  const inFile = db.workpapers.some((w) => w.engagement_id === engagementId && w.ref === ref);
  if (!inFile && !db.addWorkpaper(engagementId, ref)) return 'That working paper is not available.';
  // A year still on its automatic default workflow has no row: that workflow lists every paper in the file
  const row = db.engagement_workflows.find((w) => w.engagement_id === engagementId && w.id === workflowId);
  if (row && !row.refs.includes(ref)) row.refs.push(ref);
  db.logAudit(eng.firm_id, actor, 'ADD_WORKFLOW_PAPER', 'engagement_workflows', workflowId, null, { ref });
  return null;
}

export interface WorkflowProgress {
  total: number;
  signedOff: number;
  prepared: number;
  inProgress: number;
  notStarted: number;
  percent: number;
}

/** Where a workflow's papers stand. "Prepared" covers reconciled and prepared papers. */
export function workflowProgress(engagementId: string, refs: string[]): WorkflowProgress {
  const papers = db.workpapers.filter((w) => w.engagement_id === engagementId && refs.includes(w.ref) && w.applicable !== false);
  const states = papers.map((w) => paperStatus(w));
  const count = (...keys: string[]) => states.filter((s) => keys.includes(s)).length;
  const signedOff = count('signed_off');
  const prepared = count('reconciled', 'prepared');
  const notStarted = count('not_started');
  const total = papers.length;
  return { total, signedOff, prepared, inProgress: total - signedOff - prepared - notStarted, notStarted, percent: total ? Math.round(((signedOff + prepared) / total) * 100) : 0 };
}
