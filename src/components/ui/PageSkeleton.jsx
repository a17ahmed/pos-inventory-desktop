import React from 'react';
import { cn } from './cn';
import { Skeleton } from './Spinner';
import { CARD_FRAME } from './Card';

// What a page looks like while its first data loads: the same shapes as the real page (header
// band, figure cards, table or charts) in grey, so the screen feels "almost there" instead of
// "waiting". Replaces the big centred spinners.

const Band = ({ back }) => (
    <div className="rounded-2xl border border-hairline bg-surface-tint px-[22px] py-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2 w-[min(420px,60%)]">
            {back ? <Skeleton className="h-3 w-24" /> : null}
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
    </div>
);

const Cards = ({ n }) => (
    <div className={cn('grid gap-3 grid-cols-2', { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }[n] || 'lg:grid-cols-4')}>
        {Array.from({ length: n }).map((_, i) => (
            <div key={i} className={cn(CARD_FRAME, 'px-4 py-4 flex flex-col gap-2.5')}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-3 w-16" />
            </div>
        ))}
    </div>
);

/** A table card: toolbar, header, rows down to the bottom of the screen. */
export const TableSkeleton = ({ rows, columns = 6, toolbar = true, className }) => {
    const n = rows || Math.max(6, Math.ceil((window.innerHeight - 380) / 44));
    return (
        <div className={cn(CARD_FRAME, 'overflow-hidden', className)} aria-busy="true" aria-label="Loading">
            {toolbar ? (
                <div className="flex items-center gap-2 px-3 py-3">
                    <Skeleton className="h-9 w-64 rounded-xl" />
                    <Skeleton className="h-9 w-28 rounded-xl" />
                    <div className="ml-auto flex gap-2">
                        <Skeleton className="h-9 w-9 rounded-xl" />
                        <Skeleton className="h-9 w-9 rounded-xl" />
                    </div>
                </div>
            ) : null}
            <div className="h-[var(--head-h)] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)]" />
            {Array.from({ length: n }).map((_, r) => (
                <div key={r} className="h-[var(--row-h)] flex items-center gap-6 px-4 shadow-[inset_0_-1px_0_var(--hairline)]">
                    {Array.from({ length: columns }).map((__, c) => (
                        <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-40' : c === columns - 1 ? 'w-12 ml-auto' : 'w-20')} />
                    ))}
                </div>
            ))}
        </div>
    );
};

/** A chart card block. */
const ChartBlock = ({ className }) => (
    <div className={cn(CARD_FRAME, 'p-4 flex flex-col gap-3', className)}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="flex-1 min-h-[180px] w-full rounded-xl" />
    </div>
);

/**
 * <PageSkeleton variant="list" cards={3} columns={7} />
 * variants: list (band + cards + table) · ledger (back link + figure strip + table) ·
 *           report (band + cards + charts) · detail (band + sections)
 * `bare` = no header band and no page padding (when the page's own header is already showing)
 */
export function PageSkeleton({ variant = 'list', cards = 0, columns = 6, bare = false, className }) {
    return (
        <div className={cn(bare ? 'flex flex-col gap-5' : 'p-6 flex flex-col gap-5', className)} aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading…</span>
            {bare ? null : <Band back={variant === 'ledger' || variant === 'detail'} />}
            {variant === 'ledger' ? (
                <div className={cn(CARD_FRAME, 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-hairline')}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="px-5 py-4 flex flex-col gap-2">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-6 w-24" />
                        </div>
                    ))}
                </div>
            ) : cards ? (
                <Cards n={cards} />
            ) : null}
            {variant === 'report' ? (
                <div className="grid gap-4 lg:grid-cols-3">
                    <ChartBlock className="lg:col-span-2 min-h-[300px]" />
                    <ChartBlock className="min-h-[300px]" />
                    <ChartBlock className="min-h-[240px]" />
                    <ChartBlock className="min-h-[240px]" />
                    <ChartBlock className="min-h-[240px]" />
                </div>
            ) : variant === 'detail' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                    <ChartBlock className="min-h-[260px]" />
                    <ChartBlock className="min-h-[260px]" />
                </div>
            ) : (
                <TableSkeleton columns={columns} />
            )}
        </div>
    );
}

export default PageSkeleton;
