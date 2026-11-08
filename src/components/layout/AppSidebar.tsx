'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Building2,
  MessageSquare,
  FileDown,
  TableProperties,
  Scale,
  FileCheck2,
  Lock,
  FileSpreadsheet,
  BookOpen,
  ArrowUpRight,
  Sliders,
  Globe,
  ListChecks,
} from 'lucide-react';
import { BlyntLogo } from '@/components/ui/BlyntLogo';
import { db } from '@/lib/server/db';
import { workflowsOf } from '@/lib/workflows';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';

/** Locale indicator badge shown in the sidebar footer */
const LocaleFooterBadge: React.FC = () => {
  const { jurisdiction } = useLocale();
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#122654]/60 border border-white/10 mb-1">
      <Globe className="w-3 h-3 text-[#FF7A66] shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] text-[#A6B4D0] leading-tight truncate">
          {jurisdiction.label}
        </span>
        <span className="text-[9px] text-[#7E8DA6] font-mono truncate">
          {jurisdiction.currency} · {jurisdiction.frameworkLabel}
        </span>
      </div>
    </div>
  );
};

interface AppSidebarProps {
  currentEngagementId?: string;
  onMobileClose?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentEngagementId: currentEngagementIdProp,
  onMobileClose,
}) => {
  const { activeCompany, activeEngagement: contextEngagement } = useCompany();
  const pathname = usePathname();
  const router = useRouter();

  const match = pathname.match(/\/engagements\/([^/]+)/);
  const routeEngagementId = match && match[1] !== 'new' ? match[1] : null;

  const activeEngagement = currentEngagementIdProp
    ? db.engagements.find((e) => e.id === currentEngagementIdProp) || contextEngagement
    : routeEngagementId
      ? db.engagements.find((e) => e.id === routeEngagementId) || contextEngagement
      : contextEngagement;

  const routeClient = activeEngagement ? db.clients.find((c) => c.id === activeEngagement.client_id) : null;
  const activeClient = activeCompany || routeClient;

  const currentEngagementId = activeEngagement?.id ?? currentEngagementIdProp ?? routeEngagementId ?? null;
  const engagementBase = currentEngagementId ? `/engagements/${currentEngagementId}` : '';

  // Show engagement nav whenever we're on an engagement route OR a company is selected
  const showEngagementOptions = Boolean(activeEngagement);
  const workflows = activeEngagement ? workflowsOf(activeEngagement.id) : [];


  // Calculate live counts from data

  const openReviewNotesCount = db.comments.filter(
    (c) => c.type === 'review_note' && c.status === 'open' && (activeEngagement ? c.workpaper_id?.includes(activeEngagement.id) : true)
  ).length;

  const mappingNeededCount = db.account_mappings.filter(
    (m) => m.engagement_id === currentEngagementId && m.status !== 'confirmed'
  ).length;

  // Keyboard shortcut listener: N for New engagement
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'n' || e.key === 'N') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        router.push('/engagements/new');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const isLinkActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      aria-label="Sidebar navigation"
      className="w-full lg:w-[232px] lg:min-h-screen bg-[#0B1A3B] text-white flex flex-col justify-between shrink-0 select-none pb-4"
    >
      <div className="flex flex-col">
        {/* Blynt Brand Logo */}
        <div className="p-5 pb-3">
          <Link
            href="/"
            onClick={onMobileClose}
            className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A66] rounded-lg p-1"
          >
            <BlyntLogo variant="full" theme="dark" size="md" />
          </Link>
        </div>

        {/* Group: PRACTICE */}
        <div className="mt-3 flex flex-col">
          <div className="px-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6]">
            Practice
          </div>
          <nav className="flex flex-col">
            <Link
              href="/"
              onClick={onMobileClose}
              aria-current={isLinkActive('/', true) ? 'page' : undefined}
              className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isLinkActive('/', true)
                  ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
              }`}
            >
              <Home className="w-4 h-4 shrink-0 text-[#FF7A66]" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/clients"
              onClick={onMobileClose}
              aria-current={isLinkActive('/clients') ? 'page' : undefined}
              className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isLinkActive('/clients')
                  ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Clients</span>
            </Link>

            <Link
              href="/settings"
              onClick={onMobileClose}
              aria-current={isLinkActive('/settings') ? 'page' : undefined}
              className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isLinkActive('/settings')
                  ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              <span>Practice settings</span>
            </Link>
          </nav>
        </div>

        {/* Group: THIS ENGAGEMENT - 11 Sections from Page 5 */}
        {showEngagementOptions && activeEngagement && (
          <div className="mt-4 flex flex-col animate-in fade-in duration-200">
            <div className="px-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6] flex items-center justify-between">
              <span className="truncate" title={activeClient?.name}>Workpapers</span>
              <span className="text-[9px] text-[#FF7A66] font-mono lowercase shrink-0">active</span>
            </div>
            <nav className="flex flex-col">
              {/* 1. Overview */}
              <Link
                href={`${engagementBase}`}
                onClick={onMobileClose}
                aria-current={isLinkActive(engagementBase, true) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(engagementBase, true)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Overview</span>
              </Link>

              <Link
                href={`${engagementBase}/workflow`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/workflow`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/workflow`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <ListChecks className="w-4 h-4 shrink-0" />
                <span>Workflow</span>
              </Link>

              {/* 2. Trial balance */}
              <Link
                href={`${engagementBase}/trial-balance`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/trial-balance`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/trial-balance`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <Scale className="w-4 h-4 shrink-0" />
                <span>Trial balance</span>
              </Link>

              {/* 3. Mapping */}
              <Link
                href={`${engagementBase}/mapping`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/mapping`) ? 'page' : undefined}
                className={`relative flex items-center justify-between mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/mapping`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <TableProperties className="w-4 h-4 shrink-0" />
                  <span>Mapping</span>
                </div>
                {mappingNeededCount > 0 && (
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#FFF1EE] text-[#A23A27]">
                    {mappingNeededCount}
                  </span>
                )}
              </Link>

              {/* 5. Journals */}
              <Link
                href={`${engagementBase}/journals`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/journals`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/journals`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Journals</span>
              </Link>

              {/* 6. Documents */}
              <Link
                href={`${engagementBase}/documents`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/documents`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/documents`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Documents</span>
              </Link>

              {/* 7. Analysis */}
              <Link
                href={`${engagementBase}/analysis`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/analysis`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/analysis`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 shrink-0" />
                <span>Analysis</span>
              </Link>

              {/* 8. Disclosures and notes */}
              <Link
                href={`${engagementBase}/disclosures`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/disclosures`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/disclosures`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <FileCheck2 className="w-4 h-4 shrink-0" />
                <span>Disclosures & notes</span>
              </Link>

              {/* 9. Reports */}
              <Link
                href={`${engagementBase}/reports`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/reports`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/reports`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <FileDown className="w-4 h-4 shrink-0" />
                <span>Reports</span>
              </Link>

              {/* 10. Review */}
              <Link
                href={`${engagementBase}/review`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/review`) ? 'page' : undefined}
                className={`relative flex items-center justify-between mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/review`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>Review</span>
                </div>
                {openReviewNotesCount > 0 && (
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#FF7A66] text-[#0B1A3B]">
                    {openReviewNotesCount}
                  </span>
                )}
              </Link>

              {/* 11. History */}
              <Link
                href={`${engagementBase}/history`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/history`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/history`)
                    ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                }`}
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span>History</span>
              </Link>
            </nav>

            {/* The client year's workflows, as in the workflow cards */}
            {workflows.length > 0 && (
              <div className="mt-3">
                <div className="px-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6]">Workflows</div>
                <nav className="flex flex-col" aria-label="Workflows">
                  {workflows.map((wf) => {
                    const href = `${engagementBase}/workflows/${wf.id}`;
                    const initials = wf.name.split(/[\s-]+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0].toUpperCase()).slice(0, 3).join('');
                    return (
                      <Link
                        key={wf.id}
                        href={href}
                        onClick={onMobileClose}
                        aria-current={isLinkActive(href) ? 'page' : undefined}
                        className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                          isLinkActive(href) ? 'text-white bg-[#1E3A73] font-semibold shadow-sm' : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
                        }`}
                      >
                        <span className="w-6 h-6 shrink-0 rounded-md bg-[#122654] border border-white/10 text-[9px] font-bold flex items-center justify-center" aria-hidden="true">{initials}</span>
                        <span className="truncate" title={wf.name}>{wf.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        )}

        {/* Group: LIBRARY */}
        <div className="mt-4 flex flex-col">
          <div className="px-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6]">
            Library
          </div>
          <nav className="flex flex-col">
            <Link
              href="/library/templates"
              onClick={onMobileClose}
              aria-current={isLinkActive('/library/templates') ? 'page' : undefined}
              className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isLinkActive('/library/templates')
                  ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Templates</span>
            </Link>

            <Link
              href="/library/standards"
              onClick={onMobileClose}
              aria-current={isLinkActive('/library/standards') ? 'page' : undefined}
              className={`relative flex items-center gap-3 mx-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isLinkActive('/library/standards')
                  ? 'text-white bg-[#1E3A73] font-semibold shadow-sm'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#122654]/50'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Standards library</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Bottom links */}
      <div className="mt-6 pt-4 border-t border-[#122654] px-4 pb-8 flex flex-col gap-1.5">
        {/* Locale indicator */}
        <LocaleFooterBadge />

        <a
          href="https://blynt.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-2 py-2 text-xs text-[#A6B4D0] hover:text-[#FF7A66] transition-colors rounded-lg hover:bg-[#122654]"
        >
          <span>Back to Blynt accounting</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </aside>
  );
};
