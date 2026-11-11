import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getMoneyBookSettings, getMoneyAccounts, getPickerAccounts } from '../services/api/moneyBook';
import { NON_MONEY_METHODS, errorCode } from '../utils/moneyBook';

/**
 * Money Book on/off switch + account lists for the payment pickers.
 *
 * mode:
 *   'loading' — not known yet (send nothing new)
 *   'off'     — 409 / 404 / no answer: the app behaves exactly like before
 *   'on'      — the shop has the Money Book: pickers + new request fields
 *
 * Users with cashbook.view (and admins) get GET /settings + /accounts (with
 * balances) and can open the Money Book screen. Everyone else gets 403 there
 * and falls back to GET /accounts/picker (names only, no balances).
 *
 * The only way a new field reaches a request is moneyFields(), which returns
 * {} unless mode === 'on' — so an old server or a shop that isn't switched on
 * never sees accountId / refundAccountId / chequeNumber …
 */

const MoneyBookContext = createContext(null);

export const useMoneyBook = () => {
    const ctx = useContext(MoneyBookContext);
    if (!ctx) throw new Error('useMoneyBook must be used within a MoneyBookProvider');
    return ctx;
};

const ACCOUNT_REFRESH_MS = 10000;
const NEW_FIELDS = /^(accountId|refundAccountId|paymentAccountId|chequeNumber|chequeDate|accountCounts)\b.*not allowed/i;

const EMPTY = {
    mode: 'loading',
    canViewBook: false,   // GET /settings answered 200 → Money Book screen allowed
    hasBalances: false,   // accounts came from /accounts (with balances)
    pickerAllowed: false, // this user may see payment pickers
    settings: null,       // { methodAccounts, compatibility, cashDrawer, chequeTracking, enabledAt }
    accounts: [],
    totals: null,
};

const statusOf = (err) => err?.response?.status;

