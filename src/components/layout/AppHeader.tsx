'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronRight,
  Menu,
  Bell,
  Search,
  Sparkles,
  Command,
  User,
  Shield,
  LogOut,
  X,
  Sliders,
  Clock,
  Globe,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { getCurrentUserId, signOut } from '@/lib/session';
import { UserRole } from '@/lib/types/models';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';
import { CompanySelector } from './CompanySelector';
import { PeriodSelector } from './PeriodSelector';
import { OnboardingModal } from '../onboarding/OnboardingModal';

interface AppHeaderProps {
  onMenuToggle?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onMenuToggle }) => {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const { inactivityTimeoutMinutes } = useCompany();
  const { jurisdiction } = useLocale();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [botOpen, setBotOpen] = useState(false);
  const [botPrompt, setBotPrompt] = useState('');
  const [botResponse, setBotResponse] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [currentUser] = useState(
    () => db.users.find((u) => u.id === getCurrentUserId()) ?? db.users[0]
  );
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const openNotesCount = db.comments.filter((c) => c.status === 'open' && c.type !== 'comment').length;

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global ⌘K search shortcut & B for Blynt Bot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (
        (e.key === 'b' || e.key === 'B') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        setBotOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getBreadcrumbLabel = (seg: string) => {
    if (seg === 'clients') return 'Clients';
    if (seg === 'engagements') return 'Engagements';
    if (seg === 'new') return 'New Engagement';
    if (seg === 'import') return '1 Import data';
    if (seg === 'mapping') return '2 Account mapping';
    if (seg === 'trial-balance') return '3 Trial balance & leads';
    if (seg === 'workpapers') return '4 Working papers';
    if (seg === 'sign-off') return '5 Sign-off & lock';
    if (seg === 'review') return 'Review notes';
    if (seg === 'library') return 'Library';
    if (seg === 'templates') return 'Templates';
    if (seg === 'chart-of-accounts') return 'Chart of accounts';
    if (seg === 'design-system') return 'Design system & accessibility';
    if (seg.startsWith('eng_')) {
      const eng = db.engagements.find((e) => e.id === seg);
      const client = eng ? db.clients.find((c) => c.id === eng.client_id) : null;
      return client ? client.name : 'Engagement';
    }
    if (seg.startsWith('wp_')) return seg.toUpperCase().replace('WP_', '');
    return seg;
  };

  const handleAskBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botPrompt.trim()) return;
    setBotResponse(
      `✦ suggestion: Based on the trial balance and working paper F-10, additions of £2,400.00 are supported by invoice INV-DELL-9811. One disposal proceeds item (£250.00) remains unlinked to bank evidence. All other mathematical footings and proof in total checks reconcile to nominal 1500 and 1700.`
    );
  };

  return (
    <>
      {/* Skip to Content Link for WCAG 2.2 AA */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 z-50 bg-[#102654] text-white px-4 py-2 rounded-lg font-bold shadow-md outline-none focus:ring-3 focus:ring-[#FF7D6B]"
      >
        Skip to main content
      </a>

      <header
        aria-label="Top navigation bar"
        className="h-14 border-b border-[#E3E7EF] bg-white px-4 sm:px-6 flex items-center justify-between gap-3 select-none shrink-0"
      >
        {/* Left: Mobile menu toggle + Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-lg text-[#5B6478] hover:text-[#102654] hover:bg-[#F6F7FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7D6B]"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <nav aria-label="Breadcrumbs" className="hidden lg:flex items-center gap-1.5 text-xs text-[#5B6478] min-w-0 overflow-hidden whitespace-nowrap">
            <Link
              href="/"
              className="hover:text-[#B8432F] font-medium transition-colors"
            >
              Blynt
            </Link>

            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              const pathSlice = '/' + segments.slice(0, i + 1).join('/');
              const label = getBreadcrumbLabel(seg);

              return (
                <React.Fragment key={pathSlice}>
                  <ChevronRight className="w-3.5 h-3.5 text-[#5B6478]/50 shrink-0" />
                  {isLast ? (
                    <span className="text-[#102654] font-semibold" aria-current="page">
                      {label}
                    </span>
                  ) : (
                    <Link
                      href={pathSlice}
                      className="hover:text-[#B8432F] transition-colors"
                    >
                      {label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Active Company Switcher & Period Selector */}
          <div className="hidden lg:flex items-center gap-2.5 ml-4">
            <CompanySelector variant="header" onAddNewCompany={() => setShowCustomizeModal(true)} />
            <PeriodSelector />
          </div>
        </div>

        {/* Right: Global Search (⌘K), Blynt Bot, Notifications, User Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Global Search Button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Global search (Command K)"
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs text-[#5B6478] bg-[#F6F7FB] border border-[#D5DBE7] rounded-full hover:border-[#102654]/40 hover:text-[#102654] transition-all min-control-h min-h-[38px] w-40 sm:w-56 xl:w-72 justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0 text-[#7E8DA6]" />
              <span className="truncate">Search clients, accounts, papers...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold bg-white border border-[#D5DBE7] px-1.5 py-0.5 rounded text-[#5B6478] shrink-0 shadow-2xs">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>

          {/* Blynt Bot Coral Button */}
          <button
            type="button"
            onClick={() => setBotOpen(true)}
            aria-label="Open Blynt Bot AI assistant"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF1EE] hover:bg-[#ffe3dd] border border-[#FF7D6B] text-[#A23A27] font-bold text-xs rounded-full transition-all min-h-[38px] cursor-pointer shadow-2xs"
          >
            <span className="text-[#FF7D6B] font-bold text-sm leading-none">+</span>
            <Sparkles className="w-3.5 h-3.5 fill-[#FF7D6B] text-[#FF7D6B]" />
            <span className="hidden sm:inline font-semibold">Blynt Bot</span>
          </button>

          {/* Notifications: open review notes and client queries */}
          <Link
            href="/review"
            aria-label={`${openNotesCount} open review notes`}
            className="relative p-2 rounded-full text-[#5B6478] hover:text-[#102654] hover:bg-[#F6F7FB] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {openNotesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 rounded-full bg-[#FF7D6B] text-[#0B1B3D] font-bold text-[10px] flex items-center justify-center shadow-2xs">
                {openNotesCount}
              </span>
            )}
          </Link>

          <div className="h-4 w-[1px] bg-[#E3E7EF]" />

          {/* User Profile & Persona Switcher */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-label="User account and role menu"
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-[#F6F7FB] border border-transparent hover:border-[#E3E7EF] transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#102654] text-white flex items-center justify-center font-bold text-xs">
                {currentUser.initials}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-[#102654]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-[#5B6478]">
                  {currentUser.title}
                </span>
              </div>
              <ChevronRight
                className={`w-3.5 h-3.5 text-[#5B6478] transition-transform ${
                  userMenuOpen ? 'rotate-90' : ''
                }`}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E3E7EF] rounded-[16px] shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-[#E3E7EF]">
                  <div className="text-xs font-bold text-[#102654]">{currentUser.name}</div>
                  <div className="text-[11px] text-[#5B6478]">{currentUser.email}</div>
                  <div className="text-[10px] font-semibold text-[#0B6B52] bg-[#E6F4EF] px-1.5 py-0.5 rounded inline-block mt-1">
                    {currentUser.title}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#102654] hover:bg-[#F6F7FB] text-left cursor-pointer font-medium"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#FF7D6B]" />
                    <span>Practice settings (ADM)</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowCustomizeModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#102654] hover:bg-[#F6F7FB] text-left cursor-pointer font-medium"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#1D4E89]" />
                    <span>Customize system &amp; company</span>
                  </button>

                  <div className="flex items-center justify-between px-4 py-2 text-xs text-[#5B6478]">
                    <span className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-[#1D4E89]" />
                      <span>Jurisdiction</span>
                    </span>
                    <span className="font-mono text-[10px] bg-[#EAF5FC] px-1.5 py-0.5 rounded font-bold text-[#1D4E89]">
                      {jurisdiction.currency} · {jurisdiction.code}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2 text-xs text-[#5B6478]">
                    <span className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#5B6478]" />
                      <span>Auto log-off timer</span>
                    </span>
                    <span className="font-mono text-[10px] bg-[#F6F7FB] px-1.5 py-0.5 rounded font-bold text-[#102654]">
                      {inactivityTimeoutMinutes}m
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#B42318] hover:bg-[#FDECEA] font-semibold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Forced / Manual Customization Modal */}
      {showCustomizeModal && (
        <OnboardingModal forceOpen onClose={() => setShowCustomizeModal(false)} />
      )}

      {/* Global ⌘K Search Modal */}
      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-search-title"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-start justify-center pt-20 p-4"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[#E3E7EF] flex items-center gap-3">
              <Search className="w-4 h-4 text-[#5B6478]" />
              <input
                id="global-search-title"
                type="text"
                autoFocus
                placeholder="Search working papers, accounts, clients, or commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm text-[#102654] outline-none placeholder:text-[#5B6478]"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1 text-[#5B6478] hover:text-[#102654] rounded"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto flex flex-col gap-1 text-xs">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B6478]">
                Quick Navigation
              </div>
              <Link
                href={`/engagements/${db.engagements[0]?.id ?? 'none'}/workpapers/wp_f10`}
                onClick={() => setSearchOpen(false)}
                className="p-2 hover:bg-[#F6F7FB] rounded-lg flex items-center justify-between text-[#102654]"
              >
                <span className="font-semibold">F-10 Fixed assets register and depreciation</span>
                <span className="text-[#0B6B52] bg-[#E6F4EF] px-1.5 py-0.5 rounded font-mono">
                  ● Prepared
                </span>
              </Link>
              <Link
                href={`/engagements/${db.engagements[0]?.id ?? 'none'}/trial-balance`}
                onClick={() => setSearchOpen(false)}
                className="p-2 hover:bg-[#F6F7FB] rounded-lg flex items-center justify-between text-[#102654]"
              >
                <span className="font-semibold">Trial balance and lead schedules</span>
                <span className="text-[#5B6478] font-mono">TB</span>
              </Link>
              <Link
                href={`/engagements/${db.engagements[0]?.id ?? 'none'}/mapping`}
                onClick={() => setSearchOpen(false)}
                className="p-2 hover:bg-[#F6F7FB] rounded-lg flex items-center justify-between text-[#102654]"
              >
                <span className="font-semibold">Account mapping (Blynt chart of accounts)</span>
                <span className="text-[#A23A27] bg-[#FFF1EE] px-1.5 py-0.5 rounded font-mono">
                  ! Needs you
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Blynt Bot Drawer / Modal */}
      {botOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="blynt-bot-title"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/40 backdrop-blur-xs flex items-center justify-end"
        >
          <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col border-l border-[#E3E7EF]">
            <div className="p-4 border-b border-[#E3E7EF] flex items-center justify-between bg-[#0B1B3D] text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#FF7D6B] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#0B1B3D]" />
                </div>
                <div>
                  <h2 id="blynt-bot-title" className="text-sm font-bold">
                    Blynt Bot
                  </h2>
                  <p className="text-[10px] text-[#FF7D6B]">
                    ✦ AI suggests, people decide
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBotOpen(false)}
                className="p-1.5 text-white/70 hover:text-white rounded"
                aria-label="Close Blynt Bot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 text-xs text-[#102654]">
              <div className="bg-[#FFF1EE] border border-[#FF7D6B]/30 p-3 rounded-[12px]">
                <div className="font-bold text-[#A23A27] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Audit Guidance
                </div>
                <p className="text-[#5B6478] mt-1">
                  Blynt Bot drafts conclusions, explains variances, checks evidence completeness, and suggests account mappings. All AI output is labelled ✦ suggestion and changes nothing until accepted by a named user.
                </p>
              </div>

              {botResponse && (
                <div className="bg-[#EAF5FC] border border-[#1D4E89]/20 p-3 rounded-[12px]">
                  <div className="font-bold text-[#1D4E89]">✦ suggestion</div>
                  <p className="text-[#102654] mt-1">{botResponse}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alert('Suggestion accepted by named user and written to audit trail.')}
                      className="px-3 py-1 bg-[#102654] text-white font-semibold rounded-[8px] hover:bg-[#0B1B3D]"
                    >
                      Use in paper
                    </button>
                    <button
                      type="button"
                      onClick={() => setBotResponse(null)}
                      className="px-3 py-1 bg-white border border-[#D5DBE7] text-[#5B6478] rounded-[8px]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleAskBot} className="p-4 border-t border-[#E3E7EF] flex gap-2">
              <input
                type="text"
                placeholder="Ask Blynt Bot about this paper or engagement..."
                value={botPrompt}
                onChange={(e) => setBotPrompt(e.target.value)}
                className="flex-1 min-h-[44px] px-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B]"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] font-bold text-xs rounded-[10px] cursor-pointer"
              >
                Ask
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
