'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';
import { packForClient } from '@/lib/workpapers/templates';
import { Client, CompanyType } from '@/lib/types/models';

const COMPANY_TYPES: CompanyType[] = [
  'Sole trader',
  'Partnership',
  'LLP (FRS 102 + LLP SORP)',
  'Micro-entity (FRS 105)',
  'Small company (FRS 102 1A)',
  'Medium/large (FRS 102)',
  'IFRS company/group',
  'Charity (SORP)',
  'Academy trust',
];
const VAT_SCHEMES: [NonNullable<Client['vat_scheme']>, string][] = [
  ['standard', 'Standard'],
  ['flat_rate', 'Flat rate'],
  ['cash', 'Cash accounting'],
  ['annual', 'Annual accounting'],
];
const SERVICES: [NonNullable<Client['services']>[number], string][] = [
  ['year_end', 'Year-end accounts'],
  ['management', 'Management accounts'],
  ['vat', 'VAT returns'],
  ['payroll', 'Payroll'],
  ['quarterly', 'Quarterly insight packs'],
  ['corporation_tax', 'Corporation tax'],
];
const SIGNOFF: [string, string][] = [
  ['', 'Practice default'],
  ['1', 'Preparer only'],
  ['2', 'Preparer and reviewer'],
  ['3', 'Plus partner approval'],
];

const inputCls = 'w-full min-h-[38px] px-3 text-xs bg-white border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#1D4E89]';
const pill = (on: boolean) =>
  `text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer ${on ? 'bg-[#122654] border-[#122654] text-white' : 'bg-white border-[#D3DCEE] text-[#122654]'}`;

interface PaperChanges {
  engagement_id: string;
  added: string[];
  removed: string[];
  kept: string[];
}

/**
 * Client profile (Build Order step 2): entity type, company number, year end, VAT, payroll,
 * services, sign-off and team. Saving it decides which working papers the client's open
 * engagements carry; papers someone has started are never removed.
 */
export function ClientProfileForm({ client }: { client: Client }) {
  const { refreshCompanyData } = useCompany();
  const [f, setF] = useState({
    company_type: (client.company_type ?? 'Small company (FRS 102 1A)') as CompanyType,
    company_no: client.company_no ?? '',
    year_end: client.year_end ?? '',
    vat_registered: client.vat_registered ?? true,
    vat_scheme: client.vat_scheme ?? 'standard',
    payroll: client.payroll ?? true,
    services: client.services ?? ['year_end'],
    signoff_levels: client.signoff_levels ? String(client.signoff_levels) : '',
    team_user_ids: client.team_user_ids ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PaperChanges[] | null>(null);

  const team = db.users.filter((u) => db.memberships.some((m) => m.user_id === u.id && m.firm_id === client.firm_id));
  const roleOf = (userId: string) => db.memberships.find((m) => m.user_id === userId)?.role;
  const paperCount = packForClient(f).length;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/v1/clients/${encodeURIComponent(client.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, signoff_levels: f.signoff_levels ? Number(f.signoff_levels) : null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Could not save the profile. Try again.');
        return;
      }
      setResult(body.papers ?? []);
      refreshCompanyData();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const changed = result?.filter((p) => p.added.length || p.removed.length || p.kept.length) ?? [];

  return (
    <div className="bg-white border border-[#E3E7EF] rounded-xl shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-[#E3E7EF] pb-3">
        <div>
          <h2 className="text-sm font-bold text-[#122654]">Client profile</h2>
          <p className="text-[11px] text-[#4A5878]">These answers decide the working papers for this client: {paperCount} papers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-[11px] font-semibold text-[#4A5878] sm:col-span-1">
          Entity type and standard
          <select className={`${inputCls} mt-1`} value={f.company_type} onChange={(e) => setF({ ...f, company_type: e.target.value as CompanyType })}>
            {COMPANY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-[#4A5878]">
          Company number
          <input className={`${inputCls} mt-1`} value={f.company_no} onChange={(e) => setF({ ...f, company_no: e.target.value })} placeholder="01234567" />
        </label>
        <label className="text-[11px] font-semibold text-[#4A5878]">
          Year end
          <input className={`${inputCls} mt-1`} value={f.year_end} onChange={(e) => setF({ ...f, year_end: e.target.value })} placeholder="2026-03-31" />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-[#4A5878]">VAT</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="VAT registered">
          <button type="button" role="radio" aria-checked={f.vat_registered} className={pill(f.vat_registered)} onClick={() => setF({ ...f, vat_registered: true })}>VAT registered</button>
          <button type="button" role="radio" aria-checked={!f.vat_registered} className={pill(!f.vat_registered)} onClick={() => setF({ ...f, vat_registered: false })}>Not registered</button>
          {f.vat_registered && (
            <select aria-label="VAT scheme" className={`${inputCls} w-auto`} value={f.vat_scheme} onChange={(e) => setF({ ...f, vat_scheme: e.target.value as Client['vat_scheme'] & string })}>
              {VAT_SCHEMES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-[#4A5878]">Payroll</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Runs payroll">
          <button type="button" role="radio" aria-checked={f.payroll} className={pill(f.payroll)} onClick={() => setF({ ...f, payroll: true })}>Runs payroll</button>
          <button type="button" role="radio" aria-checked={!f.payroll} className={pill(!f.payroll)} onClick={() => setF({ ...f, payroll: false })}>No payroll</button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-[#4A5878]">Services you provide</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Services">
          {SERVICES.map(([k, l]) => (
            <button key={k} type="button" role="checkbox" aria-checked={f.services.includes(k)} className={pill(f.services.includes(k))} onClick={() => setF({ ...f, services: toggle(f.services, k) })}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-[11px] font-semibold text-[#4A5878]">
          Sign-off
          <select className={`${inputCls} mt-1`} value={f.signoff_levels} onChange={(e) => setF({ ...f, signoff_levels: e.target.value })}>
            {SIGNOFF.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <p className="text-[11px] font-semibold text-[#4A5878] mb-1">Team</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Team">
            {team.map((u) => (
              <button key={u.id} type="button" role="checkbox" aria-checked={f.team_user_ids.includes(u.id)} className={pill(f.team_user_ids.includes(u.id))} onClick={() => setF({ ...f, team_user_ids: toggle(f.team_user_ids, u.id) })}>
                {u.name} <span className="opacity-70">({roleOf(u.id)})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={busy || Boolean(client.archived_at)}
          className="inline-flex items-center gap-1.5 min-h-[38px] px-4 bg-[#122654] hover:bg-[#0B1A3B] text-white text-xs font-bold rounded-[10px] cursor-pointer disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save profile
        </button>
        <span className="text-[11px] text-[#7E8DA6]">Open engagements update to match. Papers already started are kept.</span>
      </div>

      {error && (
        <p role="alert" className="text-[11px] font-medium text-[#B42318] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}
      {result && (
        <div role="status" className="p-3 rounded-[10px] bg-[#E6F4EF] border border-[#0B6B52]/20 text-xs text-[#122654] space-y-1">
          <p className="font-semibold text-[#0B6B52] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Profile saved.
            {!changed.length && ' The working papers already match.'}
          </p>
          {changed.map((p) => (
            <p key={p.engagement_id}>
              {p.engagement_id}: {p.added.length ? `added ${p.added.join(', ')}. ` : ''}
              {p.removed.length ? `removed ${p.removed.join(', ')}. ` : ''}
              {p.kept.length ? `kept ${p.kept.join(', ')} (work already started).` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
