import React from 'react';
import { FiChevronLeft, FiChevronRight, FiArrowRight } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { Drawer } from './Drawer';
import { IconButton, Button } from './Button';
import { Input } from './Input';
import { SegmentedControl } from './Choice';

// design/06-charts.md §3 — the window that opens from a dashboard tile: wide right-hand panel,
// title + date line, and the period control ‹ date › · Today · Day / Week / Month / Custom.
// A day shows charts by hour; a longer period by day.

// ── period helpers (local dates, YYYY-MM-DD — never toISOString, which shifts to UTC) ──
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseYmd = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
};
const addDays = (s, n) => {
    const d = parseYmd(s);
    d.setDate(d.getDate() + n);
    return ymd(d);
};
export const todayYmd = () => ymd(new Date());
export const daysBetween = (from, to) => Math.round((parseYmd(to) - parseYmd(from)) / 86400000) + 1;

/** { preset, from, to } for a preset ending today (week = last 7 days, month = this month so far). */
export const periodFor = (preset, anchor = todayYmd()) => {
    if (preset === 'week') return { preset, from: addDays(anchor, -6), to: anchor };
    if (preset === 'month') {
        const a = parseYmd(anchor);
        return { preset, from: ymd(new Date(a.getFullYear(), a.getMonth(), 1)), to: anchor };
    }
    return { preset: 'day', from: anchor, to: anchor };
};

/** The dashboard's today / week / month filter that matches a period, or null. */
export const summaryFilterFor = (p) => {
    const t = todayYmd();
    if (p.to !== t) return null;
    if (p.from === t) return 'today';
    if (p.from === addDays(t, -6)) return 'week';
    if (p.from === periodFor('month').from) return 'month';
    return null;
};

const fmtDay = (s) => parseYmd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const periodLabel = (p) => (p.from === p.to ? fmtDay(p.from) : `${fmtDay(p.from)} – ${fmtDay(p.to)}`);

/** Shift the whole period back / forward by its own length. */
const shift = (p, dir) => {
    const len = daysBetween(p.from, p.to);
    if (p.preset === 'month') {
        const a = parseYmd(p.from);
        const start = new Date(a.getFullYear(), a.getMonth() + dir, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        const t = parseYmd(todayYmd());
        return { preset: 'month', from: ymd(start), to: ymd(end > t ? t : end) };
    }
    return { ...p, from: addDays(p.from, dir * len), to: addDays(p.to, dir * len) };
};

/**
 * Period control. `limited` = the window's data source only knows today / last 7 days / this
 * month (older servers) — then only those three show.
 */
export function PeriodControl({ period, onChange, limited }) {
    const today = todayYmd();
    if (limited) {
        const value = summaryFilterFor(period) || 'today';
        return (
            <SegmentedControl
                label="Period"
                size="xs"
                value={value}
                onChange={(v) => onChange(periodFor(v === 'today' ? 'day' : v))}
                options={[
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'Last 7 days' },
                    { value: 'month', label: 'This month' },
                ]}
            />
        );
    }
    const atToday = period.to >= today;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
                <IconButton label="Previous period" size="xs" variant="outline" onClick={() => onChange(shift(period, -1))}>
                    <FiChevronLeft />
                </IconButton>
                {period.preset === 'custom' ? (
                    <>
                        <Input type="date" size="xs" className="w-[140px]" value={period.from} max={period.to} onChange={(e) => e.target.value && onChange({ ...period, from: e.target.value })} aria-label="From" />
                        <span className="text-body-sm text-muted-foreground">to</span>
                        <Input type="date" size="xs" className="w-[140px]" value={period.to} min={period.from} max={today} onChange={(e) => e.target.value && onChange({ ...period, to: e.target.value })} aria-label="To" />
                    </>
                ) : (
                    <Input
                        type="date"
                        size="xs"
                        className="w-[140px]"
                        value={period.to}
                        max={today}
                        onChange={(e) => e.target.value && onChange(periodFor(period.preset, e.target.value))}
                        aria-label="Date"
                    />
                )}
                <IconButton label="Next period" size="xs" variant="outline" disabled={atToday} onClick={() => onChange(shift(period, 1))}>
                    <FiChevronRight />
                </IconButton>
                <Button size="xs" variant="ghost" disabled={period.preset === 'day' && period.from === today} onClick={() => onChange(periodFor('day'))}>
                    Today
                </Button>
            </div>
            <SegmentedControl
                label="Period length"
                size="xs"
                value={period.preset}
                onChange={(v) => onChange(v === 'custom' ? { ...period, preset: 'custom' } : periodFor(v, period.to > today ? today : period.to))}
                options={[
                    { value: 'day', label: 'Day' },
                    { value: 'week', label: 'Week' },
                    { value: 'month', label: 'Month' },
                    { value: 'custom', label: 'Custom' },
                ]}
            />
        </div>
    );
}

/**
 * <InsightDrawer open onClose title="Sales" period={…} onPeriodChange={…} limited note="…"
 *                reportLink={{ to: '/reports', label: 'Open full report' }}>sections…</InsightDrawer>
 */
export function InsightDrawer({ open, onClose, title, period, onPeriodChange, limited, note, reportLink, children }) {
    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="lg"
            eyebrow="Insight"
            title={title}
            meta={
                <div className="flex flex-col gap-2 w-full">
                    <p className="text-body-sm text-muted-foreground">
                        {period ? periodLabel(period) : ''} · Pakistan time, midnight to midnight
                        {note ? <span className="block text-warning-chip-foreground">{note}</span> : null}
                    </p>
                    {period && onPeriodChange ? <div className="self-start"><PeriodControl period={period} onChange={onPeriodChange} limited={limited} /></div> : null}
                </div>
            }
            footer={
                reportLink ? (
                    <Link to={reportLink.to} className="inline-flex items-center gap-1.5 text-body font-medium text-primary hover:underline">
                        {reportLink.label || 'Open full report'} <FiArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                ) : null
            }
        >
            {children}
        </Drawer>
    );
}

export default InsightDrawer;
