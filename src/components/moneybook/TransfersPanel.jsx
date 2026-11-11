import React, { useCallback, useEffect, useState } from 'react';
import { FiArrowRight, FiCornerUpLeft, FiRepeat } from 'react-icons/fi';
import { getTransfers } from '../../services/api/moneyBook';
import { apiErrorMessage } from '../../utils/moneyBook';
import { Spinner, Pager, ErrorBox } from './ui';

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

    return (
        <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl overflow-hidden">
            <ErrorBox>{error}</ErrorBox>
            {loading ? (
                <Spinner />
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                    <FiRepeat size={36} className="mb-3 opacity-40" />
                    <p className="font-medium">No transfers yet</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-d-border bg-slate-50 dark:bg-d-elevated text-slate-500 dark:text-d-muted">
                                <th className="text-left px-4 py-3 font-semibold">Date</th>
                                <th className="text-left px-4 py-3 font-semibold">From → To</th>
                                <th className="text-right px-4 py-3 font-semibold">Amount</th>
                                <th className="text-right px-4 py-3 font-semibold">Fee</th>
                                <th className="text-left px-4 py-3 font-semibold">Note</th>
                                <th className="text-right px-4 py-3 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((t) => (
                                <tr key={t.transferId} className="border-b border-slate-50 dark:border-d-border/50">
                                    <td className="px-4 py-3 text-slate-600 dark:text-d-text whitespace-nowrap">
                                        {new Date(t.date).toLocaleDateString()}
                                        <p className="text-xs text-slate-400 dark:text-d-faint">{t.performedBy ? `by ${t.performedBy}` : ''}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 dark:text-d-text">
                                        <span className="inline-flex items-center gap-1.5">
                                            {t.from?.name || '—'} <FiArrowRight size={13} className="text-slate-400" /> {t.to?.name || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-d-heading">{fmt(t.amount)}</td>
                                    <td className="px-4 py-3 text-right text-slate-500 dark:text-d-muted">{t.fee > 0 ? fmt(t.fee) : '—'}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-d-muted">{t.note}</td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        {t.isReversal ? (
                                            <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-d-elevated text-slate-500 dark:text-d-muted">Reversal</span>
                                        ) : t.reversedBy ? (
                                            <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-d-elevated text-slate-500 dark:text-d-muted">Reversed</span>
                                        ) : canTransfer ? (
                                            <button
                                                onClick={() => onReverse?.(t)}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                <FiCornerUpLeft size={12} /> Reverse
                                            </button>
                                        ) : (
                                            <span className="text-xs text-slate-400">Done</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pager pagination={pagination} onPage={fetchPage} noun="transfers" />
        </div>
    );
};

export default TransfersPanel;
