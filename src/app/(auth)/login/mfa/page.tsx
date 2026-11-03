'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function MfaVerificationPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'setup' | 'verify'>('verify');
  const [enrolment, setEnrolment] = useState<{ secret: string; otpauth: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
    const s = new URLSearchParams(window.location.search).get('step') === 'setup' ? 'setup' : 'verify';
    setStep(s);
    if (s === 'setup') {
      // First sign-in: fetch a new authenticator secret to enrol
      fetch('/api/v1/auth/mfa/setup')
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (r.ok) setEnrolment(body);
          else if (body.code === 'MFA_ENROLLED') setStep('verify');
          else setErrorMessage(body.error || 'Could not start MFA set-up. Please sign in again.');
        })
        .catch(() => setErrorMessage('Could not reach the server. Please try again.'));
    }
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    setErrorMessage('');
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 filled
    if (newDigits.every((d) => d !== '') && index === 5 && value) {
      triggerVerification(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      triggerVerification(pasted);
    }
  };

  const triggerVerification = async (code: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const from = new URLSearchParams(window.location.search).get('from');
        window.location.href = from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
        return;
      }
      const body = await res.json().catch(() => ({}));
      setErrorMessage(body.error || 'Verification failed. Please try again.');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      setErrorMessage('Could not reach the server. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6) {
      setErrorMessage('Please enter all 6 verification digits.');
      return;
    }
    triggerVerification(code);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-[#1B2430]">
      {/* Left Column: MFA Verification Form */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between p-8 sm:p-12 lg:p-16">
        <div>
          {/* Logo */}
          <Link href="/clients" className="flex items-center gap-2.5 mb-12">
            <div className="w-9 h-9 rounded-[10px] bg-[#1E4FD8] flex items-center justify-center text-white font-bold">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg tracking-tight text-[#1B2430]">
                Workpapers
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#5B6676]">
                Audit Platform
              </span>
            </div>
          </Link>

          <div className="max-w-[420px]">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#E8EEFD] text-[#1E4FD8] text-xs font-semibold mb-4 border border-[#1E4FD8]/20">
              <ShieldCheck className="w-4 h-4" />
              <span>Two-Factor Authentication</span>
            </div>

            <h1 className="text-[26px] sm:text-[28px] font-semibold text-[#1B2430] tracking-tight">
              {step === 'setup' ? 'Set up two-factor sign-in' : 'Verify your identity'}
            </h1>
            <p className="text-sm text-[#5B6676] mt-1.5 mb-6 leading-relaxed">
              {step === 'setup'
                ? 'Two-factor sign-in is required. Add this account to your authenticator app (Google Authenticator, Microsoft Authenticator or 1Password), then enter the 6-digit code it shows.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </p>

            {step === 'setup' && enrolment && (
              <div className="p-4 rounded-[10px] border border-[#D5D9E0] bg-[#F4F5F7] mb-6 text-xs">
                <div className="flex items-center gap-2 font-semibold text-[#1B2430] mb-2">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Set-up key</span>
                </div>
                <code className="block font-mono text-sm tracking-wider break-all text-[#1B2430] select-all">
                  {enrolment.secret.replace(/(.{4})/g, '$1 ').trim()}
                </code>
                <a href={enrolment.otpauth} className="inline-block mt-2 text-[#1E4FD8] font-semibold hover:underline">
                  Open in authenticator app on this device
                </a>
              </div>
            )}

            {/* Error Message Banner */}
            {errorMessage && (
              <div className="p-3 rounded-[8px] bg-[#FFF1DC] border border-[#9A4A00]/20 text-[#9A4A00] text-xs font-medium mb-4">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-medium text-[#5B6676] mb-3">
                  6-Digit Security Code
                </label>
                <div className="flex items-center justify-between gap-2 sm:gap-2.5 on-paste" onPaste={handlePaste}>
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Digit ${index + 1}`}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-13 sm:w-13 sm:h-14 text-center font-mono-numbers text-xl font-bold bg-white border border-[#D5D9E0] rounded-[10px] text-[#1B2430] focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#1E4FD8]/20 focus-visible:outline-none transition-all shadow-2xs"
                    />
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={isVerifying}
              >
                {isVerifying ? 'Verifying authentication...' : 'Verify & Continue'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-[#E3E6EB] text-center">
              <Link
                href="/login"
                className="text-xs text-[#5B6676] hover:text-[#1E4FD8] font-medium"
              >
                ← Return to Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[#E3E6EB] flex items-center gap-6 text-xs text-[#5B6676]">
          <span>© 2026 Workpapers Inc.</span>
          <span>SOC 2 Type II Certified</span>
          <span>Encrypted with TLS 1.3</span>
        </div>
      </div>

      {/* Right Column: Security Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-[#E9EFFD] p-12 lg:p-16 flex-col justify-between border-l border-[#D5D9E0]/50">
        <div className="max-w-[540px]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-[#1E4FD8] text-xs font-semibold mb-6 border border-[#E3E6EB]">
            <Lock className="w-3.5 h-3.5 text-[#1E4FD8]" />
            <span>Bank-Grade Audit Security & Access Controls</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-semibold text-[#1B2430] tracking-tight leading-tight mb-4">
            Protecting client financial data
          </h2>

          <p className="text-sm text-[#5B6676] leading-relaxed mb-8">
            Workpapers enforces mandatory hardware or TOTP multi-factor authentication for all engagement teams to safeguard working papers and client audit evidence under ISA 230 standards.
          </p>

          <div className="flex flex-col gap-3.5">
            {[
              {
                title: 'Tamper-Evident Working Papers',
                desc: 'All working papers, nominal adjustments, and evidence extractions are hashed with SHA-256 for legal sign-off defensibility.',
              },
              {
                title: 'Role-Based Access Control (RBAC)',
                desc: 'Audit staff are restricted to permitted engagements with granular preparer, manager, and partner sign-off tiers.',
              },
              {
                title: 'Zero Permanent Storage for AI',
                desc: 'LLM extractions occur in ephemeral isolated containers with zero customer data retention for AI model training.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-[12px] bg-white border border-[#D5D9E0] flex items-start gap-3.5 shadow-2xs"
              >
                <CheckCircle2 className="w-5 h-5 text-[#0B6B4D] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-[#1B2430]">{item.title}</h4>
                  <p className="text-xs text-[#5B6676] mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#5B6676]">
          <span className="font-mono-numbers">TOTP (RFC 6238)</span>
          <span>•</span>
          <span>Required for every user</span>
        </div>
      </div>
    </div>
  );
}
