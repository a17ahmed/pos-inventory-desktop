import React, { useLayoutEffect, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { cn } from './cn';
import { IconButton } from './Button';

// The table look as plain pieces (design/04-tables.md), for lists that need their own row
// structure — ledgers with day groups and opening / closing lines. DataTable uses the same
// pieces, so every list in the app looks the same.

export const TABLE_CARD = 'bg-card text-card-foreground border border-hairline rounded-2xl shadow-1 overflow-hidden';
export const TABLE_HEAD_ROW = '';
/** Header cells stay on top while the rows scroll (solid tint so rows don't show through). */
export const TABLE_TH =
    'sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] ' +
    'h-[var(--head-h)] px-3 first:pl-4 last:pr-4 font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap text-left';
/**
 * The rows scroll inside the table instead of the whole page: at least 320px, at most the window
 * minus room for the page header, toolbar and footer — so 1,000 bills never push the totals and
 * the paging off-screen.
 */
export const TABLE_MAX_HEIGHT = 'max(320px, calc(100vh - 300px))';
export const TABLE_SCROLL = 'overflow-auto max-h-[max(320px,calc(100vh-300px))] print:max-h-none print:overflow-visible';
export const TABLE_ROW = 'h-[var(--row-h)] shadow-[inset_0_-1px_0_var(--hairline)] hover:bg-[var(--hover-overlay)]';
export const TABLE_TD = 'px-3 first:pl-4 last:pr-4 py-1.5 align-middle text-body'; // colour comes from the card, so a cell's own colour always wins
/** A grouping line inside a table (a day, a period): tinted, slightly stronger text. */
export const TABLE_GROUP_ROW = 'bg-muted/50 shadow-[inset_0_-1px_0_var(--hairline)]';
export const TABLE_GROUP_TD = 'px-3 first:pl-4 last:pr-4 py-2 text-body-sm text-muted-foreground';

/** The one-row toolbar above a table. */
export const TableToolbar = ({ className, children }) => (
    <div className={cn('flex flex-wrap items-center gap-2 px-3 py-3 print:hidden', className)}>{children}</div>
);

/**
 * Paging footer: "Rows per page · 1–25 of 159 · first / previous / Page x of y / next / last".
 * page is 1-based. Leave out pageSizes / onPageSizeChange to hide the size picker.
 */
export function TablePager({ page, pageSize, total, onPageChange, pageSizes, onPageSizeChange, noun, className }) {
    const pageCount = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    const go = (p) => onPageChange?.(Math.min(Math.max(1, p), pageCount));
    return (
        <div className={cn('flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-hairline text-body text-muted-foreground print:hidden', className)}>
            {pageSizes && onPageSizeChange ? (
                <label className="inline-flex items-center gap-2">
                    Rows per page
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="h-8 rounded-lg border border-input bg-card px-2 text-body text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                        {pageSizes.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}
            <span className="tabular-nums">
                {from}–{to} of {(total || 0).toLocaleString()}
                {noun ? ` ${noun}` : ''}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
                <IconButton label="First page" variant="outline" size="xs" onClick={() => go(1)} disabled={page <= 1}>
                    <FiChevronsLeft />
                </IconButton>
                <IconButton label="Previous page" variant="outline" size="xs" onClick={() => go(page - 1)} disabled={page <= 1}>
                    <FiChevronLeft />
                </IconButton>
                <span className="px-1.5 tabular-nums">
                    Page {page} of {pageCount}
                </span>
                <IconButton label="Next page" variant="outline" size="xs" onClick={() => go(page + 1)} disabled={page >= pageCount}>
                    <FiChevronRight />
                </IconButton>
                <IconButton label="Last page" variant="outline" size="xs" onClick={() => go(pageCount)} disabled={page >= pageCount}>
                    <FiChevronsRight />
                </IconButton>
            </div>
        </div>
    );
}

/**
 * Height that makes a table's scroll area reach the bottom of the screen (design: the table card
 * always runs to the bottom; with few rows the empty space is inside the card, with many rows they
 * scroll inside). Measured from where the area starts in the page's scroll panel (<main>), minus
 * what sits under it in the card (the paging footer) and the page's bottom padding. Never below `min`.
 */
export function useFillHeight(ref, { min = 320, bottom = 24, enabled = true, deps = [] } = {}) {
    const [height, setHeight] = useState(null);
    useLayoutEffect(() => {
        if (!enabled) return undefined;
        const el = ref.current;
        if (!el) return undefined;
        const scroller = el.closest('main') || document.scrollingElement;
        const measure = () => {
            const node = ref.current;
            if (!node) return;
            const sRect = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0 };
            const top = node.getBoundingClientRect().top - sRect.top + (scroller.scrollTop || 0);
            let below = 0;
            for (let n = node.nextElementSibling; n; n = n.nextElementSibling) below += n.offsetHeight;
            const card = node.parentElement;
            const borders = card ? parseFloat(getComputedStyle(card).borderBottomWidth) || 0 : 0;
            const avail = (scroller.clientHeight || window.innerHeight) - top - below - borders - bottom;
            setHeight((h) => {
                const next = Math.max(min, Math.floor(avail));
                return Math.abs((h || 0) - next) > 1 ? next : h;
            });
        };
        measure();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        // what sits above the table (cards that finish loading) and the panel's own size
        if (ro) {
            ro.observe(scroller === document.scrollingElement ? document.body : scroller);
            if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
        }
        window.addEventListener('resize', measure);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', measure);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, min, bottom, ...deps]);
    return height;
}

/** How many placeholder rows fill `height` (row height from --row-h). */
export const skeletonRowsFor = (height, fallback = 6) => {
    if (!height) return fallback;
    const rowH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-h')) || 44;
    return Math.max(3, Math.ceil(height / rowH));
};

/** The scroll area for lists with their own row structure (ledgers, day groups). */
export const TableScroll = ({ className, children, min, deps }) => {
    const ref = useRef(null);
    const height = useFillHeight(ref, { min, deps });
    return (
        <div ref={ref} className={cn('overflow-auto print:overflow-visible print:!h-auto', className)} style={height ? { height } : { maxHeight: TABLE_MAX_HEIGHT }}>
            {children}
        </div>
    );
};
