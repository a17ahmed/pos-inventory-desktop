import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiSearch, FiInbox, FiDownload, FiCornerUpLeft } from 'react-icons/fi';
import { getMoneyEntries } from '../../services/api/moneyBook';
import { ENTRY_TYPE_COLORS, entryTypeLabel, localDayKey, apiErrorMessage } from '../../utils/moneyBook';
import { filterCls, Spinner, Pager, ErrorBox } from './ui';

const TYPE_FILTERS = [
    'opening_balance', 'manual_deposit', 'manual_withdrawal', 'sale_collection', 'sale_cancel',
    'customer_refund', 'refund_reversal', 'vendor_payment', 'expense', 'expense_reversal',
    'transfer_out', 'transfer_in', 'transfer_fee', 'adjustment',
];

/**
 * Ledger of one account (or `all`), grouped by the local day the money moved
 * (effectiveDate). Day opening/closing come from the server's dailySummary
 * (every entry of the day, not just this page). The Balance column is hidden
 * when the server sends balanceAfter = null (filtered list).
 */
const EntriesTable = ({ account = 'all', fmt, reloadKey, canTransfer, onReverseTransfer, accountName }) => {
    const [entries, setEntries] = useState([]);
    const [dailySummary, setDailySummary] = useState([]);
    const [rangeSummary, setRangeSummary] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [type, setType] = useState('all');
    const [direction, setDirection] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');

    // Debounce the server-side search
    useEffect(() => {
        const t = setTimeout(() => setQ(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    const fetchPage = useCallback(async (page = 1) => {
        setLoading(true);
        setError('');
        try {
            const params = { account, page, limit: 50 };
            if (type !== 'all') params.type = type;
            if (direction !== 'all') params.direction = direction;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (q) params.q = q;
            const res = await getMoneyEntries(params);
            setEntries(res.data?.entries || []);
            setDailySummary(res.data?.dailySummary || []);
            setRangeSummary(res.data?.rangeSummary || null);
            setPagination(res.data?.pagination || { page: 1, pages: 1, total: 0 });
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load entries'));
        } finally {
            setLoading(false);
        }
    }, [account, type, direction, startDate, endDate, q]);

    useEffect(() => {
        fetchPage(1);
    }, [fetchPage, reloadKey]);

    const isAll = account === 'all';
    const filtered = type !== 'all' || direction !== 'all' || !!q;
    const showBalance = entries.length > 0 && entries.every((e) => e.balanceAfter !== null && e.balanceAfter !== undefined);

    const groups = useMemo(() => {
        const byKey = new Map(dailySummary.map((d) => [d.date, d]));
        const out = [];
        for (const e of entries) {
            const when = e.effectiveDate || e.createdAt;
            const key = localDayKey(when);
            let g = out[out.length - 1];
            if (!g || g.key !== key) {
                g = { key, date: new Date(when), entries: [], summary: byKey.get(key) || null };
                out.push(g);
            }
            g.entries.push(e);
        }
        return out;
    }, [entries, dailySummary]);

    const colCount = 6 + (isAll ? 1 : 0) + (showBalance ? 1 : 0);
    const labelSpan = colCount - (showBalance ? 3 : 2);

    const downloadCsv = () => {
        const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
        const rows = [
            ['Money Book', accountName || (isAll ? 'All accounts' : '')],
            ['Generated', new Date().toLocaleString()],
            [],
            ['Entry #', 'Date', 'Time', 'Account', 'Type', 'Description', 'Reference', 'In', 'Out', ...(showBalance ? ['Balance'] : []), 'By', 'Note'],
            ...entries.map((e) => {
                const d = new Date(e.effectiveDate || e.createdAt);
                return [
                    e.entryNumber, d.toLocaleDateString(), d.toLocaleTimeString(), e.account?.name, entryTypeLabel(e.type),
                    e.description, e.referenceNumber, e.direction === 'in' ? e.amount : '', e.direction === 'out' ? e.amount : '',
                    ...(showBalance ? [e.balanceAfter] : []), e.performedBy, e.note,
                ];
            }),
        ];
        const csv = rows.map((r) => r.map((c) => `"${esc(c)}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `money-book-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const clearFilters = () => {
        setType('all');
        setDirection('all');
        setStartDate('');
        setEndDate('');
        setSearch('');
    };

    const balanceCell = (v, cls = '') => (
        <td className={`px-4 py-2.5 text-right font-semibold text-sm ${(Number(v) || 0) < 0 ? 'text-d-red' : 'text-slate-700 dark:text-d-heading'} ${cls}`}>{fmt(v)}</td>
    );

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Reference or description…"
                        className={`${filterCls} w-full pl-10`}
                    />
                </div>
                <select value={type} onChange={(e) => setType(e.target.value)} className={filterCls}>
                    <option value="all">All types</option>
                    {TYPE_FILTERS.map((t) => <option key={t} value={t}>{entryTypeLabel(t)}</option>)}
                </select>
                <select value={direction} onChange={(e) => setDirection(e.target.value)} className={filterCls}>
                    <option value="all">In &amp; out</option>
                    <option value="in">Money in</option>
                    <option value="out">Money out</option>
                </select>
                <div className="flex items-center gap-2">
                    <FiCalendar className="text-slate-400 dark:text-d-faint" size={16} />
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={filterCls} />
                    <span className="text-slate-400 dark:text-d-faint text-sm">to</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={filterCls} />
                </div>
                {(filtered || startDate || endDate) && (
                    <button onClick={clearFilters} className="px-3 py-2.5 text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text text-sm">
                        Clear filters
                    </button>
                )}
                <button onClick={downloadCsv} title="Download CSV" className="ml-auto flex items-center gap-2 px-3 py-2 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-all">
                    <FiDownload size={16} />
                </button>
            </div>

            {/* Range summary */}
            {rangeSummary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    {[
                        ['Opening', rangeSummary.openingBalance],
                        ['Money in', rangeSummary.totalIn, 'text-d-green'],
                        ['Money out', rangeSummary.totalOut, 'text-d-red'],
                        ['Net', rangeSummary.net],
                        ['Closing', rangeSummary.closingBalance],
                    ].map(([label, v, cls]) => (
                        <div key={label} className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl px-4 py-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-d-faint">{label}</p>
                            <p className={`font-bold font-display ${cls || ((Number(v) || 0) < 0 ? 'text-d-red' : 'text-slate-800 dark:text-d-heading')}`}>{fmt(v)}</p>
                        </div>
                    ))}
                    {rangeSummary.type && (
                        <p className="col-span-2 md:col-span-5 text-[12px] text-slate-500 dark:text-d-muted">
                            {entryTypeLabel(rangeSummary.type.type)}: {rangeSummary.type.entryCount} entries · in {fmt(rangeSummary.type.totalIn)} · out {fmt(rangeSummary.type.totalOut)}
                        </p>
                    )}
                </div>
            )}

            <ErrorBox>{error}</ErrorBox>

            <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl overflow-hidden mt-2">
                {loading ? (
                    <Spinner />
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                        <FiInbox size={40} className="mb-3 opacity-40" />
                        <p className="text-lg font-medium">No entries</p>
                        <p className="text-sm mt-1">{filtered || startDate || endDate ? 'Nothing matches these filters' : 'Money movements will appear here'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {filtered && (
                            <p className="px-4 py-2 text-[12px] text-slate-500 dark:text-d-muted bg-slate-50 dark:bg-d-elevated border-b border-slate-100 dark:border-d-border">
                                Filtered list: running balance hidden. Day opening / closing still count every entry.
                            </p>
                        )}
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-d-border bg-slate-50 dark:bg-d-elevated">
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">#</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Time</th>
                                    {isAll && <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Account</th>}
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Type</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Description</th>
                                    <th className="text-right px-4 py-3 font-semibold text-d-green">In</th>
                                    <th className="text-right px-4 py-3 font-semibold text-d-red">Out</th>
                                    {showBalance && <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Balance</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((g) => (
                                    <React.Fragment key={g.key}>
                                        <tr className="bg-slate-100/80 dark:bg-d-elevated border-b border-slate-200 dark:border-d-border">
                                            <td colSpan={labelSpan} className="px-4 py-2.5 font-semibold text-slate-700 dark:text-d-heading text-sm">
                                                {g.date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                            </td>
                                            {g.summary ? (
                                                <>
                                                    <td colSpan={showBalance ? 2 : 1} className="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-d-muted font-medium">Opening</td>
                                                    {balanceCell(g.summary.openingBalance)}
                                                </>
                                            ) : (
                                                <td colSpan={showBalance ? 3 : 2} />
                                            )}
                                        </tr>
                                        {g.entries.map((e) => {
                                            const d = new Date(e.effectiveDate || e.createdAt);
                                            const isTransferLeg = e.type === 'transfer_out' || e.type === 'transfer_in';
                                            const pendingCheque = e.chequeStatus === 'pending';
                                            return (
                                                <tr key={e._id} className="border-b border-slate-50 dark:border-d-border/50 hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                                                    <td className="px-4 py-3 text-slate-400 dark:text-d-faint">{e.entryNumber}</td>
                                                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-d-faint whitespace-nowrap">{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                                                    {isAll && (
                                                        <td className="px-4 py-3">
                                                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-d-elevated text-slate-600 dark:text-d-text whitespace-nowrap">
                                                                {e.account?.name || '—'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${ENTRY_TYPE_COLORS[e.type] || 'bg-slate-100 text-slate-600'}`}>
                                                            {entryTypeLabel(e.type)}
                                                        </span>
                                                        {e.chequeStatus && (
                                                            <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-d-elevated text-slate-500 dark:text-d-muted">
                                                                cheque {e.chequeStatus}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-slate-700 dark:text-d-text">{e.description}</p>
                                                        {isTransferLeg && e.counterAccount?.name && (
                                                            <p className="text-xs text-indigo-600 dark:text-indigo-400">
                                                                {e.type === 'transfer_out' ? `→ To: ${e.counterAccount.name}` : `← From: ${e.counterAccount.name}`}
                                                            </p>
                                                        )}
                                                        {e.referenceNumber && e.referenceNumber !== e.description && (
                                                            <p className="text-xs text-slate-400 dark:text-d-faint">{e.referenceNumber}</p>
                                                        )}
                                                        {e.type === 'adjustment' && e.reason && (
                                                            <p className="text-xs text-slate-500 dark:text-d-muted">Reason: {e.reason}</p>
                                                        )}
                                                        {e.note && <p className="text-xs text-slate-400 dark:text-d-faint italic">{e.note}</p>}
                                                        <p className="text-xs text-slate-400 dark:text-d-faint">
                                                            {e.performedBy ? `by ${e.performedBy}` : ''}
                                                            {canTransfer && isTransferLeg && e.transferId && !e.reversalOf && (
                                                                <button
                                                                    onClick={() => onReverseTransfer?.(e)}
                                                                    className="ml-2 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline print:hidden"
                                                                >
                                                                    <FiCornerUpLeft size={11} /> Reverse
                                                                </button>
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-medium text-d-green ${pendingCheque ? 'opacity-50' : ''}`}>
                                                        {e.direction === 'in' ? fmt(e.amount) : ''}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-medium text-d-red ${pendingCheque ? 'opacity-50' : ''}`}>
                                                        {e.direction === 'out' ? fmt(e.amount) : ''}
                                                    </td>
                                                    {showBalance && (
                                                        <td className={`px-4 py-3 text-right font-bold ${(Number(e.balanceAfter) || 0) < 0 ? 'text-d-red' : 'text-slate-800 dark:text-d-heading'}`}>
                                                            {fmt(e.balanceAfter)}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                        {g.summary && (
                                            <tr className="bg-slate-100 dark:bg-d-elevated border-b-2 border-slate-200 dark:border-d-border">
                                                <td colSpan={labelSpan} className="px-4 py-2.5 text-xs text-slate-500 dark:text-d-muted">
                                                    {g.summary.entryCount} entries · in {fmt(g.summary.totalIn)} · out {fmt(g.summary.totalOut)}
                                                </td>
                                                <td colSpan={showBalance ? 2 : 1} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 dark:text-d-text">Closing</td>
                                                {balanceCell(g.summary.closingBalance, 'font-bold')}
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pager pagination={pagination} onPage={fetchPage} />
            </div>
        </div>
    );
};

export default EntriesTable;
