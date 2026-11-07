'use client';

import React, { useState } from 'react';
import { db } from '@/lib/server/db';
import { BlyntAccount } from '@/lib/types/models';
import { CATEGORIES, accountsIn, categoryOf, newAccount, nextCode } from '@/lib/coa';
import { matchBlyntAccount } from '@/lib/mapping/auto-mapper';

const field = 'w-full py-1.5 px-2 border border-[#D3DCEE] rounded-lg bg-white text-xs text-[#122654]';

/**
 * Creates a practice account: the name recommends a category, the code is the next free number
 * in that category's range and cannot leave it.
 */
export function NewAccountForm({ firmId, initialName = '', onCreated, onCancel }: { firmId: string; initialName?: string; onCreated: (acc: BlyntAccount) => void; onCancel: () => void }) {
  const recommend = (n: string) => {
    const s = n.trim() ? matchBlyntAccount(n) : null;
    const cat = (s && categoryOf(s.blynt_code)) || CATEGORIES.find((c) => c.other === '499')!;
    return { cat: CATEGORIES.indexOf(cat), base: s && categoryOf(s.blynt_code) ? s.blynt_code : cat.other };
  };
  const first = recommend(initialName);
  const [name, setName] = useState(initialName);
  const [catIdx, setCatIdx] = useState(first.cat);
  const [base, setBase] = useState(first.base);
  const [code, setCode] = useState(nextCode(db.blynt_accounts, CATEGORIES[first.cat], first.base) ?? '');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const cat = CATEGORIES[catIdx];

  const choose = (idx: number, b: string) => {
    setCatIdx(idx);
    setBase(b);
    setCode(nextCode(db.blynt_accounts, CATEGORIES[idx], b) ?? '');
    setError('');
  };
  const onName = (n: string) => {
    setName(n);
    if (!touched) {
      const r = recommend(n);
      choose(r.cat, r.base);
    }
  };
  const save = () => {
    if (Number(code) < cat.from || Number(code) > cat.to) return setError(`Use a code from ${cat.from} to ${cat.to} for ${cat.name}.`);
    const acc = newAccount(db.blynt_accounts, code, name, firmId, base);
    if (typeof acc === 'string') return setError(acc);
    db.blynt_accounts.push(acc);
    onCreated(acc);
  };

  return (
    <div className="p-3 border border-[#D3DCEE] rounded-xl bg-[#F5F8FD] space-y-2 text-[11px] text-[#4A5878]">
      <label className="block space-y-1">
        <span className="font-semibold">Account name</span>
        <input autoFocus value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Website hosting" className={field} />
      </label>
      <label className="block space-y-1">
        <span className="font-semibold">Category {!touched && name.trim() && <span className="text-[#0B6B52]">(recommended)</span>}</span>
        <select value={catIdx} onChange={(e) => { setTouched(true); choose(Number(e.target.value), CATEGORIES[Number(e.target.value)].other); }} className={field}>
          {CATEGORIES.map((c, i) => (
            <option key={c.name} value={i}>{c.from}–{c.to} {c.name}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-semibold">Classify like</span>
        <select value={base} onChange={(e) => { setTouched(true); choose(catIdx, e.target.value); }} className={field}>
          {accountsIn(cat).map((a) => (
            <option key={a.code} value={a.code}>{a.code === cat.other ? `Other: ${a.code} ${a.name}` : `${a.code} ${a.name}`}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-semibold">Code (next free, {cat.from}–{cat.to})</span>
        <input type="number" min={cat.from} max={cat.to} value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} className={field} />
      </label>
      {error && <p role="alert" className="text-[#B8432F]">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="font-semibold">Cancel</button>
        <button type="button" onClick={save} disabled={!code || !name.trim()} className="px-3 py-1 rounded-lg bg-[#122654] text-white font-semibold disabled:opacity-50">Create</button>
      </div>
    </div>
  );
}
