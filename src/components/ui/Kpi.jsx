import React from 'react';
import { FiArrowDownRight, FiArrowUpRight, FiChevronRight, FiMinus } from 'react-icons/fi';
import { cn } from './cn';
import { Skeleton } from './Spinner';

// design/06-charts.md §3 + reference components/kpi-01…08: a mono label, a big even-width
// figure, a quiet note, an optional delta chip and sparkline. A tile that opens a window is a
// real button (hover wash + chevron in the corner, reference kpi-06).

/**
 * "+18% vs yesterday". `value` is a percentage (number) or null (nothing to compare).
 * `goodWhen` = 'up' (sales) or 'down' (costs) decides green / red.
 */
export function DeltaChip({ value, label, goodWhen = 'up', className }) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
    const v = Number(value);
    const flat = Math.abs(v) < 0.05;
    const good = flat ? null : goodWhen === 'up' ? v > 0 : v < 0;
    const Icon = flat ? FiMinus : v > 0 ? FiArrowUpRight : FiArrowDownRight;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-caption font-semibold tabular-nums whitespace-nowrap',
                good === null ? 'bg-muted text-muted-foreground' : good ? 'bg-success-chip text-success-chip-foreground' : 'bg-destructive-chip text-destructive-chip-foreground',
                className
            )}
        >
            <Icon className="w-3 h-3" aria-hidden="true" />
            {flat ? '0%' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)}%`}
            {label ? <span className="font-normal opacity-80 ml-0.5">{label}</span> : null}
        </span>
    );
}

/** Percentage change from `previous` to `current`; null when there's nothing to compare. */
export const percentChange = (current, previous) => {
    const c = Number(current) || 0;
    const p = Number(previous);
    if (!Number.isFinite(p) || p === 0) return null;
    return ((c - p) / Math.abs(p)) * 100;
};

/**
 * <KpiCard label="Revenue" value={<Money …/>} note="46 bills" delta={{ value: 12, label: 'vs last week' }}
 *          tone="success" onClick={…} sparkline={<Sparkline …/>} />
 * tone colours the figure only: default · success · destructive · warning · accent.
 * size: auto (long figures step down) · sm · lg — give every tile in a row the same size.
 */
export function KpiCard({ label, value, note, delta, tone, onClick, sparkline, loading, children, className, ariaLabel, size = 'auto' }) {
    const toneClass = {
        success: 'text-success',
        destructive: 'text-destructive',
        warning: 'text-warning-chip-foreground',
        accent: 'text-primary',
    }[tone];
    const body = (
        <>
            <div className="flex items-start gap-2 w-full">
                <p className="flex-1 min-w-0 font-mono text-overline-lg uppercase text-muted-foreground truncate">{label}</p>
                {onClick ? <FiChevronRight className="w-4 h-4 flex-none text-muted-foreground/70 group-hover:text-foreground" aria-hidden="true" /> : null}
            </div>
            {loading ? (
                <Skeleton className="mt-2 h-7 w-28" />
            ) : (
                <div
                    className={cn(
                        'mt-1 font-heading leading-tight tabular-nums truncate',
                        // long figures (PKR 123,732.56) step down a size instead of being cut off
                        size === 'sm' ? 'text-h3' : size === 'lg' ? 'text-h2' : typeof value === 'string' && value.length > 12 ? 'text-h3' : 'text-h2',
                        toneClass
                    )}
                    title={typeof value === 'string' ? value : undefined}
                >
                    {value}
                </div>
            )}
            {(note || delta) && !loading ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted-foreground w-full min-w-0">
                    {delta ? <DeltaChip {...delta} /> : null}
                    {/* a long note wraps (max two lines) instead of running out of the tile */}
                    {note ? <span className="min-w-0 max-w-full break-words line-clamp-2">{note}</span> : null}
                </div>
            ) : null}
            {sparkline && !loading ? <div className="mt-2 h-8">{sparkline}</div> : null}
            {children}
        </>
    );
    // A box that acts as a button (role="button", Enter / Space). Not a <button>: browsers centre a
    // button's contents vertically, and older Chromium (the desktop app's Electron) doesn't stretch
    // them — so tiles of different heights would not line up.
    const frame = 'group relative flex flex-col w-full text-left rounded-2xl border border-hairline bg-card text-card-foreground shadow-1 px-4 py-3.5 min-w-0 overflow-hidden';
    return onClick ? (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick(e);
                }
            }}
            aria-label={ariaLabel}
            className={cn(
                frame,
                'cursor-pointer outline-none hover:[background-image:linear-gradient(var(--hover-overlay),var(--hover-overlay))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                className
            )}
        >
            {body}
        </div>
    ) : (
        <div className={cn(frame, className)}>{body}</div>
    );
}

/** A row of tiles that wraps on narrow windows. `cols` = how many per row on wide screens. */
export const KpiStrip = ({ cols = 4, className, children }) => (
    <div
        className={cn(
            'grid gap-3 grid-cols-1 sm:grid-cols-2',
            { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }[cols],
            className
        )}
    >
        {children}
    </div>
);

/** A small figure inside a strip of stats (no card): label, value, note. For dense windows. */
export const Stat = ({ label, value, note, delta, tone, className }) => (
    <div className={cn('min-w-0', className)}>
        <p className="font-mono text-overline-lg uppercase text-muted-foreground truncate">{label}</p>
        <div
            className={cn(
                'mt-0.5 font-heading text-h4 tabular-nums truncate',
                { success: 'text-success', destructive: 'text-destructive', warning: 'text-warning-chip-foreground', accent: 'text-primary' }[tone]
            )}
        >
            {value}
        </div>
        {(note || delta) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-body-sm text-muted-foreground">
                {delta ? <DeltaChip {...delta} /> : null}
                {note ? <span className="truncate">{note}</span> : null}
            </div>
        )}
    </div>
);

export default KpiCard;