export const MoneyBookProvider = ({ children }) => {
    const { isAuthenticated, user, userType } = useAuth();
    const [state, setState] = useState(EMPTY);
    const stateRef = useRef(state);
    stateRef.current = state;
    const lastAccountsAt = useRef(0);
    const loadSeq = useRef(0);
    const failedRef = useRef(false); // detection had no answer → retry on focus

    const userKey = isAuthenticated ? `${userType}:${user?._id || user?.id || ''}` : '';

    const load = useCallback(async () => {
        const seq = ++loadSeq.current;
        const done = (next) => {
            if (seq !== loadSeq.current) return; // a newer load (e.g. re-login) won
            lastAccountsAt.current = Date.now();
            setState(next);
        };
        failedRef.current = false;

        try {
            const res = await getMoneyBookSettings();
            const settings = res.data || {};
            let accounts = [];
            let totals = null;
            try {
                const acc = await getMoneyAccounts();
                accounts = acc.data?.accounts || [];
                totals = acc.data?.totals || null;
            } catch (e) {
                console.error('[MoneyBook] accounts:', e);
            }
            done({ mode: 'on', canViewBook: true, hasBalances: true, pickerAllowed: true, settings, accounts, totals });
            return;
        } catch (err) {
            const status = statusOf(err);
            if (status === 409 || status === 404) return done({ ...EMPTY, mode: 'off' });
            if (status !== 403) {
                // No answer / server error: stay OFF (never send new fields to a
                // server we couldn't confirm) and try again later.
                failedRef.current = true;
                return done({ ...EMPTY, mode: 'off' });
            }
        }

        // 403: no cashbook.view → names-only list for the pickers
        try {
            const res = await getPickerAccounts();
            const d = res.data || {};
            const accounts = d.accounts || [];
            const drawer = accounts.find((a) => a.systemKey === 'cash_drawer');
            done({
                mode: 'on',
                canViewBook: false,
                hasBalances: false,
                pickerAllowed: true,
                settings: {
                    methodAccounts: d.methodAccounts || {},
                    compatibility: d.compatibility || {},
                    chequeTracking: !!d.chequeTracking,
                    cashDrawer: drawer?._id || null,
                    enabledAt: null,
                },
                accounts,
                totals: null,
            });
        } catch (err) {
            const status = statusOf(err);
            if (status === 403) {
                // ON, but this user takes / pays out no money: no pickers
                return done({ ...EMPTY, mode: 'on', settings: { methodAccounts: {}, compatibility: {}, chequeTracking: false, cashDrawer: null } });
            }
            if (status !== 409 && status !== 404) failedRef.current = true;
            done({ ...EMPTY, mode: 'off' });
        }
    }, []);

    // (Re)detect on login, app start and user switch; reset on logout
    useEffect(() => {
        if (!userKey) {
            loadSeq.current++;
            setState(EMPTY);
            return;
        }
        setState(EMPTY);
        load();
    }, [userKey, load]);

    const refreshAccounts = useCallback(async ({ force = false } = {}) => {
        const s = stateRef.current;
        if (s.mode !== 'on' || !s.pickerAllowed) return;
        if (!force && Date.now() - lastAccountsAt.current < ACCOUNT_REFRESH_MS) return;
        lastAccountsAt.current = Date.now();
        try {
            if (s.hasBalances) {
                const res = await getMoneyAccounts();
                setState((prev) => ({ ...prev, accounts: res.data?.accounts || [], totals: res.data?.totals || null }));
            } else {
                const res = await getPickerAccounts();
                const d = res.data || {};
                setState((prev) => ({
                    ...prev,
                    accounts: d.accounts || [],
                    settings: { ...prev.settings, methodAccounts: d.methodAccounts || {}, compatibility: d.compatibility || {}, chequeTracking: !!d.chequeTracking },
                }));
            }
        } catch (err) {
            if (errorCode(err) === 'MONEY_BOOK_NOT_READY') setState({ ...EMPTY, mode: 'off' });
        }
    }, []);

    // Settings changed (mapping saved) → full reload
    const refreshSettings = useCallback(() => load(), [load]);

    // Keep balances fresh when the window comes back; retry a failed detection
    useEffect(() => {
        if (!userKey) return undefined;
        const onFocus = () => {
            if (failedRef.current) load();
            else refreshAccounts();
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [userKey, load, refreshAccounts]);

    /**
     * Call from any catch block of a money action. Falls back to OFF if the
     * server says the Money Book isn't ready (or rejects the new fields), and
     * reloads the accounts when one went missing / short.
     */
    const handleMoneyError = useCallback((err) => {
        const code = errorCode(err);
        const data = err?.response?.data;
        const rejectedNewField = statusOf(err) === 400 && Array.isArray(data?.errors)
            && data.errors.some((e) => NEW_FIELDS.test(e.message || ''));
        if (code === 'MONEY_BOOK_NOT_READY' || rejectedNewField) {
            setState({ ...EMPTY, mode: 'off' });
            return;
        }
        if (['INSUFFICIENT_BALANCE', 'ACCOUNT_NOT_FOUND', 'ACCOUNT_ARCHIVED', 'ACCOUNT_TYPE_MISMATCH'].includes(code)) {
            refreshAccounts({ force: true });
        }
    }, [refreshAccounts]);

    const value = useMemo(() => {
        const { mode, settings, accounts } = state;
        const isOn = mode === 'on';
        const activeAccounts = accounts.filter((a) => a.isActive !== false);
        const accountsById = new Map(accounts.map((a) => [String(a._id), a]));
        const compatibility = settings?.compatibility || {};
        const drawerId = settings?.cashDrawer
            || activeAccounts.find((a) => a.systemKey === 'cash_drawer')?._id
            || null;

        const accountsForMethod = (method, { anyType = false } = {}) => {
            if (!isOn || !state.pickerAllowed || !method || NON_MONEY_METHODS.includes(method)) return [];
            const allowed = compatibility[method];
            return activeAccounts.filter((a) => anyType || !Array.isArray(allowed) || allowed.includes(a.type));
        };

        const defaultAccountId = (method) => {
            const id = settings?.methodAccounts?.[method];
            return id ? String(id) : null;
        };

        // Gate for every new request field (see header comment)
        const moneyFields = (obj = {}) => {
            if (!isOn) return {};
            const out = {};
            for (const [k, v] of Object.entries(obj)) {
                if (v !== undefined && v !== null && v !== '') out[k] = v;
            }
            return out;
        };

        return {
            ...state,
            isOn,
            chequeTracking: isOn && !!settings?.chequeTracking,
            activeAccounts,
            accountsById,
            drawerId: drawerId ? String(drawerId) : null,
            accountsForMethod,
            defaultAccountId,
            moneyFields,
            refreshAccounts,
            refreshSettings,
            handleMoneyError,
        };
    }, [state, refreshAccounts, refreshSettings, handleMoneyError]);

    return <MoneyBookContext.Provider value={value}>{children}</MoneyBookContext.Provider>;
};

export default MoneyBookContext;
