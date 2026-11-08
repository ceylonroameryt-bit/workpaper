import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { db } from '../lib/server/db';
import { customTemplate, nextCustomRef, templateOf } from '../lib/workpapers/templates';
import { evaluatePaper, paperStatus } from '../lib/workpapers/engine';
import { CustomPaperDialog } from '../components/workpaper/CustomPaperDialog';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const fresh = () => {
  db.seed(true);
  return db.engagements.find((e) => e.id === 'eng_harlow_fy26')!;
};
const lines = (ref = 'X-01') => customTemplate(ref, { title: ' Livestock valuation ', kind: 'lines', leads: [{ code: '700', label: 'Inventory' }], creditArea: false, questions: [] });

describe('custom working papers', () => {
  it('gives the next free reference', () => {
    expect(nextCustomRef(['B-10'])).toBe('X-01');
    expect(nextCustomRef(['X-01', 'X-03'])).toBe('X-02');
  });

  it('works like a standard paper: not started when blank, then compared with the trial balance', () => {
    const eng = fresh();
    const wp = db.addWorkpaper(eng.id, 'X-01', lines())!;
    expect(wp.data_json.title).toBe('Livestock valuation');
    expect(paperStatus(wp)).toBe('not_started');
    wp.data_json.lines = [{ id: 'l1', desc: 'Cattle', amount_p: '12345' }];
    const r = evaluatePaper(wp)!;
    expect(r.totals.total).toBe(12345n);
    expect(['reconciled', 'unreconciled']).toContain(paperStatus(wp));
  });

  it('ignores a damaged definition instead of breaking the page', () => {
    const base = { ref: 'X-01', data_json: {} };
    expect(templateOf({ ...base, custom_template: { ref: 'X-01', title: 'x', kind: 'lines' } as any })).toBeUndefined();
    expect(templateOf({ ...base, custom_template: { ...lines(), kind: 'vat' } as any })).toBeUndefined();
    expect(templateOf({ ...base, custom_template: lines('X-02') })).toBeUndefined();
    expect(templateOf({ ref: 'B-10' })?.title).toBe('Bank and cash reconciliation');
  });

  it('creates a checklist from the form, and asks for what is missing', () => {
    const eng = fresh();
    let created = '';
    render(<CustomPaperDialog engagementId={eng.id} firmId={eng.firm_id} onClose={() => {}} onCreated={(r) => (created = r)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create working paper' }));
    expect(screen.getByRole('alert').textContent).toMatch(/name/);
    fireEvent.change(screen.getByPlaceholderText('e.g. Livestock valuation'), { target: { value: 'Farm visit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create working paper' }));
    expect(screen.getByRole('alert').textContent).toMatch(/account/);
    fireEvent.click(screen.getByRole('radio', { name: /Checklist/ }));
    fireEvent.change(screen.getByLabelText(/Questions/), { target: { value: 'Stock counted?\n\nSheds inspected?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create working paper' }));
    expect(created).toBe('X-01');
    const wp = db.workpapers.find((w) => w.engagement_id === eng.id && w.ref === 'X-01')!;
    expect(templateOf(wp)?.title).toBe('Farm visit');
    expect(wp.data_json.items.map((i: any) => i.question)).toEqual(['Stock counted?', 'Sheds inspected?']);
  });
});
