import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { cn, Spinner, EmptyState, StatusChip, TablePager, TABLE_CARD, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD, TABLE_GROUP_ROW, TABLE_GROUP_TD, TABLE_SCROLL, TableScroll } from '../components/ui';
import { getStatus } from '../utils/statusTones';
import { PageHeader } from '../components/ui/PageHeader';
import { DialogShell } from '../components/ui/Dialog';
import { useBusiness } from '../context/BusinessContext';
import { getCashBook, getCashBalance, setOpeningBalance, manualDeposit, manualWithdraw } from '../services/api/cashbook';
import {
    FiDollarSign,
    FiArrowDownCircle,
    FiArrowUpCircle,
    FiPlus,
    FiMinus,
    FiX,
    FiCalendar,
    FiFilter,
    FiRefreshCw,
    FiDownload,
    FiPrinter,
    FiInbox,
    FiSearch,
    FiAlertCircle,
} from 'react-icons/fi';

const TYPE_LABELS = {
    opening_balance: 'Opening Balance',
    manual_deposit: 'Deposit',
    manual_withdrawal: 'Withdrawal',
    sale_collection: 'Sale Collection',
    vendor_payment: 'Vendor Payment',
    customer_refund: 'Customer Refund',
    sale_cancel: 'Bill Cancelled',
    expense: 'Expense',
    expense_reversal: 'Expense reversed',
};

const TYPE_COLORS = {
    opening_balance: 'bg-info-chip text-info',
    manual_deposit: 'bg-success-chip text-success',
    manual_withdrawal: 'bg-warning-chip text-warning-chip-foreground',
    sale_collection: 'bg-success-chip text-success',
    vendor_payment: 'bg-destructive-chip text-destructive',
    customer_refund: 'bg-destructive-chip text-destructive',
    sale_cancel: 'bg-muted text-foreground',
    expense: 'bg-accent text-primary',
    expense_reversal: 'bg-success-chip text-success',
};

