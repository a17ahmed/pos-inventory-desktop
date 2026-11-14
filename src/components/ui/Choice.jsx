import React, { useEffect, useRef } from 'react';
import { FiCheck, FiMinus } from 'react-icons/fi';
import { cn } from './cn';

/**
 * Checkbox with its label. The whole row is the click target (≥ 44px tall with a label).
 * `indeterminate` shows a minus (e.g. "some rows selected").
 */
export const Checkbox = ({ checked, indeterminate = false, onChange, label, description, disabled, className, ...props }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);
    const on = checked || indeterminate;
    return (
        <label className={cn('inline-flex items-start gap-2.5', label && 'min-h-11 py-2', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
            <span className="relative mt-0.5 inline-flex w-4 h-4 shrink-0">
                <input
                    ref={ref}
                    type="checkbox"
                    checked={!!checked}
                    disabled={disabled}
                    onChange={(e) => onChange?.(e.target.checked)}
                    className={cn(
                        'peer appearance-none w-4 h-4 rounded border bg-card cursor-[inherit]',
                        on ? 'bg-primary border-primary' : 'border-input hover:border-primary',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                    )}
                    {...props}
                />
                {on && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-primary-foreground">
                        {indeterminate ? <FiMinus className="w-3 h-3" strokeWidth={3} /> : <FiCheck className="w-3 h-3" strokeWidth={3} />}
                    </span>
                )}
            </span>
            {(label || description) && (
                <span className="flex flex-col">
                    {label && <span className="text-body text-foreground">{label}</span>}
                    {description && <span className="text-caption text-muted-foreground">{description}</span>}
                </span>
            )}
        </label>
    );
};

/**
 * On/off switch (track 46×28, 20px knob; `size="xs"` 36×20). `label` is required for screen
 * readers even when the visible text sits elsewhere in the row.
 */
export const Switch = ({ checked, onChange, label, size = 'default', disabled, className }) => {
    const xs = size === 'xs';
    return (
        <button
            type="button"
            role="switch"
            aria-checked={!!checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange?.(!checked)}
            className={cn(
                'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
        >
            <span
                className={cn(
                    'inline-flex items-center rounded-full border p-[3px] transition-colors duration-150',
                    checked ? 'bg-primary border-primary' : 'bg-secondary border-input',
                    xs ? 'h-5 w-9' : 'h-7 w-[46px]'
                )}
            >
                <span
                    className={cn(
                        'block rounded-full bg-[var(--knob)] shadow-knob [transition:transform_120ms_ease]',
                        xs ? 'w-3.5 h-3.5' : 'w-5 h-5',
                        checked && (xs ? 'translate-x-[14px]' : 'translate-x-[18px]')
                    )}
                />
            </span>
        </button>
    );
};

/**
 * A row of mutually exclusive choices (Today | Week | Month, Light | Dark | System,
 * Cash | Card | Online). options: [{ value, label, icon? }].
 * appearance="pills" (default): muted track, the chosen one lifts.
 * appearance="buttons": separate outline buttons, the chosen one in the accent tint.
 */
export const SegmentedControl = ({ options, value, onChange, label, size = 'default', appearance = 'pills', disabled, className }) => {
    const h = size === 'touch' ? 'min-h-11 px-4' : size === 'xs' ? 'h-7 px-2.5' : 'h-8 px-3';
    if (appearance === 'buttons') {
        return (
            <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
                {options.map((o) => {
                    const active = o.value === value;
                    const Icon = o.icon;
                    return (
                        <button
                            key={o.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled || o.disabled}
                            onClick={() => onChange?.(o.value)}
                            className={cn(
                                'inline-flex items-center justify-center gap-1.5 rounded-xl border text-body font-medium',
                                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed',
                                size === 'touch' ? 'min-h-11 px-4' : 'h-9 px-3.5',
                                active
                                    ? 'border-primary bg-accent text-accent-foreground'
                                    : 'border-border bg-card text-foreground enabled:hover:[background-image:linear-gradient(var(--hover-overlay),var(--hover-overlay))]'
                            )}
                        >
                            {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
                            {o.label}
                        </button>
                    );
                })}
            </div>
        );
    }
    return (
        <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-xl bg-muted p-1 gap-1', className)}>
            {options.map((o) => {
                const active = o.value === value;
                const Icon = o.icon;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={disabled || o.disabled}
                        onClick={() => onChange?.(o.value)}
                        className={cn(
                            'inline-flex items-center justify-center gap-1.5 rounded-row text-body font-medium',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed',
                            h,
                            active ? 'bg-card text-foreground shadow-1' : 'text-muted-foreground enabled:hover:text-foreground enabled:hover:bg-[var(--hover-overlay)]'
                        )}
                    >
                        {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
};
