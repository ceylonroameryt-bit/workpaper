'use client';

import { useState } from 'react';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';
import { Engagement } from '@/lib/types/models';
import { Frequency, FREQUENCY_MONTHS, periodLabel, periodStart as startOf } from '@/lib/periods';

const FREQUENCIES: [Frequency, string][] = [['year_end', 'Year-end'], ['quarterly', 'Quarterly'], ['monthly', 'Monthly']];
const field = 'mt-1 w-full min-h-[38px] px-3 border border-[#D3DCEE] rounded-[8px] text-xs text-[#122654] bg-white';

/** Corrects an engagement's frequency and dates, e.g. a yearly client that was set up as a quarter. */
export function ChangePeriodDialog({ engagement, onClose, onSaved }: { engagement: Engagement; onClose: () => void; onSaved: () => void }) {
  const [frequency, setFrequency] = useState<Frequency>(engagement.frequency ?? 'year_end');
  const [end, setEnd] = useState(engagement.period_end);
  const [start, setStart] = useState(engagement.period_start);
  const [error, setError] = useState('');

  const pick = (f: Frequency, e: string) => {
    setFrequency(f);
    setEnd(e);
    if (e) setStart(startOf(e, FREQUENCY_MONTHS[f]));
  };

  const save = () => {
    if (!start || !end || start >= end) return setError('Set a period start before the period end.');
    const before = { period_start: engagement.period_start, period_end: engagement.period_end, frequency: engagement.frequency ?? 'year_end' };
    db.logAudit(engagement.firm_id, getActor(), 'CHANGE_PERIOD', 'engagements', engagement.id, before, { period_start: start, period_end: end, frequency });
    // The header can hold an older copy after a workspace reload, so change the stored row
    Object.assign(db.engagements.find((e) => e.id === engagement.id) ?? engagement, { period_start: start, period_end: end, frequency });
    onSaved();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Change period" className="fixed inset-0 z-50 bg-[#0B1A3B]/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs text-[#122654]">
        <h3 className="text-base font-bold">Change period</h3>
        <p className="text-[#4A5878]">Now: {periodLabel(engagement)}. Pull from the ledger again afterwards so the figures and transactions cover the new dates.</p>

        <label className="block font-semibold">
          How often
          <select value={frequency} onChange={(e) => pick(e.target.value as Frequency, end)} className={field}>
            {FREQUENCIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block font-semibold">
            Period start
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
          </label>
          <label className="block font-semibold">
            Period end
            <input type="date" value={end} onChange={(e) => pick(frequency, e.target.value)} className={field} />
          </label>
        </div>

        {error && <p role="alert" className="text-[#B42318] font-medium">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-[36px] px-3 font-bold cursor-pointer">Cancel</button>
          <button type="button" onClick={save} className="min-h-[36px] px-4 bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold rounded-[8px] cursor-pointer">Save period</button>
        </div>
      </div>
    </div>
  );
}
