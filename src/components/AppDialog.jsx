import React, { useEffect, useState, useCallback } from 'react';
import { FiAlertTriangle, FiInfo } from 'react-icons/fi';

/**
 * In-app alert/confirm dialog — a drop-in replacement for the browser's
 * native window.alert() / window.confirm().
 *
 * WHY THIS EXISTS: on Windows, Electron apps with a custom/frameless title bar
 * lose keyboard focus after a native alert()/confirm() is dismissed. The result
 * is that all text inputs stop accepting typed characters (mouse still works)
 * until the window is re-focused (Alt+Tab). Because this dialog is rendered
 * inside the app's own DOM, it never touches OS-level window focus, so the
 * freeze cannot happen.
 *
 * Usage (imperative, works from anywhere — no hook required):
 *   import { appAlert, appConfirm } from '../components/AppDialog';
 *   appAlert('Something happened');                 // fire-and-forget
 *   if (!(await appConfirm('Delete this item?'))) return;   // in an async fn
 */

// ── module-level queue so any code can raise a dialog without a React hook ──
let listeners = [];
let queue = [];

const emit = () => listeners.forEach((l) => l());

const request = (config) =>
    new Promise((resolve) => {
        queue.push({ ...config, resolve });
        emit();
    });

/** Replacement for window.alert(). Returns a Promise that resolves when dismissed. */
export const appAlert = (message, options = {}) =>
    request({ type: 'alert', message, ...options });

/** Replacement for window.confirm(). Returns a Promise<boolean>. */
export const appConfirm = (message, options = {}) =>
    request({ type: 'confirm', message, ...options });

/**
 * Host component — render exactly once, near the app root, above other UI.
 * It listens to the queue and renders one dialog at a time.
 */
export default function AppDialogHost() {
    const [current, setCurrent] = useState(null);

    useEffect(() => {
        const pull = () => setCurrent((cur) => cur || queue.shift() || null);
        listeners.push(pull);
        pull(); // flush anything queued before mount
        return () => {
            listeners = listeners.filter((l) => l !== pull);
        };
    }, []);

    const close = useCallback((result) => {
        setCurrent((cur) => {
            cur?.resolve(result);
            return queue.shift() || null;
        });
    }, []);

    // Enter = confirm/OK, Escape = cancel
    useEffect(() => {
        if (!current) return undefined;
        const onKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                close(current.type === 'confirm' ? true : undefined);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close(current.type === 'confirm' ? false : undefined);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [current, close]);

    if (!current) return null;

    const isConfirm = current.type === 'confirm';
    const isDanger = !!current.danger;
    const title =
        current.title || (isConfirm ? 'Please confirm' : 'Notice');
    const confirmText =
        current.confirmText || (isConfirm ? 'Confirm' : 'OK');
    const cancelText = current.cancelText || 'Cancel';

    const Icon = isDanger ? FiAlertTriangle : FiInfo;

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
            onMouseDown={(e) => {
                // click on the backdrop dismisses (cancel for confirm)
                if (e.target === e.currentTarget) {
                    close(isConfirm ? false : undefined);
                }
            }}
        >
            <div className="w-full max-w-sm bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl shadow-2xl p-6 animate-fade-in">
                <div className="flex items-start gap-3">
                    <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                            isDanger
                                ? 'bg-red-50 text-red-500 dark:bg-[rgba(255,107,107,0.12)] dark:text-d-red'
                                : 'bg-primary-50 text-primary-600 dark:bg-[rgba(255,210,100,0.12)] dark:text-d-accent'
                        }`}
                    >
                        <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-d-heading mb-1">
                            {title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-d-text whitespace-pre-line break-words">
                            {current.message}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    {isConfirm && (
                        <button
                            type="button"
                            autoFocus
                            onClick={() => close(false)}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-d-text bg-slate-100 dark:bg-d-glass hover:bg-slate-200 dark:hover:bg-d-glass-hover transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        autoFocus={!isConfirm}
                        onClick={() => close(isConfirm ? true : undefined)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors ${
                            isDanger
                                ? 'bg-red-500 hover:bg-red-600 dark:bg-d-red dark:hover:bg-red-500'
                                : 'bg-primary-600 hover:bg-primary-700 dark:bg-d-accent dark:hover:bg-d-accent-s dark:text-d-card'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
