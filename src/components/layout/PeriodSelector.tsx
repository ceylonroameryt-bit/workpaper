'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Lock, Unlock, ChevronDown, Check, AlertCircle, Plus } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { db } from '@/lib/server/db';
import { getCurrentUserId } from '@/lib/session';
import { periodLabel } from '@/lib/periods';
import { ChangePeriodDialog } from '@/components/layout/ChangePeriodDialog';
import { ukDate } from '@/lib/dates';

/**
 * Period selector (ENG-02): the active client's engagements, newest first. Choosing one opens
 * the same screen for that period, so it drives every engagement page. Unlocking goes through
 * the audited server route.
 */
export const PeriodSelector: React.FC = () => {
  const { activeEngagement, activeCompany, refreshCompanyData } = useCompany();
  const router = useRouter();
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [changing, setChanging] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [busy, setBusy] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const periods = db.engagements
    .filter((e) => e.client_id === activeCompany?.id)
    .sort((a, b) => b.period_end.localeCompare(a.period_end) || a.period_start.localeCompare(b.period_start));
  const isLocked = activeEngagement?.status === 'locked';
  const role = db.memberships.find((m) => m.user_id === getCurrentUserId())?.role;
  const isPartnerOrAdmin = role === 'partner' || role === 'admin';

  const choose = (id: string) => {
    setOpen(false);
    // Keep the screen (trial balance, mapping…) and swap the engagement in the address
    const sub = pathname.match(/^\/engagements\/[^/]+(\/.*)?$/)?.[1] ?? '';
    router.push(`/engagements/${id}${sub}`);
  };

  const handleUnlock = async () => {
    if (!activeEngagement) return;
    if (unlockReason.trim().length < 10) return setUnlockError('Reason must be at least 10 characters.');
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/engagements/${encodeURIComponent(activeEngagement.id)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unlockReason.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setUnlockError(body.error || 'Could not unlock. Try again.');
      refreshCompanyData();
      setShowUnlockModal(false);
      setUnlockReason('');
      setUnlockError('');
    } catch {
      setUnlockError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Choose period"
          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-[#F5F8FD] border border-[#D3DCEE] hover:border-[#122654]/40 rounded-[10px] text-xs font-medium text-[#122654] transition-all cursor-pointer shadow-2xs"
        >
          <Calendar className="w-3.5 h-3.5 text-[#1D4E89]" />
          <span className="font-semibold truncate max-w-[170px] sm:max-w-xs">{activeEngagement ? periodLabel(activeEngagement) : 'No period yet'}</span>
          {isLocked && (
            <span title="Period is locked after partner approval" className="flex items-center gap-1 text-[10px] bg-[#FFF4DB] text-[#6B4700] px-1.5 py-0.5 rounded font-mono font-bold">
              <Lock className="w-3 h-3 text-[#B8432F]" />
              Locked
            </span>
          )}
          <ChevronDown className={`w-3 h-3 text-[#4A5878] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white border border-[#E3E7EF] rounded-xl shadow-2xl p-4 z-50">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF]">
              <span className="flex items-center gap-2 text-xs font-bold text-[#122654]">
                <Calendar className="w-4 h-4 text-[#1D4E89]" /> {activeCompany?.name ?? 'Periods'}
              </span>
              {isLocked && (
                <button type="button" onClick={() => setShowUnlockModal(true)} className="flex items-center gap-1 text-[11px] text-[#B8432F] hover:underline font-semibold cursor-pointer">
                  <Unlock className="w-3 h-3" /> Unlock period
                </button>
              )}
            </div>

            <ul className="mt-2 max-h-72 overflow-y-auto" role="listbox" aria-label="Periods">
              {periods.map((e) => {
                const on = e.id === activeEngagement?.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => choose(e.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left cursor-pointer ${on ? 'bg-[#EEF2F9]' : 'hover:bg-[#F5F8FD]'}`}
                    >
                      <span>
                        <span className="block text-xs font-semibold text-[#122654]">{periodLabel(e)}</span>
                        <span className="block text-[11px] text-[#4A5878]">
                          {ukDate(e.period_start)} to {ukDate(e.period_end)} · {e.status === 'locked' ? 'Locked' : e.status}
                        </span>
                      </span>
                      {on && <Check className="w-3.5 h-3.5 text-[#1D4E89] shrink-0" />}
                    </button>
                  </li>
                );
              })}
              {!periods.length && <li className="px-2.5 py-2 text-xs text-[#4A5878]">No engagements for this client yet.</li>}
            </ul>

            <div className="mt-2 pt-3 border-t border-[#E3E7EF] flex flex-wrap items-center justify-between gap-2">
              {activeEngagement && !isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setChanging(true);
                  }}
                  className="text-xs font-semibold text-[#1D4E89] hover:underline cursor-pointer"
                >
                  Change period
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push('/engagements/new');
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#1D4E89] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> New engagement or period
              </button>
            </div>
          </div>
        )}
      </div>

      {changing && activeEngagement && (
        <ChangePeriodDialog
          engagement={activeEngagement}
          onClose={() => setChanging(false)}
          onSaved={() => {
            setChanging(false);
            refreshCompanyData();
          }}
        />
      )}

      {/* Unlock Confirmation Modal (ENG-06) */}
      {showUnlockModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#0B1A3B]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-[#B8432F] mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-[#122654]">Unlock Engagement Period</h3>
            </div>
            <p className="text-xs text-[#4A5878] leading-relaxed mb-4">
              Unlocking resets the partner approval. Only a partner or admin can unlock, and the reason is kept in the activity log (ENG-06).
            </p>
            <div className="mb-4">
              <label htmlFor="unlock-reason" className="block text-xs font-semibold text-[#122654] mb-1">
                Reason for unlocking (min. 10 characters) <span className="text-red-500">*</span>
              </label>
              <textarea
                id="unlock-reason"
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="e.g. Client provided revised stock take certificate post-completion."
                rows={3}
                className="w-full text-xs p-2.5 border border-[#D3DCEE] rounded-lg focus:ring-1 focus:ring-[#1D4E89] outline-none text-[#122654]"
              />
              {unlockError && <p role="alert" className="text-red-600 text-[11px] mt-1">{unlockError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockReason('');
                  setUnlockError('');
                }}
                className="px-3.5 py-2 text-xs text-[#4A5878] hover:text-[#122654] font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isPartnerOrAdmin || busy}
                onClick={handleUnlock}
                className="px-4 py-2 bg-[#B8432F] hover:bg-[#a03624] text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {busy ? 'Unlocking…' : 'Unlock Period'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
