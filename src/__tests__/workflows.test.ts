import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/server/db';
import { addWorkflow, allWorkflowsOf, archiveWorkflow, deleteWorkflow, restoreWorkflow, workflowOptions, workflowProgress, workflowsOf } from '@/lib/workflows';
import { mergeFirmState, firmSlice, GuardError, State } from '@/lib/server/state-guard';

const admin = { id: 'u1', name: 'A', role: 'admin' as const };
const open = () => db.engagements.find((e) => e.status !== 'locked')!;

afterEach(() => {
  db.engagement_workflows = [];
  db.workflow_templates = [];
});

describe('workflows', () => {
  it('offers the standard packs and the practice\'s own', () => {
    const eng = open();
    db.workflow_templates.push({ id: 't1', firm_id: eng.firm_id, name: 'Management accounts', refs: ['A-10', 'B-10'], created_by: 'u1', created_at: '' });
    db.workflow_templates.push({ id: 't2', firm_id: 'someone_else', name: 'Not mine', refs: ['A-10'], created_by: 'u9', created_at: '' });
    const names = workflowOptions(eng.firm_id).map((o) => o.name);
    expect(names).toContain('UK Working Papers - Sole trader');
    expect(names).toContain('Management accounts');
    expect(names).not.toContain('Not mine');
  });

  it('keeps the year\'s existing papers as the default workflow, then adds the new one with its papers', () => {
    const eng = open();
    const before = workflowsOf(eng.id);
    expect(before).toHaveLength(1);
    expect(before[0].id).toBe('default');

    const added = addWorkflow(eng.id, 'Tax only', ['T-10', 'T-20'], admin);
    expect(typeof added).toBe('object');
    const after = workflowsOf(eng.id);
    expect(after.map((w) => w.name)).toEqual([before[0].name, 'Tax only']);
    for (const ref of ['T-10', 'T-20']) expect(db.workpapers.some((w) => w.engagement_id === eng.id && w.ref === ref)).toBe(true);
    expect(workflowProgress(eng.id, ['T-10', 'T-20']).total).toBe(2);

    expect(addWorkflow(eng.id, 'tax only', ['T-10'], admin)).toMatch(/already has/);
    expect(addWorkflow(eng.id, 'Empty', [], admin)).toMatch(/at least one/);

    const id = (added as { id: string }).id;
    expect(archiveWorkflow(eng.id, id, admin)).toBeNull();
    expect(workflowsOf(eng.id).map((w) => w.name)).toEqual([before[0].name]);
    expect(allWorkflowsOf(eng.id)).toHaveLength(2);
    expect(addWorkflow(eng.id, 'Tax only', ['T-10'], admin)).toMatch(/already has/); // archived names stay taken
    expect(restoreWorkflow(eng.id, id, admin)).toBeNull();
    expect(workflowsOf(eng.id)).toHaveLength(2);
    expect(deleteWorkflow(eng.id, id, admin)).toBeNull();
    expect(workflowsOf(eng.id).map((w) => w.name)).toEqual([before[0].name]);
    expect(db.workpapers.some((w) => w.engagement_id === eng.id && w.ref === 'T-10')).toBe(true); // papers stay
  });

  it('the default workflow can be archived too, and only a manager or above may', () => {
    const eng = open();
    const preparer = { id: 'u2', name: 'P', role: 'preparer' as const };
    expect(archiveWorkflow(eng.id, 'default', preparer)).toMatch(/manager/);
    expect(deleteWorkflow(eng.id, 'default', preparer)).toMatch(/manager/);
    expect(workflowsOf(eng.id)).toHaveLength(1);
    expect(archiveWorkflow(eng.id, 'default', admin)).toBeNull();
    expect(workflowsOf(eng.id)).toHaveLength(0);
    expect(restoreWorkflow(eng.id, 'default', admin)).toBeNull();
    expect(workflowsOf(eng.id)).toHaveLength(1);
  });

  it('cannot be added to a locked year', () => {
    const locked = db.engagements.find((e) => e.status === 'locked');
    if (locked) expect(addWorkflow(locked.id, 'Nope', ['A-10'], admin)).toMatch(/locked/);
  });

  it('only a manager or above can create a practice workflow, and it stays with their firm', () => {
    const full: State = {
      firms: [{ id: 'f1' }, { id: 'f2' }],
      memberships: [{ firm_id: 'f1', user_id: 'u1', role: 'admin' }, { firm_id: 'f1', user_id: 'u2', role: 'preparer' }],
      users: [{ id: 'u1' }, { id: 'u2' }],
    };
    const propose = (firm_id: string) => ({ ...JSON.parse(JSON.stringify(firmSlice(full, 'f1'))), workflow_templates: [{ id: 'wft_1', firm_id, name: 'Mine', refs: ['A-10'] }] });

    const manager = mergeFirmState(full, propose('f2'), { ...admin, firmId: 'f1' });
    expect(manager.workflow_templates).toEqual([expect.objectContaining({ id: 'wft_1', firm_id: 'f1' })]);
    expect(() => mergeFirmState(full, propose('f1'), { id: 'u2', name: 'P', role: 'preparer', firmId: 'f1' })).toThrow(GuardError);
  });

  it('the server refuses a preparer archiving or deleting a year\'s workflow', () => {
    const row = { id: 'wf_1', engagement_id: 'e1', name: 'Tax', refs: ['T-10'], created_at: 'x' };
    const full: State = {
      firms: [{ id: 'f1' }],
      memberships: [{ firm_id: 'f1', user_id: 'u1', role: 'admin' }, { firm_id: 'f1', user_id: 'u2', role: 'preparer' }],
      users: [{ id: 'u1' }, { id: 'u2' }],
      clients: [{ id: 'c1', firm_id: 'f1' }],
      engagements: [{ id: 'e1', firm_id: 'f1', client_id: 'c1', status: 'fieldwork' }],
      engagement_workflows: [row],
    };
    const view = () => JSON.parse(JSON.stringify(firmSlice(full, 'f1')));
    const archived = { ...view(), engagement_workflows: [{ ...row, archived_at: 'now' }] };
    const deleted = { ...view(), engagement_workflows: [] };
    const preparer = { id: 'u2', name: 'P', role: 'preparer' as const, firmId: 'f1' };
    expect(() => mergeFirmState(full, archived, preparer)).toThrow(GuardError);
    expect(() => mergeFirmState(full, deleted, preparer)).toThrow(GuardError);
    expect(mergeFirmState(full, archived, { ...admin, firmId: 'f1' }).engagement_workflows[0].archived_at).toBe('now');
  });
});
