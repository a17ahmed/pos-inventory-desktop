import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { useFloating } from './floating';
import { useOverlay } from './overlay';

// DESIGN_HANDOFF "Popover": popover surface, hairline, 14px radius, shadow-2. A small panel under a
// button for things like filters. Click outside or Esc closes it; focus starts in its first field.

/**
 * <Popover trigger={<Button>Filter</Button>} label="Filter bills" width={340}>
 *   {({ close }) => …fields…}      // or plain children
 * </Popover>
 */
export function Popover({ trigger, label, align = 'start', side = 'bottom', width = 320, className, children }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef(null);
    const panelRef = useRef(null);
    const id = useId();
    const pos = useFloating(open, anchorRef, panelRef, { side, align });
    const close = () => setOpen(false);
    useOverlay(open, panelRef, { onEscape: close, trapFocus: false });

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (!panelRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) close();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const triggerEl = React.cloneElement(trigger, {
        ref: anchorRef,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        onClick: (e) => {
            trigger.props.onClick?.(e);
            setOpen((v) => !v);
        },
    });

    return (
        <>
            {triggerEl}
            {open
                ? createPortal(
                      <div
                          ref={panelRef}
                          id={id}
                          role="dialog"
                          aria-label={label}
                          tabIndex={-1}
                          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, zIndex: 9400 }}
                          className={cn('bg-popover text-popover-foreground border border-hairline rounded-pop shadow-2 p-4 outline-none animate-ds-menu-in print:hidden', className)}
                      >
                          {typeof children === 'function' ? children({ close }) : children}
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
}

export default Popover;
