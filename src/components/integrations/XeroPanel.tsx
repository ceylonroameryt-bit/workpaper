'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Link2, Loader2, RefreshCw, Unplug } from 'lucide-react';

interface Status {
  configured: boolean;
  connected: boolean;
  tenant_name: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
}

interface PullResult {
  lineCount: number;
  changes: { account_code: string; account_name: string; diff_p: string; direction: string }[];
  mapping: { by_rule: number; ready: number; check: number; exception: number };
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never';
const money = (p: string) => `£${(Math.abs(Number(p)) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

/**
 * Xero connection for one client (DAT-01): connect, pull the trial balance for an engagement,
 * reconnect when the link has expired, or disconnect. Tokens stay on the server.
 */
export function XeroPanel({ clientId, engagementId, reconnectNeeded }: { clientId: string; engagementId?: string; reconnectNeeded?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<'pull' | 'disconnect' | null>(null);
  const [error, setError] = useState('');
  const [needsReconnect, setNeedsReconnect] = useState(Boolean(reconnectNeeded));
  const [result, setResult] = useState<PullResult | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/integrations/xero/connection?clientId=${encodeURIComponent(clientId)}`);
    if (res.ok) setStatus(await res.json());
  }, [clientId]);

  useEffect(() => {
    load().catch(() => setError('Could not load the Xero connection.'));
  }, [load]);

  const connectHref = `/api/v1/integrations/xero/connect?clientId=${encodeURIComponent(clientId)}`;

  const pull = async () => {
    if (!engagementId) return;
    setBusy('pull');
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/v1/integrations/xero/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.code === 'XERO_RECONNECT') setNeedsReconnect(true);
        setError(body.error || 'The pull from Xero failed. Try again.');
        return;
      }
      setNeedsReconnect(false);
      setResult(body);
      load();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    setError('');
    try {
      const res = await fetch(`/api/v1/integrations/xero/connection?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Could not disconnect.');
      setResult(null);
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-[#E3E7EF] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#13B5EA] text-white text-[11px] font-extrabold flex items-center justify-center" aria-hidden="true">
            xero
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#102654]">Xero</h2>
            <p className="text-[11px] text-[#5B6478]">Pull the trial balance straight from the client&apos;s Xero.</p>
          </div>
        </div>
        {status?.connected && !needsReconnect && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-[#E6F4EF] text-[#0B6B52]">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        )}
      </div>

      {!status ? (
        <p className="text-xs text-[#5B6478] flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking connection…
        </p>
      ) : !status.configured ? (
        <div className="p-3 rounded-[10px] bg-[#FFF4DB] text-[11px] text-[#6B4700] leading-relaxed">
          Xero isn&apos;t set up for this practice yet. An admin adds the Xero app&apos;s credentials
          (<code className="font-mono">XERO_CLIENT_ID</code>, <code className="font-mono">XERO_CLIENT_SECRET</code>,{' '}
          <code className="font-mono">XERO_REDIRECT_URI</code>) to the server.
        </div>
      ) : needsReconnect ? (
        <div className="space-y-3">
          <div className="p-3 rounded-[10px] bg-[#FFF4DB] text-[11px] text-[#6B4700] flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>The Xero connection has expired or was revoked. Reconnect to keep pulling data.</span>
          </div>
          <a href={connectHref} className="inline-flex items-center gap-1.5 min-h-[38px] px-4 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-[10px]">
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect Xero
          </a>
        </div>
      ) : !status.connected ? (
        <div className="space-y-3">
          <p className="text-xs text-[#5B6478] leading-relaxed">
            You&apos;ll sign in to Xero and choose this client&apos;s organisation. Blynt only asks for read-only access.
          </p>
          <a href={connectHref} className="inline-flex items-center gap-1.5 min-h-[38px] px-4 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-[10px]">
            <Link2 className="w-3.5 h-3.5" /> Connect Xero
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-1 text-xs">
            <dt className="text-[#5B6478]">Organisation</dt>
            <dd className="font-semibold text-[#102654] truncate">{status.tenant_name}</dd>
            <dt className="text-[#5B6478]">Last pulled</dt>
            <dd className="text-[#102654]">{when(status.last_synced_at)}</dd>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            {engagementId ? (
              <button
                type="button"
                onClick={pull}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-4 bg-[#102654] hover:bg-[#0B1B3D] text-white text-xs font-bold rounded-[10px] cursor-pointer disabled:opacity-60"
              >
                {busy === 'pull' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {busy === 'pull' ? 'Pulling from Xero…' : 'Pull trial balance'}
              </button>
            ) : (
              <span className="text-[11px] text-[#5B6478]">Open an engagement to pull its trial balance.</span>
            )}
            <button
              type="button"
              onClick={disconnect}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 text-xs font-semibold text-[#5B6478] hover:text-[#B42318] rounded-[10px] cursor-pointer disabled:opacity-60"
            >
              <Unplug className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[11px] font-medium text-[#B42318] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="p-3.5 rounded-[10px] bg-[#E6F4EF] border border-[#0B6B52]/20 text-xs text-[#102654] space-y-2" role="status">
          <p className="font-semibold text-[#0B6B52]">
            {result.lineCount} accounts pulled from Xero. {result.mapping.by_rule} mapped by your rules, {result.mapping.ready} ready to confirm,{' '}
            {result.mapping.check} to check, {result.mapping.exception} to map by hand.
          </p>
          {result.changes.length > 0 ? (
            <div>
              <p className="font-semibold mb-1">Changed since the last pull</p>
              <ul className="space-y-0.5">
                {result.changes.slice(0, 6).map((c) => (
                  <li key={c.account_code}>
                    {c.account_code} {c.account_name}: {c.direction} by {money(c.diff_p)}
                  </li>
                ))}
                {result.changes.length > 6 && <li>…and {result.changes.length - 6} more</li>}
              </ul>
            </div>
          ) : (
            <p>No changes since the last pull.</p>
          )}
          {engagementId && (
            <Link href={`/engagements/${engagementId}/mapping`} className="inline-block font-semibold text-[#1D4E89] hover:underline">
              Review mapping
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
