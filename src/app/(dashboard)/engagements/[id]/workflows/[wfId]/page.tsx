'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ChevronDown, Plus, X } from 'lucide-react';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';
import { addPaperToWorkflow, allWorkflowsOf, archiveWorkflow, canCustomise, deleteWorkflow, restoreWorkflow, workflowProgress } from '@/lib/workflows';
import { packFor, TEMPLATES, templateOf } from '@/lib/workpapers/templates';
import { evaluatePaper, levelsFor, paperStatus } from '@/lib/workpapers/engine';
import { CustomPaperDialog } from '@/components/workpaper/CustomPaperDialog';
import { STATUS_DEFINITIONS, UserRole, Workpaper } from '@/lib/types/models';
import { formatPence } from '@/lib/money';
import { ukDate } from '@/lib/dates';

const button = 'px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer';
const outline = `${button} border-[#D3DCEE] text-[#122654] hover:bg-[#EAF5FC]`;

const SIGN_LEVELS: { role: string; letter: string; label: string; done: string; action: string; may: UserRole[] }[] = [
  { role: 'preparer', letter: 'P', label: 'Prepared', done: 'prepared', action: 'prepare', may: ['preparer', 'reviewer', 'manager', 'partner', 'admin'] },
  { role: 'reviewer', letter: 'M', label: 'Reviewed', done: 'reviewed', action: 'review', may: ['reviewer', 'manager', 'partner', 'admin'] },
  { role: 'partner', letter: 'Pt', label: 'Approved', done: 'approved', action: 'approve', may: ['partner', 'admin'] },
];

