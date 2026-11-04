'use client';

import React, { useEffect, useState } from 'react';
import { Paperclip, X, Download } from 'lucide-react';
import { db } from '@/lib/server/db';
import { asPence, toPence, formatPence, formatPenceInput } from '@/lib/money';
import { getActor } from '@/lib/session';
import type { Attachment, AttachmentCategory, Workpaper } from '@/lib/types/models';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const CATEGORIES: AttachmentCategory[] = [
  'Invoice',
  'Statement',
  'Confirmation',
  'Register',
  'Photo',
  'From client',
  'Board minute',
  'Valuation',
  'Other',
];

export const fileUrl = (a: Attachment, download = false) =>
  `/api/v1/files/${encodeURIComponent(a.file_key)}${download ? '?download=1' : ''}`;

export const fileKind = (a: Attachment) => {
  if (a.mime === 'application/pdf') return 'PDF';
  if (a.mime.startsWith('image/')) return 'IMG';
  if (/sheet|excel|csv/.test(a.mime) || /\.(xlsx?|csv)$/i.test(a.filename)) return 'XLS';
  if (/word|document/.test(a.mime) || /\.docx?$/i.test(a.filename)) return 'DOC';
  if (/\.eml$/i.test(a.filename) || a.mime === 'message/rfc822') return 'EML';
  return 'FILE';
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Show a ledger figure with brackets for credits. */
export const fmtTb = (p: bigint) => (p < 0n ? `(${formatPence(-p, { symbol: '' })})` : formatPence(p, { symbol: '' }));

export type SectionState = 'done' | 'progress' | 'attention' | 'todo';
const STATE_META: Record<SectionState, { symbol: string; label: string; cls: string }> = {
  done: { symbol: '✓', label: 'Done', cls: 'text-[#0B6B52] bg-[#E6F4EF] border-[#0B6B52]/30' },
  progress: { symbol: '◑', label: 'In progress', cls: 'text-[#1D4E89] bg-[#EAF5FC] border-[#1D4E89]/30' },
  attention: { symbol: '!', label: 'Needs you', cls: 'text-[#A23A27] bg-[#FFF1EE] border-[#FF7A66]/40' },
  todo: { symbol: '○', label: 'Not started', cls: 'text-[#4A5878] bg-[#F4F5F7] border-[#D3DCEE]' },
};

export function StatePill({ state, label }: { state: SectionState; label?: string }) {
  const m = STATE_META[state];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${m.cls}`}>
      {m.symbol} {label ?? m.label}
    </span>
  );
}

export function Section({
  id,
  num,
  title,
  state,
  stateLabel,
  actions,
  children,
}: {
  id: string;
  num: number;
  title: string;
  state: SectionState;
  stateLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="blynt-card p-5 scroll-mt-24">
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-[#E3E7EF]">
        <span className="w-6 h-6 rounded-full bg-[#122654] text-white text-xs font-bold flex items-center justify-center shrink-0">
          {num}
        </span>
        <h2 className="text-sm sm:text-base font-bold text-[#122654]">{title}</h2>
        <StatePill state={state} label={stateLabel} />
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function MoneyInput({
  value,
  disabled,
  onCommit,
  label,
  allowNegative = true,
}: {
  value: string | undefined;
  disabled: boolean;
  onCommit: (pence: string) => void;
  label: string;
  allowNegative?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatPenceInput(value || '0');
  const commit = () => {
    if (draft === null) return;
    let pence: bigint;
    try {
      pence = toPence(draft);
    } catch {
      setDraft(null);
      return;
    }
    if (!allowNegative && pence < 0n) pence = -pence;
    setDraft(null);
    if (pence !== asPence(value || '0')) onCommit(pence.toString());
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      disabled={disabled}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="w-full min-w-[92px] px-2 py-1.5 text-right font-mono text-xs bg-white border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66] disabled:bg-[#F5F8FD] disabled:text-[#4A5878]"
    />
  );
}

export function TextInput({
  value,
  disabled,
  onCommit,
  label,
  placeholder,
  className = '',
}: {
  value: string | undefined;
  disabled: boolean;
  onCommit: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      aria-label={label}
      disabled={disabled}
      placeholder={placeholder}
      value={draft ?? value ?? ''}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== (value ?? '')) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`w-full px-2 py-1.5 text-xs bg-white border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66] disabled:bg-[#F5F8FD] ${className}`}
    />
  );
}

