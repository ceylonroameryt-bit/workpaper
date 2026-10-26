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
  Settings,
  ArrowUpRight,
  Plus,
  ChevronDown,
  Sliders,
  Globe,
} from 'lucide-react';
import { BlyntLogo } from '@/components/ui/BlyntLogo';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';
import { CompanySelector } from './CompanySelector';

/** Locale indicator badge shown in the sidebar footer */
const LocaleFooterBadge: React.FC = () => {
  const { jurisdiction } = useLocale();
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#102654]/60 border border-white/10 mb-1">
      <Globe className="w-3 h-3 text-[#FF7D6B] shrink-0" />
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
  const { formatDate } = useLocale();
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

  const activeYearEnd = activeEngagement
    ? formatDate(activeEngagement.period_end, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const activeStage = activeEngagement
    ? activeEngagement.status.charAt(0).toUpperCase() + activeEngagement.status.slice(1)
    : '';

  // Calculate live counts from data
  const practiceReviewNotesCount = db.comments.filter(
    (c) => c.type === 'review_note' && c.status === 'open'
  ).length;

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
      className="w-full lg:w-[264px] lg:min-h-screen bg-[#0B1B3D] text-white flex flex-col justify-between shrink-0 select-none pb-4"
    >
      <div className="flex flex-col">
        {/* Blynt Brand Logo */}
        <div className="p-5 pb-3">
          <Link
            href="/"
            onClick={onMobileClose}
            className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7D6B] rounded-lg p-1"
          >
            <BlyntLogo variant="full" theme="dark" size="md" />
          </Link>
        </div>

        {/* Coral 'New engagement (N)' Action Button */}
        <div className="px-4 py-2">
          <Link
            href="/engagements/new"
            onClick={onMobileClose}
            className="w-full min-h-[44px] bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] font-bold text-sm px-4 rounded-[10px] flex items-center justify-between shadow-sm transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-3 focus-visible:ring-white"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4 stroke-[2.5]" />
              New engagement
            </span>
            <kbd className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#0B1B3D]/15 text-[#0B1B3D]">
              N
            </kbd>
          </Link>
        </div>

        {/* Active Company Selector & Engagement Context */}
        <div className="px-4 py-2.5 flex flex-col gap-2">
          <CompanySelector variant="sidebar" onAddNewCompany={() => router.push('/engagements/new')} />
          {showEngagementOptions && activeEngagement && (
            <div className="px-2 py-1.5 bg-[#102654]/60 rounded-[10px] text-[10px] text-[#A6B4D0] flex items-center justify-between border border-white/5">
              <span>{openReviewNotesCount} review notes open</span>
              <span className="text-[#FF7D6B] font-semibold">{activeStage}</span>
            </div>
          )}
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
              className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                isLinkActive('/', true)
                  ? 'text-white bg-[#102654] font-semibold'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
              }`}
            >
              {isLinkActive('/', true) && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
              )}
              <Home className="w-4 h-4 shrink-0 text-[#FF7D6B]" />
              <span>Practice dashboard</span>
            </Link>

            <Link
              href="/clients"
              onClick={onMobileClose}
              aria-current={isLinkActive('/clients') ? 'page' : undefined}
              className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                isLinkActive('/clients')
                  ? 'text-white bg-[#102654] font-semibold'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
              }`}
            >
              {isLinkActive('/clients') && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
              )}
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Clients</span>
            </Link>

            <Link
              href="/settings"
              onClick={onMobileClose}
              aria-current={isLinkActive('/settings') ? 'page' : undefined}
              className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                isLinkActive('/settings')
                  ? 'text-white bg-[#102654] font-semibold'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
              }`}
            >
              {isLinkActive('/settings') && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
              )}
              <Sliders className="w-4 h-4 shrink-0" />
              <span>Practice settings</span>
            </Link>
          </nav>
        </div>

        {/* Group: THIS ENGAGEMENT - 11 Sections from Page 5 */}
        {showEngagementOptions && activeEngagement && (
          <div className="mt-4 flex flex-col animate-in fade-in duration-200">
            <div className="px-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#7E8DA6] flex items-center justify-between">
              <span className="truncate">{activeClient ? activeClient.name : 'Engagement'}</span>
              <span className="text-[9px] text-[#FF7D6B] font-mono lowercase shrink-0">active</span>
            </div>
            <nav className="flex flex-col">
              {/* 1. Overview */}
              <Link
                href={`${engagementBase}`}
                onClick={onMobileClose}
                aria-current={isLinkActive(engagementBase, true) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(engagementBase, true)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(engagementBase, true) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <Home className="w-4 h-4 shrink-0" />
                <span>Overview</span>
              </Link>

              {/* 2. Trial balance */}
              <Link
                href={`${engagementBase}/trial-balance`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/trial-balance`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/trial-balance`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(`${engagementBase}/trial-balance`) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <Scale className="w-4 h-4 shrink-0" />
                <span>Trial balance</span>
              </Link>

              {/* 3. Mapping */}
              <Link
                href={`${engagementBase}/mapping`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/mapping`) ? 'page' : undefined}
                className={`relative flex items-center justify-between px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/mapping`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isLinkActive(`${engagementBase}/mapping`) && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                  )}
                  <TableProperties className="w-4 h-4 shrink-0" />
                  <span>Mapping</span>
                </div>
                {mappingNeededCount > 0 && (
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#FFF1EE] text-[#A23A27]">
                    {mappingNeededCount}
                  </span>
                )}
              </Link>

              {/* 4. Working paper */}
              <Link
                href={`${engagementBase}/workpapers`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/workpapers`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/workpapers`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(`${engagementBase}/workpapers`) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <FileCheck2 className="w-4 h-4 shrink-0" />
                <span>Working paper</span>
              </Link>

              {/* 5. Journals */}
              <Link
                href={`${engagementBase}/journals`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/journals`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/journals`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(`${engagementBase}/journals`) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Journals</span>
              </Link>

              {/* 6. Documents */}
              <Link
                href={`${engagementBase}/documents`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/documents`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/documents`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(`${engagementBase}/documents`) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Documents</span>
              </Link>

              {/* 7. Analysis */}
              <Link
                href={`${engagementBase}/analysis`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/analysis`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/analysis`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(`${engagementBase}/analysis`) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <ArrowUpRight className="w-4 h-4 shrink-0" />
                <span>Analysis</span>
              </Link>

              {/* 8. Disclosures and notes */}
              <Link
                href={`${engagementBase}/disclosures`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/disclosures`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/disclosures`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(`${engagementBase}/disclosures`) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <FileCheck2 className="w-4 h-4 shrink-0" />
                <span>Disclosures & notes</span>
              </Link>

              {/* 9. Reports */}
              <Link
                href={`${engagementBase}/reports`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/reports`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/reports`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(`${engagementBase}/reports`) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <FileDown className="w-4 h-4 shrink-0" />
                <span>Reports</span>
              </Link>

              {/* 10. Review */}
              <Link
                href={`${engagementBase}/review`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/review`) ? 'page' : undefined}
                className={`relative flex items-center justify-between px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/review`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isLinkActive(`${engagementBase}/review`) && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                  )}
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>Review</span>
                </div>
                {openReviewNotesCount > 0 && (
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#FF7D6B] text-[#0B1B3D]">
                    {openReviewNotesCount}
                  </span>
                )}
              </Link>

              {/* 11. History */}
              <Link
                href={`${engagementBase}/history`}
                onClick={onMobileClose}
                aria-current={isLinkActive(`${engagementBase}/history`) ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                  isLinkActive(`${engagementBase}/history`)
                    ? 'text-white bg-[#102654] font-semibold'
                    : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
                }`}
              >
                {isLinkActive(`${engagementBase}/history`) && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
                )}
                <Lock className="w-4 h-4 shrink-0" />
                <span>History</span>
              </Link>
            </nav>
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
              className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                isLinkActive('/library/templates')
                  ? 'text-white bg-[#102654] font-semibold'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
              }`}
            >
              {isLinkActive('/library/templates') && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
              )}
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Templates</span>
            </Link>

            <Link
              href="/library/standards"
              onClick={onMobileClose}
              aria-current={isLinkActive('/library/standards') ? 'page' : undefined}
              className={`relative flex items-center gap-3 px-5 py-2 text-xs font-medium transition-colors ${
                isLinkActive('/library/standards')
                  ? 'text-white bg-[#102654] font-semibold'
                  : 'text-[#A6B4D0] hover:text-white hover:bg-[#102654]/50'
              }`}
            >
              {isLinkActive('/library/standards') && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7D6B] rounded-r-full" />
              )}
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Standards library</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Bottom links */}
      <div className="mt-6 pt-4 border-t border-[#102654] px-4 pb-8 flex flex-col gap-1.5">
        {/* Locale indicator */}
        <LocaleFooterBadge />

        <a
          href="https://blynt.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-2 py-2 text-xs text-[#A6B4D0] hover:text-[#FF7D6B] transition-colors rounded-lg hover:bg-[#102654]"
        >
          <span>Back to Blynt accounting</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </aside>
  );
};
