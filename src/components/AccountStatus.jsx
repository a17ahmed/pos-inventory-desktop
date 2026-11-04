import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { FiLock, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getAccountStatus } from '../services/api/account';
import {
    getAccountState,
    subscribeAccountState,
    applyAccountStatus,
    clearBlocked,
    dismissWarning,
} from '../services/accountStatus';

const RECHECK_MS = 30 * 60 * 1000; // while the app is open
const BLOCKED_RECHECK_MS = 2 * 60 * 1000; // while the Account blocked dialog is up
// Shown when the owner left the contact empty in the admin panel
const SUPPORT_CONTACT = 'Call 0307-0019031';

export const useAccountState = () => useSyncExternalStore(subscribeAccountState, getAccountState);

// GET /account/status → store. Returns the status, or null when the server
// can't be reached (offline at start-up just opens the app normally).
const checkAccountStatus = async () => {
    try {
        const res = await getAccountStatus();
        const data = res.data || {};
        // Same wording as the 403 BUSINESS_BLOCKED body, which prefixes the owner's message
        applyAccountStatus(data.status === 'blocked'
            ? { ...data, message: data.message ? `Your account is suspended. ${data.message}` : '' }
            : data);
        return data.status || null;
    } catch (e) {
        return null;
    }
};

const formatDueDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
};

/**
 * Account blocked dialog + status checks. Render once, inside AuthProvider.
 * Logged in: a blocking modal with [Check again] [Log out]. On the login
 * screen (login returned BUSINESS_BLOCKED): the same dialog with [OK].
 */
export default function AccountStatusHost() {
    const { isAuthenticated, logout } = useAuth();
    const { blocked, warning } = useAccountState();
    const [checking, setChecking] = useState(false);
    const [note, setNote] = useState('');
    const dialogRef = useRef(null);
    const detailsRequested = useRef(false);

    // On start (saved token) and after login, then every 30 minutes
    useEffect(() => {
        if (!isAuthenticated) return undefined;
        checkAccountStatus();
        const id = setInterval(checkAccountStatus, RECHECK_MS);
        return () => clearInterval(id);
    }, [isAuthenticated]);

    // The warning header carries no details — fetch them once for the banner
    useEffect(() => {
        if (!warning || warning.loaded) {
            detailsRequested.current = false;
            return;
        }
        if (isAuthenticated && !detailsRequested.current) {
            detailsRequested.current = true;
            checkAccountStatus();
        }
    }, [warning, isAuthenticated]);

    const sessionBlocked = !!blocked && !blocked.onLogin;

    // Unblocked → close and reload the current screen so its data loads again
    const recheck = useCallback(async ({ manual = false } = {}) => {
        if (manual) { setChecking(true); setNote(''); }
        const status = await checkAccountStatus();
        if (status && status !== 'blocked') {
            window.location.reload();
            return;
        }
        if (manual) {
            setChecking(false);
            setNote(status === 'blocked' ? 'Still blocked' : "Couldn't reach the server. Try again.");
        }
    }, []);

    useEffect(() => {
        if (!sessionBlocked) return undefined;
        const id = setInterval(() => recheck(), BLOCKED_RECHECK_MS);
        return () => clearInterval(id);
    }, [sessionBlocked, recheck]);

    useEffect(() => {
        if (!note) return undefined;
        const t = setTimeout(() => setNote(''), 3000);
        return () => clearTimeout(t);
    }, [note]);

    // Nothing behind the dialog is usable: the app root goes inert (no clicks,
    // no focus) and keys never reach the screens' shortcuts or the scanner.
    useEffect(() => {
        if (!blocked) return undefined;
        const root = document.getElementById('root');
        if (root) root.inert = true;
        const onKey = (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') e.preventDefault();
            if (blocked.onLogin && e.key === 'Enter' && e.type === 'keydown') {
                e.preventDefault();
                clearBlocked();
            }
        };
        ['keydown', 'keypress', 'keyup'].forEach((t) => window.addEventListener(t, onKey, true));
        dialogRef.current?.querySelector('button')?.focus();
        return () => {
            if (root) root.inert = false;
            ['keydown', 'keypress', 'keyup'].forEach((t) => window.removeEventListener(t, onKey, true));
        };
    }, [blocked]);

    if (!blocked) return null;

    const handleLogout = async () => {
        await logout();
        clearBlocked();
    };

    return createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm p-4">
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="account-blocked-title"
                className="w-full max-w-sm bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl shadow-2xl p-6 animate-fade-in"
            >
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-red-50 text-red-500 dark:bg-[rgba(255,107,107,0.12)] dark:text-d-red">
                        <FiLock size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 id="account-blocked-title" className="text-base font-semibold text-slate-800 dark:text-d-heading mb-1">
                            Account blocked
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-d-text whitespace-pre-line break-words">
                            {blocked.message || 'Your account has been suspended.'}
                        </p>
                        <p className="mt-3 text-sm text-slate-600 dark:text-d-text">Please contact your administrator.</p>
                        <p className="text-sm font-medium text-slate-800 dark:text-d-heading break-words">{blocked.contact || SUPPORT_CONTACT}</p>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                    {note && <span className="mr-auto text-xs text-red-500 dark:text-d-red" role="status">{note}</span>}
                    {blocked.onLogin ? (
                        <button
                            type="button"
                            onClick={clearBlocked}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-d-accent dark:hover:bg-d-accent-s dark:text-d-card transition-colors"
                        >
                            OK
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => recheck({ manual: true })}
                                disabled={checking}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-d-text bg-slate-100 dark:bg-d-glass hover:bg-slate-200 dark:hover:bg-d-glass-hover transition-colors disabled:opacity-60"
                            >
                                {checking ? 'Checking…' : 'Check again'}
                            </button>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 dark:bg-d-red dark:hover:bg-red-500 transition-colors"
                            >
                                Log out
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

export const usePaymentDueVisible = () => {
    const { warning, warningDismissed } = useAccountState();
    return !!warning && !warningDismissed;
};

/** Thin amber bar shown while payment is due soon. Dismissible until restart. */
export const PaymentDueBanner = ({ className = '' }) => {
    const { warning } = useAccountState();
    const visible = usePaymentDueVisible();
    if (!visible) return null;
    const text = [warning.message, warning.paidUntil && `Due ${formatDueDate(warning.paidUntil)}`, warning.contact || SUPPORT_CONTACT]
        .filter(Boolean)
        .join(' · ') || 'Payment due soon';
    return (
        <div
            role="status"
            className={`flex items-center gap-2 h-8 px-4 text-xs font-medium bg-amber-100 text-amber-900 border-b border-amber-200 dark:bg-[rgba(255,190,80,0.12)] dark:text-amber-200 dark:border-[rgba(255,190,80,0.2)] print:hidden ${className}`}
        >
            <span className="flex-1 min-w-0 truncate">{text}</span>
            <button
                type="button"
                onClick={dismissWarning}
                aria-label="Hide payment reminder"
                className="app-no-drag flex-shrink-0 p-1 rounded-md hover:bg-amber-200/70 dark:hover:bg-[rgba(255,190,80,0.15)]"
            >
                <FiX size={13} />
            </button>
        </div>
    );
};
