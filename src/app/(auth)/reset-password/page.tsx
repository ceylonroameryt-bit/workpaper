'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Lock,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password rules validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isStrong = hasMinLength && hasUppercase && hasNumber && hasSpecial;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isStrong) {
      setErrorMsg('Please ensure your password satisfies all security requirements.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      setIsSuccess(true);
    }, 600);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-[#1B2430]">
      {/* Left Column: Reset Password Form */}
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
            {!isSuccess ? (
              <>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#E8EEFD] text-[#1E4FD8] text-xs font-semibold mb-4 border border-[#1E4FD8]/20">
                  <Lock className="w-4 h-4" />
                  <span>Secure Password Reset</span>
                </div>

                <h1 className="text-[26px] sm:text-[28px] font-semibold text-[#1B2430] tracking-tight">
                  Set new password
                </h1>
                <p className="text-sm text-[#5B6676] mt-2 mb-6 leading-relaxed">
                  Choose a strong, unique password to secure your clients' working papers.
                </p>

                {errorMsg && (
                  <div className="p-3 rounded-[8px] bg-[#FFF1DC] border border-[#9A4A00]/20 text-[#9A4A00] text-xs font-medium mb-4">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="new-password"
                      className="text-xs font-semibold uppercase tracking-wider text-[#5B6676]"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6676] hover:text-[#1B2430] cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Field label="Confirm Password" htmlFor="confirm-password">
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                    />
                  </Field>

                  {/* Password Strength Checklist */}
                  <div className="p-3 rounded-[10px] bg-[#F4F5F7] border border-[#E3E6EB] flex flex-col gap-1.5 text-xs">
                    <span className="font-semibold text-[#1B2430] text-[11px] uppercase tracking-wider">
                      Requirements:
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      {hasMinLength ? (
                        <Check className="w-3.5 h-3.5 text-[#0B6B4D]" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-[#D5D9E0] inline-block" />
                      )}
                      <span className={hasMinLength ? 'text-[#0B6B4D] font-medium' : 'text-[#5B6676]'}>
                        At least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {hasUppercase ? (
                        <Check className="w-3.5 h-3.5 text-[#0B6B4D]" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-[#D5D9E0] inline-block" />
                      )}
                      <span className={hasUppercase ? 'text-[#0B6B4D] font-medium' : 'text-[#5B6676]'}>
                        At least one uppercase letter (A-Z)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {hasNumber && hasSpecial ? (
                        <Check className="w-3.5 h-3.5 text-[#0B6B4D]" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-[#D5D9E0] inline-block" />
                      )}
                      <span className={hasNumber && hasSpecial ? 'text-[#0B6B4D] font-medium' : 'text-[#5B6676]'}>
                        At least one number &amp; symbol
                      </span>
                    </div>
                    {confirmPassword && (
                      <div className="flex items-center gap-2 text-xs pt-1 border-t border-[#E3E6EB]">
                        {passwordsMatch ? (
                          <Check className="w-3.5 h-3.5 text-[#0B6B4D]" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-[#9A4A00]" />
                        )}
                        <span className={passwordsMatch ? 'text-[#0B6B4D] font-medium' : 'text-[#9A4A00]'}>
                          {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      size="md"
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Updating password...' : 'Update Password & Sign In'}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#E2F4EC] text-[#0B6B4D] flex items-center justify-center mb-1">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <h1 className="text-[26px] font-semibold text-[#1B2430] tracking-tight">
                  Password updated
                </h1>

                <p className="text-sm text-[#5B6676] leading-relaxed">
                  Your password has been changed successfully. You can now use your new password to sign into Workpapers.
                </p>

                <Button
                  variant="primary"
                  className="w-full mt-2"
                  size="md"
                  onClick={() => router.push('/login')}
                >
                  Proceed to Sign In
                </Button>
              </div>
            )}
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

      {/* Right Column: Information Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-[#E9EFFD] p-12 lg:p-16 flex-col justify-between border-l border-[#D5D9E0]/50">
        <div className="max-w-[500px]">
          <h2 className="text-3xl font-semibold text-[#1B2430] tracking-tight leading-tight mb-4">
            Security Best Practices
          </h2>
          <p className="text-sm text-[#5B6676] leading-relaxed mb-6">
            Passwords must not be shared between team members. Everyone has their own sign-in, so the activity log shows who did what.
          </p>
        </div>

        <div className="text-xs text-[#5B6676]">
          Blynt Workpapers
        </div>
      </div>
    </div>
  );
}
