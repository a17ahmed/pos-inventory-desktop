import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { cn } from './cn';
import { IconButton } from './Button';
import { useOverlay } from './overlay';

// design DESIGN_HANDOFF "Drawer": docked on the right. Header (eyebrow code, title, chips,
// actions, close) → body of sections split by 1px rules → sticky footer (primary right,
// destructive at the start). Decisions about the drawer's record happen in its footer —
// never a dialog over a drawer. Sizes: sm 480 · md 600 · lg 58vw (700–880).
export const DRAWER_SIZES = {
    sm: 'w-[480px]',
    md: 'w-[600px]',
    lg: 'w-[58vw] min-w-[700px] max-w-[880px]',
};

/**
 * <Drawer open onClose eyebrow="BILL #1042" title="Ali Traders" meta={<StatusBadge …/>}
 *         actions={<IconButton …/>} footerStart={<Button variant="destructive">…</Button>}
 *         footer={<><Button variant="ghost">Close</Button><Button>Reprint</Button></>}>
 *   <DrawerSection title="Items">…</DrawerSection>
 * </Drawer>
 * A click on the dimmed page closes it (it shows a record, not a half-filled form).
 */
export function Drawer({
    open = true,
    onClose,
    eyebrow,
    title,
    meta,
    actions,
    footer,
    footerStart,
    size = 'md',
    closeOnScrim = true,
    className,
    children,
}) {
    const panelRef = useRef(null);
    const titleId = useId();
    useOverlay(open, panelRef, { onEscape: onClose ? () => onClose() : undefined });

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex justify-end bg-[var(--overlay)] animate-ds-fade print:hidden"
            onMouseDown={(e) => {
                if (closeOnScrim && onClose && e.target === e.currentTarget) onClose();
            }}
        >
            <aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                tabIndex={-1}
                className={cn(
                    'h-full max-w-[calc(100vw-48px)] flex flex-col bg-popover text-popover-foreground border-l border-hairline shadow-2 outline-none animate-ds-drawer-in',
                    DRAWER_SIZES[size] || DRAWER_SIZES.md,
                    className
                )}
            >
                <header className="flex items-start gap-3 px-5 pt-4 pb-4 border-b border-hairline">
                    <div className="flex-1 min-w-0">
                        {eyebrow ? <p className="font-mono text-mono-xs text-muted-foreground uppercase tracking-wide">{eyebrow}</p> : null}
                        {title ? (
                            <h2 id={titleId} className="font-heading text-h3 text-foreground truncate">
                                {title}
                            </h2>
                        ) : null}
                        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
                    </div>
                    <div className="flex flex-none items-center gap-1">
                        {actions}
                        {onClose ? (
                            <IconButton label="Close" size="xs" onClick={onClose}>
                                <FiX />
                            </IconButton>
                        ) : null}
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-hairline">{children}</div>
                {footer || footerStart ? (
                    <footer className="flex flex-wrap items-center gap-2 px-5 py-3 bg-muted/40 border-t border-hairline">
                        {footerStart ? <div className="flex items-center gap-2">{footerStart}</div> : null}
                        <div className="ml-auto flex items-center gap-2">{footer}</div>
                    </footer>
                ) : null}
            </aside>
        </div>,
        document.body
    );
}

/** One block of the drawer body. */
export const DrawerSection = ({ title, actions, className, children }) => (
    <section className={cn('px-5 py-4 text-body', className)}>
        {title || actions ? (
            <div className="mb-3 flex items-center gap-2">
                {title ? <h3 className="flex-1 text-label uppercase text-muted-foreground">{title}</h3> : null}
                {actions}
            </div>
        ) : null}
        {children}
    </section>
);

/** Label / value rows, as in the reference "Load detail". */
export const DetailList = ({ rows = [], className }) => (
    <dl className={cn('grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-body', className)}>
        {rows.map(([label, value]) => (
            <React.Fragment key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-foreground min-w-0 break-words">{value}</dd>
            </React.Fragment>
        ))}
    </dl>
);

export default Drawer;

/**
 * Side-panel frame only — for older detail popups whose insides (header, × button, footer)
 * stay their own (same idea as DialogShell). Esc clicks their `data-dialog-close` button;
 * a click on the dimmed page closes it the same way.
 */
export function DrawerShell({ open = true, onClose, size = 'md', closeOnScrim = true, label, className, children }) {
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
            className="fixed inset-0 z-50 flex justify-end bg-[var(--overlay)] animate-ds-fade"
            onMouseDown={(e) => {
                if (closeOnScrim && e.target === e.currentTarget) escape();
            }}
        >
            <aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                className={cn(
                    'h-full max-w-[calc(100vw-48px)] overflow-y-auto bg-card text-card-foreground border-l border-hairline shadow-2 outline-none animate-ds-drawer-in',
                    DRAWER_SIZES[size] || DRAWER_SIZES.md,
                    className
                )}
            >
                {children}
            </aside>
        </div>,
        document.body
    );
}
