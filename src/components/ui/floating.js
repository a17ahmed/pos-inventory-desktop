import { useLayoutEffect, useState } from 'react';

const GAP = 6;
const EDGE = 8;

/**
 * Places a floating panel next to an anchor element, flipping to the other side when it
 * would leave the window. side: 'bottom' | 'top' | 'right' | 'left';
 * align: 'start' | 'center' | 'end' (along that side).
 * Returns { top, left } in viewport px (use with position: fixed), or null before measuring.
 */
export function useFloating(open, anchorRef, panelRef, { side = 'bottom', align = 'start' } = {}) {
    const [pos, setPos] = useState(null);

    useLayoutEffect(() => {
        if (!open) {
            setPos(null);
            return undefined;
        }
        const place = () => {
            const a = anchorRef.current?.getBoundingClientRect();
            const p = panelRef.current;
            if (!a || !p) return;
            const w = p.offsetWidth;
            const h = p.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            let top;
            let left;
            if (side === 'right' || side === 'left') {
                left = side === 'right' ? a.right + GAP : a.left - w - GAP;
                if (side === 'right' && left + w > vw - EDGE) left = a.left - w - GAP;
                if (side === 'left' && left < EDGE) left = a.right + GAP;
                top = align === 'end' ? a.bottom - h : align === 'center' ? a.top + a.height / 2 - h / 2 : a.top;
            } else {
                top = side === 'top' ? a.top - h - GAP : a.bottom + GAP;
                if (side === 'bottom' && top + h > vh - EDGE && a.top - h - GAP >= EDGE) top = a.top - h - GAP;
                if (side === 'top' && top < EDGE && a.bottom + GAP + h <= vh - EDGE) top = a.bottom + GAP;
                left = align === 'end' ? a.right - w : align === 'center' ? a.left + a.width / 2 - w / 2 : a.left;
            }
            left = Math.min(Math.max(left, EDGE), vw - w - EDGE);
            top = Math.min(Math.max(top, EDGE), vh - h - EDGE);
            setPos({ top: Math.round(top), left: Math.round(left) });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, side, align, anchorRef, panelRef]);

    return pos;
}