/** Upload files to storage and attach them to a working paper, optionally linked to a schedule row. */
export async function uploadToPaper(
  wp: Workpaper,
  files: File[],
  opts: { category: AttachmentCategory; rowId?: string | null; permanent?: boolean }
): Promise<{ added: Attachment[]; errors: string[] }> {
  const actor = getActor();
  const engagement = db.engagements.find((e) => e.id === wp.engagement_id);
  const added: Attachment[] = [];
  const errors: string[] = [];
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) {
      errors.push(`${f.name} is larger than 4 MB.`);
      continue;
    }
    try {
      const res = await fetch('/api/v1/files', {
        method: 'POST',
        headers: { 'Content-Type': f.type || 'application/octet-stream', 'x-filename': encodeURIComponent(f.name) },
        body: f,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Upload failed');
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const att: Attachment = {
        id,
        engagement_id: wp.engagement_id,
        workpaper_id: wp.id,
        file_key: body.file_key,
        filename: f.name,
        mime: body.mime,
        size: body.size,
        sha256: body.sha256,
        category: opts.category,
        is_permanent: Boolean(opts.permanent),
        uploaded_by: actor.id,
        uploaded_by_name: actor.name,
        uploaded_at: new Date().toISOString(),
        links: opts.rowId ? [{ attachment_id: id, anchor_json: { kind: 'row', table: 'schedule', row: opts.rowId } }] : [],
      };
      db.attachments.push(att);
      db.logAudit(engagement?.firm_id ?? 'firm_blynt_uk', actor, 'UPLOAD_ATTACHMENT', 'attachments', id, null, {
        filename: att.filename,
        sha256: att.sha256,
        size: att.size,
        workpaper: wp.ref,
      });
      added.push(att);
    } catch (err: any) {
      errors.push(`${f.name}: ${err?.message || 'upload failed'}`);
    }
  }
  return { added, errors };
}

export interface Tickmark {
  code: string;
  label: string;
}

export const DEFAULT_TICKMARKS: Tickmark[] = [
  { code: 'TB', label: 'Agreed to trial balance' },
  { code: 'BS', label: 'Agreed to bank statement' },
  { code: 'AS', label: 'Agreed to after-date statement' },
  { code: 'IV', label: 'Vouched to invoice' },
  { code: 'C', label: 'Cast and cross-cast' },
];

