import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { cn } from './cn';
import { Button, IconButton } from './Button';
import { useOverlay } from './overlay';

// design/reference DESIGN_HANDOFF "Modals": popover surface, 14px radius, shadow-2, scrim.
// Sizes 400 / 480 / 640 / 880. Footer actions right-aligned, primary LAST.
// First field gets focus on open (never × or Cancel). Esc closes. A scrim click does NOT
// close by default — a half-filled form should never vanish from a stray click.
export const DIALOG_SIZES = {
    sm: 'max-w-[400px]',
    md: 'max-w-[480px]',
    lg: 'max-w-[640px]',
    xl: 'max-w-[880px]',
};

/**
 * <Dialog open onClose title description size footer footerBar>
 *   …body…
 * </Dialog>
 *
 * - `footer`: buttons, right-aligned (put the primary last).
 * - `footerBar`: draw the footer as a tinted bar across the bottom (forms).
 * - `dismissible={false}`: no ×, Esc does nothing (e.g. while saving). `hideClose`: Esc only.
 * - `closeOnScrim`: also close on a click outside (only for read-only dialogs).
 * - `bodyClassName`: padding/layout of the body; `flush` removes the body padding.
 * - Children can put `data-autofocus` on the element that should get focus first.
 */
export function Dialog({
    open = true,
    onClose,
    title,
    description,
    size = 'md',
    footer,
    footerBar = false,
    dismissible = true,
    closeOnScrim = false,
    hideClose = false,
    flush = false,
    className,
    bodyClassName,
    zIndex = 50,
    labelledBy,
    children,
}) {
    const panelRef = useRef(null);
    const titleId = useId();
    const descId = useId();
    const canClose = dismissible && typeof onClose === 'function';
    const showX = canClose && !hideClose;
    useOverlay(open, panelRef, { onEscape: canClose ? () => onClose() : undefined });

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center p-4 bg-[var(--overlay)] animate-ds-fade print:hidden"
            style={{ zIndex }}
            onMouseDown={(e) => {
                if (closeOnScrim && canClose && e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy || (title ? titleId : undefined)}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                className={cn(
                    'relative w-full max-h-[calc(100vh-2rem)] flex flex-col bg-popover text-popover-foreground',
                    'border border-hairline rounded-pop shadow-2 outline-none animate-ds-dialog-in',
                    DIALOG_SIZES[size] || DIALOG_SIZES.md,
                    className
                )}
            >
                {(title || showX) && (
                    <div className={cn('flex items-start gap-3 px-5 pt-5', title ? 'pb-3' : 'pb-0')}>
                        <div className="flex-1 min-w-0">
                            {title ? (
                                <h2 id={titleId} className="font-heading text-h4 text-foreground">
                                    {title}
                                </h2>
                            ) : null}
                            {description ? (
                                <p id={descId} className="mt-1 text-body text-muted-foreground">
                                    {description}
                                </p>
                            ) : null}
                        </div>
                        {showX ? (
                            <IconButton label="Close" size="2xs" onClick={onClose} className="-mr-1.5 -mt-0.5">
                                <FiX />
                            </IconButton>
                        ) : null}
                    </div>
                )}
                <div className={cn('flex-1 min-h-0 overflow-y-auto', flush ? '' : 'px-5 pb-5', !title && !flush && 'pt-5', bodyClassName)}>
                    {children}
                </div>
                {footer ? <DialogFooter bar={footerBar}>{footer}</DialogFooter> : null}
            </div>
        </div>,
        document.body
    );
}

/**
 * Outer frame only — for the older popups whose insides (header, × button, footer) are still
 * their own. Gives them the new surface, scrim, Esc, focus-in and focus-trap.
 * Esc clicks the button marked `data-dialog-close` (their × or Cancel), so it does exactly what
 * that button does, and nothing while that button is disabled. Pass `onClose` to override.
 * `className` is for the panel's layout (max-h, overflow, flex) only.
 */
export function DialogShell({ open = true, onClose, size = 'md', zIndex = 50, closeOnScrim = false, className, label, children }) {
    const panelRef = useRef(null);
    const escape = () => {
        if (onClose) return onClose();
        const btn = panelRef.current?.querySelector('[data-dialog-close]');
        if (btn && !btn.disabled) btn.click();
    };
    useOverlay(open, panelRef, { onEscape: escape });
    if (!open) return null;
    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center p-4 bg-[var(--overlay)] animate-ds-fade"
            style={{ zIndex }}
            onMouseDown={(e) => {
                if (closeOnScrim && e.target === e.currentTarget) escape();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                className={cn(
                    // card colour, not popover: the old insides paint sticky bars etc. in the card colour
                    'relative w-full bg-card text-card-foreground border border-hairline rounded-pop shadow-2 outline-none animate-ds-dialog-in',
                    DIALOG_SIZES[size] || DIALOG_SIZES.md,
                    className
                )}
            >
                {children}
            </div>
        </div>,
        document.body
    );
}

/** Right-aligned action row. `bar` = tinted strip across the bottom with a hairline on top. */
export const DialogFooter = ({ bar = false, className, children }) => (
    <div
        className={cn(
            'flex flex-wrap items-center justify-end gap-2 px-5',
            bar ? 'py-3 bg-muted/40 border-t border-hairline rounded-b-pop' : 'pb-5',
            className
        )}
    >
        {children}
    </div>
);

const TILE = {
    destructive: 'bg-destructive-chip text-destructive-chip-foreground',
    warning: 'bg-warning-chip text-warning-chip-foreground',
    info: 'bg-accent text-accent-foreground',
};

/**
 * Yes/no question. `tone="destructive"` for deletes/cancels; the confirm button names the
 * action ("Void bill"), Cancel names what stays ("Keep bill"). Use from JSX when the screen
 * owns the state; for one-liners from code use appConfirm() (AppDialog).
 */
export function ConfirmDialog({
    open = true,
    onConfirm,
    onCancel,
    title,
    message,
    note,
    tone = 'info',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    loading = false,
    icon,
    zIndex,
}) {
    const Icon = icon || (tone === 'info' ? FiInfo : FiAlertTriangle);
    const titleId = useId();
    return (
        <Dialog open={open} onClose={loading ? undefined : onCancel} size="sm" zIndex={zIndex} labelledBy={titleId} hideClose>
            <div className="flex items-start gap-3.5">
                <div className={cn('flex-none w-[42px] h-[42px] rounded-xl inline-flex items-center justify-center', TILE[tone] || TILE.info)}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <h2 id={titleId} className="font-heading text-h4 text-foreground">
                        {title}
                    </h2>
                    {message ? <p className="mt-1 text-body text-muted-foreground whitespace-pre-line break-words">{message}</p> : null}
                    {note ? <p className="mt-2 text-body-sm text-muted-foreground">{note}</p> : null}
                </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel} disabled={loading}>
                    {cancelText}
                </Button>
                <Button
                    variant={tone === 'destructive' ? 'destructive' : tone === 'warning' ? 'warning' : 'primary'}
                    onClick={onConfirm}
                    loading={loading}
                    data-autofocus
                >
                    {confirmText}
                </Button>
            </div>
        </Dialog>
    );
}

export default Dialog;
