import React, { useMemo, useState } from 'react';
import { useMoneyBook } from '../../context/MoneyBookContext';
import {
    moneyDeposit, moneyWithdraw, createTransfer, createAdjustment, setAccountOpeningBalance,
} from '../../services/api/moneyBook';
import { apiErrorMessage, round2, todayKey } from '../../utils/moneyBook';
import { Modal, Field, ErrorBox, inputCls, btnGhost, btnSolid } from './ui';

const TITLES = {
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    transfer: 'Transfer between accounts',
    adjustment: 'Adjustment',
    opening: 'Opening balance',
};

const SUBMIT = {
    deposit: ['Deposit', 'emerald'],
    withdraw: ['Withdraw', 'orange'],
    transfer: ['Transfer', 'indigo'],
    adjustment: ['Save adjustment', 'amber'],
    opening: ['Set opening balance', 'blue'],
};

/**
 * One modal for every manual Money Book movement.
 * kind: deposit | withdraw | transfer | adjustment | opening
 */
const MoneyActionModal = ({ kind, initialAccountId, fmt, onClose, onDone }) => {
    const { activeAccounts, handleMoneyError } = useMoneyBook();
    const accounts = activeAccounts;
    const firstId = initialAccountId || (accounts[0]?._id ? String(accounts[0]._id) : '');
    const [form, setForm] = useState({
        accountId: firstId,
        toAccountId: '',
        amount: '',
        fee: '',
        direction: 'out',
        reason: '',
        description: '',
        note: '',
        date: todayKey(),
    });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const account = useMemo(() => accounts.find((a) => String(a._id) === String(form.accountId)), [accounts, form.accountId]);
    const amount = round2(form.amount);
    const fee = round2(form.fee);
    const needed = kind === 'transfer' ? round2(amount + fee) : amount;
    const outgoing = kind === 'withdraw' || kind === 'transfer';
    const short = outgoing && account && needed > 0 && needed > (Number(account.balance) || 0) + 0.005;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!(amount > 0)) return setError('Enter a valid amount');
        if (!form.accountId) return setError('Choose an account');
        if (kind === 'transfer') {
            if (!form.toAccountId) return setError('Choose the account to transfer to');
            if (form.toAccountId === form.accountId) return setError('Choose two different accounts');
            if (fee < 0) return setError('Fee cannot be negative');
        }
        if (kind === 'adjustment' && !form.reason.trim()) return setError('A reason is required');
        if (short) return setError(`Not enough in ${account.name}. Available: ${fmt(account.balance)}, needed: ${fmt(needed)}`);
        if (form.date > todayKey()) return setError("The date can't be in the future");

        // Only back-dated entries carry a date; today = "now" on the server
        const date = form.date && form.date !== todayKey() ? form.date : undefined;
        const note = form.note.trim() || undefined;
        setSubmitting(true);
        try {
            if (kind === 'deposit' || kind === 'withdraw') {
                const body = { accountId: form.accountId, amount, description: form.description.trim() || undefined, note, date };
                await (kind === 'deposit' ? moneyDeposit(body) : moneyWithdraw(body));
            } else if (kind === 'transfer') {
                await createTransfer({
                    fromAccountId: form.accountId,
                    toAccountId: form.toAccountId,
                    amount,
                    ...(fee > 0 ? { fee } : {}),
                    note,
                    date,
                });
            } else if (kind === 'adjustment') {
                await createAdjustment({ accountId: form.accountId, direction: form.direction, amount, reason: form.reason.trim(), note, date });
            } else if (kind === 'opening') {
                await setAccountOpeningBalance(form.accountId, { amount, note, date });
            }
            onDone?.();
        } catch (err) {
            handleMoneyError(err);
            setError(apiErrorMessage(err, 'Operation failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const accountSelect = (key, exclude) => (
        <select value={form[key]} onChange={set(key)} className={inputCls} disabled={kind === 'opening' && !!initialAccountId}>
            {key === 'toAccountId' && <option value="">Choose…</option>}
            {accounts
                .filter((a) => !exclude || String(a._id) !== String(exclude))
                .map((a) => (
                    <option key={a._id} value={String(a._id)}>
                        {a.name} · {fmt(a.balance)}
                    </option>
                ))}
        </select>
    );

    const [submitText, color] = SUBMIT[kind];

    return (
        <Modal title={TITLES[kind]} onClose={onClose}>
            <form onSubmit={submit} className="p-5 space-y-4">
                <ErrorBox>{error}</ErrorBox>

                <Field label={kind === 'transfer' ? 'From' : 'Account'}>{accountSelect('accountId')}</Field>
                {account && outgoing && (
                    <p className={`-mt-2 text-[12px] ${short ? 'text-red-600 dark:text-d-red font-medium' : 'text-slate-500 dark:text-d-muted'}`}>
                        Available: {fmt(account.balance)}{short ? ` — not enough for ${fmt(needed)}` : ''}
                    </p>
                )}
                {kind === 'transfer' && <Field label="To">{accountSelect('toAccountId', form.accountId)}</Field>}

                {kind === 'adjustment' && (
                    <Field label="Direction" hint="Adjustments correct the book to match reality and may take an account below zero.">
                        <div className="grid grid-cols-2 gap-2">
                            {[['in', 'Add money (in)'], ['out', 'Remove money (out)']].map(([v, t]) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setForm((f) => ({ ...f, direction: v }))}
                                    className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                                        form.direction === v
                                            ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                            : 'bg-slate-100 dark:bg-d-elevated text-slate-600 dark:text-d-muted'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </Field>
                )}

                <div className={kind === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}>
                    <Field label="Amount">
                        <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} className={`${inputCls} text-lg font-bold`} placeholder="0.00" autoFocus required />
                    </Field>
                    {kind === 'transfer' && (
                        <Field label="Fee (optional)">
                            <input type="number" min="0" step="0.01" value={form.fee} onChange={set('fee')} className={inputCls} placeholder="0.00" />
                        </Field>
                    )}
                </div>
                {kind === 'transfer' && fee > 0 && (
                    <p className="-mt-2 text-[12px] text-slate-500 dark:text-d-muted">
                        {fmt(needed)} leaves {account?.name || 'the account'}; {fmt(amount)} arrives. The fee is money spent.
                    </p>
                )}

                {kind === 'adjustment' && (
                    <Field label="Reason">
                        <input type="text" value={form.reason} onChange={set('reason')} maxLength={200} className={inputCls} placeholder="e.g. Bank charges for October" required />
                    </Field>
                )}
                {(kind === 'deposit' || kind === 'withdraw') && (
                    <Field label="Description">
                        <input type="text" value={form.description} onChange={set('description')} maxLength={200} className={inputCls} placeholder={kind === 'deposit' ? 'e.g. Owner added cash' : 'e.g. Owner took cash'} />
                    </Field>
                )}

                <Field label="Date" hint="Back-date only if the money moved on an earlier day (after the last store closing).">
                    <input type="date" value={form.date} max={todayKey()} onChange={set('date')} className={inputCls} />
                </Field>

                <Field label="Note (optional)">
                    <textarea value={form.note} onChange={set('note')} maxLength={200} rows={2} className={`${inputCls} resize-none`} />
                </Field>

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
                    <button type="submit" disabled={submitting || short} className={btnSolid(color)}>
                        {submitting ? 'Saving…' : submitText}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default MoneyActionModal;