/** Tickmarks on one schedule row: shows the chosen marks and lets you pick or add more. */
export function TickmarkPicker({
  library,
  value,
  onChange,
  onAddToLibrary,
  disabled,
  label,
}: {
  library: Tickmark[];
  value: string[];
  onChange: (ticks: string[]) => void;
  onAddToLibrary: (t: Tickmark) => void;
  disabled: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  const addNew = () => {
    const c = code.trim().toUpperCase().slice(0, 4);
    if (!c) return;
    if (!library.some((t) => t.code === c)) onAddToLibrary({ code: c, label: desc.trim() || c });
    if (!value.includes(c)) onChange([...value, c]);
    setCode('');
    setDesc('');
  };
  return (
    <div className="relative inline-flex items-center gap-1 flex-wrap">
      {value.map((c) => (
        <span
          key={c}
          title={library.find((t) => t.code === c)?.label ?? c}
          className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/30"
        >
          {c}
        </span>
      ))}
      {!disabled && (
        <button
          type="button"
          aria-label={`Tickmarks for ${label}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="text-[10px] font-bold text-[#4A5878] hover:text-[#122654] border border-dashed border-[#D3DCEE] hover:border-[#122654] rounded px-1 py-0.5"
        >
          ✓{value.length ? '' : ' Tick'}
        </button>
      )}
      {open && (
        <div className="absolute z-20 top-full right-0 mt-1 w-60 p-2 bg-white border border-[#D3DCEE] rounded-[10px] shadow-lg text-xs text-left">
          {library.map((t) => (
            <label key={t.code} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[#F5F8FD] cursor-pointer">
              <input type="checkbox" checked={value.includes(t.code)} onChange={() => toggle(t.code)} />
              <span className="font-mono font-bold w-8">{t.code}</span>
              <span className="text-[#4A5878] truncate">{t.label}</span>
            </label>
          ))}
          <div className="mt-1 pt-2 border-t border-[#E3E7EF] flex flex-col gap-1">
            <span className="text-[10px] font-bold text-[#4A5878]">Add a tickmark</span>
            <div className="flex gap-1">
              <input
                aria-label="New tickmark code"
                placeholder="Code"
                value={code}
                maxLength={4}
                onChange={(e) => setCode(e.target.value)}
                className="w-14 px-1.5 py-1 border border-[#D3DCEE] rounded font-mono uppercase"
              />
              <input
                aria-label="New tickmark meaning"
                placeholder="Meaning"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNew()}
                className="flex-1 min-w-0 px-1.5 py-1 border border-[#D3DCEE] rounded"
              />
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={addNew} disabled={!code.trim()} className="text-[11px] font-bold text-[#122654] disabled:opacity-40">
                + Add
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-[#4A5878]">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline "+ Add …" control that asks for one value. */
export function AddOption({
  label,
  placeholder,
  onAdd,
  disabled,
}: {
  label: string;
  placeholder: string;
  onAdd: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  if (disabled) return null;
  const submit = () => {
    if (!v.trim()) return;
    onAdd(v.trim());
    setV('');
    setOpen(false);
  };
  return open ? (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        aria-label={label}
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setOpen(false);
        }}
        className="px-2 py-1 text-xs border border-[#D3DCEE] rounded-[8px]"
      />
      <button type="button" onClick={submit} disabled={!v.trim()} className="text-xs font-bold text-[#122654] disabled:opacity-40">
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#4A5878]">
        Cancel
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-bold text-[#B8432F] hover:underline">
      + {label}
    </button>
  );
}

/** Small file chips shown on a schedule row, plus an attach button for that row. */
export function RowFiles({
  files,
  onPreview,
  onAttach,
  disabled,
  label,
}: {
  files: Attachment[];
  onPreview: (a: Attachment) => void;
  onAttach: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {files.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onPreview(f)}
          title={f.filename}
          className="inline-flex items-center gap-1 max-w-[150px] text-[10px] font-semibold text-[#B8432F] hover:underline"
        >
          <Paperclip className="w-3 h-3 shrink-0" />
          <span className="truncate">{f.filename}</span>
        </button>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={onAttach}
          aria-label={`Attach a file to ${label}`}
          title="Attach a file to this row"
          className="text-[10px] font-bold text-[#4A5878] hover:text-[#122654] border border-dashed border-[#D3DCEE] hover:border-[#122654] rounded px-1.5 py-0.5"
        >
          ⧉ {files.length ? '+' : 'Attach'}
        </button>
      )}
    </div>
  );
}

export function PreviewModal({ file, onClose }: { file: Attachment | null; onClose: () => void }) {
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);
  if (!file) return null;
  const kind = fileKind(file);
  const inline = kind === 'PDF' || (kind === 'IMG' && !/svg/.test(file.mime)) || /^text\/(plain|csv)$/.test(file.mime);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.filename}`}
      className="fixed inset-0 z-50 bg-[#0B1A3B]/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-3 border-b border-[#E3E7EF]">
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#122654] truncate">{file.filename}</div>
            <div className="text-[10px] font-mono text-[#4A5878] truncate">
              {file.category} · {(file.size / 1024).toFixed(1)} KB · sha256 {file.sha256.slice(0, 12)}…
            </div>
          </div>
          <a
            href={fileUrl(file, true)}
            className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#122654] border border-[#D3DCEE] rounded-[8px] px-3 py-1.5 hover:border-[#122654]"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
          <button type="button" onClick={onClose} aria-label="Close preview" className="p-1.5 text-[#4A5878] hover:text-[#122654]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-[300px] bg-[#F5F8FD] overflow-auto">
          {inline ? (
            kind === 'IMG' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(file)} alt={file.filename} className="max-w-full mx-auto" />
            ) : (
              <iframe src={fileUrl(file)} title={file.filename} className="w-full h-[75vh] bg-white" />
            )
          ) : (
            <div className="p-10 text-center text-sm text-[#4A5878]">
              This file type can’t be previewed in the browser. Use Download to open it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
