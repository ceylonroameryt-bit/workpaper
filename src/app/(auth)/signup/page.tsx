'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Building2,
  Lock,
  Mail,
  User as UserIcon,
  Check,
  Circle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { BlyntLogo } from '@/components/ui/BlyntLogo';
import { emailError, passwordChecks, passwordError } from '@/lib/validation';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [firmName, setFirmName] = useState('');
  const [role, setRole] = useState<'manager' | 'partner' | 'preparer' | 'reviewer' | 'admin'>('manager');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const emailProblem = emailError(workEmail);
  const checks = passwordChecks(password, { email: workEmail, name: fullName });
  const passwordOk = checks.every((c) => c.ok);
  const confirmProblem = confirmPassword && confirmPassword !== password ? 'The passwords don’t match.' : null;

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  const handlePrefillSample = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setFullName('Marcus Sterling');
    setWorkEmail(`marcus.sterling${randomSuffix}@sterlingaudit.co.uk`);
    setFirmName(`Sterling & Partners LLP`);
    setRole('manager');
    setPassword('AuditSecure2026!');
    setConfirmPassword('AuditSecure2026!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!fullName.trim() || !workEmail.trim() || !firmName.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (emailProblem) {
      setEmailTouched(true);
      setErrorMessage(emailProblem);
      return;
    }

    const pwProblem = passwordError(password, { email: workEmail, name: fullName });
    if (pwProblem) {
      setErrorMessage(pwProblem);
      return;
    }

    if (password !== confirmPassword) {
      setConfirmTouched(true);
      setErrorMessage('The passwords don’t match.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('Please confirm agreement to the audit processing terms.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          workEmail: workEmail.trim(),
          firmName: firmName.trim(),
          role,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to create firm account. Please try again.');
        setSubmitting(false);
        return;
      }

      // Mark onboarding as ready so user isn't prompted with redundant first-time setup
      if (typeof window !== 'undefined') {
        localStorage.setItem('blynt_onboarding_completed', 'true');
        if (data.clientId) {
          localStorage.setItem('blynt_active_client_id', data.clientId);
        }
      }

      setSuccessNotice(true);
      setTimeout(() => {
        // Two-factor set-up first (when required), then the practice set-up wizard
        window.location.href = data.mfa ? '/login/mfa?step=setup&from=%2Fonboarding' : '/onboarding';
      }, 800);
    } catch {
      setErrorMessage('Could not connect to the server. Please check your network and try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F6F7FB] text-[#102654]">
      {/* Brand Panel Left (Blynt Navy) */}
      <div className="lg:col-span-6 xl:col-span-5 bg-[#0B1B3D] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          {/* Blynt Logo */}
          <div className="mb-12">
            <BlyntLogo variant="full" theme="dark" size="lg" />
          </div>

          <div className="max-w-[440px]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF7D6B] bg-[#102654] px-3 py-1 rounded-full border border-[#FF7D6B]/30 inline-block mb-4">
              Practice Onboarding
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
              Set up your audit firm workspace in seconds
            </h1>
            <p className="text-sm text-[#A6B4D0] leading-relaxed mb-8">
              Create an isolated firm tenant with role-based sign-offs, standardized working paper packs, and intelligent nominal ledger mapping.
            </p>

            <div className="flex flex-col gap-4 text-xs text-[#A6B4D0]">
              <div className="flex items-start gap-3 bg-[#102654]/60 border border-[#1D4E89]/40 p-3.5 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold mb-0.5">Firm Tenant Isolation</strong>
                  Statutory engagements, trial balance snapshots, and review notes strictly isolated to your firm.
                </div>
              </div>

              <div className="flex items-start gap-3 bg-[#102654]/60 border border-[#1D4E89]/40 p-3.5 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-[#FF7D6B] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold mb-0.5">Automated Working Paper Packs</strong>
                  Pre-configured lead schedules (A-Z) and materiality calculators for FRS 102 1A, FRS 105, and IFRS.
                </div>
              </div>

              <div className="flex items-start gap-3 bg-[#102654]/60 border border-[#1D4E89]/40 p-3.5 rounded-xl">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold mb-0.5">Instant Working Sample</strong>
                  Includes a ready-to-test starter company with mapped trial balance and leadsheets.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#1D4E89]/40 text-xs text-[#5B6478] flex items-center justify-between">
          <span>&copy; {new Date().getFullYear()} Blynt Workpapers.</span>
          <span className="text-[#A6B4D0]">ISA &amp; UK GAAP Compliant</span>
        </div>
      </div>

      {/* Signup Form Right */}
      <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-[460px]">
          {/* Quick Prefill helper */}
          <div className="mb-6 p-3.5 bg-[#EAF5FC] border border-[#1D4E89]/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#1D4E89]">
              <Sparkles className="w-4 h-4 text-[#1D4E89] shrink-0" />
              <span>Testing out the platform?</span>
            </div>
            <button
              type="button"
              onClick={handlePrefillSample}
              className="text-xs font-bold text-[#1D4E89] hover:underline cursor-pointer bg-white px-2.5 py-1 rounded-md border border-[#1D4E89]/30"
            >
              Fill sample firm details
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-[#102654] tracking-tight">
              Create a firm account
            </h2>
            <p className="text-xs text-[#5B6478] mt-1">
              Start your practice workspace. No credit card required.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-[#FFF1EE] border border-[#FF7D6B]/30 rounded-xl flex items-start gap-2.5 text-xs text-[#B8432F] animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successNotice && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Firm workspace created successfully! Redirecting to dashboard…</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="signup-name" className="block text-xs font-bold text-[#102654] mb-1.5 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-[#5B6478]" />
                <span>Your Full Name</span>
              </label>
              <input
                id="signup-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Wright"
                className="w-full min-h-[44px] px-3.5 text-xs bg-white border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] shadow-2xs"
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-xs font-bold text-[#102654] mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#5B6478]" />
                <span>Work Email Address</span>
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                autoComplete="email"
                aria-invalid={emailTouched && !!emailProblem}
                aria-describedby="signup-email-error"
                placeholder="e.g. alex.wright@wrightaudit.co.uk"
                className={`w-full min-h-[44px] px-3.5 text-xs bg-white border rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] shadow-2xs ${
                  emailTouched && emailProblem ? 'border-[#B42318]' : 'border-[#D5DBE7]'
                }`}
              />
              {emailTouched && emailProblem && (
                <p id="signup-email-error" className="text-[11px] text-[#B42318] mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {emailProblem}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="signup-firm" className="block text-xs font-bold text-[#102654] mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#5B6478]" />
                  <span>Firm / Practice Name</span>
                </label>
                <input
                  id="signup-firm"
                  type="text"
                  required
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="e.g. Wright & Co LLP"
                  className="w-full min-h-[44px] px-3.5 text-xs bg-white border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] shadow-2xs"
                />
              </div>

              <div>
                <label htmlFor="signup-role" className="block text-xs font-bold text-[#102654] mb-1.5">
                  Your Audit Role
                </label>
                <select
                  id="signup-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full min-h-[44px] px-3 text-xs bg-white border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] shadow-2xs"
                >
                  <option value="manager">Audit Manager</option>
                  <option value="partner">Engagement Partner</option>
                  <option value="reviewer">Audit Reviewer</option>
                  <option value="preparer">Senior Associate (Preparer)</option>
                  <option value="admin">Firm Administrator</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-xs font-bold text-[#102654] mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#5B6478]" />
                <span>Password</span>
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-describedby="signup-password-rules"
                  placeholder="At least 12 characters"
                  className="w-full min-h-[44px] px-3.5 pr-10 text-xs bg-white border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6478] hover:text-[#102654] p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <ul id="signup-password-rules" aria-live="polite" className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {checks.map((c) => (
                  <li key={c.label} className={`flex items-center gap-1.5 text-[11px] ${c.ok ? 'text-[#0B6B52]' : 'text-[#5B6478]'}`}>
                    {c.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3 h-3 shrink-0" />}
                    <span>{c.label}</span>
                    <span className="sr-only">{c.ok ? '(met)' : '(not met)'}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label htmlFor="signup-confirm" className="block text-xs font-bold text-[#102654] mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#5B6478]" />
                <span>Confirm Password</span>
              </label>
              <input
                id="signup-confirm"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmTouched(true)}
                autoComplete="new-password"
                aria-invalid={confirmTouched && !!confirmProblem}
                placeholder="Type it again"
                className={`w-full min-h-[44px] px-3.5 text-xs bg-white border rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] shadow-2xs ${
                  confirmTouched && confirmProblem ? 'border-[#B42318]' : 'border-[#D5DBE7]'
                }`}
              />
              {confirmTouched && confirmProblem && (
                <p className="text-[11px] text-[#B42318] mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {confirmProblem}
                </p>
              )}
              {passwordOk && confirmPassword && !confirmProblem && (
                <p className="text-[11px] text-[#0B6B52] mt-1.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Passwords match
                </p>
              )}
            </div>

            <div className="flex items-start gap-2.5 text-xs text-[#5B6478] mt-1">
              <input
                id="signup-terms"
                type="checkbox"
                required
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 rounded border-[#D5DBE7] text-[#102654] focus:ring-[#FF7D6B] mt-0.5 cursor-pointer"
              />
              <label htmlFor="signup-terms" className="cursor-pointer select-none leading-relaxed">
                I agree to the practice terms and confirm processing of audit engagement records under confidentiality.
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 min-h-[46px] w-full bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-[10px] flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? (
                <span>Creating workspace…</span>
              ) : (
                <>
                  <span>Create Practice Workspace</span>
                  <ArrowRight className="w-4 h-4 text-[#FF7D6B]" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E3E7EF] text-center text-xs text-[#5B6478]">
            Already have a practice account?{' '}
            <Link href="/login" className="text-[#B8432F] font-bold hover:underline">
              Sign in to your firm
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
