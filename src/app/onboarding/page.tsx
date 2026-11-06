'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Pencil, Plus, X, Zap } from 'lucide-react';
import { BlyntLogo } from '@/components/ui/BlyntLogo';
import { structureFields, companyNumberError } from '@/lib/practice-structure';

/**
 * Practice set-up wizard, shown once after firm sign-up (adaptive: each answer shows what it
 * changes, and follow-up questions appear only when they apply).
 * Step 1 is required and saved to the firm; step 2 (team) can be skipped; step 3 reviews and finishes.
 */

const STEPS = ['Your practice', 'Your team', 'Review'];

const STRUCTURES: [string, string, string][] = [
  ['llp', 'LLP', 'Registered at Companies House'],
  ['ltd', 'Limited company', 'Registered at Companies House'],
  ['partnership', 'Partnership', 'Not on the register'],
  ['sole', 'Sole practitioner', 'Not on the register'],
];
const REGULATORS = ['ICAEW', 'ACCA', 'ICAS', 'CAI', 'AAT', 'CIMA', 'ATT', 'CIOT'];
const ROLES = ['readonly', 'preparer', 'reviewer', 'manager', 'partner', 'admin'];
const label = (list: [string | number, string, ...string[]][], key: string | number) => list.find((x) => x[0] === key)?.[1] ?? String(key);

const inputCls =
  'w-full min-h-[42px] px-3 text-sm bg-white border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] focus:ring-2 focus:ring-[#FF7A66]/20 placeholder:text-[#9AA6BC]';

