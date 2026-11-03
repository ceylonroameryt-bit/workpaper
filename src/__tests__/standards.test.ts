import { describe, it, expect } from 'vitest';
import { STANDARDS, standardFor, requiredSchedules } from '../lib/standards';

describe('standards library data model (STD-01)', () => {
  it('each standard version has an effective date and its content collections', () => {
    for (const s of STANDARDS) {
      expect(s.effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(s.disclosures) && Array.isArray(s.checklist) && Array.isArray(s.note_templates)).toBe(true);
      expect(s.company_types.length).toBeGreaterThan(0);
    }
  });

  it('picks the version in force at the period end', () => {
    expect(standardFor('Small company (FRS 102 1A)', '2026-03-31')!.version).toBe('2024 amendments');
    expect(standardFor('Small company (FRS 102 1A)', '2025-12-31')!.version).toBe('2022 edition');
    expect(standardFor('Micro-entity (FRS 105)', '2026-03-31')!.code).toBe('FRS 105');
    expect(standardFor('Sole trader', '2026-03-31')).toBeNull();
  });

  it('FRS 105 and FRS 102 1A require different schedules', () => {
    const micro = requiredSchedules(standardFor('Micro-entity (FRS 105)', '2026-03-31')!);
    const small = requiredSchedules(standardFor('Small company (FRS 102 1A)', '2026-03-31')!);
    expect(small).toContain('T-30'); // deferred tax
    expect(micro).not.toContain('T-30'); // not allowed under FRS 105
    expect(small.length).toBeGreaterThan(micro.length);
  });
});
