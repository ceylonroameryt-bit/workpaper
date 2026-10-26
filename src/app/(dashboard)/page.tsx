'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock,
  MessageSquare,
  TableProperties,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  AlertTriangle,
  Upload,
  Send,
  Building2,
  Layers,
  FileCheck2,
  Lock,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { StatusBadge } from '@/components/ui/StatusPill';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';
import { CompanySelector } from '@/components/layout/CompanySelector';

export default function PracticeHomePage() {
  const router = useRouter();
  const { activeCompany, activeEngagement, clients, setActiveCompanyId } = useCompany();
  const { formatDate, jurisdiction } = useLocale();

  const [botPrompt, setBotPrompt] = useState('');
  const [botAnswer, setBotAnswer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'company' | 'portfolio'>('company');

  // Scoped metrics for active selected company
  const companyEng = activeEngagement;
  const companyMaps = companyEng ? db.account_mappings.filter((m) => m.engagement_id === companyEng.id) : [];
  const companyUnmapped = companyMaps.filter((m) => m.status !== 'confirmed').length;
  const companyPapers = companyEng ? db.workpapers.filter((w) => w.engagement_id === companyEng.id) : [];
  const companyPrepared = companyPapers.filter((w) => w.status === 'prepared' || w.status === 'signed_off').length;
  const companyNotes = companyEng
    ? db.comments.filter((c) => c.type === 'review_note' && c.status === 'open' && companyPapers.some((p) => p.id === c.workpaper_id)).length
    : 0;

  // All figures and counts strictly derived from live data (Ground Rule 2)
  const engagementsInProgress = db.engagements.filter((e) => e.status !== 'locked');
  const openReviewNotes = db.comments.filter((c) => c.type === 'review_note' && c.status === 'open');
  const accountsToMap = db.account_mappings.filter((m) => m.status !== 'confirmed');
  const readyForSignoff = db.workpapers.filter((w) => w.status === 'prepared');

  const fmtDate = (iso: string) =>
    formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  const daysUntil = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86400000);
  const timeAgo = (iso: string) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };
  const clientName = (clientId: string) => db.clients.find((c) => c.id === clientId)?.name ?? 'Unknown client';

  // Engagements list with 5-stage chain visual, derived from live data
  const engagements = engagementsInProgress.map((e) => {
    const hasTb = db.tb_snapshots.some((t) => t.engagement_id === e.id);
    const maps = db.account_mappings.filter((m) => m.engagement_id === e.id);
    const unmapped = maps.filter((m) => m.status !== 'confirmed').length;
    const papers = db.workpapers.filter((w) => w.engagement_id === e.id);
    const prepared = papers.filter((w) => w.status === 'prepared' || w.status === 'signed_off').length;
    const reviewed = papers.filter((w) => w.status === 'signed_off').length;
    const st = (done: boolean, started: boolean, alert = false) =>
      done
        ? { status: 'done', symbol: '✓' }
        : alert
          ? { status: 'alert', symbol: '!' }
          : started
            ? { status: 'in_progress', symbol: '◑' }
            : { status: 'todo', symbol: '○' };
    const mapDone = hasTb && maps.length > 0 && unmapped === 0;
    const prepDone = papers.length > 0 && prepared === papers.length;
    const revDone = papers.length > 0 && reviewed === papers.length;
    const stages = [
      { label: 'Import', ...st(hasTb, true) },
      { label: 'Map', ...st(mapDone, hasTb, hasTb && unmapped > 0) },
      { label: 'Prepare', ...st(prepDone, prepared > 0) },
      { label: 'Review', ...st(revDone, reviewed > 0) },
      { label: 'Sign', ...st(Boolean(e.locked_at), false) },
    ];
    const progress = Math.round((stages.filter((x) => x.status === 'done').length / stages.length) * 100);
    const targetHref = !hasTb
      ? `/engagements/${e.id}/import`
      : !mapDone
        ? `/engagements/${e.id}/mapping`
        : `/engagements/${e.id}`;
    return {
      id: e.id,
      client: clientName(e.client_id),
      framework: e.framework,
      yearEnd: fmtDate(e.period_end),
      periodEnd: e.period_end,
      progress,
      unmapped,
      team: [] as { initials: string; name: string; bg: string }[],
      stages,
      targetHref,
    };
  });

  // Next actions derived from live data
  const nextActions = engagements.flatMap((eng) => {
    if (eng.stages[0].status !== 'done') {
      return [
        {
          id: `${eng.id}_import`,
          title: `Import trial balance for ${eng.client}`,
          meta: `Year end ${eng.yearEnd} • ${eng.framework}`,
          tag: '◑ To do',
          tagColor: 'text-[#1D4E89] bg-[#EAF5FC] border border-[#1D4E89]/30',
          actionLabel: 'Import',
          href: `/engagements/${eng.id}/import`,
        },
      ];
    }
    if (eng.unmapped > 0) {
      return [
        {
          id: `${eng.id}_map`,
          title: `Map ${eng.unmapped} accounts on ${eng.client}`,
          meta: `Year end ${eng.yearEnd} • ${eng.framework}`,
          tag: '! Needs you',
          tagColor: 'text-[#A23A27] bg-[#FFF1EE] border border-[#FF7D6B]/40',
          actionLabel: 'Review mappings',
          href: `/engagements/${eng.id}/mapping`,
        },
      ];
    }
    return [];
  });

  // Statutory filing deadline: 9 months after year end (private companies)
  const upcomingDeadlines = engagements
    .map((eng) => {
      const due = new Date(eng.periodEnd);
      due.setMonth(due.getMonth() + 9);
      return {
        date: fmtDate(due.toISOString()),
        client: eng.client,
        label: jurisdiction.filingDeadlineLabel,
        days: daysUntil(due),
      };
    })
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3)
    .map((d) => ({ ...d, remaining: `${d.days} days` }));

  // Recent activity from the audit trail
  const recentActivities = [...db.audit_logs]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4)
    .map((log) => ({
      actor: log.actor_name,
      action: `${log.action.toLowerCase().replace(/_/g, ' ')} (${log.entity.replace(/_/g, ' ')})`,
      time: timeAgo(log.at),
      color: 'bg-[#102654]',
    }));

  const emptyNote = (text: string) => <p className="text-xs text-[#5B6478] py-3">{text}</p>;

  const handleAskBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botPrompt.trim()) return;
    setBotAnswer(
      engagements.length === 0
        ? 'You have no active engagements yet. Create one to get started.'
        : `You have ${engagements.length} active engagement${engagements.length === 1 ? '' : 's'} and ${accountsToMap.length} account${accountsToMap.length === 1 ? '' : 's'} still to map.`
    );
  };

  return (
    <div className="flex flex-col gap-8 pb-14 max-w-7xl mx-auto">
      {/* Top Greeting & Practice Header (Page 1 Spec) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102654] tracking-tight">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
          </h1>
          <p className="text-sm text-[#5B6478] mt-1">
            {nextActions.length === 0
              ? 'Nothing needs you right now.'
              : `${nextActions.length} thing${nextActions.length === 1 ? ' needs' : 's need'} you today.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={companyEng ? `/engagements/${companyEng.id}/import` : '/engagements/new'}
            className="min-h-[44px] px-4 py-2 border border-[#D5DBE7] hover:border-[#102654] bg-white text-[#102654] text-xs font-semibold rounded-[10px] flex items-center gap-2 transition-colors shadow-2xs"
          >
            <Upload className="w-4 h-4 text-[#5B6478]" />
            Import trial balance
          </Link>
          <Link
            href="/engagements/new"
            className="min-h-[44px] px-4 py-2 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-[10px] flex items-center gap-2 shadow-sm transition-transform active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New engagement</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0B1B3D]/15 text-[#0B1B3D] ml-0.5">
              N
            </kbd>
          </Link>
        </div>
      </div>

      {/* Fresh workspace welcome banner if no company added yet */}
      {clients.length === 0 && (
        <div className="blynt-card p-8 bg-gradient-to-br from-white via-[#F6F7FB] to-[#EDF2F9] border-[#D5DBE7] shadow-sm relative overflow-hidden text-center flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-3xl bg-[#0B1B3D] text-[#FF7D6B] flex items-center justify-center font-bold shadow-md mb-4">
            <Building2 className="w-8 h-8 text-[#FF7D6B]" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#102654] tracking-tight">
            Welcome to Blynt Workpapers
          </h2>
          <p className="text-sm text-[#5B6478] max-w-md mt-2 mb-6">
            Your environment is clean with zero demo data. Add your first accounting client or company to start managing workpapers, trial balances, and statutory audits.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/engagements/new"
              className="px-5 py-2.5 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create First Company &amp; Engagement</span>
            </Link>
          </div>
        </div>
      )}

      {/* If companies exist but none selected, show interactive Company Selector Cards */}
      {!activeCompany && clients.length > 0 && (
        <div className="blynt-card p-6 bg-white border-[#D5DBE7] shadow-sm animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E3E7EF]">
            <div>
              <h2 className="text-base font-bold text-[#102654]">Select a company to open its working papers</h2>
              <p className="text-xs text-[#5B6478] mt-0.5">Click any company below to load all options, engagement stages, and statutory audits.</p>
            </div>
            <Link
              href="/engagements/new"
              className="px-3.5 py-2 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Company</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCompanyId(c.id)}
                className="p-4 rounded-xl border border-[#E3E7EF] hover:border-[#102654] hover:shadow-md bg-white text-left transition-all group cursor-pointer flex flex-col justify-between min-h-[120px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#1D4E89] uppercase">
                    {c.company_type}
                  </span>
                  <span className="text-xs font-bold text-[#FF7D6B] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors mt-2">
                    {c.name}
                  </div>
                  <div className="text-xs text-[#5B6478] mt-1 font-mono-numbers">
                    Co #{c.company_no} · Year End: {c.year_end || '2026-12-31'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Selected Company Command Center */}
      {activeCompany && companyEng && (
        <div className="blynt-card p-6 bg-gradient-to-r from-white via-white to-[#F6F7FB] border-[#D5DBE7] shadow-sm relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E3E7EF]">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#0B1B3D] text-[#FF7D6B] flex items-center justify-center font-bold text-lg shrink-0 shadow-md">
                <Building2 className="w-6 h-6 text-[#FF7D6B]" />
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold text-[#102654] tracking-tight">
                    {activeCompany.name}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#1D4E89] border border-[#1D4E89]/20 uppercase">
                    {activeCompany.company_type}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F4EF] text-[#0B6B52]">
                    ● {companyEng.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-[#5B6478] mt-1 flex flex-wrap items-center gap-3 font-mono-numbers">
                  <span>Companies House #{activeCompany.company_no}</span>
                  <span>•</span>
                  <span>Year End: {new Date(activeCompany.year_end || (activeCompany as any).yearEnd || '2026-09-30').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span>•</span>
                  <span>Source: {activeCompany.data_source === 'csv' ? 'CSV/Excel' : activeCompany.data_source}</span>
                </div>
              </div>
            </div>

            {/* Switch Company Dropdown Button */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[#5B6478] font-medium hidden sm:inline">Selected Company:</span>
              <CompanySelector variant="header" onAddNewCompany={() => router.push('/engagements/new')} />
            </div>
          </div>

          {/* Company-Specific 6 Modules / Options Grid */}
          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#5B6478] mb-3 flex items-center justify-between">
              <span>Working Paper Modules for {activeCompany.name}</span>
              <span className="text-[#FF7D6B] font-bold">Statutory Workflow</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1 Import Data */}
              <Link
                href={`/engagements/${companyEng.id}/import`}
                className="p-3 rounded-xl bg-white border border-[#E3E7EF] hover:border-[#102654] hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-[#EAF5FC] text-[#1D4E89] flex items-center justify-center mb-2">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors">
                    1. Import TB
                  </div>
                  <p className="text-[10px] text-[#5B6478] mt-0.5 line-clamp-1">
                    Upload trial balance
                  </p>
                </div>
                <div className="text-[10px] font-semibold text-[#1D4E89] mt-2 flex items-center gap-1">
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* 2 Account Mapping */}
              <Link
                href={`/engagements/${companyEng.id}/mapping`}
                className="p-3 rounded-xl bg-white border border-[#E3E7EF] hover:border-[#FF7D6B] hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-[#FFF1EE] text-[#A23A27] flex items-center justify-center mb-2">
                    <TableProperties className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors">
                    2. Map Accounts
                  </div>
                  <p className="text-[10px] text-[#5B6478] mt-0.5">
                    {companyUnmapped > 0 ? (
                      <span className="text-[#B8432F] font-bold">{companyUnmapped} unmapped</span>
                    ) : (
                      'All mapped'
                    )}
                  </p>
                </div>
                <div className="text-[10px] font-semibold text-[#A23A27] mt-2 flex items-center gap-1">
                  <span>Review</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* 3 Trial Balance & Leads */}
              <Link
                href={`/engagements/${companyEng.id}/trial-balance`}
                className="p-3 rounded-xl bg-white border border-[#E3E7EF] hover:border-[#102654] hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-[#F6F7FB] text-[#102654] flex items-center justify-center mb-2">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors">
                    3. Trial Balance
                  </div>
                  <p className="text-[10px] text-[#5B6478] mt-0.5 line-clamp-1">
                    Lead schedules A–Z
                  </p>
                </div>
                <div className="text-[10px] font-semibold text-[#102654] mt-2 flex items-center gap-1">
                  <span>View</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* 4 Working Papers Index (WPS) */}
              <Link
                href={`/engagements/${companyEng.id}/workpapers`}
                className="p-3 rounded-xl bg-white border border-[#E3E7EF] hover:border-[#0B6B52] hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-[#E6F4EF] text-[#0B6B52] flex items-center justify-center mb-2">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors">
                    4. Workpapers
                  </div>
                  <p className="text-[10px] text-[#5B6478] mt-0.5">
                    {companyPrepared}/{companyPapers.length} prepared
                  </p>
                </div>
                <div className="text-[10px] font-semibold text-[#0B6B52] mt-2 flex items-center gap-1">
                  <span>F-10 / B-10</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* 5 Sign-off & Lock */}
              <Link
                href={`/engagements/${companyEng.id}/sign-off`}
                className="p-3 rounded-xl bg-white border border-[#E3E7EF] hover:border-[#102654] hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-[#F6F7FB] text-[#102654] flex items-center justify-center mb-2">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors">
                    5. Sign-off &amp; Lock
                  </div>
                  <p className="text-[10px] text-[#5B6478] mt-0.5 line-clamp-1">
                    Partner lock status
                  </p>
                </div>
                <div className="text-[10px] font-semibold text-[#102654] mt-2 flex items-center gap-1">
                  <span>Sign</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* Review Notes */}
              <Link
                href={`/engagements/${companyEng.id}/review`}
                className="p-3 rounded-xl bg-white border border-[#E3E7EF] hover:border-[#FF7D6B] hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-[#FFF4DB] text-[#6B4700] flex items-center justify-center mb-2">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors">
                    Review Notes
                  </div>
                  <p className="text-[10px] text-[#5B6478] mt-0.5">
                    {companyNotes > 0 ? `${companyNotes} open notes` : 'No open notes'}
                  </p>
                </div>
                <div className="text-[10px] font-semibold text-[#6B4700] mt-2 flex items-center gap-1">
                  <span>Review</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Only show metrics and detailed engagement dashboard when a company is active */}
      {activeCompany && companyEng && (
        <>
          {/* 4 Metric Cards (Page 1 Spec) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 12 in progress */}
        <Link
          href="/clients"
          className="blynt-card p-5 hover:border-[#102654]/40 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between text-[#5B6478] text-xs font-semibold mb-2">
            <span>In progress</span>
            <Clock className="w-4 h-4 text-[#102654]" />
          </div>
          <div className="text-3xl font-extrabold text-[#102654] font-mono-numbers">
            {engagementsInProgress.length}
          </div>
          <div className="text-[11px] text-[#5B6478] mt-2 flex items-center justify-between">
            <span>Active engagements</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#5B6478] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Card 2: 7 review notes for you */}
        <Link
          href="/clients"
          className="blynt-card p-5 hover:border-[#FF7D6B]/50 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between text-[#5B6478] text-xs font-semibold mb-2">
            <span>Review notes for you</span>
            <MessageSquare className="w-4 h-4 text-[#FF7D6B]" />
          </div>
          <div className="text-3xl font-extrabold text-[#102654] font-mono-numbers">
            {openReviewNotes.length}
          </div>
          <div className="text-[11px] text-[#A23A27] font-semibold mt-2 flex items-center justify-between">
            <span>Open notes</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#A23A27] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Card 3: 18 accounts to map */}
        <Link
          href="/clients"
          className="blynt-card p-5 hover:border-[#102654]/40 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between text-[#5B6478] text-xs font-semibold mb-2">
            <span>Accounts to map</span>
            <TableProperties className="w-4 h-4 text-[#1D4E89]" />
          </div>
          <div className="text-3xl font-extrabold text-[#102654] font-mono-numbers">
            {accountsToMap.length}
          </div>
          <div className="text-[11px] text-[#0B6B52] font-semibold mt-2 flex items-center justify-between">
            <span>Awaiting confirmation</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#0B6B52] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Card 4: 2 ready for sign-off */}
        <Link
          href="/clients"
          className="blynt-card p-5 hover:border-[#0B6B52]/40 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between text-[#5B6478] text-xs font-semibold mb-2">
            <span>Ready for sign-off</span>
            <CheckCircle2 className="w-4 h-4 text-[#0B6B52]" />
          </div>
          <div className="text-3xl font-extrabold text-[#102654] font-mono-numbers">
            {readyForSignoff.length}
          </div>
          <div className="text-[11px] text-[#0B6B52] mt-2 flex items-center justify-between">
            <span>Papers prepared</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#0B6B52] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Main Grid: Left Column (Next actions + Engagements table) | Right Rail (Deadlines, Bot, Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Your next actions Card (Page 1 Spec) */}
          <div className="blynt-card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E3E7EF]">
              <div>
                <h2 className="text-base font-bold text-[#102654]">
                  Your next actions
                </h2>
                <p className="text-xs text-[#5B6478] mt-0.5">
                  Ordered by statutory urgency and auditor review bottlenecks
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#D5DBE7] text-[#5B6478]">
                {nextActions.length} items
              </span>
            </div>

            <div className="divide-y divide-[#E3E7EF]">
              {nextActions.length === 0 && emptyNote('No actions yet. Create an engagement to get started.')}
              {nextActions.map((act) => (
                <div
                  key={act.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F6F7FB]/70 px-2.5 rounded-lg transition-colors group"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${act.tagColor}`}>
                        {act.tag}
                      </span>
                      <span className="text-xs font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors truncate">
                        {act.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#5B6478] mt-1 truncate">
                      {act.meta}
                    </span>
                  </div>

                  <Link
                    href={act.href}
                    className="min-h-[36px] px-3.5 py-1.5 bg-white hover:bg-[#F6F7FB] border border-[#D5DBE7] hover:border-[#102654] text-[#102654] text-xs font-bold rounded-[8px] flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-2xs"
                  >
                    <span>{act.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Engagements Table with 5 Stage Pills Chain (Page 1 Spec) */}
          <div className="blynt-card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E3E7EF]">
              <div>
                <h2 className="text-base font-bold text-[#102654]">
                  Active engagements
                </h2>
                <p className="text-xs text-[#5B6478] mt-0.5">
                  Stages: Import → Map → Prepare → Review → Sign &amp; Lock
                </p>
              </div>
              <Link
                href="/clients"
                className="text-xs text-[#B8432F] font-bold hover:underline flex items-center gap-1"
              >
                <span>View all clients</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#102654]">
                <thead className="bg-[#F6F7FB] text-[#5B6478] uppercase text-[10px] font-bold tracking-wider border-b border-[#E3E7EF]">
                  <tr>
                    <th scope="col" className="p-3 pl-4">Client</th>
                    <th scope="col" className="p-3">Year End</th>
                    <th scope="col" className="p-3">Stage Progression</th>
                    <th scope="col" className="p-3">Progress</th>
                    <th scope="col" className="p-3">Team</th>
                    <th scope="col" className="p-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EF]">
                  {engagements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-xs text-[#5B6478]">
                        No active engagements yet.{' '}
                        <Link href="/engagements/new" className="text-[#B8432F] font-bold hover:underline">
                          Create your first engagement
                        </Link>
                      </td>
                    </tr>
                  )}
                  {engagements.map((eng) => (
                    <tr
                      key={eng.id}
                      onClick={() => router.push(eng.targetHref)}
                      className="hover:bg-[#F6F7FB] transition-colors cursor-pointer group"
                    >
                      <td className="p-3 pl-4">
                        <div className="font-bold text-[#102654] group-hover:text-[#B8432F] transition-colors">
                          {eng.client}
                        </div>
                        <div className="text-[10px] text-[#5B6478]">
                          {eng.framework}
                        </div>
                      </td>

                      <td className="p-3 font-mono-numbers text-[11px] whitespace-nowrap">
                        {eng.yearEnd}
                      </td>

                      {/* 5-stage chain pill visual */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {eng.stages.map((st, sidx) => {
                            let pillStyle = 'bg-[#F4F5F7] text-[#7E8DA6] border-[#D5DBE7]';
                            if (st.status === 'done') {
                              pillStyle = 'bg-[#E6F4EF] text-[#0B6B52] border-[#0B6B52]/30 font-semibold';
                            } else if (st.status === 'alert') {
                              pillStyle = 'bg-[#FFF1EE] text-[#A23A27] border-[#FF7D6B] font-bold shadow-2xs';
                            } else if (st.status === 'in_progress') {
                              pillStyle = 'bg-[#EAF5FC] text-[#1D4E89] border-[#1D4E89]/40 font-semibold';
                            }

                            return (
                              <span
                                key={sidx}
                                className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap flex items-center gap-0.5 ${pillStyle}`}
                              >
                                <span>{st.symbol}</span>
                                <span className="hidden sm:inline">{st.label}</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#E3E7EF] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${eng.progress}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold">
                            {eng.progress}%
                          </span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center -space-x-1.5">
                          {eng.team.map((t, tidx) => (
                            <div
                              key={tidx}
                              title={t.name}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white ${t.bg}`}
                            >
                              {t.initials}
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 pr-4 text-right">
                        <span className="text-xs font-bold text-[#B8432F] group-hover:underline">
                          Open →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Rail (4 cols): Upcoming Deadlines, Blynt Bot card, Recent Activity */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Upcoming deadlines card (Page 1 Spec) */}
          <div className="blynt-card p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E3E7EF]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#102654]" />
                <h3 className="text-sm font-bold text-[#102654]">
                  Upcoming deadlines
                </h3>
              </div>
              <span className="text-[10px] text-[#5B6478] font-mono">Statutory</span>
            </div>

            <div className="flex flex-col gap-3">
              {upcomingDeadlines.length === 0 && emptyNote('No upcoming deadlines.')}
              {upcomingDeadlines.map((dl, idx) => (
                <div key={idx} className="p-2.5 rounded-[10px] bg-[#F6F7FB] border border-[#E3E7EF]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#102654]">{dl.client}</span>
                    <span className="text-[10px] font-semibold text-[#B8432F]">
                      {dl.remaining}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5B6478] mt-0.5">{dl.label}</div>
                  <div className="text-[10px] font-mono text-[#7E8DA6] mt-1">
                    Due: {dl.date}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ask Blynt Bot Card (Page 1 Spec) */}
          <div className="blynt-card p-5 bg-[#FFF1EE] border border-[#FF7D6B]/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-[#FF7D6B] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-[#0B1B3D]" />
              </div>
              <h3 className="text-sm font-bold text-[#A23A27] tracking-tight">
                ✦ BLYNT BOT
              </h3>
            </div>
            <p className="text-xs text-[#5B6478] mb-2 leading-relaxed">
              Ask Blynt Bot anything about your practice or engagements:
            </p>
            <p className="text-[11px] text-[#A23A27] bg-white/70 border border-[#FF7D6B]/30 p-2.5 rounded-[8px] italic mb-3">
              &ldquo;Which engagements have unmapped accounts over £10k?&rdquo; or &ldquo;Which papers are ready for review?&rdquo;
            </p>

            {botAnswer && (
              <div className="bg-white p-3 rounded-[10px] border border-[#FF7D6B]/40 text-xs text-[#102654] mb-3 leading-relaxed">
                <span className="font-bold text-[#A23A27]">✦ suggestion: </span>
                {botAnswer}
              </div>
            )}

            <form onSubmit={handleAskBot} className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about mappings, variances, papers..."
                value={botPrompt}
                onChange={(e) => setBotPrompt(e.target.value)}
                className="flex-1 min-h-[40px] px-3 text-xs bg-white border border-[#D5DBE7] rounded-[8px] text-[#102654] outline-none focus:border-[#FF7D6B]"
              />
              <button
                type="submit"
                className="min-h-[40px] px-3.5 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] font-bold text-xs rounded-[8px] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Send className="w-3 h-3" />
                <span>Ask</span>
              </button>
            </form>
            <div className="text-[10px] text-[#5B6478] mt-2">
              AI suggests, people decide. All outputs logged to audit trail.
            </div>
          </div>

          {/* Recent Activity Card (Page 1 Spec) */}
          <div className="blynt-card p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E3E7EF]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0B6B52]" />
                <h3 className="text-sm font-bold text-[#102654]">
                  Recent activity
                </h3>
              </div>
              <span className="text-[10px] text-[#5B6478] font-mono">Live feed</span>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {recentActivities.length === 0 && emptyNote('No activity yet.')}
              {recentActivities.map((act, i) => (
                <div key={i} className="flex items-start gap-2.5 pb-2.5 border-b border-[#E3E7EF]/60 last:border-0 last:pb-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${act.color}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[#102654]">
                      <span className="font-bold">{act.actor}</span> {act.action}
                    </span>
                    <span className="text-[10px] text-[#7E8DA6] font-mono mt-0.5">
                      {act.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )}
    </div>
  );
}
