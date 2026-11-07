'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { AuthBrandPanel } from '@/components/layout/AuthBrandPanel';
import { passwordChecks, passwordError } from '@/lib/validation';

const inputClass =
  'w-full min-h-[44px] px-3.5 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] focus:ring-2 focus:ring-[#FF7A66]/20';

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneEmail, setDoneEmail] = useState('');

  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') || ''), []);

  const checks = passwordChecks(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const bad = passwordError(password);
    if (bad) return setError(bad);
    if (password !== confirm) return setError('The passwords don’t match.');
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setDoneEmail(body.email || 'your account');
      else setError(body.error || 'Could not reset the password. Try again.');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  let content: React.ReactNode;
  if (token === null) {
    content = null;
  } else if (!token) {
    content = (
      <>
        <h2 className="text-2xl font-bold tracking-tight">Reset link needed</h2>
        <p className="text-xs text-[#4A5878] mt-1.5">
          To set a new password, open the reset link your practice admin or partner sent you.
        </p>
        <Link href="/forgot-password" className="inline-block mt-6 text-xs font-bold text-[#B8432F] hover:underline">
          How to get a reset link
        </Link>
      </>
    );
  } else if (doneEmail) {
    content = (
      <>
        <div className="w-12 h-12 rounded-full bg-[#E6F4EF] text-[#0B6B52] flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Password updated</h2>
        <p className="text-xs text-[#4A5878] mt-1.5">You can now sign in to {doneEmail} with your new password.</p>
        <Link
          href="/login"
          className="mt-6 w-full min-h-[44px] bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold text-xs rounded-[10px] flex items-center justify-center"
        >
          Sign in
        </Link>
      </>
    );
  } else {
    content = (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Set a new password</h2>
          <p className="text-xs text-[#4A5878] mt-1.5">Choose a strong password you don&apos;t use anywhere else.</p>
        </div>

        {error && (
          <div role="alert" className="p-3 mb-4 rounded-[10px] bg-[#FDECEA] border border-[#B42318]/30 text-[#B42318] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="new-password" className="block text-xs font-semibold mb-1.5">New password</label>
            <div className="relative">
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5878] hover:text-[#122654] p-1"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px]">
              {checks.map((c) => (
                <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'text-[#0B6B52]' : 'text-[#4A5878]'}`}>
                  {c.ok ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-[#D3DCEE] inline-block" />}
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-xs font-semibold mb-1.5">Confirm new password</label>
            <input
              id="confirm-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              className={inputClass}
            />
            {mismatch && <p className="text-[11px] text-[#B42318] mt-1">The passwords don&apos;t match.</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[44px] bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold text-xs rounded-[10px] shadow-sm mt-2 cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F5F8FD] text-[#122654]">
      <AuthBrandPanel />
      <div className="lg:col-span-6 xl:col-span-7 bg-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
        <div className="max-w-[420px] w-full">
          {content}
          <div className="mt-8 pt-6 border-t border-[#E3E7EF] text-center text-xs text-[#4A5878]">
            <Link href="/login" className="hover:text-[#122654]">← Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
