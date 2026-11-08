'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, KeyRound } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AuthBrandPanel } from '@/components/layout/AuthBrandPanel';
import { BackupCodesList } from '@/components/settings/BackupCodes';

export default function MfaVerificationPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'setup' | 'verify'>('verify');
  const [enrolment, setEnrolment] = useState<{ secret: string; otpauth: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [remember, setRemember] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const [backupInput, setBackupInput] = useState('');
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

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

  const goToApp = () => {
    const from = new URLSearchParams(window.location.search).get('from');
    window.location.href = from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
  };

  const triggerVerification = async (code: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, remember }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        // First set-up: the codes are shown once, so stay here until they are saved
        if (body.backup_codes?.length) setNewCodes(body.backup_codes);
        else goToApp();
        return;
      }
      setErrorMessage(body.error || 'Verification failed. Please try again.');
      setDigits(['', '', '', '', '', '']);
      setBackupInput('');
      inputRefs.current[0]?.focus();
    } catch {
      setErrorMessage('Could not reach the server. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (useBackup) {
      if (!backupInput.trim()) return setErrorMessage('Enter one of your backup codes.');
      triggerVerification(backupInput);
      return;
    }
    const code = digits.join('');
    if (code.length < 6) {
      setErrorMessage('Please enter all 6 verification digits.');
      return;
    }
    triggerVerification(code);
  };

  if (newCodes) {
    return (
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F5F8FD] text-[#122654]">
        <AuthBrandPanel />
        <div className="lg:col-span-6 xl:col-span-7 bg-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
          <div className="max-w-[420px] w-full">
            <h2 className="text-2xl font-bold tracking-tight text-[#122654]">Save your backup codes</h2>
            <p className="text-xs text-[#4A5878] mt-1.5 mb-6">
              If you lose your phone, each code signs you in once. Keep them somewhere safe. They won&apos;t be shown again.
            </p>
            <BackupCodesList codes={newCodes} />
            <button
              type="button"
              onClick={goToApp}
              className="w-full min-h-[44px] mt-4 bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold text-xs rounded-[10px] shadow-sm cursor-pointer"
            >
              I&apos;ve saved these codes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F5F8FD] text-[#122654]">
      <AuthBrandPanel />

      <div className="lg:col-span-6 xl:col-span-7 bg-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
        <div className="max-w-[420px] w-full">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-[#122654]">
              {step === 'setup' ? 'Set up two-factor sign-in' : 'Two-factor authentication'}
            </h2>
            <p className="text-xs text-[#4A5878] mt-1.5">
              {step === 'setup'
                ? 'Two-factor sign-in is required. Scan the QR code with your authenticator app (Google Authenticator, Microsoft Authenticator or 1Password), then enter the 6-digit code it shows.'
                : useBackup
                  ? 'Enter one of the backup codes you saved. Each code works once.'
                  : 'Enter the 6-digit code from your authenticator app.'}
            </p>
          </div>

          {step === 'setup' && enrolment && (
            <div className="mb-6 p-4 bg-[#F5F8FD] border border-[#E3E7EF] rounded-[12px] flex flex-col sm:flex-row items-center gap-4">
              <div className="p-2 bg-white rounded-[10px] border border-[#D3DCEE] shrink-0">
                <QRCodeSVG
                  value={enrolment.otpauth}
                  size={148}
                  level="M"
                  fgColor="#0B1A3B"
                  title="QR code to add Blynt Workpapers to your authenticator app"
                />
              </div>
              <div className="text-xs min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-[#122654] mb-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Can&apos;t scan? Enter this key</span>
                </div>
                <code className="block font-mono text-[13px] tracking-wider break-all text-[#1D4E89] select-all">
                  {enrolment.secret.replace(/(.{4})/g, '$1 ').trim()}
                </code>
                <a href={enrolment.otpauth} className="inline-block mt-2 text-[#B8432F] font-semibold hover:underline">
                  Open in authenticator app on this device
                </a>
              </div>
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

          <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
            {useBackup ? (
              <div>
                <label htmlFor="backup-code" className="block text-xs font-semibold text-[#122654] mb-1.5">Backup code</label>
                <input
                  id="backup-code"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  spellCheck={false}
                  placeholder="xxxx-xxxx"
                  value={backupInput}
                  onChange={(e) => {
                    setErrorMessage('');
                    setBackupInput(e.target.value);
                  }}
                  className="w-full min-h-[44px] px-3.5 font-mono text-sm bg-[#F5F8FD] border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] focus:ring-2 focus:ring-[#FF7A66]/20"
                />
              </div>
            ) : (
            <div>
              <label className="block text-xs font-semibold text-[#122654] mb-1.5">6-digit security code</label>
              <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
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
                    className="w-12 h-12 text-center font-mono text-lg font-bold bg-[#F5F8FD] border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] focus:ring-2 focus:ring-[#FF7A66]/20"
                  />
                ))}
              </div>
            </div>
            )}

            <label className="flex items-center gap-2 text-xs text-[#122654] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#D3DCEE]"
              />
              <span>Remember this device for 30 days</span>
            </label>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full min-h-[44px] bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold text-xs rounded-[10px] shadow-sm transition-transform active:scale-[0.99] cursor-pointer mt-2 disabled:opacity-50"
            >
              {isVerifying ? 'Verifying…' : 'Verify & continue'}
            </button>

            {step === 'verify' && (
              <button
                type="button"
                onClick={() => {
                  setUseBackup(!useBackup);
                  setErrorMessage('');
                }}
                className="text-xs font-semibold text-[#B8432F] hover:underline self-center cursor-pointer"
              >
                {useBackup ? 'Use your authenticator app instead' : 'Use a backup code instead'}
              </button>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-[#E3E7EF] text-center text-xs text-[#4A5878]">
            <Link href="/login" className="hover:text-[#122654]">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
