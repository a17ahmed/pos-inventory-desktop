import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { getAccountState } from '../services/accountStatus';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';

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
 *   const v = await appChoose('Pick one', { choices: [{ label, value, danger }], defaultValue });
 */

// ── module-level queue so any code can raise a dialog without a React hook ──
let listeners = [];
let queue = [];
let nextId = 0;

const emit = () => listeners.forEach((l) => l());

const request = (config) =>
    new Promise((resolve) => {
        // While the Account blocked dialog is up, screens' error popups are
        // dropped (answered as if cancelled) so none pile up behind it
        if (getAccountState().blocked) {
            resolve(config.type === 'confirm' ? false : config.type === 'choice' ? config.defaultValue : undefined);
            return;
        }
        queue.push({ ...config, resolve, id: ++nextId });
        emit();
    });

/** Replacement for window.alert(). Returns a Promise that resolves when dismissed. */
export const appAlert = (message, options = {}) =>
    request({ type: 'alert', message, ...options });

/** Replacement for window.confirm(). Returns a Promise<boolean>. */
export const appConfirm = (message, options = {}) =>
    request({ type: 'confirm', message, ...options });

/**
 * Several labelled choices. Returns a Promise<value of the clicked choice>.
 * Enter, Escape and backdrop click all resolve `defaultValue` — so a barcode
 * scanner's trailing Enter can never pick a risky option by accident.
 */
export const appChoose = (message, { choices = [], defaultValue, ...options } = {}) =>
    request({ type: 'choice', message, choices, defaultValue, ...options });

/**
 * Host component — render exactly once, near the app root, above other UI.
 * It listens to the queue and renders one dialog at a time.
 */
export default function AppDialogHost() {
    const [current, setCurrent] = useState(null);
    // The queue is shifted here, never inside a setState updater: StrictMode
    // runs updaters twice in dev, which shifted twice and dropped a dialog
    // (e.g. the error alert right after a confirm).
    const currentRef = useRef(null);
    const show = (next) => {
        currentRef.current = next;
        setCurrent(next);
    };

    useEffect(() => {
        const pull = () => {
            if (!currentRef.current && queue.length > 0) show(queue.shift());
        };
        listeners.push(pull);
        pull(); // flush anything queued before mount
        return () => {
            listeners = listeners.filter((l) => l !== pull);
        };
    }, []);

    const close = useCallback((result) => {
        currentRef.current?.resolve(result);
        show(queue.shift() || null);
    }, []);

    // Enter = confirm/OK (Escape = cancel is handled by Dialog, which only answers when this
    // dialog is the top layer)
    useEffect(() => {
        if (!current) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (current.type === 'choice') close(current.defaultValue);
            else close(current.type === 'confirm' ? true : undefined);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [current, close]);

    if (!current) return null;

    const isConfirm = current.type === 'confirm';
    const isChoice = current.type === 'choice';
    const isDanger = !!current.danger;
    const title =
        current.title || (isConfirm ? 'Please confirm' : 'Notice');
    const confirmText =
        current.confirmText || (isConfirm ? 'Confirm' : 'OK');
    const cancelText = current.cancelText || 'Cancel';
    const cancelResult = isChoice ? current.defaultValue : isConfirm ? false : undefined;

    const Icon = isDanger ? FiAlertTriangle : FiInfo;

    // Look: design/03-components.md "Dialog" (ConfirmDialog layout). Esc and a click outside
    // answer "cancel" (Dialog handles both); Enter is handled above, as before.
    return (
        <Dialog key={current.id} open onClose={() => close(cancelResult)} size="sm" closeOnScrim hideClose zIndex={10000} labelledBy="app-dialog-title">
            <div className="flex items-start gap-3.5">
                <div
                    className={`flex-none w-[42px] h-[42px] rounded-xl inline-flex items-center justify-center ${
                        isDanger ? 'bg-destructive-chip text-destructive-chip-foreground' : 'bg-accent text-accent-foreground'
                    }`}
                >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <h2 id="app-dialog-title" className="font-heading text-h4 text-foreground">
                        {title}
                    </h2>
                    <p className="mt-1 text-body text-muted-foreground whitespace-pre-line break-words">{current.message}</p>
                </div>
            </div>

            {isChoice ? (
                <div className="mt-5 flex flex-col gap-2">
                    {current.choices.map((c) => (
                        <Button
                            key={String(c.value)}
                            onClick={() => close(c.value)}
                            variant={c.danger ? 'destructive' : c.value === current.defaultValue ? 'primary' : 'secondary'}
                            size="action"
                            className="w-full"
                        >
                            {c.label}
                        </Button>
                    ))}
                </div>
            ) : (
                <div className="mt-5 flex justify-end gap-2">
                    {isConfirm && (
                        <Button variant="ghost" data-autofocus onClick={() => close(false)}>
                            {cancelText}
                        </Button>
                    )}
                    <Button
                        variant={isDanger ? 'destructive' : 'primary'}
                        data-autofocus={!isConfirm || undefined}
                        onClick={() => close(isConfirm ? true : undefined)}
                    >
                        {confirmText}
                    </Button>
                </div>
            )}
        </Dialog>
    );
}
