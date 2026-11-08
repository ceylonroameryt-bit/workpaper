import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { AccountPicker } from '../components/coa/AccountPicker';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const setup = (value = '200') => {
  const onPick = vi.fn();
  render(<AccountPicker value={value} label="Account" firmId="firm_blynt_uk" onPick={onPick} />);
  const input = screen.getByRole('combobox', { name: 'Account' }) as HTMLInputElement;
  return { input, onPick };
};

describe('account selection menu', () => {
  it('shows the current account closed, and the whole chart grouped by category when opened', () => {
    const { input } = setup();
    expect(input.value).toBe('200 Purchases');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(input);
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option').length).toBeGreaterThanOrEqual(96); // not just the current account
    expect(within(list).getByRole('group', { name: 'Revenue' })).toBeTruthy();
    expect(within(list).getByRole('group', { name: 'Bank and cash' })).toBeTruthy();
    expect(within(list).getByRole('option', { selected: true }).textContent).toContain('Purchases');
  });

  it('filters by code or name and picks the clicked account', () => {
    const { input, onPick } = setup();
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'legal fe' } });
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('482');
    fireEvent.click(options[0]);
    expect(onPick).toHaveBeenCalledWith('482');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('works from the keyboard, and picking the same account changes nothing', () => {
    const { input, onPick } = setup('100');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // opens on the current account
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // next: 110
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('110');

    onPick.mockClear();
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Escape closes without changing the account, and no match offers to create one', () => {
    const { input, onPick } = setup();
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'zzz nothing' } });
    expect(screen.getByRole('button', { name: /Create .zzz nothing/ })).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('200 Purchases');
    expect(onPick).not.toHaveBeenCalled();
  });
});