function Q({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-[#122654] mt-6 mb-2">
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
              on ? 'bg-[#122654] border-[#122654] text-white' : 'bg-white border-[#D3DCEE] text-[#122654] hover:border-[#A6B4D0]'
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
              on ? 'bg-[#EEF2F9] border-[#1D4E89] ring-1 ring-[#1D4E89]' : 'bg-white border-[#D3DCEE] hover:border-[#A6B4D0]'
            }`}
          >
            {on && <Check className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-[#1D4E89]" />}
            <span className="block text-sm font-semibold text-[#122654] pr-4">{title}</span>
            <span className="block text-[11px] text-[#4A5878] mt-0.5">{sub}</span>
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
    <div className="mt-8 flex gap-3 p-4 rounded-[12px] bg-[#EEF2F9] border border-[#1D4E89]/15">
      <Zap className="w-4 h-4 text-[#1D4E89] shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#1D4E89] mb-1">What this changes in Blynt</p>
        {lines.map((l) => (
          <p key={l} className="text-xs text-[#122654] leading-relaxed">{l}</p>
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
  const [invitees, setInvitees] = useState<Invitee[]>([{ email: '', name: '', role: 'preparer' }]);
  useEffect(() => {
    fetch('/api/v1/firm/onboarding')
      .then((r) => r.json())
      .then((d) => {
        setCanEdit(Boolean(d.can_edit));
        const at = Math.min(d.onboarding?.step ?? 0, STEPS.length - 1);
        setStep(at);
        setFurthest(at);
        if (d.profile) setProfile((p) => ({ ...p, ...d.profile, vat_registered: d.profile.vat_registered !== false }));
        else setProfile((p) => ({ ...p, legal_name: d.firm_name || '' }));
        setLoaded(true);
      })
      .catch(() => {
        setError('Could not load your practice. Refresh to try again.');
        setLoaded(true);
      });
  }, []);

  const p = profile;
  const sf = structureFields(p.structure);
  const onRegister = sf.companyNumber;
  const crnError = p.company_number.trim() ? companyNumberError(p.structure, p.company_number, p.jurisdiction) : '';
  const setP = (k: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setProfile({ ...p, [k]: e.target.value });
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
    sentInvites.length
      ? [`${sentInvites.length} invitation link${sentInvites.length === 1 ? '' : 's'} created. Send each link to the person; it lasts 7 days.`]
      : pendingInvites.length
        ? [`${pendingInvites.length} invitation link${pendingInvites.length === 1 ? '' : 's'} will be created when you continue.`]
        : ['You can invite your team later from Settings.'],
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
    const res = await fetch('/api/v1/firm/onboarding/complete', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not finish set-up.');
    // Full reload so the workspace picks up the practice details
    window.location.href = '/settings';
  };

  const handleNext = async () => {
    setError('');
    if (step === 0) {
      const missing = !p.legal_name.trim() || !p.regulator || !p.address_line.trim() || !p.postcode.trim() || (onRegister && (!p.company_number.trim() || Boolean(crnError))) || (p.vat_registered && !p.vat_number.trim());
      if (missing) {
        setError('Fill in the questions marked *.');
        return;
      }
    }
    setSaving(true);
    try {
      if (step === 0) await saveStep(0, p);
      else if (step === 1) {
        if (!(await sendInvites())) {
          setError('Some invitations could not be created. Fix them or remove the row.');
          return;
        }
        await saveStep(1, {});
      } else {
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

  if (!loaded) return <div className="min-h-screen flex items-center justify-center text-sm text-[#4A5878]">Loading your practice…</div>;

  if (!canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md bg-white border border-[#D3DCEE] rounded-[14px] p-8 text-sm">
          <p className="font-bold text-[#122654] mb-2">Your practice is still being set up</p>
          <p className="text-[#4A5878] mb-4">A practice admin or partner will finish set-up. You can start working in the meantime.</p>
          <a href="/" className="text-[#1D4E89] font-semibold hover:underline">Go to dashboard</a>
        </div>
      </div>
    );
  }

  const reviewRows: [string, string, number][] = [
    ['Practice', `${p.trading_name || p.legal_name} · ${label(STRUCTURES, p.structure)}${onRegister && p.company_number ? ` · ${p.company_number}` : ''}`, 0],
    [sf.addressLabel, `${p.address_line}, ${p.postcode.toUpperCase()}`, 0],
    ['Regulation', `${p.regulator}${p.registration_number ? ` · ${p.registration_number}` : ''} · ${p.vat_registered ? `VAT ${p.vat_number}` : 'Not VAT registered'}`, 0],
    ['Team', sentInvites.length ? sentInvites.map((r) => `${r.email} (${r.role})`).join(', ') : 'No one invited yet', 1],
  ];

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] bg-[#F5F8FD] text-[#122654]">
      {/* Step rail */}
      <aside className="bg-[#0B1A3B] text-white px-6 py-8 lg:min-h-screen flex flex-col">
        <BlyntLogo variant="full" theme="dark" size="md" />
        <p className="mt-10 text-[11px] font-bold uppercase tracking-wider text-[#FF7A66]">Set up your practice</p>
        <p className="mt-2 text-xs text-[#A6B4D0] leading-relaxed">Three short steps. Each answer shows what it changes in Blynt.</p>
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
              <p className="text-sm text-[#4A5878] mt-1">How your practice appears on statutory accounts and client packs.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Q htmlFor="legal" required>{sf.legalLabel}</Q>
                  <input id="legal" className={inputCls} value={p.legal_name} onChange={setP('legal_name')} placeholder={sf.legalPlaceholder} />
                </div>
                <div>
                  <Q htmlFor="trading">{sf.tradingLabel}</Q>
                  <input id="trading" className={inputCls} value={p.trading_name} onChange={setP('trading_name')} placeholder="Wright Accountants" />
                </div>
              </div>
              <Q required>How is your practice set up?</Q>
              <Cards cols={4} options={STRUCTURES} value={[p.structure]} onChange={(v) => setProfile({ ...p, structure: v[0], company_number: v[0] === p.structure ? p.company_number : '' })} />
              {onRegister && (
                <div className="sm:w-1/2">
                  <Q htmlFor="crn" required>Companies House number</Q>
                  <input id="crn" className={inputCls} value={p.company_number} onChange={setP('company_number')} placeholder={sf.companyPlaceholder(p.jurisdiction)} aria-invalid={Boolean(crnError)} />
                  {crnError && <p className="text-xs text-[#B8432F] mt-1">{crnError}</p>}
                </div>
              )}
              <Q required>Who supervises your practice?</Q>
              <p className="text-xs text-[#4A5878] -mt-1 mb-2">{sf.regulatorHint}</p>
              <Pills options={REGULATORS.map((r) => [r, r] as [string, string])} value={[p.regulator]} onChange={(v) => setProfile({ ...p, regulator: v[0] })} />
              {p.regulator && (
                <div className="sm:w-1/2">
                  <Q htmlFor="regno">{p.regulator} firm number</Q>
                  <input id="regno" className={inputCls} value={p.registration_number} onChange={setP('registration_number')} placeholder="C001234567" />
                </div>
              )}
              <Q required>{sf.addressLabel}</Q>
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
              <h1 className="text-[28px] font-extrabold tracking-tight mt-1">Your team</h1>
              <p className="text-sm text-[#4A5878] mt-1">Each person gets a link to set their password. Optional: you can do this later.</p>
              <div className="mt-6 space-y-2.5">
                {invitees.map((r, i) => (
                  <div key={i}>
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_40px] gap-2 items-center">
                      <input aria-label="Email" className={inputCls} value={r.email} disabled={!!r.link} placeholder="name@practice.co.uk" onChange={(e) => setInvitees(invitees.map((x, k) => (k === i ? { ...x, email: e.target.value, error: undefined } : x)))} />
                      <input aria-label="Name" className={inputCls} value={r.name} disabled={!!r.link} placeholder="Full name" onChange={(e) => setInvitees(invitees.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                      <button type="button" aria-label="Remove" disabled={!!r.link} onClick={() => setInvitees(invitees.length > 1 ? invitees.filter((_, k) => k !== i) : [{ email: '', name: '', role: 'preparer' }])} className="h-[42px] flex items-center justify-center text-[#4A5878] hover:text-[#B8432F] disabled:opacity-30 cursor-pointer">
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
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#0B6B52]">
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

          {step === 2 && (
            <>
              <h1 className="text-[28px] font-extrabold tracking-tight mt-1">Review your set-up</h1>
              <p className="text-sm text-[#4A5878] mt-1">Check everything, then finish. You can change any of this later in Settings.</p>
              <dl className="mt-6 bg-white border border-[#E3E7EF] rounded-[12px] divide-y divide-[#E3E7EF]">
                {reviewRows.map(([k, v, s]) => (
                  <div key={k} className="grid grid-cols-[140px_minmax(0,1fr)_auto] gap-3 items-start px-4 py-3">
                    <dt className="text-xs font-semibold text-[#4A5878]">{k}</dt>
                    <dd className="text-sm text-[#122654] break-words">{v}</dd>
                    <button type="button" onClick={() => go(s)} aria-label={`Edit ${k}`} className="text-[#1D4E89] hover:text-[#122654] cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </dl>
            </>
          )}

          <Changes lines={changes[step]} />

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
              onClick={handleNext}
              disabled={saving}
              className="inline-flex items-center gap-2 min-h-[42px] px-5 bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold text-xs rounded-[10px] cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving…' : step === 2 ? 'Finish set-up' : step === 1 && pendingInvites.length ? 'Send invitations' : 'Continue'}
              {!saving && (step === 2 ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />)}
            </button>
            {step === 1 && !pendingInvites.length && (
              <span className="text-[11px] text-[#7E8DA6]">Optional: leave empty to skip</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
