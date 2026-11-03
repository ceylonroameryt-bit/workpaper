'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { BlyntLogo } from '@/components/ui/BlyntLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@blynt.co.uk');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [timeoutNotice, setTimeoutNotice] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'timeout') {
        setTimeoutNotice(true);
      }
    }
  }, []);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || submitting) return;
    if (!email || !password) {
      setErrorMessage('Please enter both your work email and password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      // The server checks the password and sets an HttpOnly session cookie
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const from = new URLSearchParams(window.location.search).get('from');
        const okBody = await res.json().catch(() => ({}));
        if (okBody.mfa) {
          // Password accepted; the MFA page finishes the sign-in
          const qs = new URLSearchParams({ step: okBody.mfa });
          if (from) qs.set('from', from);
          window.location.href = `/login/mfa?${qs}`;
          return;
        }
        window.location.href = from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) setIsLockedOut(true);
      setFailedAttempts((prev) => prev + 1);
      setErrorMessage(body.error || 'Sign in failed. Please try again.');
    } catch {
      setErrorMessage('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyMfa = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('Multi-factor sign-in is not available yet.');
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F6F7FB] text-[#102654]">
      {/* Brand Panel Left (Blynt Navy) */}
      <div className="lg:col-span-6 xl:col-span-5 bg-[#0B1B3D] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          {/* Blynt Logo */}
          <div className="mb-16">
            <BlyntLogo variant="full" theme="dark" size="lg" />
          </div>

          <div className="max-w-[420px]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF7D6B] bg-[#102654] px-3 py-1 rounded-full border border-[#FF7D6B]/30 inline-block mb-4">
              UK Cloud Accounting &amp; Workpapers
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
              Financial workpapers built with zero fluff
            </h1>
            <p className="text-sm text-[#A6B4D0] leading-relaxed mb-8">
              One unified Blynt account for client bookkeeping, VAT, annual statutory accounts, and transparent working papers.
            </p>

            <div className="flex flex-col gap-3.5 text-xs text-[#A6B4D0]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Strict integer pence precision</strong>: Zero floating-point rounding anomalies.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">AI suggests, people decide</strong>: Full lineage and explicit named sign-offs.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Cryptographic append-only audit log</strong>: Full compliance with ISA (UK) 230.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-[#102654] text-xs text-[#7E8DA6] flex items-center justify-between">
          <span>Blynt Technologies UK Ltd</span>
          <span>SOC 2 Type II • WCAG 2.2 AA</span>
        </div>
      </div>

      {/* Form Right */}
      <div className="lg:col-span-6 xl:col-span-7 bg-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
        <div className="max-w-[420px] w-full">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-[#102654]">
              {mfaStep ? 'Two-factor authentication' : 'Sign in to Blynt Workpapers'}
            </h2>
            <p className="text-xs text-[#5B6478] mt-1.5">
              {mfaStep
                ? 'Enter the 6-digit code from your authenticator app (Google Authenticator, 1Password, or Authy).'
                : 'Use your Blynt accounting credentials to access your engagements.'}
            </p>
          </div>

          {timeoutNotice && (
            <div
              role="alert"
              className="p-3 mb-4 rounded-[12px] bg-[#FFF4DB] border border-[#6B4700]/30 text-[#6B4700] text-xs flex items-start gap-2.5 animate-in fade-in"
            >
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-[#6B4700]" />
              <div>
                <strong className="font-bold block">Session timeout due to inactivity</strong>
                <span>You were automatically signed out for security and compliance with ISA (UK) audit standards. Please sign in again.</span>
              </div>
            </div>
          )}

          {/* Development Admin Credentials */}
          <div className="mb-6 p-3 bg-[#F6F7FB] border border-[#E3E7EF] rounded-[12px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs">
                <span className="font-semibold text-[#102654]">Dev Admin: </span>
                <code className="text-[#1D4E89] font-mono font-medium">admin@blynt.co.uk</code>
                <span className="text-[#5B6478]"> · </span>
                <code className="text-[#1D4E89] font-mono font-medium">admin123</code>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@blynt.co.uk');
                setPassword('admin123');
                setMfaStep(false);
                setErrorMessage('');
              }}
              className="text-[11px] font-bold text-[#B8432F] hover:underline cursor-pointer"
            >
              Fill
            </button>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="p-3 mb-4 rounded-[10px] bg-[#FDECEA] border border-[#B42318]/30 text-[#B42318] text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!mfaStep ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="work-email"
                  className="block text-xs font-semibold text-[#102654] mb-1.5"
                >
                  Work email
                </label>
                <input
                  id="work-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@firm.co.uk"
                  className="w-full min-h-[44px] px-3.5 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] focus:ring-2 focus:ring-[#FF7D6B]/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="work-password"
                    className="block text-xs font-semibold text-[#102654]"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-[#B8432F] hover:underline font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="work-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 pr-10 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] focus:ring-2 focus:ring-[#FF7D6B]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6478] hover:text-[#102654] p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#102654]">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="w-4 h-4 rounded border-[#D5DBE7] text-[#102654] focus:ring-[#FF7D6B]"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLockedOut}
                className="w-full min-h-[44px] bg-[#102654] hover:bg-[#0B1B3D] text-white font-bold text-xs rounded-[10px] shadow-sm transition-transform active:scale-[0.99] cursor-pointer mt-2 disabled:opacity-50"
              >
                Sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyMfa} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="totp-code"
                  className="block text-xs font-semibold text-[#102654] mb-1.5"
                >
                  6-digit security code
                </label>
                <input
                  id="totp-code"
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full min-h-[44px] px-3.5 text-center font-mono text-base tracking-widest bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B]"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] bg-[#102654] hover:bg-[#0B1B3D] text-white font-bold text-xs rounded-[10px] shadow-sm cursor-pointer mt-2"
              >
                Verify &amp; continue
              </button>

              <button
                type="button"
                onClick={() => setMfaStep(false)}
                className="text-xs text-[#5B6478] hover:text-[#102654] text-center"
              >
                ← Back to email sign in
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-[#E3E7EF] text-center text-xs text-[#5B6478]">
            Need a practice account?{' '}
            <Link href="/signup" className="text-[#B8432F] font-bold hover:underline">
              Create a firm account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
