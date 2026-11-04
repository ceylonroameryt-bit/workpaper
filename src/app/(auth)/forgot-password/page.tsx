'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  KeyRound,
  Mail,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setIsSubmitted(true);
    }, 500);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-[#1B2430]">
      {/* Left Column: Forgot Password Form */}
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
                Working Papers
              </span>
            </div>
          </Link>

          <div className="max-w-[400px]">
            {!isSubmitted ? (
              <>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#E8EEFD] text-[#1E4FD8] text-xs font-semibold mb-4 border border-[#1E4FD8]/20">
                  <KeyRound className="w-4 h-4" />
                  <span>Account Recovery</span>
                </div>

                <h1 className="text-[26px] sm:text-[28px] font-semibold text-[#1B2430] tracking-tight">
                  Reset your password
                </h1>
                <p className="text-sm text-[#5B6676] mt-2 mb-8 leading-relaxed">
                  Enter your firm work email address and we&apos;ll send you a secure link to reset your credentials.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Field label="Work Email Address" htmlFor="reset-email">
                    <Input
                      id="reset-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. name@yourpractice.co.uk"
                      autoFocus
                    />
                  </Field>

                  <div className="mt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      size="md"
                      disabled={isSending}
                    >
                      {isSending ? 'Sending reset link...' : 'Send reset link'}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#E2F4EC] text-[#0B6B4D] flex items-center justify-center mb-1">
                  <Mail className="w-6 h-6" />
                </div>

                <h1 className="text-[26px] font-semibold text-[#1B2430] tracking-tight">
                  Check your inbox
                </h1>

                <p className="text-sm text-[#5B6676] leading-relaxed">
                  We&apos;ve sent a password reset link to{' '}
                  <strong className="text-[#1B2430]">{email}</strong>. The link is valid for 15 minutes.
                </p>

                <div className="w-full p-3.5 rounded-[10px] bg-[#F4F5F7] border border-[#E3E6EB] text-xs text-[#5B6676]">
                  Did not receive an email? Check your spam filter or{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSending(true);
                      setTimeout(() => setIsSending(false), 500);
                    }}
                    className="text-[#1E4FD8] font-semibold hover:underline"
                  >
                    click here to resend
                  </button>
                  .
                </div>

                <Link
                  href="/reset-password"
                  className="w-full mt-2"
                >
                  <Button variant="outline" className="w-full" size="md">
                    Simulate Reset Link Click (Demo)
                  </Button>
                </Link>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-[#E3E6EB]">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-[#5B6676] hover:text-[#1E4FD8] font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[#E3E6EB] flex items-center gap-6 text-xs text-[#5B6676]">
          <span>© 2026 Workpapers Inc.</span>
          <Link href="/login" className="hover:text-[#1B2430]">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-[#1B2430]">
            Sign up
          </Link>
        </div>
      </div>

      {/* Right Column: Support Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-[#E9EFFD] p-12 lg:p-16 flex-col justify-between border-l border-[#D5D9E0]/50">
        <div className="max-w-[500px]">
          <h2 className="text-3xl font-semibold text-[#1B2430] tracking-tight leading-tight mb-4">
            Enterprise Security Standards
          </h2>
          <p className="text-sm text-[#5B6676] leading-relaxed mb-6">
            For practices using single sign-on (SSO) with Microsoft Azure AD / Entra or Okta, password recovery is centrally managed by your firm IT administrator.
          </p>

          <div className="p-4 rounded-[12px] bg-white border border-[#D5D9E0] text-xs text-[#5B6676] flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[#1E4FD8] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-[#1B2430] block mb-0.5">Need IT Helpdesk Assistance?</strong>
              Contact your practice administrator or email support@workpapers.com with your firm domain ID.
            </div>
          </div>
        </div>

        <div className="text-xs text-[#5B6676]">
          Blynt Workpapers
        </div>
      </div>
    </div>
  );
}
