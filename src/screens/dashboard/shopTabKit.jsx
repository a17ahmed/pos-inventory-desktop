import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { cn, KpiStrip, Skeleton, StateCard, CARD_FRAME, TABLE_TH, TABLE_TD, TABLE_ROW } from '../../components/ui';

// Building blocks for the Dashboard tabs (same layout as the platform admin's shop page):
// a card with a title row and a divider, a grid of figures, and plain tables.

/** Load once (and again when `deps` or `reloadKey` change). { data, loading, error, reload } */
export function useLoad(fn, deps = []) {
    const [state, setState] = useState({ data: null, loading: true, error: null });
    const [key, setKey] = useState(0);
    const seq = useRef(0);
    useEffect(() => {
        const id = ++seq.current;
        setState((s) => ({ ...s, loading: true, error: null }));
        Promise.resolve()
            .then(fn)
            .then((data) => id === seq.current && setState({ data, loading: false, error: null }))
            .catch((err) => id === seq.current && setState({ data: null, loading: false, error: err?.response?.data?.message || err?.message || "Couldn't load this." }));
    }, [...deps, key]); // eslint-disable-line react-hooks/exhaustive-deps
    const reload = useCallback(() => setKey((k) => k + 1), []);
    return { ...state, reload };
}

/** Card: title + one-line description (+ controls right), a divider, then the body. */
export function TabCard({ title, description, controls, link, children, flush, className }) {
    return (
        <section className={cn(CARD_FRAME, 'min-w-0 overflow-hidden', className)} aria-label={typeof title === 'string' ? title : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-hairline">
                <div className="min-w-0">
                    <h3 className="font-heading text-h5 text-foreground">{title}</h3>
                    {description ? <p className="text-body-sm text-muted-foreground">{description}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {controls}
                    {link ? (
                        <Link to={link.to} className="inline-flex items-center gap-1 h-7 text-body-sm font-medium text-primary hover:underline rounded-sm">
                            {link.label} <FiArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                    ) : null}
                </div>
            </div>
            <div className={flush ? '' : 'p-4'}>{children}</div>
        </section>
    );
}

/** Grid of figures (Stat). Shows grey placeholders while loading. */
export function Figures({ loading, count = 8, cols = 4, children }) {
    return (
        <KpiStrip cols={cols} className="gap-y-5">
            {loading
                ? Array.from({ length: count }, (_, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-6 w-28" />
                      </div>
                  ))
                : children}
        </KpiStrip>
    );
}

/**
 * Plain table inside a TabCard (pass `flush` to the card).
 * columns: [{ key, label, align?, render?(row), className? }]
 */
export function MiniTable({ columns, rows, loading, error, onRetry, empty = 'Nothing here.', onRowClick, rowKey = (r, i) => r._id || i, maxRows }) {
    if (error) {
        return (
            <div className="p-4">
                <StateCard kind="error" onRetry={onRetry}>
                    {error}
                </StateCard>
            </div>
        );
    }
    const list = maxRows ? (rows || []).slice(0, maxRows) : rows || [];
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="shadow-[inset_0_-1px_0_var(--hairline)]">
                        {columns.map((c) => (
                            <th key={c.key} scope="col" className={cn(TABLE_TH, c.align === 'right' && 'text-right', c.className)}>
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading && !rows
                        ? Array.from({ length: 5 }, (_, i) => (
                              <tr key={i} className={TABLE_ROW}>
                                  {columns.map((c) => (
                                      <td key={c.key} className={TABLE_TD}>
                                          <Skeleton className="h-3.5 w-full max-w-[140px]" />
                                      </td>
                                  ))}
                              </tr>
                          ))
                        : list.map((r, i) => (
                              <tr
                                  key={rowKey(r, i)}
                                  className={cn(TABLE_ROW, onRowClick && 'cursor-pointer')}
                                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                                  tabIndex={onRowClick ? 0 : undefined}
                                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined}
                              >
                                  {columns.map((c) => (
                                      <td key={c.key} className={cn(TABLE_TD, c.align === 'right' && 'text-right tabular-nums', c.className)}>
                                          {c.render ? c.render(r) : r[c.key]}
                                      </td>
                                  ))}
                              </tr>
                          ))}
                </tbody>
            </table>
            {!loading && !list.length ? <p className="px-4 py-6 text-center text-body-sm text-muted-foreground">{empty}</p> : null}
        </div>
    );
}

export const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const shortTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : '—');
export const daysAgo = (iso) => {
    if (!iso) return 'Never';
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};
