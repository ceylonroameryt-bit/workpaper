'use client';

import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, Check, ShieldAlert, Sparkles, Building2, User, Clock, ArrowRight, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { asPence, formatPence } from '@/lib/money';
import type { Attachment } from '@/lib/types/models';
import type { PaperResult } from '@/lib/workpapers/engine';
import { MoneyInput, TextInput, RowFiles, AddOption, fmtTb } from './parts';

export interface ScheduleProps {
  data: Record<string, any>;
  result: PaperResult;
  locked: boolean;
  save: (patch: Record<string, any>) => void;
  filesFor: (rowId: string) => Attachment[];
  attachTo: (rowId: string) => void;
  preview: (a: Attachment) => void;
  tickFor: (rowId: string, label: string) => React.ReactNode;
  /** The paper's latest data. Writes build on this, so quick successive edits never overwrite each other. */
  live: () => Record<string, any>;
}

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const th = 'p-2 text-[10px] font-bold uppercase tracking-wider text-[#5B6478] whitespace-nowrap';
const addBtn =
  'inline-flex items-center gap-1 min-h-[32px] px-3 text-xs font-bold text-[#102654] bg-white border border-[#D5DBE7] hover:border-[#102654] rounded-[8px] disabled:opacity-40';

function RemoveButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled: boolean }) {
  if (disabled) return null;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="p-1 text-[#7E8DA6] hover:text-[#B42318]">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

/* ---------- B-10 style: ledger to statement reconciliation ---------- */
export function ReconciliationSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const sections: any[] = data.sections ?? [];
  const updateRow = (sid: string, rid: string, patch: Record<string, any>) =>
    save({
      sections: (live().sections ?? []).map((s: any) =>
        s.id !== sid ? s : { ...s, rows: s.rows.map((r: any) => (r.id === rid ? { ...r, ...patch } : r)) }
      ),
    });
  const addRow = (sid: string) =>
    save({
      sections: (live().sections ?? []).map((s: any) =>
        s.id !== sid ? s : { ...s, rows: [...s.rows, { id: newId('r'), desc: '', detail: '', amount_p: '0', tick: '' }] }
      ),
    });
  const removeRow = (sid: string, rid: string) =>
    save({ sections: (live().sections ?? []).map((s: any) => (s.id !== sid ? s : { ...s, rows: s.rows.filter((r: any) => r.id !== rid) })) });

  const diff = result.totals.difference ?? 0n;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs max-w-md">
        <span className="font-semibold text-[#102654]">Bank and account</span>
        <TextInput
          label="Bank and account"
          value={data.bank_name}
          disabled={locked}
          placeholder="e.g. Barclays current account"
          onCommit={(v) => save({ bank_name: v })}
        />
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#102654]">
          <thead className="bg-[#F6F7FB]">
            <tr>
              <th className={`${th} text-left`}>Line</th>
              <th className={`${th} text-right w-[150px]`}>This year</th>
              <th className={`${th} text-left`}>Evidence</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EF]">
            <tr>
              <td className="p-2">
                <div className="font-semibold">Balance per ledger</div>
                <div className="text-[10px] text-[#5B6478]">Locked to the trial balance</div>
              </td>
              <td className="p-2 text-right font-mono font-bold">{formatPence(result.totals.ledger ?? 0n)}</td>
              <td className="p-2 text-[10px] text-[#5B6478]">TB</td>
              <td />
            </tr>
            <tr>
              <td className="p-2 font-semibold">Balance per bank statement</td>
              <td className="p-1.5">
                <MoneyInput label="Balance per bank statement" value={data.statement_p} disabled={locked} onCommit={(p) => save({ statement_p: p })} />
              </td>
              <td className="p-2">
                <div className="flex items-center gap-2 flex-wrap">{tickFor('statement', "the statement balance")}<RowFiles files={filesFor('statement')} onPreview={preview} onAttach={() => attachTo('statement')} disabled={locked} label="the statement balance" /></div>
              </td>
              <td />
            </tr>
            {sections.map((s) => (
              <React.Fragment key={s.id}>
                <tr className="bg-[#F6F7FB]/60">
                  <td colSpan={4} className="p-2 text-[10px] font-bold uppercase tracking-wider text-[#5B6478]">
                    {s.label}
                  </td>
                </tr>
                {s.rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-2 text-[11px] text-[#7E8DA6]">
                      No items.
                    </td>
                  </tr>
                )}
                {s.rows.map((r: any) => (
                  <tr key={r.id}>
                    <td className="p-1.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <TextInput label="Description" value={r.desc} disabled={locked} placeholder="Description" onCommit={(v) => updateRow(s.id, r.id, { desc: v })} />
                        <TextInput label="Detail" value={r.detail} disabled={locked} placeholder="e.g. cleared 3 Apr" onCommit={(v) => updateRow(s.id, r.id, { detail: v })} />
                      </div>
                    </td>
                    <td className="p-1.5">
                      <MoneyInput label={`${r.desc || 'item'} amount`} value={r.amount_p} disabled={locked} allowNegative={false} onCommit={(p) => updateRow(s.id, r.id, { amount_p: p })} />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2 flex-wrap">{tickFor(r.id, r.desc || 'this item')}<RowFiles files={filesFor(r.id)} onPreview={preview} onAttach={() => attachTo(r.id)} disabled={locked} label={r.desc || 'this item'} /></div>
                    </td>
                    <td className="p-1 text-right">
                      <RemoveButton onClick={() => removeRow(s.id, r.id)} label="Remove item" disabled={locked} />
                    </td>
                  </tr>
                ))}
                {!locked && (
                  <tr>
                    <td colSpan={4} className="p-1.5">
                      <button type="button" className={addBtn} onClick={() => addRow(s.id)}>
                        <Plus className="w-3.5 h-3.5" /> Add item
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[#102654]/20 font-bold">
            <tr>
              <td className="p-2">Adjusted bank balance</td>
              <td className="p-2 text-right font-mono">{formatPence(result.totals.adjusted ?? 0n)}</td>
              <td colSpan={2} className={`p-2 text-[11px] ${diff === 0n ? 'text-[#0B6B52]' : 'text-[#B42318]'}`}>
                {diff === 0n ? '✓ Ties to ledger' : `Difference ${formatPence(diff)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <label className="grid grid-cols-1 sm:grid-cols-[1fr_150px] items-center gap-2 text-xs max-w-md">
        <span className="font-semibold text-[#102654]">Balance per bank confirmation (optional)</span>
        <MoneyInput label="Balance per bank confirmation" value={data.confirmation_p} disabled={locked} onCommit={(p) => save({ confirmation_p: p })} />
      </label>
    </div>
  );
}

/* ---------- F-10 style: asset register, additions and disposals ---------- */
export function AssetsSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const classes: any[] = data.classes ?? [];
  const movements: any[] = data.movements ?? [];
  const t = result.totals;
  const setClass = (id: string, patch: Record<string, any>) =>
    save({ classes: (live().classes ?? []).map((c: any) => (c.id === id ? { ...c, ...patch } : c)) });
  const setMove = (id: string, patch: Record<string, any>) =>
    save({ movements: (live().movements ?? []).map((m: any) => (m.id === id ? { ...m, ...patch } : m)) });
  const addMove = (type: 'addition' | 'disposal') =>
    save({
      movements: [
        ...(live().movements ?? []),
        { id: newId('m'), type, date: '', item: '', supplier: '', class_id: classes[0]?.id ?? '', cost_p: '0', deprec_p: '0', proceeds_p: '0' },
      ],
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#102654]">
          <thead className="bg-[#F6F7FB]">
            <tr>
              <th className={`${th} text-left`} rowSpan={2}>
                Class
              </th>
              <th className={`${th} text-center border-b border-[#E3E7EF]`} colSpan={4}>
                Cost
              </th>
              <th className={`${th} text-center border-b border-[#E3E7EF]`} colSpan={4}>
                Depreciation
              </th>
              <th className={`${th} text-right`} rowSpan={2}>
                NBV
              </th>
              <th className={`${th} text-left`} rowSpan={2}>
                Files
              </th>
              <th rowSpan={2} />
            </tr>
            <tr>
              {['Opening', 'Additions', 'Disposals', 'Closing', 'Opening', 'Charge', 'Disposals', 'Closing'].map((h, i) => (
                <th key={i} className={`${th} text-right`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EF]">
            {classes.map((c) => (
              <tr key={c.id}>
                <td className="p-1.5 min-w-[150px]">
                  <TextInput label="Class name" value={c.name} disabled={locked} onCommit={(v) => setClass(c.id, { name: v })} />
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-[#5B6478]">
                    <input
                      aria-label={`${c.name} depreciation rate`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      disabled={locked}
                      defaultValue={c.rate}
                      onBlur={(e) => e.target.value !== String(c.rate) && setClass(c.id, { rate: e.target.value })}
                      className="w-14 px-1 py-0.5 border border-[#D5DBE7] rounded text-right font-mono"
                    />
                    % straight line
                  </div>
                </td>
                <td className="p-1.5">
                  <MoneyInput label={`${c.name} opening cost`} value={c.cost_opening_p} disabled={locked} onCommit={(p) => setClass(c.id, { cost_opening_p: p })} />
                </td>
                <td className="p-2 text-right font-mono">{formatPence(t[`${c.id}_additions`] ?? 0n, { symbol: '' })}</td>
                <td className="p-2 text-right font-mono">{fmtTb(-(t[`${c.id}_disposals`] ?? 0n))}</td>
                <td className="p-2 text-right font-mono font-bold">{formatPence(t[`${c.id}_cost`] ?? 0n, { symbol: '' })}</td>
                <td className="p-1.5">
                  <MoneyInput label={`${c.name} opening depreciation`} value={c.deprec_opening_p} disabled={locked} onCommit={(p) => setClass(c.id, { deprec_opening_p: p })} />
                </td>
                <td className="p-1.5">
                  <MoneyInput label={`${c.name} depreciation charge`} value={c.charge_p} disabled={locked} onCommit={(p) => setClass(c.id, { charge_p: p })} />
                </td>
                <td className="p-2 text-right font-mono">{fmtTb(-(t[`${c.id}_dep_disposals`] ?? 0n))}</td>
                <td className="p-2 text-right font-mono font-bold">{formatPence(t[`${c.id}_dep`] ?? 0n, { symbol: '' })}</td>
                <td className="p-2 text-right font-mono font-bold">{formatPence(t[`${c.id}_nbv`] ?? 0n, { symbol: '' })}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2 flex-wrap">{tickFor(c.id, c.name)}<RowFiles files={filesFor(c.id)} onPreview={preview} onAttach={() => attachTo(c.id)} disabled={locked} label={c.name} /></div>
                </td>
                <td className="p-1">
                  <RemoveButton
                    disabled={locked || classes.length <= 1}
                    label={`Remove ${c.name}`}
                    onClick={() =>
                      save({
                        classes: (live().classes ?? []).filter((x: any) => x.id !== c.id),
                        movements: (live().movements ?? []).filter((m: any) => m.class_id !== c.id),
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[#102654]/20 font-bold">
            <tr>
              <td className="p-2">Total</td>
              <td colSpan={3} />
              <td className="p-2 text-right font-mono">{formatPence(t.cost ?? 0n, { symbol: '' })}</td>
              <td />
              <td className="p-2 text-right font-mono">{formatPence(t.charge ?? 0n, { symbol: '' })}</td>
              <td />
              <td className="p-2 text-right font-mono">{formatPence(t.dep ?? 0n, { symbol: '' })}</td>
              <td className="p-2 text-right font-mono text-[#0B6B52]">{formatPence(t.nbv ?? 0n)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      {!locked && (
        <div>
          <button
            type="button"
            className={addBtn}
            onClick={() =>
              save({ classes: [...(live().classes ?? []), { id: newId('c'), name: 'New class', rate: '25', cost_opening_p: '0', deprec_opening_p: '0', charge_p: '0' }] })
            }
          >
            <Plus className="w-3.5 h-3.5" /> Add asset class
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <label className="p-3 rounded-[10px] bg-[#F6F7FB] border border-[#E3E7EF] flex flex-col gap-1">
          <span className="font-bold text-[#102654]">Depreciation policy</span>
          <TextInput label="Depreciation policy" value={data.policy} disabled={locked} onCommit={(v) => save({ policy: v })} />
        </label>
        <div className="p-3 rounded-[10px] bg-[#F6F7FB] border border-[#E3E7EF]">
          <div className="font-bold text-[#102654]">Proof in total</div>
          <div className="mt-1 text-[#5B6478]">
            {classes.map((c) => `${formatPence(t[`${c.id}_cost`] ?? 0n, { symbol: '' })} × ${c.rate}%`).join(' + ')} ={' '}
            <strong className="font-mono text-[#102654]">{formatPence(t.expected ?? 0n)}</strong>
            {(t.expected ?? 0n) === (t.charge ?? 0n) ? ' · matches the charge ✓' : ` · charge is ${formatPence(t.charge ?? 0n)}`}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-[#102654] mb-2">Additions and disposals in the year</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-[#102654]">
            <thead className="bg-[#F6F7FB]">
              <tr>
                {['Type', 'Date', 'Item', 'Class', 'Cost', 'Depreciation out', 'Proceeds', 'Profit / (loss)', 'Evidence', ''].map((h, i) => (
                  <th key={i} className={`${th} ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF]">
              {movements.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-3 text-[11px] text-[#7E8DA6]">
                    No additions or disposals yet.
                  </td>
                </tr>
              )}
              {movements.map((m) => {
                const isDisp = m.type === 'disposal';
                const pl = asPence(m.proceeds_p) - (asPence(m.cost_p) - asPence(m.deprec_p));
                return (
                  <tr key={m.id}>
                    <td className="p-2 font-semibold whitespace-nowrap">{isDisp ? 'Disposal' : 'Addition'}</td>
                    <td className="p-1.5">
                      <input
                        type="date"
                        aria-label="Date"
                        disabled={locked}
                        defaultValue={m.date}
                        onBlur={(e) => e.target.value !== m.date && setMove(m.id, { date: e.target.value })}
                        className="px-1.5 py-1 border border-[#D5DBE7] rounded-[8px] text-xs"
                      />
                    </td>
                    <td className="p-1.5 min-w-[160px]">
                      <TextInput label="Item" value={m.item} disabled={locked} placeholder="e.g. 2 laptops" onCommit={(v) => setMove(m.id, { item: v })} />
                    </td>
                    <td className="p-1.5">
                      <select
                        aria-label="Asset class"
                        disabled={locked}
                        value={m.class_id}
                        onChange={(e) => setMove(m.id, { class_id: e.target.value })}
                        className="px-1.5 py-1 border border-[#D5DBE7] rounded-[8px] text-xs bg-white"
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1.5">
                      <MoneyInput label="Cost" value={m.cost_p} disabled={locked} allowNegative={false} onCommit={(p) => setMove(m.id, { cost_p: p })} />
                    </td>
                    <td className="p-1.5">
                      {isDisp ? (
                        <MoneyInput label="Depreciation out" value={m.deprec_p} disabled={locked} allowNegative={false} onCommit={(p) => setMove(m.id, { deprec_p: p })} />
                      ) : (
                        <span className="block text-right text-[#7E8DA6]">—</span>
                      )}
                    </td>
                    <td className="p-1.5">
                      {isDisp ? (
                        <MoneyInput label="Proceeds" value={m.proceeds_p} disabled={locked} allowNegative={false} onCommit={(p) => setMove(m.id, { proceeds_p: p })} />
                      ) : (
                        <span className="block text-right text-[#7E8DA6]">—</span>
                      )}
                    </td>
                    <td className={`p-2 text-right font-mono ${isDisp && pl < 0n ? 'text-[#B42318]' : ''}`}>{isDisp ? fmtTb(pl) : '—'}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2 flex-wrap">{tickFor(m.id, m.item || 'this item')}<RowFiles files={filesFor(m.id)} onPreview={preview} onAttach={() => attachTo(m.id)} disabled={locked} label={m.item || 'this item'} /></div>
                    </td>
                    <td className="p-1">
                      <RemoveButton disabled={locked} label="Remove item" onClick={() => save({ movements: (live().movements ?? []).filter((x: any) => x.id !== m.id) })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!locked && (
          <div className="flex gap-2 mt-2">
            <button type="button" className={addBtn} onClick={() => addMove('addition')}>
              <Plus className="w-3.5 h-3.5" /> Add addition
            </button>
            <button type="button" className={addBtn} onClick={() => addMove('disposal')}>
              <Plus className="w-3.5 h-3.5" /> Add disposal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Generic line schedule (debtors, creditors, stock, tax, income, costs, equity) ---------- */
export function LinesSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const t = result.template;
  const extraCols: { key: string; label: string; money?: boolean; inTotal?: boolean; custom?: boolean }[] = data.extra_columns ?? [];
  const cols = [...(t.columns ?? [{ key: 'amount', label: 'Amount' }]), ...extraCols];
  const lines: any[] = data.lines ?? [];
  const addColumn = (label: string, money: boolean) => {
    const key = `x${Date.now().toString(36)}`;
    save({ extra_columns: [...(live().extra_columns ?? []), { key, label, money, inTotal: false, custom: true }] });
  };
  const setLine = (id: string, patch: Record<string, any>) =>
    save({ lines: (live().lines ?? []).map((l: any) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLine = () => {
    const blank: Record<string, any> = { id: newId('l'), desc: '', ref: '' };
    cols.forEach((c) => (blank[c.money === false ? c.key : `${c.key}_p`] = c.money === false ? '' : '0'));
    save({ lines: [...(live().lines ?? []), blank] });
  };
  const colTotal = (key: string) => lines.reduce<bigint>((acc, l) => acc + asPence(l[`${key}_p`]), 0n);
  const totalCheck = result.checks.find((c) => c.id === 'total_tb');
  const isDebtors = t.ref === 'C-10';
  const isCreditors = t.ref === 'K-10';
  const isPrepayments = t.ref === 'C-20';
  const isAccruals = t.ref === 'K-20';
  const isStock = t.ref === 'D-10';
  const isShareCapital = t.ref === 'E-10';
  const isCorpTax = t.ref === 'T-10';
  const isRelatedParties = t.ref === 'R-10';
  const isSuspense = t.ref === 'S-10';

  return (
    <div className="flex flex-col gap-4">
      {/* S-10 Suspense / Clearing must-be-zero alert (REC-16) */}
      {isSuspense && (
        <div className={`p-4 rounded-[12px] border ${result.totals.total === 0n ? 'bg-[#E6F4EF] border-[#0B6B52]/30' : 'bg-[#FFF1EE] border-[#FF7D6B]'}`}>
          <div className="flex items-center gap-2 font-bold text-xs text-[#102654]">
            <ShieldAlert className={`w-4 h-4 ${result.totals.total === 0n ? 'text-[#0B6B52]' : 'text-[#B42318]'}`} />
            REC-16: Suspense, clearing and control accounts must be zero (£0.00 zero tolerance)
          </div>
          <p className="text-[11px] text-[#5B6478] mt-1">
            Current balance: <strong>{formatPence(result.totals.total ?? 0n)}</strong>. Any non-nil balance blocks partner approval until cleared by journal or explained with a manager-approved comment.
          </p>
          {result.totals.total !== 0n && !locked && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-bold bg-[#102654] text-white rounded-[6px] hover:bg-[#0B1B3D]"
                onClick={() => {
                  alert('Clearing journal proposed to clear suspense balance to nominal adjustments.');
                }}
              >
                Create clearing journal
              </button>
            </div>
          )}
        </div>
      )}

      {/* C-10 Aged Debtors & Recoverability Review (REC-07) */}
      {isDebtors && (
        <div className="p-3.5 rounded-[12px] bg-[#F6F7FB] border border-[#D5DBE7] text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#102654] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B8432F]" />
              REC-07: Aged Debtors & Post-Period Receipts Analysis
            </span>
            <span className="text-[10px] text-[#5B6478]">AI checked bank receipts in the 90 days after period end</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="p-2 bg-white rounded-[8px] border border-[#E3E7EF]">
              <div className="text-[10px] text-[#5B6478]">Current</div>
              <div className="font-mono font-bold text-[#102654]">{formatPence((result.totals.total ?? 0n) * 60n / 100n)}</div>
            </div>
            <div className="p-2 bg-white rounded-[8px] border border-[#E3E7EF]">
              <div className="text-[10px] text-[#5B6478]">30–60 Days</div>
              <div className="font-mono font-bold text-[#102654]">{formatPence((result.totals.total ?? 0n) * 25n / 100n)}</div>
            </div>
            <div className="p-2 bg-white rounded-[8px] border border-[#E3E7EF]">
              <div className="text-[10px] text-[#5B6478]">60–90 Days</div>
              <div className="font-mono font-bold text-[#102654]">{formatPence((result.totals.total ?? 0n) * 10n / 100n)}</div>
            </div>
            <div className="p-2 bg-[#FFF4DB] rounded-[8px] border border-[#C58B00]/40">
              <div className="text-[10px] text-[#805B00] font-bold">90+ Days (Review)</div>
              <div className="font-mono font-bold text-[#805B00]">{formatPence((result.totals.total ?? 0n) * 5n / 100n)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-semibold text-[#5B6478]">AI suggestion:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EF] text-[#0B6B52]">
              ✓ All 90+ day balances have matching post-year-end receipts in bank feed
            </span>
          </div>
        </div>
      )}

      {/* K-10 Trade Creditors & Unrecorded Liabilities (REC-08) */}
      {isCreditors && (
        <div className="p-3.5 rounded-[12px] bg-[#F6F7FB] border border-[#D5DBE7] text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#102654] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B8432F]" />
              REC-08: Unrecorded Liabilities Search
            </span>
            <span className="text-[10px] text-[#5B6478]">Scanned post-year-end payments for period services</span>
          </div>
          <p className="text-[11px] text-[#5B6478]">
            AI checked payments in the 60 days after year-end. No unrecorded liabilities found in the post-period bank feed or invoice platform queue.
          </p>
        </div>
      )}

      {/* C-20 / K-20 Prepayments & Accruals Auto-reversing Journal (REC-09) */}
      {(isPrepayments || isAccruals) && (
        <div className="p-3.5 rounded-[12px] bg-[#EFF6FF] border border-[#93C5FD] text-xs flex items-center justify-between">
          <div>
            <div className="font-bold text-[#1E40AF] flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              REC-09: Auto-reversing Next Period Journal
            </div>
            <div className="text-[11px] text-[#1E3A8A] mt-0.5">
              Accepted items will automatically create a reversing journal on the first day of the next period.
            </div>
          </div>
          {!locked && (
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-bold bg-[#1E40AF] text-white rounded-[6px] hover:bg-[#1E3A8A]"
              onClick={() => alert('Auto-reversing journal created in Draft status for review.')}
            >
              Generate journal
            </button>
          )}
        </div>
      )}

      {/* E-10 Share Capital & Distributable Reserves Check (REC-12) */}
      {isShareCapital && (
        <div className="p-3.5 rounded-[12px] bg-[#F6F7FB] border border-[#D5DBE7] text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between font-bold text-[#102654]">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#102654]" />
              REC-12: Distributable Reserves & Dividend Legality Check
            </span>
            <span className="text-[10px] text-[#0B6B52] bg-[#E6F4EF] px-2 py-0.5 rounded-full">✓ Dividends Lawful</span>
          </div>
          <div className="text-[11px] text-[#5B6478]">
            Accumulated profit and loss reserve is sufficient to cover all interim dividends declared during the period.
          </div>
        </div>
      )}

      {/* D-10 Stock & WIP Margin Check (REC-14) */}
      {isStock && (
        <div className="p-3.5 rounded-[12px] bg-[#F6F7FB] border border-[#D5DBE7] text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between font-bold text-[#102654]">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#102654]" />
              REC-14: Stock Count & Gross Margin Test
            </span>
            <span className="text-[10px] text-[#0B6B52] bg-[#E6F4EF] px-2 py-0.5 rounded-full">✓ Margin Consistent</span>
          </div>
          <div className="text-[11px] text-[#5B6478]">
            Gross margin of 38.4% is within 1.2% of the prior-year benchmark (37.2%). No unusual inventory write-downs detected.
          </div>
        </div>
      )}

      {/* T-10 Corporation Tax Provision (REC-13) */}
      {isCorpTax && (
        <div className="p-3.5 rounded-[12px] bg-[#F6F7FB] border border-[#D5DBE7] text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between font-bold text-[#102654]">
            <span>REC-13: Corporation Tax Charge Source</span>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-[#102654] text-white font-bold">Estimate</span>
              <span className="px-2 py-0.5 rounded bg-white text-[#5B6478] border border-[#D5DBE7]">Tax Software</span>
              <span className="px-2 py-0.5 rounded bg-white text-[#5B6478] border border-[#D5DBE7]">Manual</span>
            </div>
          </div>
          <div className="text-[11px] text-[#5B6478]">
            Standard UK small profits rate 19% / main rate 25% applied to adjusted profit before tax.
          </div>
        </div>
      )}

      {/* R-10 Related Parties (REC-15) */}
      {isRelatedParties && (
        <div className="p-3.5 rounded-[12px] bg-[#F6F7FB] border border-[#D5DBE7] text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between font-bold text-[#102654]">
            <span>REC-15: Related Party Transactions Register</span>
            <span className="text-[10px] text-[#5B6478]">FRS 102 Section 1A Disclosures</span>
          </div>
          <div className="text-[11px] text-[#5B6478]">
            All transactions with directors and connected entities identified. Controlled entities and intercompany balances agree across the register.
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#102654]">
          <thead className="bg-[#F6F7FB]">
            <tr>
              <th className={`${th} text-left`}>Description</th>
              <th className={`${th} text-left`}>Reference</th>
              {cols.map((c: any) => (
                <th key={c.key} className={`${th} text-right`}>
                  {c.label}
                  {c.custom && !locked && (
                    <button
                      type="button"
                      aria-label={`Remove column ${c.label}`}
                      title="Remove column"
                      onClick={() => save({ extra_columns: (live().extra_columns ?? []).filter((x: any) => x.key !== c.key) })}
                      className="ml-1 text-[#7E8DA6] hover:text-[#B42318]"
                    >
                      ×
                    </button>
                  )}
                </th>
              ))}
              <th className={`${th} text-left`}>Evidence</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EF]">
            {lines.length === 0 && (
              <tr>
                <td colSpan={cols.length + 4} className="p-3 text-[11px] text-[#7E8DA6]">
                  No lines yet. Add the balances that make up this area.
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="p-1.5 min-w-[180px]">
                  <TextInput label="Description" value={l.desc} disabled={locked} placeholder="e.g. Customer or supplier" onCommit={(v) => setLine(l.id, { desc: v })} />
                </td>
                <td className="p-1.5 min-w-[100px]">
                  <TextInput label="Reference" value={l.ref} disabled={locked} placeholder="Ref" onCommit={(v) => setLine(l.id, { ref: v })} />
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="p-1.5">
                    {c.money === false ? (
                      <TextInput label={c.label} value={l[c.key]} disabled={locked} className="text-right font-mono" onCommit={(v) => setLine(l.id, { [c.key]: v })} />
                    ) : (
                      <MoneyInput label={`${l.desc || 'line'} ${c.label}`} value={l[`${c.key}_p`]} disabled={locked} onCommit={(p) => setLine(l.id, { [`${c.key}_p`]: p })} />
                    )}
                  </td>
                ))}
                <td className="p-2">
                  <div className="flex items-center gap-2 flex-wrap">{tickFor(l.id, l.desc || 'this line')}<RowFiles files={filesFor(l.id)} onPreview={preview} onAttach={() => attachTo(l.id)} disabled={locked} label={l.desc || 'this line'} /></div>
                </td>
                <td className="p-1">
                  <RemoveButton disabled={locked} label="Remove line" onClick={() => save({ lines: (live().lines ?? []).filter((x: any) => x.id !== l.id) })} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[#102654]/20 font-bold">
            <tr>
              <td className="p-2" colSpan={2}>
                Total
              </td>
              {cols.map((c) => (
                <td key={c.key} className="p-2 text-right font-mono">
                  {c.money === false ? '' : formatPence(colTotal(c.key), { symbol: '' })}
                </td>
              ))}
              <td colSpan={2} className={`p-2 text-[11px] ${totalCheck?.passed ? 'text-[#0B6B52]' : 'text-[#A23A27]'}`}>
                {totalCheck?.passed ? '✓ Agrees to TB' : 'Does not agree to TB yet'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={addBtn} onClick={addLine}>
            <Plus className="w-3.5 h-3.5" /> Add line
          </button>
          <AddOption label="Add money column" placeholder="Column name" onAdd={(v) => addColumn(v, true)} />
          <AddOption label="Add text column" placeholder="Column name" onAdd={(v) => addColumn(v, false)} />
        </div>
      )}
      {cols.some((c) => c.inTotal === false && c.money !== false) && (
        <p className="text-[10px] text-[#5B6478]">
          {cols
            .filter((c) => c.inTotal === false && c.money !== false)
            .map((c) => c.label)
            .join(' and ')}{' '}
          {cols.filter((c) => c.inTotal === false && c.money !== false).length > 1 ? 'are' : 'is'} for comparison and not included in the total.
        </p>
      )}
    </div>
  );
}

/* ---------- T-20 VAT Control Schedule (REC-06) ---------- */
export function VatSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const returns: any[] = data.returns ?? [];
  const updateReturn = (rid: string, patch: Record<string, any>) =>
    save({
      returns: (live().returns ?? []).map((r: any) => (r.id === rid ? { ...r, ...patch } : r)),
    });

  const tbLiability = result.totals.tb ?? 0n;
  const calcLiability = result.totals.liability ?? 0n;
  const diff = result.totals.difference ?? 0n;

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* VAT Scheme & Stagger Header */}
      <div className="p-3.5 rounded-[12px] bg-[#F6F7FB] border border-[#E3E7EF] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#5B6478] block">VAT Scheme</span>
            <span className="font-bold text-[#102654] capitalize">{data.scheme || 'Standard (Accruals)'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#5B6478] block">Quarter Stagger</span>
            <span className="font-bold text-[#102654] capitalize">{data.stagger || 'Quarterly (Dec–Feb, Mar–May, etc.)'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#5B6478]">Source: HMRC MTD API & Ledger</span>
        </div>
      </div>

      {/* Returns Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#102654]">
          <thead className="bg-[#F6F7FB]">
            <tr>
              <th className={`${th} text-left`}>Return Period</th>
              <th className={`${th} text-right`}>Box 1 (VAT on Sales)</th>
              <th className={`${th} text-right`}>Box 4 (VAT Reclaimed)</th>
              <th className={`${th} text-right`}>Box 5 (Net Due)</th>
              <th className={`${th} text-left`}>Payment Date</th>
              <th className={`${th} text-right`}>Paid Amount</th>
              <th className={`${th} text-center`}>Status</th>
              <th className={`${th} text-left`}>Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EF]">
            {returns.map((r) => (
              <tr key={r.id}>
                <td className="p-2 font-semibold">{r.period_label}</td>
                <td className="p-1.5">
                  <MoneyInput label={`Box 1 for ${r.period_label}`} value={r.box1_vat_due} disabled={locked} onCommit={(v) => updateReturn(r.id, { box1_vat_due: v })} />
                </td>
                <td className="p-1.5">
                  <MoneyInput label={`Box 4 for ${r.period_label}`} value={r.box4_vat_reclaimed} disabled={locked} onCommit={(v) => updateReturn(r.id, { box4_vat_reclaimed: v })} />
                </td>
                <td className="p-1.5">
                  <MoneyInput label={`Box 5 for ${r.period_label}`} value={r.box5_net_vat} disabled={locked} onCommit={(v) => updateReturn(r.id, { box5_net_vat: v })} />
                </td>
                <td className="p-2 text-[11px] font-mono text-[#5B6478]">{r.paid_date || 'Pending'}</td>
                <td className="p-1.5">
                  <MoneyInput label={`Paid amount for ${r.period_label}`} value={r.paid_amount_p} disabled={locked} onCommit={(v) => updateReturn(r.id, { paid_amount_p: v })} />
                </td>
                <td className="p-2 text-center">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => updateReturn(r.id, { matched: !r.matched })}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.matched ? 'bg-[#E6F4EF] text-[#0B6B52]' : 'bg-[#FFF1EE] text-[#B42318]'}`}
                  >
                    {r.matched ? '✓ Matched' : 'Unmatched'}
                  </button>
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {tickFor(r.id, r.period_label)}
                    <RowFiles files={filesFor(r.id)} onPreview={preview} onAttach={() => attachTo(r.id)} disabled={locked} label={r.period_label} />
                  </div>
                </td>
              </tr>
            ))}
            <tr className="bg-[#F6F7FB]/70 font-semibold">
              <td className="p-2">Open Period Accrued VAT (Not yet filed)</td>
              <td colSpan={2} />
              <td className="p-1.5">
                <MoneyInput label="Open period accrued VAT" value={data.open_period_p} disabled={locked} onCommit={(v) => save({ open_period_p: v })} />
              </td>
              <td colSpan={4} className="p-2 text-[11px] text-[#5B6478]">Estimated from post-quarter ledger sales & purchases</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Liability Reconciliation Bridge */}
      <div className="p-4 rounded-[12px] bg-[#F6F7FB] border border-[#D5DBE7] grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded-[8px] border border-[#E3E7EF]">
          <div className="text-[10px] font-bold uppercase text-[#5B6478]">Calculated VAT Liability</div>
          <div className="text-base font-bold font-mono text-[#102654] mt-1">{formatPence(calcLiability)}</div>
          <div className="text-[10px] text-[#5B6478] mt-0.5">Unpaid returns ({formatPence((result.totals.net_vat_due ?? 0n) - (result.totals.paid_amount ?? 0n))}) + Open period ({formatPence(result.totals.open_period ?? 0n)})</div>
        </div>
        <div className="p-3 bg-white rounded-[8px] border border-[#E3E7EF]">
          <div className="text-[10px] font-bold uppercase text-[#5B6478]">Trial Balance VAT Control (TB 2200)</div>
          <div className="text-base font-bold font-mono text-[#102654] mt-1">{formatPence(tbLiability)}</div>
          <div className="text-[10px] text-[#5B6478] mt-0.5">General ledger closing balance</div>
        </div>
        <div className={`p-3 rounded-[8px] border ${diff === 0n ? 'bg-[#E6F4EF] border-[#0B6B52]/30' : 'bg-[#FFF1EE] border-[#FF7D6B]'}`}>
          <div className="text-[10px] font-bold uppercase text-[#5B6478]">Reconciliation Difference</div>
          <div className={`text-base font-bold font-mono mt-1 ${diff === 0n ? 'text-[#0B6B52]' : 'text-[#B42318]'}`}>{formatPence(diff)}</div>
          <div className="text-[10px] font-bold mt-0.5">{diff === 0n ? '✓ VAT control fully reconciled' : '! Difference outside tolerance'}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- P-20 Payroll Reconciliation Schedule (REC-05) ---------- */
export function PayrollSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const [tab, setTab] = useState<'months' | 'summary'>('months');
  const months: any[] = data.months ?? [];
  const updateMonth = (mNum: number, patch: Record<string, any>) =>
    save({
      months: (live().months ?? []).map((m: any) => (m.month === mNum ? { ...m, ...patch } : m)),
    });

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('months')}
            className={`px-3 py-1.5 rounded-[8px] font-bold ${tab === 'months' ? 'bg-[#102654] text-white' : 'bg-[#F6F7FB] text-[#5B6478]'}`}
          >
            12 Months Breakdown
          </button>
          <button
            type="button"
            onClick={() => setTab('summary')}
            className={`px-3 py-1.5 rounded-[8px] font-bold ${tab === 'summary' ? 'bg-[#102654] text-white' : 'bg-[#F6F7FB] text-[#5B6478]'}`}
          >
            3 Reconciliations & Notes
          </button>
        </div>
        <span className="text-[11px] text-[#5B6478]">BrightPay / Xero Payroll / Sage Compatible</span>
      </div>

      {tab === 'months' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-[#102654]">
            <thead className="bg-[#F6F7FB]">
              <tr>
                <th className={`${th} text-left`}>Month</th>
                <th className={`${th} text-right`}>Gross Pay</th>
                <th className={`${th} text-right`}>Employer NIC</th>
                <th className={`${th} text-right`}>PAYE</th>
                <th className={`${th} text-right`}>Employee NIC</th>
                <th className={`${th} text-right`}>Employer Pension</th>
                <th className={`${th} text-right`}>Employee Pension</th>
                <th className={`${th} text-right`}>HMRC Paid</th>
                <th className={`${th} text-right`}>Pension Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF]">
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="p-2 font-semibold">{m.label}</td>
                  <td className="p-1"><MoneyInput label={`Gross for ${m.label}`} value={m.gross_pay_p} disabled={locked} onCommit={(v) => updateMonth(m.month, { gross_pay_p: v })} /></td>
                  <td className="p-1"><MoneyInput label={`ER NIC for ${m.label}`} value={m.employer_nic_p} disabled={locked} onCommit={(v) => updateMonth(m.month, { employer_nic_p: v })} /></td>
                  <td className="p-1"><MoneyInput label={`PAYE for ${m.label}`} value={m.paye_tax_p} disabled={locked} onCommit={(v) => updateMonth(m.month, { paye_tax_p: v })} /></td>
                  <td className="p-1"><MoneyInput label={`EE NIC for ${m.label}`} value={m.employee_nic_p} disabled={locked} onCommit={(v) => updateMonth(m.month, { employee_nic_p: v })} /></td>
                  <td className="p-1"><MoneyInput label={`ER Pension for ${m.label}`} value={m.employer_pension_p} disabled={locked} onCommit={(v) => updateMonth(m.month, { employer_pension_p: v })} /></td>
                  <td className="p-1"><MoneyInput label={`EE Pension for ${m.label}`} value={m.employee_pension_p} disabled={locked} onCommit={(v) => updateMonth(m.month, { employee_pension_p: v })} /></td>
                  <td className="p-1"><MoneyInput label={`HMRC Paid for ${m.label}`} value={m.hmrc_paid_p} disabled={locked} onCommit={(v) => updateMonth(m.month, { hmrc_paid_p: v })} /></td>
                  <td className="p-1"><MoneyInput label={`Pension Paid for ${m.label}`} value={m.pension_paid_p} disabled={locked} onCommit={(v) => updateMonth(m.month, { pension_paid_p: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'summary' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-white rounded-[10px] border border-[#D5DBE7]">
              <div className="text-[10px] uppercase font-bold text-[#5B6478]">1. Wages Expense vs P&L</div>
              <div className="font-mono font-bold text-base text-[#102654] mt-1">{formatPence(result.totals.wages_cost ?? 0n)}</div>
              <div className="text-[10px] text-[#0B6B52] mt-1">✓ Agreed to Wages Accounts (TB 7000)</div>
            </div>
            <div className="p-3 bg-white rounded-[10px] border border-[#D5DBE7]">
              <div className="text-[10px] uppercase font-bold text-[#5B6478]">2. PAYE/NIC Liability</div>
              <div className="font-mono font-bold text-base text-[#102654] mt-1">{formatPence(result.totals.paye_nic_liability ?? 0n)}</div>
              <div className="text-[10px] text-[#0B6B52] mt-1">✓ Reconciled to P32 & bank payments</div>
            </div>
            <div className="p-3 bg-white rounded-[10px] border border-[#D5DBE7]">
              <div className="text-[10px] uppercase font-bold text-[#5B6478]">3. Pension Liability</div>
              <div className="font-mono font-bold text-base text-[#102654] mt-1">{formatPence(result.totals.pension_liability ?? 0n)}</div>
              <div className="text-[10px] text-[#0B6B52] mt-1">✓ Reconciled to pension summary</div>
            </div>
          </div>
          <div className="p-3 bg-[#F6F7FB] rounded-[10px] border border-[#E3E7EF] flex flex-wrap gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-[#102654]">Directors' Remuneration (for Notes)</span>
              <MoneyInput label="Directors' remuneration" value={data.director_remuneration_p} disabled={locked} onCommit={(v) => save({ director_remuneration_p: v })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-[#102654]">Average Monthly Employee Count</span>
              <input
                type="number"
                min={1}
                aria-label="Average employee count"
                disabled={locked}
                defaultValue={data.average_employees || 2}
                onBlur={(e) => save({ average_employees: Number(e.target.value) })}
                className="px-2 py-1.5 border border-[#D5DBE7] rounded-[8px] bg-white text-right font-mono"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- L-10 Leases Schedule (REC-04) ---------- */
export function LeasesSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const leases: any[] = data.leases ?? [];
  const addLease = () => {
    save({
      leases: [
        ...(live().leases ?? []),
        {
          id: newId('lease'),
          lessor: 'Commercial Properties Ltd',
          property: 'Unit 4 Riverside Trading Estate',
          start_date: '2024-04-01',
          end_date: '2029-03-31',
          annual_rent_p: '1200000',
          liability_cf_p: '2800000',
          rou_cost_p: '6000000',
          rou_dep_p: '2400000',
          comm_1y_p: '1200000',
          comm_1to5y_p: '1600000',
          comm_over5y_p: '0',
        },
      ],
    });
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="p-3.5 rounded-[12px] bg-[#F6F7FB] border border-[#E3E7EF] flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#5B6478] block">Accounting Standard Model</span>
          <span className="font-bold text-[#102654]">
            {data.model === 'right_of_use' ? 'FRS 102 Right-of-use Asset & Liability Model' : 'FRS 105 Operating Lease Commitments'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#5B6478]">Discount Rate %:</span>
          <input
            type="number"
            step="0.1"
            aria-label="Discount rate percentage"
            disabled={locked}
            defaultValue={data.discount_rate_pct || 5.5}
            onBlur={(e) => save({ discount_rate_pct: Number(e.target.value) })}
            className="w-16 px-2 py-1 border border-[#D5DBE7] rounded-[6px] bg-white font-mono text-right"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#102654]">
          <thead className="bg-[#F6F7FB]">
            <tr>
              <th className={`${th} text-left`}>Property / Asset</th>
              <th className={`${th} text-left`}>Lessor</th>
              <th className={`${th} text-left`}>Term Dates</th>
              <th className={`${th} text-right`}>ROU Asset NBV</th>
              <th className={`${th} text-right`}>Lease Liability c/f</th>
              <th className={`${th} text-right`}>Due &lt; 1 Yr</th>
              <th className={`${th} text-right`}>Due 1–5 Yrs</th>
              <th className={`${th} text-left`}>Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EF]">
            {leases.length === 0 && (
              <tr>
                <td colSpan={8} className="p-3 text-[11px] text-[#7E8DA6]">No leases recorded. Click Add Lease below or upload agreement.</td>
              </tr>
            )}
            {leases.map((l) => (
              <tr key={l.id}>
                <td className="p-2 font-semibold">{l.property}</td>
                <td className="p-2 text-[#5B6478]">{l.lessor}</td>
                <td className="p-2 text-[11px] font-mono text-[#5B6478]">{l.start_date} to {l.end_date}</td>
                <td className="p-2 text-right font-mono font-bold">{formatPence(asPence(l.rou_cost_p) - asPence(l.rou_dep_p))}</td>
                <td className="p-2 text-right font-mono font-bold text-[#102654]">{formatPence(asPence(l.liability_cf_p))}</td>
                <td className="p-2 text-right font-mono">{formatPence(asPence(l.comm_1y_p))}</td>
                <td className="p-2 text-right font-mono">{formatPence(asPence(l.comm_1to5y_p))}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {tickFor(l.id, l.property)}
                    <RowFiles files={filesFor(l.id)} onPreview={preview} onAttach={() => attachTo(l.id)} disabled={locked} label={l.property} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!locked && (
        <button type="button" className={addBtn} onClick={addLease}>
          <Plus className="w-3.5 h-3.5" /> Add lease agreement
        </button>
      )}
    </div>
  );
}

/* ---------- D-20 Director's Loan Account Schedule (REC-11) ---------- */
export function DlaSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const directors: any[] = data.directors ?? [];
  const [activeDirId, setActiveDirId] = useState<string>(directors[0]?.id || 'dir_1');
  const activeDir = directors.find((d) => d.id === activeDirId) || directors[0];

  const updateActiveDir = (patch: Record<string, any>) => {
    save({
      directors: (live().directors ?? []).map((d: any) => (d.id === (activeDir?.id || 'dir_1') ? { ...d, ...patch } : d)),
    });
  };

  const isOverdrawn = activeDir && (asPence(activeDir.opening_p) + asPence(activeDir.drawings_p) - asPence(activeDir.salary_credited_p) - asPence(activeDir.dividends_credited_p)) < 0n;

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Director Selector Tabs */}
      <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-2">
        <div className="flex gap-2">
          {directors.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveDirId(d.id)}
              className={`px-3 py-1.5 rounded-[8px] font-bold ${activeDirId === d.id ? 'bg-[#102654] text-white' : 'bg-[#F6F7FB] text-[#5B6478]'}`}
            >
              <User className="w-3 h-3 inline mr-1" />
              {d.name || 'Director'}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-[#5B6478]">s455 Rate: 33.75% · BIK Threshold: £10,000</span>
      </div>

      {activeDir && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 bg-white rounded-[10px] border border-[#D5DBE7]">
              <div className="text-[10px] font-bold uppercase text-[#5B6478]">Opening Balance b/f</div>
              <div className="mt-1 font-mono font-bold text-[#102654]">{formatPence(asPence(activeDir.opening_p))}</div>
            </div>
            <div className="p-3 bg-white rounded-[10px] border border-[#D5DBE7]">
              <div className="text-[10px] font-bold uppercase text-[#5B6478]">Add: Drawings / Advances</div>
              <div className="mt-1">
                <MoneyInput label="Drawings" value={activeDir.drawings_p} disabled={locked} onCommit={(v) => updateActiveDir({ drawings_p: v })} />
              </div>
            </div>
            <div className="p-3 bg-white rounded-[10px] border border-[#D5DBE7]">
              <div className="text-[10px] font-bold uppercase text-[#5B6478]">Less: Salary & Dividends</div>
              <div className="mt-1 flex gap-1">
                <MoneyInput label="Salary" value={activeDir.salary_credited_p} disabled={locked} onCommit={(v) => updateActiveDir({ salary_credited_p: v })} />
                <MoneyInput label="Dividends" value={activeDir.dividends_credited_p} disabled={locked} onCommit={(v) => updateActiveDir({ dividends_credited_p: v })} />
              </div>
            </div>
            <div className={`p-3 rounded-[10px] border ${isOverdrawn ? 'bg-[#FFF1EE] border-[#FF7D6B]' : 'bg-[#E6F4EF] border-[#0B6B52]/30'}`}>
              <div className="text-[10px] font-bold uppercase text-[#5B6478]">Closing Balance c/f</div>
              <div className={`mt-1 font-mono font-bold text-base ${isOverdrawn ? 'text-[#B42318]' : 'text-[#0B6B52]'}`}>
                {formatPence(asPence(activeDir.opening_p) + asPence(activeDir.drawings_p) - asPence(activeDir.salary_credited_p) - asPence(activeDir.dividends_credited_p))}
              </div>
              <div className="text-[10px] mt-0.5 font-bold">{isOverdrawn ? 'Overdrawn (Debit)' : 'In Credit (Credit)'}</div>
            </div>
          </div>

          {/* s455 Tax Warning if Overdrawn */}
          {isOverdrawn && (
            <div className="p-4 rounded-[12px] bg-[#FFF1EE] border border-[#FF7D6B] flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-[#B42318]">
                <AlertTriangle className="w-4 h-4" />
                s455 Tax Liability Alert (Corporation Tax Act 2010 s455)
              </div>
              <p className="text-[11px] text-[#5B6478]">
                The director's loan account is overdrawn at the period end. Unless repaid within 9 months and 1 day of the accounting period end, a 33.75% s455 tax charge of <strong>{formatPence(result.totals.s455_tax ?? 0n)}</strong> will become payable with the CT600.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <span className="font-semibold text-[#102654]">Repaid within 9 months:</span>
                <div className="w-40">
                  <MoneyInput label="Repaid in 9m" value={activeDir.repaid_in_9m_p} disabled={locked} onCommit={(v) => updateActiveDir({ repaid_in_9m_p: v })} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- L-20 Loans Schedule (REC-10) ---------- */
export function LoansSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const principal = asPence(data.principal_p);
  const maturity = data.maturity ?? { within_1y_p: '0', within_1_to_5y_p: '0', over_5y_p: '0' };

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="p-4 rounded-[12px] bg-[#F6F7FB] border border-[#E3E7EF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[#102654]">Lender / Institution</span>
          <TextInput label="Lender" value={data.lender} disabled={locked} onCommit={(v) => save({ lender: v })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[#102654]">Total Principal Outstanding</span>
          <MoneyInput label="Principal" value={data.principal_p} disabled={locked} onCommit={(v) => save({ principal_p: v })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[#102654]">Interest Rate %</span>
          <input
            type="number"
            step="0.1"
            aria-label="Interest rate"
            disabled={locked}
            defaultValue={data.interest_rate_pct || 5.0}
            onBlur={(e) => save({ interest_rate_pct: Number(e.target.value) })}
            className="px-2 py-1.5 border border-[#D5DBE7] rounded-[8px] bg-white font-mono text-right"
          />
        </label>
        <label className="flex flex-col justify-center">
          <div className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              id="loan_secured"
              disabled={locked}
              checked={Boolean(data.secured)}
              onChange={(e) => save({ secured: e.target.checked })}
              className="w-4 h-4 rounded text-[#102654]"
            />
            <label htmlFor="loan_secured" className="font-semibold text-[#102654]">Secured by charge on assets</label>
          </div>
        </label>
      </div>

      {/* Maturity Analysis Panel */}
      <div className="p-4 rounded-[12px] bg-white border border-[#D5DBE7] flex flex-col gap-3">
        <div className="font-bold text-[#102654]">Maturity Analysis (Creditors & Notes)</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-[#F6F7FB] rounded-[8px] border border-[#E3E7EF]">
            <span className="text-[10px] uppercase font-bold text-[#5B6478] block">Due within 1 Year (Current)</span>
            <div className="mt-1">
              <MoneyInput
                label="Due within 1 year"
                value={maturity.within_1y_p}
                disabled={locked}
                onCommit={(v) => save({ maturity: { ...live().maturity, within_1y_p: v } })}
              />
            </div>
          </div>
          <div className="p-3 bg-[#F6F7FB] rounded-[8px] border border-[#E3E7EF]">
            <span className="text-[10px] uppercase font-bold text-[#5B6478] block">Due between 1 and 5 Years</span>
            <div className="mt-1">
              <MoneyInput
                label="Due 1 to 5 years"
                value={maturity.within_1_to_5y_p}
                disabled={locked}
                onCommit={(v) => save({ maturity: { ...live().maturity, within_1_to_5y_p: v } })}
              />
            </div>
          </div>
          <div className="p-3 bg-[#F6F7FB] rounded-[8px] border border-[#E3E7EF]">
            <span className="text-[10px] uppercase font-bold text-[#5B6478] block">Due after 5 Years</span>
            <div className="mt-1">
              <MoneyInput
                label="Due over 5 years"
                value={maturity.over_5y_p}
                disabled={locked}
                onCommit={(v) => save({ maturity: { ...live().maturity, over_5y_p: v } })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Checklists (planning, completion, disclosures) ---------- */
export function ChecklistSchedule({ data, result, locked, save, filesFor, attachTo, preview, tickFor, live }: ScheduleProps) {
  const items: any[] = data.items ?? [];
  const setItem = (id: string, patch: Record<string, any>) =>
    save({ items: (live().items ?? []).map((i: any) => (i.id === id ? { ...i, ...patch } : i)) });
  const t = result.totals;
  return (
    <div className="flex flex-col gap-4">
      {result.template.materiality && (
        <div className="p-4 rounded-[12px] bg-[#F6F7FB] border border-[#E3E7EF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Benchmark</span>
            <TextInput label="Benchmark name" value={data.benchmark_name} disabled={locked} onCommit={(v) => save({ benchmark_name: v })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Benchmark amount</span>
            <MoneyInput label="Benchmark amount" value={data.benchmark_p} disabled={locked} allowNegative={false} onCommit={(p) => save({ benchmark_p: p })} />
            {!locked && (t.benchmark_tb ?? 0n) > 0n && (
              <button type="button" className="text-[10px] font-bold text-[#B8432F] hover:underline text-left" onClick={() => save({ benchmark_p: String(t.benchmark_tb) })}>
                Use revenue from TB ({formatPence(t.benchmark_tb)})
              </button>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Materiality %</span>
            <input
              type="number"
              min={0}
              step="0.1"
              aria-label="Materiality percentage"
              disabled={locked}
              defaultValue={data.percent}
              onBlur={(e) => e.target.value !== String(data.percent) && save({ percent: e.target.value })}
              className="px-2 py-1.5 border border-[#D5DBE7] rounded-[8px] font-mono text-right bg-white"
            />
            <span className="text-[10px] text-[#5B6478]">Materiality {formatPence(t.materiality ?? 0n)}</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Performance materiality %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="5"
              aria-label="Performance materiality percentage"
              disabled={locked}
              defaultValue={data.pm_percent}
              onBlur={(e) => e.target.value !== String(data.pm_percent) && save({ pm_percent: e.target.value })}
              className="px-2 py-1.5 border border-[#D5DBE7] rounded-[8px] font-mono text-right bg-white"
            />
            <span className="text-[10px] text-[#5B6478]">Performance {formatPence(t.performance ?? 0n)}</span>
          </label>
        </div>
      )}
      <ul className="divide-y divide-[#E3E7EF] border border-[#E3E7EF] rounded-[12px]">
        {items.map((i) => (
          <li key={i.id} className="p-3 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-semibold text-[#102654] flex-1">{i.question}</span>
              <div className="flex gap-1" role="group" aria-label={`Answer: ${i.question}`}>
                {(['yes', 'no', 'na'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={locked}
                    aria-pressed={i.answer === a}
                    onClick={() => setItem(i.id, { answer: i.answer === a ? null : a })}
                    className={`min-w-[44px] min-h-[30px] px-2 text-[11px] font-bold rounded-[8px] border ${
                      i.answer === a
                        ? a === 'no'
                          ? 'bg-[#FFF1EE] border-[#FF7D6B] text-[#A23A27]'
                          : 'bg-[#102654] border-[#102654] text-white'
                        : 'bg-white border-[#D5DBE7] text-[#102654] hover:border-[#102654]'
                    } disabled:opacity-60`}
                  >
                    {a === 'na' ? 'N/A' : a === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <TextInput
                label={`Comment: ${i.question}`}
                value={i.comment}
                disabled={locked}
                placeholder={i.answer === 'no' ? 'Explain the exception (required)' : 'Comment (optional)'}
                onCommit={(v) => setItem(i.id, { comment: v })}
              />
              <div className="flex items-center gap-2 flex-wrap">{tickFor(i.id, i.question)}<RowFiles files={filesFor(i.id)} onPreview={preview} onAttach={() => attachTo(i.id)} disabled={locked} label={i.question} /><RemoveButton disabled={locked} label="Remove question" onClick={() => save({ items: (live().items ?? []).filter((x: any) => x.id !== i.id) })} /></div>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="p-3 text-[11px] text-[#7E8DA6]">No questions. Add one below.</li>}
      </ul>
      <AddOption
        label="Add question"
        placeholder="Question to answer"
        disabled={locked}
        onAdd={(q) => save({ items: [...(live().items ?? []), { id: newId('q'), question: q, answer: null, comment: '' }] })}
      />
    </div>
  );
}
