/**
 * Central UK Tax Rates and Allowances Table
 * Maintained centrally as per specification (REC-11, REC-13).
 * Supports Corporation Tax, s455 on Director's Loans, and Capital Allowances.
 */

export interface CentralTaxRates {
  tax_year: string;
  corporation_tax: {
    small_profits_rate_pct: number; // 19%
    main_rate_pct: number; // 25%
    lower_threshold_p: bigint; // £50,000 = 5_000_000 pence
    upper_threshold_p: bigint; // £250,000 = 25_000_000 pence
    marginal_relief_fraction: number; // 3/200 = 0.015
  };
  s455: {
    rate_pct: number; // 33.75%
    bik_threshold_p: bigint; // £10,000 = 1_000_000 pence
    repayment_window_months: number; // 9 months after accounting period end
  };
  capital_allowances: {
    annual_investment_allowance_limit_p: bigint; // £1,000,000 = 100_000_000 pence
    main_pool_rate_pct: number; // 18%
    special_rate_pool_pct: number; // 6%
    first_year_allowance_pct: number; // 100%
  };
}

export const CENTRAL_TAX_RATES: CentralTaxRates = {
  tax_year: '2025/2026',
  corporation_tax: {
    small_profits_rate_pct: 19.0,
    main_rate_pct: 25.0,
    lower_threshold_p: 5000000n, // £50,000 in pence
    upper_threshold_p: 25000000n, // £250,000 in pence
    marginal_relief_fraction: 0.015, // 3/200
  },
  s455: {
    rate_pct: 33.75,
    bik_threshold_p: 1000000n, // £10,000 in pence
    repayment_window_months: 9,
  },
  capital_allowances: {
    annual_investment_allowance_limit_p: 100000000n, // £1,000,000
    main_pool_rate_pct: 18.0,
    special_rate_pool_pct: 6.0,
    first_year_allowance_pct: 100.0,
  },
};

/**
 * Calculates Corporation Tax with marginal relief for UK taxable profit (in pence).
 */
export function calculateCorporationTax(profitPence: bigint): {
  taxDuePence: bigint;
  effectiveRatePct: number;
  marginalReliefPence: bigint;
  appliedBand: 'small' | 'marginal' | 'main' | 'nil';
} {
  if (profitPence <= 0n) {
    return { taxDuePence: 0n, effectiveRatePct: 0, marginalReliefPence: 0n, appliedBand: 'nil' };
  }

  const { small_profits_rate_pct, main_rate_pct, lower_threshold_p, upper_threshold_p, marginal_relief_fraction } =
    CENTRAL_TAX_RATES.corporation_tax;

  if (profitPence <= lower_threshold_p) {
    const tax = (profitPence * 19n) / 100n;
    return { taxDuePence: tax, effectiveRatePct: small_profits_rate_pct, marginalReliefPence: 0n, appliedBand: 'small' };
  }

  if (profitPence >= upper_threshold_p) {
    const tax = (profitPence * 25n) / 100n;
    return { taxDuePence: tax, effectiveRatePct: main_rate_pct, marginalReliefPence: 0n, appliedBand: 'main' };
  }

  // Marginal relief calculation:
  // Tax at main rate (25%) less Marginal Relief: fraction * (Upper - Profit)
  const fullTax = (profitPence * 25n) / 100n;
  const relief = BigInt(Math.round(Number(upper_threshold_p - profitPence) * marginal_relief_fraction));
  const taxDue = fullTax - relief;
  const effRate = Number(taxDue * 10000n / profitPence) / 100;

  return {
    taxDuePence: taxDue,
    effectiveRatePct: effRate,
    marginalReliefPence: relief,
    appliedBand: 'marginal',
  };
}

/**
 * Calculates s455 tax charge on an overdrawn director's loan account balance (in pence).
 */
export function calculateS455Tax(overdrawnAmountPence: bigint, repaidIn9MonthsPence: bigint = 0n): {
  unrepaidAmountPence: bigint;
  s455TaxDuePence: bigint;
  ratePct: number;
} {
  const overdrawn = overdrawnAmountPence < 0n ? -overdrawnAmountPence : overdrawnAmountPence;
  const repaid = repaidIn9MonthsPence < 0n ? -repaidIn9MonthsPence : repaidIn9MonthsPence;
  const unrepaid = overdrawn > repaid ? overdrawn - repaid : 0n;
  const ratePct = CENTRAL_TAX_RATES.s455.rate_pct;
  const rateBp = BigInt(Math.round(ratePct * 100)); // 3375
  const taxDue = (unrepaid * rateBp) / 10000n;

  return {
    unrepaidAmountPence: unrepaid,
    s455TaxDuePence: taxDue,
    ratePct,
  };
}

