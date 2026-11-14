// One money format for the whole app (design/01-design-sense.md rule 13).
// Same rule as the printed receipt: whole amounts without decimals, anything else with
// exactly two.  1250 → "PKR 1,250"   1250.5 → "PKR 1,250.50"   -50 → "−PKR 50"
// The minus is a real minus sign (U+2212), so negative and positive figures line up.

const MINUS = '−';

/** Number part only: 1250.5 → "1,250.50" (no currency, no sign handling). */
export const formatNumber = (value, { decimals } = {}) => {
    const n = Math.abs(Number(value) || 0);
    const whole = Math.round(n * 100) % 100 === 0;
    const digits = decimals ?? (whole ? 0 : 2);
    return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/**
 * "PKR 1,250" · "−PKR 50" · "+PKR 300" (with `signed`).
 * `currency` is the shop's currency code/label (business.currency), default "PKR".
 */
export const formatAmount = (value, { currency = 'PKR', decimals, signed = false } = {}) => {
    const n = Number(value) || 0;
    const sign = n < 0 ? MINUS : signed && n > 0 ? '+' : '';
    return `${sign}${currency} ${formatNumber(n, { decimals })}`;
};

/** Short form for chart axes and tight tiles: 6500 → "Rs 6.5K", 1200000 → "Rs 1.2M". */
export const formatCompact = (value, { currency = 'PKR' } = {}) => {
    const n = Number(value) || 0;
    const a = Math.abs(n);
    const sign = n < 0 ? MINUS : '';
    const short = a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${+(a / 1e3).toFixed(1)}K` : `${Math.round(a)}`;
    return `${sign}${currency} ${short}`;
};
