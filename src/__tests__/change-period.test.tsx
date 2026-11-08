import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChangePeriodDialog } from '../components/layout/ChangePeriodDialog';
import { db } from '../lib/server/db';
import { periodLabel } from '../lib/periods';

afterEach(cleanup);

describe('changing an engagement’s period', () => {
  const setup = () => {
    db.seed(true);
    const eng = db.engagements.find((e) => e.id === 'eng_harlow_fy26')!;
    Object.assign(eng, { period_start: '2026-01-06', period_end: '2026-04-05', frequency: 'quarterly' });
    return eng;
  };

  it('turns a quarter into a year, working the start out from the end, and logs it', () => {
    const eng = setup();
    let saved = false;
    render(<ChangePeriodDialog engagement={eng} onClose={() => {}} onSaved={() => (saved = true)} />);
    expect(periodLabel(eng)).toBe('Quarter ended 5 Apr 2026');
    fireEvent.change(screen.getByLabelText('How often'), { target: { value: 'year_end' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save period' }));
    expect(saved).toBe(true);
    expect(eng).toMatchObject({ period_start: '2025-04-06', period_end: '2026-04-05', frequency: 'year_end' });
    expect(periodLabel(eng)).toBe('Year ended 5 Apr 2026');
    expect(db.audit_logs.some((a) => a.action === 'CHANGE_PERIOD' && a.entity_id === eng.id)).toBe(true);
  });

  it('changes the stored engagement even when given an older copy of it', () => {
    const eng = setup();
    render(<ChangePeriodDialog engagement={{ ...eng }} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText('How often'), { target: { value: 'year_end' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save period' }));
    expect(db.engagements.find((e) => e.id === eng.id)).toMatchObject({ period_start: '2025-04-06', frequency: 'year_end' });
  });

  it('refuses a start that is not before the end, and changes nothing', () => {
    const eng = setup();
    render(<ChangePeriodDialog engagement={eng} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText('Period start'), { target: { value: '2026-05-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save period' }));
    expect(screen.getByRole('alert').textContent).toMatch(/before the period end/);
    expect(eng.period_start).toBe('2026-01-06');
  });
});