const CashBook = () => {
    const { business } = useBusiness();
    const [entries, setEntries] = useState([]);
    const [dailySummary, setDailySummary] = useState([]);
    const [balance, setBalance] = useState(0);
    const [todayIn, setTodayIn] = useState(0);
    const [todayOut, setTodayOut] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

    // Filters
    const [typeFilter, setTypeFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showModal, setShowModal] = useState(null); // 'opening' | 'deposit' | 'withdraw'
    const [modalForm, setModalForm] = useState({ amount: '', note: '', description: '' });
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    const currency = business?.currency || 'Rs.';
    const formatCurrency = (amt) => {
        const v = amt || 0;
        return `${v < 0 ? '-' : ''}${currency} ${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    };

    // =========================================================================
    // Data fetching
    // =========================================================================

    const fetchBalance = useCallback(async () => {
        try {
            const res = await getCashBalance();
            setBalance(res.data?.balance ?? 0);
            setTodayIn(res.data?.today?.totalIn ?? 0);
            setTodayOut(res.data?.today?.totalOut ?? 0);
        } catch (err) {
            console.error('Error fetching balance:', err);
        }
    }, []);

    const fetchEntries = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 50 };
            if (typeFilter !== 'all') params.type = typeFilter;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const res = await getCashBook(params);
            setEntries(res.data?.entries || []);
            setDailySummary(res.data?.dailySummary || []);
            setPagination(res.data?.pagination || { page: 1, pages: 1, total: 0 });
        } catch (err) {
            console.error('Error fetching cashbook:', err);
        } finally {
            setLoading(false);
        }
    }, [typeFilter, startDate, endDate]);

    useEffect(() => {
        fetchBalance();
        fetchEntries(1);
    }, [fetchBalance, fetchEntries]);

    const handleRefresh = () => {
        fetchBalance();
        fetchEntries(1);
    };

    // =========================================================================
    // Filtered entries (client-side search on top of server-side filters)
    // =========================================================================

    const filteredEntries = useMemo(() => {
        if (!searchQuery.trim()) return entries;
        const q = searchQuery.toLowerCase();
        return entries.filter(e =>
            (e.description || '').toLowerCase().includes(q) ||
            (e.referenceNumber || '').toLowerCase().includes(q) ||
            (e.note || '').toLowerCase().includes(q) ||
            (e.performedBy || '').toLowerCase().includes(q) ||
            String(e.entryNumber || '').includes(q)
        );
    }, [entries, searchQuery]);

    // =========================================================================
    // Group entries by day with opening/closing balances
    // =========================================================================

    const groupedByDay = useMemo(() => {
        if (filteredEntries.length === 0) return [];

        // Build a lookup from dailySummary by date string (YYYY-MM-DD)
        const summaryMap = {};
        dailySummary.forEach((ds) => {
            summaryMap[ds.date] = ds;
        });

        const groups = [];
        let currentDate = null;
        let currentGroup = null;

        filteredEntries.forEach((entry) => {
            const d = new Date(entry.createdAt);
            const dateKey = d.toLocaleDateString();

            if (dateKey !== currentDate) {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = { dateKey, date: d, entries: [], openingBalance: 0, closingBalance: 0 };
                currentDate = dateKey;
            }
            currentGroup.entries.push(entry);
        });
        if (currentGroup) groups.push(currentGroup);

        // Use dailySummary for opening/closing balances
        groups.forEach((g) => {
            const isoDate = g.date.toISOString().slice(0, 10);
            const ds = summaryMap[isoDate];
            if (ds) {
                g.openingBalance = ds.openingBalance;
                g.closingBalance = ds.closingBalance;
            } else {
                // Fallback: calculate from entries
                const first = g.entries[0];
                g.openingBalance = first.direction === 'in'
                    ? first.runningBalance - first.amount
                    : first.runningBalance + first.amount;
                g.closingBalance = g.entries[g.entries.length - 1].runningBalance;
            }
        });

        return groups;
    }, [filteredEntries, dailySummary]);

    // =========================================================================
    // Modal submit
    // =========================================================================

    const submitModal = async (e) => {
        e.preventDefault();
        setModalError('');
        const amount = parseFloat(modalForm.amount);
        if (!amount || amount <= 0) {
            setModalError('Enter a valid amount');
            return;
        }

        if (showModal === 'withdraw' && amount > balance) {
            setModalError(`Insufficient cash. Available balance: ${formatCurrency(balance)}`);
            return;
        }

        setSubmitting(true);
        try {
            if (showModal === 'opening') {
                await setOpeningBalance({ amount, note: modalForm.note });
            } else if (showModal === 'deposit') {
                await manualDeposit({ amount, note: modalForm.note, description: modalForm.description });
            } else if (showModal === 'withdraw') {
                await manualWithdraw({ amount, note: modalForm.note, description: modalForm.description });
            }
            setShowModal(null);
            setModalForm({ amount: '', note: '', description: '' });
            setModalError('');
            handleRefresh();
        } catch (err) {
            setModalError(err.response?.data?.message || 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    // =========================================================================
    // CSV Download
    // =========================================================================

    const downloadCsv = () => {
        const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
        const lines = [
            ['Cash Book Report'],
            ['Generated', new Date().toLocaleString()],
            ['Current Balance', balance],
            [],
            ['Entry #', 'Date', 'Time', 'Type', 'Description', 'Reference', 'Cash In', 'Cash Out', 'Balance', 'By', 'Note'],
            ...filteredEntries.map(e => {
                const d = new Date(e.createdAt);
                return [
                    e.entryNumber,
                    d.toLocaleDateString(),
                    d.toLocaleTimeString(),
                    TYPE_LABELS[e.type] || e.type,
                    e.description,
                    e.referenceNumber,
                    e.direction === 'in' ? e.amount : '',
                    e.direction === 'out' ? e.amount : '',
                    e.runningBalance,
                    e.performedBy,
                    e.note,
                ];
            }),
        ];

        const csv = lines.map(r => r.map(c => `"${esc(c)}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cashbook-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        const html = document.documentElement;
        const wasDark = html.classList.contains('dark');
        if (wasDark) html.classList.remove('dark');
        setTimeout(() => {
            window.print();
            if (wasDark) html.classList.add('dark');
        }, 100);
    };

    // =========================================================================
    // Render
    // =========================================================================

    return (
        <div className="h-full flex flex-col overflow-auto print:overflow-visible">
            <div className="flex-1 p-6 max-w-7xl mx-auto w-full">

                {/* Header */}
                <PageHeader
                    title={<>Cash Book</>}
                    subtitle={<>Track all cash movements in your business</>}
                    actions={
                        <>
                            <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:bg-[var(--hover-overlay)] rounded-xl transition-all">
                            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={downloadCsv} className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:bg-[var(--hover-overlay)] rounded-xl transition-all">
                            <FiDownload size={16} />
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:bg-[var(--hover-overlay)] rounded-xl transition-all">
                            <FiPrinter size={16} />
                        </button>
                        </>
                    }
                />

                {/* Balance + Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2">
                    {/* Current Balance */}
                    <div className="bg-card border border-hairline rounded-2xl p-5 sm:col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-success-chip rounded-xl flex items-center justify-center">
                                <FiInbox className="text-success" size={20} />
                            </div>
                            <span className="text-muted-foreground text-sm">Cash in Hand</span>
                        </div>
                        <p className={`text-2xl font-bold font-display ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(balance)}
                        </p>
                    </div>

                    {/* Today Cash In */}
                    <div className="bg-card border border-hairline rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-success-chip rounded-xl flex items-center justify-center">
                                <FiArrowDownCircle className="text-success" size={20} />
                            </div>
                            <span className="text-muted-foreground text-sm">Today In</span>
                        </div>
                        <p className="text-xl font-bold text-success font-display">{formatCurrency(todayIn)}</p>
                    </div>

                    {/* Today Cash Out */}
                    <div className="bg-card border border-hairline rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-destructive-chip rounded-xl flex items-center justify-center">
                                <FiArrowUpCircle className="text-destructive" size={20} />
                            </div>
                            <span className="text-muted-foreground text-sm">Today Out</span>
                        </div>
                        <p className="text-xl font-bold text-destructive font-display">{formatCurrency(todayOut)}</p>
                    </div>

                    {/* Today Net */}
                    <div className="bg-card border border-hairline rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-info-chip rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-info" size={20} />
                            </div>
                            <span className="text-muted-foreground text-sm">Today Net</span>
                        </div>
                        <p className={`text-xl font-bold font-display ${(todayIn - todayOut) >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {(todayIn - todayOut) >= 0 ? '+' : '-'}{formatCurrency(Math.abs(todayIn - todayOut))}
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mb-6 print:hidden">
                    <button
                        onClick={() => { setShowModal('opening'); setModalForm({ amount: '', note: '', description: '' }); setModalError(''); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-info hover:bg-info/90 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                        <FiDollarSign size={16} /> Set Opening Balance
                    </button>
                    <button
                        onClick={() => { setShowModal('deposit'); setModalForm({ amount: '', note: '', description: '' }); setModalError(''); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-success hover:bg-success/90 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                        <FiPlus size={16} /> Deposit Cash
                    </button>
                    <button
                        onClick={() => { setShowModal('withdraw'); setModalForm({ amount: '', note: '', description: '' }); setModalError(''); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-warning hover:bg-warning/90 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                        <FiMinus size={16} /> Withdraw Cash
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
                    <div className="relative flex-1 max-w-xs">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search entries..."
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-hairline rounded-xl text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary/45 text-sm"
                        />
                    </div>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2.5 bg-card border border-hairline rounded-xl text-foreground text-sm focus:outline-none"
                    >
                        <option value="all">All Types</option>
                        <option value="opening_balance">Opening Balance</option>
                        <option value="manual_deposit">Deposits</option>
                        <option value="manual_withdrawal">Withdrawals</option>
                        <option value="sale_collection">Sale Collections</option>
                        <option value="vendor_payment">Vendor Payments</option>
                        <option value="customer_refund">Customer Refunds</option>
                        <option value="sale_cancel">Bills Cancelled</option>
                        <option value="expense">Expenses</option>
                        <option value="expense_reversal">Expenses Reversed</option>
                    </select>

                    <div className="flex items-center gap-2">
                        <FiCalendar className="text-muted-foreground" size={16} />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2.5 bg-card border border-hairline rounded-xl text-foreground text-sm focus:outline-none"
                        />
                        <span className="text-muted-foreground text-sm">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2.5 bg-card border border-hairline rounded-xl text-foreground text-sm focus:outline-none"
                        />
                    </div>

                    {(startDate || endDate || typeFilter !== 'all') && (
                        <button
                            onClick={() => { setStartDate(''); setEndDate(''); setTypeFilter('all'); }}
                            className="px-3 py-2.5 text-muted-foreground hover:text-foreground text-sm"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Ledger Table */}
                <section className={TABLE_CARD} aria-label="Cash book entries">
                    {loading ? (
                        <TableSkeleton toolbar={false} columns={6} className="border-0 shadow-none rounded-none" />
                    ) : filteredEntries.length === 0 ? (
                        <EmptyState icon={FiInbox} title="No entries yet">
                            Set your opening balance to get started.
                        </EmptyState>
                    ) : (
                        <TableScroll>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className={TABLE_HEAD_ROW}>
                                        <th className={TABLE_TH}>#</th>
                                        <th className={TABLE_TH}>Time</th>
                                        <th className={TABLE_TH}>Type</th>
                                        <th className={TABLE_TH}>Description</th>
                                        <th className={cn(TABLE_TH, 'text-right')}>Cash In</th>
                                        <th className={cn(TABLE_TH, 'text-right')}>Cash Out</th>
                                        <th className={cn(TABLE_TH, 'text-right')}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedByDay.map((group) => (
                                        <React.Fragment key={group.dateKey}>
                                            {/* Day header with opening balance */}
                                            <tr className={TABLE_GROUP_ROW}>
                                                <td colSpan={4} className={TABLE_GROUP_TD}>
                                                    <span className="font-semibold text-foreground text-body">
                                                        {group.date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </span>
                                                </td>
                                                <td colSpan={2} className={cn(TABLE_GROUP_TD, 'text-right')}>
                                                    Opening Balance
                                                </td>
                                                <td className={cn(TABLE_GROUP_TD, 'text-right tabular-nums font-semibold', group.openingBalance < 0 ? 'text-destructive' : 'text-foreground')}>
                                                    {formatCurrency(group.openingBalance)}
                                                </td>
                                            </tr>

                                            {/* Day entries */}
                                            {group.entries.map((entry) => {
                                                const d = new Date(entry.createdAt);
                                                return (
                                                    <tr key={entry._id} className={TABLE_ROW}>
                                                        <td className={cn(TABLE_TD, 'font-mono text-mono-sm text-muted-foreground')}>{entry.entryNumber}</td>
                                                        <td className={cn(TABLE_TD, 'text-muted-foreground whitespace-nowrap')}>
                                                            <p>{d.toLocaleTimeString()}</p>
                                                        </td>
                                                        <td className={TABLE_TD}>
                                                            <StatusChip size="sm" shape="tag" tone={getStatus('entry', entry.type)?.tone || 'neutral'} label={TYPE_LABELS[entry.type] || entry.type} />
                                                        </td>
                                                        <td className={cn(TABLE_TD, 'py-2')}>
                                                            <p>{entry.description}</p>
                                                            {entry.referenceNumber && (
                                                                <p className="font-mono text-mono-xs text-muted-foreground">{entry.referenceNumber}</p>
                                                            )}
                                                            {entry.note && (
                                                                <p className="text-body-sm text-muted-foreground italic">{entry.note}</p>
                                                            )}
                                                            {entry.performedBy && (
                                                                <p className="text-body-sm text-muted-foreground">by {entry.performedBy}</p>
                                                            )}
                                                        </td>
                                                        <td className={cn(TABLE_TD, 'text-right tabular-nums font-medium text-success')}>
                                                            {entry.direction === 'in' ? formatCurrency(entry.amount) : ''}
                                                        </td>
                                                        <td className={cn(TABLE_TD, 'text-right tabular-nums font-medium text-destructive')}>
                                                            {entry.direction === 'out' ? formatCurrency(entry.amount) : ''}
                                                        </td>
                                                        <td className={cn(TABLE_TD, 'text-right tabular-nums font-semibold', entry.runningBalance < 0 && 'text-destructive')}>
                                                            {formatCurrency(entry.runningBalance)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Closing balance row */}
                                            <tr className={cn(TABLE_GROUP_ROW, 'shadow-[inset_0_-1px_0_var(--border)]')}>
                                                <td colSpan={4} className={TABLE_GROUP_TD}></td>
                                                <td colSpan={2} className={cn(TABLE_GROUP_TD, 'text-right font-semibold text-foreground')}>
                                                    Closing Balance
                                                </td>
                                                <td className={cn(TABLE_GROUP_TD, 'text-right tabular-nums font-semibold', group.closingBalance < 0 ? 'text-destructive' : 'text-foreground')}>
                                                    {formatCurrency(group.closingBalance)}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </TableScroll>
                    )}

                    {pagination.pages > 1 && (
                        <TablePager
                            page={pagination.page}
                            pageSize={pagination.limit || Math.ceil((pagination.total || 0) / pagination.pages) || 50}
                            total={pagination.total || 0}
                            onPageChange={fetchEntries}
                            noun="entries"
                        />
                    )}
                </section>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Modal: Opening Balance / Deposit / Withdraw                */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {showModal && (
                <DialogShell size="md" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b border-hairline">
                            <h2 className="text-lg font-bold text-foreground">
                                {showModal === 'opening' ? 'Set Opening Balance' :
                                 showModal === 'deposit' ? 'Deposit Cash' : 'Withdraw Cash'}
                            </h2>
                            <button data-dialog-close onClick={() => setShowModal(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-[var(--hover-overlay)]">
                                <FiX size={18} />
                            </button>
                        </div>

                        <form onSubmit={submitModal} className="p-5 space-y-4">
                            {modalError && (
                                <div className="flex items-center gap-2 p-3 bg-destructive-chip border border-destructive/30 rounded-xl">
                                    <FiAlertCircle className="text-destructive flex-shrink-0" size={14} />
                                    <span className="text-xs text-destructive font-medium">{modalError}</span>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                                    Amount (Rs)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={modalForm.amount}
                                    onChange={(e) => setModalForm(f => ({ ...f, amount: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/40 border border-hairline rounded-xl text-foreground text-lg font-bold focus:outline-none focus:border-primary"
                                    placeholder="0.00"
                                    autoFocus
                                    required
                                />
                            </div>

                            {showModal !== 'opening' && (
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={modalForm.description}
                                        onChange={(e) => setModalForm(f => ({ ...f, description: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-hairline rounded-xl text-foreground focus:outline-none focus:border-primary/45 text-sm"
                                        placeholder={showModal === 'deposit' ? 'e.g. Cash from bank' : 'e.g. Bank deposit'}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                                    Note (optional)
                                </label>
                                <textarea
                                    value={modalForm.note}
                                    onChange={(e) => setModalForm(f => ({ ...f, note: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-hairline rounded-xl text-foreground focus:outline-none focus:border-primary/45 text-sm resize-none"
                                    rows={2}
                                    placeholder="Any additional notes..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(null)}
                                    className="flex-1 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-xl hover:bg-[var(--hover-overlay)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-60 ${
                                        showModal === 'withdraw' ? 'bg-warning hover:bg-warning/90' :
                                        'bg-success hover:bg-success/90'
                                    }`}
                                >
                                    {submitting ? 'Processing...' :
                                     showModal === 'opening' ? 'Set Balance' :
                                     showModal === 'deposit' ? 'Deposit' : 'Withdraw'}
                                </button>
                            </div>
                        </form>
                    </DialogShell>
            )}
        </div>
    );
};

export default CashBook;
