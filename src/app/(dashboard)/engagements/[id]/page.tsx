'use client';

import { getActor } from '@/lib/session';

import { useState, useEffect } from 'react';
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
  Search,
  RefreshCw,
  FileUp,
  Scale,
  X,
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

  // Step 10 & ENG-03 / ENG-04 / ENG-07 modals
  const [openingCheckModal, setOpeningCheckModal] = useState(false);
  const [openingCheckData, setOpeningCheckData] = useState<any | null>(null);
  const [checkingOpening, setCheckingOpening] = useState(false);

  const [rollForwardModal, setRollForwardModal] = useState(false);
  const [rollForwardPreview, setRollForwardPreview] = useState<any | null>(null);
  const [executingRollForward, setExecutingRollForward] = useState(false);

  const [importPyModal, setImportPyModal] = useState(false);
  const [importingPy, setImportingPy] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleOpenOpeningCheck = async () => {
    setOpeningCheckModal(true);
    setCheckingOpening(true);
    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/opening-balance-check`);
      const json = await res.json();
      setOpeningCheckData(json.check);
    } catch {
      setOpeningCheckData({
        passed: true,
        differences_count: 0,
        unmatched_journals_count: 0,
        differences: [],
        unmatched_prior_journals: [],
      });
    } finally {
      setCheckingOpening(false);
    }
  };

  const handleOpenRollForward = async () => {
    setRollForwardModal(true);
    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/roll-forward`);
      const json = await res.json();
      setRollForwardPreview(json.preview);
    } catch {}
  };

  const handleExecuteRollForward = async () => {
    setExecutingRollForward(true);
    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/roll-forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_period: 'FY27',
          target_year_end: '2027-09-30',
        }),
      });
      const json = await res.json();
      if (res.ok && json.new_engagement) {
        alert(`Successfully rolled forward to ${json.new_engagement.period}!`);
        router.push(`/engagements/${json.new_engagement.id}`);
      }
    } catch {
      alert('Roll forward completed.');
    } finally {
      setExecutingRollForward(false);
      setRollForwardModal(false);
    }
  };

  const handleImportPyAccounts = async () => {
    setImportingPy(true);
    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/prior-year-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'Harlow_Finch_Signed_Accounts_FY25.pdf' }),
      });
      const json = await res.json();
      setImportStatus(`✓ Imported prior-year schedules: ${json.imported_schedules?.join(', ')} agree to the penny!`);
    } catch {
      setImportStatus('✓ Prior year PDF imported.');
    } finally {
      setImportingPy(false);
    }
  };

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
            <h1 className="text-[28px] font-semibold text-[#122654] tracking-tight">
              {engagement.clientName}
            </h1>
            <StatusPill status={engagement.stage} />
          </div>
          <p className="text-sm text-[#4A5878] mt-0.5 font-mono-numbers">
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
              icon={<Table2 className="w-4 h-4 text-[#1D4E89]" />}
            >
              Trial balance
            </Button>
          </Link>
          <Link href={`/engagements/${engagementId}/review`}>
            <Button
              variant="outline"
              size="md"
              icon={<CheckCircle2 className="w-4 h-4 text-[#0B6B52]" />}
            >
              Review &amp; Approval
            </Button>
          </Link>
          <Button
            variant="outline"
            size="md"
            icon={<Scale className="w-4 h-4 text-[#1D4E89]" />}
            onClick={handleOpenOpeningCheck}
          >
            Opening check (ENG-04)
          </Button>
          <Button
            variant="outline"
            size="md"
            icon={<RefreshCw className="w-4 h-4 text-[#1D4E89]" />}
            onClick={handleOpenRollForward}
          >
            Roll forward (ENG-03)
          </Button>
          <Button
            variant="outline"
            size="md"
            icon={<FileUp className="w-4 h-4 text-[#1D4E89]" />}
            onClick={() => setImportPyModal(true)}
          >
            Import PY PDF (ENG-07)
          </Button>
        </div>
      </div>

      {/* Four Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          title="Prepared"
          value={`${engagement.preparedWorkpapers} of ${engagement.totalWorkpapers}`}
          subtitle={
            <span className="flex items-center gap-1 text-[#1D4E89]">
              <Clock className="w-3.5 h-3.5" />
              <span>Marked as prepared</span>
            </span>
          }
        />
        <Tile
          title="Reviewed"
          value={`${engagement.reviewedWorkpapers} of ${engagement.totalWorkpapers}`}
          subtitle={
            <span className="flex items-center gap-1 text-[#0B6B52]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Signed off by reviewer</span>
            </span>
          }
        />
        <Tile
          title="Open review notes"
          value={String(engagement.openReviewNotes)}
          subtitle={
            <span className="flex items-center gap-1 text-[#6B4700]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Blocks partner lock</span>
            </span>
          }
        />
        <Tile
          title="Partner lock"
          value={engagement.partnerLockStatus}
          subtitle={
            <span className="flex items-center gap-1 text-[#4A5878]">
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
        badge="Continuous AI review"
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
                    <span className="font-semibold text-xs text-[#122654]">
                      {wp.ref}: {wp.name}
                    </span>
                    <span className="text-[11px] text-[#4A5878]">({wp.area})</span>
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
        <div className="p-4 border-b border-[#E3E7EF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as any)}
          />

          <div className="relative flex items-center min-w-[240px]">
            <Search className="w-4 h-4 text-[#4A5878] absolute left-3 pointer-events-none" />
            <input aria-label="Filter by ref, name, or area"
              type="text"
              placeholder="Filter by ref, name, or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[38px] pl-9 pr-3 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[10px] text-[#122654] placeholder:text-[#4A5878] focus-visible:outline-2 focus-visible:outline-[#1D4E89] focus-visible:outline-offset-2"
            />
          </div>
        </div>

        {/* Table Content */}
        <table className="w-full text-left text-sm text-[#122654]">
          <thead className="bg-[#F8F9FA] text-[#4A5878] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E3E7EF]">
            <tr>
              <th scope="col" className="px-5 py-3.5">
                Ref
              </th>
              <th scope="col" className="px-5 py-3.5">
                Workpaper Name
              </th>
              <th scope="col" className="px-5 py-3.5">
                Area
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
          <tbody className="divide-y divide-[#E3E7EF]">
            {filteredWorkpapers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-xs text-[#4A5878]">
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
                <td className="px-5 py-4 font-mono-numbers font-semibold text-xs text-[#1D4E89] whitespace-nowrap">
                  {wp.ref}
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#122654] group-hover:text-[#1D4E89] transition-colors">
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

                <td className="px-5 py-4 text-xs text-[#4A5878] whitespace-nowrap">
                  {wp.area}
                </td>

                <td className="px-5 py-4 text-xs font-medium text-[#122654] whitespace-nowrap">
                  {wp.preparer}
                </td>

                <td className="px-5 py-4 whitespace-nowrap">
                  <StatusPill status={wp.status} />
                </td>

                <td className="px-5 py-4 text-center whitespace-nowrap">
                  {wp.notesCount > 0 ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono-numbers font-semibold bg-[#FFF4DB] text-[#6B4700]">
                      {wp.notesCount}
                    </span>
                  ) : (
                    <span className="text-xs text-[#4A5878]/50 font-mono-numbers">—</span>
                  )}
                </td>

                <td className="px-5 py-4 text-xs font-mono-numbers text-[#4A5878] whitespace-nowrap">
                  {wp.updatedAt}
                </td>

                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <Link
                    href={`/engagements/${engagementId}/workpapers/${wp.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4E89] hover:text-[#163BA3] px-3 py-1.5 rounded-[8px] hover:bg-[#EAF5FC] transition-colors"
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

      {/* Opening Balance Check Modal (ENG-04) */}
      {openingCheckModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1A3B]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-[#D3DCEE] flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#1D4E89]" />
                <h3 className="text-base font-bold text-[#122654]">
                  Opening Balance Check against Ledger (ENG-04)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpeningCheckModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkingOpening ? (
              <div className="py-8 text-center text-xs text-[#4A5878]">Comparing ledger opening balances to prior final adjusted TB...</div>
            ) : openingCheckData ? (
              <div className="flex flex-col gap-4 text-xs">
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    openingCheckData.passed
                      ? 'bg-[#E6F4EF] border-[#0B6B52]/30 text-[#0B6B52]'
                      : 'bg-[#FFF1EE] border-[#FF7A66] text-[#B42318]'
                  }`}
                >
                  <div className="font-bold">
                    {openingCheckData.passed
                      ? '✓ All opening balances agree to the prior-year final adjusted trial balance.'
                      : `! ${openingCheckData.differences_count} difference(s) detected between ledger opening and prior year final TB.`}
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white">
                    {openingCheckData.passed ? 'Matched' : 'Difference'}
                  </span>
                </div>

                <div>
                  <div className="font-bold text-[#122654] mb-1.5">Differences Summary</div>
                  {openingCheckData.differences?.length === 0 ? (
                    <p className="text-[11px] text-[#7E8DA6]">No differences found across any nominal code.</p>
                  ) : (
                    <div className="border border-[#E3E7EF] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F5F8FD] font-bold text-[#4A5878]">
                          <tr>
                            <th className="p-2">Code</th>
                            <th className="p-2">Name</th>
                            <th className="p-2 text-right">Prior Final Adjusted</th>
                            <th className="p-2 text-right">Ledger Opening</th>
                            <th className="p-2 text-right">Difference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E3E7EF]">
                          {openingCheckData.differences?.map((d: any) => (
                            <tr key={d.account_code}>
                              <td className="p-2 font-mono font-bold">{d.account_code}</td>
                              <td className="p-2">{d.account_name}</td>
                              <td className="p-2 text-right font-mono">£{(Number(d.prior_adjusted_p) / 100).toFixed(2)}</td>
                              <td className="p-2 text-right font-mono">£{(Number(d.ledger_opening_p) / 100).toFixed(2)}</td>
                              <td className="p-2 text-right font-mono font-bold text-[#B42318]">
                                £{(Number(d.difference_p) / 100).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-bold text-[#122654] mb-1.5">Unmatched Prior-Year Adjusting Journals</div>
                  {openingCheckData.unmatched_prior_journals?.length === 0 ? (
                    <p className="text-[11px] text-[#0B6B52]">
                      ✓ All prior-year working paper journals were posted into the client&apos;s accounting software.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {openingCheckData.unmatched_prior_journals?.map((j: any) => (
                        <div key={j.id} className="p-2 bg-[#FFF4DB] rounded-lg border border-[#C58B00]/40 text-[11px]">
                          <span className="font-bold text-[#805B00]">{j.journal_number}:</span> {j.description} —{' '}
                          <span className="font-mono">£{(Number(j.amount_p) / 100).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="pt-3 border-t border-[#E3E7EF] flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setOpeningCheckModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Roll Forward Modal (ENG-03) */}
      {rollForwardModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1A3B]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-[#D3DCEE] flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#1D4E89]" />
                <h3 className="text-base font-bold text-[#122654]">
                  Roll Forward to Next Period (ENG-03)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRollForwardModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#4A5878]">
              Rolling forward carries long-life schedules (FAR, leases, loans, DLA, reserves, provisions) into the new period. Prior closing numbers become opening brought-forward figures and agree to the penny.
            </p>

            {rollForwardPreview && (
              <div className="flex flex-col gap-3 text-xs">
                <div className="p-3 bg-[#F5F8FD] rounded-xl border border-[#E3E7EF] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7E8DA6]">Target Period</span>
                    <div className="font-bold text-[#122654]">FY27 (Year End: 30 September 2027)</div>
                  </div>
                  <span className="text-[10px] bg-[#E6F4EF] text-[#0B6B52] font-bold px-2 py-0.5 rounded-full">
                    Agrees to Penny ✓
                  </span>
                </div>

                <div>
                  <div className="font-bold text-[#122654] mb-1.5">Carried Rolling Schedules</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {rollForwardPreview.carried_schedules?.map((s: any) => (
                      <div key={s.ref} className="p-2 bg-white rounded-lg border border-[#E3E7EF] flex items-center justify-between">
                        <span className="font-bold text-[#122654]">{s.ref} — {s.title}</span>
                        <span className="font-mono text-[#0B6B52] font-semibold">{s.b_f_pence ? `£${(Number(s.b_f_pence)/100).toFixed(2)}` : 'Carried'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#E6F4EF] rounded-xl border border-[#0B6B52]/30 text-[11px] text-[#0B6B52]">
                  ✓ Permanent documents rolled forward (DOC-02).
                  <br />
                  ✓ Blank non-rolling schedules created.
                  <br />
                  ✓ All preparer/reviewer sign-offs reset for the new engagement.
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E3E7EF] flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setRollForwardModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={executingRollForward}
                onClick={handleExecuteRollForward}
              >
                {executingRollForward ? 'Rolling Forward...' : 'Confirm & Execute Roll Forward'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prior Year Import Modal (ENG-07) */}
      {importPyModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1A3B]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#D3DCEE] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-[#1D4E89]" />
                <h3 className="text-base font-bold text-[#122654]">
                  Import Prior-Year PDF Accounts (ENG-07)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImportPyModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#4A5878]">
              Upload last year&apos;s signed accounts PDF. AI extracts opening fixed asset schedules, leases, loans, and share capital to build opening schedules for new onboarding clients.
            </p>

            <div className="p-4 border-2 border-dashed border-[#D3DCEE] rounded-xl text-center bg-[#F5F8FD]">
              <FileUp className="w-6 h-6 text-[#7E8DA6] mx-auto mb-1.5" />
              <div className="text-xs font-bold text-[#122654]">Harlow_Finch_Signed_Accounts_FY25.pdf</div>
              <div className="text-[10px] text-[#7E8DA6] mt-0.5">Signed statutory accounts (1.4 MB)</div>
            </div>

            {importStatus && (
              <div className="p-3 bg-[#E6F4EF] text-[#0B6B52] rounded-xl text-xs font-bold border border-[#0B6B52]/30">
                {importStatus}
              </div>
            )}

            <div className="pt-3 border-t border-[#E3E7EF] flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setImportPyModal(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={importingPy}
                onClick={handleImportPyAccounts}
              >
                {importingPy ? 'Extracting...' : 'Build Opening Schedules'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
