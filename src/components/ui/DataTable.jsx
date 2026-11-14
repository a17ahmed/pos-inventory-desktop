import React, { useEffect, useRef, useState } from 'react';
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import {
    FiArrowDown,
    FiArrowUp,
    FiColumns,
    FiCheck,
    FiMoreHorizontal,
    FiAlignJustify,
} from 'react-icons/fi';
import { cn } from './cn';
import { IconButton } from './Button';
import { SearchInput } from './Input';
import { Menu } from './Menu';
import { Skeleton } from './Spinner';
import { EmptyState, NoResults, StateCard } from './EmptyState';
import { CARD_FRAME } from './Card';
import { TablePager, TABLE_MAX_HEIGHT, useFillHeight, skeletonRowsFor } from './tableSurface';
import { useTheme } from '../../context/ThemeContext';

// design/04-tables.md — the one table for every list. TanStack Table does the logic
// (sorting, paging, column visibility); the look is ours:
//   one card = toolbar + table + footer · mono uppercase header · 44px rows (density)
//   hover wash · selected = tint + 3px accent bar · attention = warning tint + 3px warning bar
//   money right-aligned tabular · ⋯ menu for row actions · six states.

const PAGE_SIZES = [10, 25, 50, 100];

const store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v == null ? fallback : JSON.parse(v);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* storage blocked */
        }
    },
};

/** Muted "—" for a missing value. */
export const Dash = () => <span className="text-muted-foreground/70">—</span>;

/**
 * A column of row actions: one ⋯ menu per row. `getItems(row.original)` returns Menu items.
 *   rowActions((p) => [{ label: 'Edit', icon: FiEdit2, onSelect: () => edit(p) }, { separator: true },
 *                      { label: 'Delete', icon: FiTrash2, danger: true, onSelect: () => del(p) }])
 */
export const rowActions = (getItems, { label = 'Row actions' } = {}) => ({
    id: '_actions',
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    enableHiding: false,
    meta: { align: 'right', className: 'w-12', cellClassName: 'py-0' },
    cell: ({ row }) => {
        const items = getItems(row.original).filter(Boolean);
        if (!items.length) return null;
        return (
            <div onClick={(e) => e.stopPropagation()} className="inline-flex">
                <Menu
                    label={label}
                    align="end"
                    items={items}
                    trigger={
                        <IconButton label={label} size="2xs">
                            <FiMoreHorizontal />
                        </IconButton>
                    }
                />
            </div>
        );
    },
});

/**
 * <DataTable
 *   id="products"                          // remembers page size + hidden columns on this computer
 *   data={rows} columns={columns}          // TanStack column defs; meta: { align, mono, className, cellClassName }
 *   getRowId={(r) => r._id}
 *   search={{ value, onChange, placeholder }}   filters={<Select …/>}   actions={<Button …/>}
 *   isFiltered onClearFilters               // to tell "no results" from "empty"
 *   loading error={{ message, onRetry, requestId }} forbidden
 *   empty={{ icon, title, description, action }}
 *   onRowClick={(r) => …}  rowTone={(r) => 'attention' | 'selected' | null}  rowLabel={(r) => r.name}
 *   rowClassName={(r) => r.cancelled && 'opacity-60'}
 *   server={{ page, pageSize, total, onPageChange, onPageSizeChange }}  // server paging; omit for client
 *   initialSort={[{ id: 'name', desc: false }]}
 *   title description                       // optional heading line above the toolbar
 *   maxHeight                               // rows scroll inside (default: fits the window); null = grow
 * />
 */
