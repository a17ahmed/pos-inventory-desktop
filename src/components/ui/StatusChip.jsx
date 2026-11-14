import React from 'react';
import { cn } from './cn';
import { getStatus } from '../../utils/statusTones';

// Ported from design/reference/source/components-v3/StatusChip.tsx.
// A tinted pill: a word on its tone's tint, optional icon. Never colour alone.
export const CHIP_TONES = {
    neutral: 'bg-muted text-muted-foreground',
    accent: 'bg-accent text-accent-foreground',
    info: 'bg-info-chip text-info-chip-foreground',
    success: 'bg-success-chip text-success-chip-foreground',
    warning: 'bg-warning-chip text-warning-chip-foreground',
    destructive: 'bg-destructive-chip text-destructive-chip-foreground',
};

const DOT_TONES = {
    neutral: 'bg-muted-foreground',
    accent: 'bg-primary',
    info: 'bg-info',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
};

const SIZES = {
    md: 'px-2.5 py-0.5 text-body-sm [&_svg]:w-3 [&_svg]:h-3',
    sm: 'px-2 py-0.5 text-caption [&_svg]:w-3 [&_svg]:h-3',
    xs: 'px-1.5 py-px text-caption [&_svg]:w-2.5 [&_svg]:h-2.5',
};

/**
 * <StatusChip tone="success" icon={FiCheck} label="Paid" />
 * shape="pill" (default) · "tag" (small square-ish chip, e.g. ledger entry types) · "dot" (coloured dot + plain text)
 */
export const StatusChip = ({ label, tone = 'neutral', icon: Icon, size = 'md', shape = 'pill', className, title }) => {
    if (shape === 'dot') {
        return (
            <span title={title} className={cn('inline-flex items-center gap-1.5 text-body-sm text-foreground whitespace-nowrap', className)}>
                <span aria-hidden="true" className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOT_TONES[tone] || DOT_TONES.neutral)} />
                {label}
            </span>
        );
    }
    return (
        <span
            title={title}
            className={cn(
                'inline-flex items-center gap-1 font-medium whitespace-nowrap',
                shape === 'tag' ? 'rounded h-5 px-1.5 text-caption [&_svg]:w-3 [&_svg]:h-3' : cn('rounded-full', SIZES[size] || SIZES.md),
                CHIP_TONES[tone] || CHIP_TONES.neutral,
                className
            )}
        >
            {Icon ? <Icon aria-hidden="true" /> : null}
            {label}
        </span>
    );
};

/**
 * A known status by kind + value, from utils/statusTones.js:
 * <StatusBadge kind="payment" value={bill.paymentStatus} />  →  "Paid" / "Partial" / "Unpaid"
 * Renders nothing for an empty value (e.g. returnStatus "none").
 */
export const StatusBadge = ({ kind, value, size, shape, showIcon = true, className }) => {
    const s = getStatus(kind, value);
    if (!s) return null;
    return <StatusChip label={s.label} tone={s.tone} icon={showIcon ? s.icon : null} size={size} shape={shape} className={className} />;
};

export default StatusChip;
