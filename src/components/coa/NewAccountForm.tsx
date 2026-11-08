'use client';

import { useState } from 'react';
import { db } from '@/lib/server/db';
import { BlyntAccount } from '@/lib/types/models';
import { CATEGORIES, categoryOf, newAccount, newAccountBase, nextCode, similarAccounts } from '@/lib/coa';
import { matchBlyntAccount } from '@/lib/mapping/auto-mapper';

const field = 'w-full py-1.5 px-2 border border-[#D3DCEE] rounded-lg bg-white text-xs text-[#122654]';

/**
 * Creates a practice account: the name recommends a category, the code is the next free number
 * in that category's range and cannot leave it. Nothing is created until the user approves it.
 */
export function NewAccountForm({ firmId, initialName = '', onCreated, onCancel, onUseExisting }: { firmId: string; initialName?: string; onCreated: (acc: BlyntAccount) => void; onCancel: () => void; onUseExisting?: (code: string) => void }) {
  const recommend = (n: string) => {
    const rec = newAccountBase(n) ?? (n.trim() ? matchBlyntAccount(n)?.blynt_code : null);
    const cat = (rec && categoryOf(rec)) || CATEGORIES.find((c) => c.other === '499')!;
    return { cat: CATEGORIES.indexOf(cat), base: rec && categoryOf(rec) ? rec : cat.other };
  };
  const first = recommend(initialName);
  const [name, setName] = useState(initialName);
  const [catIdx, setCatIdx] = useState(first.cat);
  const [base, setBase] = useState(first.base);
  const [code, setCode] = useState(nextCode(db.blynt_accounts, CATEGORIES[first.cat], first.base) ?? '');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const cat = CATEGORIES[catIdx];
  const similar = similarAccounts(db.blynt_accounts, name);

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
      {similar.length > 0 && (
        <div role="status" className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[#122654] space-y-1">
          <p className="font-semibold">Similar accounts already exist. Check before adding another:</p>
          {similar.map((a) => (
            <div key={a.code} className="flex items-center justify-between gap-2">
              <span>{a.code} {a.name}</span>
              {onUseExisting && <button type="button" onClick={() => onUseExisting(a.code)} aria-label={`Use ${a.code} ${a.name}`} className="font-bold text-[#B8432F] hover:underline shrink-0">Use</button>}
            </div>
          ))}
        </div>
      )}
      <label className="block space-y-1">
        <span className="font-semibold">Category {!touched && name.trim() && <span className="text-[#0B6B52]">(recommended)</span>}</span>
        <select value={catIdx} onChange={(e) => { setTouched(true); choose(Number(e.target.value), CATEGORIES[Number(e.target.value)].other); }} className={field}>
          {CATEGORIES.map((c, i) => (
            <option key={c.name} value={i}>{c.from}–{c.to} {c.name}</option>
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
        <button type="button" onClick={save} disabled={!code || !name.trim()} className="px-3 py-1 rounded-lg bg-[#122654] text-white font-semibold disabled:opacity-50">Approve and create</button>
      </div>
    </div>
  );
}
