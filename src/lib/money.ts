/**
 * Blynt Workpapers Money Utility
 * Ground Rule 1: Money is stored and calculated as integer pence (bigint).
 * Format only for display. Never use floats for money.
 */

export type Pence = bigint;

/**
 * Convert pounds input (e.g. user-typed "6,000.00" or number 6000) to integer pence (bigint).
 */
export function toPence(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    return BigInt(Math.round(value * 100));
  }
  const str = String(value).trim();
  if (!str) return 0n;

  // Common accounting zero representations (em-dash, en-dash, hyphen, nil, n/a)
  if (
    str === '-' ||
    str === '—' ||
    str === '–' ||
    str === '―' ||
    /^[-—–―\s]+$/.test(str) ||
    /^(nil|n\/a|none|null)$/i.test(str)
  ) {
    return 0n;
  }

  // Remove currency symbols, commas, quotes, and whitespace
  const clean = str.replace(/[£$€"'\s,]/g, '').trim();
  if (!clean || /^[-—–―]+$/.test(clean)) return 0n;

  const isNegative =
    clean.startsWith('-') ||
    clean.startsWith('—') ||
    clean.startsWith('–') ||
    (clean.startsWith('(') && clean.endsWith(')'));

  const numStr = clean.replace(/[()\-—–―]/g, '').trim();
  if (!numStr) return 0n;

  const parts = numStr.split('.');
  const poundsDigits = parts[0].replace(/\D/g, '') || '0';
  const pounds = BigInt(poundsDigits);

  const rawPence = (parts[1] || '').replace(/\D/g, '');
  const pencePart = rawPence.padEnd(2, '0').slice(0, 2);
  const pence = BigInt(pencePart || '0');

  const total = pounds * 100n + pence;
  return isNegative ? -total : total;
}

/**
 * Coerce a stored database pence representation (bigint, integer string "600000", or formatted string)
 * into a bigint.
 */
export function asPence(value: bigint | string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.round(value));
  const s = value.toString().trim();
  if (!s) return 0n;
  if (s.includes('.') || s.includes('£') || s.includes('$')) {
    return toPence(s);
  }
  return BigInt(s);
}

/**
 * Format integer pence as UK GBP currency string (£X,XXX.XX).
 * Never uses floats for computation.
 */
export function formatPence(
  pence: bigint | number | string | null | undefined,
  options?: {
    accountingFormat?: boolean; // (150.00) for negative
    showPlusSign?: boolean;
    symbol?: string;
  }
): string {
  const p = asPence(pence);
  const symbol = options?.symbol !== undefined ? options.symbol : '£';
  const isNeg = p < 0n;
  const absP = isNeg ? -p : p;
  
  const pounds = absP / 100n;
  const pennies = absP % 100n;
  
  // Format thousands with commas
  const poundsFormatted = pounds.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const penniesFormatted = pennies.toString().padStart(2, '0');
  const amountStr = `${poundsFormatted}.${penniesFormatted}`;
  
  if (options?.accountingFormat && isNeg) {
    return `(${symbol}${amountStr})`;
  }
  if (isNeg) {
    return `-${symbol}${amountStr}`;
  }
  if (options?.showPlusSign && p > 0n) {
    return `+${symbol}${amountStr}`;
  }
  return `${symbol}${amountStr}`;
}

/**
 * Format pence for input fields (without symbol, e.g. "124.50" or "-150.00")
 */
export function formatPenceInput(pence: bigint | number | string): string {
  const p = asPence(pence);
  const isNeg = p < 0n;
  const absP = isNeg ? -p : p;
  const pounds = absP / 100n;
  const pennies = absP % 100n;
  return `${isNeg ? '-' : ''}${pounds}.${pennies.toString().padStart(2, '0')}`;
}

/**
 * Sum an array of pence values strictly using bigint.
 */
export function sumPence(items: (bigint | number | string | null | undefined)[]): bigint {
  return items.reduce<bigint>((acc, item) => acc + asPence(item), 0n);
}

/**
 * Calculate variance and percentage variance strictly from integer pence.
 */
export function calculateVariance(
  currentPence: bigint | number | string,
  priorPence: bigint | number | string
): {
  diffPence: bigint;
  percent: number | null; // null if prior is zero
  isIncrease: boolean;
} {
  const cur = asPence(currentPence);
  const py = asPence(priorPence);
  const diff = cur - py;
  
  if (py === 0n) {
    return {
      diffPence: diff,
      percent: null,
      isIncrease: diff > 0n,
    };
  }
  
  const pyAbs = py < 0n ? -py : py;
  const scaled = (diff * 10000n) / pyAbs;
  const percent = Number(scaled) / 100;
  
  return {
    diffPence: diff,
    percent,
    isIncrease: diff > 0n,
  };
}
