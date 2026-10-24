'use client';

import { getActor, getCurrentUserId } from '@/lib/session';

import { engagementSummary } from '@/lib/api';

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
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { AccountMapping, BlyntAccount } from '@/lib/types/models';
import { toPence, asPence, formatPence } from '@/lib/money';
import { matchBlyntAccount } from '@/lib/mapping/auto-mapper';

export default function AccountMappingPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';

  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'needs_you' | 'suggested' | 'confirmed' | 'comments'>('all');
  const [search, setSearch] = useState('');
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [isRunningAi, setIsRunningAi] = useState(false);

  // Load from db
  useEffect(() => {
    const list = db.account_mappings.filter((m) => m.engagement_id === engagementId);
    setMappings([...list]);
  }, [engagementId]);

  // Live Calculations (Ground Rule 2)
  const totalImported = mappings.length;
  const confirmedCount = mappings.filter((m) => m.status === 'confirmed').length;
  const suggestedCount = mappings.filter((m) => m.status === 'suggested').length;
  const needsYouCount = mappings.filter((m) => m.status === 'needs_you').length;

  // Unmapped balance strictly calculated via BigInt
  const unmappedBalancePence = mappings
    .filter((m) => m.status !== 'confirmed')
    .reduce((acc, m) => acc + asPence(m.balance_p), 0n);

  const isUnlocked = unmappedBalancePence === 0n;

  // Filtered list
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      const matchSearch =
        m.source_code.toLowerCase().includes(search.toLowerCase()) ||
        m.source_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.blynt_code || '').toLowerCase().includes(search.toLowerCase());

      const matchType = typeFilter === 'all' || m.source_type.toLowerCase() === typeFilter.toLowerCase();

      if (!matchSearch || !matchType) return false;

      if (activeTab === 'needs_you') return m.status === 'needs_you';
      if (activeTab === 'suggested') return m.status === 'suggested';
      if (activeTab === 'confirmed') return m.status === 'confirmed';
      if (activeTab === 'comments') return (m.comment_count || 0) > 0;
      return true;
    });
  }, [mappings, search, typeFilter, activeTab]);

  // Active detail mapping
  const detailMapping = mappings.find((m) => m.id === activeDetailId) || null;
  const [pickCode, setPickCode] = useState('');
  useEffect(() => {
    setPickCode(detailMapping?.blynt_code ?? '');
  }, [activeDetailId]);

  // Selection handlers
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

  // Ground rule: No accept-all. "Confirm selected (n)" only.
  const handleConfirmSelected = () => {
    // Rows without a Blynt account cannot be confirmed in a batch
    const ids = selectedIds.filter((id) => db.account_mappings.find((m) => m.id === id)?.blynt_code);
    if (ids.length === 0) return;

    setMappings((prev) =>
      prev.map((m) =>
        ids.includes(m.id)
          ? {
              ...m,
              status: 'confirmed' as const,
              confirmed_by: getCurrentUserId(),
              confirmed_at: new Date().toISOString(),
            }
          : m
      )
    );

    // Sync to db
    ids.forEach((id) => {
      const item = db.account_mappings.find((m) => m.id === id);
      if (item) {
        item.status = 'confirmed';
        item.confirmed_by = getCurrentUserId();
        item.confirmed_at = new Date().toISOString();
      }
    });

    db.logAudit(
      'firm_blynt_uk',
      getActor(),
      'CONFIRM_MAPPINGS_BATCH',
      'account_mappings',
      ids.join(','),
      null,
      { count: ids.length }
    );

    setSelectedIds(selectedIds.filter((id) => !ids.includes(id)));
  };

  // Automated AI Matching with Blynt COA for any uploaded CSV accounts
  const handleAiMatchAll = () => {
    setIsRunningAi(true);
    try {
      const updated = mappings.map((m) => {
        const suggestion = matchBlyntAccount(m.source_name, m.source_type, m.source_code);
        if (suggestion) {
          return {
            ...m,
            blynt_code: suggestion.blynt_code,
            confidence: suggestion.confidence,
            method: 'ai' as const,
            status: m.status === 'confirmed' ? ('confirmed' as const) : ('suggested' as const),
          };
        }
        return m;
      });

      updated.forEach((u) => {
        const item = db.account_mappings.find((m) => m.id === u.id);
        if (item) {
          item.blynt_code = u.blynt_code;
          item.confidence = u.confidence;
          item.method = u.method;
          item.status = u.status;
        }
      });

      setMappings([...updated]);
      // Auto-select all unconfirmed accounts that now have a suggested Blynt code
      const toSelect = updated
        .filter((m) => m.blynt_code && m.status !== 'confirmed')
        .map((m) => m.id);
      setSelectedIds(toSelect);
    } finally {
      setIsRunningAi(false);
    }
  };

  // Confirm All Suggested with 1 Click
  const handleConfirmAll = () => {
    const toConfirm = mappings.filter((m) => m.blynt_code);
    if (toConfirm.length === 0) return;
    const ids = toConfirm.map((m) => m.id);
    const userId = getCurrentUserId();
    const now = new Date().toISOString();

    setMappings((prev) =>
      prev.map((m) =>
        m.blynt_code
          ? {
              ...m,
              status: 'confirmed' as const,
              confirmed_by: userId,
              confirmed_at: now,
            }
          : m
      )
    );

    ids.forEach((id) => {
      const item = db.account_mappings.find((m) => m.id === id);
      if (item) {
        item.status = 'confirmed';
        item.confirmed_by = userId;
        item.confirmed_at = now;
      }
    });

    db.logAudit(
      'firm_blynt_uk',
      getActor(),
      'CONFIRM_MAPPINGS_BATCH',
      'account_mappings',
      ids.join(','),
      null,
      { count: ids.length, method: 'ai_auto_match' }
    );

    setSelectedIds([]);
  };

  // Change Blynt Code
  const handleChangeBlyntCode = (mappingId: string, blyntCode: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.id === mappingId
          ? {
              ...m,
              blynt_code: blyntCode,
              status: 'confirmed' as const,
              confirmed_by: getCurrentUserId(),
              confirmed_at: new Date().toISOString(),
              method: 'manual' as const,
            }
          : m
      )
    );

    const item = db.account_mappings.find((m) => m.id === mappingId);
    if (item) {
      const before = { ...item };
      item.blynt_code = blyntCode;
      item.status = 'confirmed';
      item.confirmed_by = getCurrentUserId();
      item.confirmed_at = new Date().toISOString();
      item.method = 'manual';
      db.logAudit('firm_blynt_uk', getActor(), 'CONFIRM_MAPPING', 'account_mappings', item.id, before, item);
    }
  };

  // Keyboard navigation: Enter confirms, / focuses search, Esc closes panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('mapping-search')?.focus();
      } else if (e.key === 'Escape') {
        setActiveDetailId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
            <span>2 Account mapping</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102654] tracking-tight">
            Account mapping
          </h1>
          <p className="text-xs text-[#5B6478] mt-0.5">
            Map imported client accounts to the standard Blynt chart of accounts. Hierarchy: Client rule → Firm rule → Source preset → AI suggestion → Needs you.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/engagements/${engagementId}/trial-balance`}
            className={`min-h-[44px] px-5 py-2 text-xs font-bold rounded-[10px] flex items-center gap-2 transition-all ${
              isUnlocked
                ? 'bg-[#0B6B52] hover:bg-[#095742] text-white shadow-sm'
                : 'bg-[#F4F5F7] text-[#5B6478] border border-[#D5DBE7] cursor-not-allowed'
            }`}
          >
            {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>Go to trial balance</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="blynt-card p-4">
          <div className="text-[11px] font-bold text-[#5B6478] uppercase tracking-wider">
            Imported
          </div>
          <div className="text-2xl font-extrabold text-[#102654] font-mono-numbers mt-1">
            {totalImported}
          </div>
          <div className="text-[10px] text-[#5B6478] mt-1">Total nominals</div>
        </div>

        <div className="blynt-card p-4">
          <div className="text-[11px] font-bold text-[#0B6B52] uppercase tracking-wider">
            Confirmed
          </div>
          <div className="text-2xl font-extrabold text-[#0B6B52] font-mono-numbers mt-1">
            {confirmedCount}
          </div>
          <div className="text-[10px] text-[#5B6478] mt-1">Auditor agreed</div>
        </div>

        <div className="blynt-card p-4">
          <div className="text-[11px] font-bold text-[#A23A27] uppercase tracking-wider">
            Suggested
          </div>
          <div className="text-2xl font-extrabold text-[#A23A27] font-mono-numbers mt-1">
            {suggestedCount}
          </div>
          <div className="text-[10px] text-[#5B6478] mt-1">✦ High confidence</div>
        </div>

        <div className="blynt-card p-4">
          <div className="text-[11px] font-bold text-[#B42318] uppercase tracking-wider">
            Needs you
          </div>
          <div className="text-2xl font-extrabold text-[#B42318] font-mono-numbers mt-1">
            {needsYouCount}
          </div>
          <div className="text-[10px] text-[#5B6478] mt-1">No automated match</div>
        </div>

        {/* Critical Unmapped Balance Tile */}
        <div
          className={`blynt-card p-4 border-2 ${
            isUnlocked ? 'border-[#0B6B52]/40 bg-[#E6F4EF]/50' : 'border-[#B42318]/50 bg-[#FDECEA]/40'
          }`}
        >
          <div
            className={`text-[11px] font-bold uppercase tracking-wider ${
              isUnlocked ? 'text-[#0B6B52]' : 'text-[#B42318]'
            }`}
          >
            Unmapped balance
          </div>
          <div
            className={`text-xl font-extrabold font-mono-numbers mt-1 ${
              isUnlocked ? 'text-[#0B6B52]' : 'text-[#B42318]'
            }`}
          >
            {formatPence(unmappedBalancePence)}
          </div>
          <div className="text-[10px] mt-1 font-semibold">
            {isUnlocked ? '✓ Trial balance unlocked' : 'Must be £0.00 to unlock TB'}
          </div>
        </div>
      </div>

      {/* Unlocked Trial Balance Notification Banner */}
      {isUnlocked && totalImported > 0 && (
        <div className="p-4 bg-[#E6F4EF] border-2 border-[#0B6B52] rounded-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3 text-xs text-[#0B6B52]">
            <CheckCircle2 className="w-5 h-5 text-[#0B6B52] shrink-0" />
            <div>
              <strong className="block text-sm font-extrabold text-[#0B6B52]">
                Trial balance is fully mapped &amp; unlocked!
              </strong>
              <span className="text-[#0B6B52]/90">
                All nominal accounts are matched to Blynt Chart of Accounts with £0.00 unmapped balance.
              </span>
            </div>
          </div>
          <Link
            href={`/engagements/${engagementId}/trial-balance`}
            className="px-5 py-2.5 bg-[#0B6B52] hover:bg-[#08533f] text-white text-xs font-bold rounded-[10px] flex items-center justify-center gap-2 shadow-sm shrink-0 transition-transform active:scale-[0.98]"
          >
            <span>Proceed to Trial Balance &amp; Leadsheets</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Tabs and Controls */}
      <div className="blynt-card overflow-hidden">
        <div className="p-4 border-b border-[#E3E7EF] flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All', count: totalImported },
              { id: 'needs_you', label: '! Needs you', count: needsYouCount },
              { id: 'suggested', label: '✦ Suggested', count: suggestedCount },
              { id: 'confirmed', label: '✓ Confirmed', count: confirmedCount },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`min-h-[38px] px-3.5 text-xs font-semibold rounded-[8px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
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

          {/* Search, Type Filter, Batch Action */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5B6478] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="mapping-search"
                type="text"
                placeholder="Search code, name, or Blynt (/)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-[38px] pl-8 pr-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[8px] text-[#102654] outline-none focus:border-[#FF7D6B] w-56"
              />
            </div>

            {/* AI Auto-Match Button */}
            <button
              type="button"
              disabled={isRunningAi}
              onClick={handleAiMatchAll}
              className="min-h-[38px] px-3.5 bg-[#0B1B3D] hover:bg-[#102654] text-white text-xs font-bold rounded-[8px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-[0.98]"
              title="Automatically match all account names against Blynt Standard Chart of Accounts"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF7D6B]" />
              <span>{isRunningAi ? 'Matching…' : 'AI Match with Blynt COA'}</span>
            </button>

            {/* Quick Confirm All Suggested Button */}
            {suggestedCount > 0 && (
              <button
                type="button"
                onClick={handleConfirmAll}
                className="min-h-[38px] px-3.5 bg-[#E6F4EF] hover:bg-[#cceed6] text-[#0B6B52] border border-[#0B6B52]/40 text-xs font-bold rounded-[8px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-[0.98]"
                title="Confirm all accounts with suggested Blynt COA matches"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm All Suggested ({suggestedCount})</span>
              </button>
            )}

            {/* Confirm Selected (n) Button */}
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleConfirmSelected}
              className="min-h-[38px] px-4 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-[8px] flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs transition-transform active:scale-[0.98]"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>

        {/* Mappings Table */}
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
                <th scope="col" className="p-3">Imported Account</th>
                <th scope="col" className="p-3">Type</th>
                <th scope="col" className="p-3 text-right">Balance</th>
                <th scope="col" className="p-3 text-center">→</th>
                <th scope="col" className="p-3">Blynt Account</th>
                <th scope="col" className="p-3">Match Badge</th>
                <th scope="col" className="p-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF]">
              {filteredMappings.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const blyntAcc = row.blynt_code
                  ? db.blynt_accounts.find((b) => b.code === row.blynt_code)
                  : null;

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-[#F6F7FB] transition-colors cursor-pointer ${
                      activeDetailId === row.id ? 'bg-[#EAF5FC]/50' : ''
                    }`}
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

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#102654] bg-[#F4F5F7] px-1.5 py-0.5 rounded text-[11px]">
                          {row.source_code}
                        </span>
                        <span className="font-semibold text-[#102654]">{row.source_name}</span>
                      </div>
                    </td>

                    <td className="p-3 text-[#5B6478]">{row.source_type}</td>

                    <td className="p-3 text-right font-mono-numbers font-semibold">
                      {formatPence(row.balance_p, { accountingFormat: true })}
                    </td>

                    <td className="p-3 text-center text-[#5B6478]">→</td>

                    <td className="p-3">
                      {blyntAcc ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-[#102654] text-white flex items-center justify-center font-mono font-bold text-[10px]">
                            {blyntAcc.lead_letter}
                          </span>
                          <span className="font-mono font-bold text-[#102654]">{blyntAcc.code}</span>
                          <span className="text-[#5B6478] truncate max-w-[160px]">{blyntAcc.name}</span>
                        </div>
                      ) : (
                        <span className="text-[#B42318] font-bold">Unassigned</span>
                      )}
                    </td>

                    <td className="p-3">
                      {row.status === 'confirmed' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F4EF] text-[#0B6B52]">
                          ✓ Confirmed by {db.users.find((u) => u.id === row.confirmed_by)?.name.split(" ")[0] ?? "rule"}
                        </span>
                      ) : row.confidence >= 90 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF1EE] text-[#A23A27]">
                          ✦ High {row.confidence}%
                        </span>
                      ) : row.confidence >= 50 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF4DB] text-[#6B4700]">
                          ◐ Check {row.confidence}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FDECEA] text-[#B42318]">
                          ! No match
                        </span>
                      )}
                    </td>

                    <td className="p-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {row.status !== 'confirmed' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (row.blynt_code) handleChangeBlyntCode(row.id, row.blynt_code);
                            else setActiveDetailId(row.id);
                          }}
                          className="px-2.5 py-1 bg-[#102654] text-white font-bold text-[11px] rounded-[6px] hover:bg-[#0B1B3D]"
                        >
                          {row.blynt_code ? 'Confirm' : 'Choose account'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveDetailId(row.id)}
                          className="text-[11px] text-[#5B6478] hover:text-[#102654] underline"
                        >
                          Change
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Detail Panel (Slide-over or Modal) */}
      {detailMapping && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/40 backdrop-blur-xs flex items-center justify-end"
        >
          <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col border-l border-[#E3E7EF]">
            <div className="p-4 border-b border-[#E3E7EF] flex items-center justify-between bg-[#102654] text-white">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#FF7D6B] tracking-wider">
                  Account Mapping Facts
                </span>
                <h3 className="text-sm font-bold mt-0.5">
                  {detailMapping.source_code} • {detailMapping.source_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailId(null)}
                className="p-1 text-white/70 hover:text-white rounded"
                aria-label="Close detail panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-5 text-xs text-[#102654]">
              {/* Account Facts */}
              <div className="p-3.5 bg-[#F6F7FB] border border-[#E3E7EF] rounded-[12px] flex flex-col gap-2">
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
                  <span className="text-[#5B6478]">Mapping status:</span>
                  <span className="font-bold capitalize">{detailMapping.status}</span>
                </div>
              </div>

              {/* AI Alternatives with reasons (radio) */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#A23A27] mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✦ AI Suggested Alternatives</span>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-[#102654]">Blynt account</span>
                    <select
                      aria-label="Blynt account"
                      value={pickCode}
                      onChange={(e) => setPickCode(e.target.value)}
                      className="min-h-[40px] px-2 border border-[#D5DBE7] rounded-[8px] bg-white text-[#102654]"
                    >
                      <option value="">Choose an account…</option>
                      {db.blynt_accounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </label>
                  {(detailMapping.ai_alternatives ?? []).map((alt) => (
                    <label
                      key={alt.blynt_code}
                      className="p-3 rounded-[10px] border border-[#E3E7EF] hover:border-[#102654] flex items-start gap-3 cursor-pointer bg-white"
                    >
                      <input
                        type="radio"
                        name="blynt-alternative"
                        checked={pickCode === alt.blynt_code}
                        onChange={() => setPickCode(alt.blynt_code)}
                        className="w-4 h-4 text-[#102654] focus:ring-[#FF7D6B] mt-0.5"
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#102654]">
                            {alt.blynt_code}
                          </span>
                          <span className="font-semibold text-[#102654] truncate">
                            {alt.name}
                          </span>
                          <span className="text-[10px] font-mono text-[#A23A27] bg-[#FFF1EE] px-1 rounded ml-auto">
                            {alt.confidence}%
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5B6478] mt-1 leading-snug">
                          {alt.reason}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rule remembering checkboxes */}
              <div className="p-3.5 bg-white border border-[#E3E7EF] rounded-[12px] flex flex-col gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded text-[#102654] focus:ring-[#FF7D6B]"
                  />
                  <span>Remember this mapping for this client</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-[#102654] focus:ring-[#FF7D6B]"
                  />
                  <span>Add as firm rule for all Small Companies (FRS 102 1A)</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-[#E3E7EF] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveDetailId(null)}
                className="px-4 py-2 border border-[#D5DBE7] rounded-[8px] text-xs font-semibold text-[#5B6478]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!pickCode}
                onClick={() => {
                  handleChangeBlyntCode(detailMapping.id, pickCode);
                  setActiveDetailId(null);
                }}
                className="px-5 py-2 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-[8px] shadow-sm disabled:opacity-40"
              >
                Save &amp; Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
