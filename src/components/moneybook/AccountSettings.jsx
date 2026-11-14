import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlus, FiEdit2, FiArchive, FiRotateCcw, FiArrowUp, FiArrowDown, FiSave } from 'react-icons/fi';
import { useMoneyBook } from '../../context/MoneyBookContext';
import {
    getMoneyAccounts, createMoneyAccount, updateMoneyAccount, archiveMoneyAccount,
    restoreMoneyAccount, reorderMoneyAccounts, updateMoneyBookSettings,
} from '../../services/api/moneyBook';
import { appAlert, appConfirm } from '../AppDialog';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, METHOD_LABELS, apiErrorMessage, round2, todayKey } from '../../utils/moneyBook';
import { Modal, Field, ErrorBox, Spinner, inputCls, btnGhost, btnSolid } from './ui';
import { cn, Button, IconButton, StatusChip, TABLE_CARD, TABLE_ROW, TABLE_TD } from '../ui';

const EMPTY_FORM = {
    name: '', type: 'bank', bankName: '', accountTitle: '', accountTail: '', walletNumber: '', note: '', openingBalance: '', date: todayKey(),
};

/** Admin: accounts (add / edit / archive / restore / reorder) + method → account mapping */
const AccountSettings = ({ fmt, onChanged }) => {
    const { settings, chequeTracking, refreshSettings } = useMoneyBook();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showArchived, setShowArchived] = useState(false);
    const [editing, setEditing] = useState(null); // null | 'new' | account
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [mapping, setMapping] = useState({});
    const [mappingSaving, setMappingSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getMoneyAccounts({ includeArchived: true });
            setAccounts(res.data?.accounts || []);
        } catch (err) {
            appAlert(apiErrorMessage(err, 'Failed to load accounts'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const m = {};
        for (const [k, v] of Object.entries(settings?.methodAccounts || {})) m[k] = v ? String(v) : '';
        setMapping(m);
    }, [settings]);

    const active = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
    const visible = showArchived ? accounts : active;

    const changed = () => {
        load();
        onChanged?.();
    };

    // ── Add / edit ──────────────────────────────────────────
    const openForm = (acc) => {
        setFormError('');
        if (acc === 'new') {
            setForm(EMPTY_FORM);
        } else {
            const d = acc.details || {};
            setForm({
                ...EMPTY_FORM,
                name: acc.name,
                type: acc.type,
                bankName: d.bankName || '',
                accountTitle: d.accountTitle || '',
                accountTail: d.accountTail || '',
                walletNumber: d.walletNumber || '',
                note: d.note || '',
            });
        }
        setEditing(acc);
    };

    const submitForm = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!form.name.trim()) return setFormError('Enter a name');
        if (form.accountTail && !/^\d{1,8}$/.test(form.accountTail)) return setFormError('Account number: last digits only (up to 8)');
        const details = {
            bankName: form.bankName.trim(),
            accountTitle: form.accountTitle.trim(),
            accountTail: form.accountTail.trim(),
            walletNumber: form.walletNumber.trim(),
            note: form.note.trim(),
        };
        setSaving(true);
        try {
            if (editing === 'new') {
                const opening = round2(form.openingBalance);
                await createMoneyAccount({
                    name: form.name.trim(),
                    type: form.type,
                    details,
                    ...(opening > 0 ? { openingBalance: opening } : {}),
                    ...(opening > 0 && form.date && form.date !== todayKey() ? { date: form.date } : {}),
                });
            } else {
                const body = { name: form.name.trim(), details };
                if (!editing.systemKey && form.type !== editing.type) body.type = form.type;
                await updateMoneyAccount(editing._id, body);
            }
            setEditing(null);
            changed();
        } catch (err) {
            setFormError(apiErrorMessage(err, 'Failed to save the account'));
        } finally {
            setSaving(false);
        }
    };

    // ── Archive / restore / reorder ─────────────────────────
    const archive = async (acc) => {
        if (!(await appConfirm(`Archive ${acc.name}? It will disappear from pickers. Its history stays.`, { title: 'Archive account', danger: true }))) return;
        try {
            await archiveMoneyAccount(acc._id);
            changed();
        } catch (err) {
            appAlert(apiErrorMessage(err, "Couldn't archive the account"), { title: "Can't archive" });
        }
    };

    const restore = async (acc) => {
        try {
            await restoreMoneyAccount(acc._id);
            changed();
        } catch (err) {
            appAlert(apiErrorMessage(err, "Couldn't restore the account"));
        }
    };

    const move = async (index, delta) => {
        const list = [...active];
        const j = index + delta;
        if (j < 0 || j >= list.length) return;
        [list[index], list[j]] = [list[j], list[index]];
        const archived = accounts.filter((a) => !a.isActive);
        setAccounts([...list, ...archived]);
        try {
            await reorderMoneyAccounts(list.map((a) => String(a._id)));
            changed();
        } catch (err) {
            appAlert(apiErrorMessage(err, 'Failed to reorder'));
            load();
        }
    };

    // ── Mapping ─────────────────────────────────────────────
    const methods = ['cash', 'card', 'online', 'bank_transfer', 'other', ...(chequeTracking ? ['cheque'] : [])];
    const compatibility = settings?.compatibility || {};

    const saveMapping = async () => {
        const body = {};
        for (const m of methods) {
            const now = mapping[m] || '';
            const before = settings?.methodAccounts?.[m] ? String(settings.methodAccounts[m]) : '';
            if (now !== before) body[m] = now || null;
        }
        if (Object.keys(body).length === 0) return appAlert('Nothing changed');
        setMappingSaving(true);
        try {
            await updateMoneyBookSettings(body);
            await refreshSettings();
            appAlert('Payment method mapping saved', { title: 'Saved' });
            changed();
        } catch (err) {
            appAlert(apiErrorMessage(err, 'Failed to save the mapping'));
        } finally {
            setMappingSaving(false);
        }
    };

    if (loading && accounts.length === 0) return <Spinner />;

    const detailsLine = (a) => {
        const d = a.details || {};
        return [d.bankName, d.accountTitle, d.accountTail ? `••${d.accountTail}` : '', d.walletNumber].filter(Boolean).join(' · ');
    };

    return (
        <div className="space-y-6">
            {/* Accounts */}
            <section className={TABLE_CARD} aria-labelledby="mb-accounts-title">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-hairline">
                    <div>
                        <h3 id="mb-accounts-title" className="font-heading text-h4 text-foreground">Accounts</h3>
                        <p className="text-body-sm text-muted-foreground">The order here is the tab order. Only last digits of account numbers are stored.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-body text-muted-foreground cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-[var(--primary)]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                            Show archived
                        </label>
                        <Button onClick={() => openForm('new')}>
                            <FiPlus aria-hidden="true" /> Add account
                        </Button>
                    </div>
                </div>
                <table className="w-full border-collapse">
                    <tbody>
                        {visible.map((a) => {
                            const idx = active.findIndex((x) => String(x._id) === String(a._id));
                            return (
                                <tr key={a._id} className={cn(TABLE_ROW, !a.isActive && 'opacity-60')}>
                                    <td className={cn(TABLE_TD, 'w-14')}>
                                        {a.isActive && (
                                            <div className="flex flex-col">
                                                <IconButton label="Move up" size="2xs" disabled={idx <= 0} onClick={() => move(idx, -1)}>
                                                    <FiArrowUp />
                                                </IconButton>
                                                <IconButton label="Move down" size="2xs" disabled={idx >= active.length - 1} onClick={() => move(idx, 1)}>
                                                    <FiArrowDown />
                                                </IconButton>
                                            </div>
                                        )}
                                    </td>
                                    <td className={cn(TABLE_TD, 'py-2.5')}>
                                        <p className="font-medium flex flex-wrap items-center gap-1.5">
                                            {a.name}
                                            {a.systemKey && <StatusChip size="xs" shape="tag" tone="neutral" label="Built-in" />}
                                            {!a.isActive && <StatusChip size="xs" shape="tag" tone="neutral" label="Archived" />}
                                        </p>
                                        <p className="text-body-sm text-muted-foreground">
                                            {ACCOUNT_TYPE_LABELS[a.type] || a.type}
                                            {detailsLine(a) ? ` · ${detailsLine(a)}` : ''}
                                        </p>
                                        {a.methods?.length > 0 && (
                                            <p className="text-body-sm text-muted-foreground">Receives: {a.methods.map((m) => METHOD_LABELS[m] || m).join(', ')}</p>
                                        )}
                                    </td>
                                    <td className={cn(TABLE_TD, 'text-right tabular-nums font-semibold', a.balance < 0 && 'text-destructive')}>{fmt(a.balance)}</td>
                                    <td className={cn(TABLE_TD, 'text-right whitespace-nowrap w-28')}>
                                        <div className="inline-flex gap-1">
                                            <IconButton label="Edit" size="xs" onClick={() => openForm(a)}>
                                                <FiEdit2 />
                                            </IconButton>
                                            {a.isActive ? (
                                                a.systemKey !== 'cash_drawer' && (
                                                    <IconButton label="Archive" size="xs" onClick={() => archive(a)}>
                                                        <FiArchive />
                                                    </IconButton>
                                                )
                                            ) : (
                                                <IconButton label="Restore" size="xs" onClick={() => restore(a)}>
                                                    <FiRotateCcw />
                                                </IconButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </section>

            {/* Mapping */}
            <div className="bg-card text-card-foreground border border-hairline rounded-2xl shadow-1 overflow-hidden">
                <div className="px-5 pt-4 pb-3">
                    <h3 className="font-heading text-h4 text-foreground">Payment method → account</h3>
                    <p className="mt-0.5 text-caption text-muted-foreground">Where each payment method lands by default. Cashiers can still pick another matching account.</p>
                </div>
                <div className="px-5 pb-5 space-y-3">
                    {methods.map((m) => {
                        const allowed = compatibility[m];
                        const options = active.filter((a) => !Array.isArray(allowed) || allowed.includes(a.type));
                        return (
                            <div key={m} className="grid grid-cols-3 items-center gap-3">
                                <span className="text-body font-medium text-foreground">{METHOD_LABELS[m] || m}</span>
                                <select
                                    value={mapping[m] || ''}
                                    onChange={(e) => setMapping((prev) => ({ ...prev, [m]: e.target.value }))}
                                    className={`${inputCls} col-span-2`}
                                >
                                    {m !== 'cash' && <option value="">Don't record</option>}
                                    {options.map((a) => <option key={a._id} value={String(a._id)}>{a.name}</option>)}
                                </select>
                            </div>
                        );
                    })}
                    <div className="flex justify-end pt-2">
                        <button onClick={saveMapping} disabled={mappingSaving} className={btnSolid('emerald', false)}>
                            <FiSave size={15} /> {mappingSaving ? 'Saving…' : 'Save mapping'}
                        </button>
                    </div>
                </div>
            </div>

            {editing && (
                <Modal title={editing === 'new' ? 'Add account' : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
                    <form onSubmit={submitForm} className="p-5 space-y-4">
                        <ErrorBox>{formError}</ErrorBox>
                        <Field label="Name">
                            <input type="text" value={form.name} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Meezan Bank, JazzCash" autoFocus required />
                        </Field>
                        <Field label="Type" hint={editing !== 'new' && editing.systemKey ? "A built-in account's type can't change." : undefined}>
                            <select value={form.type} disabled={editing !== 'new' && !!editing.systemKey} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
                            </select>
                        </Field>
                        {(form.type === 'bank' || form.type === 'card_machine') && (
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Bank name">
                                    <input type="text" value={form.bankName} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} className={inputCls} />
                                </Field>
                                <Field label="Last digits" hint="Never the full number">
                                    <input type="text" inputMode="numeric" value={form.accountTail} maxLength={8} onChange={(e) => setForm((f) => ({ ...f, accountTail: e.target.value.replace(/\D/g, '') }))} className={inputCls} placeholder="4421" />
                                </Field>
                                <div className="col-span-2">
                                    <Field label="Account title">
                                        <input type="text" value={form.accountTitle} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, accountTitle: e.target.value }))} className={inputCls} />
                                    </Field>
                                </div>
                            </div>
                        )}
                        {form.type === 'wallet' && (
                            <Field label="Wallet number">
                                <input type="text" value={form.walletNumber} maxLength={20} onChange={(e) => setForm((f) => ({ ...f, walletNumber: e.target.value }))} className={inputCls} placeholder="0300-•••-1234" />
                            </Field>
                        )}
                        <Field label="Note">
                            <input type="text" value={form.note} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inputCls} />
                        </Field>
                        {editing === 'new' && (
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Opening balance" hint="From today's statement / count">
                                    <input type="number" min="0" step="0.01" value={form.openingBalance} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} className={inputCls} placeholder="0.00" />
                                </Field>
                                <Field label="As of">
                                    <input type="date" value={form.date} max={todayKey()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
                                </Field>
                            </div>
                        )}
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
                            <button type="submit" disabled={saving} className={btnSolid('emerald')}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default AccountSettings;
