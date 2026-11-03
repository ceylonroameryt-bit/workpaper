'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { BlyntLogo } from '@/components/ui/BlyntLogo';
import { passwordError } from '@/lib/validation';

interface InviteInfo {
  email: string;
  name: string;
  role: string;
  firm_name: string;
}

// ADM-01: accept an invitation, set a password, then sign in and set up MFA
export default function AcceptInvitePage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/invites/accept?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.ok) setInfo(body);
        else setError(body.error || 'This invitation is invalid or has expired.');
      })
      .catch(() => setError('Could not reach the server. Please try again.'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const badPassword = passwordError(password, { email: info?.email, name: info?.name });
    if (badPassword) return setError(badPassword);
    if (password !== confirm) return setError('The passwords do not match.');
    setSaving(true);
    try {
      const res = await fetch('/api/v1/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setDone(true);
      else setError(body.error || 'Could not accept the invitation.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7FB] text-[#102654] p-4">
      <div className="w-full max-w-[440px] bg-white border border-[#D5DBE7] rounded-[14px] p-8 shadow-sm">
        <div className="mb-8">
          <BlyntLogo variant="full" theme="light" size="md" />
        </div>

        {done ? (
          <>
            <h1 className="text-xl font-bold mb-2">Your account is ready</h1>
            <p className="text-sm text-[#5B6478] mb-6">
              Sign in with {info?.email}. You will be asked to set up two-factor sign-in with an authenticator app.
            </p>
            <Link href="/login">
              <Button variant="primary" size="md" className="w-full">Go to sign in</Button>
            </Link>
          </>
        ) : info ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold mb-1">Join {info.firm_name || 'your practice'}</h1>
              <p className="text-sm text-[#5B6478]">
                {info.name}, you have been invited as <strong className="capitalize">{info.role}</strong> ({info.email}). Choose a password to finish.
              </p>
            </div>
            {error && <div className="p-3 rounded-[8px] bg-[#FFF1DC] text-[#9A4A00] text-xs font-medium">{error}</div>}
            <Field label="Password" htmlFor="inv-password" hint="12+ characters with upper and lower case, a number and a symbol">
              <Input id="inv-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirm password" htmlFor="inv-confirm">
              <Input id="inv-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <div className="flex items-center gap-2 text-xs text-[#5B6478]">
              <ShieldCheck className="w-4 h-4 text-[#0B6B4D]" />
              <span>Two-factor sign-in is required for every user.</span>
            </div>
            <Button type="submit" variant="primary" size="md" className="w-full" disabled={saving}>
              {saving ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        ) : (
          <div className="text-sm">
            {error ? <p className="text-[#9A4A00]">{error}</p> : <p className="text-[#5B6478]">Checking your invitation...</p>}
          </div>
        )}
      </div>
    </div>
  );
}
