import React from 'react';
import { cn } from './cn';
import { formatAmount } from '../../utils/money';
import { useBusiness } from '../../context/BusinessContext';

/**
 * A money amount: shop currency, even-width digits, negative in red with a real minus.
 * <Money value={1250.5} />                → PKR 1,250.50
 * <Money value={-50} />                   → −PKR 50 (red)
 * <Money value={300} signed tone="auto" />→ +PKR 300 (green) — for in/out columns
 * tone: "plain" (default; red only when negative) · "auto" (green +, red −) · "muted" · "none"
 * A missing value (null/undefined) shows a muted em dash.
 */
export const Money = ({ value, currency, decimals, signed = false, tone = 'plain', className }) => {
    const { business } = useBusiness();
    if (value === null || value === undefined || value === '') {
        return <span className={cn('text-muted-foreground', className)}>—</span>;
    }
    const n = Number(value) || 0;
    const toneClass =
        tone === 'none'
            ? ''
            : tone === 'muted'
              ? 'text-muted-foreground'
              : n < 0
                ? 'text-destructive'
                : tone === 'auto' && n > 0
                  ? 'text-success-chip-foreground'
                  : '';
    return (
        <span className={cn('tabular-nums whitespace-nowrap', toneClass, className)}>
            {formatAmount(n, { currency: currency || business?.currency || 'PKR', decimals, signed })}
        </span>
    );
};

export default Money;
