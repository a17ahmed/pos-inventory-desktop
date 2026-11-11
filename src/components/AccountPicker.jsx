import React, { useEffect, useMemo, useRef } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import { useMoneyBook } from '../context/MoneyBookContext';
import { useBusiness } from '../context/BusinessContext';
import { ACCOUNT_TYPE_LABELS, formatMoney, NON_MONEY_METHODS } from '../utils/moneyBook';

/**
 * Money Book account chooser for a payment.
 *
 *   <AccountPicker method="card" value={accountId} onChange={setAccountId}
 *                  amount={500} direction="out" onInsufficientChange={setShort} />
 *
 * Renders nothing unless the Money Book is on for this shop and this user
 * may see pickers, or for non-money methods (store credit, credit…). When
 * hidden it clears the value, so the parent sends no accountId.
 *
 * Default = the shop's mapped account for the method (or `defaultId`, e.g.
 * the Cash Drawer for walk-in refunds). With one option it shows as a fixed
 * chip but still reports the id. Balances (and the "insufficient" warning
 * for money going out) only when the user can see balances (cashbook.view);
 * otherwise the server's INSUFFICIENT_BALANCE message is the check.
 */
const AccountPicker = ({
    method,
    value,
    onChange,
    amount = 0,
    direction = 'in',
    anyType = false,
    defaultId,
    pending = false,
    onInsufficientChange,
    label,
    compact = false,
    className = '',
}) => {
    const { isOn, pickerAllowed, hasBalances, accountsForMethod, defaultAccountId, refreshAccounts, settings } = useMoneyBook();
    const { business } = useBusiness();
    const currency = business?.currency || 'Rs.';

    const shown = isOn && pickerAllowed && !!method && !NON_MONEY_METHODS.includes(method);
    const options = useMemo(() => (shown ? accountsForMethod(method, { anyType }) : []), [shown, method, anyType, accountsForMethod]);
    const fallback = defaultId !== undefined ? (defaultId ? String(defaultId) : null) : defaultAccountId(method);
    // Method mapped to "don't record": no account unless the cashier picks one
    const notRecordedByDefault = shown && !anyType && defaultId === undefined
        && settings?.methodAccounts && method in settings.methodAccounts && !settings.methodAccounts[method];

    // Fresh list (and balances) whenever a picker appears
    useEffect(() => {
        if (shown) refreshAccounts();
    }, [shown, refreshAccounts]);

    // Keep the value valid: default on first show / method change, reset when
    // the chosen account disappears (archived), clear when hidden.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    useEffect(() => {
        if (!shown) {
            if (value) onChangeRef.current?.(null, null);
            return;
        }
        if (value && options.some((o) => String(o._id) === String(value))) return;
        let target = null;
        if (fallback && options.some((o) => String(o._id) === fallback)) target = fallback;
        else if (!notRecordedByDefault) target = options[0]?._id ? String(options[0]._id) : null;
        if ((target || null) !== (value || null)) {
            onChangeRef.current?.(target, options.find((o) => String(o._id) === target) || null);
        }
    }, [shown, value, options, fallback, notRecordedByDefault]);

    const selected = options.find((o) => String(o._id) === String(value)) || null;
    const amt = Number(amount) || 0;
    const insufficient = shown && hasBalances && direction === 'out' && !pending && !!selected
        && amt > 0 && amt > (Number(selected.balance) || 0) + 0.005;

    const insufficientRef = useRef(null);
    useEffect(() => {
        if (insufficientRef.current === insufficient) return;
        insufficientRef.current = insufficient;
        onInsufficientChange?.(insufficient);
    }, [insufficient, onInsufficientChange]);

    if (!shown) return null;

    const caption = label || (direction === 'out' ? 'Pay from' : 'Receive into');
    const optionText = (o) => {
        const parts = [o.name];
        if (hasBalances && o.balance !== undefined) parts.push(formatMoney(o.balance, currency));
        else parts.push(ACCOUNT_TYPE_LABELS[o.type] || o.type);
        return parts.join(' · ');
    };

    const labelCls = compact
        ? 'block mb-1 text-[12px] text-slate-500 dark:text-d-muted'
        : 'block text-sm font-medium text-slate-600 dark:text-d-muted mb-1.5';
    const boxCls = `w-full px-3 ${compact ? 'py-2 text-sm' : 'py-2.5 text-sm'} bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border rounded-xl text-slate-800 dark:text-d-text focus:outline-none ${
        insufficient ? 'border-red-300 dark:border-[rgba(239,68,68,0.4)]' : 'border-slate-200 dark:border-d-border focus:border-amber-300 dark:focus:border-d-border-hover'
    }`;

    return (
        <div className={className}>
            <span className={labelCls}>{caption}</span>
            {options.length === 0 ? (
                <p className="text-[12px] text-slate-500 dark:text-d-muted">
                    No account takes this payment method — it won't be recorded in the Money Book.
                </p>
            ) : options.length === 1 && !notRecordedByDefault ? (
                <div className={`${boxCls} flex items-center justify-between`}>
                    <span className="font-medium">{options[0].name}</span>
                    {hasBalances && options[0].balance !== undefined && (
                        <span className={`text-xs ${options[0].balance < 0 ? 'text-red-500 dark:text-d-red' : 'text-slate-500 dark:text-d-muted'}`}>
                            {formatMoney(options[0].balance, currency)}
                        </span>
                    )}
                </div>
            ) : (
                <select
                    value={value || ''}
                    onChange={(e) => {
                        const id = e.target.value || null;
                        onChange?.(id, options.find((o) => String(o._id) === id) || null);
                    }}
                    className={boxCls}
                >
                    {notRecordedByDefault && <option value="">Not recorded in the Money Book</option>}
                    {options.map((o) => (
                        <option key={o._id} value={String(o._id)}>{optionText(o)}</option>
                    ))}
                </select>
            )}
            {insufficient && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-red-600 dark:text-d-red">
                    <FiAlertCircle size={12} />
                    Insufficient — available {formatMoney(selected.balance, currency)}
                </p>
            )}
        </div>
    );
};

export default AccountPicker;
