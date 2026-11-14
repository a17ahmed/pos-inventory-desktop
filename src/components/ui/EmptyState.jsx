import React from 'react';
import { FiInbox, FiAlertTriangle, FiLock, FiSearch } from 'react-icons/fi';
import { cn } from './cn';
import { Button } from './Button';
import { Spinner } from './Spinner';

/**
 * "Nothing here yet" — a line icon, a short title, one line of help, optional actions.
 * size="md" (centred, for a whole card or table) · "sm" (one inline line, inside a card).
 * Never fake rows.
 */
export const EmptyState = ({ icon: Icon = FiInbox, title, children, actions, size = 'md', className }) => {
    if (size === 'sm') {
        return (
            <div className={cn('flex items-center gap-2 py-2 text-body text-muted-foreground', className)}>
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                    {title && <span className="font-medium text-foreground">{title}</span>}
                    {title && children ? ' — ' : null}
                    {children}
                </span>
            </div>
        );
    }
    return (
        <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
            <span className="mb-1 inline-flex w-10 h-10 items-center justify-center rounded-row bg-muted text-muted-foreground">
                <Icon className="w-5 h-5" aria-hidden="true" />
            </span>
            {title && <p className="text-body-lg font-semibold text-foreground">{title}</p>}
            {children && <p className="max-w-[48ch] text-body text-muted-foreground">{children}</p>}
            {actions && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
        </div>
    );
};

/** Filters hide everything: says so and offers to clear them. */
export const NoResults = ({ onClear, children = 'Nothing matches these filters.', className }) => (
    <EmptyState
        icon={FiSearch}
        title="No results"
        className={className}
        actions={onClear ? <Button variant="outline" size="xs" onClick={onClear}>Clear filters</Button> : null}
    >
        {children}
    </EmptyState>
);

const STATE_ICON = { error: FiAlertTriangle, forbidden: FiLock };

/**
 * A bordered row that stands in for a screen part that couldn't show its content.
 * kind="loading" | "error" (message + Try again + request id) | "forbidden" (no permission).
 */
export const StateCard = ({ kind = 'error', title, children, onRetry, requestId, className }) => {
    const Icon = STATE_ICON[kind];
    const heading =
        title || (kind === 'loading' ? 'Loading…' : kind === 'forbidden' ? "You don't have access to this" : "Couldn't load this");
    return (
        <div
            role={kind === 'error' ? 'alert' : 'status'}
            className={cn('flex flex-wrap items-center gap-3 rounded-2xl border border-hairline bg-card px-4 py-3', className)}
        >
            {kind === 'loading' ? (
                <Spinner />
            ) : (
                <Icon className={cn('w-4 h-4 shrink-0', kind === 'error' ? 'text-destructive' : 'text-muted-foreground')} aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-foreground">{heading}</p>
                {children && <p className="text-body-sm text-muted-foreground">{children}</p>}
                {requestId && <p className="mt-0.5 font-mono text-mono-xs text-muted-foreground">Request {requestId}</p>}
            </div>
            {kind === 'error' && onRetry && (
                <Button variant="outline" size="xs" onClick={onRetry}>
                    Try again
                </Button>
            )}
        </div>
    );
};

export default EmptyState;
