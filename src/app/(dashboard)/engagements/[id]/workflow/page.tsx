'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, Lock } from 'lucide-react';
import { db } from '@/lib/server/db';
import { buildWorkflow, StepState } from '@/lib/workflow';
import { ukDate } from '@/lib/dates';

const STATE: Record<StepState, { label: string; pill: string }> = {
  todo: { label: 'To do', pill: 'bg-[#F5F8FD] text-[#4A5878]' },
  doing: { label: 'In progress', pill: 'bg-[#EAF5FC] text-[#1D4E89]' },
  done: { label: 'Done', pill: 'bg-[#E6F4EF] text-[#0B6B52]' },
  blocked: { label: 'Waiting', pill: 'bg-[#FFF8E6] text-[#8A5A00]' },
};

export default function WorkflowPage() {
  const engagementId = (useParams()?.id as string) ?? '';
  const eng = db.engagements.find((e) => e.id === engagementId);
  const client = db.clients.find((c) => c.id === eng?.client_id);
  const steps = buildWorkflow(engagementId);
  const finished = steps.filter((s) => s.state === 'done').length;
  const next = steps.find((s) => s.state !== 'done');

  if (!eng) return <div className="p-6 text-sm text-[#4A5878]">Engagement not found.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#122654]">Workflow</h1>
        <p className="text-sm text-[#4A5878]">
          {client?.name ?? 'Client'} · {ukDate(eng.period_start)} to {ukDate(eng.period_end)}
        </p>
      </div>

      <div className="bg-white border border-[#E3E7EF] rounded-xl p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-[#122654] mb-2">
          <span>{finished} of {steps.length} steps done</span>
          {next && <Link href={next.href} className="text-[#B8432F] hover:underline">Next: {next.title}</Link>}
        </div>
        <div className="h-2 rounded-full bg-[#EAF0F8] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={finished} aria-label="Workflow progress">
          <div className="h-full bg-[#0B6B52]" style={{ width: `${(finished / steps.length) * 100}%` }} />
        </div>
      </div>

      <ol className="bg-white border border-[#E3E7EF] rounded-xl divide-y divide-[#E3E7EF]">
        {steps.map((s, i) => {
          const meta = STATE[s.state];
          return (
            <li key={s.key}>
              <Link href={s.href} className="flex items-center gap-3 p-4 hover:bg-[#F5F8FD]">
                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${s.state === 'done' ? 'bg-[#0B6B52] text-white' : 'bg-[#EAF0F8] text-[#122654]'}`}>
                  {s.state === 'done' ? <Check className="w-4 h-4" aria-hidden="true" /> : s.state === 'blocked' ? <Lock className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#122654]">{s.title}</span>
                  <span className="block text-xs text-[#4A5878]">{s.state === 'blocked' ? s.blockedBy : s.detail}</span>
                </span>
                {s.total > 1 && s.state !== 'blocked' && (
                  <span className="hidden sm:block w-24 h-1.5 rounded-full bg-[#EAF0F8] overflow-hidden" aria-hidden="true">
                    <span className="block h-full bg-[#1D4E89]" style={{ width: `${Math.min(100, (s.done / s.total) * 100)}%` }} />
                  </span>
                )}
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${meta.pill}`}>{meta.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
