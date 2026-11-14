import React from 'react';
import { FiFilter } from 'react-icons/fi';
import { Popover } from './Popover';
import { Button } from './Button';
import { Input } from './Input';
import { Field } from './Field';
import { SegmentedControl } from './Choice';

// One "Filter" button for a list's toolbar (instead of a row of pills and dropdowns). The button
// says what's active ("This month · Pending" + a count of the extra filters); clicking opens a small
// panel with the choices, "Reset" and "Done". Used by Bills, Expenses, Supplies, Money Book.

// ── date range helpers (local YYYY-MM-DD; '' = open end) ──
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const rangeFor = (key) => {
    const now = new Date();
    const t = ymd(now);
    if (key === 'today') return { from: t, to: t };
    if (key === 'week') {
        const s = new Date(now);
        s.setDate(s.getDate() - 6);
        return { from: ymd(s), to: t };
    }
    if (key === 'month') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: t };
    return { from: '', to: '' };
};

const PRESET_LABEL = { today: 'Today', week: '7 days', month: 'This month', all: 'All dates' };

export const presetOf = (range) => ['today', 'week', 'month', 'all'].find((k) => {
    const p = rangeFor(k);
    return p.from === (range.from || '') && p.to === (range.to || '');
});

const short = (s, withYear) =>
    new Date(`${s}T00:00`).toLocaleDateString('en-GB', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });

/** "Today" · "This month" · "12 Nov 2026" · "1 Nov – 5 Nov 2026" · "Since 1 Nov" · "All dates" */
export const rangeLabel = (range) => {
    const preset = presetOf(range);
    if (preset) return PRESET_LABEL[preset];
    const { from, to } = range;
    if (from && to) return from === to ? short(from, true) : `${short(from)} – ${short(to, true)}`;
    if (from) return `Since ${short(from)}`;
    if (to) return `Until ${short(to, true)}`;
    return 'All dates';
};

/** Quick buttons + From / To. */
export function DateRangeFields({ value, onChange, label = 'Dates' }) {
    return (
        <div>
            <p className="font-mono text-overline-lg uppercase text-muted-foreground mb-1.5">{label}</p>
            <SegmentedControl
                label="Quick dates"
                size="xs"
                value={presetOf(value) || ''}
                onChange={(k) => onChange(rangeFor(k))}
                options={[
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: '7 days' },
                    { value: 'month', label: 'Month' },
                    { value: 'all', label: 'All' },
                ]}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="From">
                    <Input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
                </Field>
                <Field label="To">
                    <Input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
                </Field>
            </div>
        </div>
    );
}

/**
 * <FilterButton label="Filter expenses" summary="This month · Pending" count={1} onReset={…}>
 *   <DateRangeFields …/> <Field …><Select …/></Field>
 * </FilterButton>
 * `count` = how many filters besides the dates are set (shown as a small badge).
 */
export function FilterButton({ label = 'Filter', summary, count = 0, onReset, resetLabel = 'Reset', width = 360, children }) {
    return (
        <Popover
            label={label}
            width={width}
            trigger={
                <Button variant="outline" aria-label={`${label} — now: ${summary}`}>
                    <FiFilter aria-hidden="true" />
                    <span className="max-w-[220px] truncate">{summary}</span>
                    {count > 0 ? <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-caption font-semibold px-1.5 leading-[18px]">{count}</span> : null}
                </Button>
            }
        >
            {({ close }) => (
                <div className="flex flex-col gap-3.5">
                    {children}
                    <div className="flex items-center justify-between pt-1">
                        {onReset ? (
                            <Button variant="ghost" size="xs" onClick={onReset}>
                                {resetLabel}
                            </Button>
                        ) : (
                            <span />
                        )}
                        <Button size="xs" onClick={close}>
                            Done
                        </Button>
                    </div>
                </div>
            )}
        </Popover>
    );
}

export default FilterButton;
