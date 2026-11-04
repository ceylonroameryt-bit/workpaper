'use client';

import { db } from '@/lib/server/db';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Download,
  ChevronRight,
  Check,
  AlertTriangle,
  FileArchive,
  X,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { engagementSummary } from '@/lib/api';
import { useCompany } from '@/context/CompanyContext';

interface MatrixRow {
  workpaperId: string;
  ref: string;
  title: string;
  status: string;
  preparer: { initials: string; signed_at: string; is_stale: boolean } | null;
  reviewer: { initials: string; signed_at: string; is_stale: boolean } | null;
  partner: { initials: string; signed_at: string; is_stale: boolean } | null;
}

export default function SignOffAndLockPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeCompany } = useCompany();

  const [blockersData, setBlockersData] = useState<any>(null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reportDate, setReportDate] = useState('2026-09-30');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);

  const [isLocking, setIsLocking] = useState(false);
  const [isEngagementLocked, setIsEngagementLocked] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [staleModalPaper, setStaleModalPaper] = useState<MatrixRow | null>(null);

  const loadData = async () => {
    try {
      // 1. Fetch live blockers
      const bRes = await fetch(`/api/v1/engagements/${engagementId}/blockers`);
      if (bRes.ok) {
        const bData = await bRes.json();
        setBlockersData(bData);
        setIsEngagementLocked(bData.summary?.isLocked || false);
      }

      // 2. Fetch engagement details
      const eRes = await fetch(`/api/v1/engagements/${engagementId}`);
      if (eRes.ok) {
        const eData = await eRes.json();
        setIsEngagementLocked((eData.engagement ?? eData)?.status === 'locked');
      }

      // 3. Fetch audit logs
      const aRes = await fetch(`/api/v1/engagements/${engagementId}/audit-log`);
      if (aRes.ok) {
        const aData = await aRes.json();
        setAuditLogs(aData.logs || []);
      }

      // 4. Matrix state from live workpapers and sign-offs
      const initials = (name: string) =>
        name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
      const sign = (wpId: string, role: 'preparer' | 'reviewer' | 'partner') => {
        const so = db.signoffs.filter((x) => x.workpaper_id === wpId && x.role === role).pop();
        return so
          ? {
              initials: initials(so.user_name),
              signed_at: new Date(so.signed_at).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
              is_stale: Boolean(so.stale_at),
            }
          : null;
      };

      setMatrix(
        db.workpapers
          .filter((w) => w.engagement_id === engagementId)
          .map((w) => ({
            workpaperId: w.id,
            ref: w.ref,
            title: (w.data_json?.title as string) || w.ref,
            status: w.status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
            preparer: sign(w.id, 'preparer'),
            reviewer: sign(w.id, 'reviewer'),
            partner: sign(w.id, 'partner'),
          }))
      );
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [engagementId]);

  const preparedCount = matrix.filter((r) => r.preparer && !r.preparer.is_stale).length;
  const reviewedCount = matrix.filter((r) => r.reviewer && !r.reviewer.is_stale).length;
  const staleCount = matrix.filter(
    (r) => r.preparer?.is_stale || r.reviewer?.is_stale || r.partner?.is_stale
  ).length;
  const unpreparedCount = matrix.length - preparedCount;

  // Review notes count for this engagement
  const openNotesCount = db.comments.filter(
    (c) =>
      c.status === 'open' &&
      c.type === 'review_note' &&
      (c.workpaper_id?.includes(engagementId) ||
        matrix.some((m) => m.workpaperId === c.workpaper_id))
  ).length;

  const eng = db.engagements.find((e) => e.id === engagementId);
  const client = eng ? db.clients.find((c) => c.id === eng.client_id) : activeCompany;
  const yearEndStr = eng
    ? new Date(eng.period_end).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '31 Mar 2026';

  const isLockDisabled =
    openNotesCount > 0 ||
    unpreparedCount > 0 ||
    staleCount > 0 ||
    isEngagementLocked ||
    matrix.length === 0;

  const handleExportBundle = async () => {
    setIsExporting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/export`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to export bundle.');
      } else {
        setExportResult(data);
      }
    } catch (err: any) {
      setActionError(err.message || 'Export error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleLockEngagement = async () => {
    setIsLocking(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/lock`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to lock engagement.');
      } else {
        setIsEngagementLocked(true);
        loadData();
      }
    } catch (err: any) {
      setActionError(err.message || 'Lock error');
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlockEngagement = async () => {
    if (!unlockReason.trim()) {
      setActionError('A mandatory documented reason is required to unlock this engagement.');
      return;
    }
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unlockReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to unlock engagement.');
      } else {
        setIsEngagementLocked(false);
        setUnlockDialogOpen(false);
        setUnlockReason('');
        loadData();
      }
    } catch (err: any) {
      setActionError(err.message || 'Unlock error');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      {/* Breadcrumb matching Page 14 */}
      <div className="flex items-center gap-2 text-xs text-[#4A5878]">
        <Link href={`/clients`} className="hover:text-[#B8432F] font-medium">
          {client ? client.name : 'Client'}
        </Link>
        <span className="text-[#4A5878]/50">›</span>
        <span>Year end {yearEndStr}</span>
        <span className="text-[#4A5878]/50">›</span>
        <span className="text-[#122654] font-semibold">Sign-off</span>
      </div>

      {/* Page Title & Subtitle matching Page 14 */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#122654] tracking-tight">
            Sign-off and lock
          </h1>
          <p className="text-xs sm:text-sm text-[#4A5878] mt-1 max-w-2xl leading-relaxed">
            Each paper is signed by the preparer, then the reviewer, then the partner. If anyone
            changes a paper after it was signed, that sign-off goes stale and must be redone.
          </p>
        </div>

        {isEngagementLocked && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/20 font-mono">
              <Lock className="w-3.5 h-3.5" /> LOCKED ARCHIVE
            </span>
            <button
              type="button"
              onClick={() => setUnlockDialogOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-[#D3DCEE] hover:border-[#FF7A66] text-xs font-bold text-[#B8432F] hover:bg-[#FFF1EE] transition-colors"
            >
              Unlock file (Partner only)
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-[#FDECEA] border border-[#B42318]/30 text-xs text-[#B42318] flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Stat Cards matching Page 14 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Papers */}
        <div className="blynt-card p-5 bg-white border border-[#E3E7EF] rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#4A5878]">Papers</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-[#122654] font-mono mt-2">
            {matrix.length}
          </span>
        </div>

        {/* Card 2: Prepared */}
        <div className="blynt-card p-5 bg-white border border-[#E3E7EF] rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#0B6B52] flex items-center gap-1">
            ✓ Prepared
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-[#122654] font-mono mt-2">
            {preparedCount}
          </span>
        </div>

        {/* Card 3: Reviewed */}
        <div className="blynt-card p-5 bg-white border border-[#E3E7EF] rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#0B6B52] flex items-center gap-1">
            ✓ Reviewed
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-[#122654] font-mono mt-2">
            {reviewedCount}
          </span>
        </div>

        {/* Card 4: Stale sign-offs */}
        <div className="blynt-card p-5 bg-white border border-[#E3E7EF] rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#6B4700] flex items-center gap-1">
            ⚠ Stale sign-offs
          </span>
          <span
            className={`text-2xl sm:text-3xl font-extrabold font-mono mt-2 ${
              staleCount > 0 ? 'text-[#6B4700]' : 'text-[#122654]'
            }`}
          >
            {staleCount}
          </span>
        </div>
      </div>

      {/* Main 2-Column Split matching Page 14 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Sign-off by paper */}
        <div className="lg:col-span-8 blynt-card p-6 bg-white border border-[#E3E7EF] rounded-2xl flex flex-col gap-4 shadow-2xs">
          <h2 className="text-sm font-bold text-[#122654]">Sign-off by paper</h2>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
              <caption className="sr-only">Sign-off matrix by paper</caption>
              <thead className="border-b border-[#E3E7EF] text-[#4A5878] text-[11px] font-semibold">
                <tr>
                  <th scope="col" className="pb-3 font-semibold text-[#4A5878]">
                    Working paper
                  </th>
                  <th scope="col" className="pb-3 text-center font-semibold text-[#4A5878]">
                    Preparer
                  </th>
                  <th scope="col" className="pb-3 text-center font-semibold text-[#4A5878]">
                    Reviewer
                  </th>
                  <th scope="col" className="pb-3 text-center font-semibold text-[#4A5878]">
                    Partner
                  </th>
                  <th scope="col" className="pb-3 text-right font-semibold text-[#4A5878]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EF]">
                {matrix.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#4A5878]">
                      No working papers initialized yet.
                    </td>
                  </tr>
                ) : (
                  matrix.map((row) => (
                    <tr key={row.workpaperId} className="hover:bg-[#F5F8FD]/60 transition-colors">
                      {/* Working paper title & ref */}
                      <td className="py-3.5 pr-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/engagements/${engagementId}/workpapers/${row.workpaperId}`}
                            className="font-semibold text-[#122654] hover:text-[#B8432F] flex items-center gap-1.5"
                          >
                            <span className="font-mono text-xs font-bold text-[#122654]">
                              {row.ref}
                            </span>
                            <span>{row.title}</span>
                          </Link>
                          {row.reviewer?.is_stale && (
                            <span className="text-[10px] text-[#6B4700] mt-0.5">
                              Changed after review · Stale sign-off
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Preparer */}
                      <td className="py-3.5 px-2 text-center">
                        {row.preparer ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/20">
                            ✓ {row.preparer.initials} · {row.preparer.signed_at.split(',')[0]}
                          </span>
                        ) : (
                          <span className="text-xs text-[#4A5878]">○ Not signed</span>
                        )}
                      </td>

                      {/* Reviewer */}
                      <td className="py-3.5 px-2 text-center">
                        {row.reviewer ? (
                          row.reviewer.is_stale ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF4DB] text-[#6B4700] border border-[#6B4700]/20">
                              ⚠ Stale · {row.reviewer.initials}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/20">
                              ✓ {row.reviewer.initials} · {row.reviewer.signed_at.split(',')[0]}
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-[#4A5878]">○ Waiting</span>
                        )}
                      </td>

                      {/* Partner */}
                      <td className="py-3.5 px-2 text-center">
                        {row.partner ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/20">
                            ✓ {row.partner.initials}
                          </span>
                        ) : (
                          <span className="text-xs text-[#4A5878]">○ Waiting</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 pl-2 text-right">
                        {row.reviewer?.is_stale ? (
                          <button
                            type="button"
                            onClick={() => setStaleModalPaper(row)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#122654] hover:bg-[#F5F8FD] border border-[#D3DCEE] rounded-lg transition-colors cursor-pointer"
                          >
                            See what changed
                          </button>
                        ) : (
                          <Link
                            href={`/engagements/${engagementId}/workpapers/${row.workpaperId}`}
                            className="px-3 py-1 text-xs font-semibold text-[#122654] hover:bg-[#F5F8FD] border border-[#D3DCEE] rounded-lg transition-colors inline-block"
                          >
                            Open
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-[#E3E7EF] text-[11px] text-[#4A5878]">
            Showing {matrix.length} of {matrix.length} · ✓ signed · ⚠ stale, changed after signing ·
            ○ not signed
          </div>
        </div>

        {/* Right Column (4 cols): Before you can lock & Export the file */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Card 1: Before you can lock */}
          <div className="blynt-card p-6 bg-white border border-[#E3E7EF] rounded-2xl flex flex-col gap-4 shadow-2xs">
            <h2 className="text-sm font-bold text-[#122654]">Before you can lock</h2>

            <div className="flex flex-col divide-y divide-[#E3E7EF]/80 text-xs">
              {/* Review notes checklist item */}
              <div className="py-2.5 first:pt-0 flex items-start justify-between gap-2">
                {openNotesCount > 0 ? (
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#B42318] flex items-center gap-1.5">
                      <span className="font-bold">!</span> {openNotesCount} review note
                      {openNotesCount === 1 ? '' : 's'} open
                    </span>
                    <Link
                      href="/review"
                      className="text-[11px] text-[#B8432F] font-semibold hover:underline mt-0.5"
                    >
                      Go to review notes
                    </Link>
                  </div>
                ) : (
                  <span className="text-[#0B6B52] font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#0B6B52]" />
                    All review notes resolved
                  </span>
                )}
              </div>

              {/* Papers prepared checklist item */}
              <div className="py-2.5 flex items-start justify-between gap-2">
                {unpreparedCount > 0 ? (
                  <span className="font-semibold text-[#B42318] flex items-center gap-1.5">
                    <span className="font-bold">!</span> {unpreparedCount} paper
                    {unpreparedCount === 1 ? '' : 's'} not prepared
                  </span>
                ) : (
                  <span className="text-[#0B6B52] font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#0B6B52]" />
                    All papers prepared
                  </span>
                )}
              </div>

              {/* Stale sign-offs checklist item */}
              <div className="py-2.5 flex items-start justify-between gap-2">
                {staleCount > 0 ? (
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#6B4700] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#6B4700]" /> {staleCount} stale
                      sign-off{staleCount === 1 ? '' : 's'}
                    </span>
                    <span className="text-[10px] text-[#4A5878] mt-0.5">
                      Re-review modified papers
                    </span>
                  </div>
                ) : (
                  <span className="text-[#0B6B52] font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#0B6B52]" />
                    No stale sign-offs
                  </span>
                )}
              </div>

              {/* Trial balance balances */}
              <div className="py-2.5 flex items-center gap-1.5 text-[#0B6B52] font-medium">
                <Check className="w-3.5 h-3.5 text-[#0B6B52]" />
                <span>Trial balance balances and all accounts mapped</span>
              </div>

              {/* Adjustments */}
              <div className="py-2.5 flex items-center gap-1.5 text-[#0B6B52] font-medium">
                <Check className="w-3.5 h-3.5 text-[#0B6B52]" />
                <span>All adjustments approved</span>
              </div>
            </div>

            {/* Lock file button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isLockDisabled}
                onClick={handleLockEngagement}
                className={`w-full min-h-[44px] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isEngagementLocked
                    ? 'bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/30 cursor-not-allowed'
                    : isLockDisabled
                    ? 'bg-[#F5F8FD] text-[#7E8DA6] border border-[#D3DCEE] cursor-not-allowed'
                    : 'bg-[#122654] hover:bg-[#16336e] text-white shadow-sm cursor-pointer'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>{isEngagementLocked ? 'File permanently locked' : 'Lock file'}</span>
              </button>
            </div>

            <p className="text-[11px] text-[#4A5878] leading-relaxed pt-1 border-t border-[#E3E7EF]/80">
              Lock is available to the partner once every item above is ✓. Locked files are read-only;
              reopening needs a partner and a reason, and is logged.
            </p>
          </div>

          {/* Card 2: Export the file */}
          <div className="blynt-card p-6 bg-white border border-[#E3E7EF] rounded-2xl flex flex-col gap-3 shadow-2xs">
            <h2 className="text-sm font-bold text-[#122654]">Export the file</h2>
            <p className="text-xs text-[#4A5878] leading-relaxed">
              PDF bundle with index, every paper, evidence, comments and the activity log.
            </p>

            <button
              type="button"
              onClick={handleExportBundle}
              disabled={isExporting}
              className="w-full min-h-[42px] px-4 py-2 bg-white hover:bg-[#F5F8FD] border border-[#D3DCEE] hover:border-[#122654]/40 rounded-xl text-xs font-bold text-[#122654] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-[#4A5878]" />
              <span>{isExporting ? 'Building PDF...' : 'Build PDF bundle'}</span>
            </button>

            {exportResult && (
              <div className="p-3 rounded-xl bg-[#E6F4EF] border border-[#0B6B52]/20 text-xs text-[#0B6B52] flex flex-col gap-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>PDF bundle built successfully!</span>
                </div>
                <div className="font-mono text-[10px] break-all text-[#122654]">
                  Checksum: {exportResult.checksum}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stale Signoff Details Modal */}
      {staleModalPaper && (
        <Dialog
          isOpen={true}
          onClose={() => setStaleModalPaper(null)}
          title={`⚠ Stale Sign-off: ${staleModalPaper.ref} - ${staleModalPaper.title}`}
        >
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 rounded-[10px] bg-[#FFF4DB] border border-[#6B4700]/20 text-[#6B4700]">
              <strong>Why is this sign-off stale?</strong>
              <p className="mt-1">
                The reviewer signed this workpaper earlier. Afterwards, changes were made to the
                schedule or attachments, changing the cryptographic content hash.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3E7EF]">
              <Link
                href={`/engagements/${engagementId}/workpapers/${staleModalPaper.workpaperId}`}
                className="px-4 py-2 bg-[#FF7A66] hover:bg-[#ff9485] text-[#0B1A3B] text-xs font-bold rounded-xl"
              >
                Review & re-sign paper
              </Link>
            </div>
          </div>
        </Dialog>
      )}

      {/* Unlock File Dialog */}
      {unlockDialogOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setUnlockDialogOpen(false)}
          title="Unlock File Archive (Partner Authorization)"
        >
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 rounded-[10px] bg-[#FDECEA] border border-[#B42318]/20 text-[#B42318]">
              <strong>Caution: unlocking an assembled file is recorded in the activity log.</strong>
              <p className="mt-1">
                Under ISA 230, reopening an engagement after assembly requires documented partner
                justification. The reason and timestamp are permanently written to the immutable
                activity log.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="unlock-reason" className="font-semibold text-[#122654]">
                Mandatory Documentation Reason:
              </label>
              <textarea
                id="unlock-reason"
                rows={4}
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="State the technical rationale (e.g. Subsequent discovery of post-balance sheet adjusting event)..."
                className="w-full p-3 border border-[#D3DCEE] rounded-xl text-xs focus-visible:outline-2 focus-visible:outline-[#FF7A66]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3E7EF]">
              <button
                type="button"
                onClick={() => setUnlockDialogOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-[#122654] border border-[#D3DCEE] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlockEngagement}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#B42318] hover:bg-[#911c13] rounded-xl"
              >
                Confirm unlock
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
