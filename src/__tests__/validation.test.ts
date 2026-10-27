// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { emailError, passwordChecks, passwordError } from '../lib/validation';

describe('email rules', () => {
  it('accepts real addresses', () => {
    for (const e of ['alex.wright@wrightaudit.co.uk', 'a+tag@firm.com', "o'neil@practice.ie", ' padded@firm.co.uk ']) {
      expect(emailError(e)).toBeNull();
    }
  });

  it('rejects malformed addresses', () => {
    for (const e of ['', 'alex', 'alex@', '@firm.com', 'alex@firm', 'alex@firm.c', 'alex wright@firm.com', 'alex..w@firm.com', 'alex@@firm.com', '.alex@firm.com', 'alex@-firm.com']) {
      expect(emailError(e)).not.toBeNull();
    }
  });

  it('suggests a fix for common domain typos', () => {
    expect(emailError('alex@gmial.com')).toBe('Did you mean alex@gmail.com?');
  });
});

describe('password rules', () => {
  const ctx = { email: 'marcus.sterling@sterlingaudit.co.uk', name: 'Marcus Sterling' };

  it('a strong password passes every check', () => {
    expect(passwordError('Tidy-Ledger-2026!', ctx)).toBeNull();
    expect(passwordChecks('Tidy-Ledger-2026!', ctx).every((c) => c.ok)).toBe(true);
  });

  it('names the first rule a weak password misses', () => {
    expect(passwordError('Short1!', ctx)).toMatch(/12 characters/);
    expect(passwordError('alllowercase2026!', ctx)).toMatch(/uppercase/);
    expect(passwordError('No-Numbers-Here!', ctx)).toMatch(/number/);
    expect(passwordError('NoSymbolsHere2026', ctx)).toMatch(/symbol/);
    expect(passwordError('Sterling-Audit-2026!', ctx)).toMatch(/name or email/);
  });
});
