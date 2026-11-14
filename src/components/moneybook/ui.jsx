import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Alert } from '../ui/Banner';
import { TablePager } from '../ui/tableSurface';
import { TableSkeleton } from '../ui/PageSkeleton';

// Small building blocks shared by the Money Book forms (and Expenses). The class strings
// match the design kit's Input / Button so plain <input>/<select>/<button> look the same.
import { BUTTON_VARIANTS } from '../ui/Button';

const FIELD =
    'rounded-xl border border-input bg-card text-body-lg text-foreground placeholder:text-placeholder placeholder:text-body ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-[invalid=true]:border-destructive read-only:bg-muted/40';

export const inputCls = `w-full min-h-9 px-3 py-1.5 ${FIELD}`;

export const filterCls = `h-9 px-3 ${FIELD}`;

const BTN =
    'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-body-lg font-medium whitespace-nowrap ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';

export const btnGhost = `flex-1 ${BTN} ${BUTTON_VARIANTS.ghost}`;

/** Main action. Colour names are kept for the callers; red = a destructive action, everything else = primary. */
export const btnSolid = (color = 'emerald', grow = true) =>
    `${grow ? 'flex-1 ' : ''}${BTN} ${color === 'red' ? BUTTON_VARIANTS.destructive : BUTTON_VARIANTS.primary}`;

/**
 * Form popup used by the Money Book screens — now the design-system Dialog (Stage 4):
 * Esc closes it, focus starts in the first field, and the page behind can't be tabbed into.
 * Children keep their own padding and buttons.
 */
export const Modal = ({ title, onClose, children, wide = false }) => (
    <Dialog title={title} onClose={onClose} size={wide ? 'lg' : 'md'} flush bodyClassName="border-t border-hairline">
        {children}
    </Dialog>
);

export const Field = ({ label, children, hint }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-body-sm font-medium text-foreground">{label}</label>
        {children}
        {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
    </div>
);

export const ErrorBox = ({ children }) => (children ? <Alert tone="destructive">{children}</Alert> : null);

/** Loading: a few grey table rows (was a spinner). */
export const Spinner = () => <TableSkeleton toolbar={false} columns={4} rows={4} />;

/** Paging footer for Money Book lists (server pages of `limit`, default 50) — the shared table footer. */
export const Pager = ({ pagination, onPage, noun = 'entries' }) =>
    pagination?.pages > 1 ? (
        <TablePager
            page={pagination.page}
            pageSize={pagination.limit || Math.ceil((pagination.total || 0) / pagination.pages) || 50}
            total={pagination.total || 0}
            onPageChange={onPage}
            noun={noun}
        />
    ) : null;

/** Amount text, red with a minus sign when negative */
export const Money = ({ value, fmt, className = '' }) => (
    <span className={`${(Number(value) || 0) < 0 ? 'text-destructive' : ''} ${className}`}>{fmt(value)}</span>
);