const MANDATORY = ['A-10', 'B-10', 'F-10', 'Z-10', 'Z-20'];
const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 3).toUpperCase();
const signoffBy = (workpaperId: string, role: string) => db.signoffs.find((s) => s.workpaper_id === workpaperId && s.role === role && !s.stale_at);
const byRef = (a: { ref: string }, b: { ref: string }) => a.ref.localeCompare(b.ref, undefined, { numeric: true });

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [, setRev] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showAllPapers, setShowAllPapers] = useState(false);
  const [creatingPaper, setCreatingPaper] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [signing, setSigning] = useState(false);
  const [signMessage, setSignMessage] = useState('');
  const [pendingNa, setPendingNa] = useState<Workpaper | null>(null);
  const [naReason, setNaReason] = useState('');
  const [showNa, setShowNa] = useState(false);
  const refresh = () => setRev((n) => n + 1);
  const engagementId = params?.id as string;
  const wf = allWorkflowsOf(engagementId).find((w) => w.id === params?.wfId);
  const eng = db.engagements.find((e) => e.id === engagementId);
  const client = db.clients.find((c) => c.id === eng?.client_id);
  const actor = getActor();
  const back = client ? `/clients/${client.id}` : '/';

  if (!wf || !eng) return <div className="p-6 text-sm text-[#4A5878]">Workflow not found.</div>;
  const p = workflowProgress(engagementId, wf.refs);
  const filePapers = db.workpapers.filter((w) => w.engagement_id === engagementId);
  const onWorkflow = filePapers.filter((w) => wf.refs.includes(w.ref));
  const papers = onWorkflow.filter((w) => w.applicable !== false);
  const notApplicable = onWorkflow.filter((w) => w.applicable === false).sort(byRef);
  // Grouped by area (A, B, C...), each group in reference order: C-10 before C-20 before D-10
  const groups = [...new Set(papers.map((w) => templateOf(w)?.area ?? '~'))]
    .sort()
    .map((area) => {
      const inArea = papers.filter((w) => (templateOf(w)?.area ?? '~') === area).sort(byRef);
      return { area, name: templateOf(inArea[0])?.areaName ?? 'Other', papers: inArea };
    });

  const canEdit = eng.status !== 'locked' && actor.role !== 'readonly' && !wf.archived_at;
  const levels = SIGN_LEVELS.slice(0, Math.max(0, ...papers.map(levelsFor)));
  const signActions = canEdit ? levels.filter((l) => l.may.includes(actor.role)) : [];
  const unreconciled = papers.filter((w) => evaluatePaper(w)?.totals.difference).length;
  const reviewedPct = papers.length ? Math.round((papers.filter((w) => signoffBy(w.id, 'reviewer')).length / papers.length) * 100) : 0;
  const selectedPapers = papers.filter((w) => selected.has(w.id));

  // Papers this workflow could take: suited to the client's type of business, or already in the year's file
  const suited = new Set(packFor(client?.company_type));
  const isSuited = (a: { ref: string }) => suited.has(a.ref) || filePapers.some((w) => w.ref === a.ref);
  const available = [
    ...TEMPLATES.filter((t) => !wf.refs.includes(t.ref)).map((t) => ({ ref: t.ref, title: t.title })),
    ...filePapers.filter((w) => w.custom_template && !wf.refs.includes(w.ref)).map((w) => ({ ref: w.ref, title: templateOf(w)?.title ?? w.ref })),
  ].sort(byRef);
  const offered = showAllPapers ? available : available.filter(isSuited);
  const hiddenCount = available.length - available.filter(isSuited).length;

  const run = (fn: typeof archiveWorkflow, then?: () => void) => {
    const res = fn(engagementId, wf.id, actor);
    if (res) return setError(res);
    setError('');
    then ? then() : refresh();
  };

  const addPaper = (ref: string) => {
    const res = addPaperToWorkflow(engagementId, wf.id, ref, actor);
    setError(res ?? '');
    refresh();
  };

  const signSelected = async (action: string, done: string) => {
    setSigning(true);
    const failed: string[] = [];
    let count = 0;
    for (const w of selectedPapers) {
      const res = await fetch(`/api/v1/workpapers/${encodeURIComponent(w.id)}/signoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) count++;
      else failed.push(`${w.ref}: ${(await res.json().catch(() => ({}))).error || `not ${done}`}`);
    }
    setSignMessage(`${count} ${done}.${failed.length ? ` Not ${done}: ${failed.join(' · ')}` : ''}`);
    setSelected(new Set());
    setSigning(false);
  };

  const setApplicable = (w: Workpaper, applicable: boolean, reason: string) => {
    db.logAudit(eng.firm_id, actor, applicable ? 'TICK_APPLICABLE' : 'UNTICK_APPLICABLE', 'workpapers', w.id, { applicable: w.applicable !== false }, { applicable, reason });
    w.applicable = applicable;
    w.na_reason = applicable ? null : reason;
    w.updated_at = new Date().toISOString();
    refresh();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4E89] hover:underline"><ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to {client?.name ?? 'client'}</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#122654]">{wf.name}</h1>
          <p className="text-sm text-[#4A5878]">{client?.name} · {ukDate(eng.period_start)} to {ukDate(eng.period_end)}</p>
        </div>

        {canCustomise(actor.role) && eng.status !== 'locked' && (
          <div className="flex items-center gap-2">
            {wf.archived_at ? (
              <button type="button" onClick={() => run(restoreWorkflow)} className={outline}>Restore</button>
            ) : (
              <button type="button" onClick={() => run(archiveWorkflow, () => router.push(back))} className={outline}>Archive</button>
            )}
            <button type="button" onClick={() => setConfirming(true)} className={`${button} border-[#F0C2BA] text-[#B8432F] hover:bg-[#FFF1EE]`}>Delete</button>
          </div>
        )}
      </div>

      {wf.archived_at && <p role="status" className="text-xs px-3 py-2 rounded-lg bg-[#FFF8E6] text-[#8A5A00]">Archived on {ukDate(wf.archived_at)}. It is hidden from the client page and menu until restored.</p>}
      {error && <p role="alert" className="text-xs text-[#B8432F]">{error}</p>}

      {confirming && (
        <div role="alertdialog" aria-label="Delete workflow" className="p-4 rounded-xl border border-[#F0C2BA] bg-[#FFF8F6] text-xs text-[#122654] space-y-3">
          <p>Delete <strong>{wf.name}</strong> from this year? The {papers.length} working papers and their work stay, but this workflow cannot be brought back. Archive it instead if you may need it again.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => run(deleteWorkflow, () => router.push(back))} className={`${button} bg-[#B8432F] border-[#B8432F] text-white`}>Delete workflow</button>
            <button type="button" onClick={() => setConfirming(false)} className={`${button} border-[#D3DCEE]`}>Cancel</button>
          </div>
        </div>
      )}

      {/* Progress and sign-off totals */}
      <section aria-label="Progress" className="bg-white border border-[#E3E7EF] rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-bold text-[#122654]">{p.percent}% complete</h2>
              <span className="text-xs text-[#4A5878]">{p.signedOff + p.prepared} of {p.total} papers done</span>
            </div>
            <div role="progressbar" aria-label="Workflow progress" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} className="h-2 bg-[#E3E7EF] rounded-full overflow-hidden">
              <div className="h-full bg-[#0B6B52] rounded-full" style={{ width: `${p.percent}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 bg-[#F5F8FD] px-4 py-3 rounded-xl border border-[#E3E7EF] shrink-0">
            {[
              { label: 'Reconciled', pct: p.percent, text: 'text-[#0B6B52]', bar: 'bg-[#0B6B52]' },
              { label: 'Reviewed', pct: reviewedPct, text: 'text-purple-700', bar: 'bg-purple-600' },
            ].map((s, i) => (
              <div key={s.label} className={i ? 'pl-4 border-l border-gray-300' : ''}>
                <div className="text-[10px] uppercase font-bold text-[#7E8DA6]">{s.label}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-sm font-bold font-mono ${s.text}`}>{s.pct}%</span>
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {unreconciled > 0 && (
              <div className="pl-4 border-l border-gray-300">
                <div className="text-[10px] uppercase font-bold text-[#B8432F]">Unreconciled</div>
                <span className="text-sm font-bold text-[#B8432F] font-mono">{unreconciled} {unreconciled === 1 ? 'schedule' : 'schedules'}</span>
              </div>
            )}
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
          {levels.map((l) => (
            <div key={l.role}>
              <dt className="text-[10px] uppercase font-bold text-[#7E8DA6]">{l.label}</dt>
              <dd className="font-mono font-bold text-[#122654]">{papers.filter((w) => signoffBy(w.id, l.role)).length} of {papers.length}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Add papers and sign off the ones selected */}
      {canEdit && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {signActions.length > 0 && papers.length > 0 && (
              <label className="flex items-center gap-2 text-xs font-semibold text-[#122654] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPapers.length === papers.length}
                  onChange={(e) => setSelected(new Set(e.target.checked ? papers.map((w) => w.id) : []))}
                  className="rounded border-gray-400"
                />
                Select all
              </label>
            )}
            {selectedPapers.length > 0 && signActions.map((l) => (
              <button key={l.action} type="button" disabled={signing} onClick={() => signSelected(l.action, l.done)} className={`${button} bg-[#122654] border-[#122654] text-white disabled:opacity-60`}>
                {signing ? 'Signing…' : `Mark ${l.done} (${selectedPapers.length})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-expanded={showAdd} onClick={() => setShowAdd((v) => !v)} className={`${outline} inline-flex items-center gap-1`}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add more papers
            </button>
            <button type="button" onClick={() => setCreatingPaper(true)} className={`${outline} inline-flex items-center gap-1`}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Custom working paper
            </button>
          </div>
        </div>
      )}
      {signMessage && <p role="status" className="text-xs text-[#122654] bg-[#F5F8FD] border border-[#E3E7EF] rounded-lg px-3 py-2">{signMessage}</p>}

      {canEdit && showAdd && (
        <section aria-label="Add more papers" className="bg-white border border-[#E3E7EF] rounded-xl px-4 py-3">
          <h2 className="text-xs font-bold text-[#4A5878] pb-1.5">
            {showAllPapers || !client?.company_type ? 'Papers to add' : `Papers for a ${client.company_type}`} ({offered.length})
          </h2>
          {offered.length === 0 && <p className="text-xs text-[#4A5878] py-1">Every paper for this type of business is already on this workflow.</p>}
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
            {offered.map((t) => (
              <li key={t.ref} className="flex items-center gap-3 py-1.5 border-b border-[#E3E7EF] text-xs text-[#4A5878]">
                <span className="font-mono font-bold w-10 shrink-0">{t.ref}</span>
                <span className="flex-1 min-w-0">{t.title}</span>
                <button type="button" onClick={() => addPaper(t.ref)} aria-label={`Add ${t.ref} ${t.title}`} className="inline-flex items-center gap-1 font-bold text-[#1D4E89] hover:underline cursor-pointer">
                  <Plus className="w-3 h-3" aria-hidden="true" /> Add
                </button>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setShowAllPapers((v) => !v)} className="mt-2 text-xs font-semibold text-[#1D4E89] hover:underline cursor-pointer">
              {showAllPapers ? 'Show only papers for this type of business' : `Show all standard papers (${hiddenCount} more)`}
            </button>
          )}
        </section>
      )}

      {groups.map((g) => (
        <section key={g.area} aria-labelledby={`area-${g.area}`}>
          <h2 id={`area-${g.area}`} className="flex items-baseline gap-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#4A5878]">
            <span>{g.name}</span>
            <span className="font-normal normal-case tracking-normal text-[#7E8DA6]">{g.papers.length} {g.papers.length === 1 ? 'paper' : 'papers'}</span>
          </h2>
          <ul className="bg-white border border-[#E3E7EF] rounded-xl divide-y divide-[#E3E7EF]">
            {g.papers.map((w) => {
              const state = paperStatus(w);
              const status = STATUS_DEFINITIONS[state];
              const title = templateOf(w)?.title ?? w.ref;
              const difference = evaluatePaper(w)?.totals.difference;
              return (
                <li key={w.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 hover:bg-[#F5F8FD]">
                  {signActions.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${w.ref} ${title}`}
                      checked={selected.has(w.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(w.id);
                        else next.delete(w.id);
                        setSelected(next);
                      }}
                      className="rounded border-gray-400 shrink-0"
                    />
                  )}
                  <Link href={`/engagements/${engagementId}/workpapers/${w.id}`} className="flex flex-1 min-w-[60%] sm:min-w-0 items-center gap-3">
                    <span className="font-mono text-xs text-[#4A5878] w-10 shrink-0">{w.ref}</span>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-[#122654] truncate">{title}</span>
                  </Link>
                  {!!difference && <span className="font-mono text-xs font-bold text-[#B8432F] shrink-0">{formatPence(difference)}</span>}
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${status.bgClass} ${status.colorClass}`}>{status.label}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] shrink-0">
                    {SIGN_LEVELS.slice(0, levelsFor(w)).map((l) => {
                      const by = signoffBy(w.id, l.role)?.user_name;
                      return (
                        <span key={l.role} title={`${l.label}: ${by ?? 'Pending'}`} className={`min-w-5 h-5 px-0.5 rounded flex items-center justify-center font-bold ${by ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-100 text-gray-500'}`}>
                          {by ? initials(by) : l.letter}
                        </span>
                      );
                    })}
                  </span>
                  {canEdit && (
                    <button type="button" onClick={() => { setPendingNa(w); setNaReason(''); }} aria-label={`Mark ${w.ref} ${title} not applicable`} title="Mark not applicable" className="text-[11px] font-semibold text-[#4A5878] hover:text-[#122654] cursor-pointer shrink-0">
                      N/A
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {notApplicable.length > 0 && (
        <section className="bg-white border border-[#E3E7EF] rounded-xl">
          <button type="button" aria-expanded={showNa} onClick={() => setShowNa((v) => !v)} className="w-full p-3 flex items-center gap-2 text-xs font-bold text-[#4A5878] hover:text-[#122654] cursor-pointer">
            <ChevronDown className={`w-4 h-4 transition-transform ${showNa ? '' : '-rotate-90'}`} aria-hidden="true" />
            Not applicable ({notApplicable.length})
          </button>
          {showNa && (
            <ul className="px-3 pb-2 divide-y divide-[#E3E7EF]">
              {notApplicable.map((w) => (
                <li key={w.id} className="py-2 flex items-center gap-3 text-xs text-[#4A5878]">
                  <span className="font-mono font-bold w-10 shrink-0">{w.ref}</span>
                  <span className="flex-1 min-w-0">
                    <span className="line-through">{templateOf(w)?.title ?? w.ref}</span>
                    {w.na_reason && <span className="ml-2 text-[11px]">{w.na_reason}</span>}
                  </span>
                  {canEdit && <button type="button" onClick={() => setApplicable(w, true, 'Restored by user')} className="font-semibold text-[#1D4E89] hover:underline cursor-pointer shrink-0">Make applicable</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {creatingPaper && (
        <CustomPaperDialog
          engagementId={engagementId}
          firmId={eng.firm_id}
          clientId={eng.client_id}
          onClose={() => setCreatingPaper(false)}
          onCreated={(ref) => {
            setCreatingPaper(false);
            addPaper(ref);
          }}
        />
      )}

      {pendingNa && (
        <div role="dialog" aria-modal="true" aria-label="Mark not applicable" className="fixed inset-0 z-50 bg-[#0B1A3B]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs text-[#122654]">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" /> Mark not applicable</h3>
              <button type="button" onClick={() => setPendingNa(null)} aria-label="Close" className="text-[#4A5878] hover:text-[#122654] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[#4A5878]">You are removing <strong>{pendingNa.ref} {templateOf(pendingNa)?.title}</strong> from the applicable working papers.</p>
            {(MANDATORY.includes(pendingNa.ref) || evaluatePaper(pendingNa)?.leads.some((l) => l.final !== 0n)) && (
              <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800"><strong>Manager approval required:</strong> this paper has a balance or is mandatory.</p>
            )}
            <label className="block font-semibold">
              Reason
              <textarea rows={3} value={naReason} onChange={(e) => setNaReason(e.target.value)} placeholder="e.g. No transactions or commitments in this financial year" className="mt-1 w-full p-2.5 font-normal bg-[#F5F8FD] border border-[#D3DCEE] rounded-lg" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingNa(null)} className="min-h-[36px] px-3 font-bold cursor-pointer">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setApplicable(pendingNa, false, naReason.trim() || 'Marked not applicable');
                  setPendingNa(null);
                }}
                className="min-h-[36px] px-4 bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold rounded-lg cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
