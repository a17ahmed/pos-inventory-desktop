import React from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

// Ported from design/reference/source/components-v3/Button.tsx (Tailwind 3, no cva).
// Corners: rounded-xl = the design's 12px control radius.
// Hover/press: solid buttons brighten; the others get a wash painted OVER their
// background (so an outline button keeps its card colour), plus a 0.5px press shift.
const PRESS = 'enabled:active:[transform:var(--press-shift)]';
const BRIGHT = `enabled:hover:[filter:var(--hover-brighten)] enabled:active:[filter:var(--press-brighten)] ${PRESS}`;
const WASH = `enabled:hover:[background-image:linear-gradient(var(--hover-overlay),var(--hover-overlay))] enabled:active:[background-image:linear-gradient(var(--press-overlay),var(--press-overlay))] ${PRESS}`;

const BASE =
    'inline-flex items-center justify-center gap-2 rounded-xl text-center font-medium whitespace-nowrap select-none ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    'disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0';

export const BUTTON_VARIANTS = {
    primary: `bg-primary text-primary-foreground ${BRIGHT}`,
    destructive: `bg-destructive text-destructive-foreground ${BRIGHT}`,
    warning: `bg-warning text-warning-foreground ${BRIGHT}`,
    outline: `border border-border bg-card text-foreground ${WASH}`,
    secondary: `bg-secondary text-secondary-foreground ${WASH}`,
    ghost: `text-muted-foreground enabled:hover:text-foreground ${WASH}`,
    link: 'text-primary underline-offset-4 enabled:hover:underline',
};

// Heights follow the design's ladder: 36 default · 32 xs · 40 action · 44 touch.
export const BUTTON_SIZES = {
    default: 'h-9 px-4 text-body-lg [&_svg]:w-4 [&_svg]:h-4',
    xs: 'h-8 px-2.5 text-body [&_svg]:w-3.5 [&_svg]:h-3.5',
    action: 'min-h-10 px-4 text-body-lg [&_svg]:w-4 [&_svg]:h-4',
    touch: 'min-h-11 px-4 text-body-lg [&_svg]:w-4 [&_svg]:h-4',
};

const ICON_SIZES = {
    default: 'w-9 h-9 [&_svg]:w-4 [&_svg]:h-4',
    xs: 'w-8 h-8 [&_svg]:w-3.5 [&_svg]:h-3.5',
    '2xs': 'w-7 h-7 [&_svg]:w-3.5 [&_svg]:h-3.5',
    touch: 'w-11 h-11 [&_svg]:w-4 [&_svg]:h-4',
};

/**
 * <Button variant="primary|outline|secondary|ghost|destructive|warning|link" size="default|xs|action|touch">
 * One `primary` per view. `loading` shows a spinner and blocks clicks.
 */
export const Button = React.forwardRef(
    ({ variant = 'primary', size = 'default', loading = false, disabled, type = 'button', className, children, ...props }, ref) => (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                BASE,
                BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary,
                variant === 'link' ? 'h-auto p-0 text-body-sm' : BUTTON_SIZES[size] || BUTTON_SIZES.default,
                className
            )}
            {...props}
        >
            {loading && <Spinner size={size === 'xs' ? 'sm' : 'md'} tone="current" label="Working" />}
            {children}
        </button>
    )
);
Button.displayName = 'Button';

/**
 * Square icon-only button. `label` is required: it becomes the aria-label and a styled
 * Tooltip (design rule: every icon-only button gets both). `tooltip={false}` turns the
 * tooltip off where the label is already visible next to it.
 */
export const IconButton = React.forwardRef(
    ({ label, variant = 'ghost', size = 'default', loading = false, disabled, type = 'button', tooltip = true, className, children, ...props }, ref) => (
        <Tooltip content={tooltip ? label : null}>
            <button
                ref={ref}
                type={type}
                aria-label={label}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                className={cn(BASE, BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.ghost, ICON_SIZES[size] || ICON_SIZES.default, className)}
                {...props}
            >
                {loading ? <Spinner size="sm" tone="current" label="Working" /> : children}
            </button>
        </Tooltip>
    )
);
IconButton.displayName = 'IconButton';

export default Button;
