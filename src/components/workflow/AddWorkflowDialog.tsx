'use client';

import { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';
import { TEMPLATES } from '@/lib/workpapers/templates';
import { addWorkflow, canCustomise, workflowOptions, WorkflowOption } from '@/lib/workflows';
import { ukDate } from '@/lib/dates';

const field = 'mt-1 w-full px-3 py-2 border border-[#D3DCEE] rounded-[8px] text-xs text-[#122654]';

/** Pick a workflow to add to a client year, or (managers and above) create and change the practice's own. */
export function AddWorkflowDialog({ engagementIds, firmId, onClose, onAdded }: { engagementIds: string[]; firmId: string; onClose: () => void; onAdded: () => void }) {
  const actor = getActor();
  const open = engagementIds.filter((id) => db.engagements.find((e) => e.id === id)?.status !== 'locked');
  const [engagementId, setEngagementId] = useState(open[0] ?? '');
  const [editing, setEditing] = useState<WorkflowOption | 'new' | null>(null);
  const [error, setError] = useState('');
  const [, refresh] = useState(0);

  const add = (option: WorkflowOption) => {
    const res = addWorkflow(engagementId, option.name, option.refs, actor);
    if (typeof res === 'string') return setError(res);
    onAdded();
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Add workflow" onKeyDown={(e) => e.key === 'Escape' && onClose()} className="fixed inset-0 z-50 bg-[#0B1A3B]/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-full flex flex-col text-xs text-[#122654]">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-base font-bold">{editing ? (editing === 'new' ? 'Create workflow' : 'Change workflow') : 'Add workflow'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#4A5878] hover:text-[#122654] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {editing ? (
          <WorkflowEditor
            firmId={firmId}
            option={editing === 'new' ? null : editing}
            onDone={(created) => {
              setEditing(null);
              refresh((n) => n + 1);
              if (created && engagementId) add(created);
            }}
          />
        ) : (
          <div className="px-5 pb-5 space-y-3 overflow-y-auto">
            {open.length === 0 ? (
              <p className="text-[#B8432F]" role="alert">Every year for this client is locked. Unlock one to add a workflow.</p>
            ) : (
              <>
                {open.length > 1 && (
                  <label className="block font-semibold">
                    Add to
                    <select value={engagementId} onChange={(e) => setEngagementId(e.target.value)} className={field}>
                      {open.map((id) => {
                        const e = db.engagements.find((x) => x.id === id)!;
                        return <option key={id} value={id}>{ukDate(e.period_start)} to {ukDate(e.period_end)}</option>;
                      })}
                    </select>
                  </label>
                )}
                {error && <p role="alert" className="text-[#B8432F]">{error}</p>}
                <ul className="border border-[#E3E7EF] rounded-xl divide-y divide-[#E3E7EF] overflow-hidden">
                  {workflowOptions(firmId).map((o) => (
                    <li key={o.key} className="flex items-center">
                      <button type="button" onClick={() => add(o)} className="flex-1 min-w-0 text-left px-3 py-2.5 hover:bg-[#F5F8FD] cursor-pointer">
                        <span className="block font-semibold truncate">{o.name}</span>
                        <span className="block text-[10px] text-[#4A5878]">{o.refs.length} working papers{o.custom ? ' · yours' : ''}</span>
                      </button>
                      {o.custom && canCustomise(actor.role) && (
                        <button type="button" onClick={() => setEditing(o)} aria-label={`Change ${o.name}`} className="px-3 text-[#4A5878] hover:text-[#122654] cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                      )}
                    </li>
                  ))}
                </ul>
                {canCustomise(actor.role) ? (
                  <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1 font-semibold text-[#B8432F] hover:underline cursor-pointer">
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Create your own workflow
                  </button>
                ) : (
                  <p className="text-[#4A5878]">Ask a manager to create a workflow of your own.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Name a workflow and tick the working papers it holds. Saved for the whole practice. */
function WorkflowEditor({ firmId, option, onDone }: { firmId: string; option: WorkflowOption | null; onDone: (created?: WorkflowOption) => void }) {
  const [name, setName] = useState(option?.name ?? '');
  const [refs, setRefs] = useState<string[]>(option?.refs ?? []);
  const [error, setError] = useState('');
  const existing = option?.custom;
  const toggle = (ref: string) => setRefs((r) => (r.includes(ref) ? r.filter((x) => x !== ref) : [...r, ref]));

  const save = () => {
    const clash = workflowOptions(firmId).some((o) => o.name.toLowerCase() === name.trim().toLowerCase() && o.custom?.id !== existing?.id);
    if (!name.trim()) return setError('Give the workflow a name.');
    if (clash) return setError('A workflow with that name already exists.');
    if (!refs.length) return setError('Tick at least one working paper.');
    const ordered = TEMPLATES.map((t) => t.ref).filter((r) => refs.includes(r));
    const actor = getActor();
    if (existing) {
      const before = { ...existing };
      existing.name = name.trim();
      existing.refs = ordered;
      db.logAudit(firmId, actor, 'UPDATE_WORKFLOW', 'workflow_templates', existing.id, before, existing);
      return onDone();
    }
    const row = { id: `wft_${crypto.randomUUID()}`, firm_id: firmId, name: name.trim(), refs: ordered, created_by: actor.id, created_at: new Date().toISOString() };
    db.workflow_templates.push(row);
    db.logAudit(firmId, actor, 'CREATE_WORKFLOW', 'workflow_templates', row.id, null, row);
    onDone({ key: `custom:${row.id}`, name: row.name, refs: row.refs, custom: row });
  };

  const remove = () => {
    if (!existing) return;
    db.workflow_templates = db.workflow_templates.filter((t) => t.id !== existing.id);
    db.logAudit(firmId, getActor(), 'DELETE_WORKFLOW', 'workflow_templates', existing.id, existing, null);
    onDone();
  };

  return (
    <div className="px-5 pb-5 space-y-3 overflow-y-auto">
      <label className="block font-semibold">
        Name
        <input autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Management accounts" className={field} />
      </label>
      <fieldset>
        <legend className="font-semibold mb-1">Working papers ({refs.length} ticked)</legend>
        <div className="max-h-56 overflow-y-auto border border-[#E3E7EF] rounded-xl divide-y divide-[#E3E7EF]">
          {TEMPLATES.map((t) => (
            <label key={t.ref} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F5F8FD] cursor-pointer">
              <input type="checkbox" checked={refs.includes(t.ref)} onChange={() => toggle(t.ref)} />
              <span className="font-mono text-[#4A5878] w-9 shrink-0">{t.ref}</span>
              <span className="truncate">{t.title}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-[#4A5878]">Changing a workflow does not alter years it was already added to.</p>
      {error && <p role="alert" className="text-[#B8432F]">{error}</p>}
      <div className="flex items-center justify-between pt-1">
        {existing ? <button type="button" onClick={remove} className="font-semibold text-[#B8432F] hover:underline cursor-pointer">Delete workflow</button> : <span />}
        <div className="flex gap-3">
          <button type="button" onClick={() => onDone()} className="font-semibold cursor-pointer">Cancel</button>
          <button type="button" onClick={save} className="px-4 py-1.5 rounded-lg bg-[#122654] text-white font-semibold cursor-pointer">{existing ? 'Save' : 'Save and add'}</button>
        </div>
      </div>
    </div>
  );
}
