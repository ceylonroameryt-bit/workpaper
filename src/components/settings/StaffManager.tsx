'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Pencil, Search, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { db } from '@/lib/server/db';

interface StaffRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: string;
  status: 'active' | 'deactivated';
  access: 'all' | 'limited';
  client_ids: string[] | null;
  client_count: number;
  mfa_enabled: boolean;
  last_login_at: string | null;
}

const ROLES: [string, string][] = [
  ['readonly', 'Can view assigned client files but not change anything'],
  ['preparer', 'Prepares working papers on assigned clients'],
  ['reviewer', 'Reviews and signs off prepared papers'],
  ['manager', 'Runs client files and manages the team’s work'],
  ['partner', 'Approves files; sees every client'],
  ['admin', 'Manages staff, settings and every client'],
];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "4 hours ago", "3 months ago" */
function ago(iso: string | null): string {
  if (!iso) return 'Never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const steps: [number, string][] = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
  let v = s;
  for (const [size, unit] of steps) {
    if (v < size) {
      const n = Math.max(1, Math.floor(v));
      return unit === 'second' ? 'Just now' : `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    }
    v /= size;
  }
  return '';
}

/**
 * Staff management (ADM-01): list with search and filters, and an edit panel for name, role,
 * client access and active/deactivated. Changes go through the server and are audited.
 */
export function StaffManager({ currentUserId }: { currentUserId: string }) {
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/users');
    const body = await res.json().catch(() => ({}));
    if (res.ok) setStaff(body.staff);
    else setError(body.error || 'Could not load staff.');
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const rows = (staff ?? []).filter(
    (s) =>
      (role === 'all' || s.role === role) &&
      (status === 'all' || s.status === status) &&
      (!q.trim() || `${s.name} ${s.email}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const select = 'min-h-[34px] px-2.5 text-xs bg-white border border-[#D3DCEE] rounded-[8px] text-[#122654]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search staff</span>
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7E8DA6]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className={`${select} pl-8 w-56`} />
        </label>
        <select aria-label="Role" className={select} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">Role: All</option>
          {ROLES.map(([r]) => (
            <option key={r} value={r}>{cap(r)}</option>
          ))}
        </select>
        <select aria-label="Status" className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#B42318] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      <div className="overflow-x-auto border border-[#E3E7EF] rounded-[12px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F5F8FD] text-[10px] font-bold uppercase tracking-wider text-[#4A5878]">
            <tr>
              <th className="py-2.5 px-4">Name</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Role</th>
              <th className="py-2.5 px-4">Access</th>
              <th className="py-2.5 px-4">Client files</th>
              <th className="py-2.5 px-4">Last login</th>
              <th className="py-2.5 px-4 sr-only">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EF] text-[#122654]">
            {!staff && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[#4A5878]">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading staff…
                </td>
              </tr>
            )}
            {staff && !rows.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[#4A5878]">No staff match these filters.</td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-[#F5F8FD]/70">
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-[#122654] text-white flex items-center justify-center font-bold text-[10px]">{s.initials || s.name.slice(0, 2).toUpperCase()}</span>
                    <span>
                      <span className="block font-bold">
                        {s.name}
                        {s.id === currentUserId && <span className="font-normal text-[#4A5878]"> (You)</span>}
                      </span>
                      <span className="block text-[11px] text-[#4A5878]">{s.email}</span>
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-[#E6F4EF] text-[#0B6B52]' : 'bg-[#F5F8FD] text-[#4A5878]'}`}>
                    {s.status === 'active' ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="py-2.5 px-4">{cap(s.role)}</td>
                <td className="py-2.5 px-4">{s.access === 'all' ? 'All clients' : 'Limited'}</td>
                <td className="py-2.5 px-4">{s.client_count}</td>
                <td className="py-2.5 px-4 text-[#4A5878]">{ago(s.last_login_at)}</td>
                <td className="py-2.5 px-4 text-right">
                  <button type="button" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`} className="p-1.5 rounded hover:bg-[#EEF2F9] text-[#1D4E89] cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <StaffEditor
          person={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function StaffEditor({ person, isSelf, onClose, onSaved }: { person: StaffRow; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(person.name);
  const [role, setRole] = useState(person.role);
  const [allClients, setAllClients] = useState(person.access === 'all');
  const [clientIds, setClientIds] = useState<string[]>(person.client_ids ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clients = db.clients.filter((c) => !c.archived_at);
  const seesAll = role === 'partner' || role === 'admin';

  const [resetLink, setResetLink] = useState('');
  const [copied, setCopied] = useState(false);

  const createResetLink = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/users/${encodeURIComponent(person.id)}/password-reset`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setResetLink(body.link);
      else setError(body.error || 'Could not create a reset link. Try again.');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/users/${encodeURIComponent(person.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error || 'Could not save. Try again.');
      else onSaved();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label={`Edit ${person.name}`}>
      <div className="w-full max-w-md h-full bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3E7EF]">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#122654]">{person.name}</h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${person.status === 'active' ? 'bg-[#E6F4EF] text-[#0B6B52]' : 'bg-[#F5F8FD] text-[#4A5878]'}`}>
              {person.status === 'active' ? 'Active' : 'Deactivated'}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#4A5878] hover:text-[#122654] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-xs text-[#122654]">
          <section className="space-y-3">
            <h3 className="text-sm font-bold">User details</h3>
            <label className="block font-semibold">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full min-h-[38px] px-3 border border-[#D3DCEE] rounded-[8px]" />
            </label>
            <label className="block font-semibold">
              Email
              <input value={person.email} readOnly className="mt-1 w-full min-h-[38px] px-3 border border-[#E3E7EF] rounded-[8px] bg-[#F5F8FD] text-[#4A5878]" />
              <span className="block font-normal text-[11px] text-[#7E8DA6] mt-1">The email is the sign-in name and can’t be changed here.</span>
            </label>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold">Role</h3>
            {isSelf && <p className="text-[11px] text-[#7E8DA6]">You can’t change your own role.</p>}
            {ROLES.map(([r, desc]) => (
              <label key={r} className={`flex items-start gap-2.5 p-2.5 rounded-[8px] border ${role === r ? 'border-[#1D4E89] bg-[#EEF2F9]' : 'border-[#E3E7EF]'}`}>
                <input type="radio" name="role" checked={role === r} disabled={isSelf} onChange={() => setRole(r)} className="mt-0.5" />
                <span>
                  <span className="block font-semibold">{cap(r)}</span>
                  <span className="block text-[11px] text-[#4A5878]">{desc}</span>
                </span>
              </label>
            ))}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold">Client file access</h3>
            {seesAll ? (
              <p className="text-[11px] text-[#4A5878]">Partners and admins see every client.</p>
            ) : (
              <>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={allClients} onChange={(e) => setAllClients(e.target.checked)} />
                  <span>Access to all {clients.length} client files</span>
                </label>
                {!allClients && (
                  <div className="border border-[#E3E7EF] rounded-[8px] divide-y divide-[#E3E7EF] max-h-56 overflow-y-auto">
                    {clients.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={clientIds.includes(c.id)}
                          onChange={() => setClientIds(clientIds.includes(c.id) ? clientIds.filter((x) => x !== c.id) : [...clientIds, c.id])}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))}
                    {!clients.length && <p className="px-3 py-2 text-[#4A5878]">No clients yet.</p>}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="space-y-1">
            <h3 className="text-sm font-bold">Authentication</h3>
            <p className="flex items-center gap-1.5">
              {person.mfa_enabled ? <ShieldCheck className="w-3.5 h-3.5 text-[#0B6B52]" /> : <ShieldOff className="w-3.5 h-3.5 text-[#6B4700]" />}
              Two-factor authentication {person.mfa_enabled ? 'is on' : 'is not set up yet'}
            </p>
            {resetLink ? (
              <div className="mt-2 p-2.5 rounded-[8px] bg-[#F5F8FD] border border-[#E3E7EF] space-y-1.5">
                <label htmlFor="reset-link" className="block font-semibold">Password reset link (works once, for one hour)</label>
                <div className="flex gap-1.5">
                  <input id="reset-link" readOnly value={resetLink} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 min-h-[34px] px-2 border border-[#D3DCEE] rounded-[6px] bg-white font-mono text-[11px]" />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(resetLink).then(() => setCopied(true))}
                    className="min-h-[34px] px-2.5 bg-[#122654] text-white font-bold rounded-[6px] cursor-pointer"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-[#4A5878]">Send it to {person.name} privately. Their current password keeps working until they use it.</p>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={createResetLink}
                className="mt-2 min-h-[34px] px-3 border border-[#D3DCEE] rounded-[8px] font-bold text-[#122654] hover:bg-[#F5F8FD] cursor-pointer disabled:opacity-60"
              >
                Create reset link
              </button>
            )}
          </section>

          {error && (
            <p role="alert" className="text-[11px] font-medium text-[#B42318] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-[#E3E7EF]">
          {!isSelf ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ status: person.status === 'active' ? 'deactivated' : 'active' })}
              className={`min-h-[36px] px-3 text-xs font-bold rounded-[8px] cursor-pointer disabled:opacity-60 ${person.status === 'active' ? 'bg-[#B42318] text-white' : 'bg-[#E6F4EF] text-[#0B6B52]'}`}
            >
              {person.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ name, ...(isSelf ? {} : { role }), client_ids: seesAll || allClients ? null : clientIds })}
            className="min-h-[36px] px-4 bg-[#122654] hover:bg-[#0B1A3B] text-white text-xs font-bold rounded-[8px] cursor-pointer disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
