'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Clock, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';
import { signOut } from '@/lib/session';
import { useCompany } from '@/context/CompanyContext';

const LAST_ACTIVITY_KEY = 'blynt_last_activity_timestamp';
const WARNING_WINDOW_SECONDS = 60; // Show warning modal 60s before logout
const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password', '/invite'];

export const InactivityHandler: React.FC = () => {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.some((p) => pathname?.startsWith(p));
  const { inactivityTimeoutMinutes } = useCompany();

  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(WARNING_WINDOW_SECONDS);
  const lastActiveRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update activity timestamp in local ref and localStorage
  const registerActivity = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      } catch {
        // Fallback if storage blocked
      }
    }
    if (showWarning) {
      setShowWarning(false);
      setSecondsRemaining(WARNING_WINDOW_SECONDS);
    }
  }, [showWarning]);

  // Monitor user events across window
  useEffect(() => {
    if (isAuthPage) return;

    // Initialize timestamp
    registerActivity();

    let throttleTimer: NodeJS.Timeout | null = null;
    const handleUserInteraction = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        registerActivity();
        throttleTimer = null;
      }, 1000);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [isAuthPage, registerActivity]);

  // Interval check for inactivity
  useEffect(() => {
    if (isAuthPage) return;

    const timeoutMs = (inactivityTimeoutMinutes || 15) * 60 * 1000;
    const warningThresholdMs = timeoutMs - WARNING_WINDOW_SECONDS * 1000;

    const interval = setInterval(() => {
      let lastActivity = lastActiveRef.current;
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > lastActivity) {
            lastActivity = parsed;
            lastActiveRef.current = parsed;
          }
        }
      }

      const elapsed = Date.now() - lastActivity;

      if (elapsed >= timeoutMs) {
        // Idle timeout reached: Auto logoff
        clearInterval(interval);
        handleAutomaticLogout();
      } else if (elapsed >= warningThresholdMs) {
        // In the warning window
        const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
        setSecondsRemaining(remaining);
        setShowWarning(true);
      } else {
        if (showWarning) {
          setShowWarning(false);
          setSecondsRemaining(WARNING_WINDOW_SECONDS);
        }
      }
    }, 1000);

    timerRef.current = interval;

    return () => clearInterval(interval);
  }, [isAuthPage, inactivityTimeoutMinutes, showWarning]);

  const handleAutomaticLogout = async () => {
    setShowWarning(false);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=timeout';
      }
    }
  };

  const handleStaySignedIn = () => {
    registerActivity();
    setShowWarning(false);
    setSecondsRemaining(WARNING_WINDOW_SECONDS);
  };

  const handleManualSignOut = async () => {
    setShowWarning(false);
    await signOut();
  };

  if (isAuthPage || !showWarning) return null;

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / WARNING_WINDOW_SECONDS) * 100));

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
      aria-describedby="inactivity-desc"
      className="fixed inset-0 z-[100] bg-[#0B1B3D]/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-2xl max-w-md w-full p-6 flex flex-col gap-5 text-center relative overflow-hidden">
        {/* Animated Top Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#F6F7FB]">
          <div
            className="h-full bg-[#FF7D6B] transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Warning Icon */}
        <div className="w-14 h-14 rounded-2xl bg-[#FFF1EE] text-[#B8432F] border border-[#FF7D6B]/30 flex items-center justify-center mx-auto shadow-inner">
          <Clock className="w-7 h-7 stroke-[2.2] animate-pulse" />
        </div>

        <div>
          <h2 id="inactivity-title" className="text-xl font-extrabold text-[#102654] tracking-tight">
            Session Inactivity Warning
          </h2>
          <p id="inactivity-desc" className="text-xs text-[#5B6478] mt-2 leading-relaxed">
            For client data security and compliance with statutory audit standards, your session will automatically be signed out due to inactivity in:
          </p>
        </div>

        {/* Big Countdown Timer */}
        <div className="py-2.5 px-4 bg-[#F6F7FB] border border-[#E3E7EF] rounded-[14px] flex items-center justify-center gap-2">
          <span className="text-3xl font-black font-mono tracking-tight text-[#102654]">
            {secondsRemaining}
          </span>
          <span className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider">
            seconds remaining
          </span>
        </div>

        <p className="text-[11px] text-[#7E8DA6]">
          Click below or press any key to continue your working papers session.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleStaySignedIn}
            autoFocus
            className="flex-1 min-h-[44px] bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-[10px] shadow-sm transition-transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Stay signed in</span>
          </button>

          <button
            type="button"
            onClick={handleManualSignOut}
            className="min-h-[44px] px-4 bg-white hover:bg-[#F6F7FB] border border-[#D5DBE7] text-[#5B6478] hover:text-[#B42318] text-xs font-semibold rounded-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
