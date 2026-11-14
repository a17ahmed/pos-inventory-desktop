import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertTriangle, FiLock, FiX } from 'react-icons/fi';
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
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-[var(--overlay)] p-4 animate-ds-fade">
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="account-blocked-title"
                className="w-full max-w-[400px] bg-popover text-popover-foreground border border-hairline rounded-pop shadow-2 p-5 animate-ds-dialog-in"
            >
                <div className="flex items-start gap-3.5">
                    <div className="flex-none w-[42px] h-[42px] rounded-xl inline-flex items-center justify-center bg-destructive-chip text-destructive-chip-foreground">
                        <FiLock className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 id="account-blocked-title" className="font-heading text-h4 text-foreground mb-1">
                            Account blocked
                        </h3>
                        <p className="text-body text-muted-foreground whitespace-pre-line break-words">
                            {blocked.message || 'Your account has been suspended.'}
                        </p>
                        <p className="mt-3 text-body text-muted-foreground">Please contact your administrator.</p>
                        <p className="text-body font-medium text-foreground break-words">{blocked.contact || SUPPORT_CONTACT}</p>
                    </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                    {note && <span className="mr-auto text-body-sm text-destructive" role="status">{note}</span>}
                    {blocked.onLogin ? (
                        <button
                            type="button"
                            onClick={clearBlocked}
                            className="h-9 px-4 rounded-xl text-body-lg font-medium bg-primary text-primary-foreground hover:[filter:var(--hover-brighten)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            OK
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => recheck({ manual: true })}
                                disabled={checking}
                                className="h-9 px-4 rounded-xl text-body-lg font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--hover-overlay)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                {checking ? 'Checking…' : 'Check again'}
                            </button>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="h-9 px-4 rounded-xl text-body-lg font-medium bg-destructive text-destructive-foreground hover:[filter:var(--hover-brighten)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
            className={`flex items-center gap-2 h-8 px-4 text-body-sm font-medium bg-warning-chip text-warning-chip-foreground border-b border-warning-chip-foreground/20 print:hidden ${className}`}
        >
            <FiAlertTriangle aria-hidden="true" className="w-3.5 h-3.5 flex-none" />
            <span className="flex-1 min-w-0 truncate">{text}</span>
            <button
                type="button"
                onClick={dismissWarning}
                aria-label="Hide payment reminder"
                title="Hide payment reminder"
                className="app-no-drag flex-shrink-0 p-1 rounded-md hover:bg-[var(--hover-overlay)]"
            >
                <FiX size={13} />
            </button>
        </div>
    );
};
