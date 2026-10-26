'use client';

import { getActor } from '@/lib/session';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Table2,
  SlidersHorizontal,
  MessageSquare,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tile } from '@/components/ui/Tile';
import { AiCard } from '@/components/ui/AiCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable } from '@/components/ui/DataTable';
import { getEngagement, getWorkpapers, engagementSummary } from '@/lib/api';
import { EngagementSummary, WorkpaperItem } from '@/lib/types';

export default function EngagementOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';

  const [engagement, setEngagement] = useState<EngagementSummary>(() => engagementSummary(engagementId));
  const [workpapers, setWorkpapers] = useState<WorkpaperItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'needs_review' | 'flagged'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getEngagement(engagementId).then(setEngagement);
    getWorkpapers(engagementId).then(setWorkpapers);
  }, [engagementId]);

  const flaggedWorkpapers = workpapers.filter((w) => w.flaggedByAi);
  const me = getActor().name;
  const isMine = (w: WorkpaperItem) => w.preparer === me || w.reviewer === me;
  const mineCount = workpapers.filter(isMine).length;
  const needsReviewCount = workpapers.filter(
    (w) => w.status === 'Prepared' || w.status === 'Needs attention'
  ).length;

  const tabs = [
    { id: 'all', label: 'All Workpapers', count: workpapers.length },
    { id: 'mine', label: 'Mine', count: mineCount },
    { id: 'needs_review', label: 'Needs review', count: needsReviewCount },
    { id: 'flagged', label: 'Flagged by AI', count: flaggedWorkpapers.length },
  ];

  const filteredWorkpapers = workpapers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.area.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'mine') {
      return isMine(w);
    }
    if (activeTab === 'needs_review') {
      return w.status === 'Prepared' || w.status === 'Needs attention';
    }
    if (activeTab === 'flagged') {
      return w.flaggedByAi === true;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[28px] font-semibold text-[#1B2430] tracking-tight">
              {engagement.clientName}
            </h1>
            <StatusPill status={engagement.stage} />
          </div>
          <p className="text-sm text-[#5B6676] mt-0.5 font-mono-numbers">
            {engagement.period} • Year End: {engagement.yearEnd} • Standard: {engagement.framework}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href={`/engagements/${engagementId}/workpapers`}>
            <Button
              variant="primary"
              size="md"
              icon={<FileSpreadsheet className="w-4 h-4" />}
            >
              Working paper index (WPS)
            </Button>
          </Link>
          <Link href={`/engagements/${engagementId}/trial-balance`}>
            <Button
              variant="outline"
              size="md"
              icon={<Table2 className="w-4 h-4 text-[#1E4FD8]" />}
            >
              Trial balance
            </Button>
          </Link>
          <Link href={`/engagements/${engagementId}/review`}>
            <Button
              variant="outline"
              size="md"
              icon={<CheckCircle2 className="w-4 h-4 text-[#0B6B4D]" />}
            >
              Review &amp; Approval
            </Button>
          </Link>
        </div>
      </div>

      {/* Four Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          title="Prepared"
          value={`${engagement.preparedWorkpapers} of ${engagement.totalWorkpapers}`}
          subtitle={
            <span className="flex items-center gap-1 text-[#1E4FD8]">
              <Clock className="w-3.5 h-3.5" />
              <span>Marked as prepared</span>
            </span>
          }
        />
        <Tile
          title="Reviewed"
          value={`${engagement.reviewedWorkpapers} of ${engagement.totalWorkpapers}`}
          subtitle={
            <span className="flex items-center gap-1 text-[#0B6B4D]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Signed off by reviewer</span>
            </span>
          }
        />
        <Tile
          title="Open review notes"
          value={String(engagement.openReviewNotes)}
          subtitle={
            <span className="flex items-center gap-1 text-[#9A4A00]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Blocks partner lock</span>
            </span>
          }
        />
        <Tile
          title="Partner lock"
          value={engagement.partnerLockStatus}
          subtitle={
            <span className="flex items-center gap-1 text-[#5B6676]">
              <Lock className="w-3.5 h-3.5" />
              <span>Requires 0 open review notes</span>
            </span>
          }
          isMonoNumber={false}
        />
      </div>

      {/* Violet AI Review Panel listing flagged items with a Review link */}
      {flaggedWorkpapers.length > 0 && (
      <AiCard
        title="AI Anomaly & Variance Monitor"
        badge="Continuous Audit AI"
        action={
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#DDD6FA] text-[#3F2A9E]">
            {flaggedWorkpapers.length} exceptions flagged
          </span>
        }
      >
        <div className="flex flex-col gap-2.5 mt-1">
          {flaggedWorkpapers.map((wp) => (
            <div
              key={wp.id}
              className="bg-white/80 rounded-[10px] p-3 border border-[#DDD6FA] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#5B3FD0] mt-1.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#1B2430]">
                      {wp.ref}: {wp.name}
                    </span>
                    <span className="text-[11px] text-[#5B6676]">({wp.area})</span>
                  </div>
                  <p className="text-xs text-[#3F2A9E] mt-0.5">
                    {wp.aiFlagReason}
                  </p>
                </div>
              </div>

              <Link
                href={`/engagements/${engagementId}/workpapers/${wp.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B3FD0] hover:text-[#3F2A9E] bg-[#F3F0FE] hover:bg-[#eae3fc] px-3 py-1.5 rounded-[8px] border border-[#DDD6FA] shrink-0 transition-colors"
              >
                <span>Review</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </AiCard>
      )}

      {/* Workpaper Table with Tabs */}
      <DataTable
        title="Engagement Workpapers & Lead Schedules"
        subtitle={`${workpapers.length} working papers in this engagement`}
      >
        {/* Filter and Tab Bar */}
        <div className="p-4 border-b border-[#E3E6EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as any)}
          />

          <div className="relative flex items-center min-w-[240px]">
            <Search className="w-4 h-4 text-[#5B6676] absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by ref, name, or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[38px] pl-9 pr-3 text-xs bg-[#F4F5F7] border border-[#D5D9E0] rounded-[10px] text-[#1B2430] placeholder:text-[#5B6676] focus-visible:outline-2 focus-visible:outline-[#1E4FD8] focus-visible:outline-offset-2"
            />
          </div>
        </div>

        {/* Table Content */}
        <table className="w-full text-left text-sm text-[#1B2430]">
          <thead className="bg-[#F8F9FA] text-[#5B6676] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E3E6EB]">
            <tr>
              <th scope="col" className="px-5 py-3.5">
                Ref
              </th>
              <th scope="col" className="px-5 py-3.5">
                Workpaper Name
              </th>
              <th scope="col" className="px-5 py-3.5">
                Audit Area
              </th>
              <th scope="col" className="px-5 py-3.5">
                Preparer
              </th>
              <th scope="col" className="px-5 py-3.5">
                Status
              </th>
              <th scope="col" className="px-5 py-3.5 text-center">
                Notes
              </th>
              <th scope="col" className="px-5 py-3.5">
                Updated
              </th>
              <th scope="col" className="px-5 py-3.5 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E6EB]">
            {filteredWorkpapers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-xs text-[#5B6676]">
                  No working papers match this view.
                </td>
              </tr>
            )}
            {filteredWorkpapers.map((wp) => (
              <tr
                key={wp.id}
                className="hover:bg-[#F8F9FA]/80 transition-colors group cursor-pointer"
                onClick={() => router.push(`/engagements/${engagementId}/workpapers/${wp.id}`)}
              >
                <td className="px-5 py-4 font-mono-numbers font-semibold text-xs text-[#1E4FD8] whitespace-nowrap">
                  {wp.ref}
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#1B2430] group-hover:text-[#1E4FD8] transition-colors">
                      {wp.name}
                    </span>
                    {wp.flaggedByAi && (
                      <span
                        className="p-1 rounded-full bg-[#F3F0FE] text-[#5B3FD0] shrink-0 border border-[#DDD6FA]"
                        title={wp.aiFlagReason}
                      >
                        <Sparkles className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-5 py-4 text-xs text-[#5B6676] whitespace-nowrap">
                  {wp.area}
                </td>

                <td className="px-5 py-4 text-xs font-medium text-[#1B2430] whitespace-nowrap">
                  {wp.preparer}
                </td>

                <td className="px-5 py-4 whitespace-nowrap">
                  <StatusPill status={wp.status} />
                </td>

                <td className="px-5 py-4 text-center whitespace-nowrap">
                  {wp.notesCount > 0 ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono-numbers font-semibold bg-[#FFF1DC] text-[#9A4A00]">
                      {wp.notesCount}
                    </span>
                  ) : (
                    <span className="text-xs text-[#5B6676]/50 font-mono-numbers">—</span>
                  )}
                </td>

                <td className="px-5 py-4 text-xs font-mono-numbers text-[#5B6676] whitespace-nowrap">
                  {wp.updatedAt}
                </td>

                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <Link
                    href={`/engagements/${engagementId}/workpapers/${wp.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E4FD8] hover:text-[#163BA3] px-3 py-1.5 rounded-[8px] hover:bg-[#E8EEFD] transition-colors"
                  >
                    <span>Open editor</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
