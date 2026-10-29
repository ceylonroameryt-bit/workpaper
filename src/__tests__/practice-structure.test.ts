import { describe, it, expect } from 'vitest';
import { structureFields, companyNumberError } from '../lib/practice-structure';

describe('practice structure', () => {
  it('only companies and LLPs ask for a Companies House number', () => {
    expect(structureFields('llp').companyNumber).toBe(true);
    expect(structureFields('ltd').companyNumber).toBe(true);
    expect(structureFields('partnership').companyNumber).toBe(false);
    expect(structureFields('sole').companyNumber).toBe(false);
  });

  it('labels the address and name for each type', () => {
    expect(structureFields('llp').addressLabel).toBe('Registered office');
    expect(structureFields('partnership').addressLabel).toBe('Principal place of business');
    expect(structureFields('sole').addressLabel).toBe('Business address');
    expect(structureFields('sole').legalLabel).toBe('Your full name');
    expect(structureFields('llp').companyPlaceholder('scotland')).toBe('SO123456');
    expect(structureFields('ltd').companyPlaceholder('northern_ireland')).toBe('NI123456');
  });

  it('checks the Companies House number matches the type and country', () => {
    expect(companyNumberError('llp', 'OC123456', 'england_wales')).toBe('');
    expect(companyNumberError('llp', '12345678', 'england_wales')).toMatch(/LLP numbers start OC/);
    expect(companyNumberError('llp', 'SO123456', 'scotland')).toBe('');
    expect(companyNumberError('ltd', '01234567', 'england_wales')).toBe('');
    expect(companyNumberError('ltd', 'oc123456', 'england_wales')).toMatch(/8 digits/);
    expect(companyNumberError('ltd', 'SC123456', 'scotland')).toBe('');
    expect(companyNumberError('ltd', 'NI123456', 'northern_ireland')).toBe('');
    expect(companyNumberError('ltd', '', 'england_wales')).toMatch(/Enter/);
    expect(companyNumberError('sole', '', 'england_wales')).toBe('');
  });
});
