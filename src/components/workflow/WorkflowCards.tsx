'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';
import { allWorkflowsOf, canCustomise, workflowProgress, workflowsOf } from '@/lib/workflows';
import { AddWorkflowDialog } from '@/components/workflow/AddWorkflowDialog';
import { ukDate } from '@/lib/dates';

const COLOURS = { signedOff: '#0A5C78', prepared: '#0AA5C9', inProgress: '#7FD6EE' };

/** One card per workflow on a client's years: a bar of how far its papers have got, and a legend of the counts. */
export function WorkflowCards({ engagementIds }: { engagementIds: string[] }) {
  const [adding, setAdding] = useState(false);
  const [, refresh] = useState(0);
  const firmId = db.engagements.find((e) => e.id === engagementIds[0])?.firm_id ?? db.firms[0]?.id ?? '';
  const cards = engagementIds.flatMap((id) => workflowsOf(id));
  const multiplePeriods = engagementIds.length > 1;
  const [showArchived, setShowArchived] = useState(false);
  // Only managers and above can restore, so only they are shown the archive
  const archived = canCustomise(getActor().role) ? engagementIds.flatMap((id) => allWorkflowsOf(id)).filter((w) => w.archived_at) : [];

  return (
    <section aria-labelledby="workflows-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="workflows-heading" className="text-sm font-bold text-[#122654]">Workflows</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={engagementIds.length === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#122654] bg-white border border-[#D3DCEE] rounded-lg hover:bg-[#EAF5FC] disabled:opacity-40 cursor-pointer"
        >
          <Plus className="w-3 h-3" aria-hidden="true" /> Add workflow
        </button>
      </div>

      {cards.length === 0 && <p className="text-xs text-[#4A5878]">No workflows yet. Add one to start working on a client year.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((wf) => {
          const eng = db.engagements.find((e) => e.id === wf.engagement_id)!;
          const p = workflowProgress(wf.engagement_id, wf.refs);
          const pct = (n: number) => (p.total ? `${(n / p.total) * 100}%` : '0%');
          return (
            <Link
              key={wf.id}
              href={`/engagements/${wf.engagement_id}/workflows/${wf.id}`}
              aria-label={`${wf.name}, ${p.percent}% complete`}
              className="block p-4 bg-white border border-[#E3E7EF] rounded-xl hover:border-[#122654] hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#122654] truncate">{wf.name}</div>
                  {multiplePeriods && <div className="text-[11px] text-[#4A5878]">{ukDate(eng.period_start)} to {ukDate(eng.period_end)}</div>}
                </div>
                <ChevronRight className="w-4 h-4 text-[#7E8DA6] shrink-0 mt-0.5" aria-hidden="true" />
              </div>

              <div className="relative mt-3 flex h-3.5 rounded-full overflow-hidden bg-[#EAF0F8]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-label="Working papers completed">
                <div style={{ width: pct(p.signedOff), background: COLOURS.signedOff }} />
                <div style={{ width: pct(p.prepared), background: COLOURS.prepared }} />
                <div style={{ width: pct(p.inProgress), background: COLOURS.inProgress }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#122654]">
                  <span className="px-1.5 rounded-full bg-white/85">{p.percent}%</span>
                </span>
              </div>

              <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#4A5878]">
                {([['signedOff', 'signed off'], ['prepared', 'prepared'], ['inProgress', 'in progress']] as const).map(([key, label]) => (
                  <li key={key} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm" style={{ background: COLOURS[key] }} aria-hidden="true" />
                    {p[key]}/{p.total} {label}
                  </li>
                ))}
                <li>{p.notStarted} not started</li>
              </ul>
            </Link>
          );
        })}
      </div>

      {archived.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived} className="text-xs font-semibold text-[#4A5878] hover:text-[#122654] cursor-pointer">
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 border border-[#E3E7EF] rounded-xl divide-y divide-[#E3E7EF] bg-white">
              {archived.map((wf) => (
                <li key={wf.id}>
                  <Link href={`/engagements/${wf.engagement_id}/workflows/${wf.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-[#F5F8FD]">
                    <span className="font-semibold text-[#122654] truncate">{wf.name}</span>
                    <span className="text-[#4A5878] shrink-0">Archived {ukDate(wf.archived_at!)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {adding && <AddWorkflowDialog engagementIds={engagementIds} firmId={firmId} onClose={() => setAdding(false)} onAdded={() => refresh((n) => n + 1)} />}
    </section>
  );
}
