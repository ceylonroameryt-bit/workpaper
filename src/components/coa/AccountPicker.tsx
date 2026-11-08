'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { db } from '@/lib/server/db';
import { CATEGORIES, accountsForClient, categoryOf } from '@/lib/coa';
import { NewAccountForm } from '@/components/coa/NewAccountForm';

const MENU_WIDTH = 340;
const OTHER_GROUP = 'System and clearing';

/** Pick an account from the whole chart, grouped by category; typing filters by code or name. */
export function AccountPicker({ value, label, firmId, clientId, onPick, suggestName = '' }: { value: string; label: string; firmId: string; clientId?: string; onPick: (code: string) => void; suggestName?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const current = db.blynt_accounts.find((a) => a.code === value);
  const visible = () => accountsForClient(db.blynt_accounts, db.clients.find((c) => c.id === clientId));
  const currentText = current ? `${current.code} ${current.name}` : '';

  const groups = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = [...visible()]
      .sort((a, b) => Number(a.code) - Number(b.code))
      .filter((a) => words.every((w) => `${a.code} ${a.name}`.toLowerCase().includes(w)));
    return [...CATEGORIES.map((c) => c.name), OTHER_GROUP]
      .map((name) => ({ name, accounts: matches.filter((a) => (categoryOf(a.code)?.name ?? OTHER_GROUP) === name) }))
      .filter((g) => g.accounts.length > 0);
  }, [query, open]); // eslint-disable-line react-hooks/exhaustive-deps -- `open` picks up accounts created since the last open

  const flat = groups.flatMap((g) => g.accounts);
  const optionId = (code: string) => `${listId}-${code}`;

  const openMenu = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const flip = below < 240 && r.top > below;
    const width = Math.min(Math.max(r.width, MENU_WIDTH), window.innerWidth - 16);
    setMenuStyle({
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      width,
      maxHeight: Math.min(340, (flip ? r.top : below) - 12),
      ...(flip ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
    setQuery('');
    setActive(Math.max(0, [...visible()].sort((a, b) => Number(a.code) - Number(b.code)).findIndex((a) => a.code === value)));
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const startCreating = () => {
    setOpen(false); // keeps the query, which pre-fills the new account's name
    setCreating(true);
  };

  const choose = (code: string) => {
    close();
    inputRef.current?.blur();
    if (code !== value) onPick(code);
  };

  // Close when clicking elsewhere, or when the page moves under the fixed menu
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !inputRef.current?.parentElement?.contains(t)) close();
    };
    const moved = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Keep the highlighted account in view
  useEffect(() => {
    if (open && flat[active]) document.getElementById(optionId(flat[active].code))?.scrollIntoView({ block: 'nearest' });
  }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      return openMenu();
    }
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) choose(flat[active].code);
      else if (query.trim()) startCreating();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  let index = -1;
  return (
    <div className="w-full max-w-[260px] space-y-1.5">
      <div className="flex gap-1">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && flat[active] ? optionId(flat[active].code) : undefined}
            autoComplete="off"
            value={open ? query : currentText}
            placeholder={open ? currentText || 'Search code or name…' : 'Select an account…'}
            onFocus={() => !open && openMenu()}
            onClick={() => !open && openMenu()}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="w-full text-xs font-semibold py-1.5 pl-2 pr-6 border border-[#D3DCEE] focus:border-[#122654] rounded-lg bg-white text-[#122654] truncate outline-none cursor-pointer"
          />
          <ChevronDown aria-hidden="true" className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5878] pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
        <button type="button" onClick={startCreating} title="Create a new account" aria-label="Create a new account" className="px-2 text-xs font-bold border border-[#D3DCEE] rounded-lg text-[#122654] hover:bg-[#EAF5FC]">
          +
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={label}
            style={menuStyle}
            className="fixed z-[60] overflow-y-auto bg-white border border-[#D3DCEE] rounded-[10px] shadow-xl py-1 text-xs text-[#122654]"
          >
            {groups.map((g) => (
              <div key={g.name} role="group" aria-label={g.name}>
                <div className="sticky top-0 bg-[#F5F8FD] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4A5878]">{g.name}</div>
                {g.accounts.map((a) => {
                  index += 1;
                  const i = index;
                  return (
                    <div
                      key={a.code}
                      id={optionId(a.code)}
                      role="option"
                      aria-selected={a.code === value}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(a.code)}
                      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${i === active ? 'bg-[#EAF5FC]' : ''}`}
                    >
                      <span className="font-mono text-[#4A5878] w-8 shrink-0">{a.code}</span>
                      <span className={`flex-1 min-w-0 ${a.code === value ? 'font-bold' : ''}`}>{a.name}</span>
                      {a.code === value && <Check className="w-3.5 h-3.5 text-[#0B6B52] shrink-0" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            ))}
            {flat.length === 0 && (
              <div className="px-3 py-2 text-[#4A5878]">
                No account matches.{' '}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={startCreating} className="font-bold text-[#B8432F] hover:underline">
                  Create “{query.trim()}”
                </button>
              </div>
            )}
          </div>,
          document.body
        )}

      {creating &&
        createPortal(
          // A dialog, not inline: the table cell is too narrow to show full account names
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New account"
            onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
            className="fixed inset-0 z-50 bg-[#0B1A3B]/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-xl border border-[#E3E7EF] shadow-2xl max-w-md w-full p-6">
              <h3 className="text-base font-bold text-[#122654] mb-4">New account</h3>
              <NewAccountForm
                firmId={firmId}
                clientId={clientId}
                initialName={query.trim().replace(/^\d+\s*/, '') || suggestName}
                onCancel={() => setCreating(false)}
                onUseExisting={(code) => {
                  setCreating(false);
                  close();
                  if (code !== value) onPick(code);
                }}
                onCreated={(acc) => {
                  setCreating(false);
                  close();
                  onPick(acc.code);
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
