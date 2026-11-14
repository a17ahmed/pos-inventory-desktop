import React from 'react';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';
import { cn } from './cn';

// Ported from design/reference/source/components-v3/Input.tsx. Same heights as Button so a
// row of controls lines up: 36 default · 32 xs · 40 action · 44 touch.
const FIELD_BASE =
    'rounded-xl border text-body-lg text-foreground placeholder:text-placeholder placeholder:text-body ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:placeholder:text-transparent ' +
    'aria-[invalid=true]:border-destructive read-only:bg-muted/40';

export const INPUT_VARIANTS = {
    outline: 'border-input bg-card',
    tinted: 'border-border bg-card',
    filled: 'border-transparent bg-muted shadow-[inset_0_-1px_0_var(--input)]',
};

export const INPUT_SIZES = { default: 'h-9', xs: 'h-8 text-body', action: 'min-h-10', touch: 'min-h-11' };

// Full width unless the caller gives a width (cn() can't override classes, so don't add both)
const widthFor = (className) => (/(^|\s)(w-|min-w-|max-w-|flex-1|basis-)/.test(className || '') ? '' : 'w-full');

export const Input = React.forwardRef(({ variant = 'outline', size = 'default', mono = false, className, ...props }, ref) => (
    <input
        ref={ref}
        className={cn(FIELD_BASE, widthFor(className), INPUT_VARIANTS[variant], INPUT_SIZES[size], 'px-3', mono && 'font-mono', className)}
        {...props}
    />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ variant = 'outline', rows = 3, className, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(FIELD_BASE, widthFor(className), INPUT_VARIANTS[variant], 'px-3 py-2 resize-y', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/** Native <select> in the input's box with a chevron. Children are <option>s. */
export const Select = React.forwardRef(({ variant = 'outline', size = 'default', className, children, ...props }, ref) => (
    <div className={cn('relative', className)}>
        <select
            ref={ref}
            className={cn(FIELD_BASE, 'w-full', INPUT_VARIANTS[variant], INPUT_SIZES[size], 'appearance-none pl-3 pr-9 cursor-pointer disabled:cursor-not-allowed')}
            {...props}
        >
            {children}
        </select>
        <FiChevronDown
            aria-hidden="true"
            className={cn('pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-70', size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4')}
        />
    </div>
));
Select.displayName = 'Select';

/** Input with a leading search icon and an optional clear (×) button when it has text. */
export const SearchInput = React.forwardRef(({ value, onClear, size = 'default', className, placeholder = 'Search', ...props }, ref) => (
    <div className={cn('relative', className)}>
        <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
            ref={ref}
            type="search"
            value={value}
            placeholder={placeholder}
            className={cn(FIELD_BASE, 'w-full', INPUT_VARIANTS.outline, INPUT_SIZES[size], 'pl-9', onClear ? 'pr-9' : 'pr-3', '[&::-webkit-search-cancel-button]:appearance-none')}
            {...props}
        />
        {onClear && value ? (
            <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                onClick={onClear}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-row inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--hover-overlay)]"
            >
                <FiX className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
        ) : null}
    </div>
));
SearchInput.displayName = 'SearchInput';

export default Input;
