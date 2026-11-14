import React from 'react';
import { cn } from './cn';

const SPINNER_SIZES = { xs: 'w-3 h-3', sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-6 h-6' };

const SPINNER_TONES = {
    accent: 'border-primary/30 border-t-primary',
    // follows the text colour — for spinners inside buttons
    current: 'border-[color-mix(in_oklab,currentColor_30%,transparent)] border-t-current',
};

/** Ring spinner (0.7s). tone="accent" (default) or "current" (inherits the text colour). */
export const Spinner = ({ size = 'md', tone = 'accent', className, label = 'Loading' }) => (
    <span
        role="status"
        aria-label={label}
        className={cn(
            'inline-block shrink-0 rounded-full border-2 animate-ds-spin',
            SPINNER_TONES[tone] || SPINNER_TONES.accent,
            SPINNER_SIZES[size] || SPINNER_SIZES.md,
            className
        )}
    />
);

/** Grey placeholder block while something loads (pulses 1.1s). Give it a width/height. */
export const Skeleton = ({ className }) => (
    <span aria-hidden="true" className={cn('block rounded-pop bg-primary/10 animate-ds-pulse', className)} />
);

/** Thin running bar for work with no known length (e.g. syncing). */
export const IndeterminateBar = ({ className, label = 'Working' }) => (
    <div role="progressbar" aria-label={label} className={cn('relative h-[3px] w-full overflow-hidden rounded-full bg-primary/20', className)}>
        <span className="absolute inset-y-0 left-0 w-[42%] rounded-full bg-primary animate-ds-bar" />
    </div>
);

export default Spinner;
