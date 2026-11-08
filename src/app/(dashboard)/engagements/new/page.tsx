'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Zap } from 'lucide-react';
import { db } from '@/lib/server/db';
import { Client, CompanyType } from '@/lib/types/models';
import { packForClient } from '@/lib/workpapers/templates';
import { useCompany } from '@/context/CompanyContext';
import { companyNumberError, structureFields, structureForCompanyType, UK_POSTCODE, UK_VAT } from '@/lib/practice-structure';
import { Frequency, FREQUENCY_MONTHS, periodStart as startOf } from '@/lib/periods';
import { TeamManager } from '@/components/settings/TeamManager';
import { ukDate } from '@/lib/dates';

/**
 * New engagement wizard (ENG-01), in the same adaptive style as practice set-up: each answer
 * shows what it changes. Client details (which decide the working papers), the period, the
 * team, then the data source; choosing Xero or QuickBooks connects straight after creating.
 */

const STEPS = ['Client details', 'Period', 'Team', 'Data source'];

type Source = 'xero' | 'quickbooks' | 'csv';
const SOURCES: [Source, string, string][] = [
  ['xero', 'Xero', 'Connect now and pull the trial balance straight from Xero'],
  ['quickbooks', 'QuickBooks Online', 'Connect now and pull the trial balance from QuickBooks'],
  ['csv', 'Manual upload', 'Upload a trial balance as CSV or Excel after set-up'],
];

const COMPANY_TYPES: [CompanyType, string, string][] = [
  ['Small company (FRS 102 1A)', 'FRS 102 Section 1A', 'Small UK limited companies'],
  ['Micro-entity (FRS 105)', 'FRS 105', 'Micro-entities, minimal disclosures'],
  ['Medium/large (FRS 102)', 'FRS 102 Full', 'Medium and large companies'],
  ['Sole trader', 'UK GAAP (Cash/Accruals)', 'Self-employed individuals'],
  ['Partnership', 'UK GAAP', 'Partnerships and profit shares'],
  ['LLP (FRS 102 + LLP SORP)', 'FRS 102 + LLP SORP', 'Limited liability partnerships'],
  ['IFRS company/group', 'UK-adopted IFRS', 'Groups and listed companies'],
  ['Charity (SORP)', 'Charities SORP (FRS 102)', 'Charities and funds'],
  ['Academy trust', 'Academies Accounts Direction', 'Academy trusts'],
];

const NEW_CLIENT = '__new__';
const BLANK = { trading_name: '', company_no: '', address_line: '', postcode: '', jurisdiction: 'england_wales', vat_number: '' };
const detailsOf = (c?: Client) => ({ ...BLANK, ...Object.fromEntries(Object.entries(c ?? {}).filter(([k, v]) => k in BLANK && typeof v === 'string')) }) as typeof BLANK;

const inputCls =
  'w-full min-h-[42px] px-3 text-sm bg-white border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] focus:ring-2 focus:ring-[#FF7A66]/20 placeholder:text-[#9AA6BC]';

