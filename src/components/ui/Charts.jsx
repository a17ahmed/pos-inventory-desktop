import React, { useMemo, useState } from 'react';
import {
    Area,
    AreaChart as RAreaChart,
    Bar,
    BarChart as RBarChart,
    CartesianGrid,
    Cell,
    LabelList,
    ComposedChart,
    Line,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as RTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { FiMoreHorizontal, FiTable, FiBarChart2, FiDownload, FiAlertCircle } from 'react-icons/fi';
import { cn } from './cn';
import { useTheme } from '../../context/ThemeContext';
import { Menu } from './Menu';
import { IconButton, Button } from './Button';
import { Skeleton } from './Spinner';
import { EmptyState } from './EmptyState';
import { CARD_FRAME } from './Card';
import { TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from './tableSurface';

// design/06-charts.md §2 — one look for every chart. Colours only from --chart-1…6 (the first is
// the shop's accent); light grid, 11.5px muted axis text, popover tooltip, rounded bar tops,
// donut (never pie) with a legend table. recharts draws; these wrappers decide the look.

/** Colours read from the theme, re-read when light/dark or the accent changes. */
export function useChartTheme() {
    const { isDark, accent } = useTheme();
    return useMemo(() => {
        const css = getComputedStyle(document.documentElement);
        const v = (n) => css.getPropertyValue(n).trim();
        return {
            series: [1, 2, 3, 4, 5, 6].map((i) => v(`--chart-${i}`)),
            muted: v('--muted-foreground'),
            grid: v('--hairline'),
            fg: v('--foreground'),
            tint: `color-mix(in oklab, ${v('--chart-1')} 38%, transparent)`,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDark, accent]);
}

const AXIS = { fontSize: 11.5 };

/** Popover-styled tooltip. `rows(payload)` → [[label, value]] for the hovered point. */
const ChartTooltip = ({ active, payload, label, title, rows }) => {
    if (!active || !payload?.length) return null;
    const lines = rows ? rows(payload[0].payload) : payload.map((p) => [p.name, p.value]);
    return (
        <div className="rounded-xl border border-hairline bg-popover text-popover-foreground shadow-2 px-3 py-2 text-body-sm">
            <p className="font-medium text-foreground mb-1">{title ? title(payload[0].payload) : label}</p>
            {lines.map(([k, val]) => (
                <p key={k} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="tabular-nums font-medium">{val}</span>
                </p>
            ))}
        </div>
    );
};

/**
 * Vertical bars. data: [{ [xKey], [yKey], … }]. `highlight` = x value drawn solid (the current hour /
 * the peak); the others are a lighter tint. `format(v)` for axis + labels; `tooltipRows(d)`.
 */
export function BarChart({ data = [], xKey = 'label', yKey = 'value', highlight, format = (v) => v, axisFormat, tooltipTitle, tooltipRows, height = 240, showValueOnHighlight = true }) {
    const t = useChartTheme();
    const max = Math.max(0, ...data.map((d) => Number(d[yKey]) || 0));
    // a 0 bar still shows a 2px stub so the day reads as "nothing" rather than "missing"
    const stub = max > 0 ? max * 0.008 : 0;
    const rows = data.map((d) => ({ ...d, __v: (Number(d[yKey]) || 0) || stub }));
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RBarChart data={rows} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={t.grid} />
                <XAxis dataKey={xKey} tick={{ ...AXIS, fill: t.muted }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis tick={{ ...AXIS, fill: t.muted }} tickLine={false} axisLine={false} width={78} tickFormatter={axisFormat || format} allowDecimals={false} />
                <RTooltip cursor={{ fill: 'var(--hover-overlay)' }} content={<ChartTooltip title={tooltipTitle} rows={tooltipRows || ((d) => [['Value', format(d[yKey])]])} />} />
                <Bar dataKey="__v" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                    {rows.map((d) => (
                        <Cell key={d[xKey]} fill={highlight != null && d[xKey] === highlight ? t.series[0] : t.tint} />
                    ))}
                    {showValueOnHighlight && highlight != null ? (
                        <LabelList
                            dataKey="__v"
                            position="top"
                            content={({ x, y, width, index }) =>
                                rows[index]?.[xKey] === highlight && Number(rows[index][yKey]) > 0 ? (
                                    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={t.fg}>
                                        {format(rows[index][yKey])}
                                    </text>
                                ) : null
                            }
                        />
                    ) : null}
                </Bar>
            </RBarChart>
        </ResponsiveContainer>
    );
}

/**
 * Two linked charts on one time axis: money as bars on top, a count as a line below
 * (e.g. sales and bills per day). Hovering one highlights the same day in both.
 * data: [{ [xKey], [barKey], [lineKey] }]; `barFormat` for the money axis; `tooltipRows(d)`.
 */
export function BarLineChart({ data = [], xKey = 'label', barKey, lineKey, barLabel, lineLabel, barFormat = (v) => v, tooltipTitle, tooltipRows, height = 220, lineHeight = 90 }) {
    const t = useChartTheme();
    const syncId = useMemo(() => `bl-${Math.random().toString(36).slice(2)}`, []);
    const rows = tooltipRows || ((d) => [[barLabel, barFormat(d[barKey])], [lineLabel, d[lineKey]]]);
    const axisX = { dataKey: xKey, tick: { ...AXIS, fill: t.muted }, tickLine: false, interval: 'preserveStartEnd', minTickGap: 16 };
    const Caption = ({ children }) => <p className="text-caption text-muted-foreground mb-1">{children}</p>;
    return (
        <div>
            <div className="flex items-center gap-4 mb-3 text-body-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.series[0] }} aria-hidden="true" />
                    {barLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 rounded-full" style={{ background: t.series[1] }} aria-hidden="true" />
                    {lineLabel}
                </span>
            </div>
            <Caption>{barLabel}</Caption>
            <ResponsiveContainer width="100%" height={height}>
                <RBarChart data={data} syncId={syncId} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                    <CartesianGrid vertical={false} stroke={t.grid} />
                    <XAxis {...axisX} hide />
                    <YAxis tick={{ ...AXIS, fill: t.muted }} tickLine={false} axisLine={false} width={78} tickFormatter={barFormat} allowDecimals={false} />
                    <RTooltip cursor={{ fill: 'var(--hover-overlay)' }} content={<ChartTooltip title={tooltipTitle} rows={rows} />} />
                    <Bar dataKey={barKey} name={barLabel} fill={t.series[0]} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                </RBarChart>
            </ResponsiveContainer>
            <Caption>{lineLabel}</Caption>
            <ResponsiveContainer width="100%" height={lineHeight}>
                {/* ComposedChart keeps the band scale of the bars above, so each dot sits over its bar */}
                <ComposedChart data={data} syncId={syncId} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                    <CartesianGrid vertical={false} stroke={t.grid} />
                    <XAxis {...axisX} scale="band" axisLine={{ stroke: t.grid }} />
                    <YAxis tick={{ ...AXIS, fill: t.muted }} tickLine={false} axisLine={false} width={78} allowDecimals={false} tickCount={3} />
                    {/* one tooltip only (on the bars); this chart just shows the synced cursor */}
                    <RTooltip cursor={{ fill: 'var(--hover-overlay)' }} content={() => null} />
                    <Line type="linear" dataKey={lineKey} name={lineLabel} stroke={t.series[1]} strokeWidth={1.75} dot={data.length > 45 ? false : { r: 2, fill: t.series[1], strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Bars side by side per x value, e.g. bought vs paid per month.
 * series: [{ key, label, color? }] — colour defaults to --chart-1, --chart-2, …; a small legend sits on top.
 */
export function GroupedBarChart({ data = [], xKey = 'label', series = [], format = (v) => v, axisFormat, tooltipTitle, height = 220 }) {
    const t = useChartTheme();
    const colorOf = (s, i) => s.color || t.series[i % t.series.length];
    return (
        <div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1.5 text-body-sm text-muted-foreground">
                {series.map((s, i) => (
                    <span key={s.key} className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: colorOf(s, i) }} aria-hidden="true" />
                        {s.label}
                    </span>
                ))}
            </div>
            <ResponsiveContainer width="100%" height={height}>
                <RBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%" barGap={3}>
                    <CartesianGrid vertical={false} stroke={t.grid} />
                    <XAxis dataKey={xKey} tick={{ ...AXIS, fill: t.muted }} tickLine={false} axisLine={false} interval={0} minTickGap={4} />
                    <YAxis tick={{ ...AXIS, fill: t.muted }} tickLine={false} axisLine={false} width={78} tickFormatter={axisFormat || format} allowDecimals={false} />
                    <RTooltip
                        cursor={{ fill: 'var(--hover-overlay)' }}
                        content={<ChartTooltip title={tooltipTitle} rows={(d) => series.map((s) => [s.label, format(d[s.key] || 0)])} />}
                    />
                    {series.map((s, i) => (
                        <Bar key={s.key} dataKey={s.key} name={s.label} fill={colorOf(s, i)} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                    ))}
                </RBarChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Area for a trend over time. Same props as BarChart. */
export function AreaChart({ data = [], xKey = 'label', yKey = 'value', format = (v) => v, axisFormat, tooltipTitle, tooltipRows, height = 240 }) {
    const t = useChartTheme();
    const gid = useMemo(() => `ds-area-${Math.random().toString(36).slice(2, 8)}`, []);
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RAreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={t.series[0]} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={t.series[0]} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={t.grid} />
                <XAxis dataKey={xKey} tick={{ ...AXIS, fill: t.muted }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                <YAxis tick={{ ...AXIS, fill: t.muted }} tickLine={false} axisLine={false} width={78} tickFormatter={axisFormat || format} allowDecimals={false} />
                <RTooltip content={<ChartTooltip title={tooltipTitle} rows={tooltipRows || ((d) => [['Value', format(d[yKey])]])} />} />
                <Area type="monotone" dataKey={yKey} stroke={t.series[0]} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} />
            </RAreaChart>
        </ResponsiveContainer>
    );
}

/**
 * Horizontal bars with the name on the left and the value at the end — rankings
 * (by cashier, top products). data: [{ label, value, note? }]. `onSelect(d)` makes rows buttons.
 */
export function HorizontalBarChart({ data = [], format = (v) => v, onSelect, max: maxProp }) {
    const max = maxProp || Math.max(1, ...data.map((d) => Number(d.value) || 0));
    return (
        <ul className="flex flex-col gap-1">
            {data.map((d, i) => {
                const pct = Math.max(0, Math.min(100, ((Number(d.value) || 0) / max) * 100));
                const inner = (
                    <>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 truncate text-body">{d.label}</span>
                            <span className="flex-none text-body tabular-nums font-medium">{format(d.value)}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${pct}%`, opacity: i === 0 ? 1 : 0.55 }} />
                        </div>
                        {d.note ? <p className="mt-0.5 text-body-sm text-muted-foreground">{d.note}</p> : null}
                    </>
                );
                return (
                    <li key={d.key ?? d.label}>
                        {onSelect ? (
                            <button type="button" onClick={() => onSelect(d)} className="w-full text-left rounded-row px-2 py-1.5 hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                                {inner}
                            </button>
                        ) : (
                            <div className="px-2 py-1.5">{inner}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/** Donut + legend table (amount and %). Max 6 slices; the rest become "Other". */
export function DonutChart({ data = [], format = (v) => v, countLabel = 'Count', height = 180 }) {
    const t = useChartTheme();
    const sorted = [...data].filter((d) => (Number(d.value) || 0) > 0).sort((a, b) => b.value - a.value);
    const slices =
        sorted.length > 6
            ? [...sorted.slice(0, 5), { label: 'Other', value: sorted.slice(5).reduce((s, d) => s + d.value, 0), count: sorted.slice(5).reduce((s, d) => s + (d.count || 0), 0) }]
            : sorted;
    const total = slices.reduce((s, d) => s + d.value, 0);
    const hasCount = slices.some((d) => d.count != null);
    return (
        <div className="flex flex-wrap items-center gap-5">
            <div className="flex-none" style={{ width: height, height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={slices} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={slices.length > 1 ? 1.5 : 0} stroke="none" isAnimationActive={false}>
                            {slices.map((d, i) => (
                                <Cell key={d.label} fill={t.series[i % 6]} />
                            ))}
                        </Pie>
                        <RTooltip content={<ChartTooltip title={(d) => d.label} rows={(d) => [['Amount', format(d.value)], ['Share', `${total ? ((d.value / total) * 100).toFixed(1) : 0}%`]]} />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <table className="flex-1 min-w-[220px] max-w-[560px] border-collapse text-body">
                <tbody>
                    {slices.map((d, i) => (
                        <tr key={d.label} className="shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none">
                            <td className="py-1.5 pr-2 w-4">
                                <span className="block w-2.5 h-2.5 rounded-[3px]" style={{ background: t.series[i % 6] }} aria-hidden="true" />
                            </td>
                            <td className="py-1.5 pr-3 capitalize">{d.label}</td>
                            {hasCount ? <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{d.count ?? ''}</td> : null}
                            <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{format(d.value)}</td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground w-12">{total ? `${((d.value / total) * 100).toFixed(0)}%` : '—'}</td>
                        </tr>
                    ))}
                </tbody>
                {hasCount ? (
                    <caption className="sr-only">
                        {countLabel}, amount and share
                    </caption>
                ) : null}
            </table>
        </div>
    );
}

/** Tiny trend line for inside a KPI tile. */
export function Sparkline({ data = [], yKey = 'value', height = 32 }) {
    const t = useChartTheme();
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RAreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <Area type="monotone" dataKey={yKey} stroke={t.series[0]} strokeWidth={1.5} fill={t.series[0]} fillOpacity={0.12} isAnimationActive={false} />
            </RAreaChart>
        </ResponsiveContainer>
    );
}

/** The table view of a chart: columns [{ key, label, align, format }], rows, optional totals row. */
export function ChartTable({ columns = [], rows = [], totals }) {
    return (
        <div className="overflow-x-auto -mx-1">
            <table className="w-full border-collapse">
                <thead>
                    <tr className={TABLE_HEAD_ROW}>
                        {columns.map((c) => (
                            <th key={c.key} className={cn(TABLE_TH, c.align === 'right' && 'text-right')}>
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className={TABLE_ROW}>
                            {columns.map((c) => (
                                <td key={c.key} className={cn(TABLE_TD, c.align === 'right' && 'text-right tabular-nums')}>
                                    {c.format ? c.format(r[c.key], r) : r[c.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {totals ? (
                        <tr className="bg-muted/50 font-semibold">
                            {columns.map((c, i) => (
                                <td key={c.key} className={cn(TABLE_TD, c.align === 'right' && 'text-right tabular-nums')}>
                                    {i === 0 ? 'Total' : totals[c.key] != null ? (c.format ? c.format(totals[c.key], totals) : totals[c.key]) : ''}
                                </td>
                            ))}
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
    );
}

const toCsv = (columns, rows) => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))].join('\n');
};

/**
 * One card per chart. Header: title, description (period + time zone), `controls` on the right
 * (e.g. a Sales | Bills SegmentedControl) and a ⋯ menu (Show as table / Download CSV) when
 * `table` = { columns, rows, totals, filename } is given. States: loading · error · empty.
 * `flat` = no card (inside a drawer section or another card).
 */
export function ChartPanel({ title, description, controls, table, loading, error, onRetry, empty, isEmpty, flat, footer, className, children }) {
    const [asTable, setAsTable] = useState(false);
    const download = () => {
        const url = URL.createObjectURL(new Blob([toCsv(table.columns, table.rows)], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${table.filename || 'chart'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    const body = loading ? (
        <Skeleton className="h-[200px] w-full rounded-xl" />
    ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <FiAlertCircle className="w-5 h-5 text-destructive" aria-hidden="true" />
            <p className="text-body font-medium">Couldn't load this chart</p>
            {typeof error === 'string' ? <p className="text-body-sm text-muted-foreground">{error}</p> : null}
            {onRetry ? (
                <Button size="xs" variant="outline" onClick={onRetry}>
                    Try again
                </Button>
            ) : null}
        </div>
    ) : isEmpty ? (
        <EmptyState size="sm" icon={empty?.icon} title={empty?.title || 'Nothing to show'} actions={empty?.action}>
            {empty?.description}
        </EmptyState>
    ) : asTable && table ? (
        <ChartTable columns={table.columns} rows={table.rows} totals={table.totals} />
    ) : (
        children
    );
    return (
        <section className={cn(flat ? '' : cn(CARD_FRAME, 'p-4'), 'min-w-0', className)} aria-label={typeof title === 'string' ? title : undefined}>
            {(title || controls || table) && (
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2 mb-3">
                    <div className="flex-1 min-w-[160px]">
                        {title ? <h3 className="font-heading text-h4 text-foreground">{title}</h3> : null}
                        {description ? <p className="text-body-sm text-muted-foreground">{description}</p> : null}
                    </div>
                    {controls}
                    {table && !loading && !error && !isEmpty ? (
                        <Menu
                            label="Chart options"
                            align="end"
                            items={[
                                asTable
                                    ? { label: 'Show as chart', icon: FiBarChart2, onSelect: () => setAsTable(false) }
                                    : { label: 'Show as table', icon: FiTable, onSelect: () => setAsTable(true) },
                                { label: 'Download CSV', icon: FiDownload, onSelect: download },
                            ]}
                            trigger={
                                <IconButton label="Chart options" size="xs">
                                    <FiMoreHorizontal />
                                </IconButton>
                            }
                        />
                    ) : null}
                </div>
            )}
            {body}
            {footer ? <div className="mt-3">{footer}</div> : null}
        </section>
    );
}

export default ChartPanel;
