import React, { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiFileText } from 'react-icons/fi';
import { getCheques, clearCheque, cancelCheque } from '../../services/api/moneyBook';
import { useMoneyBook } from '../../context/MoneyBookContext';
import { apiErrorMessage, todayKey } from '../../utils/moneyBook';
import { Spinner, Pager, ErrorBox, Modal, Field, inputCls, btnGhost, btnSolid, filterCls } from './ui';

/**
 * Outgoing cheques (only when the platform admin turned cheque tracking on).
 * Clearing moves the money out of the bank on the chosen date; cancelling
 * moves nothing and does NOT undo the supplier / expense payment.
 */
const ChequesPanel = ({ fmt, reloadKey, canManage, onChanged }) => {
    const { handleMoneyError } = useMoneyBook();
    const [status, setStatus] = useState('pending');
    const [rows, setRows] = useState([]);
    const [pending, setPending] = useState({ count: 0, amount: 0 });
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [action, setAction] = useState(null); // { kind: 'clear'|'cancel', cheque }
    const [actionValue, setActionValue] = useState('');
    const [actionError, setActionError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchPage = useCallback(async (page = 1) => {
        setLoading(true);
        setError('');
        try {
            const res = await getCheques({ page, limit: 50, ...(status !== 'all' ? { status } : {}) });
            setRows(res.data?.cheques || []);
            setPending(res.data?.pending || { count: 0, amount: 0 });
            setPagination(res.data?.pagination || { page: 1, pages: 1, total: 0 });
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load cheques'));
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchPage(1);
    }, [fetchPage, reloadKey]);

    const open = (kind, cheque) => {
        setAction({ kind, cheque });
        setActionValue(kind === 'clear' ? todayKey() : '');
        setActionError('');
    };

    const submit = async (e) => {
        e.preventDefault();
        setActionError('');
        const { kind, cheque } = action;
        if (kind === 'cancel' && !actionValue.trim()) return setActionError('A reason is required');
        if (kind === 'clear' && actionValue > todayKey()) return setActionError("The date can't be in the future");
        setSaving(true);
        try {
            if (kind === 'clear') await clearCheque(cheque._id, actionValue && actionValue !== todayKey() ? actionValue : undefined);
            else await cancelCheque(cheque._id, actionValue.trim());
            setAction(null);
            fetchPage(pagination.page);
            onChanged?.();
        } catch (err) {
            handleMoneyError(err);
            setActionError(apiErrorMessage(err, 'Failed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={filterCls}>
                    <option value="pending">Pending</option>
                    <option value="cleared">Cleared</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="all">All</option>
                </select>
                {pending.count > 0 && (
                    <span className="text-sm text-amber-700 dark:text-d-accent">
                        {pending.count} pending · {fmt(pending.amount)} still to leave the bank
                    </span>
                )}
            </div>
            <ErrorBox>{error}</ErrorBox>
            <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl overflow-hidden mt-2">
                {loading ? (
                    <Spinner />
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                        <FiFileText size={36} className="mb-3 opacity-40" />
                        <p className="font-medium">No {status === 'all' ? '' : status} cheques</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-d-border bg-slate-50 dark:bg-d-elevated text-slate-500 dark:text-d-muted">
                                    <th className="text-left px-4 py-3 font-semibold">Issued</th>
                                    <th className="text-left px-4 py-3 font-semibold">Cheque</th>
                                    <th className="text-left px-4 py-3 font-semibold">For</th>
                                    <th className="text-left px-4 py-3 font-semibold">Account</th>
                                    <th className="text-right px-4 py-3 font-semibold">Amount</th>
                                    <th className="text-right px-4 py-3 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((c) => (
                                    <tr key={c._id} className="border-b border-slate-50 dark:border-d-border/50">
                                        <td className="px-4 py-3 text-slate-600 dark:text-d-text whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-d-text">
                                            {c.chequeNumber || '—'}
                                            {c.chequeDate && <p className="text-xs text-slate-400 dark:text-d-faint">dated {new Date(c.chequeDate).toLocaleDateString()}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-d-text">
                                            {c.description}
                                            {c.referenceNumber && <p className="text-xs text-slate-400 dark:text-d-faint">{c.referenceNumber}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-d-text">{c.account?.name || '—'}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-d-heading">{fmt(c.amount)}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            {c.chequeStatus === 'pending' && canManage ? (
                                                <div className="inline-flex gap-2">
                                                    <button onClick={() => open('clear', c)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-d-green hover:underline">
                                                        <FiCheckCircle size={12} /> Clear
                                                    </button>
                                                    <button onClick={() => open('cancel', c)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-d-red hover:underline">
                                                        <FiXCircle size={12} /> Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-d-elevated text-slate-500 dark:text-d-muted capitalize">{c.chequeStatus}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pager pagination={pagination} onPage={fetchPage} noun="cheques" />
            </div>

            {action && (
                <Modal title={action.kind === 'clear' ? 'Cheque cleared' : 'Cancel cheque'} onClose={() => setAction(null)}>
                    <form onSubmit={submit} className="p-5 space-y-4">
                        <ErrorBox>{actionError}</ErrorBox>
                        <p className="text-sm text-slate-600 dark:text-d-text">
                            Cheque {action.cheque.chequeNumber || ''} · {fmt(action.cheque.amount)} from {action.cheque.account?.name}
                        </p>
                        {action.kind === 'clear' ? (
                            <Field label="Date it left the bank">
                                <input type="date" value={actionValue} max={todayKey()} onChange={(e) => setActionValue(e.target.value)} className={inputCls} />
                            </Field>
                        ) : (
                            <>
                                <p className="text-[13px] text-amber-700 dark:text-d-accent">
                                    No money moves. The supplier / expense payment itself stays recorded — record a bounced cheque to a supplier separately.
                                </p>
                                <Field label="Reason">
                                    <input type="text" value={actionValue} onChange={(e) => setActionValue(e.target.value)} maxLength={200} className={inputCls} autoFocus required />
                                </Field>
                            </>
                        )}
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setAction(null)} className={btnGhost}>Back</button>
                            <button type="submit" disabled={saving} className={btnSolid(action.kind === 'clear' ? 'emerald' : 'red')}>
                                {saving ? 'Saving…' : action.kind === 'clear' ? 'Mark cleared' : 'Cancel cheque'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default ChequesPanel;
