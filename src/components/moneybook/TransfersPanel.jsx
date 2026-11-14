import React, { useCallback, useEffect, useState } from 'react';
import { FiArrowRight, FiCornerUpLeft, FiRepeat } from 'react-icons/fi';
import { getTransfers } from '../../services/api/moneyBook';
import { apiErrorMessage } from '../../utils/moneyBook';
import { DataTable, Dash, Button, StatusChip } from '../ui';

/** One row per transfer (GET /money-book/transfers), with reverse */
const TransfersPanel = ({ fmt, reloadKey, canTransfer, onReverse }) => {
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPage = useCallback(async (page = 1) => {
        setLoading(true);
        setError('');
        try {
            const res = await getTransfers({ page, limit: 50 });
            setRows(res.data?.transfers || []);
            setPagination(res.data?.pagination || { page: 1, pages: 1, total: 0 });
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load transfers'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPage(1);
    }, [fetchPage, reloadKey]);

    const columns = [
        {
            id: 'date',
            header: 'Date',
            accessorFn: (t) => new Date(t.date).getTime() || 0,
            cell: ({ row: { original: t } }) => (
                <div className="whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString()}
                    {t.performedBy ? <p className="text-body-sm text-muted-foreground">by {t.performedBy}</p> : null}
                </div>
            ),
        },
        {
            id: 'route',
            header: 'From → To',
            accessorFn: (t) => `${t.from?.name || ''} ${t.to?.name || ''}`,
            cell: ({ row: { original: t } }) => (
                <span className="inline-flex items-center gap-1.5">
                    {t.from?.name || '—'} <FiArrowRight size={13} className="text-muted-foreground" aria-label="to" /> {t.to?.name || '—'}
                </span>
            ),
        },
        { id: 'amount', header: 'Amount', accessorFn: (t) => Number(t.amount) || 0, meta: { align: 'right' }, cell: ({ getValue }) => <span className="font-medium">{fmt(getValue())}</span> },
        { id: 'fee', header: 'Fee', accessorFn: (t) => Number(t.fee) || 0, meta: { align: 'right' }, cell: ({ getValue }) => (getValue() > 0 ? fmt(getValue()) : <Dash />) },
        { id: 'note', header: 'Note', accessorFn: (t) => t.note || '', cell: ({ getValue }) => (getValue() ? <span className="text-muted-foreground">{getValue()}</span> : <Dash />) },
        {
            id: 'status',
            header: 'Status',
            enableSorting: false,
            meta: { align: 'right' },
            cell: ({ row: { original: t } }) =>
                t.isReversal ? (
                    <StatusChip size="sm" tone="neutral" label="Reversal" />
                ) : t.reversedBy ? (
                    <StatusChip size="sm" tone="neutral" label="Reversed" />
                ) : canTransfer ? (
                    <Button variant="ghost" size="xs" onClick={() => onReverse?.(t)}>
                        <FiCornerUpLeft aria-hidden="true" /> Reverse
                    </Button>
                ) : (
                    <span className="text-muted-foreground">Done</span>
                ),
        },
    ];

    return (
        <DataTable
            caption="Transfers"
            data={rows}
            columns={columns}
            getRowId={(t) => t.transferId}
            loading={loading}
            error={error ? { message: error, onRetry: () => fetchPage(pagination.page || 1) } : null}
            empty={{ icon: FiRepeat, title: 'No transfers yet', description: 'Money moved between accounts shows here.' }}
            server={{ page: pagination.page || 1, pageSize: pagination.limit || 50, total: pagination.total || 0, onPageChange: fetchPage, noun: 'transfers' }}
        />
    );
};

export default TransfersPanel;
