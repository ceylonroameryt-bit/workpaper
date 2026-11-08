import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ClientWorkpapers } from '../components/clients/ClientWorkpapers';
import { db } from '../lib/server/db';
import { TEMPLATES } from '../lib/workpapers/templates';

afterEach(cleanup);

describe('working papers on the client page', () => {
  const setup = () => {
    db.seed(true);
    const eng = db.engagements.find((e) => e.client_id === 'cli_harlow' && e.period_end === '2026-09-30')!;
    db.workpapers = db.workpapers.filter((w) => w.engagement_id !== eng.id);
    db.addWorkpaper(eng.id, 'B-10');
    db.addWorkpaper(eng.id, 'I-10');
    db.engagements = db.engagements.filter((e) => e.client_id !== 'cli_harlow' || e.id === eng.id);
    return eng;
  };

  it('names every working paper, and links those in the file', () => {
    const eng = setup();
    render(<ClientWorkpapers clientId="cli_harlow" />);
    expect(screen.getByRole('link', { name: /B-10.*Bank and cash/ }).getAttribute('href')).toBe(`/engagements/${eng.id}/workpapers/wp_${eng.id}_b10`);
    for (const t of TEMPLATES) expect(screen.getAllByText(t.title).length).toBeGreaterThan(0);
    expect(screen.getByText(`Not in this file (${TEMPLATES.length - 2})`)).toBeTruthy();
  });

  it('adds a paper to the file', () => {
    const eng = setup();
    render(<ClientWorkpapers clientId="cli_harlow" />);
    fireEvent.click(screen.getByRole('button', { name: /^Add P-20/ }));
    expect(db.workpapers.some((w) => w.engagement_id === eng.id && w.ref === 'P-20')).toBe(true);
    expect(screen.getByRole('link', { name: /P-20/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Add P-20/ })).toBeNull();
  });

  it('offers no Add on a locked period', () => {
    const eng = setup();
    eng.status = 'locked';
    render(<ClientWorkpapers clientId="cli_harlow" />);
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
    expect(screen.getByText(`Not in this file (${TEMPLATES.length - 2})`)).toBeTruthy();
  });
});
