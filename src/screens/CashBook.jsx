import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-icons/fi';

const TYPE_LABELS = {
    opening_balance: 'Opening Balance',
    manual_deposit: 'Deposit',
    manual_withdrawal: 'Withdrawal',
    sale_collection: 'Sale Collection',
    vendor_payment: 'Vendor Payment',
    customer_refund: 'Customer Refund',
    expense: 'Expense',
};

const TYPE_COLORS = {
    opening_balance: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    manual_deposit: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    manual_withdrawal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    sale_collection: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    vendor_payment: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    customer_refund: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    expense: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const CashBook = () => {
    const { business } = useBusiness();
    const [entries, setEntries] = useState([]);
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

    const currency = business?.currency || 'Rs.';
    const formatCurrency = (amt) =>
        `${currency} ${Math.abs(amt || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

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

        const groups = [];
        let currentDate = null;
        let currentGroup = null;

        // Entries come sorted newest first from backend
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

        // Calculate opening/closing for each day group
        // Entries are oldest-first within each group
        groups.forEach((g) => {
            // Opening balance = balance before the first entry of the day
            const first = g.entries[0];
            g.openingBalance = first.direction === 'in'
                ? first.runningBalance - first.amount
                : first.runningBalance + first.amount;
            // Closing balance = running balance of the last entry of the day
            g.closingBalance = g.entries[g.entries.length - 1].runningBalance;
        });

        return groups;
    }, [filteredEntries]);

    // =========================================================================
    // Modal submit
    // =========================================================================

    const submitModal = async (e) => {
        e.preventDefault();
        const amount = parseFloat(modalForm.amount);
        if (!amount || amount <= 0) {
            alert('Enter a valid amount');
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
            handleRefresh();
        } catch (err) {
            alert(err.response?.data?.message || 'Operation failed');
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
        <div className="h-full flex flex-col bg-slate-50 dark:bg-d-bg overflow-auto print:overflow-visible">
            <div className="flex-1 p-6 max-w-7xl mx-auto w-full">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 print:mb-2">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Cash Book</h1>
                        <p className="text-slate-500 dark:text-d-muted">Track all cash movements in your business</p>
                    </div>
                    <div className="flex items-center gap-2 print:hidden">
                        <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-all">
                            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={downloadCsv} className="flex items-center gap-2 px-3 py-2 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-all">
                            <FiDownload size={16} />
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-all">
                            <FiPrinter size={16} />
                        </button>
                    </div>
                </div>

                {/* Balance + Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2">
                    {/* Current Balance */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5 sm:col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(52,232,161,0.15)] rounded-xl flex items-center justify-center">
                                <FiInbox className="text-d-green" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Cash in Hand</span>
                        </div>
                        <p className={`text-2xl font-bold font-display ${balance >= 0 ? 'text-d-green' : 'text-d-red'}`}>
                            {formatCurrency(balance)}
                        </p>
                    </div>

                    {/* Today Cash In */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(52,232,161,0.1)] rounded-xl flex items-center justify-center">
                                <FiArrowDownCircle className="text-d-green" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Today In</span>
                        </div>
                        <p className="text-xl font-bold text-d-green font-display">{formatCurrency(todayIn)}</p>
                    </div>

                    {/* Today Cash Out */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(255,107,107,0.1)] rounded-xl flex items-center justify-center">
                                <FiArrowUpCircle className="text-d-red" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Today Out</span>
                        </div>
                        <p className="text-xl font-bold text-d-red font-display">{formatCurrency(todayOut)}</p>
                    </div>

                    {/* Today Net */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(91,156,246,0.1)] rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-d-blue" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Today Net</span>
                        </div>
                        <p className={`text-xl font-bold font-display ${(todayIn - todayOut) >= 0 ? 'text-d-green' : 'text-d-red'}`}>
                            {(todayIn - todayOut) >= 0 ? '+' : '-'}{formatCurrency(todayIn - todayOut)}
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mb-6 print:hidden">
                    <button
                        onClick={() => { setShowModal('opening'); setModalForm({ amount: '', note: '', description: '' }); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                        <FiDollarSign size={16} /> Set Opening Balance
                    </button>
                    <button
                        onClick={() => { setShowModal('deposit'); setModalForm({ amount: '', note: '', description: '' }); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                        <FiPlus size={16} /> Deposit Cash
                    </button>
                    <button
                        onClick={() => { setShowModal('withdraw'); setModalForm({ amount: '', note: '', description: '' }); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                        <FiMinus size={16} /> Withdraw Cash
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
                    <div className="relative flex-1 max-w-xs">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search entries..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint focus:outline-none focus:border-d-border-hover text-sm"
                        />
                    </div>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text text-sm focus:outline-none"
                    >
                        <option value="all">All Types</option>
                        <option value="opening_balance">Opening Balance</option>
                        <option value="manual_deposit">Deposits</option>
                        <option value="manual_withdrawal">Withdrawals</option>
                        <option value="sale_collection">Sale Collections</option>
                        <option value="vendor_payment">Vendor Payments</option>
                        <option value="customer_refund">Customer Refunds</option>
                        <option value="expense">Expenses</option>
                    </select>

                    <div className="flex items-center gap-2">
                        <FiCalendar className="text-slate-400 dark:text-d-faint" size={16} />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text text-sm focus:outline-none"
                        />
                        <span className="text-slate-400 dark:text-d-faint text-sm">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text text-sm focus:outline-none"
                        />
                    </div>

                    {(startDate || endDate || typeFilter !== 'all') && (
                        <button
                            onClick={() => { setStartDate(''); setEndDate(''); setTypeFilter('all'); }}
                            className="px-3 py-2.5 text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text text-sm"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Ledger Table */}
                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-4 border-primary-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                            <FiInbox size={40} className="mb-3 opacity-40" />
                            <p className="text-lg font-medium">No entries yet</p>
                            <p className="text-sm mt-1">Set your opening balance to get started</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-d-border bg-slate-50 dark:bg-d-elevated">
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">#</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Time</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Type</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Description</th>
                                        <th className="text-right px-4 py-3 font-semibold text-d-green">Cash In</th>
                                        <th className="text-right px-4 py-3 font-semibold text-d-red">Cash Out</th>
                                        <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-d-muted">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedByDay.map((group) => (
                                        <React.Fragment key={group.dateKey}>
                                            {/* Day header with opening balance */}
                                            <tr className="bg-slate-100/80 dark:bg-d-elevated border-b border-slate-200 dark:border-d-border">
                                                <td colSpan={4} className="px-4 py-2.5">
                                                    <span className="font-semibold text-slate-700 dark:text-d-heading text-sm">
                                                        {group.date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </span>
                                                </td>
                                                <td colSpan={2} className="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-d-muted font-medium">
                                                    Opening Balance
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-d-heading text-sm">
                                                    {formatCurrency(group.openingBalance)}
                                                </td>
                                            </tr>

                                            {/* Day entries */}
                                            {group.entries.map((entry) => {
                                                const d = new Date(entry.createdAt);
                                                return (
                                                    <tr key={entry._id} className="border-b border-slate-50 dark:border-d-border/50 hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                                                        <td className="px-4 py-3 text-slate-400 dark:text-d-faint">{entry.entryNumber}</td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-xs text-slate-400 dark:text-d-faint">{d.toLocaleTimeString()}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${TYPE_COLORS[entry.type] || 'bg-slate-100 text-slate-600'}`}>
                                                                {TYPE_LABELS[entry.type] || entry.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-slate-700 dark:text-d-text">{entry.description}</p>
                                                            {entry.referenceNumber && (
                                                                <p className="text-xs text-slate-400 dark:text-d-faint">{entry.referenceNumber}</p>
                                                            )}
                                                            {entry.note && (
                                                                <p className="text-xs text-slate-400 dark:text-d-faint italic">{entry.note}</p>
                                                            )}
                                                            {entry.performedBy && (
                                                                <p className="text-xs text-slate-400 dark:text-d-faint">by {entry.performedBy}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-d-green">
                                                            {entry.direction === 'in' ? formatCurrency(entry.amount) : ''}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-d-red">
                                                            {entry.direction === 'out' ? formatCurrency(entry.amount) : ''}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-d-heading">
                                                            {formatCurrency(entry.runningBalance)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Closing balance row */}
                                            <tr className="bg-slate-100 dark:bg-d-elevated border-b-2 border-slate-200 dark:border-d-border">
                                                <td colSpan={4} className="px-4 py-2.5"></td>
                                                <td colSpan={2} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 dark:text-d-text">
                                                    Closing Balance
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-d-heading text-sm">
                                                    {formatCurrency(group.closingBalance)}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-d-border">
                            <p className="text-sm text-slate-500 dark:text-d-muted">
                                Page {pagination.page} of {pagination.pages} ({pagination.total} entries)
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={pagination.page <= 1}
                                    onClick={() => fetchEntries(pagination.page - 1)}
                                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => fetchEntries(pagination.page + 1)}
                                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Modal: Opening Balance / Deposit / Withdraw                */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-d-card rounded-2xl w-full max-w-md border border-slate-200 dark:border-d-border shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-d-border">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-d-heading">
                                {showModal === 'opening' ? 'Set Opening Balance' :
                                 showModal === 'deposit' ? 'Deposit Cash' : 'Withdraw Cash'}
                            </h2>
                            <button onClick={() => setShowModal(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:text-d-faint dark:hover:text-d-text rounded-lg hover:bg-slate-100 dark:hover:bg-d-glass">
                                <FiX size={18} />
                            </button>
                        </div>

                        <form onSubmit={submitModal} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-1.5">
                                    Amount (Rs)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={modalForm.amount}
                                    onChange={(e) => setModalForm(f => ({ ...f, amount: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text text-lg font-bold focus:outline-none focus:border-d-accent"
                                    placeholder="0.00"
                                    autoFocus
                                    required
                                />
                            </div>

                            {showModal !== 'opening' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-1.5">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={modalForm.description}
                                        onChange={(e) => setModalForm(f => ({ ...f, description: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text focus:outline-none focus:border-d-border-hover text-sm"
                                        placeholder={showModal === 'deposit' ? 'e.g. Cash from bank' : 'e.g. Bank deposit'}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-1.5">
                                    Note (optional)
                                </label>
                                <textarea
                                    value={modalForm.note}
                                    onChange={(e) => setModalForm(f => ({ ...f, note: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text focus:outline-none focus:border-d-border-hover text-sm resize-none"
                                    rows={2}
                                    placeholder="Any additional notes..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(null)}
                                    className="flex-1 py-2.5 text-sm font-medium text-slate-600 dark:text-d-muted bg-slate-100 dark:bg-d-elevated rounded-xl hover:bg-slate-200 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-60 ${
                                        showModal === 'withdraw' ? 'bg-orange-500 hover:bg-orange-600' :
                                        'bg-emerald-500 hover:bg-emerald-600'
                                    }`}
                                >
                                    {submitting ? 'Processing...' :
                                     showModal === 'opening' ? 'Set Balance' :
                                     showModal === 'deposit' ? 'Deposit' : 'Withdraw'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashBook;
