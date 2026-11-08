'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';
import { customTemplate, nextCustomRef } from '@/lib/workpapers/templates';
import { AccountPicker } from '@/components/coa/AccountPicker';

const LAYOUTS = [
  ['lines', 'Line schedule', 'List items and amounts; the total is compared with the accounts you pick'],
  ['checklist', 'Checklist', 'Yes or no questions with comments'],
] as const;
const field = 'mt-1 w-full px-3 py-2 border border-[#D3DCEE] rounded-[8px] text-xs text-[#122654]';

/** Creates a working paper for one engagement, with a name, layout and accounts the practice chooses. */
export function CustomPaperDialog({ engagementId, firmId, clientId, onClose, onCreated }: { engagementId: string; firmId: string; clientId?: string; onClose: () => void; onCreated: (ref: string) => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'lines' | 'checklist'>('lines');
  const [codes, setCodes] = useState<string[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [error, setError] = useState('');
  const accountOf = (code: string) => db.blynt_accounts.find((a) => a.code === code);

  const create = () => {
    const questions = questionText.split('\n').map((q) => q.trim()).filter(Boolean);
    if (!title.trim()) return setError('Give the working paper a name.');
    if (kind === 'lines' && !codes.length) return setError('Choose at least one account for the schedule to agree to.');
    if (kind === 'checklist' && !questions.length) return setError('Add at least one question.');
    const ref = nextCustomRef(db.workpapers.filter((w) => w.engagement_id === engagementId).map((w) => w.ref));
    const template = customTemplate(ref, {
      title,
      kind,
      questions,
      leads: codes.map((code) => ({ code, label: accountOf(code)?.name ?? code })),
      creditArea: codes.length > 0 && codes.every((c) => accountOf(c)?.normal_balance === 'Credit'),
    });
    const wp = db.addWorkpaper(engagementId, ref, template);
    db.logAudit(firmId, getActor(), 'ADD_WORKPAPER', 'workpapers', wp?.id ?? ref, null, { ref, title: template.title, custom: true });
    onCreated(ref);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Custom working paper" className="fixed inset-0 z-50 bg-[#0B1A3B]/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-full overflow-y-auto text-xs text-[#122654]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Custom working paper</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#4A5878] hover:text-[#122654] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block font-semibold">
          Name
          <input autoFocus value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Livestock valuation" className={field} />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="font-semibold mb-1">Layout</legend>
          {LAYOUTS.map(([value, label, description]) => (
            <label key={value} className={`flex items-start gap-2.5 p-2.5 rounded-[8px] border cursor-pointer ${kind === value ? 'border-[#1D4E89] bg-[#EEF2F9]' : 'border-[#E3E7EF]'}`}>
              <input type="radio" name="layout" checked={kind === value} onChange={() => setKind(value)} className="mt-0.5" />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="block text-[11px] text-[#4A5878]">{description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {kind === 'checklist' && (
          <label className="block font-semibold">
            Questions, one per line
            <textarea rows={4} value={questionText} onChange={(e) => setQuestionText(e.target.value)} className={field} />
          </label>
        )}

        <div>
          <p className="font-semibold mb-1">Accounts{kind === 'checklist' ? ' (optional)' : ''}</p>
          <AccountPicker key={codes.length} value="" label="Add an account" firmId={firmId} clientId={clientId} onPick={(code) => setCodes((c) => (c.includes(code) ? c : [...c, code]))} />
          {codes.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {codes.map((code) => (
                <li key={code} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#EAF5FC] text-[11px]">
                  {code} {accountOf(code)?.name}
                  <button type="button" onClick={() => setCodes((c) => c.filter((x) => x !== code))} aria-label={`Remove ${code}`} className="cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p role="alert" className="text-[#B42318] font-medium">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-[36px] px-3 font-bold cursor-pointer">Cancel</button>
          <button type="button" onClick={create} className="min-h-[36px] px-4 bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold rounded-[8px] cursor-pointer">Create working paper</button>
        </div>
      </div>
    </div>
  );
}
