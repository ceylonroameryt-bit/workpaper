'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, Copy, FlaskConical, Pencil, Plus, TableProperties, X, Zap } from 'lucide-react';
import { BlyntLogo } from '@/components/ui/BlyntLogo';
import { db } from '@/lib/server/db';

/**
 * Practice set-up wizard, shown once after firm sign-up (adaptive: each answer shows what it
 * changes, and follow-up questions appear only when they apply).
 * Steps 1-3 are required and saved to the firm; 4-5 can be skipped; 6 reviews and finishes.
 */

const STEPS = ['Your practice', 'Your work', 'How you review', 'Your team', 'First clients', 'Review'];

const STRUCTURES: [string, string, string][] = [
  ['llp', 'LLP', 'Registered at Companies House'],
  ['ltd', 'Limited company', 'Registered at Companies House'],
  ['partnership', 'Partnership', 'Not on the register'],
  ['sole', 'Sole practitioner', 'Not on the register'],
];
const REGULATORS = ['ICAEW', 'ACCA', 'ICAS', 'CAI', 'AAT', 'CIMA', 'ATT', 'CIOT'];
const STANDARDS: [string, string, string][] = [
  ['FRS 105', 'FRS 105', 'Micro-entities'],
  ['FRS 102 1A', 'FRS 102 1A', 'Small companies'],
  ['FRS 102', 'FRS 102', 'Medium and large'],
  ['IFRS', 'IFRS', 'Groups and listed'],
  ['Charities SORP', 'Charities SORP', 'Charities'],
];
const SERVICES: [string, string][] = [
  ['year_end', 'Year-end accounts'],
  ['management', 'Management accounts'],
  ['vat', 'VAT returns'],
  ['payroll', 'Payroll'],
  ['quarterly', 'Quarterly insight packs'],
  ['corporation_tax', 'Corporation tax'],
];
const SOFTWARE: [string, string][] = [
  ['xero', 'Xero'],
  ['qbo', 'QuickBooks'],
  ['sage', 'Sage'],
  ['freeagent', 'FreeAgent'],
  ['spreadsheets', 'Spreadsheets'],
];
const SIGNOFF: [number, string, string][] = [
  [1, 'Preparer only', 'One person signs each schedule'],
  [2, 'Preparer and reviewer', 'A second person reviews'],
  [3, 'Plus partner approval', 'Partner approves the file'],
];
const ROLES = ['preparer', 'reviewer', 'manager', 'partner', 'admin'];
const STANDARD_TO_TYPE: Record<string, string> = {
  'FRS 105': 'Micro-entity (FRS 105)',
  'FRS 102 1A': 'Small company (FRS 102 1A)',
  'FRS 102': 'Medium/large (FRS 102)',
};
const label = (list: [string | number, string, ...string[]][], key: string | number) => list.find((x) => x[0] === key)?.[1] ?? String(key);

const inputCls =
  'w-full min-h-[42px] px-3 text-sm bg-white border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B] focus:ring-2 focus:ring-[#FF7D6B]/20 placeholder:text-[#9AA6BC]';

