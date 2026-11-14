import { useEffect, useRef } from 'react';

// Shared by Dialog, Drawer, Menu and AppDialog: which overlay is on top (so Esc closes only that
// one), keeping Tab inside it, and giving focus back to where it was when it closes.

let stack = [];
let seq = 0;

export const isTopOverlay = (id) => stack[stack.length - 1] === id;

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export const focusableIn = (el) =>
    el ? Array.from(el.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement) : [];

/** The first field (input/select/textarea) — never the × or Cancel (design rule). */
const firstField = (el) =>
    el?.querySelector(
        'input:not([disabled]):not([type="hidden"]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly]), [data-autofocus]'
    );

/**
 * Registers an open overlay. Returns its id. While open:
 *  - Esc calls onEscape (only for the top overlay)
 *  - Tab / Shift+Tab stay inside panelRef
 *  - on open, focus goes to `[data-autofocus]`, else the first field, else the panel itself
 *  - on close, focus goes back to the element that had it before
 */
export function useOverlay(open, panelRef, { onEscape, autoFocus = true, trapFocus = true } = {}) {
    const idRef = useRef(null);
    const escRef = useRef(onEscape);
    escRef.current = onEscape;

    useEffect(() => {
        if (!open) return undefined;
        const id = ++seq;
        idRef.current = id;
        stack.push(id);
        const before = document.activeElement;

        // Focus after paint so the panel is in the DOM and children's own autoFocus has run
        const raf = requestAnimationFrame(() => {
            const panel = panelRef.current;
            if (!autoFocus || !panel || panel.contains(document.activeElement)) return;
            const target = firstField(panel) || panel;
            target.focus({ preventScroll: true });
        });

        const onKey = (e) => {
            if (!isTopOverlay(id)) return;
            // The "Account blocked" screen freezes the app (#root inert); popups live outside
            // #root (portal), so they must not react underneath it either.
            if (document.getElementById('root')?.inert) return;
            if (e.key === 'Escape' && escRef.current) {
                e.preventDefault();
                e.stopPropagation();
                escRef.current(e);
                return;
            }
            if (e.key === 'Tab' && trapFocus && panelRef.current) {
                const items = focusableIn(panelRef.current);
                if (items.length === 0) {
                    e.preventDefault();
                    panelRef.current.focus();
                    return;
                }
                const first = items[0];
                const last = items[items.length - 1];
                const inside = panelRef.current.contains(document.activeElement);
                if (e.shiftKey && (document.activeElement === first || !inside)) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        // Capture phase: the top overlay sees Esc before the screen underneath does
        window.addEventListener('keydown', onKey, true);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', onKey, true);
            stack = stack.filter((x) => x !== id);
            // Give focus back unless something else already took it (e.g. the next dialog)
            if (before && typeof before.focus === 'function' && document.contains(before)) {
                const active = document.activeElement;
                if (!active || active === document.body || panelRef.current?.contains(active)) {
                    before.focus({ preventScroll: true });
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return idRef;
}
