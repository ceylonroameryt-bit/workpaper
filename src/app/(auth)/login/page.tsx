'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { AuthBrandPanel } from '@/components/layout/AuthBrandPanel';

// The demo admin hint is for local development only; a live site never shows or pre-fills it
const DEV = process.env.NODE_ENV !== 'production';

export default function LoginPage() {
  const [email, setEmail] = useState(DEV ? 'admin@blynt.co.uk' : '');
  const [password, setPassword] = useState(DEV ? 'admin123' : '');
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F5F8FD] text-[#122654]">
      <AuthBrandPanel />

      {/* Form Right */}
      <div className="lg:col-span-6 xl:col-span-7 bg-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
        <div className="max-w-[420px] w-full">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-[#122654]">
              {mfaStep ? 'Two-factor authentication' : 'Sign in to Blynt Workpapers'}
            </h2>
            <p className="text-xs text-[#4A5878] mt-1.5">
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
                <span>You were signed out after a period of inactivity, to keep client data safe. Please sign in again.</span>
              </div>
            </div>
          )}

          {/* Development Admin Credentials */}
          {DEV && (
          <div className="mb-6 p-3 bg-[#F5F8FD] border border-[#E3E7EF] rounded-[12px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs">
                <span className="font-semibold text-[#122654]">Dev Admin: </span>
                <code className="text-[#1D4E89] font-mono font-medium">admin@blynt.co.uk</code>
                <span className="text-[#4A5878]"> · </span>
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
          )}

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
                  className="block text-xs font-semibold text-[#122654] mb-1.5"
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
                  className="w-full min-h-[44px] px-3.5 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] focus:ring-2 focus:ring-[#FF7A66]/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="work-password"
                    className="block text-xs font-semibold text-[#122654]"
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
                    className="w-full min-h-[44px] px-3.5 pr-10 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] focus:ring-2 focus:ring-[#FF7A66]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5878] hover:text-[#122654] p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#122654]">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="w-4 h-4 rounded border-[#D3DCEE] text-[#122654] focus:ring-[#FF7A66]"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLockedOut}
                className="w-full min-h-[44px] bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold text-xs rounded-[10px] shadow-sm transition-transform active:scale-[0.99] cursor-pointer mt-2 disabled:opacity-50"
              >
                Sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyMfa} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="totp-code"
                  className="block text-xs font-semibold text-[#122654] mb-1.5"
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
                  className="w-full min-h-[44px] px-3.5 text-center font-mono text-base tracking-widest bg-[#F5F8FD] border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66]"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold text-xs rounded-[10px] shadow-sm cursor-pointer mt-2"
              >
                Verify &amp; continue
              </button>

              <button
                type="button"
                onClick={() => setMfaStep(false)}
                className="text-xs text-[#4A5878] hover:text-[#122654] text-center"
              >
                ← Back to email sign in
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-[#E3E7EF] text-center text-xs text-[#4A5878]">
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
