// Account status set by the software owner from the platform admin panel:
//   blocked → every request gets 403 { code: 'BUSINESS_BLOCKED', message, contact }
//   warning → responses carry the header X-Account-Status: warning
// A small module-level store (like AppDialog's queue) so the axios
// interceptor, which has no React, can raise the dialog and the banner.

let state = {
    blocked: null, // { message, contact, onLogin } while the Account blocked dialog is up
    warning: null, // { message, contact, paidUntil, loaded } while payment is due soon
    warningDismissed: (() => {
        try { return sessionStorage.getItem('accountWarningDismissed') === '1'; } catch (e) { return false; }
    })(),
};
let listeners = [];

const set = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
};

export const getAccountState = () => state;

export const subscribeAccountState = (listener) => {
    listeners.push(listener);
    return () => { listeners = listeners.filter((l) => l !== listener); };
};

/** True for a 403 BUSINESS_BLOCKED response. Screens skip their own error toast when it is. */
export const isAccountBlocked = (error) =>
    error?.response?.status === 403 && error.response.data?.code === 'BUSINESS_BLOCKED';

/** Sync (bills, payments, …) waits while the account is blocked and never drops anything. */
export const isSyncPaused = () => !!state.blocked;

// Shown once: many requests failing together only raise one dialog
export const reportBlocked = (data = {}, { onLogin = false } = {}) => {
    if (state.blocked) return;
    set({ blocked: { message: data.message || '', contact: data.contact || '', onLogin } });
};

export const clearBlocked = () => {
    if (state.blocked) set({ blocked: null });
};

// The header only says "warning"; the details come from GET /account/status
export const noteWarningHeader = () => {
    if (!state.warning) set({ warning: { message: '', contact: '', paidUntil: null, loaded: false } });
};

/** Apply a GET /account/status response. */
export const applyAccountStatus = (data = {}) => {
    if (data.status === 'blocked') {
        set({ warning: null });
        reportBlocked(data);
        return;
    }
    clearBlocked();
    set({
        warning: data.status === 'warning'
            ? { message: data.message || '', contact: data.contact || '', paidUntil: data.paidUntil || null, loaded: true }
            : null,
    });
};

// Hidden for this session; shows again after an app restart
export const dismissWarning = () => {
    try { sessionStorage.setItem('accountWarningDismissed', '1'); } catch (e) { /* ignore */ }
    set({ warningDismissed: true });
};
