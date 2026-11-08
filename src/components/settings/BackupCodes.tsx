'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

const actionClass = 'flex-1 min-h-[36px] px-3 text-xs font-bold text-[#122654] border border-[#D3DCEE] rounded-[8px] hover:bg-[#F5F8FD] cursor-pointer';

/** The plain codes, shown once, with copy and download. */
export function BackupCodesList({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  const download = () => {
    const url = URL.createObjectURL(new Blob([`Blynt Workpapers backup codes. Each code works once.\n\n${text}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blynt-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 bg-white border border-[#E3E7EF] rounded-[12px]">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[13px] text-[#122654] select-all">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))} className={actionClass}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={download} className={actionClass}>
          Download
        </button>
      </div>
    </div>
  );
}

/** Settings → Security: replaces the signed-in user's backup codes. */
export function BackupCodesCard() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/account/backup-codes', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setCodes(body.backup_codes);
      else setError(body.error || 'Could not create backup codes. Try again.');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 bg-[#F5F8FD] rounded-xl border border-[#E3E7EF] space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-bold text-[#122654]">Your backup codes</div>
          <div className="text-[11px] text-[#4A5878] mt-0.5">One-time codes to sign in if you lose your phone. New codes replace any old ones.</div>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="shrink-0 min-h-[36px] px-3 bg-[#122654] hover:bg-[#0B1A3B] text-white text-xs font-bold rounded-[8px] cursor-pointer disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create new backup codes'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[11px] font-medium text-[#B42318] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}
      {codes && (
        <>
          <p className="text-[11px] font-semibold text-[#6B4700]">Save these now. They won&apos;t be shown again.</p>
          <BackupCodesList codes={codes} />
        </>
      )}
    </div>
  );
}
