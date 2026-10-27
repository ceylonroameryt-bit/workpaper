'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileCheck2,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Plus,
  RefreshCw,
  Clock,
  MessageSquare,
  AlertCircle,
  FileText,
  X,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';
import { formatPence, toPence, asPence } from '@/lib/money';
import { StatusBadge } from '@/components/ui/StatusPill';
import { TEMPLATES } from '@/lib/workpapers/templates';
import { getActor } from '@/lib/session';

interface ScheduleItem {
  id: string;
  code: string;
  ref: string;
  title: string;
  section: 'leads' | 'balance_sheet' | 'pnl' | 'tax' | 'disclosures' | 'completion';
  templateName: string;
  tbBalancePence: bigint;
  scheduleBalancePence: bigint;
  differencePence: bigint;
  priorYearPence: bigint;
  status: 'not_started' | 'in_progress' | 'unreconciled' | 'reconciled' | 'prepared' | 'reviewed' | 'approved';
  applicable: boolean;
  naSuggestion?: { reason: string };
  signoffs: { preparer?: string; manager?: string; partner?: string };
  flags: {
    changedSinceReconciled?: boolean;
    changedSinceReviewed?: boolean;
    aiWarning?: string;
    reviewPointOpen?: number;
  };
}

export default function WorkingPaperIndexPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeEngagement, activeCompany, refreshCompanyData } = useCompany();
  const { formatDate } = useLocale();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [flagFilter, setFlagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set());
  const [collapsedNa, setCollapsedNa] = useState<boolean>(true);
  const [showBulkReviewModal, setShowBulkReviewModal] = useState<boolean>(false);

  // In-memory schedules data derived from workpapers and standard (REC-01 to REC-17, STD-01 to STD-05)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    {
      id: 'A-10',
      code: 'STD-01',
      ref: 'A-10',
      title: 'Planning, risk assessment and materiality',
      section: 'leads',
      templateName: 'Planning checklist & materiality calculation',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'approved',
      applicable: true,
      signoffs: { preparer: 'MV', manager: 'SJ', partner: 'PL' },
      flags: {},
    },
    {
      id: 'REC-02',
      code: 'REC-02',
      ref: 'B-10',
      title: 'Bank and cash reconciliation',
      section: 'balance_sheet',
      templateName: 'Bank reconciliation per account',
      tbBalancePence: 130535000n, // £1,305,350.00
      scheduleBalancePence: 130535000n,
      differencePence: 0n,
      priorYearPence: 94000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-07',
      code: 'REC-07',
      ref: 'C-10',
      title: 'Trade debtors and recoverability review',
      section: 'balance_sheet',
      templateName: 'Aged debtors with recoverability review',
      tbBalancePence: 236450000n,
      scheduleBalancePence: 236450000n,
      differencePence: 0n,
      priorYearPence: 195000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: { reviewPointOpen: 1 },
    },
    {
      id: 'REC-09',
      code: 'REC-09',
      ref: 'C-20',
      title: 'Prepayments and accrued income',
      section: 'balance_sheet',
      templateName: 'Itemised with release calculation',
      tbBalancePence: 3240000n,
      scheduleBalancePence: 3240000n,
      differencePence: 0n,
      priorYearPence: 2800000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'C-30',
      code: 'REC-17',
      ref: 'C-30',
      title: 'Other debtors and staff loans',
      section: 'balance_sheet',
      templateName: 'Itemised listing',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'not_started',
      applicable: false,
      naSuggestion: { reason: 'No other debtors balance in nominal ledger' },
      signoffs: {},
      flags: {},
    },
    {
      id: 'REC-14',
      code: 'REC-14',
      ref: 'D-10',
      title: 'Stock and work in progress',
      section: 'balance_sheet',
      templateName: 'Stock summary from count',
      tbBalancePence: 182400000n,
      scheduleBalancePence: 182400000n,
      differencePence: 0n,
      priorYearPence: 165000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-11',
      code: 'REC-11',
      ref: 'D-20',
      title: "Director's loan accounts & s455 tax",
      section: 'balance_sheet',
      templateName: 'Per-director movements with s455 check',
      tbBalancePence: 2424996n,
      scheduleBalancePence: 2424996n,
      differencePence: 0n,
      priorYearPence: 1200000n,
      status: 'in_progress',
      applicable: true,
      signoffs: {},
      flags: { aiWarning: 'Overdrawn balance at year end: s455 charge applies if not repaid in 9 months' },
    },
    {
      id: 'REC-12',
      code: 'REC-12',
      ref: 'E-10',
      title: 'Share capital, reserves and dividends',
      section: 'balance_sheet',
      templateName: 'Share register and dividend schedule',
      tbBalancePence: 50000000n,
      scheduleBalancePence: 50000000n,
      differencePence: 0n,
      priorYearPence: 50000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'E-20',
      code: 'REC-12',
      ref: 'E-20',
      title: 'Reserves movement and distributable profits',
      section: 'balance_sheet',
      templateName: 'Reserves movement',
      tbBalancePence: 320000000n,
      scheduleBalancePence: 320000000n,
      differencePence: 0n,
      priorYearPence: 280000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-03',
      code: 'REC-03',
      ref: 'F-10',
      title: 'Fixed asset register and depreciation',
      section: 'balance_sheet',
      templateName: 'Register by class with depreciation',
      tbBalancePence: 270000000n, // £2,700,000.00
      scheduleBalancePence: 270000000n,
      differencePence: 0n,
      priorYearPence: 245000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV', manager: 'SJ' },
      flags: { aiWarning: 'Possible capital item in repairs: £8,500' },
    },
    {
      id: 'G-10',
      code: 'REC-17',
      ref: 'G-10',
      title: 'Investments and investment property',
      section: 'balance_sheet',
      templateName: 'Investment register',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'not_started',
      applicable: false,
      naSuggestion: { reason: 'No asset investments held on ledger' },
      signoffs: {},
      flags: {},
    },
    {
      id: 'I-10',
      code: 'REC-01',
      ref: 'I-10',
      title: 'Turnover, direct costs and gross margin',
      section: 'pnl',
      templateName: 'Revenue and direct costs analytical review',
      tbBalancePence: 620000000n,
      scheduleBalancePence: 620000000n,
      differencePence: 0n,
      priorYearPence: 580000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-08',
      code: 'REC-08',
      ref: 'K-10',
      title: 'Trade creditors and unrecorded liabilities search',
      section: 'balance_sheet',
      templateName: 'Aged creditors with unrecorded liabilities search',
      tbBalancePence: 168450000n,
      scheduleBalancePence: 168450000n,
      differencePence: 0n,
      priorYearPence: 142000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-09B',
      code: 'REC-09',
      ref: 'K-20',
      title: 'Accruals and deferred income',
      section: 'balance_sheet',
      templateName: 'Itemised with reversal check',
      tbBalancePence: 45200000n,
      scheduleBalancePence: 45200000n,
      differencePence: 0n,
      priorYearPence: 38000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-04',
      code: 'REC-04',
      ref: 'L-10',
      title: 'Lease schedule (Right-of-use model FRS 102)',
      section: 'balance_sheet',
      templateName: 'Lease register, model set by standard and period',
      tbBalancePence: 8400000n,
      scheduleBalancePence: 8400000n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-10',
      code: 'REC-10',
      ref: 'L-20',
      title: 'Loans schedule with maturity split',
      section: 'balance_sheet',
      templateName: 'Loan schedule with repayment split',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'not_started',
      applicable: false,
      naSuggestion: { reason: 'No bank loan balances or finance interest in ledger' },
      signoffs: {},
      flags: {},
    },
    {
      id: 'L-30',
      code: 'REC-10',
      ref: 'L-30',
      title: 'Hire purchase with interest allocation',
      section: 'balance_sheet',
      templateName: 'HP schedule with interest allocation',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'not_started',
      applicable: false,
      naSuggestion: { reason: 'No hire purchase obligations found' },
      signoffs: {},
      flags: {},
    },
    {
      id: 'P-10',
      code: 'REC-01',
      ref: 'P-10',
      title: 'Overheads and administrative expenses',
      section: 'pnl',
      templateName: 'Administrative expenses review',
      tbBalancePence: 38420000n,
      scheduleBalancePence: 38420000n,
      differencePence: 0n,
      priorYearPence: 35000000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-05',
      code: 'REC-05',
      ref: 'P-20',
      title: 'Wages, PAYE/NIC and pension reconciliation',
      section: 'balance_sheet',
      templateName: 'Wages, PAYE/NIC and pension reconciliation',
      tbBalancePence: 14200000n,
      scheduleBalancePence: 14200000n,
      differencePence: 0n,
      priorYearPence: 13100000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'Q-10',
      code: 'REC-17',
      ref: 'Q-10',
      title: 'Provisions for liabilities and charges',
      section: 'balance_sheet',
      templateName: 'Provision movement',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'not_started',
      applicable: false,
      naSuggestion: { reason: 'No provisions booked in ledger' },
      signoffs: {},
      flags: {},
    },
    {
      id: 'Q-20',
      code: 'REC-17',
      ref: 'Q-20',
      title: 'Grants and deferred income release',
      section: 'balance_sheet',
      templateName: 'Grant release schedule',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'not_started',
      applicable: false,
      naSuggestion: { reason: 'No capital or revenue grants received' },
      signoffs: {},
      flags: {},
    },
    {
      id: 'REC-15',
      code: 'REC-15',
      ref: 'R-10',
      title: 'Related parties and intercompany balances',
      section: 'balance_sheet',
      templateName: 'Related party register with balances',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-16',
      code: 'REC-16',
      ref: 'S-10',
      title: 'Suspense, clearing and control accounts (must be zero)',
      section: 'balance_sheet',
      templateName: 'Must-be-zero check',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'REC-13',
      code: 'REC-13',
      ref: 'T-10',
      title: 'Corporation tax provision and computation',
      section: 'tax',
      templateName: 'CT provision schedule',
      tbBalancePence: 2250533n,
      scheduleBalancePence: 2250533n,
      differencePence: 0n,
      priorYearPence: 1800000n,
      status: 'in_progress',
      applicable: true,
      signoffs: {},
      flags: {},
    },
    {
      id: 'REC-06',
      code: 'REC-06',
      ref: 'T-20',
      title: 'VAT reconciliation (Quarterly standard scheme)',
      section: 'tax',
      templateName: 'VAT control by return period',
      tbBalancePence: 19820000n,
      scheduleBalancePence: 19820000n,
      differencePence: 0n,
      priorYearPence: 16500000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'T-30',
      code: 'REC-13',
      ref: 'T-30',
      title: 'Deferred tax timing differences',
      section: 'tax',
      templateName: 'Timing differences on fixed assets',
      tbBalancePence: 1850000n,
      scheduleBalancePence: 1850000n,
      differencePence: 0n,
      priorYearPence: 1500000n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'Z-10',
      code: 'STD-04',
      ref: 'Z-10',
      title: 'Disclosures, notes and statutory accounts production',
      section: 'disclosures',
      templateName: 'Draft statutory accounts and disclosure notes',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'reconciled',
      applicable: true,
      signoffs: { preparer: 'MV' },
      flags: {},
    },
    {
      id: 'Z-20',
      code: 'REV-05',
      ref: 'Z-20',
      title: 'File completion and partner sign-off lock',
      section: 'completion',
      templateName: 'Completion checklist and partner sign-off',
      tbBalancePence: 0n,
      scheduleBalancePence: 0n,
      differencePence: 0n,
      priorYearPence: 0n,
      status: 'in_progress',
      applicable: true,
      signoffs: {},
      flags: {},
    },
  ]);

  const [sectionFilter, setSectionFilter] = useState<'all' | 'leads' | 'balance_sheet' | 'pnl' | 'tax' | 'disclosures' | 'completion'>('all');
  const [pendingUntick, setPendingUntick] = useState<ScheduleItem | null>(null);
  const [untickReason, setUntickReason] = useState<string>('');

  // Handle Applicable Toggle (WPS-03)
  const handleToggleApplicable = (id: string, reason?: string) => {
    const s = schedules.find((x) => x.id === id);
    if (!s) return;

    if (s.applicable && !reason) {
      setPendingUntick(s);
      setUntickReason('');
      return;
    }

    setSchedules((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextVal = !item.applicable;
          db.logAudit(
            activeEngagement?.firm_id || 'firm_blynt_uk',
            getActor(),
            nextVal ? 'TICK_APPLICABLE' : 'UNTICK_APPLICABLE',
            'workpapers',
            id,
            { applicable: item.applicable },
            { applicable: nextVal, reason: reason || 'User action' }
          );
          return { ...item, applicable: nextVal };
        }
        return item;
      })
    );
  };

  const handleConfirmUntick = () => {
    if (!pendingUntick) return;
    const s = pendingUntick;
    setSchedules((prev) =>
      prev.map((item) => {
        if (item.id === s.id) {
          db.logAudit(
            activeEngagement?.firm_id || 'firm_blynt_uk',
            getActor(),
            'UNTICK_APPLICABLE',
            'workpapers',
            s.id,
            { applicable: true },
            { applicable: false, reason: untickReason || 'Marked not applicable by user' }
          );
          return { ...item, applicable: false, naSuggestion: { reason: untickReason || 'Marked not applicable' } };
        }
        return item;
      })
    );
    setPendingUntick(null);
    setUntickReason('');
  };

  // Bulk Sign-Off (REV-01)
  const handleBulkReview = () => {
    const actor = getActor();
    setSchedules((prev) =>
      prev.map((s) => {
        if (selectedScheduleIds.has(s.id)) {
          return {
            ...s,
            status: 'reviewed',
            signoffs: { ...s.signoffs, manager: actor.name.split(' ').map((n) => n[0]).join('') },
          };
        }
        return s;
      })
    );
    setSelectedScheduleIds(new Set());
    setShowBulkReviewModal(false);
  };

  // Filter schedules
  const applicableSchedules = useMemo(() => {
    return schedules.filter((s) => s.applicable);
  }, [schedules]);

  const naSchedules = useMemo(() => {
    return schedules.filter((s) => !s.applicable);
  }, [schedules]);

  const filteredApplicable = useMemo(() => {
    return applicableSchedules.filter((s) => {
      const matchSearch =
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.ref.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (sectionFilter !== 'all' && s.section !== sectionFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      if (flagFilter === 'ai_warning' && !s.flags.aiWarning) return false;
      if (flagFilter === 'review_point' && !s.flags.reviewPointOpen) return false;
      if (flagFilter === 'changed' && !s.flags.changedSinceReconciled && !s.flags.changedSinceReviewed) return false;

      return true;
    });
  }, [applicableSchedules, searchQuery, sectionFilter, statusFilter, flagFilter]);

  // Statistics
  const totalApplicable = applicableSchedules.length;
  const reconciledCount = applicableSchedules.filter(
    (s) => s.status === 'reconciled' || s.status === 'prepared' || s.status === 'reviewed' || s.status === 'approved'
  ).length;
  const reviewedCount = applicableSchedules.filter(
    (s) => s.status === 'reviewed' || s.status === 'approved'
  ).length;
  const unreconciledCount = applicableSchedules.filter((s) => s.differencePence !== 0n).length;

  const reconciledPct = totalApplicable > 0 ? Math.round((reconciledCount / totalApplicable) * 100) : 0;
  const reviewedPct = totalApplicable > 0 ? Math.round((reviewedCount / totalApplicable) * 100) : 0;

  const standardLabel = activeEngagement?.framework || 'FRS 102 Section 1A (2024 amendments)';

  const getStatusColor = (status: ScheduleItem['status']) => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'unreconciled':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'reconciled':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
      case 'prepared':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'reviewed':
        return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
      case 'approved':
        return 'bg-green-100 text-green-900 border-green-300 font-bold';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Banner / Standard & Version Bar (WPS-01) */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">Working Paper Index (WPS)</h1>
            <span className="text-xs bg-[#102654] text-white px-2.5 py-1 rounded-full font-mono font-semibold">
              {standardLabel}
            </span>
            {activeEngagement?.status === 'locked' && (
              <span className="flex items-center gap-1 text-xs bg-[#FFF4DB] text-[#6B4700] px-2 py-0.5 rounded font-mono font-bold border border-[#FFE8A3]">
                <Lock className="w-3 h-3 text-[#B8432F]" /> Locked
              </span>
            )}
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Standard-driven working papers with automated reconciliation, AI checks, and 3-level sign-off.
          </p>
        </div>

        {/* Progress Stats */}
        <div className="flex items-center gap-4 bg-[#F6F7FB] px-4 py-3 rounded-xl border border-[#E3E7EF]">
          <div>
            <div className="text-[10px] uppercase font-bold text-[#7E8DA6]">Reconciled</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-[#0B6B52] font-mono">{reconciledPct}%</span>
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#0B6B52] rounded-full" style={{ width: `${reconciledPct}%` }} />
              </div>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-gray-300" />

          <div>
            <div className="text-[10px] uppercase font-bold text-[#7E8DA6]">Reviewed</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-purple-700 font-mono">{reviewedPct}%</span>
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full" style={{ width: `${reviewedPct}%` }} />
              </div>
            </div>
          </div>

          {unreconciledCount > 0 && (
            <>
              <div className="h-8 w-[1px] bg-gray-300" />
              <div>
                <div className="text-[10px] uppercase font-bold text-[#B8432F]">Unreconciled</div>
                <span className="text-sm font-bold text-[#B8432F] font-mono">{unreconciledCount} schedules</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Standard Sections Navigation (WPS-01) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E3E7EF]">
        {[
          { id: 'all', label: 'All schedules' },
          { id: 'leads', label: 'Lead schedules (WPS-04)' },
          { id: 'balance_sheet', label: 'Balance sheet' },
          { id: 'pnl', label: 'Profit and loss' },
          { id: 'tax', label: 'Taxation' },
          { id: 'disclosures', label: 'Disclosures & notes (STD-04)' },
          { id: 'completion', label: 'Completion (REV-05)' },
        ].map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => setSectionFilter(sec.id as any)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer ${
              sectionFilter === sec.id
                ? 'bg-[#102654] text-white shadow-xs'
                : 'text-[#5B6478] hover:bg-[#F6F7FB] hover:text-[#102654]'
            }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-[14px] border border-[#E3E7EF] shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-48">
            <Search className="w-3.5 h-3.5 text-[#7E8DA6] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search schedules or codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] outline-none focus:ring-1 focus:ring-[#1D4E89]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg px-2.5 py-1.5 text-[#102654] font-medium outline-none"
          >
            <option value="all">All statuses</option>
            <option value="unreconciled">Unreconciled</option>
            <option value="reconciled">Reconciled</option>
            <option value="in_progress">In progress</option>
            <option value="prepared">Prepared</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
          </select>

          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            className="text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg px-2.5 py-1.5 text-[#102654] font-medium outline-none"
          >
            <option value="all">All flags</option>
            <option value="ai_warning">AI warning open</option>
            <option value="review_point">Review points open</option>
            <option value="changed">Changed after review/reconcile</option>
          </select>
        </div>

        {/* Bulk Sign-Off Action (REV-01) */}
        {selectedScheduleIds.size > 0 && (
          <button
            type="button"
            onClick={() => setShowBulkReviewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Review selected ({selectedScheduleIds.size})</span>
          </button>
        )}
      </div>

      {/* Main Working Paper Index Table */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B1B3D] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredApplicable.length > 0 &&
                      filteredApplicable.every((s) => selectedScheduleIds.has(s.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedScheduleIds(new Set(filteredApplicable.map((s) => s.id)));
                      } else {
                        setSelectedScheduleIds(new Set());
                      }
                    }}
                    className="rounded border-gray-400"
                  />
                </th>
                <th className="py-3 px-2 w-12 text-center" title="Applicable toggle (WPS-03)">
                  App
                </th>
                <th className="py-3 px-3">Schedule</th>
                <th className="py-3 px-3">Template</th>
                <th className="py-3 px-3 text-right">TB Balance</th>
                <th className="py-3 px-3 text-right">Schedule Bal</th>
                <th className="py-3 px-3 text-right">Difference</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center" title="Sign-offs: Preparer / Manager / Partner">
                  Sign-Offs
                </th>
                <th className="py-3 px-3">Flags / AI Warnings</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF] text-xs text-[#102654]">
              {filteredApplicable.map((schedule) => {
                const isSelected = selectedScheduleIds.has(schedule.id);
                const hasDiff = schedule.differencePence !== 0n;

                return (
                  <tr
                    key={schedule.id}
                    className={`hover:bg-[#F6F7FB]/80 transition-colors ${
                      isSelected ? 'bg-purple-50/40' : ''
                    }`}
                  >
                    {/* Multi-select check */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const next = new Set(selectedScheduleIds);
                          if (e.target.checked) next.add(schedule.id);
                          else next.delete(schedule.id);
                          setSelectedScheduleIds(next);
                        }}
                        className="rounded border-gray-300"
                      />
                    </td>

                    {/* Applicable tick */}
                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={schedule.applicable}
                        onChange={() => handleToggleApplicable(schedule.id)}
                        title="Tick/untick applicable schedule"
                        className="rounded border-gray-400 cursor-pointer text-[#102654]"
                      />
                    </td>

                    {/* Schedule code & title */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[11px] text-[#1D4E89] bg-[#EAF5FC] px-1.5 py-0.5 rounded">
                          {schedule.ref}
                        </span>
                        <Link
                          href={`/engagements/${engagementId}/workpapers/wp_${schedule.ref.toLowerCase().replace('-', '')}`}
                          className="font-bold text-[#102654] hover:text-[#FF7D6B] transition-colors truncate"
                        >
                          {schedule.title}
                        </Link>
                      </div>
                    </td>

                    {/* Template name */}
                    <td className="py-3 px-3 text-[#5B6478] text-[11px] truncate max-w-xs">
                      {schedule.templateName}
                    </td>

                    {/* TB Balance */}
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {formatPence(schedule.tbBalancePence)}
                    </td>

                    {/* Schedule Balance */}
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {formatPence(schedule.scheduleBalancePence)}
                    </td>

                    {/* Difference */}
                    <td
                      className={`py-3 px-3 text-right font-mono font-bold ${
                        hasDiff ? 'text-red-600 bg-red-50/50' : 'text-[#0B6B52]'
                      }`}
                    >
                      {hasDiff ? formatPence(schedule.differencePence) : '£0.00'}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border capitalize ${getStatusColor(
                          schedule.status
                        )}`}
                      >
                        {schedule.status === 'reconciled' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {schedule.status === 'unreconciled' && <AlertTriangle className="w-3 h-3 text-red-600" />}
                        {schedule.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Sign-offs: P / M / Pt */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1 font-mono text-[10px]">
                        <span
                          title={`Preparer: ${schedule.signoffs.preparer || 'Pending'}`}
                          className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                            schedule.signoffs.preparer
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {schedule.signoffs.preparer || 'P'}
                        </span>
                        <span
                          title={`Manager: ${schedule.signoffs.manager || 'Pending'}`}
                          className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                            schedule.signoffs.manager
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {schedule.signoffs.manager || 'M'}
                        </span>
                        <span
                          title={`Partner: ${schedule.signoffs.partner || 'Pending'}`}
                          className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                            schedule.signoffs.partner
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {schedule.signoffs.partner || 'Pt'}
                        </span>
                      </div>
                    </td>

                    {/* Flags / AI Warnings */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {schedule.flags.aiWarning && (
                          <span
                            title={schedule.flags.aiWarning}
                            className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded truncate max-w-[200px]"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            <span className="truncate">{schedule.flags.aiWarning}</span>
                          </span>
                        )}
                        {schedule.flags.reviewPointOpen !== undefined && schedule.flags.reviewPointOpen > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">
                            <MessageSquare className="w-2.5 h-2.5" />
                            {schedule.flags.reviewPointOpen}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action Link */}
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/engagements/${engagementId}/workpapers/wp_${schedule.ref.toLowerCase().replace('-', '')}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4E89] hover:text-[#FF7D6B] transition-colors"
                      >
                        Open <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Collapsed Not Applicable Section (WPS-03) */}
        {naSchedules.length > 0 && (
          <div className="border-t border-[#E3E7EF] bg-[#F6F7FB]">
            <button
              type="button"
              onClick={() => setCollapsedNa(!collapsedNa)}
              className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-[#5B6478] hover:text-[#102654] transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${collapsedNa ? '-rotate-90' : ''}`}
                />
                <span>Not applicable schedules ({naSchedules.length})</span>
                <span className="text-[10px] text-[#7E8DA6] font-normal">
                  - Unticked or excluded by standard
                </span>
              </div>
              <span className="text-[11px] text-[#1D4E89] font-medium">
                {collapsedNa ? 'Expand to view & restore' : 'Collapse'}
              </span>
            </button>

            {!collapsedNa && (
              <div className="p-4 pt-0 divide-y divide-[#E3E7EF]">
                {naSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="py-2.5 flex items-center justify-between text-xs text-[#5B6478]"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleToggleApplicable(schedule.id, 'Restored by user')}
                        className="rounded border-gray-400 cursor-pointer"
                        title="Restore this schedule as applicable"
                      />
                      <span className="font-mono font-bold text-[11px] text-[#7E8DA6]">
                        {schedule.ref}
                      </span>
                      <span className="line-through">{schedule.title}</span>
                      {schedule.naSuggestion && (
                        <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">
                          AI: {schedule.naSuggestion.reason}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleApplicable(schedule.id, 'Restored by user')}
                      className="text-xs text-[#1D4E89] hover:underline font-semibold"
                    >
                      Make applicable
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Review Modal (REV-01) */}
      {showBulkReviewModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-purple-700 mb-3">
              <ShieldCheck className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-[#102654]">Bulk Sign-off: Manager Review</h3>
            </div>
            <p className="text-xs text-[#5B6478] leading-relaxed mb-4">
              You are about to sign off {selectedScheduleIds.size} schedules as <strong>Reviewed</strong>.
              Each sign-off records your user details, role, and current timestamp in the audit trail.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBulkReviewModal(false)}
                className="px-3.5 py-2 text-xs text-[#5B6478] hover:text-[#102654] font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkReview}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Confirm Review Sign-Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Untick Schedule Dialog with Manager Approval Notice (WPS-03) */}
      {pendingUntick && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF]">
              <div className="flex items-center gap-2 text-[#102654]">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold">Untick Applicable Schedule (WPS-03)</h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingUntick(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5B6478] leading-relaxed">
              You are removing <strong>{pendingUntick.ref} {pendingUntick.title}</strong> from the applicable working papers.
            </p>

            {(pendingUntick.tbBalancePence !== 0n || ['A-10', 'B-10', 'F-10', 'Z-10', 'Z-20'].includes(pendingUntick.ref)) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Manager approval required:</strong> This schedule has a balance or is mandatory under {standardLabel}.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#102654] mb-1">
                Reason for marking Not Applicable:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. No transactions or commitments in this financial year..."
                value={untickReason}
                onChange={(e) => setUntickReason(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg outline-none focus:ring-1 focus:ring-[#102654]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingUntick(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#5B6478] hover:text-[#102654]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUntick}
                className="px-4 py-2 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Confirm Untick
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
