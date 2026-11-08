'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';
import { periodLabel } from '@/lib/periods';
import { TEMPLATES, templateFor } from '@/lib/workpapers/templates';
import { StatusBadge } from '@/components/ui/StatusPill';
import { Engagement } from '@/lib/types/models';

/** Every working paper for each of a client's periods, newest first: what's in the file and what can be added. */
export function ClientWorkpapers({ clientId }: { clientId: string }) {
  const [, refresh] = useState(0);
  const engagements = db.engagements.filter((e) => e.client_id === clientId).sort((a, b) => b.period_end.localeCompare(a.period_end));

  const add = (eng: Engagement, ref: string) => {
    const wp = db.addWorkpaper(eng.id, ref);
    db.logAudit(eng.firm_id, getActor(), 'ADD_WORKPAPER', 'workpapers', wp?.id ?? ref, null, { ref });
    refresh((n) => n + 1);
  };

  return (
    <div className="bg-white border border-[#E3E7EF] rounded-xl shadow-xs p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
        <h2 className="text-sm font-bold text-[#122654]">Working papers</h2>
        <span className="text-xs text-[#7E8DA6]">{engagements.length} {engagements.length === 1 ? 'period' : 'periods'}</span>
      </div>

      {!engagements.length && <p className="text-xs text-[#4A5878]">No periods yet. Start a new engagement to create this client’s working papers.</p>}

      {engagements.map((eng, i) => {
        const papers = db.workpapers.filter((w) => w.engagement_id === eng.id).sort((a, b) => a.ref.localeCompare(b.ref));
        const missing = TEMPLATES.filter((t) => !papers.some((w) => w.ref === t.ref));
        const signedOff = papers.filter((w) => w.status === 'signed_off').length;
        const percent = papers.length ? Math.round((signedOff / papers.length) * 100) : 0;
        return (
          <details key={eng.id} open={i === 0} className="group rounded-xl border border-[#E3E7EF]">
            <summary className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 cursor-pointer">
              <span className="min-w-[200px] flex-1">
                <span className="block text-sm font-bold text-[#122654]">{periodLabel(eng)}</span>
                <span className="block text-[11px] text-[#4A5878] mt-0.5">{eng.framework}{eng.status === 'locked' ? ' · Locked' : ''}</span>
              </span>
              <span className="w-full sm:w-52">
                <span className="block text-[11px] text-[#4A5878] mb-1">{signedOff} of {papers.length} signed off</span>
                <span role="progressbar" aria-label={`${periodLabel(eng)}: papers signed off`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="block h-1.5 rounded-full bg-[#EEF2F9] overflow-hidden">
                  <span className="block h-full bg-[#0B6B52]" style={{ width: `${percent}%` }} />
                </span>
              </span>
              <Link href={`/engagements/${eng.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4E89] hover:underline">
                Open engagement <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </summary>

            <div className="px-4 pb-4 space-y-3">
              <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 border-t border-[#E3E7EF]">
                {papers.map((w) => (
                  <li key={w.id} className="border-b border-[#E3E7EF]">
                    <Link href={`/engagements/${eng.id}/workpapers/${w.id}`} className="flex items-center gap-3 py-2 hover:bg-[#F5F8FD] text-xs text-[#122654]">
                      <span className="font-mono font-bold text-[#1D4E89] w-10 shrink-0">{w.ref}</span>
                      <span className="flex-1 min-w-0">{templateFor(w.ref)?.title ?? w.ref}</span>
                      <StatusBadge status={w.status} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>

              {missing.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6] py-1.5">Not in this file ({missing.length})</h3>
                  <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                    {missing.map((t) => (
                      <li key={t.ref} className="flex items-center gap-3 py-1.5 border-b border-[#E3E7EF] text-xs text-[#4A5878]">
                        <span className="font-mono font-bold w-10 shrink-0">{t.ref}</span>
                        <span className="flex-1 min-w-0">{t.title}</span>
                        {eng.status !== 'locked' && (
                          <button type="button" onClick={() => add(eng, t.ref)} aria-label={`Add ${t.ref} ${t.title} to ${periodLabel(eng)}`} className="inline-flex items-center gap-1 font-bold text-[#1D4E89] hover:underline cursor-pointer">
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
