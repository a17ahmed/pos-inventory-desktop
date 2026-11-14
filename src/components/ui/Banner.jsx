import React from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { cn } from './cn';

// Ported from design/reference/source/components-v3/Alert.tsx. Tints come from the *-chip tokens.
const TONE = {
    neutral: 'bg-muted/50 border-border text-foreground',
    info: 'bg-info-chip border-info-chip-foreground/20 text-info-chip-foreground',
    success: 'bg-success-chip border-success-chip-foreground/20 text-success-chip-foreground',
    warning: 'bg-warning-chip border-warning-chip-foreground/25 text-warning-chip-foreground',
    destructive: 'bg-destructive-chip border-destructive/30 text-destructive-chip-foreground',
};

const DEFAULT_ICON = {
    neutral: null,
    info: FiInfo,
    success: FiCheckCircle,
    warning: FiAlertTriangle,
    destructive: FiAlertCircle,
};

/**
 * One line + optional action, e.g. "Payment due in 3 days · Pay now".
 * `icon={null}` hides the icon; errors get role="alert" so screen readers announce them.
 */
export function Banner({ tone = 'neutral', icon, action, className, children }) {
    const Icon = icon === undefined ? DEFAULT_ICON[tone] : icon;
    return (
        <div
            role={tone === 'destructive' ? 'alert' : 'status'}
            className={cn(
                'text-body flex min-h-9 w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-1.5',
                TONE[tone] || TONE.neutral,
                className
            )}
        >
            {Icon ? <Icon aria-hidden="true" className="w-4 h-4 flex-none" /> : null}
            <div className="min-w-0 flex-1 text-pretty whitespace-pre-line">{children}</div>
            {action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
        </div>
    );
}

/** Title + body, for something the user should read before going on. */
export function Alert({ tone = 'neutral', title, icon, action, className, children }) {
    const Icon = icon === undefined ? DEFAULT_ICON[tone] || FiInfo : icon;
    return (
        <div
            role={tone === 'destructive' ? 'alert' : 'status'}
            className={cn('flex w-full min-w-0 items-start gap-2.5 rounded-xl border px-3 py-2', TONE[tone] || TONE.neutral, className)}
        >
            {Icon ? <Icon aria-hidden="true" className="w-4 h-4 flex-none mt-0.5" /> : null}
            <div className="min-w-0 flex-1">
                {title ? <p className="text-body font-semibold">{title}</p> : null}
                {children ? <div className={cn('whitespace-pre-line break-words', title ? 'text-body-sm mt-0.5' : 'text-body')}>{children}</div> : null}
            </div>
            {action ? <div className="flex flex-none items-center gap-2 self-center">{action}</div> : null}
        </div>
    );
}

export default Banner;
