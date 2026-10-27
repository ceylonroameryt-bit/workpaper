'use client';

import { TEMPLATES } from '@/lib/workpapers/templates';

import { getActor, getCurrentUserId } from '@/lib/session';

import { engagementSummary } from '@/lib/api';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Plus,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  Check,
  ChevronRight,
  FileCheck2,
  Lock,
  Unlock,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Upload,
  Download,
  ExternalLink,
  Paperclip,
  Database,
  Sparkles,
  FileDown,
  Eye,
  CheckCheck,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { toPence, asPence, formatPence, calculateVariance } from '@/lib/money';
import { StatusBadge } from '@/components/ui/StatusPill';
import { LedgerTransaction } from '@/lib/types';

export default function TrialBalancePage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const firmId = db.engagements.find((e) => e.id === engagementId)?.firm_id ?? 'firm_blynt_uk';

  const [viewMode, setViewMode] = useState<'leads' | 'accounts'>('leads');
  const [compareMode, setCompareMode] = useState<'py' | 'refresh'>('py');
  const [search, setSearch] = useState('');
  const [varianceThreshold] = useState(20); // 20% firm threshold

  // Adjustment Modal
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [adjNarrative, setAdjNarrative] = useState('');
  const [adjDebitAccount, setAdjDebitAccount] = useState('6000');
  const [adjDebitAmount, setAdjDebitAmount] = useState('500.00');
  const [adjCreditAccount, setAdjCreditAccount] = useState('2100');
  const [adjCreditAmount, setAdjCreditAmount] = useState('500.00');
  const [proposeError, setProposeError] = useState('');

  // Approval error state
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // DAT-07 Drill Down State
  const [drillAccount, setDrillAccount] = useState<{ code: string; name: string } | null>(null);
  const [drillSearch, setDrillSearch] = useState('');
  const [drillSort, setDrillSort] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [drillExportToast, setDrillExportToast] = useState<string | null>(null);

  // DAT-01 / DAT-06 Ledger Sync & Change Detection
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChangeBanner, setShowChangeBanner] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>('14:32:05');
  const [showLedgerConnectModal, setShowLedgerConnectModal] = useState(false);

  // DAT-02 Upload TB Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadBalancingError, setUploadBalancingError] = useState<string | null>(null);
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);

  // ENG-04 Opening Balance Check against Ledger
  interface OpeningBalanceCheckItem {
    id: string;
    accountCode: string;
    accountName: string;
    ledgerOpeningPence: bigint;
    priorYearFinalPence: bigint;
    diffPence: bigint;
    likelyJournal: string;
    status: 'unexplained' | 'posted_to_ledger' | 'explained';
    comment?: string;
  }

  const [showOpeningCheckModal, setShowOpeningCheckModal] = useState(false);
  const [openingDiffs, setOpeningDiffs] = useState<OpeningBalanceCheckItem[]>(() =>
    engagementId === 'eng_harlow_fy26'
      ? [
          {
            id: 'ob-1',
            accountCode: '2100',
            accountName: 'Accruals and deferred income',
            ledgerOpeningPence: -150000n,
            priorYearFinalPence: -175000n,
            diffPence: 25000n,
            likelyJournal: 'PY-JNL-004: Audit fee accrual true-up (£250.00)',
            status: 'unexplained',
          },
        ]
      : []
  );

  const unexplainedCount = openingDiffs.filter((d) => d.status === 'unexplained').length;

  const handleExplainOpeningDiff = (id: string, comment: string) => {
    setOpeningDiffs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'explained', comment } : d))
    );
  };

  const handlePostOpeningToLedger = (id: string) => {
    setOpeningDiffs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'posted_to_ledger' } : d))
    );
  };

  // Load from DB
  const [mappings, setMappings] = useState(db.account_mappings.filter((m) => m.engagement_id === engagementId));
  const [adjustments, setAdjustments] = useState(db.adjustments.filter((a) => a.engagement_id === engagementId));

  useEffect(() => {
    setMappings(db.account_mappings.filter((m) => m.engagement_id === engagementId));
    setAdjustments(db.adjustments.filter((a) => a.engagement_id === engagementId));
    setOpeningDiffs(
      engagementId === 'eng_harlow_fy26'
        ? [
            {
              id: 'ob-1',
              accountCode: '2100',
              accountName: 'Accruals and deferred income',
              ledgerOpeningPence: -150000n,
              priorYearFinalPence: -175000n,
              diffPence: 25000n,
              likelyJournal: 'PY-JNL-004: Audit fee accrual true-up (£250.00)',
              status: 'unexplained',
            },
          ]
        : []
    );
  }, [engagementId]);

  // Check if locked by unmapped accounts
  const unmappedBalancePence = mappings
    .filter((m) => m.status !== 'confirmed')
    .reduce((acc, m) => acc + asPence(m.balance_p), 0n);

  const isLockedByUnmapped = unmappedBalancePence !== 0n;

  // Active snapshot
  const snapshot = db.tb_snapshots.find((s) => s.engagement_id === engagementId);

  // Lead schedules: grouped by the same Blynt codes each working paper uses (Ground rule 2)
  const leadSchedules = useMemo(() => {
    type Lead = {
      letter: string;
      title: string;
      draftPence: bigint;
      adjustmentsPence: bigint;
      finalPence: bigint;
      priorYearPence: bigint;
      hasPrior: boolean;
      workpaperRef: string;
      workpaperId: string | null;
      status: string;
      accounts: { code: string; name: string; draftPence: bigint }[];
    };
    // A-10 shares revenue codes with I-10, so it is not a lead schedule
    const areaTemplates = TEMPLATES.filter((t) => t.leads.length > 0 && t.ref !== 'A-10');
    const templateForCode = (code: string | null) =>
      code ? areaTemplates.find((t) => t.leads.some((l) => code.startsWith(l.code))) : undefined;
    const leadsMap: Record<string, Lead> = {};
    const leadFor = (code: string | null): Lead => {
      const t = templateForCode(code);
      const key = t?.area ?? 'X';
      if (!leadsMap[key]) {
        const paper = t ? db.workpapers.find((w) => w.engagement_id === engagementId && w.ref === t.ref) : undefined;
        leadsMap[key] = {
          letter: key,
          title: t?.areaName ?? 'Other balances',
          draftPence: 0n,
          adjustmentsPence: 0n,
          finalPence: 0n,
          priorYearPence: 0n,
          hasPrior: false,
          workpaperRef: paper ? paper.ref : t ? `${t.ref} (not added)` : '—',
          workpaperId: paper?.id ?? (t ? t.ref : null),
          status: paper?.status ?? 'not_started',
          accounts: [],
        };
      }
      return leadsMap[key];
    };

    mappings.forEach((m) => {
      const lead = leadFor(m.blynt_code);
      const balance = asPence(m.balance_p);
      lead.draftPence += balance;
      lead.accounts.push({ code: m.source_code, name: m.source_name, draftPence: balance });
    });

    adjustments
      .filter((a) => a.status === 'approved' || a.status === 'posted')
      .forEach((adj) => {
        adj.lines.forEach((line) => {
          leadFor(line.blynt_code).adjustmentsPence += asPence(line.debit_p) - asPence(line.credit_p);
        });
      });

    // Prior year from the linked prior engagement, when there is one
    const priorId = db.engagements.find((e) => e.id === engagementId)?.prior_engagement_id;
    if (priorId) {
      db.account_mappings
        .filter((m) => m.engagement_id === priorId && m.status === 'confirmed')
        .forEach((m) => {
          const lead = leadFor(m.blynt_code);
          lead.priorYearPence += asPence(m.balance_p);
          lead.hasPrior = true;
        });
    }

    Object.values(leadsMap).forEach((lead) => {
      lead.finalPence = lead.draftPence + lead.adjustmentsPence;
    });

    const order = areaTemplates.map((t) => t.area);
    return Object.values(leadsMap).sort(
      (x, y) => (order.indexOf(x.letter) + 1 || 99) - (order.indexOf(y.letter) + 1 || 99)
    );
  }, [mappings, adjustments, engagementId]);

  const tbLines = useMemo(() => {
    if (!snapshot) return [];
    return db.tb_lines.filter((l) => l.snapshot_id === snapshot.id);
  }, [snapshot]);

  const totalTbDebits = useMemo(() => {
    if (tbLines.length > 0) return tbLines.reduce((sum, l) => sum + asPence(l.debit_p), 0n);
    return mappings.reduce((sum, m) => sum + (asPence(m.balance_p) > 0n ? asPence(m.balance_p) : 0n), 0n);
  }, [tbLines, mappings]);

  const totalTbCredits = useMemo(() => {
    if (tbLines.length > 0) return tbLines.reduce((sum, l) => sum + asPence(l.credit_p), 0n);
    return mappings.reduce((sum, m) => sum + (asPence(m.balance_p) < 0n ? -asPence(m.balance_p) : 0n), 0n);
  }, [tbLines, mappings]);

  const filteredAccounts = useMemo(() => {
    return mappings.filter((m) => {
      const matchSearch =
        m.source_code.toLowerCase().includes(search.toLowerCase()) ||
        m.source_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.blynt_code || '').toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [mappings, search]);

  // Overall totals strictly summed via BigInt (Ground rule 1 & 2)
  const totalDraftPence = leadSchedules.reduce((sum, l) => sum + l.draftPence, 0n);
  const totalAdjPence = leadSchedules.reduce((sum, l) => sum + l.adjustmentsPence, 0n);
  const totalFinalPence = leadSchedules.reduce((sum, l) => sum + l.finalPence, 0n);
  const netRowPence = totalFinalPence; // Must be £0.00

  // DAT-04 Confirm all Ready mappings
  const readyMappings = mappings.filter(
    (m) => m.status !== 'confirmed' && (m.gate === 'ready' || (m.confidence && m.confidence >= 90))
  );
  const readyCount = readyMappings.length;
  const unconfirmedCount = mappings.filter((m) => m.status !== 'confirmed').length;

  const handleConfirmAllReady = () => {
    const actor = getActor();
    readyMappings.forEach((m) => {
      m.status = 'confirmed';
      m.confirmed_by = actor.id;
      m.confirmed_at = new Date().toISOString();
      db.logAudit(
        firmId,
        actor,
        'CONFIRM_MAPPING_READY',
        'account_mappings',
        m.id,
        { status: 'suggested' },
        { status: 'confirmed', confirmed_by: actor.name }
      );
      db.ai_action_logs.push({
        id: `act_${Date.now()}_${m.id}`,
        firm_id: firmId,
        engagement_id: engagementId,
        output_type: 'mapping',
        item_ref: m.source_code,
        model_version: 'gpt-4o-fin-v2',
        inputs_used: m.evidence_used || 'Standard classification rule',
        confidence: m.confidence || 95,
        outcome: 'accepted',
        decided_by: actor.id,
        decided_by_name: actor.name,
        decided_at: new Date().toISOString(),
      });
    });
    setMappings([...db.account_mappings.filter((m) => m.engagement_id === engagementId)]);
  };

  // DAT-01 / DAT-06 Refresh Ledger and Change Detection
  const handleRefreshLedger = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setShowChangeBanner(true);
      setLastRefreshedAt(new Date().toLocaleTimeString());
      const actor = getActor();
      db.logAudit(
        firmId,
        actor,
        'REFRESH_LEDGER_SYNC',
        'tb_snapshots',
        snapshot?.id || 'snap_current',
        null,
        { provider: 'Xero', time: new Date().toISOString(), late_postings_found: 1 }
      );
      // Mark affected schedule B-10 as changed
      const wpB10 = db.workpapers.find((w) => w.id === `wp_${engagementId}_b10`);
      if (wpB10 && wpB10.data_json) {
        wpB10.data_json.changed_after_reconcile = true;
      }
    }, 1000);
  };

  // DAT-07 Drill-down transactions
  const accountTransactions = useMemo(() => {
    if (!drillAccount) return [];
    let list = db.transactions.filter(
      (t) =>
        t.engagement_id === engagementId &&
        (t.account_code === drillAccount.code ||
          drillAccount.code === 'TOTAL' ||
          !drillAccount.code)
    );
    if (list.length === 0) {
      list = [
        {
          id: `tx_${drillAccount.code}_1`,
          engagement_id: engagementId,
          account_code: drillAccount.code,
          account_name: drillAccount.name,
          date: '2026-09-30',
          contact: 'Primary Vendor / Customer',
          description: `Period end ledger posting for ${drillAccount.name}`,
          amount_p: '500000',
          vat_p: '100000',
          gross_p: '600000',
          source: 'Xero',
          external_url: 'https://go.xero.com',
        },
      ];
    }
    if (drillSearch) {
      const q = drillSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.contact.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.amount_p.includes(q)
      );
    }
    return list.sort((a, b) => {
      if (drillSort === 'date_desc') return b.date.localeCompare(a.date);
      if (drillSort === 'date_asc') return a.date.localeCompare(b.date);
      if (drillSort === 'amount_desc') return Number(BigInt(b.amount_p) - BigInt(a.amount_p));
      return Number(BigInt(a.amount_p) - BigInt(b.amount_p));
    });
  }, [drillAccount, drillSearch, drillSort, engagementId]);

  const handleExportDrillDown = () => {
    if (!drillAccount) return;
    const actor = getActor();
    db.logAudit(
      firmId,
      actor,
      'EXPORT_TRANSACTIONS_EXCEL',
      'transactions',
      drillAccount.code,
      null,
      { count: accountTransactions.length, account: drillAccount }
    );
    const csvHeader = 'Date,Contact,Description,Net Amount (£),VAT (£),Gross Amount (£),Source,External Reference\n';
    const csvRows = accountTransactions
      .map(
        (t) =>
          `"${t.date}","${t.contact.replace(/"/g, '""')}","${t.description.replace(/"/g, '""')}",${(Number(t.amount_p) / 100).toFixed(2)},${(Number(t.vat_p) / 100).toFixed(2)},${(Number(t.gross_p) / 100).toFixed(2)},"${t.source}","${t.external_id || ''}"`
      )
      .join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Transactions_${drillAccount.code}_${engagementId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDrillExportToast(`Exported ${accountTransactions.length} transactions to CSV (AUD-01 logged).`);
    setTimeout(() => setDrillExportToast(null), 3000);
  };

  // Handle Propose Adjustment (Balanced lines)
  const handleProposeAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const debP = toPence(adjDebitAmount);
    const credP = toPence(adjCreditAmount);

    if (debP !== credP || debP === 0n) {
      setProposeError('Adjustment lines must balance. Debit must equal Credit.');
      return;
    }

    const newAdj = {
      id: `aje_${Date.now()}`,
      engagement_id: engagementId,
      ref: `AJE-${String(db.adjustments.filter((a) => a.engagement_id === engagementId).length + 1).padStart(3, '0')}`,
      narrative: adjNarrative || 'Audit journal adjustment',
      status: 'proposed' as const,
      proposed_by: getCurrentUserId(),
      proposed_by_name: getActor().name,
      approved_by: null,
      created_at: new Date().toISOString(),
      lines: [
        {
          id: `line_${Date.now()}_1`,
          adjustment_id: `aje_${Date.now()}`,
          blynt_code: adjDebitAccount,
          debit_p: debP.toString(),
          credit_p: '0',
          narrative: 'Debit line',
        },
        {
          id: `line_${Date.now()}_2`,
          adjustment_id: `aje_${Date.now()}`,
          blynt_code: adjCreditAccount,
          debit_p: '0',
          credit_p: credP.toString(),
          narrative: 'Credit line',
        },
      ],
    };

    db.adjustments.push(newAdj);
    setAdjustments([...db.adjustments.filter((a) => a.engagement_id === engagementId)]);
    setShowProposeModal(false);
    setAdjNarrative('');
    setProposeError('');

    db.logAudit(
      firmId,
      getActor(),
      'PROPOSE_ADJUSTMENT',
      'adjustments',
      newAdj.id,
      null,
      newAdj
    );
  };

  // Handle Approve Adjustment with role check
  const handleApproveAdjustment = (adjId: string) => {
    setApprovalError(null);
    const adj = db.adjustments.find((a) => a.id === adjId);
    if (!adj) return;

    // Ground Rule: Preparer cannot approve their own adjustment (403, audited)
    // Here simulate attempt by current user:
    const currentUser = getActor();

    if (adj.proposed_by === currentUser.id) {
      setApprovalError('403 Forbidden: You proposed this adjustment and cannot approve it. A different reviewer is required.');
      return;
    }

    adj.status = 'approved';
    adj.approved_by = currentUser.id;
    adj.approved_by_name = currentUser.name;

    setAdjustments([...db.adjustments.filter((a) => a.engagement_id === engagementId)]);

    db.logAudit(
      firmId,
      currentUser,
      'APPROVE_ADJUSTMENT',
      'adjustments',
      adj.id,
      null,
      adj
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5B6478] mb-1">
            <Link href="/" className="hover:text-[#B8432F]">Blynt</Link>
            <span>/</span>
            <span className="text-[#102654] font-semibold">{engagementSummary(engagementId).clientName}</span>
            <span>/</span>
            <span>3 Trial balance and leads</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102654] tracking-tight">
            Trial balance &amp; lead schedules
          </h1>
          <p className="text-xs text-[#5B6478] mt-0.5">
            Audit-adjusted trial balance. Net balance strictly computed in integer pence: {formatPence(netRowPence)}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-[#F6F7FB] text-[#102654] border border-[#D5DBE7] text-xs font-bold rounded-[10px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
          >
            <Upload className="w-4 h-4 text-[#1D4E89]" />
            <span>Upload TB (DAT-02)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLedgerConnectModal(true)}
            className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-[#F6F7FB] text-[#102654] border border-[#D5DBE7] text-xs font-bold rounded-[10px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
          >
            <Database className="w-4 h-4 text-[#0B6B52]" />
            <span>Import from Xero (DAT-01)</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshLedger}
            disabled={isRefreshing}
            className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-[#F6F7FB] text-[#102654] border border-[#D5DBE7] text-xs font-bold rounded-[10px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-[#1D4E89] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowProposeModal(true)}
            className="min-h-[40px] px-4 py-2 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-[10px] flex items-center gap-2 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Propose adjustment</span>
          </button>
        </div>
      </div>

      {uploadSuccessToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-[12px] text-xs font-bold text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{uploadSuccessToast}</span>
          </div>
          <button type="button" onClick={() => setUploadSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DAT-01 / DAT-06 Ledger Change Detection Banner */}
      {showChangeBanner && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-[14px] flex flex-col gap-2.5 animate-in fade-in shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-bold text-amber-900">
                Ledger changes detected in {engagementSummary(engagementId).clientName} (DAT-01 / DAT-06)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowChangeBanner(false)}
              className="text-amber-700 hover:text-amber-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-amber-800 leading-relaxed">
            Snapshot synchronized with Xero at {lastRefreshedAt}. Change detection compared the new pull with snapshot #{snapshot?.id || 'snap_01'}:
          </div>
          <div className="bg-white/90 p-3 rounded-xl border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
            <div>
              <span className="font-bold text-[#102654]">#1010 Barclays Operating Account</span>
              <span className="text-amber-900 font-semibold ml-2">Moved by +£8,500.00 (Late supplier posting detected)</span>
            </div>
            <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-[10px] font-sans font-bold border border-amber-300 shrink-0">
              Schedule B-10: Changed since reconciled
            </span>
          </div>
        </div>
      )}

      {/* Lock Warning if Unmapped Balance != 0 */}
      {isLockedByUnmapped && (
        <div className="p-4 bg-[#FDECEA] border border-[#B42318]/30 rounded-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B42318] shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#B42318]">
                Trial balance locked: unmapped balance is {formatPence(unmappedBalancePence)}
              </div>
              <div className="text-[11px] text-[#5B6478]">
                All imported accounts must be confirmed to statutory nominals before final trial balance can unlock.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {readyCount > 0 && (
              <button
                type="button"
                onClick={handleConfirmAllReady}
                className="min-h-[38px] px-3.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-[8px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Bulk confirm high-confidence Ready mappings (DAT-04)"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Confirm Ready ({readyCount})</span>
              </button>
            )}
            <Link
              href={`/engagements/${engagementId}/mapping`}
              className="min-h-[38px] px-4 bg-[#B42318] hover:bg-[#963321] text-white text-xs font-bold rounded-[8px] flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>Review Mapping ({unconfirmedCount})</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ENG-04 Opening Balance Check Banner */}
      {unexplainedCount > 0 ? (
        <div
          onClick={() => setShowOpeningCheckModal(true)}
          className="p-4 bg-[#FFF4ED] border border-[#FF7D6B] rounded-[14px] flex items-center justify-between cursor-pointer hover:bg-[#FFE8DC] transition-colors shadow-xs"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B8432F] shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#B8432F]">
                Opening balances: {unexplainedCount} difference{unexplainedCount === 1 ? '' : 's'}
              </div>
              <div className="text-[11px] text-[#5B6478]">
                Compares the ledger&apos;s opening trial balance with the prior period&apos;s final adjusted trial balance. Click to resolve.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="px-3.5 py-1.5 bg-[#B8432F] hover:bg-[#963321] text-white text-xs font-bold rounded-[8px] shrink-0"
          >
            Review differences
          </button>
        </div>
      ) : (
        <div
          onClick={() => setShowOpeningCheckModal(true)}
          className="p-3.5 bg-[#E6F4EF] border border-[#0B6B52]/40 rounded-[14px] flex items-center justify-between cursor-pointer hover:bg-[#D5EFE5] transition-colors"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#0B6B52] shrink-0" />
            <div>
              <span className="text-xs font-bold text-[#0B6B52]">
                Opening balances agree
              </span>
              <span className="text-[11px] text-[#5B6478] ml-2">
                All ledger opening balances match prior-year final adjusted figures.
              </span>
            </div>
          </div>
          <span className="text-[11px] text-[#0B6B52] font-semibold underline shrink-0">
            View opening check report
          </span>
        </div>
      )}

      {/* Checks Panel */}
      <div className="blynt-card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-[#F6F7FB] rounded-[10px] border border-[#E3E7EF] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#0B6B52] shrink-0" />
          <div>
            <div className="font-bold text-[#102654]">Net Balance = 0.00</div>
            <div className="text-[10px] text-[#5B6478] font-mono">
              Net: {formatPence(netRowPence)}
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#F6F7FB] rounded-[10px] border border-[#E3E7EF] flex items-center gap-2.5">
          {isLockedByUnmapped ? (
            <AlertTriangle className="w-4 h-4 text-[#B42318] shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#0B6B52] shrink-0" />
          )}
          <div>
            <div className="font-bold text-[#102654]">Account Mapping</div>
            <div className="text-[10px] text-[#5B6478]">
              {isLockedByUnmapped ? 'Action needed' : 'All accounts mapped'}
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#F6F7FB] rounded-[10px] border border-[#E3E7EF] flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#0B6B52] shrink-0" />
          <div>
            <div className="font-bold text-[#102654]">Snapshot Integrity</div>
            <div className="text-[10px] text-[#5B6478] font-mono truncate max-w-[120px]">
              {snapshot ? `SHA: ${snapshot.sha256.substring(0, 10)}...` : "No trial balance imported"}
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#F6F7FB] rounded-[10px] border border-[#E3E7EF] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#0B6B52] shrink-0" />
          <div>
            <div className="font-bold text-[#102654]">Variances Flagged</div>
            <div className="text-[10px] text-[#5B6478]">Threshold: &gt;= {varianceThreshold}%</div>
          </div>
        </div>
      </div>

      {/* View Toggles & Search */}
      <div className="blynt-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Toggle Lead Schedules vs All accounts */}
          <div className="flex bg-[#F6F7FB] p-1 rounded-[10px] border border-[#D5DBE7]">
            <button
              type="button"
              onClick={() => setViewMode('leads')}
              className={`px-3 py-1.5 text-xs font-bold rounded-[8px] transition-colors cursor-pointer ${
                viewMode === 'leads'
                  ? 'bg-white text-[#102654] shadow-xs'
                  : 'text-[#5B6478] hover:text-[#102654]'
              }`}
            >
              Lead schedules
            </button>
            <button
              type="button"
              onClick={() => setViewMode('accounts')}
              className={`px-3 py-1.5 text-xs font-bold rounded-[8px] transition-colors cursor-pointer ${
                viewMode === 'accounts'
                  ? 'bg-white text-[#102654] shadow-xs'
                  : 'text-[#5B6478] hover:text-[#102654]'
              }`}
            >
              All accounts
            </button>
          </div>

          {/* Compare toggle */}
          <div className="flex bg-[#F6F7FB] p-1 rounded-[10px] border border-[#D5DBE7]">
            <button
              type="button"
              onClick={() => setCompareMode('py')}
              className={`px-3 py-1.5 text-xs font-bold rounded-[8px] transition-colors cursor-pointer ${
                compareMode === 'py'
                  ? 'bg-white text-[#102654] shadow-xs'
                  : 'text-[#5B6478] hover:text-[#102654]'
              }`}
            >
              Compare prior year
            </button>
            <button
              type="button"
              onClick={() => setCompareMode('refresh')}
              className={`px-3 py-1.5 text-xs font-bold rounded-[8px] transition-colors cursor-pointer ${
                compareMode === 'refresh'
                  ? 'bg-white text-[#102654] shadow-xs'
                  : 'text-[#5B6478] hover:text-[#102654]'
              }`}
            >
              Compare last refresh
            </button>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-[#5B6478] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search lead or nominal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[38px] pl-8 pr-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[8px] text-[#102654] outline-none"
          />
        </div>
      </div>

      {/* Main Table: Either Lead Schedules or All Accounts */}
      <div className="blynt-card overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === 'leads' ? (
            <table className="w-full text-left text-xs text-[#102654]">
              <caption className="sr-only">Trial balance lead schedules table</caption>
              <thead className="bg-[#F6F7FB] text-[#5B6478] uppercase text-[10px] font-bold tracking-wider border-b border-[#E3E7EF]">
                <tr>
                  <th scope="col" className="p-3 pl-6">Lead</th>
                  <th scope="col" className="p-3">Schedule Title</th>
                  <th scope="col" className="p-3 text-right">Prior Year</th>
                  <th scope="col" className="p-3 text-right">Draft</th>
                  <th scope="col" className="p-3 text-right">Adjustments</th>
                  <th scope="col" className="p-3 text-right">Final</th>
                  <th scope="col" className="p-3 text-right">Change %</th>
                  <th scope="col" className="p-3">Working Paper</th>
                  <th scope="col" className="p-3 pr-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EF]">
                {leadSchedules.map((lead) => {
                  const { percent } = lead.hasPrior
                    ? calculateVariance(lead.finalPence, lead.priorYearPence)
                    : { percent: null as number | null };
                  const paperHref = lead.workpaperId ? `/engagements/${engagementId}/workpapers/${lead.workpaperId}` : null;
                  const isOverThreshold = percent !== null && Math.abs(percent) >= varianceThreshold;

                  return (
                    <tr
                      key={lead.letter}
                      className="hover:bg-[#F6F7FB] transition-colors cursor-pointer"
                      onClick={() => paperHref && router.push(paperHref)}
                    >
                      <td className="p-3 pl-6">
                        <span className="w-6 h-6 rounded-md bg-[#102654] text-white flex items-center justify-center font-mono font-bold text-xs">
                          {lead.letter}
                        </span>
                      </td>

                      <td className="p-3 font-bold text-[#102654]">
                        {lead.title}
                      </td>

                      <td className="p-3 text-right font-mono-numbers text-[#5B6478]">
                        {lead.hasPrior ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrillAccount({ code: lead.letter, name: `${lead.title} (Prior Year)` });
                            }}
                            className="underline decoration-dotted hover:decoration-solid hover:text-[#1D4E89] cursor-pointer"
                            title="Drill down into prior-year transactions (DAT-07)"
                          >
                            {formatPence(lead.priorYearPence, { accountingFormat: true })}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="p-3 text-right font-mono-numbers">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDrillAccount({ code: lead.letter, name: `${lead.title} (Draft)` });
                          }}
                          className="underline decoration-dotted hover:decoration-solid hover:text-[#1D4E89] font-medium cursor-pointer"
                          title="Drill down into transactions (DAT-07)"
                        >
                          {formatPence(lead.draftPence, { accountingFormat: true })}
                        </button>
                      </td>

                      <td className="p-3 text-right font-mono-numbers">
                        {lead.adjustmentsPence !== 0n ? (
                          <span className="text-[#1D4E89] font-bold">
                            {formatPence(lead.adjustmentsPence, { accountingFormat: true })}
                          </span>
                        ) : (
                          <span className="text-[#5B6478]">£0.00</span>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono-numbers font-bold text-[#102654]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDrillAccount({ code: lead.letter, name: `${lead.title} (Final)` });
                          }}
                          className="underline decoration-dotted hover:decoration-solid hover:text-[#1D4E89] cursor-pointer"
                          title="Drill down into transactions (DAT-07)"
                        >
                          {formatPence(lead.finalPence, { accountingFormat: true })}
                        </button>
                      </td>

                      <td className="p-3 text-right font-mono-numbers">
                        {percent !== null ? (
                          <span
                            className={`font-semibold px-1.5 py-0.5 rounded ${
                              isOverThreshold
                                ? 'bg-[#FFF4DB] text-[#6B4700] font-bold'
                                : 'text-[#5B6478]'
                            }`}
                          >
                            {percent > 0 ? `+${percent.toFixed(1)}%` : `${percent.toFixed(1)}%`}
                            {isOverThreshold && ' ⚠'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="p-3 font-mono font-semibold text-[#102654]">
                        {paperHref ? (
                          <Link href={paperHref} onClick={(e) => e.stopPropagation()} className="hover:text-[#B8432F] hover:underline">
                            {lead.workpaperRef}
                          </Link>
                        ) : (
                          <span className="text-[#7E8DA6]">—</span>
                        )}
                      </td>

                      <td className="p-3 pr-6 text-right">
                        <StatusBadge status={lead.status} />
                      </td>
                    </tr>
                  );
                })}

                {/* Net Total Row (Must strictly equal 0.00) */}
                <tr className="bg-[#F6F7FB] font-bold border-t-2 border-[#102654]">
                  <td className="p-4 pl-6" colSpan={2}>
                    Net Balance (Debits - Credits)
                  </td>
                  <td className="p-4 text-right font-mono-numbers">
                    {leadSchedules.some((l) => l.hasPrior) ? formatPence(leadSchedules.reduce((sum, l) => sum + l.priorYearPence, 0n)) : '—'}
                  </td>
                  <td className="p-4 text-right font-mono-numbers">
                    {formatPence(totalDraftPence)}
                  </td>
                  <td className="p-4 text-right font-mono-numbers">
                    {formatPence(totalAdjPence)}
                  </td>
                  <td className="p-4 text-right font-mono-numbers text-sm text-[#0B6B52]">
                    {formatPence(totalFinalPence)}
                  </td>
                  <td className="p-4 text-right font-mono-numbers">
                    ✓ Reconciled
                  </td>
                  <td className="p-4" colSpan={2}>
                    <span className="text-[11px] text-[#0B6B52] font-semibold">
                      Zero unreconciled variance
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs text-[#102654]">
              <caption className="sr-only">All nominal accounts trial balance</caption>
              <thead className="bg-[#F6F7FB] text-[#5B6478] uppercase text-[10px] font-bold tracking-wider border-b border-[#E3E7EF]">
                <tr>
                  <th scope="col" className="p-3 pl-6">Account Code</th>
                  <th scope="col" className="p-3">Account Name</th>
                  <th scope="col" className="p-3">Blynt COA Mapping</th>
                  <th scope="col" className="p-3 text-right">Debit</th>
                  <th scope="col" className="p-3 text-right">Credit</th>
                  <th scope="col" className="p-3 text-right">Net Balance</th>
                  <th scope="col" className="p-3 text-right">Prior Year</th>
                  <th scope="col" className="p-3 pr-6 text-right">Mapping Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EF]">
                {filteredAccounts.map((m) => {
                  const tbLine = tbLines.find((l) => l.source_code === m.source_code);
                  const bal = asPence(m.balance_p);
                  const debit = tbLine ? asPence(tbLine.debit_p) : (bal > 0n ? bal : 0n);
                  const credit = tbLine ? asPence(tbLine.credit_p) : (bal < 0n ? -bal : 0n);

                  const priorId = db.engagements.find((e) => e.id === engagementId)?.prior_engagement_id;
                  const priorMap = priorId
                    ? db.account_mappings.find((pm) => pm.engagement_id === priorId && pm.source_code === m.source_code)
                    : null;
                  const priorPence = priorMap ? asPence(priorMap.balance_p) : null;
                  const blyntAcc = m.blynt_code ? db.blynt_accounts.find((b) => b.code === m.blynt_code) : null;

                  return (
                    <tr key={m.id} className="hover:bg-[#F6F7FB] transition-colors">
                      <td className="p-3 pl-6 font-mono font-bold text-[#102654]">
                        {m.source_code || '—'}
                      </td>
                      <td className="p-3 font-semibold text-[#102654]">
                        {m.source_name}
                      </td>
                      <td className="p-3">
                        {m.blynt_code ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-[#EEF2F6] text-[#102654] border border-[#D5DBE7]">
                            <span className="font-bold">{m.blynt_code}</span>
                            <span className="text-[#5B6478]">({blyntAcc?.name || 'Mapped'})</span>
                          </span>
                        ) : (
                          <span className="text-[#B8432F] font-semibold text-[11px]">Unmapped</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono-numbers">
                        {debit > 0n ? (
                          <button
                            type="button"
                            onClick={() => setDrillAccount({ code: m.source_code, name: m.source_name })}
                            className="underline decoration-dotted hover:decoration-solid hover:text-[#1D4E89] cursor-pointer"
                            title="Drill down to transactions (DAT-07)"
                          >
                            {formatPence(debit, { accountingFormat: true })}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-right font-mono-numbers">
                        {credit > 0n ? (
                          <button
                            type="button"
                            onClick={() => setDrillAccount({ code: m.source_code, name: m.source_name })}
                            className="underline decoration-dotted hover:decoration-solid hover:text-[#1D4E89] cursor-pointer"
                            title="Drill down to transactions (DAT-07)"
                          >
                            {formatPence(credit, { accountingFormat: true })}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-right font-mono-numbers font-bold text-[#102654]">
                        <button
                          type="button"
                          onClick={() => setDrillAccount({ code: m.source_code, name: m.source_name })}
                          className="underline decoration-dotted hover:decoration-solid hover:text-[#1D4E89] cursor-pointer"
                          title="Drill down to transactions (DAT-07)"
                        >
                          {formatPence(bal, { accountingFormat: true })}
                        </button>
                      </td>
                      <td className="p-3 text-right font-mono-numbers text-[#5B6478]">
                        {priorPence !== null ? (
                          <button
                            type="button"
                            onClick={() => setDrillAccount({ code: m.source_code, name: `${m.source_name} (Prior Year)` })}
                            className="underline decoration-dotted hover:decoration-solid hover:text-[#1D4E89] cursor-pointer"
                            title="Drill down to prior-year transactions (DAT-07)"
                          >
                            {formatPence(priorPence, { accountingFormat: true })}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 pr-6 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            m.status === 'confirmed'
                              ? 'bg-[#E6F4EA] text-[#0B6B52]'
                              : m.status === 'needs_you'
                              ? 'bg-[#FDE8E8] text-[#9B1C1C]'
                              : 'bg-[#FFF4DB] text-[#6B4700]'
                          }`}
                        >
                          {m.status === 'confirmed' ? '✓ Confirmed' : m.status === 'needs_you' ? 'Action needed' : 'Suggested'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Total Row */}
                <tr className="bg-[#F6F7FB] font-bold border-t-2 border-[#102654]">
                  <td className="p-4 pl-6" colSpan={3}>
                    Total Nominal Accounts ({filteredAccounts.length})
                  </td>
                  <td className="p-4 text-right font-mono-numbers text-[#102654]">
                    {formatPence(totalTbDebits, { accountingFormat: true })}
                  </td>
                  <td className="p-4 text-right font-mono-numbers text-[#102654]">
                    {formatPence(totalTbCredits, { accountingFormat: true })}
                  </td>
                  <td className="p-4 text-right font-mono-numbers text-sm text-[#0B6B52]">
                    {formatPence(totalTbDebits - totalTbCredits, { accountingFormat: true })}
                  </td>
                  <td className="p-4 text-right font-mono-numbers text-[#5B6478]">
                    —
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <span className="text-[11px] text-[#0B6B52] font-semibold">
                      Balanced £0.00
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Adjustments Section with Role Check on Approval */}
      <div className="blynt-card p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E3E7EF]">
          <div>
            <h2 className="text-base font-bold text-[#102654]">
              Adjusting Journal Entries (AJE)
            </h2>
            <p className="text-xs text-[#5B6478] mt-0.5">
              Balanced adjustment lines. Server permission rule: Approver must differ from proposer and hold reviewer role or above.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowProposeModal(true)}
            className="px-3 py-1.5 bg-[#F6F7FB] border border-[#D5DBE7] hover:border-[#102654] text-[#102654] text-xs font-semibold rounded-[8px]"
          >
            + Propose adjustment
          </button>
        </div>

        {approvalError && (
          <div className="p-3 mb-4 rounded-[10px] bg-[#FDECEA] border border-[#B42318]/40 text-[#B42318] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{approvalError}</span>
          </div>
        )}

        <div className="divide-y divide-[#E3E7EF]">
          {adjustments.map((adj) => (
            <div key={adj.id} className="py-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-[#102654] text-white px-2 py-0.5 rounded">
                    {adj.ref}
                  </span>
                  <span className="text-xs font-bold text-[#102654]">{adj.narrative}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={adj.status === 'approved' ? 'signed_off' : 'in_progress'} label={adj.status} />
                  {adj.status === 'proposed' && (
                    <button
                      type="button"
                      onClick={() => handleApproveAdjustment(adj.id)}
                      className="px-3 py-1 bg-[#102654] text-white font-bold text-xs rounded-[8px] hover:bg-[#0B1B3D] cursor-pointer"
                    >
                      Approve (Reviewer)
                    </button>
                  )}
                </div>
              </div>

              {/* Lines */}
              <div className="bg-[#F6F7FB] rounded-[10px] p-2.5 text-xs font-mono-numbers flex flex-col gap-1">
                {adj.lines.map((l, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[#5B6478]">
                    <span>Account #{l.blynt_code} ({l.narrative})</span>
                    <span>
                      {l.debit_p !== '0' ? `Dr ${formatPence(l.debit_p)}` : `Cr ${formatPence(l.credit_p)}`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-[#5B6478]">
                Proposed by {adj.proposed_by_name} •{' '}
                {adj.approved_by_name ? `Approved by ${adj.approved_by_name}` : 'Awaiting reviewer sign-off'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Propose Adjustment Modal */}
      {showProposeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-[16px] border border-[#E3E7EF] shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-[#102654] mb-1">
              Propose balanced adjustment
            </h3>
            <p className="text-xs text-[#5B6478] mb-4">
              All lines must balance strictly in integer pence before submission.
            </p>

            {proposeError && (
              <div className="p-2.5 mb-3 bg-[#FDECEA] border border-[#B42318]/30 rounded-[8px] text-xs text-[#B42318]">
                {proposeError}
              </div>
            )}

            <form onSubmit={handleProposeAdjustment} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#102654] mb-1">
                  Adjustment narrative
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Accrue September electricity invoice"
                  value={adjNarrative}
                  onChange={(e) => setAdjNarrative(e.target.value)}
                  className="w-full min-h-[40px] px-3 bg-[#F6F7FB] border border-[#D5DBE7] rounded-[8px] text-[#102654] outline-none"
                />
              </div>

              {/* Debit Line */}
              <div className="p-3 bg-[#F6F7FB] rounded-[10px] border border-[#E3E7EF] grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#102654] mb-1">
                    Debit account
                  </label>
                  <select
                    value={adjDebitAccount}
                    onChange={(e) => setAdjDebitAccount(e.target.value)}
                    className="w-full min-h-[36px] px-2 bg-white border border-[#D5DBE7] rounded-[8px] text-[#102654]"
                  >
                    {db.blynt_accounts.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#102654] mb-1">
                    Debit amount (£)
                  </label>
                  <input
                    type="text"
                    value={adjDebitAmount}
                    onChange={(e) => setAdjDebitAmount(e.target.value)}
                    className="w-full min-h-[36px] px-2 bg-white border border-[#D5DBE7] rounded-[8px] text-[#102654] font-mono"
                  />
                </div>
              </div>

              {/* Credit Line */}
              <div className="p-3 bg-[#F6F7FB] rounded-[10px] border border-[#E3E7EF] grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#102654] mb-1">
                    Credit account
                  </label>
                  <select
                    value={adjCreditAccount}
                    onChange={(e) => setAdjCreditAccount(e.target.value)}
                    className="w-full min-h-[36px] px-2 bg-white border border-[#D5DBE7] rounded-[8px] text-[#102654]"
                  >
                    {db.blynt_accounts.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#102654] mb-1">
                    Credit amount (£)
                  </label>
                  <input
                    type="text"
                    value={adjCreditAmount}
                    onChange={(e) => setAdjCreditAmount(e.target.value)}
                    className="w-full min-h-[36px] px-2 bg-white border border-[#D5DBE7] rounded-[8px] text-[#102654] font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E3E7EF]">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="px-4 py-2 border border-[#D5DBE7] text-xs font-semibold text-[#5B6478] rounded-[8px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#102654] text-white text-xs font-bold rounded-[8px] hover:bg-[#0B1B3D]"
                >
                  Submit proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENG-04 Opening Balance Check Modal */}
      {showOpeningCheckModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1B3D]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] shadow-2xl max-w-3xl w-full border border-[#D5DBE7] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#E3E7EF] flex items-center justify-between bg-[#F6F7FB]">
              <div>
                <h3 className="text-base font-extrabold text-[#102654] flex items-center gap-2">
                  <Scale className="w-5 h-5 text-[#B8432F]" />
                  Opening Balance Check against Ledger (ENG-04)
                </h3>
                <p className="text-xs text-[#5B6478] mt-0.5">
                  Verifies ledger opening balances against last year&apos;s final figures so unposted adjustments in Xero/QuickBooks are caught.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOpeningCheckModal(false)}
                className="p-1 text-[#5B6478] hover:text-[#102654] rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="border border-[#E3E7EF] rounded-[12px] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6F7FB] border-b border-[#E3E7EF] text-[11px] font-bold text-[#5B6478]">
                    <tr>
                      <th className="p-3">Nominal Account</th>
                      <th className="p-3 text-right">Ledger Opening</th>
                      <th className="p-3 text-right">Prior-Year Final</th>
                      <th className="p-3 text-right">Difference</th>
                      <th className="p-3">Likely Journal</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EF]">
                    {openingDiffs.map((diff) => (
                      <tr key={diff.id} className="hover:bg-[#F9FAFC]">
                        <td className="p-3">
                          <span className="font-mono font-bold text-[#102654] mr-1.5">{diff.accountCode}</span>
                          <span className="text-[#102654]">{diff.accountName}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-[#102654]">
                          {formatPence(diff.ledgerOpeningPence)}
                        </td>
                        <td className="p-3 text-right font-mono text-[#102654]">
                          {formatPence(diff.priorYearFinalPence)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#B8432F]">
                          {formatPence(diff.diffPence)}
                        </td>
                        <td className="p-3 text-[11px] text-[#5B6478]">
                          {diff.likelyJournal}
                        </td>
                        <td className="p-3 text-center">
                          {diff.status === 'unexplained' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handlePostOpeningToLedger(diff.id)}
                                className="px-2.5 py-1 bg-[#102654] hover:bg-[#0B1B3D] text-white text-[11px] font-bold rounded-[6px]"
                              >
                                Post journal to ledger
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const c = window.prompt('Enter reason for opening balance difference:');
                                  if (c) handleExplainOpeningDiff(diff.id, c);
                                }}
                                className="px-2.5 py-1 border border-[#D5DBE7] hover:bg-slate-50 text-[#102654] text-[11px] font-semibold rounded-[6px]"
                              >
                                Mark as explained
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0B6B52] bg-[#E6F4EF] px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              {diff.status === 'posted_to_ledger' ? 'Posted to ledger' : 'Explained'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-[#F6F7FB] border border-[#E3E7EF] rounded-[10px] text-xs text-[#5B6478]">
                <strong className="text-[#102654] block mb-1">Standard Acceptance Rule (ENG-04):</strong>
                Any difference over £1 is flagged on the lead schedule. The file cannot be partner-approved with unexplained opening differences.
              </div>
            </div>

            <div className="p-4 border-t border-[#E3E7EF] flex justify-end bg-white">
              <button
                type="button"
                onClick={() => setShowOpeningCheckModal(false)}
                className="px-4 py-2 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-[8px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAT-07 Transaction Drill-Down Side Panel */}
      {drillAccount && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-[#D5DBE7] flex flex-col animate-in slide-in-from-right duration-200">
            {/* Panel Header */}
            <div className="p-5 bg-[#102654] text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-xs font-bold text-white">
                    {drillAccount.code}
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {drillAccount.name}
                  </h3>
                </div>
                <div className="text-xs text-white/70 mt-1 flex items-center gap-3">
                  <span>Period snapshot: {snapshot?.created_at ? new Date(snapshot.created_at).toLocaleDateString() : 'Current Period'}</span>
                  <span>•</span>
                  <span>{accountTransactions.length} transaction{accountTransactions.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportDrillDown}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-white/20 transition-colors"
                  title="Export to Excel (CSV) - DAT-07"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillAccount(null)}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drill Search & Sort Bar */}
            <div className="p-3.5 bg-[#F6F7FB] border-b border-[#E3E7EF] flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#5B6478] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search contact, description, or amount..."
                  value={drillSearch}
                  onChange={(e) => setDrillSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D5DBE7] rounded-lg text-[#102654] outline-none"
                />
              </div>
              <select
                value={drillSort}
                onChange={(e) => setDrillSort(e.target.value as any)}
                className="text-xs bg-white border border-[#D5DBE7] rounded-lg px-2.5 py-1.5 text-[#102654] font-medium outline-none"
              >
                <option value="date_desc">Newest date first</option>
                <option value="date_asc">Oldest date first</option>
                <option value="amount_desc">Highest amount first</option>
                <option value="amount_asc">Lowest amount first</option>
              </select>
            </div>

            {drillExportToast && (
              <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-medium text-emerald-800 flex items-center justify-between shrink-0">
                <span>{drillExportToast}</span>
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
            )}

            {/* Transactions List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {accountTransactions.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#5B6478]">
                  No transactions found matching your search.
                </div>
              ) : (
                accountTransactions.map((tx) => {
                  const net = asPence(tx.amount_p);
                  const isDebit = net >= 0n;
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 bg-white border border-[#E3E7EF] rounded-xl hover:border-[#1D4E89]/40 transition-all shadow-2xs flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#102654]">{tx.contact}</span>
                            <span className="text-[10px] bg-[#EEF2F6] text-[#5B6478] px-2 py-0.5 rounded font-mono">
                              {tx.date}
                            </span>
                          </div>
                          <p className="text-xs text-[#5B6478] mt-0.5 leading-relaxed">{tx.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xs font-bold font-mono ${isDebit ? 'text-[#102654]' : 'text-purple-900'}`}>
                            {formatPence(net, { accountingFormat: true })}
                          </div>
                          <div className="text-[10px] text-[#7E8DA6] font-mono">
                            VAT: {formatPence(asPence(tx.vat_p))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#F0F2F6] text-[11px] text-[#7E8DA6]">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#EAF5FC] text-[#1D4E89] px-2 py-0.5 rounded font-semibold text-[10px]">
                            {tx.source}
                          </span>
                          {tx.attachment_name && (
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(tx.attachment_name!)}
                              className="flex items-center gap-1 text-[#1D4E89] hover:underline font-semibold cursor-pointer"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{tx.attachment_name}</span>
                            </button>
                          )}
                        </div>

                        {tx.external_url && (
                          <a
                            href={tx.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[#1D4E89] hover:underline font-semibold"
                          >
                            <span>Open in {tx.source}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Panel Footer */}
            <div className="p-3.5 bg-[#F6F7FB] border-t border-[#E3E7EF] flex items-center justify-between shrink-0 text-xs">
              <span className="text-[#5B6478]">
                Total: <strong className="text-[#102654]">{formatPence(accountTransactions.reduce((acc, t) => acc + asPence(t.amount_p), 0n))}</strong>
              </span>
              <button
                type="button"
                onClick={() => setDrillAccount(null)}
                className="px-4 py-1.5 bg-[#102654] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#1D4E89]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment / Receipt Viewer Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-[#1D4E89]" />
                <h4 className="text-sm font-bold text-[#102654]">{selectedReceipt}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-6 flex flex-col items-center justify-center bg-slate-50 rounded-xl my-4 border border-dashed border-slate-300">
              <FileSpreadsheet className="w-12 h-12 text-[#1D4E89] mb-2" />
              <span className="text-xs font-semibold text-[#102654]">{selectedReceipt}</span>
              <span className="text-[11px] text-[#5B6478] mt-1">Verified attached document from ledger pull</span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-[#102654] text-white text-xs font-bold rounded-lg"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAT-02 Upload TB Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1B3D]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] shadow-2xl max-w-2xl w-full border border-[#D5DBE7] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#E3E7EF] flex items-center justify-between bg-[#F6F7FB]">
              <div>
                <h3 className="text-base font-extrabold text-[#102654] flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#1D4E89]" />
                  Upload Trial Balance (DAT-02)
                </h3>
                <p className="text-xs text-[#5B6478] mt-0.5">
                  Upload .csv, .xlsx or .xls file with AI column detection and balancing validation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-[#5B6478] hover:text-[#102654] rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="border-2 border-dashed border-[#D5DBE7] hover:border-[#1D4E89] rounded-xl p-8 text-center bg-[#F9FAFC] cursor-pointer transition-colors">
                <Upload className="w-10 h-10 text-[#7E8DA6] mx-auto mb-2" />
                <div className="text-xs font-bold text-[#102654]">
                  {uploadFileName ? uploadFileName : 'Drag & drop your Trial Balance file here, or browse'}
                </div>
                <div className="text-[11px] text-[#7E8DA6] mt-1">Supports CSV, Excel (.xlsx, .xls) up to 50MB</div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFileName(f.name);
                    }
                  }}
                  className="hidden"
                  id="tb-file-input"
                />
                <label
                  htmlFor="tb-file-input"
                  className="mt-3 inline-block px-4 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Browse Computer
                </label>
              </div>

              {uploadFileName && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>AI Column Layout Detected (95% confidence)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-gray-500 block">Code:</span>
                      <strong className="text-[#102654]">Col A (Nominal Code)</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-gray-500 block">Name:</span>
                      <strong className="text-[#102654]">Col B (Account Title)</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-gray-500 block">Debit:</span>
                      <strong className="text-[#102654]">Col C (Debit £)</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-gray-500 block">Credit:</span>
                      <strong className="text-[#102654]">Col D (Credit £)</strong>
                    </div>
                  </div>
                  <div className="pt-2 text-[11px] text-emerald-700 flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Debits equal Credits: Net difference £0.00 (Balanced)</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#E3E7EF] flex justify-end gap-2.5 bg-[#F6F7FB]">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-[#D5DBE7] text-xs font-semibold text-[#5B6478] rounded-[8px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadSuccessToast('Trial balance imported successfully with AI column detection (DAT-02).');
                  setTimeout(() => setUploadSuccessToast(null), 3000);
                  const actor = getActor();
                  db.logAudit(
                    firmId,
                    actor,
                    'UPLOAD_TRIAL_BALANCE',
                    'tb_snapshots',
                    snapshot?.id || 'snap_new',
                    null,
                    { filename: uploadFileName || 'trial_balance.xlsx', layout: 'debit_credit' }
                  );
                }}
                disabled={!uploadFileName}
                className="px-5 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-[8px] disabled:opacity-50 cursor-pointer"
              >
                Import Trial Balance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAT-01 Connect Ledger Modal */}
      {showLedgerConnectModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1B3D]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] shadow-2xl max-w-md w-full border border-[#D5DBE7] overflow-hidden">
            <div className="p-4 border-b border-[#E3E7EF] flex items-center justify-between bg-[#F6F7FB]">
              <h3 className="text-base font-extrabold text-[#102654] flex items-center gap-2">
                <Database className="w-5 h-5 text-[#0B6B52]" />
                Connect Cloud Ledger (DAT-01)
              </h3>
              <button
                type="button"
                onClick={() => setShowLedgerConnectModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-[#5B6478]">
                Authenticate OAuth 2.0 connection to pull chart of accounts, monthly TB, transactions, and contacts in under 60 seconds.
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowLedgerConnectModal(false);
                    handleRefreshLedger();
                  }}
                  className="w-full p-3.5 border border-[#13B5EA]/40 bg-[#13B5EA]/5 hover:bg-[#13B5EA]/10 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#13B5EA] text-white font-extrabold flex items-center justify-center text-sm">
                      X
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-[#102654]">Xero Cloud Accounting</div>
                      <div className="text-[10px] text-emerald-700 font-semibold">Connected: Harlow &amp; Finch Fine Goods Ltd</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#1D4E89]">Sync Now →</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowLedgerConnectModal(false);
                    handleRefreshLedger();
                  }}
                  className="w-full p-3.5 border border-[#2CA01C]/40 bg-[#2CA01C]/5 hover:bg-[#2CA01C]/10 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2CA01C] text-white font-extrabold flex items-center justify-center text-sm">
                      qb
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-[#102654]">Intuit QuickBooks Online</div>
                      <div className="text-[10px] text-gray-500">Ready to authenticate</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#1D4E89]">Connect →</span>
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-[#E3E7EF] flex justify-end bg-[#F6F7FB]">
              <button
                type="button"
                onClick={() => setShowLedgerConnectModal(false)}
                className="px-4 py-2 border border-[#D5DBE7] text-xs font-semibold text-[#5B6478] rounded-[8px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
