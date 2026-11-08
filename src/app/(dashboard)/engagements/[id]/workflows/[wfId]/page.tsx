'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';
import { allWorkflowsOf, archiveWorkflow, canCustomise, deleteWorkflow, restoreWorkflow, workflowProgress } from '@/lib/workflows';
import { templateOf } from '@/lib/workpapers/templates';
import { paperStatus } from '@/lib/workpapers/engine';
import { STATUS_DEFINITIONS } from '@/lib/types/models';
import { ukDate } from '@/lib/dates';

const button = 'px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer';

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [, refresh] = useState(0);
  const engagementId = params?.id as string;
  const wf = allWorkflowsOf(engagementId).find((w) => w.id === params?.wfId);
  const eng = db.engagements.find((e) => e.id === engagementId);
  const client = db.clients.find((c) => c.id === eng?.client_id);
  const actor = getActor();
  const back = client ? `/clients/${client.id}` : '/';

  if (!wf || !eng) return <div className="p-6 text-sm text-[#4A5878]">Workflow not found.</div>;
  const p = workflowProgress(engagementId, wf.refs);
  const papers = db.workpapers.filter((w) => w.engagement_id === engagementId && wf.refs.includes(w.ref) && w.applicable !== false);
  // Grouped by area (A, B, C...), each group in reference order: C-10 before C-20 before D-10
  const byRef = (a: { ref: string }, b: { ref: string }) => a.ref.localeCompare(b.ref, undefined, { numeric: true });
  const groups = [...new Set(papers.map((w) => templateOf(w)?.area ?? '~'))]
    .sort()
    .map((area) => {
      const inArea = papers.filter((w) => (templateOf(w)?.area ?? '~') === area).sort(byRef);
      return { area, name: templateOf(inArea[0])?.areaName ?? 'Other', papers: inArea };
    });

  const run = (fn: typeof archiveWorkflow, then?: () => void) => {
    const res = fn(engagementId, wf.id, actor);
    if (res) return setError(res);
    setError('');
    then ? then() : refresh((n) => n + 1);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4E89] hover:underline"><ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to {client?.name ?? 'client'}</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#122654]">{wf.name}</h1>
          <p className="text-sm text-[#4A5878]">{client?.name} · {ukDate(eng.period_start)} to {ukDate(eng.period_end)} · {p.percent}% complete</p>
        </div>

        {canCustomise(actor.role) && eng.status !== 'locked' && (
          <div className="flex items-center gap-2">
            {wf.archived_at ? (
              <button type="button" onClick={() => run(restoreWorkflow)} className={`${button} border-[#D3DCEE] text-[#122654] hover:bg-[#EAF5FC]`}>Restore</button>
            ) : (
              <button type="button" onClick={() => run(archiveWorkflow, () => router.push(back))} className={`${button} border-[#D3DCEE] text-[#122654] hover:bg-[#EAF5FC]`}>Archive</button>
            )}
            <button type="button" onClick={() => setConfirming(true)} className={`${button} border-[#F0C2BA] text-[#B8432F] hover:bg-[#FFF1EE]`}>Delete</button>
          </div>
        )}
      </div>

      {wf.archived_at && <p role="status" className="text-xs px-3 py-2 rounded-lg bg-[#FFF8E6] text-[#8A5A00]">Archived on {ukDate(wf.archived_at)}. It is hidden from the client page and menu until restored.</p>}
      {error && <p role="alert" className="text-xs text-[#B8432F]">{error}</p>}

      {confirming && (
        <div role="alertdialog" aria-label="Delete workflow" className="p-4 rounded-xl border border-[#F0C2BA] bg-[#FFF8F6] text-xs text-[#122654] space-y-3">
          <p>Delete <strong>{wf.name}</strong> from this year? The {papers.length} working papers and their work stay, but this workflow cannot be brought back. Archive it instead if you may need it again.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => run(deleteWorkflow, () => router.push(back))} className={`${button} bg-[#B8432F] border-[#B8432F] text-white`}>Delete workflow</button>
            <button type="button" onClick={() => setConfirming(false)} className={`${button} border-[#D3DCEE]`}>Cancel</button>
          </div>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.area} aria-labelledby={`area-${g.area}`}>
          <h2 id={`area-${g.area}`} className="flex items-baseline gap-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#4A5878]">
            <span>{g.name}</span>
            <span className="font-normal normal-case tracking-normal text-[#7E8DA6]">{g.papers.length} {g.papers.length === 1 ? 'paper' : 'papers'}</span>
          </h2>
          <ul className="bg-white border border-[#E3E7EF] rounded-xl divide-y divide-[#E3E7EF]">
            {g.papers.map((w) => {
              const status = STATUS_DEFINITIONS[paperStatus(w)];
              return (
                <li key={w.id}>
                  <Link href={`/engagements/${engagementId}/workpapers/${w.id}`} className="flex items-center gap-3 p-3 hover:bg-[#F5F8FD]">
                    <span className="font-mono text-xs text-[#4A5878] w-10 shrink-0">{w.ref}</span>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-[#122654] truncate">{templateOf(w)?.title ?? w.ref}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${status.bgClass} ${status.colorClass}`}>{status.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