function Q({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-[#122654] mt-6 mb-2">
      {children}
    </label>
  );
}

function Card({ on, title, sub, onClick }: { on: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`relative text-left px-3.5 py-3 rounded-[10px] border transition-colors cursor-pointer ${
        on ? 'bg-[#EEF2F9] border-[#1D4E89] ring-1 ring-[#1D4E89]' : 'bg-white border-[#D3DCEE] hover:border-[#A6B4D0]'
      }`}
    >
      {on && <Check className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-[#1D4E89]" />}
      <span className="block text-sm font-semibold text-[#122654] pr-4">{title}</span>
      <span className="block text-[11px] text-[#4A5878] mt-0.5">{sub}</span>
    </button>
  );
}

function YesNo({ value, yes, no, onChange, label }: { value: boolean; yes: string; no: string; onChange: (v: boolean) => void; label: string }) {
  const pill = (on: boolean) => `text-xs font-semibold px-3.5 py-2 rounded-full border cursor-pointer ${on ? 'bg-[#122654] border-[#122654] text-white' : 'bg-white border-[#D3DCEE] text-[#122654]'}`;
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={value} className={pill(value)} onClick={() => onChange(true)}>{yes}</button>
      <button type="button" role="radio" aria-checked={!value} className={pill(!value)} onClick={() => onChange(false)}>{no}</button>
    </div>
  );
}

const FREQUENCIES: [Frequency, string, string][] = [
  ['year_end', 'Year-end', 'Annual accounts for the financial year'],
  ['quarterly', 'Quarterly', 'A file for each quarter'],
  ['monthly', 'Monthly', 'A file for each month'],
];
const END_LABEL: Record<Frequency, string> = { year_end: 'Year end', quarterly: 'Quarter end', monthly: 'Month end' };

export default function NewEngagementWizard() {
  const router = useRouter();
  const { setActiveCompanyId, refreshCompanyData } = useCompany();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeClients = db.clients.filter((c) => !c.archived_at);
  const [clientId, setClientId] = useState(activeClients[0]?.id ?? NEW_CLIENT);
  const existing = activeClients.find((c) => c.id === clientId);
  const [name, setName] = useState('');
  const [type, setType] = useState<CompanyType>(existing?.company_type ?? 'Small company (FRS 102 1A)');
  const [vat, setVat] = useState(existing?.vat_registered ?? true);
  const [payroll, setPayroll] = useState(existing?.payroll ?? true);
  const [details, setDetails] = useState(detailsOf(existing));
  const [yearEnd, setYearEnd] = useState('2026-03-31');
  const [frequency, setFrequency] = useState<Frequency>('year_end');
  const [periodStart, setPeriodStart] = useState(startOf('2026-03-31', 12));
  const [team, setTeam] = useState<string[]>(existing?.team_user_ids ?? []);
  // Invitations ticked for this client; null until the Team step has loaded them
  const [invited, setInvited] = useState<string[] | null>(null);
  const assigned = team.length + (invited?.length ?? 0);
  const [source, setSource] = useState<Source>('csv');

  const isNew = clientId === NEW_CLIENT;
  const clientName = isNew ? name.trim() : existing?.name ?? '';
  const framework = COMPANY_TYPES.find((t) => t[0] === type)?.[1] ?? '';
  const papers = packForClient({ company_type: type, vat_registered: vat, payroll });
  const prior = db.engagements.find((e) => e.client_id === clientId && e.status === 'locked');
  const sourceName = SOURCES.find((s) => s[0] === source)?.[1];
  const structure = structureForCompanyType(type);
  const sf = structureFields(structure);
  const crnError = sf.companyNumber && details.company_no.trim() ? companyNumberError(structure, details.company_no, details.jurisdiction) : '';
  const postcodeError = details.postcode.trim() && !UK_POSTCODE.test(details.postcode.trim().toUpperCase()) ? 'Enter a valid UK postcode.' : '';
  const vatError = vat && details.vat_number.trim() && !UK_VAT.test(details.vat_number.replace(/\s/g, '').toUpperCase()) ? 'Enter a valid UK VAT number.' : '';
  const setD = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDetails({ ...details, [k]: e.target.value });

  const pickClient = (id: string) => {
    setClientId(id);
    const c = activeClients.find((x) => x.id === id);
    setType(c?.company_type ?? 'Small company (FRS 102 1A)');
    setVat(c?.vat_registered ?? true);
    setPayroll(c?.payroll ?? true);
    setDetails(detailsOf(c));
    setTeam(c?.team_user_ids ?? []);
    setInvited(null);
  };
  const setEnd = (end: string, f = frequency) => {
    setYearEnd(end);
    if (end) setPeriodStart(startOf(end, FREQUENCY_MONTHS[f]));
  };

  const changes: string[][] = [
    [
      isNew ? `${clientName || 'A new client'} is added to your clients.` : `The engagement is added to ${clientName}, and its details are updated.`,
      `${papers.length} working papers are created under ${framework}.`,
      vat ? 'VAT control and returns (T-20) is included.' : 'No VAT paper (T-20): the client isn’t VAT registered.',
      payroll ? 'Payroll and PAYE/NIC (P-20) is included.' : 'No payroll paper (P-20): the client runs no payroll.',
    ],
    [
      periodStart && yearEnd ? `A ${FREQUENCIES.find((f) => f[0] === frequency)?.[1].toLowerCase()} file covering ${ukDate(periodStart)} to ${ukDate(yearEnd)}.` : '',
      yearEnd && periodStart && periodStart !== startOf(yearEnd, FREQUENCY_MONTHS[frequency]) ? 'This is a short or long period: the start date was changed by hand.' : '',
      prior ? 'Last year’s locked file is linked, so closing balances roll forward.' : 'First year for this client: no prior file to roll forward.',
    ].filter(Boolean),
    [assigned ? `${assigned} ${assigned === 1 ? 'person is' : 'people are'} assigned to ${clientName || 'this client'}.` : 'No one assigned yet. Partners and admins see every client.'],
    [source === 'csv' ? 'You’ll upload the trial balance after creating.' : `You’ll sign in to ${sourceName} after creating, and choose the client’s organisation.`],
  ];

  const go = (i: number) => {
    setError('');
    setStep(i);
    setFurthest((f) => Math.max(f, i));
  };

  const api = async (url: string, method: string, body: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Could not save. Try again.');
    return out;
  };

  const create = async () => {
    let id = clientId;
    if (isNew) id = (await api('/api/v1/clients', 'POST', { name: clientName, company_no: '', company_type: type, year_end: yearEnd, data_source: 'csv' })).id;
    // The profile saves the details and decides the papers; the engagement is then created from it
    try {
      await api(`/api/v1/clients/${encodeURIComponent(id)}`, 'PATCH', { ...details, company_type: type, year_end: yearEnd, vat_registered: vat, payroll, team_user_ids: team, ...(invited ? { team_invite_ids: invited } : {}) });
    } catch (e) {
      // Don't leave a half-made client behind when its details are refused
      if (isNew) await api(`/api/v1/clients/${encodeURIComponent(id)}/archive`, 'POST', { archived: true, reason: 'Set-up cancelled' }).catch(() => {});
      throw e;
    }
    const eng = await api('/api/v1/engagements', 'POST', {
      client_id: id,
      period_start: periodStart,
      period_end: yearEnd,
      framework,
      template_pack_id: `pack_${type.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      prior_engagement_id: prior?.id,
      frequency,
    });
    refreshCompanyData();
    setActiveCompanyId(id);
    // Straight on to the ledger sign-in; the callback brings the user back to the client page
    if (source === 'csv') router.push(`/engagements/${eng.id}/import`);
    else window.location.assign(`/api/v1/integrations/${source}/connect?clientId=${encodeURIComponent(id)}`);
  };

  const next = async () => {
    setError('');
    if (step === 0 && !clientName) return setError('Enter the client’s name.');
    if (step === 0 && (crnError || postcodeError || vatError)) return setError(crnError || postcodeError || vatError);
    if (step === 1 && (!periodStart || !yearEnd || periodStart >= yearEnd)) return setError(`Set a period start before the ${END_LABEL[frequency].toLowerCase()}.`);
    if (step < STEPS.length - 1) return go(step + 1);
    setSaving(true);
    try {
      await create();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto pb-16">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A5878] hover:text-[#122654]">
        <ChevronLeft className="w-4 h-4" /> Back to clients
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] rounded-xl overflow-hidden border border-[#E3E7EF] bg-white">
        {/* Step rail */}
        <aside className="bg-[#0B1A3B] text-white px-6 py-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF7A66]">New engagement</p>
          <p className="mt-2 text-xs text-[#A6B4D0] leading-relaxed">Four short steps. Each answer shows what it changes.</p>
          <ol className="mt-8 flex lg:flex-col gap-1 overflow-x-auto" aria-label="Steps">
            {STEPS.map((s, i) => {
              const done = i < step;
              const on = i === step;
              return (
                <li key={s} className="shrink-0">
                  <button
                    type="button"
                    disabled={i > furthest}
                    onClick={() => go(i)}
                    aria-current={on ? 'step' : undefined}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-[8px] text-left cursor-pointer disabled:cursor-default hover:enabled:bg-white/5"
                  >
                    <span
                      className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                        on ? 'bg-[#FF7A66] border-[#FF7A66] text-[#0B1A3B]' : done ? 'border-emerald-400/60 text-emerald-300' : 'border-white/20 text-[#7E8DA6]'
                      }`}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </span>
                    <span className={`hidden sm:block text-sm ${on ? 'font-bold text-white' : done ? 'text-[#D3DCEE]' : 'text-[#7E8DA6]'}`}>{s}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Step body */}
        <main className="px-4 sm:px-10 py-8 bg-[#F5F8FD]">
          <div className="max-w-[640px]">
            <p className="text-xs font-bold text-[#B8432F]">Step {step + 1} of {STEPS.length}</p>

            {step === 0 && (
              <>
                <h1 className="text-[28px] font-extrabold tracking-tight mt-1 text-[#122654]">Client details</h1>
                <p className="text-sm text-[#4A5878] mt-1">Who the client is. These answers decide the working papers.</p>
                <Q htmlFor="client">Client</Q>
                <select id="client" className={inputCls} value={clientId} onChange={(e) => pickClient(e.target.value)}>
                  {activeClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value={NEW_CLIENT}>+ Add a new client</option>
                </select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isNew && (
                    <div>
                      <Q htmlFor="name">{structure === 'sole' ? 'Full name' : sf.legalLabel}</Q>
                      <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={sf.legalPlaceholder} />
                    </div>
                  )}
                  <div>
                    <Q htmlFor="trading">{sf.tradingLabel}</Q>
                    <input id="trading" className={inputCls} value={details.trading_name} onChange={setD('trading_name')} placeholder="Optional" />
                  </div>
                </div>
                <Q>What kind of entity is it?</Q>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Entity type">
                  {COMPANY_TYPES.map(([k, , s]) => (
                    <Card key={k} on={type === k} title={k} sub={s} onClick={() => setType(k)} />
                  ))}
                </div>
                {sf.companyNumber && (
                  <div className="sm:w-1/2">
                    <Q htmlFor="crn">Companies House number</Q>
                    <input id="crn" className={inputCls} value={details.company_no} onChange={setD('company_no')} placeholder={sf.companyPlaceholder(details.jurisdiction)} aria-invalid={Boolean(crnError)} />
                    {crnError && <p className="text-xs text-[#B8432F] mt-1">{crnError}</p>}
                  </div>
                )}
                <Q>{sf.addressLabel}</Q>
                {postcodeError && <p className="text-xs text-[#B8432F] -mt-1 mb-2">{postcodeError}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
                  <input aria-label="Address" className={inputCls} value={details.address_line} onChange={setD('address_line')} placeholder="12 High Street, Leeds" />
                  <input aria-label="Postcode" className={inputCls} value={details.postcode} onChange={setD('postcode')} placeholder="LS1 4AB" aria-invalid={Boolean(postcodeError)} />
                  <select aria-label="Country" className={inputCls} value={details.jurisdiction} onChange={setD('jurisdiction')}>
                    <option value="england_wales">England and Wales</option>
                    <option value="scotland">Scotland</option>
                    <option value="northern_ireland">Northern Ireland</option>
                  </select>
                </div>
                <Q>Is it VAT registered?</Q>
                <YesNo label="VAT registered" value={vat} yes="VAT registered" no="Not registered" onChange={setVat} />
                {vat && (
                  <div className="sm:w-1/2">
                    <Q htmlFor="vat">VAT number</Q>
                    <input id="vat" className={inputCls} value={details.vat_number} onChange={setD('vat_number')} placeholder="GB123456789" aria-invalid={Boolean(vatError)} />
                    {vatError && <p className="text-xs text-[#B8432F] mt-1">{vatError}</p>}
                  </div>
                )}
                <Q>Does it run payroll?</Q>
                <YesNo label="Runs payroll" value={payroll} yes="Runs payroll" no="No payroll" onChange={setPayroll} />
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="text-[28px] font-extrabold tracking-tight mt-1 text-[#122654]">Period</h1>
                <p className="text-sm text-[#4A5878] mt-1">How often you prepare a file for this client, and the period it covers.</p>
                <Q>How often?</Q>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Frequency">
                  {FREQUENCIES.map(([k, title, sub]) => (
                    <Card
                      key={k}
                      on={frequency === k}
                      title={title}
                      sub={sub}
                      onClick={() => {
                        setFrequency(k);
                        setEnd(yearEnd, k);
                      }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Q htmlFor="year-end">{END_LABEL[frequency]}</Q>
                    <input id="year-end" type="date" className={inputCls} value={yearEnd} onChange={(e) => setEnd(e.target.value)} />
                  </div>
                  <div>
                    <Q htmlFor="period-start">Period start</Q>
                    <input id="period-start" type="date" className={inputCls} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                    <p className="text-[11px] text-[#7E8DA6] mt-1">Change it for a short or long first period.</p>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="text-[28px] font-extrabold tracking-tight mt-1 text-[#122654]">Team</h1>
                <p className="text-sm text-[#4A5878] mt-1">Tick who works on this client. Optional: you can change it later on the client page.</p>
                <TeamManager clientId={isNew ? undefined : clientId} clientName={clientName} team={team} setTeam={setTeam} invited={invited} setInvited={setInvited} />
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="text-[28px] font-extrabold tracking-tight mt-1 text-[#122654]">Data source</h1>
                <p className="text-sm text-[#4A5878] mt-1">Where the client’s books are.</p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Data source">
                  {SOURCES.map(([k, title, sub]) => (
                    <Card key={k} on={source === k} title={title} sub={sub} onClick={() => setSource(k)} />
                  ))}
                </div>
              </>
            )}

            {changes[step].length > 0 && (
              <div className="mt-8 flex gap-3 p-4 rounded-[12px] bg-[#EEF2F9] border border-[#1D4E89]/15">
                <Zap className="w-4 h-4 text-[#1D4E89] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#1D4E89] mb-1">What this changes in Blynt</p>
                  {changes[step].map((l) => (
                    <p key={l} className="text-xs text-[#122654] leading-relaxed">{l}</p>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-6 p-3 rounded-[10px] bg-[#FFF4DB] border border-[#6B4700]/20 text-[#6B4700] text-xs font-medium">
                {error}
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              {step > 0 && (
                <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-1.5 min-h-[42px] px-4 bg-white border border-[#D3DCEE] rounded-[10px] text-xs font-bold text-[#122654] hover:border-[#A6B4D0] cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                disabled={saving}
                className="inline-flex items-center gap-2 min-h-[42px] px-5 bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold text-xs rounded-[10px] cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Creating…' : step < STEPS.length - 1 ? 'Continue' : source === 'csv' ? 'Create engagement' : `Create and connect ${sourceName}`}
                {!saving && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
