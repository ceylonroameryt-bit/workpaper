import React from 'react';
import Link from 'next/link';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { AuthBrandPanel } from '@/components/layout/AuthBrandPanel';

// No mail service yet: an admin or partner creates a one-time reset link (Settings → Users & Roles)
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F5F8FD] text-[#122654]">
      <AuthBrandPanel />

      <div className="lg:col-span-6 xl:col-span-7 bg-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
        <div className="max-w-[420px] w-full">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-[#122654]">Forgot your password?</h2>
            <p className="text-xs text-[#4A5878] mt-1.5">
              Your practice admin or partner can send you a secure link to set a new one.
            </p>
          </div>

          <div className="p-4 bg-[#F5F8FD] border border-[#E3E7EF] rounded-[12px] text-xs flex items-start gap-3">
            <KeyRound className="w-4 h-4 text-[#1D4E89] shrink-0 mt-0.5" />
            <ol className="list-decimal pl-4 space-y-1.5 text-[#4A5878]">
              <li>Ask your practice admin or partner to reset your password.</li>
              <li>
                They open <strong className="text-[#122654]">Settings → Users &amp; Roles</strong>, choose your name and
                click <strong className="text-[#122654]">Create reset link</strong>.
              </li>
              <li>Open the link they send you within one hour and choose a new password.</li>
            </ol>
          </div>

          <p className="text-xs text-[#4A5878] mt-4">
            If you are the only admin of your practice and can&apos;t sign in, contact Blynt support.
          </p>

          <div className="mt-8 pt-6 border-t border-[#E3E7EF] text-center text-xs text-[#4A5878]">
            <Link href="/login" className="inline-flex items-center gap-1.5 hover:text-[#122654]">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
