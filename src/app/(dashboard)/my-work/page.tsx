'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AtSign, ClipboardList, FileWarning, MessageSquareWarning, Scale } from 'lucide-react';

interface WorkItem {
  kind: 'assigned' | 'mention' | 'review_point' | 'changed_after_review' | 'journal_to_approve';
  engagement_id: string;
  workpaper_id?: string;
  ref: string;
  detail: string;
  due?: string;
  overdue: boolean;
}

const KIND: Record<WorkItem['kind'], { label: string; icon: React.ElementType }> = {
  assigned: { label: 'Assigned to you', icon: ClipboardList },
  mention: { label: 'Mentioned you', icon: AtSign },
  review_point: { label: 'Review point', icon: MessageSquareWarning },
  changed_after_review: { label: 'Changed after your review', icon: FileWarning },
  journal_to_approve: { label: 'Journal to approve', icon: Scale },
};

/** My work (REV-04): everything waiting on the signed-in person, due dates first; overdue in red. */
export default function MyWorkPage() {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/my-work')
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Could not load your work.');
        setItems(body.items);
      })
      .catch((e) => setError(e.message));
  }, []);

  const href = (i: WorkItem) =>
    i.kind === 'journal_to_approve' ? `/engagements/${i.engagement_id}/journals` : `/engagements/${i.engagement_id}/workpapers/${i.workpaper_id}`;

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-[#122654]">My work</h1>
        <p className="text-xs text-[#4A5878] mt-1">Schedules assigned to you, mentions, review points, schedules changed after your review and journals to approve.</p>
      </div>
      {error && <p role="alert" className="text-xs text-[#B42318]">{error}</p>}
      {!items && !error && <p className="text-xs text-[#4A5878]">Loading…</p>}
      {items && !items.length && <p className="text-sm text-[#4A5878] bg-white border border-[#E3E7EF] rounded-[12px] p-6">Nothing waiting on you.</p>}
      {items && items.length > 0 && (
        <ul className="bg-white border border-[#E3E7EF] rounded-[12px] divide-y divide-[#E3E7EF]">
          {items.map((i, n) => {
            const k = KIND[i.kind];
            return (
              <li key={`${i.kind}-${i.ref}-${n}`}>
                <Link href={href(i)} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F5F8FD]">
                  <k.icon className={`w-4 h-4 mt-0.5 shrink-0 ${i.overdue ? 'text-[#B8432F]' : 'text-[#1D4E89]'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-[#122654]">
                      <span className="font-mono mr-2">{i.ref}</span>
                      {k.label}
                    </span>
                    <span className="block text-[11px] text-[#4A5878] truncate">{i.detail}</span>
                  </span>
                  {i.due && <span className={`text-[11px] font-semibold whitespace-nowrap ${i.overdue ? 'text-[#B8432F]' : 'text-[#4A5878]'}`}>{i.overdue ? 'Overdue · ' : 'Due '}{i.due}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