export function DataTable({
    id,
    data = [],
    columns,
    getRowId,
    search,
    filters,
    actions,
    isFiltered = false,
    onClearFilters,
    loading = false,
    error = null,
    forbidden = false,
    empty = {},
    onRowClick,
    rowTone,
    rowLabel,
    rowClassName,
    server,
    initialSort = [],
    pageSizes = PAGE_SIZES,
    defaultPageSize = 25,
    caption,
    title,
    description,
    maxHeight = TABLE_MAX_HEIGHT,
    className,
}) {
    const { density, setDensity } = useTheme();
    const sizeKey = id ? `ds.table.${id}.pageSize` : null;
    const hiddenKey = id ? `ds.table.${id}.hidden` : null;

    const [sorting, setSorting] = useState(initialSort);
    const [columnVisibility, setColumnVisibility] = useState(() => (hiddenKey ? store.get(hiddenKey, {}) : {}));
    const [pagination, setPagination] = useState(() => ({
        pageIndex: 0,
        pageSize: (sizeKey && store.get(sizeKey, null)) || defaultPageSize,
    }));

    useEffect(() => {
        if (hiddenKey) store.set(hiddenKey, columnVisibility);
    }, [hiddenKey, columnVisibility]);
    useEffect(() => {
        if (sizeKey && !server) store.set(sizeKey, pagination.pageSize);
    }, [sizeKey, pagination.pageSize, server]);

    const table = useReactTable({
        data,
        columns,
        getRowId,
        state: server
            ? { sorting, columnVisibility, pagination: { pageIndex: Math.max(0, (server.page || 1) - 1), pageSize: server.pageSize } }
            : { sorting, columnVisibility, pagination },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: server ? undefined : setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        ...(server
            ? { manualPagination: true, pageCount: Math.max(1, Math.ceil((server.total || 0) / (server.pageSize || 1))) }
            : { getPaginationRowModel: getPaginationRowModel() }),
    });

    const rows = table.getRowModel().rows;
    const leafColumns = table.getVisibleLeafColumns();
    const total = server ? server.total || 0 : table.getPrePaginationRowModel().rows.length;
    const pageIndex = table.getState().pagination.pageIndex;
    const pageSize = table.getState().pagination.pageSize;
    const pageCount = Math.max(1, table.getPageCount());

    const goTo = (i) => {
        const next = Math.min(Math.max(0, i), pageCount - 1);
        if (server) server.onPageChange?.(next + 1);
        else table.setPageIndex(next);
    };
    const setSize = (n) => {
        if (server) {
            server.onPageSizeChange?.(n);
            if (sizeKey) store.set(sizeKey, n);
        } else table.setPageSize(n);
    };

    const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide() && typeof c.columnDef.header === 'string');
    const columnMenu = hideable.map((c) => ({
        key: c.id,
        label: c.columnDef.header,
        icon: c.getIsVisible() ? FiCheck : () => <span className="w-3.5" />,
        onSelect: () => c.toggleVisibility(),
    }));
    const densityMenu = [
        { heading: 'Row height' },
        ...[
            ['compact', 'Compact'],
            ['default', 'Default'],
            ['comfortable', 'Comfortable'],
        ].map(([v, l]) => ({ key: v, label: l, icon: density === v ? FiCheck : () => <span className="w-3.5" />, onSelect: () => setDensity(v) })),
    ];

    const body = () => {
        if (forbidden) return <StateCard kind="forbidden">{typeof forbidden === 'string' ? forbidden : undefined}</StateCard>;
        if (error && !loading)
            return (
                <StateCard kind="error" onRetry={error.onRetry} requestId={error.requestId}>
                    {error.message}
                </StateCard>
            );
        if (!loading && rows.length === 0) {
            if (isFiltered) return <NoResults onClear={onClearFilters} />;
            return (
                <EmptyState icon={empty.icon} title={empty.title || 'Nothing here yet'} actions={empty.action}>
                    {empty.description}
                </EmptyState>
            );
        }
        return null;
    };
    const state = body();

    // The table runs to the bottom of the screen: empty space stays inside the card, extra rows
    // scroll inside. `maxHeight={null}` (tables inside side windows) turns this off.
    const areaRef = useRef(null);
    const fill = maxHeight !== null;
    const fillHeight = useFillHeight(areaRef, { enabled: fill, deps: [!!state, loading, rows.length > 0, total > pageSizes[0]] });
    const areaStyle = !fill ? undefined : fillHeight ? { height: fillHeight } : { maxHeight };

    const alignClass = (meta) => (meta?.align === 'right' ? 'text-right' : meta?.align === 'center' ? 'text-center' : 'text-left');

    return (
        <section className={cn(CARD_FRAME, 'overflow-hidden', className)} aria-label={caption}>
            {title || description ? (
                <div className="px-4 pt-3.5 pb-1">
                    {title ? <h3 className="font-heading text-h4 text-foreground">{title}</h3> : null}
                    {description ? <p className="text-body-sm text-muted-foreground">{description}</p> : null}
                </div>
            ) : null}
            {(search || filters || actions || hideable.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-3 print:hidden">
                    {search ? (
                        <SearchInput
                            className={cn('w-full', search.className || 'sm:w-[300px]')}
                            value={search.value}
                            onChange={(e) => search.onChange(e.target.value)}
                            onClear={() => search.onChange('')}
                            placeholder={search.placeholder || 'Search'}
                            aria-label={search.placeholder || 'Search'}
                        />
                    ) : null}
                    {filters}
                    <div className="ml-auto flex items-center gap-2">
                        {actions}
                        {hideable.length > 0 && (
                            <Menu
                                label="Columns"
                                align="end"
                                items={columnMenu}
                                trigger={
                                    <IconButton label="Show or hide columns" variant="outline">
                                        <FiColumns />
                                    </IconButton>
                                }
                            />
                        )}
                        <Menu
                            label="Row height"
                            align="end"
                            items={densityMenu}
                            trigger={
                                <IconButton label="Row height" variant="outline">
                                    <FiAlignJustify />
                                </IconButton>
                            }
                        />
                    </div>
                </div>
            )}

            {state ? (
                <div ref={areaRef} style={areaStyle} className={cn('border-t border-hairline overflow-auto', (error || forbidden) && 'p-3')}>
                    {state}
                </div>
            ) : (
                <div ref={areaRef} className="overflow-auto print:max-h-none print:overflow-visible print:!h-auto" style={areaStyle}>
                    <table className="w-full border-collapse text-body">
                        {caption ? <caption className="sr-only">{caption}</caption> : null}
                        <thead>
                            {table.getHeaderGroups().map((hg) => (
                                <tr key={hg.id}>
                                    {hg.headers.map((h, i) => {
                                        const meta = h.column.columnDef.meta || {};
                                        const sort = h.column.getIsSorted();
                                        const canSort = h.column.getCanSort();
                                        const label = h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext());
                                        return (
                                            <th
                                                key={h.id}
                                                scope="col"
                                                aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
                                                className={cn(
                                                    // stays on top while rows scroll; solid tint so rows don't show through
                                                    'sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)]',
                                                    'h-[var(--head-h)] px-3 font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap',
                                                    i === 0 && 'pl-4',
                                                    i === hg.headers.length - 1 && 'pr-4',
                                                    alignClass(meta),
                                                    meta.className
                                                )}
                                            >
                                                {canSort ? (
                                                    <button
                                                        type="button"
                                                        onClick={h.column.getToggleSortingHandler()}
                                                        className={cn(
                                                            'group inline-flex items-center gap-1 uppercase rounded-sm hover:text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                                                            meta.align === 'right' && 'flex-row-reverse',
                                                            sort && 'text-foreground'
                                                        )}
                                                    >
                                                        {label}
                                                        {sort === 'asc' ? (
                                                            <FiArrowUp className="w-3 h-3" aria-hidden="true" />
                                                        ) : sort === 'desc' ? (
                                                            <FiArrowDown className="w-3 h-3" aria-hidden="true" />
                                                        ) : (
                                                            <FiArrowUp className="w-3 h-3 opacity-0 group-hover:opacity-40" aria-hidden="true" />
                                                        )}
                                                    </button>
                                                ) : (
                                                    label
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {loading
                                ? Array.from({ length: fill ? skeletonRowsFor(fillHeight ? fillHeight - 36 : null) : Math.min(pageSize, 6) }).map((_, r) => (
                                      <tr key={`sk-${r}`} className="h-[var(--row-h)] shadow-[inset_0_-1px_0_var(--hairline)]">
                                          {leafColumns.map((c, i) => (
                                              <td key={c.id} className={cn('px-3', i === 0 && 'pl-4', i === leafColumns.length - 1 && 'pr-4')}>
                                                  <Skeleton className={cn('h-3.5', i === 0 ? 'w-40' : 'w-16', c.columnDef.meta?.align === 'right' && 'ml-auto')} />
                                              </td>
                                          ))}
                                      </tr>
                                  ))
                                : rows.map((row) => {
                                      const tone = rowTone?.(row.original);
                                      const clickable = !!onRowClick;
                                      return (
                                          <tr
                                              key={row.id}
                                              onClick={clickable ? () => onRowClick(row.original) : undefined}
                                              onKeyDown={
                                                  clickable
                                                      ? (e) => {
                                                            if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                                                                e.preventDefault();
                                                                onRowClick(row.original);
                                                            }
                                                        }
                                                      : undefined
                                              }
                                              tabIndex={clickable ? 0 : undefined}
                                              aria-label={clickable && rowLabel ? rowLabel(row.original) : undefined}
                                              aria-selected={tone === 'selected' || undefined}
                                              className={cn(
                                                  'h-[var(--row-h)] shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none outline-none',
                                                  'hover:bg-[var(--hover-overlay)] focus-visible:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                                                  clickable && 'cursor-pointer',
                                                  tone === 'selected' && 'bg-surface-tint',
                                                  tone === 'attention' && 'bg-warning-chip/50',
                                                  rowClassName?.(row.original)
                                              )}
                                          >
                                              {row.getVisibleCells().map((cell, i) => {
                                                  const meta = cell.column.columnDef.meta || {};
                                                  return (
                                                      <td
                                                          key={cell.id}
                                                          className={cn(
                                                              'px-3 py-1.5 align-middle',
                                                              i === 0 && 'pl-4 relative',
                                                              i === 0 && tone === 'selected' && 'before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:bg-primary',
                                                              i === 0 && tone === 'attention' && 'before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:bg-warning',
                                                              i === row.getVisibleCells().length - 1 && 'pr-4',
                                                              alignClass(meta),
                                                              meta.align === 'right' && 'tabular-nums',
                                                              meta.mono && 'font-mono text-mono-sm',
                                                              meta.cellClassName
                                                          )}
                                                      >
                                                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                      </td>
                                                  );
                                              })}
                                          </tr>
                                      );
                                  })}
                        </tbody>
                    </table>
                </div>
            )}

            {!state && !loading && total > Math.min(server ? server.pageSize : pageSizes[0], pageSizes[0]) && (
                <TablePager
                    page={pageIndex + 1}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={(p) => goTo(p - 1)}
                    pageSizes={!server || server.onPageSizeChange ? pageSizes : null}
                    onPageSizeChange={setSize}
                    noun={server?.noun}
                />
            )}
        </section>
    );
}

export default DataTable;
