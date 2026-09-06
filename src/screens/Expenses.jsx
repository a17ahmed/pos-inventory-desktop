import React, { useState, useEffect } from 'react';
import { todayLocalDate, toLocalDateStr } from '../utils/date';
import { useBusiness } from '../context/BusinessContext';
import { getExpenses, getExpenseStats, createExpense, updateExpense, deleteExpense, approveExpense, rejectExpense } from '../services/api/expenses';
import { getCashBalance } from '../services/api/cashbook';
import { appAlert, appConfirm } from '../components/AppDialog';
import {
    FiPlus,
    FiSearch,
    FiDollarSign,
    FiCalendar,
    FiEdit2,
    FiTrash2,
    FiCheck,
    FiX,
    FiSave,
    FiClock,
    FiCheckCircle,
    FiXCircle,
} from 'react-icons/fi';

const CATEGORIES = [
    { value: 'rent', label: 'Rent' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'supplies', label: 'Supplies' },
    { value: 'wages', label: 'Wages' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'transport', label: 'Transport' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'taxes', label: 'Taxes' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'bank_fees', label: 'Bank Fees' },
    { value: 'other', label: 'Other' },
];

const Expenses = () => {
    const { business } = useBusiness();
    const [expenses, setExpenses] = useState([]); // current page only
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [stats, setStats] = useState({ totalExpenses: 0, monthExpenses: 0, pendingCount: 0, pendingTotal: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [rejectModal, setRejectModal] = useState({ show: false, expenseId: null, reason: '' });
    const [submitting, setSubmitting] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [cashBalance, setCashBalance] = useState(null);
    const [approvingId, setApprovingId] = useState(null);
    const [formData, setFormData] = useState({
        category: 'supplies',
        amount: '',
        description: '',
        date: todayLocalDate(),
        paymentMethod: 'cash',
        notes: '',
    });

    // Debounced: re-query page 1 whenever the status filter or search text changes.
    useEffect(() => {
        const t = setTimeout(() => fetchExpenses(1), 300);
        return () => clearTimeout(t);
    }, [statusFilter, searchQuery]);

    useEffect(() => {
        fetchStats();
    }, []);

    // List: one page at a time (limit ≤ 100), only the current page held in state.
    const fetchExpenses = async (pageNum = 1) => {
        setLoading(true);
        setError(null);
        try {
            const params = { page: pageNum, limit: 50 };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();
            const res = await getExpenses(params);
            const data = res.data;
            const list = Array.isArray(data)
                ? data
                : (Array.isArray(data?.expenses) ? data.expenses : []);
            setExpenses(list);
            setPagination({
                page: data?.page ?? pageNum,
                totalPages: data?.totalPages ?? 1,
                total: data?.total ?? list.length,
            });
        } catch (err) {
            console.error('Error fetching expenses:', err);
            setError(err.response?.data?.message || 'Failed to load expenses');
            setExpenses([]);
        } finally {
            setLoading(false);
        }
    };

    // KPI cards: server-side stats (approved totals + pending count), not summed
    // from the paged list.
    const fetchStats = async () => {
        try {
            const res = await getExpenseStats();
            const d = res.data || {};
            setStats({
                totalExpenses: d.totalExpenses ?? 0,
                monthExpenses: d.monthExpenses ?? 0,
                pendingCount: d.pendingCount ?? 0,
                pendingTotal: d.pendingTotal ?? 0,
            });
        } catch (err) {
            console.error('Error fetching expense stats:', err);
        }
    };

    // Search is server-side now (?search= over description), so the current page
    // is already the filtered result — no client-side filtering.
    const filteredExpenses = Array.isArray(expenses) ? expenses : [];

    const openModal = (expense = null) => {
        if (expense) {
            setEditingExpense(expense);
            setFormData({
                category: expense.category || 'supplies',
                amount: expense.amount || '',
                description: expense.description || '',
                date: expense.date
                    ? toLocalDateStr(expense.date)
                    : todayLocalDate(),
                paymentMethod: expense.paymentMethod || 'cash',
                notes: expense.notes || '',
            });
        } else {
            setEditingExpense(null);
            setFormData({
                category: 'supplies',
                amount: '',
                description: '',
                date: todayLocalDate(),
                paymentMethod: 'cash',
                notes: '',
            });
        }
        getCashBalance().then(res => setCashBalance(res.data?.balance ?? null)).catch(() => setCashBalance(null));
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const amount = Number(formData.amount);
        if (!amount || amount <= 0) {
            return appAlert('Please enter a valid amount');
        }
        if (!formData.description?.trim()) {
            return appAlert('Please enter a description');
        }
        if (formData.paymentMethod === 'cash' && cashBalance != null && amount > cashBalance) {
            return appAlert(`Insufficient cash. Available balance: ${formatCurrency(cashBalance)}`);
        }
        setSubmitting(true);
        try {
            const data = {
                ...formData,
                amount,
            };

            if (editingExpense) {
                await updateExpense(editingExpense._id, data);
            } else {
                await createExpense(data);
            }

            setShowModal(false);
            fetchExpenses(1);
            fetchStats();
        } catch (error) {
            console.error('Error saving expense:', error);
            appAlert(error.response?.data?.message || 'Failed to save expense');
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (expenseId) => {
        setApprovingId(expenseId);
        try {
            await approveExpense(expenseId);
            fetchExpenses(pagination.page);
            fetchStats();
        } catch (error) {
            console.error('Error approving expense:', error);
            appAlert('Failed to approve expense');
        } finally {
            setApprovingId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModal.reason?.trim()) {
            return appAlert('Please enter a rejection reason');
        }
        setRejecting(true);
        try {
            await rejectExpense(rejectModal.expenseId, rejectModal.reason);
            setRejectModal({ show: false, expenseId: null, reason: '' });
            fetchExpenses(pagination.page);
            fetchStats();
        } catch (error) {
            console.error('Error rejecting expense:', error);
            appAlert('Failed to reject expense');
        } finally {
            setRejecting(false);
        }
    };

    const handleDelete = async (expenseId) => {
        if (!(await appConfirm('Are you sure you want to delete this expense?', { danger: true }))) return;

        try {
            await deleteExpense(expenseId);
            fetchExpenses(pagination.page);
            fetchStats();
        } catch (error) {
            console.error('Error deleting expense:', error);
            appAlert('Failed to delete expense');
        }
    };

    const formatCurrency = (amount) => {
        return `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved':
                return { icon: FiCheckCircle, color: 'bg-green-100 text-green-600 dark:bg-[rgba(52,232,161,0.15)] dark:text-d-green' };
            case 'rejected':
                return { icon: FiXCircle, color: 'bg-red-100 text-red-600 dark:bg-[rgba(255,107,107,0.15)] dark:text-d-red' };
            default:
                return { icon: FiClock, color: 'bg-yellow-100 text-yellow-600 dark:bg-[rgba(255,210,100,0.15)] dark:text-d-accent' };
        }
    };

    const getCategoryLabel = (value) => {
        return CATEGORIES.find((c) => c.value === value)?.label || value;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-6 bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading expenses...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full p-6 bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-[rgba(255,107,107,0.15)] rounded-full flex items-center justify-center">
                        <FiXCircle size={32} className="text-red-500 dark:text-d-red" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-d-heading">Failed to load expenses</h2>
                    <p className="text-slate-500 dark:text-d-muted">{error}</p>
                    <button
                        onClick={() => { fetchExpenses(1); fetchStats(); }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl hover:shadow-md transition-all"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 animate-fadeIn bg-slate-50 dark:bg-d-bg min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Expenses</h1>
                    <p className="text-slate-500 dark:text-d-muted">{pagination.total} expenses recorded</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all"
                >
                    <FiPlus />
                    Add Expense
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <p className="text-sm text-slate-500 dark:text-d-muted">Total Approved</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-d-green">{formatCurrency(stats.totalExpenses)}</p>
                </div>
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <p className="text-sm text-slate-500 dark:text-d-muted">Pending Approval</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-d-accent">
                        {formatCurrency(Math.round((stats.pendingTotal || 0) * 100) / 100)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-d-faint mt-1">{stats.pendingCount} pending</p>
                </div>
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border">
                    <p className="text-sm text-slate-500 dark:text-d-muted">This Month</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{formatCurrency(stats.monthExpenses)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search expenses..."
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover transition-colors"
                    />
                </div>

                <div className="flex items-center gap-1 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border">
                    {['all', 'pending', 'approved', 'rejected'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                                statusFilter === status
                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                    : 'text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass-hover'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Expenses Table */}
            <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm border border-slate-100 dark:border-d-border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-d-glass">
                        <tr>
                            <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Category</th>
                            <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Description</th>
                            <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Amount</th>
                            <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Date</th>
                            <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Status</th>
                            <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.map((expense) => {
                            const status = getStatusBadge(expense.status);
                            return (
                                <tr
                                    key={expense._id}
                                    className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                                >
                                    <td className="py-4 px-6">
                                        <span className="px-3 py-1 bg-amber-100 dark:bg-[rgba(255,210,100,0.15)] text-amber-600 dark:text-d-accent rounded-full text-sm font-medium">
                                            {getCategoryLabel(expense.category)}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-slate-600 dark:text-d-muted">
                                        {expense.description || '-'}
                                    </td>
                                    <td className="py-4 px-6 font-semibold text-red-600 dark:text-d-red">
                                        {formatCurrency(expense.amount)}
                                    </td>
                                    <td className="py-4 px-6 text-slate-500 dark:text-d-muted">
                                        {new Date(expense.date || expense.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-6">
                                        <span
                                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${status.color}`}
                                        >
                                            <status.icon size={12} />
                                            {expense.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center justify-end gap-2">
                                            {expense.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(expense._id)}
                                                        disabled={approvingId === expense._id}
                                                        className="p-2 text-green-500 dark:text-d-green hover:bg-green-50 dark:hover:bg-[rgba(52,232,161,0.1)] rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                        title="Approve"
                                                    >
                                                        <FiCheck />
                                                    </button>
                                                    <button
                                                        onClick={() => setRejectModal({ show: true, expenseId: expense._id, reason: '' })}
                                                        className="p-2 text-red-500 dark:text-d-red hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors"
                                                        title="Reject"
                                                    >
                                                        <FiX />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => openModal(expense)}
                                                className="p-2 text-slate-500 dark:text-d-faint hover:text-amber-500 dark:hover:text-d-accent hover:bg-amber-50 dark:hover:bg-[rgba(255,210,100,0.1)] rounded-lg transition-colors"
                                            >
                                                <FiEdit2 />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(expense._id)}
                                                className="p-2 text-slate-500 dark:text-d-faint hover:text-red-500 dark:hover:text-d-red hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredExpenses.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                        <FiDollarSign size={48} />
                        <p className="mt-4 dark:text-d-muted">No expenses found</p>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-d-border">
                        <p className="text-sm text-slate-500 dark:text-d-muted">
                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} expenses)
                        </p>
                        <div className="flex gap-2">
                            <button
                                disabled={pagination.page <= 1 || loading}
                                onClick={() => fetchExpenses(pagination.page - 1)}
                                className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                            >
                                Previous
                            </button>
                            <button
                                disabled={pagination.page >= pagination.totalPages || loading}
                                onClick={() => fetchExpenses(pagination.page + 1)}
                                className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                {editingExpense ? 'Edit Expense' : 'Add Expense'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-600 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-muted mb-1">
                                    Category *
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) =>
                                        setFormData({ ...formData, category: e.target.value })
                                    }
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-muted mb-1">
                                    Amount *
                                </label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) =>
                                        setFormData({ ...formData, amount: e.target.value })
                                    }
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                    required
                                    min="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-muted mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                    rows="3"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-d-muted mb-1">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) =>
                                            setFormData({ ...formData, date: e.target.value })
                                        }
                                        className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-d-muted mb-1">
                                        Payment Method
                                    </label>
                                    <select
                                        value={formData.paymentMethod}
                                        onChange={(e) =>
                                            setFormData({ ...formData, paymentMethod: e.target.value })
                                        }
                                        className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>

                            {formData.paymentMethod === 'cash' && cashBalance != null && (
                                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                                    (Number(formData.amount) || 0) > cashBalance
                                        ? 'bg-red-50 dark:bg-[rgba(239,68,68,0.08)] border-red-200 dark:border-[rgba(239,68,68,0.2)]'
                                        : 'bg-slate-50 dark:bg-d-bg border-slate-200 dark:border-d-border'
                                }`}>
                                    <span className="text-xs font-medium text-slate-500 dark:text-d-muted">Cash in Hand</span>
                                    <span className={`text-sm font-bold ${
                                        (Number(formData.amount) || 0) > cashBalance
                                            ? 'text-red-600 dark:text-d-red'
                                            : 'text-slate-800 dark:text-d-heading'
                                    }`}>{formatCurrency(cashBalance)}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-muted mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) =>
                                        setFormData({ ...formData, notes: e.target.value })
                                    }
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                    rows="2"
                                    placeholder="Additional notes..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-muted hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-medium hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <FiSave />
                                    {submitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Reject Reason Modal */}
            {rejectModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card rounded-2xl w-full max-w-md animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Reject Expense</h3>
                            <button
                                onClick={() => setRejectModal({ show: false, expenseId: null, reason: '' })}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg text-slate-600 dark:text-d-text"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">Rejection Reason</label>
                                <textarea
                                    value={rejectModal.reason}
                                    onChange={e => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Enter reason for rejection..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-red-500 bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading resize-none"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRejectModal({ show: false, expenseId: null, reason: '' })}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass-hover"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={rejecting}
                                    className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {rejecting ? 'Rejecting...' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
