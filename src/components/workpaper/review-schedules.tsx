'use client';

import { Fragment } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatPence } from '@/lib/money';
import { analyticalReview, showsAccounts } from '@/lib/workpapers/analytical';
import { ukDate } from '@/lib/dates';
import { MoneyInput, TextInput } from '@/components/workpaper/parts';
import type { ScheduleProps } from '@/components/workpaper/schedules';

const th = 'p-2 text-[10px] font-bold uppercase tracking-wider text-[#4A5878] whitespace-nowrap';

/* ---------- P&L and balance sheet analytical review ---------- */
const DIVISOR = { pence: 1n, ones: 100n, thousands: 100000n } as const;
type Rounding = keyof typeof DIVISOR;

function shown(p: bigint | null, rounding: Rounding) {
  if (p === null) return '—';
  if (p === 0n) return '-';
  if (rounding === 'pence') return formatPence(p, { accountingFormat: true });
  const size = p < 0n ? -p : p;
  const text = ((size + DIVISOR[rounding] / 2n) / DIVISOR[rounding]).toLocaleString('en-GB');
  return p < 0n ? `(${text})` : text;
}

export function AnalyticalSchedule({ data, result, locked, save, live }: ScheduleProps) {
  const view = result.template.analyticalView ?? 'pl';
  const review = analyticalReview(result.engagementId, view, data);
  const comments: Record<string, string> = data.comments ?? {};
  const rounding: Rounding = data.rounding in DIVISOR ? data.rounding : 'ones';
  const money = (p: bigint | null) => shown(p, rounding);
  const unit = rounding === 'thousands' ? '£000' : '£';
  const figures = 'p-2 text-right font-mono whitespace-nowrap';
  const settingField = 'px-2 py-1.5 border border-[#D3DCEE] rounded-[8px] bg-white';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 p-3 rounded-[12px] bg-[#F5F8FD] border border-[#E3E7EF] text-xs">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Rounding of accounts</span>
          <select aria-label="Rounding of accounts" disabled={locked} value={rounding} onChange={(e) => save({ rounding: e.target.value })} className={settingField}>
            <option value="ones">in ones</option>
            <option value="thousands">in thousands</option>
            <option value="pence">with pence</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 font-semibold">
          <input type="checkbox" disabled={locked} checked={showsAccounts(view, data)} onChange={(e) => save({ show_accounts: e.target.checked })} />
          Show original accounts
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Flag items with a variance ≥ %</span>
          <input
            type="number"
            min={0}
            step="1"
            aria-label="Flag items with a variance of at least this percentage"
            disabled={locked}
            defaultValue={data.threshold_pct ?? 10}
            onBlur={(e) => e.target.value !== String(data.threshold_pct ?? 10) && save({ threshold_pct: e.target.value })}
            className={`w-24 font-mono text-right ${settingField}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Only flag variances ≥ £</span>
          <MoneyInput label="Only flag variances of at least this amount" value={data.threshold_p ?? '100000'} disabled={locked} allowNegative={false} onCommit={(p) => save({ threshold_p: p })} />
        </label>
      </div>

      {review.sections.length === 0 && <p className="text-xs text-[#4A5878]">There are no confirmed figures to review yet. Import the trial balance and confirm the mappings first.</p>}
      {review.sections.length > 0 && !review.hasPrior && <p className="text-xs text-[#4A5878]">There are no prior year figures for this client, so nothing can be compared yet.</p>}

      {review.sections.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-[#122654]">
            <thead>
              <tr className="border-b-2 border-[#A6B4D0]">
                <th className={`${th} text-left`}><span className="sr-only">Account</span></th>
                <th className={`${th} text-right bg-[#F5F8FD]`}>{ukDate(review.periodEnd)}<div className="font-normal normal-case">{unit}</div></th>
                <th className={`${th} text-right`}>{review.priorEnd ? ukDate(review.priorEnd) : 'Prior year'}<div className="font-normal normal-case">{unit}</div></th>
                <th className={`${th} text-right`}>Variance<div className="font-normal normal-case">{unit}</div></th>
                <th className={`${th} text-right`}>%</th>
                <th className={`${th} text-center`}>Flagged</th>
                <th className={`${th} text-left min-w-[220px]`}>Comments</th>
              </tr>
            </thead>
            {review.sections.map((section) => (
              <tbody key={section.heading} className="divide-y divide-[#E3E7EF] border-b-2 border-[#A6B4D0]">
                <tr className="font-bold">
                  <th scope="rowgroup" className="p-2 pt-4 text-left uppercase tracking-wide">{section.heading}</th>
                  <td className={`${figures} pt-4 bg-[#F5F8FD]`}>{money(section.current)}</td>
                  <td className={`${figures} pt-4`}>{money(section.prior)}</td>
                  <td className={`${figures} pt-4`}>{money(section.prior === null ? null : section.current - section.prior)}</td>
                  <td colSpan={3} />
                </tr>
                {section.blocks.map((block, i) => (
                  <Fragment key={block.heading ?? i}>
                    {block.heading && (
                      <tr className="font-semibold">
                        <th scope="row" className="p-2 pl-4 text-left font-semibold">{block.heading}</th>
                        <td className={`${figures} bg-[#F5F8FD]`}>{money(block.current)}</td>
                        <td className={figures}>{money(block.prior)}</td>
                        <td className={figures}>{money(block.prior === null ? null : block.current - block.prior)}</td>
                        <td colSpan={3} />
                      </tr>
                    )}
                    {block.rows.map((r) => {
                      const unexplained = r.significant && !comments[r.key]?.trim();
                      return (
                        <tr key={r.key} className={unexplained ? 'bg-[#FFF8F6]' : ''}>
                          <td className={`p-2 ${block.heading ? 'pl-8' : 'pl-4'}`}>{r.code && <span className="font-mono text-[#4A5878] mr-2">{r.code}</span>}{r.name}</td>
                          <td className={`${figures} bg-[#F5F8FD]`}>{money(r.current)}</td>
                          <td className={figures}>{money(r.prior)}</td>
                          <td className={figures}>{money(r.variance)}</td>
                          <td className={figures}>{r.percent === null ? '—' : `${r.percent > 0 ? '+' : ''}${r.percent.toFixed(2)}%`}</td>
                          <td className="p-2 text-center font-bold text-[#B8432F]">{r.significant ? <span title="Reaches the flag settings">⚑<span className="sr-only">Flagged</span></span> : <span className="font-normal text-[#7E8DA6]">-</span>}</td>
                          <td className="p-2">
                            <TextInput
                              label={`Comment on ${r.name}`}
                              value={comments[r.key] ?? ''}
                              disabled={locked}
                              placeholder={r.significant ? 'Explain this variance' : 'Description'}
                              onCommit={(v) => save({ comments: { ...(live().comments ?? {}), [r.key]: v } })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Statutory information: directors, secretaries and shareholders ---------- */
type Officer = { id: string; title?: string; first_name?: string; surname?: string; is_director?: boolean; is_secretary?: boolean; is_shareholder?: boolean; share_type?: string; shares?: string; appointed?: string; resigned?: string };

export function StatutorySchedule({ data, result, locked, save, live }: ScheduleProps) {
  const officers: Officer[] = data.officers ?? [];
  const update = (id: string, patch: Partial<Officer>) => save({ officers: (live().officers ?? []).map((o: Officer) => (o.id === id ? { ...o, ...patch } : o)) });
  const add = () => save({ officers: [...(live().officers ?? []), { id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, share_type: 'ORDINARY' }] });
  const remove = (id: string) => save({ officers: (live().officers ?? []).filter((o: Officer) => o.id !== id) });
  const dateField = 'w-[130px] px-2 py-1.5 border border-[#D3DCEE] rounded-[8px] bg-white disabled:bg-[#F5F8FD]';
  const tick = (o: Officer, key: 'is_director' | 'is_secretary' | 'is_shareholder', label: string) => (
    <td className="p-2 text-center">
      <input type="checkbox" aria-label={`${label}: ${[o.first_name, o.surname].filter(Boolean).join(' ') || 'new person'}`} checked={Boolean(o[key])} disabled={locked} onChange={(e) => update(o.id, { [key]: e.target.checked })} />
    </td>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#122654]">
          <thead className="bg-[#F5F8FD]">
            <tr>
              <th className={`${th} text-left`}>Title</th>
              <th className={`${th} text-left`}>First name</th>
              <th className={`${th} text-left`}>Surname</th>
              <th className={`${th} text-left`}>Display name</th>
              <th className={th}>Director</th>
              <th className={th}>Secretary</th>
              <th className={th}>Shareholder</th>
              <th className={`${th} text-left`}>Type of shares</th>
              <th className={`${th} text-right`}>Shares</th>
              <th className={`${th} text-left`}>Appointed</th>
              <th className={`${th} text-left`}>Resigned</th>
              <th className={th}><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EF]">
            {officers.map((o) => {
              const officer = o.is_director || o.is_secretary;
              return (
                <tr key={o.id}>
                  <td className="p-1.5 w-16"><TextInput label="Title" value={o.title} disabled={locked} placeholder="Mr" onCommit={(v) => update(o.id, { title: v })} /></td>
                  <td className="p-1.5"><TextInput label="First name" value={o.first_name} disabled={locked} onCommit={(v) => update(o.id, { first_name: v })} /></td>
                  <td className="p-1.5"><TextInput label="Surname" value={o.surname} disabled={locked} onCommit={(v) => update(o.id, { surname: v })} /></td>
                  <td className="p-2 whitespace-nowrap text-[#4A5878]">{[o.title, o.first_name, o.surname].filter(Boolean).join(' ')}</td>
                  {tick(o, 'is_director', 'Director')}
                  {tick(o, 'is_secretary', 'Secretary')}
                  {tick(o, 'is_shareholder', 'Shareholder')}
                  <td className="p-1.5 w-28">{o.is_shareholder && <TextInput label="Type of shares" value={o.share_type} disabled={locked} onCommit={(v) => update(o.id, { share_type: v.toUpperCase() })} />}</td>
                  <td className="p-1.5 w-24">{o.is_shareholder && <TextInput label="Number of shares" value={o.shares} disabled={locked} onCommit={(v) => update(o.id, { shares: v.replace(/[^\d]/g, '') })} />}</td>
                  <td className="p-1.5">{officer && <input type="date" aria-label="Appointed" className={dateField} value={o.appointed ?? ''} disabled={locked} onChange={(e) => update(o.id, { appointed: e.target.value })} />}</td>
                  <td className="p-1.5">{officer && <input type="date" aria-label="Resigned" className={dateField} value={o.resigned ?? ''} disabled={locked} onChange={(e) => update(o.id, { resigned: e.target.value })} />}</td>
                  <td className="p-1.5 text-center">
                    {!locked && (
                      <button type="button" onClick={() => remove(o.id)} aria-label={`Remove ${[o.first_name, o.surname].filter(Boolean).join(' ') || 'this person'}`} className="text-[#7E8DA6] hover:text-[#B42318]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {officers.length === 0 && (
              <tr><td colSpan={12} className="p-3 text-[#4A5878]">No one added yet. Add each director, secretary and shareholder.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs">
        {!locked ? (
          <button type="button" onClick={add} className="inline-flex items-center gap-1 font-bold text-[#B8432F] hover:underline"><Plus className="w-3.5 h-3.5" /> Add person</button>
        ) : <span />}
        <span className="text-[#4A5878]">Total shares: <strong className="font-mono text-[#122654]">{Number(result.totals.shares ?? 0n).toLocaleString('en-GB')}</strong></span>
      </div>
    </div>
  );
}
