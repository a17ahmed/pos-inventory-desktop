import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFloating } from './floating';

// design DESIGN_HANDOFF "Tooltip": a filled accent tooltip, body-sm, 14px radius.
// Shows after a short delay on hover, or at once on keyboard focus. Never for a mouse click
// focus (that would cover what was just clicked).

/**
 * <Tooltip content="Print receipt"><IconButton … /></Tooltip>
 * The child must accept a ref (DOM element or forwardRef component).
 */
export function Tooltip({ content, side = 'top', align = 'center', delay = 450, children }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef(null);
    const panelRef = useRef(null);
    const timer = useRef(null);
    const id = useId();
    const pos = useFloating(open, anchorRef, panelRef, { side, align });

    useEffect(() => () => clearTimeout(timer.current), []);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (!content) return children;

    const show = (now) => {
        clearTimeout(timer.current);
        if (now) setOpen(true);
        else timer.current = setTimeout(() => setOpen(true), delay);
    };
    const hide = () => {
        clearTimeout(timer.current);
        setOpen(false);
    };

    const child = React.Children.only(children);
    // Keep the child's own ref (e.g. a Menu trigger needs the button too)
    const setRef = (node) => {
        anchorRef.current = node;
        const r = child.ref;
        if (typeof r === 'function') r(node);
        else if (r) r.current = node;
    };
    const call = (name, e) => child.props[name]?.(e);

    return (
        <>
            {React.cloneElement(child, {
                ref: setRef,
                'aria-describedby': open ? id : child.props['aria-describedby'],
                onMouseEnter: (e) => {
                    call('onMouseEnter', e);
                    show(false);
                },
                onMouseLeave: (e) => {
                    call('onMouseLeave', e);
                    hide();
                },
                onFocus: (e) => {
                    call('onFocus', e);
                    if (e.currentTarget.matches?.(':focus-visible')) show(true);
                },
                onBlur: (e) => {
                    call('onBlur', e);
                    hide();
                },
                onMouseDown: (e) => {
                    call('onMouseDown', e);
                    hide();
                },
            })}
            {open
                ? createPortal(
                      <div
                          ref={panelRef}
                          id={id}
                          role="tooltip"
                          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: 9600 }}
                          className="pointer-events-none max-w-[260px] bg-primary text-primary-foreground text-body-sm rounded-pop px-3 py-1.5 shadow-1 animate-ds-fade print:hidden"
                      >
                          {content}
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
}

export default Tooltip;
