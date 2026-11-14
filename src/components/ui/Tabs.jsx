import React, { useRef } from 'react';
import { cn } from './cn';

// DESIGN_HANDOFF "Underline tabs": one tab level per page, on the header band's bottom edge.
// Inactive muted, active foreground + a 2px accent bar; optional count pill.

/**
 * <Tabs value={tab} onChange={setTab} label="Money Book sections"
 *       items={[{ value: 'all', label: 'All' }, { value: 'cheques', label: 'Cheques', count: 3 }]} />
 * Keyboard: ← → Home End move between tabs (and select them).
 * `bordered={false}` when the box around it already draws the line.
 */
export function Tabs({ items = [], value, onChange, label, bordered = true, className }) {
    const listRef = useRef(null);

    const onKeyDown = (e) => {
        const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!keys.includes(e.key)) return;
        e.preventDefault();
        const enabled = items.filter((t) => !t.disabled);
        const i = enabled.findIndex((t) => t.value === value);
        const next =
            e.key === 'Home'
                ? enabled[0]
                : e.key === 'End'
                  ? enabled[enabled.length - 1]
                  : enabled[(i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
        if (!next) return;
        onChange?.(next.value);
        requestAnimationFrame(() => listRef.current?.querySelector(`[data-tab="${CSS.escape(String(next.value))}"]`)?.focus());
    };

    return (
        <div
            ref={listRef}
            role="tablist"
            aria-label={label}
            onKeyDown={onKeyDown}
            className={cn('flex gap-[18px] overflow-x-auto overflow-y-hidden px-1 print:hidden', bordered && 'border-b border-border', className)}
        >
            {items.map((t) => {
                const active = t.value === value;
                const Icon = t.icon;
                return (
                    <button
                        key={t.value}
                        type="button"
                        role="tab"
                        data-tab={t.value}
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        disabled={t.disabled}
                        onClick={() => onChange?.(t.value)}
                        className={cn(
                            'relative -mb-px inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap px-0.5 text-body font-medium outline-none',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring rounded-sm',
                            'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full',
                            active ? 'text-foreground after:bg-primary' : 'text-muted-foreground hover:text-foreground after:bg-transparent',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                    >
                        {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
                        {t.label}
                        {t.count != null ? (
                            <span
                                className={cn(
                                    'text-caption rounded-full px-1.5 py-0.5 font-semibold tabular-nums leading-none',
                                    active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                                )}
                            >
                                {t.count}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}

export default Tabs;
