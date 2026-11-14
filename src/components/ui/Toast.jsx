import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiAlertTriangle, FiInfo, FiX, FiAlertCircle } from 'react-icons/fi';
import { cn } from './cn';

// design/03-components.md "Toast" — popover surface, hairline, shadow-2, 26px icon tile.
// Works from anywhere, no provider needed (same idea as appAlert):
//   import { toast } from '../components/ui';
//   toast('Bill cancelled');                       // neutral
//   toast.success('Saved', { description: '…' });
//   toast.error('Failed to save: …');
//   toast('Added', { id: 'pos' });                 // same id replaces the one on screen
// <Toaster /> is rendered once in App.jsx.

let items = [];
let listeners = [];
let seq = 0;
const timers = new Map();
const emit = () => listeners.forEach((l) => l(items));

const MAX_VISIBLE = 3;

// Where toasts appear. The POS moves them to the top while it is open, so they never cover its
// full-width Pay button: setToastPlacement('top') on mount, back to 'bottom' on unmount.
let placement = 'bottom';
let placementListeners = [];
export const setToastPlacement = (p) => {
    placement = p === 'top' ? 'top' : 'bottom';
    placementListeners.forEach((l) => l(placement));
};

export const dismissToast = (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    items = items.filter((t) => t.id !== id);
    emit();
};

/**
 * Show a toast. Options: tone (neutral|success|warning|error|info), description, duration (ms),
 * id (replaces a toast with the same id instead of stacking — for rapid repeats like scanning).
 * Returns the toast id.
 */
export function toast(message, { tone = 'neutral', description, duration = 4000, id, icon } = {}) {
    const key = id ?? `t${++seq}`;
    const entry = { id: key, message, tone, description, icon, stamp: ++seq };
    const exists = items.some((t) => t.id === key);
    items = exists ? items.map((t) => (t.id === key ? entry : t)) : [...items, entry].slice(-MAX_VISIBLE);
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => dismissToast(key), duration));
    emit();
    return key;
}
toast.success = (message, opts) => toast(message, { ...opts, tone: 'success' });
toast.error = (message, opts) => toast(message, { ...opts, tone: 'error' });
toast.warning = (message, opts) => toast(message, { ...opts, tone: 'warning' });
toast.info = (message, opts) => toast(message, { ...opts, tone: 'info' });

/** Hook form, for screens that prefer it: const toast = useToast(); */
export const useToast = () => toast;

const TONES = {
    neutral: { tile: 'bg-muted text-muted-foreground', Icon: FiInfo },
    info: { tile: 'bg-info-chip text-info-chip-foreground', Icon: FiInfo },
    success: { tile: 'bg-success-chip text-success-chip-foreground', Icon: FiCheck },
    warning: { tile: 'bg-warning-chip text-warning-chip-foreground', Icon: FiAlertTriangle },
    error: { tile: 'bg-destructive-chip text-destructive-chip-foreground', Icon: FiAlertCircle },
};

/** Host — render once near the app root. Bottom centre, or top centre while the POS is open. */
export function Toaster() {
    const [list, setList] = useState(items);
    const [where, setWhere] = useState(placement);
    useEffect(() => {
        listeners.push(setList);
        placementListeners.push(setWhere);
        setList(items);
        setWhere(placement);
        return () => {
            listeners = listeners.filter((l) => l !== setList);
            placementListeners = placementListeners.filter((l) => l !== setWhere);
        };
    }, []);

    if (list.length === 0) return null;

    return createPortal(
        <div
            aria-live="polite"
            className={cn(
                'fixed left-1/2 -translate-x-1/2 z-[9000] flex items-center gap-2 w-[min(440px,calc(100vw-2rem))] pointer-events-none print:hidden',
                where === 'top' ? 'top-[60px] flex-col-reverse' : 'bottom-6 flex-col'
            )}
        >
            {list.map((t) => {
                const tone = TONES[t.tone] || TONES.neutral;
                const Icon = t.icon || tone.Icon;
                return (
                    <div
                        key={`${t.id}-${t.stamp}`}
                        role={t.tone === 'error' ? 'alert' : 'status'}
                        className={cn(
                            'w-full flex items-center gap-3 rounded-pop border border-hairline bg-popover text-popover-foreground shadow-2 animate-ds-toast-in',
                            // at the top (the till) a toast is click-through, so it never blocks a tap
                            where === 'top' ? 'pointer-events-none px-3.5 py-2.5' : 'pointer-events-auto px-4 py-3'
                        )}
                    >
                        <span className={cn('flex-none w-[26px] h-[26px] rounded-md inline-flex items-center justify-center', tone.tile)}>
                            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-body font-medium text-foreground break-words">{t.message}</p>
                            {t.description ? <p className="text-body-sm text-muted-foreground break-words">{t.description}</p> : null}
                        </div>
                        {where === 'top' ? null : <button
                            type="button"
                            aria-label="Dismiss"
                            title="Dismiss"
                            onClick={() => dismissToast(t.id)}
                            className="flex-none -mr-1.5 w-7 h-7 rounded-row inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--hover-overlay)]"
                        >
                            <FiX className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>}
                    </div>
                );
            })}
        </div>,
        document.body
    );
}

export default toast;
