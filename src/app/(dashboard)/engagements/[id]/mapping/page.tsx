'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Check,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Lock,
  Unlock,
  ChevronRight,
  X,
  FileCheck2,
  Pencil,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  Info,
  BookOpen,
  Tag,
  Zap,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { AccountMapping, BlyntAccount, LearnedRule, AiActionLogItem } from '@/lib/types/models';
import { toPence, asPence, formatPence } from '@/lib/money';
import { matchBlyntAccount, getStatutoryDetails } from '@/lib/mapping/auto-mapper';
import { getActor, getCurrentUserId } from '@/lib/session';
import { engagementSummary } from '@/lib/api';

export default function AccountMappingPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const engagementRow = db.engagements.find((e) => e.id === engagementId);
  const firmId = engagementRow?.firm_id ?? 'firm_blynt_uk';
  const engagementClientId = engagementRow?.client_id ?? null;

  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'ready' | 'check' | 'exception' | 'confirmed'>('all');
  const [search, setSearch] = useState('');
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statutoryFilter, setStatutoryFilter] = useState('all');
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [batchTargetCode, setBatchTargetCode] = useState('');
  const [correctionToast, setCorrectionToast] = useState<{ message: string; undoAction?: () => void } | null>(null);

  // Rule creation modal (DAT-09)
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [pendingCorrection, setPendingCorrection] = useState<{
    mappingId: string;
    sourceCode: string;
    sourceName: string;
    sourceType: string;
    targetCode: string;
    pattern: string;
  } | null>(null);
  const [ruleScope, setRuleScope] = useState<'item' | 'supplier' | 'client' | 'practice'>('client');

  // Load from db
  const reloadData = () => {
    const list = db.account_mappings.filter((m) => m.engagement_id === engagementId);
    setMappings([...list]);
  };

  useEffect(() => {
    reloadData();
  }, [engagementId]);

  // Confidence Gate calculations (DAT-03, DAT-08)
  const totalImported = mappings.length;
  const confirmedCount = mappings.filter((m) => m.status === 'confirmed').length;

  const readyList = useMemo(() => {
    return mappings.filter(
      (m) => m.status !== 'confirmed' && (m.gate === 'ready' || (m.confidence >= 90 && m.blynt_code))
    );
  }, [mappings]);

  const checkList = useMemo(() => {
    return mappings.filter(
      (m) =>
        m.status !== 'confirmed' &&
        (m.gate === 'check' || (m.confidence >= 70 && m.confidence < 90 && m.blynt_code))
    );
  }, [mappings]);

  const exceptionList = useMemo(() => {
    return mappings.filter(
      (m) =>
        m.status !== 'confirmed' &&
        (m.gate === 'exception' || m.confidence < 70 || !m.blynt_code || m.sign_mismatch)
    );
  }, [mappings]);

  const readyCount = readyList.length;
  const checkCount = checkList.length;
  const exceptionCount = exceptionList.length;

  // Unmapped balance strictly calculated via BigInt (Ground Rule 2)
  const unmappedBalancePence = mappings
    .filter((m) => m.status !== 'confirmed')
    .reduce((acc, m) => acc + asPence(m.balance_p), 0n);

  const isFullyMapped = unmappedBalancePence === 0n && totalImported > 0;

  // Filtered list
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      const matchSearch =
        m.source_code.toLowerCase().includes(search.toLowerCase()) ||
        m.source_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.blynt_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.statutory_line || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.schedule_ref || '').toLowerCase().includes(search.toLowerCase());

      const matchType = typeFilter === 'all' || m.source_type.toLowerCase() === typeFilter.toLowerCase();
      const matchStat =
        statutoryFilter === 'all' ||
        (m.statutory_line || '').toLowerCase().includes(statutoryFilter.toLowerCase());

      if (!matchSearch || !matchType || !matchStat) return false;

      if (activeTab === 'ready') return m.status !== 'confirmed' && (m.gate === 'ready' || (m.confidence >= 90 && m.blynt_code));
      if (activeTab === 'check') return m.status !== 'confirmed' && (m.gate === 'check' || (m.confidence >= 70 && m.confidence < 90 && m.blynt_code));
      if (activeTab === 'exception') return m.status !== 'confirmed' && (m.gate === 'exception' || m.confidence < 70 || !m.blynt_code || m.sign_mismatch);
      if (activeTab === 'confirmed') return m.status === 'confirmed';
      return true;
    });
  }, [mappings, search, typeFilter, statutoryFilter, activeTab]);

  // Active detail mapping for slide-over facts (DAT-03 UI step 3)
  const detailMapping = mappings.find((m) => m.id === activeDetailId) || null;
  const [pickCode, setPickCode] = useState('');
  useEffect(() => {
    setPickCode(detailMapping?.blynt_code ?? '');
  }, [activeDetailId]);

  // Selection handlers (DAT-04)
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    if (selectedIds.length === filteredMappings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMappings.map((m) => m.id));
    }
  };

  // DAT-04: Single action confirms all Ready mappings
  const handleConfirmAllReady = () => {
    const readyIds = readyList.map((m) => m.id);
    if (readyIds.length === 0) return;

    const actor = getActor();
    const now = new Date().toISOString();

    setMappings((prev) =>
      prev.map((m) =>
        readyIds.includes(m.id)
          ? {
              ...m,
              status: 'confirmed' as const,
              confirmed_by: actor.id,
              confirmed_at: now,
            }
          : m
      )
    );

    // Sync to db and record in AI log (AUD-03) and audit log (AUD-01)
    readyIds.forEach((id) => {
      const item = db.account_mappings.find((m) => m.id === id);
      if (item) {
        item.status = 'confirmed';
        item.confirmed_by = actor.id;
        item.confirmed_at = now;

        // Log AI action
        db.ai_action_logs.push({
          id: `ail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          firm_id: firmId,
          engagement_id: engagementId,
          output_type: 'mapping',
          inputs_used: `${item.source_code} ${item.source_name}`,
          confidence: item.confidence,
          model_version: 'gpt-4o-accountant-v1.1',
          outcome: 'accepted',
          decided_by: actor.id,
          decided_by_name: actor.name,
          decided_at: now,
        });

        // Audit log entry
        db.logAudit(
          firmId,
          actor,
          'CONFIRM_MAPPING',
          'account_mappings',
          item.id,
          null,
          { source_code: item.source_code, blynt_code: item.blynt_code, gate: 'ready' }
        );
      }
    });

    setCorrectionToast({
      message: `Confirmed ${readyIds.length} Ready account mappings.`,
    });
    setTimeout(() => setCorrectionToast(null), 3500);
    setSelectedIds((prev) => prev.filter((id) => !readyIds.includes(id)));
  };

  // Confirm selected Check or filtered items
  const handleConfirmSelected = () => {
    // Exception items with no mapping cannot be confirmed
    const validIds = selectedIds.filter((id) => {
      const m = db.account_mappings.find((x) => x.id === id);
      return m && m.blynt_code;
    });

    if (validIds.length === 0) return;

    const actor = getActor();
    const now = new Date().toISOString();

    setMappings((prev) =>
      prev.map((m) =>
        validIds.includes(m.id)
          ? {
              ...m,
              status: 'confirmed' as const,
              confirmed_by: actor.id,
              confirmed_at: now,
            }
          : m
      )
    );

    validIds.forEach((id) => {
      const item = db.account_mappings.find((m) => m.id === id);
      if (item) {
        item.status = 'confirmed';
        item.confirmed_by = actor.id;
        item.confirmed_at = now;

        db.ai_action_logs.push({
          id: `ail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          firm_id: firmId,
          engagement_id: engagementId,
          output_type: 'mapping',
          inputs_used: `${item.source_code} ${item.source_name}`,
          confidence: item.confidence,
          model_version: 'gpt-4o-accountant-v1.1',
          outcome: 'accepted',
          decided_by: actor.id,
          decided_by_name: actor.name,
          decided_at: now,
        });

        db.logAudit(
          firmId,
          actor,
          'CONFIRM_MAPPING',
          'account_mappings',
          item.id,
          null,
          { source_code: item.source_code, blynt_code: item.blynt_code }
        );
      }
    });

    setCorrectionToast({
      message: `Confirmed ${validIds.length} selected mappings.`,
    });
    setTimeout(() => setCorrectionToast(null), 3500);
    setSelectedIds((prev) => prev.filter((id) => !validIds.includes(id)));
  };

  // Initiate mapping correction (opens DAT-09 rule pop-over modal)
  const handleInitiateChangeMapping = (mappingId: string, newBlyntCode: string) => {
    const item = db.account_mappings.find((m) => m.id === mappingId);
    if (!item) return;

    const patternGuess = `*${item.source_name.split(' ')[0]}*`;

    setPendingCorrection({
      mappingId,
      sourceCode: item.source_code,
      sourceName: item.source_name,
      sourceType: item.source_type,
      targetCode: newBlyntCode,
      pattern: patternGuess,
    });
    setRuleModalOpen(true);
  };

  // Execute Rule Creation and Apply Correction (DAT-09, DAT-05)
  const handleSaveCorrectionWithRule = () => {
    if (!pendingCorrection) return;
    const { mappingId, sourceName, targetCode, pattern } = pendingCorrection;
    const actor = getActor();
    const now = new Date().toISOString();
    const targetAcc = db.blynt_accounts.find((b) => b.code === targetCode);
    const statDetails = getStatutoryDetails(targetCode, sourceName);

    // 1. Create rule in db.learned_rules if scope is supplier, client, or practice (DAT-09)
    let appliedCount = 1;
    let createdRuleId: string | null = null;

    if (ruleScope !== 'item') {
      createdRuleId = `rule_${Date.now()}`;
      const newRule: LearnedRule = {
        id: createdRuleId,
        firm_id: firmId,
        client_id: ruleScope === 'client' ? engagementClientId : null,
        supplier_name: ruleScope === 'supplier' ? sourceName : null,
        type: 'mapping',
        scope: ruleScope,
        pattern: pattern,
        target_value: targetCode,
        explanation: `Rule learned from correction on ${sourceName} → ${targetCode} ${targetAcc?.name ?? ''}`,
        created_by: actor.id,
        created_by_name: actor.name,
        created_at: now,
        times_used: 1,
        // Practice rules wait for a manager (DAT-09); the server refuses anything else
        active: ruleScope !== 'practice' || ['manager', 'partner', 'admin'].includes(actor.role),
        approved_by_manager: ruleScope === 'practice' ? ['manager', 'partner', 'admin'].includes(actor.role) : true,
      };
      db.learned_rules.unshift(newRule);

      db.logAudit(
        firmId,
        actor,
        'CREATE_LEARNED_RULE',
        'learned_rules',
        newRule.id,
        null,
        newRule
      );

      // Apply immediately to matching unconfirmed accounts in the same file (DAT-05 criteria 1)
      const patternRegex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
      db.account_mappings.forEach((m) => {
        if (m.engagement_id === engagementId && m.id !== mappingId && m.status !== 'confirmed') {
          if (patternRegex.test(m.source_name)) {
            m.blynt_code = targetCode;
            m.status = 'suggested';
            m.confidence = 95;
            m.method = 'rule';
            m.ai_reason = `Applied from newly created rule: ${pattern}`;
            m.gate = 'ready';
            appliedCount++;
          }
        }
      });
    }

    // 2. Update the target mapping
    const item = db.account_mappings.find((m) => m.id === mappingId);
    if (item) {
      const before = { ...item };
      item.blynt_code = targetCode;
      item.status = 'confirmed';
      item.confidence = 100;
      item.method = 'manual';
      item.statutory_line = statDetails.statutory_line;
      item.schedule_ref = statDetails.schedule_ref;
      item.cash_flow_category = statDetails.cash_flow_category;
      item.confirmed_by = actor.id;
      item.confirmed_at = now;
      item.gate = 'ready';

      // Log to AI Action Log (AUD-03)
      db.ai_action_logs.push({
        id: `ail_${Date.now()}`,
        firm_id: firmId,
        engagement_id: engagementId,
        output_type: 'mapping',
        inputs_used: `${item.source_code} ${item.source_name}`,
        confidence: item.confidence,
        model_version: 'gpt-4o-accountant-v1.1',
        outcome: 'edited',
        decided_by: actor.id,
        decided_by_name: actor.name,
        decided_at: now,
      });

      db.logAudit(
        firmId,
        actor,
        'UPDATE_MAPPING_WITH_RULE',
        'account_mappings',
        item.id,
        before,
        { ...item, ruleScope, rulePattern: pattern }
      );
    }

    reloadData();
    setRuleModalOpen(false);
    setPendingCorrection(null);

    // Toast with Undo (DAT-05 UI step 1)
    setCorrectionToast({
      message: `Rule created – applied to ${appliedCount} accounts (scope: ${ruleScope}).`,
      undoAction: createdRuleId
        ? () => {
            db.learned_rules = db.learned_rules.filter((r) => r.id !== createdRuleId);
            reloadData();
            setCorrectionToast({ message: 'Rule undone.' });
          }
        : undefined,
    });
    setTimeout(() => setCorrectionToast(null), 4500);
  };

  // Batch remap selected accounts
  const handleApplyBatchRemap = () => {
    if (!batchTargetCode || selectedIds.length === 0) return;
    const actor = getActor();
    const now = new Date().toISOString();
    const targetAcc = db.blynt_accounts.find((b) => b.code === batchTargetCode);
    const statDetails = getStatutoryDetails(batchTargetCode);

    selectedIds.forEach((id) => {
      const item = db.account_mappings.find((m) => m.id === id);
      if (item) {
        const before = { ...item };
        item.blynt_code = batchTargetCode;
        item.status = 'confirmed';
        item.confidence = 100;
        item.method = 'manual';
        item.statutory_line = statDetails.statutory_line;
        item.schedule_ref = statDetails.schedule_ref;
        item.cash_flow_category = statDetails.cash_flow_category;
        item.confirmed_by = actor.id;
        item.confirmed_at = now;
        item.gate = 'ready';

        db.logAudit(
          firmId,
          actor,
          'BATCH_MAP_ACCOUNTS',
          'account_mappings',
          item.id,
          before,
          item
        );
      }
    });

    reloadData();
    setCorrectionToast({
      message: `Mapped and confirmed ${selectedIds.length} accounts to ${batchTargetCode} ${targetAcc?.name ?? ''}.`,
    });
    setTimeout(() => setCorrectionToast(null), 3500);
    setSelectedIds([]);
    setBatchTargetCode('');
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* Header with Title and v1.1 Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5B6478] mb-1">
            <Link href="/" className="hover:text-[#FF7D6B] transition-colors">Blynt</Link>
            <span>/</span>
            <span className="text-[#102654] font-semibold">{engagementSummary(engagementId).clientName}</span>
            <span>/</span>
            <span>Step 4 Account mapping</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102654] tracking-tight">
              Account mapping &amp; Confidence Gate
            </h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] border border-[#1D4E89]/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
              DAT-03 · DAT-08
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1 max-w-3xl leading-relaxed">
            Every nominal account is mapped to a statutory line, schedule, and cash flow category. Rules engine runs first (client &gt; practice &gt; prior-year), followed by the AI confidence gate.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/engagements/${engagementId}/workpapers`}
            className={`min-h-[42px] px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
              isFullyMapped
                ? 'bg-[#0B6B52] hover:bg-[#095742] text-white shadow-xs'
                : 'bg-[#F4F5F7] text-[#5B6478] border border-[#D5DBE7]'
            }`}
          >
            {isFullyMapped ? <Unlock className="w-4 h-4 text-emerald-300" /> : <Lock className="w-4 h-4" />}
            <span>Go to working paper</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Confidence Gate Summary Strip (DAT-03, DAT-08) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* READY GATE */}
        <div className="bg-white border-2 border-emerald-500/30 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready (≥90%)
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-mono">
                Gate: Ready
              </span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-800 font-mono-numbers mt-2">
              {readyCount}
            </div>
            <div className="text-[11px] text-[#5B6478] mt-0.5">High confidence suggestions</div>
          </div>
          {readyCount > 0 && (
            <button
              type="button"
              onClick={handleConfirmAllReady}
              className="mt-3 w-full py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition-transform active:scale-[0.98]"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Confirm all Ready ({readyCount})</span>
            </button>
          )}
        </div>

        {/* CHECK GATE */}
        <div className="bg-white border-2 border-amber-500/30 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-amber-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Check (70–89%)
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-mono">
                Gate: Check
              </span>
            </div>
            <div className="text-2xl font-extrabold text-amber-800 font-mono-numbers mt-2">
              {checkCount}
            </div>
            <div className="text-[11px] text-[#5B6478] mt-0.5">Review in small groups</div>
          </div>
          <div className="text-[10px] text-amber-700 font-medium bg-amber-50 p-1.5 rounded-lg border border-amber-200 mt-2">
            Requires preparer review before sign-off
          </div>
        </div>

        {/* EXCEPTION GATE */}
        <div className="bg-white border-2 border-red-500/30 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-red-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Exception (&lt;70%)
              </span>
              <span className="text-[10px] bg-red-100 text-red-900 px-2 py-0.5 rounded-full font-mono">
                Gate: Exception
              </span>
            </div>
            <div className="text-2xl font-extrabold text-red-800 font-mono-numbers mt-2">
              {exceptionCount}
            </div>
            <div className="text-[11px] text-[#5B6478] mt-0.5">Map one at a time by hand</div>
          </div>
          <div className="text-[10px] text-red-700 font-medium bg-red-50 p-1.5 rounded-lg border border-red-200 mt-2">
            Cannot be bulk confirmed
          </div>
        </div>

        {/* CONFIRMED */}
        <div className="bg-white border border-[#E3E7EF] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-[#102654]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0B6B52]" />
                Confirmed
              </span>
              <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                {totalImported > 0 ? Math.round((confirmedCount / totalImported) * 100) : 0}%
              </span>
            </div>
            <div className="text-2xl font-extrabold text-[#102654] font-mono-numbers mt-2">
              {confirmedCount} / {totalImported}
            </div>
            <div className="text-[11px] text-[#5B6478] mt-0.5">Agreed by accountant</div>
          </div>
          <div className="text-[10px] text-[#5B6478] mt-2 font-mono">
            {confirmedCount === totalImported ? 'All accounts verified' : `${totalImported - confirmedCount} unconfirmed`}
          </div>
        </div>

        {/* UNMAPPED BALANCE (GROUND RULE 2) */}
        <div
          className={`rounded-2xl p-4 border-2 shadow-xs flex flex-col justify-between ${
            isFullyMapped
              ? 'border-emerald-500/50 bg-[#E6F4EF]/60'
              : 'border-red-500/60 bg-[#FDECEA]/60'
          }`}
        >
          <div>
            <div
              className={`text-xs font-bold uppercase tracking-wider ${
                isFullyMapped ? 'text-[#0B6B52]' : 'text-red-700'
              }`}
            >
              Unmapped Balance
            </div>
            <div
              className={`text-xl font-extrabold font-mono-numbers mt-1.5 ${
                isFullyMapped ? 'text-[#0B6B52]' : 'text-red-700'
              }`}
            >
              {formatPence(unmappedBalancePence)}
            </div>
            <div className="text-[10px] mt-1 font-semibold text-[#102654]">
              {isFullyMapped ? '✓ Working papers unlocked' : 'Must be £0.00 to balance'}
            </div>
          </div>
          <div className="text-[9px] text-[#5B6478] mt-2">
            Auto-accept: <strong>OFF</strong> (DAT-08)
          </div>
        </div>
      </div>

      {/* Fully Mapped Success Card (DAT-04 UI step 5) */}
      {isFullyMapped && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 text-xs text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <strong className="block text-sm font-bold text-emerald-900">
                All accounts mapped!
              </strong>
              <span>
                Trial balance is in complete balance with £0.00 unmapped variance. All 17 control account schedules are ready.
              </span>
            </div>
          </div>
          <Link
            href={`/engagements/${engagementId}/workpapers`}
            className="px-5 py-2.5 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-[0.98] shrink-0"
          >
            <span>Go to working paper</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white border border-[#E3E7EF] rounded-2xl shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[#E3E7EF] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Gate Filters (DAT-04 UI step 1 & 2) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: 'all', label: 'All', count: totalImported },
              { id: 'ready', label: 'Ready', count: readyCount, color: 'text-emerald-700' },
              { id: 'check', label: 'Check', count: checkCount, color: 'text-amber-700' },
              { id: 'exception', label: 'Exception', count: exceptionCount, color: 'text-red-700' },
              { id: 'confirmed', label: 'Confirmed', count: confirmedCount },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`min-h-[38px] px-3.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-[#102654] text-white shadow-xs'
                    : 'text-[#5B6478] hover:bg-[#F6F7FB] hover:text-[#102654]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#F4F5F7] text-[#5B6478]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5B6478] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="mapping-search"
                type="text"
                placeholder="Search code, name, schedule..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-[38px] pl-8 pr-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-xl text-[#102654] outline-none focus:border-[#FF7D6B] w-52"
              />
            </div>

            {/* Batch Remap Toolbar (DAT-04 step 4) */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-[#EAF5FC] border border-[#B3D7F5] px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-[#102654]">
                  Map selected ({selectedIds.length}) to:
                </span>
                <select
                  aria-label="Map selected accounts"
                  value={batchTargetCode}
                  onChange={(e) => setBatchTargetCode(e.target.value)}
                  className="text-xs font-semibold py-1 px-2 border border-[#D5DBE7] rounded-lg bg-white text-[#102654] max-w-[200px]"
                >
                  <option value="">Select target COA…</option>
                  <optgroup label="Cash &amp; Banking (REC-02)">
                    <option value="1000">1000 Petty Cash</option>
                    <option value="1010">1010 Barclays Operating Account</option>
                    <option value="1020">1020 Barclays High Yield Reserve</option>
                  </optgroup>
                  <optgroup label="Fixed Assets (REC-03)">
                    <option value="1500">1500 Plant &amp; Equipment at Cost</option>
                    <option value="1510">1510 Computer Equipment Cost</option>
                    <option value="1520">1520 Fixtures and Fittings Cost</option>
                    <option value="1700">1700 Plant Accumulated Depreciation</option>
                    <option value="1710">1710 Computer Equip Accum Deprec</option>
                  </optgroup>
                  <optgroup label="Working Capital (REC-07, REC-08, REC-09)">
                    <option value="1200">1200 Trade Debtors Control</option>
                    <option value="1210">1210 Allowance for Doubtful Debts</option>
                    <option value="1400">1400 Prepayments &amp; Accrued Income</option>
                    <option value="1300">1300 Finished Goods Stock (REC-14)</option>
                    <option value="2000">2000 Trade Creditors Control</option>
                    <option value="2100">2100 Accrued Expenses</option>
                  </optgroup>
                  <optgroup label="Taxation &amp; Payroll (REC-05, REC-06, REC-13)">
                    <option value="2200">2200 VAT Liability Control</option>
                    <option value="2300">2300 PAYE &amp; NIC Control</option>
                    <option value="835b">835b Director&apos;s Loan Account (REC-11)</option>
                  </optgroup>
                  <optgroup label="Equity &amp; P&amp;L (REC-01, REC-12)">
                    <option value="3000">3000 Ordinary Share Capital</option>
                    <option value="3100">3100 Retained Reserves</option>
                    <option value="4000">4000 Wholesale Commercial Sales</option>
                    <option value="5000">5000 Direct Materials &amp; Costs</option>
                    <option value="6000">6000 Office Rent &amp; Administration</option>
                    <option value="6100">6100 Utilities Light Heat Power</option>
                    <option value="6900">6900 Depreciation Charge</option>
                  </optgroup>
                </select>
                <button
                  type="button"
                  disabled={!batchTargetCode}
                  onClick={handleApplyBatchRemap}
                  className="px-2.5 py-1 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-lg disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Confirm Selected Button */}
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleConfirmSelected}
              className="min-h-[38px] px-4 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs transition-transform active:scale-[0.98]"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#102654]">
            <thead className="bg-[#F6F7FB] text-[#5B6478] uppercase text-[10px] font-bold tracking-wider border-b border-[#E3E7EF]">
              <tr>
                <th scope="col" className="p-3 pl-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredMappings.length}
                    onChange={handleSelectAllVisible}
                    className="w-4 h-4 rounded border-[#D5DBE7] text-[#102654] focus:ring-[#FF7D6B]"
                  />
                </th>
                <th scope="col" className="p-3">Ledger Code &amp; Name</th>
                <th scope="col" className="p-3 text-right">Balance</th>
                <th scope="col" className="p-3">Statutory Line &amp; Schedule</th>
                <th scope="col" className="p-3">Confidence &amp; Gate</th>
                <th scope="col" className="p-3 min-w-[280px]">AI Reason &amp; Evidence (DAT-03)</th>
                <th scope="col" className="p-3 min-w-[220px]">Blynt Account (Mapping)</th>
                <th scope="col" className="p-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF]">
              {filteredMappings.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const stat = getStatutoryDetails(row.blynt_code, row.source_name, row.source_type);
                const isSignMismatch =
                  (stat.is_credit_area && asPence(row.balance_p) > 0n) ||
                  (!stat.is_credit_area && asPence(row.balance_p) < 0n);

                const gateName =
                  row.status === 'confirmed'
                    ? 'confirmed'
                    : row.confidence >= 90
                    ? 'ready'
                    : row.confidence >= 70
                    ? 'check'
                    : 'exception';

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-[#F6F7FB] transition-colors cursor-pointer ${
                      activeDetailId === row.id ? 'bg-[#EAF5FC]/50' : ''
                    } ${isSignMismatch ? 'bg-amber-50/20' : ''}`}
                    onClick={() => setActiveDetailId(row.id)}
                  >
                    <td className="p-3 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(row.id)}
                        className="w-4 h-4 rounded border-[#D5DBE7] text-[#102654] focus:ring-[#FF7D6B]"
                      />
                    </td>

                    {/* Code & Name */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#102654] bg-[#F4F5F7] px-2 py-0.5 rounded text-[11px]">
                          {row.source_code}
                        </span>
                        <div>
                          <div className="font-bold text-[#102654]">{row.source_name}</div>
                          <div className="text-[10px] text-[#5B6478]">{row.source_type}</div>
                        </div>
                      </div>
                    </td>

                    {/* Balance */}
                    <td className="p-3 text-right font-mono-numbers font-semibold">
                      <div className="flex items-center justify-end gap-1.5">
                        {isSignMismatch && (
                          <span
                            title="Sign mismatch: Balance sign contradicts statutory mapping classification"
                            className="text-amber-600 bg-amber-100 p-0.5 rounded-full"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span>{formatPence(row.balance_p, { accountingFormat: true })}</span>
                      </div>
                    </td>

                    {/* Statutory Line & Schedule */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[10px] bg-[#EAF5FC] text-[#1D4E89] px-1.5 py-0.5 rounded">
                          {row.schedule_ref || stat.schedule_ref}
                        </span>
                        <span className="text-[11px] font-medium text-[#102654] truncate max-w-[200px]" title={row.statutory_line || stat.statutory_line}>
                          {row.statutory_line || stat.statutory_line}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#7E8DA6] mt-0.5">
                        {row.cash_flow_category || stat.cash_flow_category}
                      </div>
                    </td>

                    {/* Confidence & Gate Badge */}
                    <td className="p-3">
                      {row.status === 'confirmed' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          <span>Confirmed</span>
                        </span>
                      ) : gateName === 'ready' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Ready {row.confidence}%</span>
                        </span>
                      ) : gateName === 'check' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Check {row.confidence}%</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 w-max">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Exception {row.confidence}%</span>
                        </span>
                      )}
                    </td>

                    {/* AI Reason & Evidence (hoverable) */}
                    <td className="p-3">
                      <div
                        className="text-[11px] text-[#5B6478] line-clamp-1 group relative cursor-help"
                        title={`Evidence chain: ${row.evidence_used || 'Client rules > Practice rules > Prior-year mapping > Pattern'}`}
                      >
                        <span className="font-medium text-[#102654]">
                          {row.ai_reason || `Matched nominal name pattern "${row.source_name.split(' ')[0]}"`}
                        </span>
                        <div className="text-[10px] text-[#7E8DA6]">
                          {row.evidence_used || 'Rule > Name pattern > Code range'}
                        </div>
                      </div>
                    </td>

                    {/* Blynt Account Dropdown */}
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        aria-label={`Select mapping for ${row.source_name}`}
                        value={row.blynt_code || ''}
                        onChange={(e) => handleInitiateChangeMapping(row.id, e.target.value)}
                        className="text-xs font-semibold py-1.5 px-2 border border-[#D5DBE7] hover:border-[#102654] focus:border-[#102654] rounded-lg bg-white text-[#102654] shadow-2xs transition-all cursor-pointer w-full max-w-[240px]"
                      >
                        <option value="">Select Blynt COA Account…</option>
                        <optgroup label="Cash &amp; Banking (REC-02)">
                          <option value="1000">1000 Petty Cash</option>
                          <option value="1010">1010 Barclays Operating Account</option>
                          <option value="1020">1020 Barclays High Yield Reserve</option>
                        </optgroup>
                        <optgroup label="Fixed Assets (REC-03)">
                          <option value="1500">1500 Plant &amp; Equipment Cost</option>
                          <option value="1510">1510 Computer Equipment Cost</option>
                          <option value="1520">1520 Fixtures and Fittings Cost</option>
                          <option value="1700">1700 Plant Accumulated Depreciation</option>
                          <option value="1710">1710 Computer Equip Accum Deprec</option>
                        </optgroup>
                        <optgroup label="Working Capital (REC-07, REC-08, REC-09)">
                          <option value="1200">1200 Trade Debtors Control</option>
                          <option value="1210">1210 Allowance for Doubtful Debts</option>
                          <option value="1400">1400 Prepayments</option>
                          <option value="1300">1300 Finished Goods Stock (REC-14)</option>
                          <option value="2000">2000 Trade Creditors Control</option>
                          <option value="2100">2100 Accrued Expenses</option>
                        </optgroup>
                        <optgroup label="Taxation &amp; Payroll (REC-05, REC-06, REC-13)">
                          <option value="2200">2200 VAT Liability Control</option>
                          <option value="2300">2300 PAYE &amp; NIC Control</option>
                          <option value="835b">835b Director&apos;s Loan Account (REC-11)</option>
                        </optgroup>
                        <optgroup label="Equity &amp; P&amp;L (REC-01, REC-12)">
                          <option value="3000">3000 Ordinary Share Capital</option>
                          <option value="3100">3100 Retained Reserves</option>
                          <option value="4000">4000 Wholesale Commercial Sales</option>
                          <option value="5000">5000 Direct Materials &amp; Costs</option>
                          <option value="6000">6000 Office Rent &amp; Administration</option>
                          <option value="6100">6100 Utilities Light Heat Power</option>
                          <option value="6900">6900 Depreciation Charge</option>
                        </optgroup>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="p-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status !== 'confirmed' && row.blynt_code && (
                          <button
                            type="button"
                            onClick={() => {
                              const actor = getActor();
                              row.status = 'confirmed';
                              row.confirmed_by = actor.id;
                              row.confirmed_at = new Date().toISOString();
                              db.logAudit(firmId, actor, 'CONFIRM_MAPPING', 'account_mappings', row.id, null, row);
                              reloadData();
                            }}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] rounded-lg shadow-2xs"
                          >
                            Confirm
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveDetailId(row.id)}
                          className="px-2 py-1 text-[11px] font-semibold text-[#102654] hover:bg-[#EAF5FC] border border-[#D5DBE7] hover:border-[#102654] rounded-lg flex items-center gap-1 transition-colors"
                          title="Open account facts, evidence and rules"
                        >
                          <Pencil className="w-3 h-3 text-[#5B6478]" />
                          <span>Rule</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RULE CREATION MODAL UPON CORRECTION (DAT-09, DAT-05) */}
      {ruleModalOpen && pendingCorrection && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EAF5FC] text-[#1D4E89] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#FF7D6B]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#102654]">Learn Rule from Correction (DAT-09)</h3>
                  <p className="text-[11px] text-[#5B6478]">Save this correction so the same mistake is never repeated</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#F6F7FB] rounded-xl text-xs space-y-1.5 border border-[#E3E7EF]">
              <div className="flex items-center justify-between">
                <span className="text-[#5B6478]">Nominal account:</span>
                <span className="font-mono font-bold text-[#102654]">
                  {pendingCorrection.sourceCode} {pendingCorrection.sourceName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5B6478]">Remapped to:</span>
                <span className="font-mono font-bold text-[#0B6B52]">
                  {pendingCorrection.targetCode} ({db.blynt_accounts.find((b) => b.code === pendingCorrection.targetCode)?.name})
                </span>
              </div>
            </div>

            {/* Scope Selection (DAT-09 UI step 1) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#102654]">
                Choose Rule Scope:
              </label>
              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer hover:bg-gray-50 border-gray-200">
                  <input
                    type="radio"
                    name="ruleScope"
                    checked={ruleScope === 'item'}
                    onChange={() => setRuleScope('item')}
                    className="mt-0.5 text-[#102654]"
                  />
                  <div>
                    <div className="font-bold text-[#102654]">This item only</div>
                    <div className="text-[11px] text-[#5B6478]">Do not create a reusable rule; apply only to this nominal.</div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer hover:bg-gray-50 border-gray-200">
                  <input
                    type="radio"
                    name="ruleScope"
                    checked={ruleScope === 'supplier'}
                    onChange={() => setRuleScope('supplier')}
                    className="mt-0.5 text-[#102654]"
                  />
                  <div>
                    <div className="font-bold text-[#102654]">This supplier / name pattern ({pendingCorrection.pattern})</div>
                    <div className="text-[11px] text-[#5B6478]">Apply to all nominals matching this pattern across future uploads.</div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer hover:bg-gray-50 border-emerald-300 bg-emerald-50/30">
                  <input
                    type="radio"
                    name="ruleScope"
                    checked={ruleScope === 'client'}
                    onChange={() => setRuleScope('client')}
                    className="mt-0.5 text-[#0B6B52]"
                  />
                  <div>
                    <div className="font-bold text-[#0B6B52]">This client only (Harlow Food Group)</div>
                    <div className="text-[11px] text-[#5B6478]">Remembered for all future engagements and roll-forward periods for this client.</div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer hover:bg-gray-50 border-gray-200">
                  <input
                    type="radio"
                    name="ruleScope"
                    checked={ruleScope === 'practice'}
                    onChange={() => setRuleScope('practice')}
                    className="mt-0.5 text-[#102654]"
                  />
                  <div>
                    <div className="font-bold text-[#102654]">Whole practice (requires manager approval)</div>
                    <div className="text-[11px] text-[#5B6478]">Sent to Manager Approval Queue in Practice Settings &gt; Rules.</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#5B6478] hover:text-[#102654]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCorrectionWithRule}
                className="px-5 py-2.5 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-xl shadow-xs transition-transform active:scale-[0.98]"
              >
                Save &amp; Apply Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Detail Slide-over Panel */}
      {detailMapping && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/40 backdrop-blur-xs flex items-center justify-end animate-in fade-in"
        >
          <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col border-l border-[#E3E7EF] animate-in slide-in-from-right">
            <div className="p-4 border-b border-[#E3E7EF] flex items-center justify-between bg-[#102654] text-white">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#FF7D6B] tracking-wider">
                  Mapping Facts &amp; Evidence
                </span>
                <h3 className="text-sm font-bold mt-0.5">
                  {detailMapping.source_code} • {detailMapping.source_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailId(null)}
                className="p-1 text-white/70 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-5 text-xs text-[#102654]">
              {/* Account Facts */}
              <div className="p-3.5 bg-[#F6F7FB] border border-[#E3E7EF] rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#5B6478]">Source balance:</span>
                  <span className="font-mono font-bold text-sm">
                    {formatPence(detailMapping.balance_p)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5B6478]">Source category:</span>
                  <span className="font-semibold">{detailMapping.source_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5B6478]">Evidence hierarchy:</span>
                  <span className="text-[11px] font-mono font-medium text-[#1D4E89]">
                    {detailMapping.evidence_used || 'Client rule > Prior year > Name match'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5B6478]">Confidence:</span>
                  <span className="font-bold text-emerald-700">{detailMapping.confidence}%</span>
                </div>
              </div>

              {/* Select target */}
              <div>
                <label className="block text-xs font-bold text-[#102654] mb-1.5">
                  Assigned Blynt COA Account:
                </label>
                <select
                  aria-label="Assigned Blynt COA"
                  value={pickCode}
                  onChange={(e) => setPickCode(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-[#D5DBE7] rounded-xl bg-white text-[#102654] outline-none focus:ring-1 focus:ring-[#1D4E89]"
                >
                  <option value="">Select Blynt COA Account…</option>
                  {db.blynt_accounts.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* AI Alternatives */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#A23A27] mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✦ AI Suggested Alternatives</span>
                </div>
                <div className="space-y-2">
                  {(detailMapping.ai_alternatives || [
                    { blynt_code: '6000', name: 'Office Rent & Administration', reason: 'Common administrative overhead classification', confidence: 75 },
                    { blynt_code: '2100', name: 'Accruals and deferred income', reason: 'Potential balance sheet contra provision', confidence: 60 },
                  ]).map((alt) => (
                    <button
                      key={alt.blynt_code}
                      type="button"
                      onClick={() => setPickCode(alt.blynt_code)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        pickCode === alt.blynt_code
                          ? 'border-[#102654] bg-[#F6F7FB]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#102654]">{alt.blynt_code} {alt.name}</span>
                        <span className="text-[10px] font-mono text-[#A23A27] bg-[#FFF1EE] px-1.5 py-0.5 rounded">
                          {alt.confidence}%
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5B6478] mt-1">{alt.reason}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E3E7EF] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveDetailId(null)}
                className="px-4 py-2 border border-[#D5DBE7] rounded-xl text-xs font-semibold text-[#5B6478]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!pickCode}
                onClick={() => {
                  handleInitiateChangeMapping(detailMapping.id, pickCode);
                  setActiveDetailId(null);
                }}
                className="px-5 py-2.5 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-40"
              >
                Save &amp; Create Rule…
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Correction Toast (DAT-05 UI step 1) */}
      {correctionToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#102654] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{correctionToast.message}</span>
          {correctionToast.undoAction && (
            <button
              type="button"
              onClick={correctionToast.undoAction}
              className="ml-2 text-[#FF7D6B] hover:underline font-bold"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
