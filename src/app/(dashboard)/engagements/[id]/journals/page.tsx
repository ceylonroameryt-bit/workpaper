'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  BookOpen,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Download,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  X,
  Search,
  Filter,
  Check,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';
import { formatPence, toPence, asPence } from '@/lib/money';
import { getActor } from '@/lib/session';

interface JournalEntry {
  id: string;
  ref: string;
  date: string;
  type: 'adjusting' | 'reclassification' | 'client_posted' | 'proposed_by_ai';
  status: 'draft' | 'accepted' | 'approved' | 'posted' | 'reversed';
  narrative: string;
  sourceSchedule?: string;
  autoReverseNextPeriod: boolean;
  proposedBy: string;
  approvedBy?: string | null;
  postedLedgerRef?: string | null;
  lines: {
    code: string;
    accountName: string;
    debitPence: bigint;
    creditPence: bigint;
    description: string;
  }[];
}

export default function JournalsPage() {
  const params = useParams();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeEngagement, refreshCompanyData } = useCompany();
  const { formatDate } = useLocale();
  const actor = getActor();

  const [activeTab, setActiveTab] = useState<'all' | 'proposed' | 'approved' | 'posted'>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Manual Journal Modal (JNL-01)
  const [showNewModal, setShowNewModal] = useState(false);
  const [modalType, setModalType] = useState<JournalEntry['type']>('adjusting');
  const [modalNarrative, setModalNarrative] = useState('');
  const [modalDate, setModalDate] = useState('2026-09-30');
  const [modalAutoReverse, setModalAutoReverse] = useState(false);
  const [modalLines, setModalLines] = useState<
    { code: string; accountName: string; debit: string; credit: string; description: string }[]
  >([
    { code: '6900', accountName: 'Depreciation Charge for Year', debit: '1500.00', credit: '0.00', description: 'Year end depreciation' },
    { code: '1700', accountName: 'Accumulated Depreciation', debit: '0.00', credit: '1500.00', description: 'Year end depreciation' },
  ]);

  // Initial Seed Journals (JNL-01 to JNL-04)
  const [journals, setJournals] = useState<JournalEntry[]>([
    {
      id: 'jnl_001',
      ref: 'JNL-001',
      date: '2026-09-30',
      type: 'proposed_by_ai',
      status: 'draft',
      narrative: 'AI Proposed: Prepayment release for Q4 commercial property insurance',
      sourceSchedule: 'REC-09 Prepayments',
      autoReverseNextPeriod: true,
      proposedBy: 'AI Engine',
      lines: [
        { code: '6000', accountName: 'Office Rent & Rates', debitPence: 810000n, creditPence: 0n, description: 'Insurance release' },
        { code: '1400', accountName: 'Prepayments', debitPence: 0n, creditPence: 810000n, description: 'Insurance release' },
      ],
    },
    {
      id: 'jnl_002',
      ref: 'JNL-002',
      date: '2026-09-30',
      type: 'proposed_by_ai',
      status: 'draft',
      narrative: 'AI Proposed: Annual straight-line depreciation across plant and IT machinery',
      sourceSchedule: 'REC-03 Fixed Assets',
      autoReverseNextPeriod: false,
      proposedBy: 'AI Engine',
      lines: [
        { code: '6900', accountName: 'Depreciation Charge for Year', debitPence: 2700000n, creditPence: 0n, description: 'Tangible FA depreciation' },
        { code: '1700', accountName: 'Accumulated Depreciation', debitPence: 0n, creditPence: 2700000n, description: 'Tangible FA depreciation' },
      ],
    },
    {
      id: 'jnl_003',
      ref: 'JNL-003',
      date: '2026-09-30',
      type: 'adjusting',
      status: 'approved',
      narrative: 'Audit fee accrual for FY26 statutory accounts preparation',
      sourceSchedule: 'REC-09B Accruals',
      autoReverseNextPeriod: true,
      proposedBy: 'Marcus Vance',
      approvedBy: 'Sarah Jenkins',
      lines: [
        { code: '6000', accountName: 'Office Rent & Rates', debitPence: 275000n, creditPence: 0n, description: 'Audit fee provision' },
        { code: '2100', accountName: 'Accruals', debitPence: 0n, creditPence: 275000n, description: 'Audit fee provision' },
      ],
    },
    {
      id: 'jnl_004',
      ref: 'JNL-004',
      date: '2026-09-30',
      type: 'adjusting',
      status: 'posted',
      narrative: 'Corporation tax provision calculated per REC-13 CT schedule',
      sourceSchedule: 'REC-13 Tax',
      autoReverseNextPeriod: false,
      proposedBy: 'Marcus Vance',
      approvedBy: 'David Thorne',
      postedLedgerRef: 'XERO-MANUAL-JNL-9842',
      lines: [
        { code: '500', accountName: 'Corporation Tax Expense', debitPence: 1202042n, creditPence: 0n, description: 'CT charge' },
        { code: '2100', accountName: 'Corporation Tax Liability', debitPence: 0n, creditPence: 1202042n, description: 'CT provision' },
      ],
    },
  ]);

  // Modal debits/credits calculation
  const modalTotalDebit = useMemo(() => {
    return modalLines.reduce((acc, l) => acc + toPence(l.debit || '0'), 0n);
  }, [modalLines]);

  const modalTotalCredit = useMemo(() => {
    return modalLines.reduce((acc, l) => acc + toPence(l.credit || '0'), 0n);
  }, [modalLines]);

  const isModalBalanced = modalTotalDebit === modalTotalCredit && modalTotalDebit > 0n;

  // Filter journals
  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      const matchSearch =
        j.narrative.toLowerCase().includes(search.toLowerCase()) ||
        j.ref.toLowerCase().includes(search.toLowerCase()) ||
        (j.sourceSchedule && j.sourceSchedule.toLowerCase().includes(search.toLowerCase()));
      if (!matchSearch) return false;

      if (activeTab === 'proposed') return j.status === 'draft';
      if (activeTab === 'approved') return j.status === 'approved';
      if (activeTab === 'posted') return j.status === 'posted';
      return true;
    });
  }, [journals, search, activeTab]);

  // Overall Impact summary
  const { effectOnProfitPence, effectOnNetAssetsPence } = useMemo(() => {
    let profitEffect = 0n;
    let netAssetEffect = 0n;

    for (const j of journals) {
      if (j.status === 'draft' || j.status === 'reversed') continue;
      for (const line of j.lines) {
        const codeNum = parseInt(line.code, 10);
        // Revenue (4000s) or Expenses (5000s, 6000s)
        if (codeNum >= 4000 && codeNum < 5000) {
          profitEffect += line.creditPence - line.debitPence;
        } else if (codeNum >= 5000) {
          profitEffect -= line.debitPence - line.creditPence;
        }

        // Assets (1000s) - Liabilities (2000s)
        if (codeNum >= 1000 && codeNum < 2000) {
          netAssetEffect += line.debitPence - line.creditPence;
        } else if (codeNum >= 2000 && codeNum < 3000) {
          netAssetEffect -= line.creditPence - line.debitPence;
        }
      }
    }
    return { effectOnProfitPence: profitEffect, effectOnNetAssetsPence: netAssetEffect };
  }, [journals]);

  // Actions
  const handleAcceptProposal = (id: string) => {
    setJournals((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'accepted' as const } : j))
    );
  };

  const handleApproveSelected = () => {
    setJournals((prev) =>
      prev.map((j) =>
        selectedIds.has(j.id)
          ? { ...j, status: 'approved' as const, approvedBy: actor.name }
          : j
      )
    );
    setSelectedIds(new Set());
  };

  const handlePostToLedger = () => {
    setJournals((prev) =>
      prev.map((j) =>
        selectedIds.has(j.id) || (activeTab === 'approved' && j.status === 'approved')
          ? {
              ...j,
              status: 'posted' as const,
              postedLedgerRef: `EXT-JNL-${Date.now().toString().slice(-4)}`,
            }
          : j
      )
    );
    setSelectedIds(new Set());
  };

  const handleSaveNewJournal = () => {
    if (!isModalBalanced) return;

    const newJnl: JournalEntry = {
      id: `jnl_${Date.now()}`,
      ref: `JNL-${String(journals.length + 1).padStart(3, '0')}`,
      date: modalDate,
      type: modalType,
      status: 'accepted',
      narrative: modalNarrative,
      autoReverseNextPeriod: modalAutoReverse,
      proposedBy: actor.name,
      lines: modalLines.map((l) => ({
        code: l.code,
        accountName: l.accountName,
        debitPence: toPence(l.debit || '0'),
        creditPence: toPence(l.credit || '0'),
        description: l.description,
      })),
    };

    setJournals([newJnl, ...journals]);
    setShowNewModal(false);
    setModalNarrative('');
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">Journal Register &amp; Adjustments (JNL)</h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] px-2.5 py-1 rounded-full font-mono font-semibold">
              {journals.length} Adjustments
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Manual and AI-proposed adjustments. Changes directly update trial balance and lead schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New manual journal</span>
          </button>
        </div>
      </div>

      {/* Summary Cards: Effect on Profit and Net Assets (JNL-04) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E3E7EF] rounded-[14px] p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6]">
            Total Net Impact on Profit
          </div>
          <div className="flex items-center gap-2 mt-2">
            {effectOnProfitPence < 0n ? (
              <TrendingDown className="w-5 h-5 text-red-600" />
            ) : (
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            )}
            <span
              className={`text-xl font-bold font-mono ${
                effectOnProfitPence < 0n ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {formatPence(effectOnProfitPence)}
            </span>
          </div>
          <p className="text-[11px] text-[#5B6478] mt-1">Across all accepted &amp; approved adjustments</p>
        </div>

        <div className="bg-white border border-[#E3E7EF] rounded-[14px] p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6]">
            Total Impact on Net Assets
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xl font-bold font-mono text-[#102654]">
              {formatPence(effectOnNetAssetsPence)}
            </span>
          </div>
          <p className="text-[11px] text-[#5B6478] mt-1">Balance sheet movement from journals</p>
        </div>

        <div className="bg-white border border-[#E3E7EF] rounded-[14px] p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6]">
            Ledger Sync Status
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-[#0B6B52] bg-[#E6F4EF] px-2 py-0.5 rounded-full font-mono">
              Ready to post ({journals.filter((j) => j.status === 'approved').length})
            </span>
          </div>
          <p className="text-[11px] text-[#5B6478] mt-1">Approved journals ready for Xero / QuickBooks</p>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-[14px] border border-[#E3E7EF] shadow-2xs">
        <div className="flex items-center gap-1 bg-[#F6F7FB] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'all'
                ? 'bg-white text-[#102654] shadow-xs'
                : 'text-[#5B6478] hover:text-[#102654]'
            }`}
          >
            All Journals ({journals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('proposed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'proposed'
                ? 'bg-white text-[#102654] shadow-xs'
                : 'text-[#5B6478] hover:text-[#102654]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF7D6B]" />
            Proposed AI ({journals.filter((j) => j.status === 'draft').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'approved'
                ? 'bg-white text-[#102654] shadow-xs'
                : 'text-[#5B6478] hover:text-[#102654]'
            }`}
          >
            Approved ({journals.filter((j) => j.status === 'approved').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('posted')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'posted'
                ? 'bg-white text-[#102654] shadow-xs'
                : 'text-[#5B6478] hover:text-[#102654]'
            }`}
          >
            Posted to Ledger ({journals.filter((j) => j.status === 'posted').length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'approved' && (
            <button
              type="button"
              onClick={handlePostToLedger}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Post to Xero / QuickBooks (JNL-03)</span>
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleApproveSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve Selected ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Journals List */}
      <div className="space-y-4">
        {filteredJournals.map((journal) => {
          const totalDebit = journal.lines.reduce((a, b) => a + b.debitPence, 0n);

          return (
            <div
              key={journal.id}
              className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden"
            >
              <div className="p-4 bg-[#F6F7FB]/70 border-b border-[#E3E7EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(journal.id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(journal.id);
                      else next.delete(journal.id);
                      setSelectedIds(next);
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="font-mono font-bold text-xs text-[#1D4E89] bg-[#EAF5FC] px-2 py-0.5 rounded">
                    {journal.ref}
                  </span>
                  <span className="text-xs font-bold text-[#102654]">{journal.narrative}</span>
                  {journal.type === 'proposed_by_ai' && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-[#FFF1EE] text-[#A23A27] px-2 py-0.5 rounded-full font-bold">
                      <Sparkles className="w-2.5 h-2.5 text-[#FF7D6B]" /> AI Proposed
                    </span>
                  )}
                  {journal.autoReverseNextPeriod && (
                    <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-medium">
                      Auto-reverses next period
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-[#102654]">
                    Total: {formatPence(totalDebit)}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${
                      journal.status === 'draft'
                        ? 'bg-amber-100 text-amber-900'
                        : journal.status === 'approved'
                        ? 'bg-purple-100 text-purple-900'
                        : journal.status === 'posted'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    {journal.status}
                  </span>

                  {journal.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => handleAcceptProposal(journal.id)}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      Accept Journal
                    </button>
                  )}
                </div>
              </div>

              {/* Journal Lines Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50/50 text-[#7E8DA6] text-[10px] font-bold uppercase tracking-wider border-b border-[#E3E7EF]">
                      <th className="py-2 px-4 w-28">Nominal</th>
                      <th className="py-2 px-4">Account Name</th>
                      <th className="py-2 px-4">Line Description</th>
                      <th className="py-2 px-4 text-right w-32">Debit</th>
                      <th className="py-2 px-4 text-right w-32">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EF]/60">
                    {journal.lines.map((l, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-4 font-mono font-bold text-[#1D4E89]">{l.code}</td>
                        <td className="py-2.5 px-4 font-medium text-[#102654]">{l.accountName}</td>
                        <td className="py-2.5 px-4 text-[#5B6478]">{l.description}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium">
                          {l.debitPence > 0n ? formatPence(l.debitPence) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium">
                          {l.creditPence > 0n ? formatPence(l.creditPence) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer info */}
              <div className="p-3 bg-white border-t border-[#E3E7EF] flex items-center justify-between text-[11px] text-[#7E8DA6]">
                <div className="flex items-center gap-3">
                  <span>Source: {journal.sourceSchedule || 'Manual Entry'}</span>
                  <span>•</span>
                  <span>Proposed by: {journal.proposedBy}</span>
                  {journal.approvedBy && (
                    <>
                      <span>•</span>
                      <span>Approved by: {journal.approvedBy}</span>
                    </>
                  )}
                </div>
                {journal.postedLedgerRef && (
                  <span className="font-mono text-[#0B6B52] font-semibold">
                    Linked Ledger Ref: {journal.postedLedgerRef}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Manual Journal Modal (JNL-01) */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF] mb-4">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-[#1D4E89]" />
                <h3 className="text-base font-bold text-[#102654]">Post Manual Journal (JNL-01)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">Journal Type</label>
                <select
                  value={modalType}
                  onChange={(e) => setModalType(e.target.value as any)}
                  className="w-full text-xs p-2 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg"
                >
                  <option value="adjusting">Adjusting Journal</option>
                  <option value="reclassification">Reclassification Journal</option>
                  <option value="client_posted">Client Posted Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">Effective Date</label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="w-full text-xs p-2 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#102654] mb-1">
                Narrative / Justification <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Correct allocation of year-end equipment expense to fixed assets"
                value={modalNarrative}
                onChange={(e) => setModalNarrative(e.target.value)}
                className="w-full text-xs p-2.5 border border-[#D5DBE7] rounded-lg outline-none focus:ring-1 focus:ring-[#1D4E89]"
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#102654] cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalAutoReverse}
                  onChange={(e) => setModalAutoReverse(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Auto-reverse on first day of next period (JNL-04)</span>
              </label>
            </div>

            {/* Lines Grid */}
            <div className="mb-4 border border-[#E3E7EF] rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F6F7FB] text-[10px] font-bold text-[#7E8DA6] uppercase">
                  <tr>
                    <th className="py-2 px-3">Nominal Code</th>
                    <th className="py-2 px-3">Account Name</th>
                    <th className="py-2 px-3 text-right">Debit (£)</th>
                    <th className="py-2 px-3 text-right">Credit (£)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EF]">
                  {modalLines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-mono font-bold text-[#1D4E89]">{line.code}</td>
                      <td className="py-2 px-3 text-[#102654]">{line.accountName}</td>
                      <td className="py-2 px-3 text-right font-mono">{line.debit}</td>
                      <td className="py-2 px-3 text-right font-mono">{line.credit}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#F6F7FB] font-mono font-bold text-xs border-t border-[#E3E7EF]">
                  <tr>
                    <td colSpan={2} className="py-2 px-3 text-[#102654]">Totals &amp; Check:</td>
                    <td className="py-2 px-3 text-right">{formatPence(modalTotalDebit)}</td>
                    <td className="py-2 px-3 text-right">{formatPence(modalTotalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Balanced Indicator */}
            <div className="mb-4 flex items-center justify-between text-xs">
              <span className="text-[#5B6478]">
                {isModalBalanced ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Balanced: Debits equal Credits
                  </span>
                ) : (
                  <span className="text-red-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Out of balance by{' '}
                    {formatPence(
                      modalTotalDebit > modalTotalCredit
                        ? modalTotalDebit - modalTotalCredit
                        : modalTotalCredit - modalTotalDebit
                    )}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E3E7EF]">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-3.5 py-2 text-xs text-[#5B6478] hover:text-[#102654] font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isModalBalanced || modalNarrative.trim().length === 0}
                onClick={handleSaveNewJournal}
                className="px-4 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
