import React, { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiFileText } from 'react-icons/fi';
import { getCheques, clearCheque, cancelCheque } from '../../services/api/moneyBook';
import { useMoneyBook } from '../../context/MoneyBookContext';
import { apiErrorMessage, todayKey } from '../../utils/moneyBook';
import { ErrorBox, Modal, Field, inputCls, btnGhost, btnSolid } from './ui';
import { DataTable, Dash, Button, StatusBadge, SegmentedControl } from '../ui';

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

    const columns = [
        {
            id: 'issued',
            header: 'Issued',
            accessorFn: (c) => new Date(c.createdAt).getTime() || 0,
            cell: ({ row: { original: c } }) => <span className="whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</span>,
        },
        {
            id: 'cheque',
            header: 'Cheque',
            accessorFn: (c) => c.chequeNumber || '',
            cell: ({ row: { original: c } }) => (
                <div>
                    <span className="font-mono text-mono-sm">{c.chequeNumber || '—'}</span>
                    {c.chequeDate && <p className="text-body-sm text-muted-foreground">dated {new Date(c.chequeDate).toLocaleDateString()}</p>}
                </div>
            ),
        },
        {
            id: 'for',
            header: 'For',
            accessorFn: (c) => c.description || '',
            cell: ({ row: { original: c } }) => (
                <div>
                    {c.description}
                    {c.referenceNumber && <p className="font-mono text-mono-xs text-muted-foreground">{c.referenceNumber}</p>}
                </div>
            ),
        },
        { id: 'account', header: 'Account', accessorFn: (c) => c.account?.name || '', cell: ({ getValue }) => getValue() || <Dash /> },
        { id: 'amount', header: 'Amount', accessorFn: (c) => Number(c.amount) || 0, meta: { align: 'right' }, cell: ({ getValue }) => <span className="font-medium">{fmt(getValue())}</span> },
        {
            id: 'status',
            header: 'Status',
            accessorFn: (c) => c.chequeStatus || '',
            meta: { align: 'right' },
            cell: ({ row: { original: c } }) =>
                c.chequeStatus === 'pending' && canManage ? (
                    <div className="inline-flex gap-1">
                        <Button variant="ghost" size="xs" onClick={() => open('clear', c)}>
                            <FiCheckCircle aria-hidden="true" /> Clear
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => open('cancel', c)} className="text-destructive">
                            <FiXCircle aria-hidden="true" /> Cancel
                        </Button>
                    </div>
                ) : (
                    <StatusBadge kind="cheque" value={c.chequeStatus} size="sm" />
                ),
        },
    ];

    return (
        <div>
            <DataTable
                caption="Cheques"
                data={rows}
                columns={columns}
                getRowId={(c) => c._id}
                loading={loading}
                error={error ? { message: error, onRetry: () => fetchPage(pagination.page || 1) } : null}
                filters={
                    <>
                        <SegmentedControl
                            label="Cheque status"
                            value={status}
                            onChange={setStatus}
                            options={[
                                { value: 'pending', label: 'Pending' },
                                { value: 'cleared', label: 'Cleared' },
                                { value: 'cancelled', label: 'Cancelled' },
                                { value: 'all', label: 'All' },
                            ]}
                        />
                        {pending.count > 0 && (
                            <span className="text-body text-warning-chip-foreground">
                                {pending.count} pending · {fmt(pending.amount)} still to leave the bank
                            </span>
                        )}
                    </>
                }
                isFiltered={status !== 'all'}
                onClearFilters={() => setStatus('all')}
                empty={{ icon: FiFileText, title: 'No cheques yet', description: 'Cheques you write appear here until they clear.' }}
                rowTone={(c) => (c.chequeStatus === 'pending' && c.chequeDate && new Date(c.chequeDate) < new Date() ? 'attention' : null)}
                server={{ page: pagination.page || 1, pageSize: pagination.limit || 50, total: pagination.total || 0, onPageChange: fetchPage, noun: 'cheques' }}
            />

            {action && (
                <Modal title={action.kind === 'clear' ? 'Cheque cleared' : 'Cancel cheque'} onClose={() => setAction(null)}>
                    <form onSubmit={submit} className="p-5 space-y-4">
                        <ErrorBox>{actionError}</ErrorBox>
                        <p className="text-body text-foreground">
                            Cheque {action.cheque.chequeNumber || ''} · {fmt(action.cheque.amount)} from {action.cheque.account?.name}
                        </p>
                        {action.kind === 'clear' ? (
                            <Field label="Date it left the bank">
                                <input type="date" value={actionValue} max={todayKey()} onChange={(e) => setActionValue(e.target.value)} className={inputCls} />
                            </Field>
                        ) : (
                            <>
                                <p className="text-body-sm text-warning-chip-foreground">
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