function Q({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-[#102654] mt-6 mb-2">
      {children}
      {required && <span className="text-[#B8432F]"> *</span>}
    </label>
  );
}

/** Pill toggles: one or many choices from a short list. */
function Pills<T extends string | number>({ options, value, onChange, multi }: { options: [T, string][]; value: T[]; onChange: (v: T[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" role={multi ? 'group' : 'radiogroup'}>
      {options.map(([key, text]) => {
        const on = value.includes(key);
        return (
          <button
            key={String(key)}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== key) : [...value, key]) : [key])}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors cursor-pointer ${
              on ? 'bg-[#102654] border-[#102654] text-white' : 'bg-white border-[#D5DBE7] text-[#102654] hover:border-[#A6B4D0]'
            }`}
          >
            {multi && on && <Check className="w-3.5 h-3.5" />}
            {text}
          </button>
        );
      })}
    </div>
  );
}

/** Option cards: a choice with a one-line explanation. */
function Cards<T extends string | number>({ options, value, onChange, multi, cols = 3 }: { options: [T, string, string][]; value: T[]; onChange: (v: T[]) => void; multi?: boolean; cols?: 2 | 3 | 4 }) {
  const grid = cols === 4 ? 'sm:grid-cols-4' : cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 ${grid} gap-2.5`} role={multi ? 'group' : 'radiogroup'}>
      {options.map(([key, title, sub]) => {
        const on = value.includes(key);
        return (
          <button
            key={String(key)}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== key) : [...value, key]) : [key])}
            className={`relative text-left px-3.5 py-3 rounded-[10px] border transition-colors cursor-pointer ${
              on ? 'bg-[#EEF3FD] border-[#1D4E89] ring-1 ring-[#1D4E89]' : 'bg-white border-[#D5DBE7] hover:border-[#A6B4D0]'
            }`}
          >
            {on && <Check className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-[#1D4E89]" />}
            <span className="block text-sm font-semibold text-[#102654] pr-4">{title}</span>
            <span className="block text-[11px] text-[#5B6478] mt-0.5">{sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/** "What this changes in Blynt": the effect of this step's answers, in plain words. */
function Changes({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="mt-8 flex gap-3 p-4 rounded-[12px] bg-[#EEF3FD] border border-[#1D4E89]/15">
      <Zap className="w-4 h-4 text-[#1D4E89] shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#1D4E89] mb-1">What this changes in Blynt</p>
        {lines.map((l) => (
          <p key={l} className="text-xs text-[#102654] leading-relaxed">{l}</p>
        ))}
      </div>
    </div>
  );
}

interface Invitee {
  email: string;
  name: string;
  role: string;
  link?: string;
  error?: string;
}

export default function OnboardingPage() {
  const [loaded, setLoaded] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [profile, setProfile] = useState({
    legal_name: '',
    trading_name: '',
    structure: 'llp',
    company_number: '',
    address_line: '',
    postcode: '',
    jurisdiction: 'england_wales',
    regulator: '',
    registration_number: '',
    vat_registered: true,
    vat_number: '',
    phone: '',
  });
  const [work, setWork] = useState({
    standards: ['FRS 105', 'FRS 102 1A'] as string[],
    services: ['year_end', 'corporation_tax'] as string[],
    software: [] as string[],
    client_count: '1-50',
    team_size: '2-10',
  });
  const [defaults, setDefaults] = useState({
    year_end: 'per_client',
    standard: 'FRS 102 1A',
    tolerance: '1.00',
    review_threshold: '500.00',
    signoff_levels: 2,
  });
  const [invitees, setInvitees] = useState<Invitee[]>([{ email: '', name: '', role: 'preparer' }]);
  const [clientChoice, setClientChoice] = useState<'sample' | 'csv' | 'manual'>('sample');
  const [csvRows, setCsvRows] = useState<{ name: string; company_no: string; year_end: string }[]>([]);
  const [csvError, setCsvError] = useState('');

  useEffect(() => {
    fetch('/api/v1/firm/onboarding')
      .then((r) => r.json())
      .then((d) => {
        if (d.onboarding?.completed_at) {
          window.location.href = '/';
          return;
        }
        setCanEdit(Boolean(d.can_edit));
        const at = Math.min(d.onboarding?.step ?? 0, STEPS.length - 1);
        setStep(at);
        setFurthest(at);
        if (d.profile) setProfile((p) => ({ ...p, ...d.profile, vat_registered: d.profile.vat_registered !== false }));
        else setProfile((p) => ({ ...p, legal_name: d.firm_name || '' }));
        if (d.work) setWork(d.work);
        if (d.defaults) {
          setDefaults({
            year_end: d.defaults.year_end,
            standard: d.defaults.standard,
            tolerance: (Number(d.defaults.tolerance_p) / 100).toFixed(2),
            review_threshold: (Number(d.defaults.review_threshold_p) / 100).toFixed(2),
            signoff_levels: d.defaults.signoff_levels,
          });
        }
        setLoaded(true);
      })
      .catch(() => {
        setError('Could not load your practice. Refresh to try again.');
        setLoaded(true);
      });
  }, []);

  const p = profile;
  const onRegister = p.structure === 'llp' || p.structure === 'ltd';
  const setP = (k: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setProfile({ ...p, [k]: e.target.value });
  const money = (s: string) => `£${Number(s || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pendingInvites = invitees.filter((r) => r.email.trim() && !r.link);
  const sentInvites = invitees.filter((r) => r.link);

  // Plain-English effect of each step's answers
  const changes: string[][] = [
    [
      `${p.trading_name || p.legal_name || 'Your practice'} becomes your practice name across Blynt.`,
      p.regulator ? `${p.regulator} is recorded as your supervisory body.` : '',
      onRegister ? 'Your Companies House number is kept with your practice record.' : 'You won’t be asked for a Companies House number.',
      p.vat_registered ? 'Your VAT number is kept with your practice details.' : 'No VAT number is stored for your practice.',
    ].filter(Boolean),
    [
      `Your practice profile records ${work.standards.length} reporting standard${work.standards.length === 1 ? '' : 's'}: ${work.standards.join(', ') || 'none yet'}.`,
      work.software.length ? `You told us clients keep books in ${work.software.map((s) => label(SOFTWARE, s)).join(', ')}.` : 'You can add bookkeeping software later.',
      'Change these any time in Settings.',
    ],
    [
      `New clients you add here start on ${defaults.standard}.`,
      `Your tolerance is ${money(defaults.tolerance)} and your review threshold is ${money(defaults.review_threshold)}.`,
      `Sign-off level saved: ${label(SIGNOFF, defaults.signoff_levels).toLowerCase()}.`,
      'Every AI suggestion still needs a person’s click until it proves 90% accuracy for three months.',
    ],
    sentInvites.length
      ? [`${sentInvites.length} invitation link${sentInvites.length === 1 ? '' : 's'} created. Send each link to the person; it lasts 7 days.`]
      : pendingInvites.length
        ? [`${pendingInvites.length} invitation link${pendingInvites.length === 1 ? '' : 's'} will be created when you continue.`]
        : ['You can invite your team later from Settings.'],
    clientChoice === 'sample'
      ? ['You’ll open the sample company file, with a mapped trial balance and working papers ready to explore.']
      : clientChoice === 'csv'
        ? [csvRows.length ? `${csvRows.length} clients will be added on ${defaults.standard}.` : 'Upload a CSV and each row becomes a client.']
        : ['You’ll go to Clients to add your first one.'],
    [],
  ];

  const go = (i: number) => {
    setError('');
    setStep(i);
    setFurthest((f) => Math.max(f, i));
  };

  const saveStep = async (i: number, data: unknown) => {
    const res = await fetch('/api/v1/firm/onboarding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: i, data }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not save. Try again.');
  };

  const sendInvites = async () => {
    const next = [...invitees];
    for (let i = 0; i < next.length; i++) {
      const r = next[i];
      if (!r.email.trim() || r.link) continue;
      const res = await fetch('/api/v1/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: r.email.trim(), name: r.name.trim() || r.email.split('@')[0], role: r.role }),
      });
      const body = await res.json().catch(() => ({}));
      next[i] = res.ok ? { ...r, link: body.link, error: undefined } : { ...r, error: body.error || 'Could not invite' };
    }
    setInvitees(next);
    return next.every((r) => !r.email.trim() || r.link);
  };

  const finish = async () => {
    let dest = '/';
    if (clientChoice === 'csv') {
      if (!csvRows.length) throw new Error('Upload a client list, or go back and choose another option.');
      for (const c of csvRows) {
        const res = await fetch('/api/v1/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: c.name, company_no: c.company_no, year_end: c.year_end, company_type: STANDARD_TO_TYPE[defaults.standard], data_source: 'csv' }),
        });
        if (!res.ok) throw new Error(`Could not add ${c.name}. Check the file and try again.`);
      }
      dest = '/clients';
    } else if (clientChoice === 'manual') {
      dest = '/clients';
    } else {
      const sample = db.engagements[0];
      dest = sample ? `/engagements/${sample.id}` : '/';
    }
    const res = await fetch('/api/v1/firm/onboarding/complete', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not finish set-up.');
    // Full reload so the workspace picks up the new practice settings
    window.location.href = dest;
  };

  const handleNext = async () => {
    setError('');
    if (step === 0) {
      const missing = !p.legal_name.trim() || !p.regulator || !p.address_line.trim() || !p.postcode.trim() || (onRegister && !p.company_number.trim()) || (p.vat_registered && !p.vat_number.trim());
      if (missing) {
        setError('Fill in the questions marked *.');
        return;
      }
    }
    if (step === 1 && (!work.standards.length || !work.services.length)) {
      setError('Choose at least one standard and one service.');
      return;
    }
    if (step === 4 && clientChoice === 'csv' && !csvRows.length) {
      setError('Upload a client list, or choose another option.');
      return;
    }
    setSaving(true);
    try {
      if (step === 0) await saveStep(0, p);
      else if (step === 1) await saveStep(1, work);
      else if (step === 2) await saveStep(2, defaults);
      else if (step === 3) {
        if (!(await sendInvites())) {
          setError('Some invitations could not be created. Fix them or remove the row.');
          return;
        }
        await saveStep(3, {});
      } else if (step === 4) await saveStep(4, {});
      else {
        await finish();
        return;
      }
      go(step + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const parseCsv = async (file: File) => {
    setCsvError('');
    const lines = (await file.text()).split(/\r?\n/).filter((l) => l.trim());
    const header = (lines.shift() || '').toLowerCase().split(',').map((h) => h.trim());
    const ni = header.findIndex((h) => h.includes('name'));
    const ci = header.findIndex((h) => h.includes('company') && (h.includes('number') || h.includes('no')));
    const yi = header.findIndex((h) => h.includes('year'));
    if (ni < 0) {
      setCsvError('The file needs a "name" column.');
      setCsvRows([]);
      return;
    }
    const rows = lines
      .map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
      .filter((c) => c[ni])
      .map((c) => ({ name: c[ni], company_no: ci >= 0 ? c[ci] || '' : '', year_end: yi >= 0 ? c[yi] || '' : '' }));
    if (!rows.length) setCsvError('No clients found in that file.');
    if (rows.length > 500) {
      setCsvError('Upload up to 500 clients at a time.');
      setCsvRows([]);
      return;
    }
    setCsvRows(rows);
  };

  if (!loaded) return <div className="min-h-screen flex items-center justify-center text-sm text-[#5B6478]">Loading your practice…</div>;

  if (!canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md bg-white border border-[#D5DBE7] rounded-[14px] p-8 text-sm">
          <p className="font-bold text-[#102654] mb-2">Your practice is still being set up</p>
          <p className="text-[#5B6478] mb-4">A practice admin or partner will finish set-up. You can start working in the meantime.</p>
          <a href="/" className="text-[#1D4E89] font-semibold hover:underline">Go to dashboard</a>
        </div>
      </div>
    );
  }

  const reviewRows: [string, string, number][] = [
    ['Practice', `${p.trading_name || p.legal_name} · ${label(STRUCTURES, p.structure)}${onRegister && p.company_number ? ` · ${p.company_number}` : ''}`, 0],
    ['Registered office', `${p.address_line}, ${p.postcode.toUpperCase()}`, 0],
    ['Regulation', `${p.regulator}${p.registration_number ? ` · ${p.registration_number}` : ''} · ${p.vat_registered ? `VAT ${p.vat_number}` : 'Not VAT registered'}`, 0],
    ['Standards', work.standards.join(', '), 1],
    ['Services', work.services.map((s) => label(SERVICES, s)).join(', '), 1],
    ['Defaults', `${defaults.standard} · tolerance ${money(defaults.tolerance)} · review over ${money(defaults.review_threshold)}`, 2],
    ['Sign-off', label(SIGNOFF, defaults.signoff_levels), 2],
    ['Team', sentInvites.length ? sentInvites.map((r) => `${r.email} (${r.role})`).join(', ') : 'No one invited yet', 3],
    ['First clients', clientChoice === 'sample' ? 'Sample company' : clientChoice === 'csv' ? `${csvRows.length} from CSV` : 'Add by hand', 4],
  ];

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] bg-[#F6F7FB] text-[#102654]">
      {/* Step rail */}
      <aside className="bg-[#0B1B3D] text-white px-6 py-8 lg:min-h-screen flex flex-col">
        <BlyntLogo variant="full" theme="dark" size="md" />
        <p className="mt-10 text-[11px] font-bold uppercase tracking-wider text-[#FF7D6B]">Set up your practice</p>
        <p className="mt-2 text-xs text-[#A6B4D0] leading-relaxed">Six short steps. Each answer shows what it changes in Blynt.</p>
        <ol className="mt-8 flex lg:flex-col gap-1 overflow-x-auto" aria-label="Set-up steps">
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
                      on ? 'bg-[#FF7D6B] border-[#FF7D6B] text-[#0B1B3D]' : done ? 'border-emerald-400/60 text-emerald-300' : 'border-white/20 text-[#7E8DA6]'
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className={`hidden sm:block text-sm ${on ? 'font-bold text-white' : done ? 'text-[#D5DBE7]' : 'text-[#7E8DA6]'}`}>{s}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="hidden lg:block mt-auto pt-8">
          <div className="p-4 rounded-[10px] bg-white/5 border border-white/10 text-xs text-[#A6B4D0] leading-relaxed">
            You can change any of these answers later in Settings. Turning something off never deletes your records.
          </div>
        </div>
      </aside>

      {/* Step body */}
      <main className="px-4 sm:px-10 lg:px-14 py-10">
        <div className="max-w-[720px]">
          <p className="text-xs font-bold text-[#B8432F]">Step {step + 1} of {STEPS.length}</p>

          {step === 0 && (
            <>
              <h1 className="text-[28px] font-extrabold tracking-tight mt-1">Your practice</h1>
              <p className="text-sm text-[#5B6478] mt-1">How your practice appears on statutory accounts and client packs.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Q htmlFor="legal" required>Legal name</Q>
                  <input id="legal" className={inputCls} value={p.legal_name} onChange={setP('legal_name')} placeholder="Wright and Co LLP" />
                </div>
                <div>
                  <Q htmlFor="trading">Trading name</Q>
                  <input id="trading" className={inputCls} value={p.trading_name} onChange={setP('trading_name')} placeholder="Wright Accountants" />
                </div>
              </div>
              <Q required>How is your practice set up?</Q>
              <Cards cols={4} options={STRUCTURES} value={[p.structure]} onChange={(v) => setProfile({ ...p, structure: v[0] })} />
              {onRegister && (
                <div className="sm:w-1/2">
                  <Q htmlFor="crn" required>Companies House number</Q>
                  <input id="crn" className={inputCls} value={p.company_number} onChange={setP('company_number')} placeholder={p.structure === 'llp' ? 'OC123456' : '12345678'} />
                </div>
              )}
              <Q required>Who supervises your practice?</Q>
              <Pills options={REGULATORS.map((r) => [r, r] as [string, string])} value={[p.regulator]} onChange={(v) => setProfile({ ...p, regulator: v[0] })} />
              {p.regulator && (
                <div className="sm:w-1/2">
                  <Q htmlFor="regno">{p.regulator} firm number</Q>
                  <input id="regno" className={inputCls} value={p.registration_number} onChange={setP('registration_number')} placeholder="C001234567" />
                </div>
              )}
              <Q required>Registered office</Q>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
                <input aria-label="Address" className={inputCls} value={p.address_line} onChange={setP('address_line')} placeholder="12 High Street, Leeds" />
                <input aria-label="Postcode" className={inputCls} value={p.postcode} onChange={setP('postcode')} placeholder="LS1 4AB" />
                <select aria-label="Country" className={inputCls} value={p.jurisdiction} onChange={setP('jurisdiction')}>
                  <option value="england_wales">England and Wales</option>
                  <option value="scotland">Scotland</option>
                  <option value="northern_ireland">Northern Ireland</option>
                </select>
              </div>
              <Q>Is your practice VAT registered?</Q>
              <Pills options={[[1, 'Yes, VAT registered'], [0, 'Not registered']]} value={[p.vat_registered ? 1 : 0]} onChange={(v) => setProfile({ ...p, vat_registered: v[0] === 1 })} />
              {p.vat_registered && (
                <div className="sm:w-1/2">
                  <Q htmlFor="vat" required>VAT number</Q>
                  <input id="vat" className={inputCls} value={p.vat_number} onChange={setP('vat_number')} placeholder="GB123456789" />
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[28px] font-extrabold tracking-tight mt-1">Your work</h1>
              <p className="text-sm text-[#5B6478] mt-1">The standards and services your practice covers.</p>
              <Q required>Which standards do you prepare accounts under?</Q>
              <Cards multi options={STANDARDS} value={work.standards} onChange={(v) => setWork({ ...work, standards: v })} />
              <Q required>Which services do you offer?</Q>
              <Pills multi options={SERVICES} value={work.services} onChange={(v) => setWork({ ...work, services: v })} />
              <Q>Where do your clients keep their books?</Q>
              <Pills multi options={SOFTWARE} value={work.software} onChange={(v) => setWork({ ...work, software: v })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <div>
                  <Q>How many clients?</Q>
                  <Pills options={[['1-50', '1 to 50'], ['51-200', '51 to 200'], ['201-500', '201 to 500'], ['500+', '500+']]} value={[work.client_count]} onChange={(v) => setWork({ ...work, client_count: v[0] })} />
                </div>
                <div>
                  <Q>How big is your team?</Q>
                  <Pills options={[['1', 'Just me'], ['2-10', '2 to 10'], ['11-50', '11 to 50'], ['50+', '50+']]} value={[work.team_size]} onChange={(v) => setWork({ ...work, team_size: v[0] })} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-[28px] font-extrabold tracking-tight mt-1">How you review</h1>
              <p className="text-sm text-[#5B6478] mt-1">Defaults every new client starts with.</p>
              <Q>Who signs off each schedule?</Q>
              <Cards options={SIGNOFF} value={[defaults.signoff_levels]} onChange={(v) => setDefaults({ ...defaults, signoff_levels: v[0] })} />
              <Q>Default standard for new clients</Q>
              <Pills options={[['FRS 105', 'FRS 105'], ['FRS 102 1A', 'FRS 102 1A'], ['FRS 102', 'FRS 102']]} value={[defaults.standard]} onChange={(v) => setDefaults({ ...defaults, standard: v[0] })} />
              <Q>Usual year end</Q>
              <Pills options={[['per_client', 'Varies by client'], ['03-31', '31 March'], ['12-31', '31 December']]} value={[defaults.year_end]} onChange={(v) => setDefaults({ ...defaults, year_end: v[0] })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Q htmlFor="tol">Reconciliation tolerance (£)</Q>
                  <input id="tol" inputMode="decimal" className={inputCls} value={defaults.tolerance} onChange={(e) => setDefaults({ ...defaults, tolerance: e.target.value })} />
                  <p className="text-[11px] text-[#7E8DA6] mt-1">Differences under this count as reconciled.</p>
                </div>
                <div>
                  <Q htmlFor="rt">Review threshold (£)</Q>
                  <input id="rt" inputMode="decimal" className={inputCls} value={defaults.review_threshold} onChange={(e) => setDefaults({ ...defaults, review_threshold: e.target.value })} />
                  <p className="text-[11px] text-[#7E8DA6] mt-1">Movements above this are flagged.</p>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-[28px] font-extrabold tracking-tight mt-1">Your team</h1>
              <p className="text-sm text-[#5B6478] mt-1">Each person gets a link to set their password. Optional: you can do this later.</p>
              <div className="mt-6 space-y-2.5">
                {invitees.map((r, i) => (
                  <div key={i}>
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_40px] gap-2 items-center">
                      <input aria-label="Email" className={inputCls} value={r.email} disabled={!!r.link} placeholder="name@practice.co.uk" onChange={(e) => setInvitees(invitees.map((x, k) => (k === i ? { ...x, email: e.target.value, error: undefined } : x)))} />
                      <input aria-label="Name" className={inputCls} value={r.name} disabled={!!r.link} placeholder="Full name" onChange={(e) => setInvitees(invitees.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                      <button type="button" aria-label="Remove" disabled={!!r.link} onClick={() => setInvitees(invitees.length > 1 ? invitees.filter((_, k) => k !== i) : [{ email: '', name: '', role: 'preparer' }])} className="h-[42px] flex items-center justify-center text-[#5B6478] hover:text-[#B8432F] disabled:opacity-30 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {!r.link && (
                      <div className="mt-2">
                        <Pills options={ROLES.map((x) => [x, x[0].toUpperCase() + x.slice(1)] as [string, string])} value={[r.role]} onChange={(v) => setInvitees(invitees.map((x, k) => (k === i ? { ...x, role: v[0] } : x)))} />
                      </div>
                    )}
                    {r.error && <p className="text-[11px] text-[#B8432F] mt-1">{r.error}</p>}
                    {r.link && (
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#0B6B4D]">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate font-mono">{r.link}</span>
                        <button type="button" onClick={() => navigator.clipboard?.writeText(r.link!)} className="inline-flex items-center gap-1 font-semibold text-[#1D4E89] hover:underline cursor-pointer">
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setInvitees([...invitees, { email: '', name: '', role: 'preparer' }])} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4E89] hover:underline cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Add another person
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="text-[28px] font-extrabold tracking-tight mt-1">First clients</h1>
              <p className="text-sm text-[#5B6478] mt-1">Pick how to start. You can add more any time.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-6">
                {(
                  [
                    ['sample', FlaskConical, 'Sample company', 'Explore a ready-made file'],
                    ['csv', TableProperties, 'Upload a list', 'CSV of your clients'],
                    ['manual', Building2, 'Add by hand', 'One client at a time'],
                  ] as const
                ).map(([key, Icon, title, sub]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={clientChoice === key}
                    onClick={() => setClientChoice(key)}
                    className={`text-left p-4 rounded-[10px] border cursor-pointer transition-colors ${clientChoice === key ? 'bg-[#EEF3FD] border-[#1D4E89] ring-1 ring-[#1D4E89]' : 'bg-white border-[#D5DBE7] hover:border-[#A6B4D0]'}`}
                  >
                    <Icon className="w-5 h-5 text-[#1D4E89]" />
                    <span className="block text-sm font-semibold mt-2">{title}</span>
                    <span className="block text-[11px] text-[#5B6478] mt-0.5">{sub}</span>
                  </button>
                ))}
              </div>
              {clientChoice === 'csv' && (
                <div className="mt-4 p-4 rounded-[10px] border border-dashed border-[#A6B4D0] bg-white">
                  <label htmlFor="csv" className="text-sm font-semibold">Client list (.csv)</label>
                  <input id="csv" type="file" accept=".csv,text/csv" className="block mt-2 text-xs" onChange={(e) => e.target.files?.[0] && parseCsv(e.target.files[0])} />
                  <p className="text-[11px] text-[#7E8DA6] mt-2">Columns: name, company number, year end (YYYY-MM-DD).</p>
                  {csvError && <p className="text-[11px] text-[#B8432F] mt-2">{csvError}</p>}
                  {csvRows.length > 0 && <p className="text-[11px] text-[#0B6B4D] mt-2">{csvRows.length} clients ready to add</p>}
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <h1 className="text-[28px] font-extrabold tracking-tight mt-1">Review your set-up</h1>
              <p className="text-sm text-[#5B6478] mt-1">Check everything, then finish. You can change any of this later in Settings.</p>
              <dl className="mt-6 bg-white border border-[#E3E7EF] rounded-[12px] divide-y divide-[#E3E7EF]">
                {reviewRows.map(([k, v, s]) => (
                  <div key={k} className="grid grid-cols-[140px_minmax(0,1fr)_auto] gap-3 items-start px-4 py-3">
                    <dt className="text-xs font-semibold text-[#5B6478]">{k}</dt>
                    <dd className="text-sm text-[#102654] break-words">{v}</dd>
                    <button type="button" onClick={() => go(s)} aria-label={`Edit ${k}`} className="text-[#1D4E89] hover:text-[#102654] cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </dl>
            </>
          )}

          <Changes lines={changes[step]} />

          {error && (
            <div role="alert" className="mt-6 p-3 rounded-[10px] bg-[#FFF1DC] border border-[#9A4A00]/20 text-[#9A4A00] text-xs font-medium">
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center gap-3">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-1.5 min-h-[42px] px-4 bg-white border border-[#D5DBE7] rounded-[10px] text-xs font-bold text-[#102654] hover:border-[#A6B4D0] cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="inline-flex items-center gap-2 min-h-[42px] px-5 bg-[#102654] hover:bg-[#0B1B3D] text-white font-bold text-xs rounded-[10px] cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving…' : step === 5 ? 'Finish set-up' : step === 4 ? 'Review my set-up' : step === 3 && pendingInvites.length ? 'Send invitations' : 'Continue'}
              {!saving && (step === 5 ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />)}
            </button>
            {step === 3 && !pendingInvites.length && (
              <span className="text-[11px] text-[#7E8DA6]">Optional: leave empty to skip</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
