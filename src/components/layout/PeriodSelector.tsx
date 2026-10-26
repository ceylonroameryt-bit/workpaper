'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Lock, Unlock, ChevronDown, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { db } from '@/lib/server/db';
import { getCurrentUserId } from '@/lib/session';

export const PeriodSelector: React.FC = () => {
  const { activeEngagement, activeCompany, refreshCompanyData } = useCompany();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'month' | 'quarter' | 'year' | 'custom'>('year');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('FY26 (Year ended 30 Sep 2026)');
  const [comparePeriod, setComparePeriod] = useState<string>('FY25 (Year ended 30 Sep 2025)');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLocked = activeEngagement?.status === 'locked';
  const currentUser = db.users.find((u) => u.id === getCurrentUserId());
  const currentMembership = db.memberships.find(
    (m) => m.user_id === currentUser?.id && m.firm_id === (activeCompany?.firm_id || 'firm_blynt_uk')
  );
  const isPartnerOrAdmin = currentMembership?.role === 'partner' || currentMembership?.role === 'admin';

  const handleApply = () => {
    setOpen(false);
  };

  const handleUnlock = () => {
    if (unlockReason.trim().length < 10) {
      setUnlockError('Reason must be at least 10 characters.');
      return;
    }
    if (activeEngagement) {
      activeEngagement.status = 'review';
      activeEngagement.locked_at = null;
      activeEngagement.locked_by = null;
      db.logAudit(
        activeEngagement.firm_id,
        { id: currentUser?.id || 'usr_partner', name: currentUser?.name || 'Partner', role: 'partner' },
        'UNLOCK_PERIOD',
        'engagements',
        activeEngagement.id,
        { status: 'locked' },
        { status: 'review', reason: unlockReason }
      );
      refreshCompanyData();
    }
    setShowUnlockModal(false);
    setUnlockReason('');
    setUnlockError('');
    setOpen(false);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-[#F6F7FB] border border-[#D5DBE7] hover:border-[#102654]/40 rounded-[10px] text-xs font-medium text-[#102654] transition-all cursor-pointer shadow-2xs"
        >
          <Calendar className="w-3.5 h-3.5 text-[#1D4E89]" />
          <span className="font-semibold truncate max-w-[170px] sm:max-w-xs">{selectedPeriod}</span>
          {isLocked && (
            <span
              title="Period is locked after partner approval"
              className="flex items-center gap-1 text-[10px] bg-[#FFF4DB] text-[#6B4700] px-1.5 py-0.5 rounded font-mono font-bold"
            >
              <Lock className="w-3 h-3 text-[#B8432F]" />
              Locked
            </span>
          )}
          <ChevronDown className={`w-3 h-3 text-[#5B6478] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white border border-[#E3E7EF] rounded-[16px] shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#1D4E89]" />
                <span className="text-xs font-bold text-[#102654]">Period Selector (ENG-02)</span>
              </div>
              {isLocked ? (
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  className="flex items-center gap-1 text-[11px] text-[#B8432F] hover:underline font-semibold cursor-pointer"
                >
                  <Unlock className="w-3 h-3" />
                  Unlock period
                </button>
              ) : (
                <span className="text-[10px] text-[#0B6B52] bg-[#E6F4EF] font-bold px-2 py-0.5 rounded-full">
                  Active Period
                </span>
              )}
            </div>

            {/* Tabs: Month, Quarter, Year, Custom */}
            <div className="flex items-center gap-1 bg-[#F6F7FB] p-1 rounded-lg mt-3">
              {(['month', 'quarter', 'year', 'custom'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-xs font-medium capitalize rounded-md transition-all ${
                    activeTab === tab
                      ? 'bg-white text-[#102654] font-bold shadow-xs'
                      : 'text-[#5B6478] hover:text-[#102654]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Period Selection Controls */}
            <div className="mt-3.5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#5B6478] uppercase tracking-wider mb-1">
                  Selected Period
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg px-2.5 py-1.5 text-[#102654] font-medium focus:outline-none focus:ring-1 focus:ring-[#1D4E89]"
                >
                  {activeTab === 'year' && (
                    <>
                      <option value="FY26 (Year ended 30 Sep 2026)">FY26 (Year ended 30 Sep 2026)</option>
                      <option value="FY25 (Year ended 30 Sep 2025)">FY25 (Year ended 30 Sep 2025)</option>
                    </>
                  )}
                  {activeTab === 'quarter' && (
                    <>
                      <option value="Q4 FY26 (Jul 2026 - Sep 2026)">Q4 FY26 (Jul 2026 - Sep 2026)</option>
                      <option value="Q3 FY26 (Apr 2026 - Jun 2026)">Q3 FY26 (Apr 2026 - Jun 2026)</option>
                      <option value="Q2 FY26 (Jan 2026 - Mar 2026)">Q2 FY26 (Jan 2026 - Mar 2026)</option>
                      <option value="Q1 FY26 (Oct 2025 - Dec 2025)">Q1 FY26 (Oct 2025 - Dec 2025)</option>
                    </>
                  )}
                  {activeTab === 'month' && (
                    <>
                      <option value="Sep 2026 (Month 12)">Sep 2026 (Month 12)</option>
                      <option value="Aug 2026 (Month 11)">Aug 2026 (Month 11)</option>
                      <option value="Jul 2026 (Month 10)">Jul 2026 (Month 10)</option>
                      <option value="Jun 2026 (Month 9)">Jun 2026 (Month 9)</option>
                    </>
                  )}
                  {activeTab === 'custom' && (
                    <option value="Custom: 01/10/2025 to 30/09/2026">Custom: 01/10/2025 to 30/09/2026</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#5B6478] uppercase tracking-wider mb-1">
                  Compare With (Default: Prior Year)
                </label>
                <select
                  value={comparePeriod}
                  onChange={(e) => setComparePeriod(e.target.value)}
                  className="w-full text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg px-2.5 py-1.5 text-[#102654] font-medium focus:outline-none focus:ring-1 focus:ring-[#1D4E89]"
                >
                  <option value="FY25 (Year ended 30 Sep 2025)">FY25 (Year ended 30 Sep 2025) - Prior Year</option>
                  <option value="Budget FY26">Budget FY26</option>
                  <option value="Prior Quarter">Prior Quarter Equivalent</option>
                  <option value="None">None</option>
                </select>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E3E7EF] flex items-center justify-between">
              <span className="text-[11px] text-[#5B6478]">
                {isLocked ? '🔒 Changes disabled' : 'Refreshes balances & leads'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#5B6478] hover:text-[#102654] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-3.5 py-1.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unlock Confirmation Modal (ENG-06) */}
      {showUnlockModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-[#B8432F] mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-[#102654]">Unlock Engagement Period</h3>
            </div>
            <p className="text-xs text-[#5B6478] leading-relaxed mb-4">
              Unlocking this period will reset the Partner approval stamp and notify the engagement team.
              Only a Partner can unlock, and a justification must be recorded in the permanent audit trail (ENG-06).
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#102654] mb-1">
                Reason for unlocking (min. 10 characters) <span className="text-red-500">*</span>
              </label>
              <textarea
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="e.g. Client provided revised stock take certificate post-completion."
                rows={3}
                className="w-full text-xs p-2.5 border border-[#D5DBE7] rounded-lg focus:ring-1 focus:ring-[#1D4E89] outline-none text-[#102654]"
              />
              {unlockError && <p className="text-red-600 text-[11px] mt-1">{unlockError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockReason('');
                }}
                className="px-3.5 py-2 text-xs text-[#5B6478] hover:text-[#102654] font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isPartnerOrAdmin}
                onClick={handleUnlock}
                className="px-4 py-2 bg-[#B8432F] hover:bg-[#a03624] text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                Unlock Period
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
