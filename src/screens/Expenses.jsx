import React, { useState, useEffect } from 'react';
import { PageHeader, DataTable, rowActions, Dash, StatusBadge, FilterButton, DateRangeFields, rangeLabel, Field, Select } from '../components/ui';
import { DialogShell } from '../components/ui/Dialog';
import { todayLocalDate, toLocalDateStr } from '../utils/date';
import { useBusiness } from '../context/BusinessContext';
import { getExpenses, getExpenseStats, createExpense, updateExpense, deleteExpense, approveExpense, rejectExpense } from '../services/api/expenses';
import { getCashBalance } from '../services/api/cashbook';
import { appAlert, appConfirm } from '../components/AppDialog';
import AccountPicker from '../components/AccountPicker';
import { useMoneyBook } from '../context/MoneyBookContext';
import { apiErrorMessage, round2 } from '../utils/moneyBook';
import { Modal, ErrorBox, btnGhost, btnSolid } from '../components/moneybook/ui';
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

const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

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
    const [pageSize, setPageSize] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('ds.table.expenses.pageSize')) || 50;
        } catch {
            return 50;
        }
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [range, setRange] = useState({ from: '', to: '' }); // '' = all dates
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [rejectModal, setRejectModal] = useState({ show: false, expenseId: null, reason: '' });
    const [submitting, setSubmitting] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [cashBalance, setCashBalance] = useState(null);
    const [approvingId, setApprovingId] = useState(null);
    // Money Book (only when the shop has it on): account paid from, cheque details
    const { isOn: moneyBookOn, chequeTracking, moneyFields, handleMoneyError } = useMoneyBook();
    const [moneyForm, setMoneyForm] = useState({ accountId: null, chequeNumber: '', chequeDate: '' });
    const [accountShort, setAccountShort] = useState(false);
    const [approveDialog, setApproveDialog] = useState(null); // { expense, accountId, short, error }
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
    }, [statusFilter, categoryFilter, range.from, range.to, searchQuery, pageSize]);

    useEffect(() => {
        fetchStats();
    }, []);

    // List: one page at a time (limit ≤ 100), only the current page held in state.
    const fetchExpenses = async (pageNum = 1) => {
        setLoading(true);
        setError(null);
        try {
            const params = { page: pageNum, limit: pageSize };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (categoryFilter !== 'all') params.category = categoryFilter;
            if (range.from) params.startDate = range.from;
            if (range.to) params.endDate = range.to;
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
    const resetFilters = () => {
        setStatusFilter('all');
        setCategoryFilter('all');
        setRange({ from: '', to: '' });
    };

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
            setMoneyForm({
                accountId: expense.account ? String(expense.account?._id || expense.account) : null,
                chequeNumber: expense.chequeNumber || '',
                chequeDate: expense.chequeDate ? toLocalDateStr(expense.chequeDate) : '',
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
        if (!expense) setMoneyForm({ accountId: null, chequeNumber: '', chequeDate: '' });
        setAccountShort(false);
        // Money Book on: the picker shows the chosen account's balance instead
        if (!moneyBookOn) getCashBalance().then(res => setCashBalance(res.data?.balance ?? null)).catch(() => setCashBalance(null));
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
        if (!moneyBookOn && formData.paymentMethod === 'cash' && cashBalance != null && amount > cashBalance) {
            return appAlert(`Insufficient cash. Available balance: ${formatCurrency(cashBalance)}`);
        }
        if (moneyBookOn && accountShort) {
            return appAlert('Not enough money in the selected account. Choose another account or lower the amount.');
        }
        setSubmitting(true);
        try {
            const isTrackedCheque = formData.paymentMethod === 'cheque' && chequeTracking;
            const data = {
                ...formData,
                amount,
                ...moneyFields({
                    accountId: moneyForm.accountId,
                    ...(isTrackedCheque ? { chequeNumber: moneyForm.chequeNumber.trim(), chequeDate: moneyForm.chequeDate } : {}),
                }),
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
            handleMoneyError(error);
            appAlert(apiErrorMessage(error, 'Failed to save expense'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (expenseId) => {
        // Money Book on: confirm which account pays it first (the server
        // refuses approval when that account is short)
        if (moneyBookOn) {
            const expense = expenses.find((x) => x._id === expenseId);
            if (expense) {
                setApproveDialog({
                    expense,
                    accountId: expense.account ? String(expense.account?._id || expense.account) : null,
                    short: false,
                    error: '',
                });
                return;
            }
        }
        setApprovingId(expenseId);
        try {
            await approveExpense(expenseId);
            fetchExpenses(pagination.page);
            fetchStats();
        } catch (error) {
            console.error('Error approving expense:', error);
            appAlert(apiErrorMessage(error, 'Failed to approve expense'));
        } finally {
            setApprovingId(null);
        }
    };

    const confirmApprove = async () => {
        const { expense, accountId, short } = approveDialog;
        if (short) {
            setApproveDialog((d) => ({ ...d, error: 'Not enough money in this account. Choose another account.' }));
            return;
        }
        setApprovingId(expense._id);
        try {
            const body = moneyFields({ accountId });
            await approveExpense(expense._id, Object.keys(body).length ? body : undefined);
            setApproveDialog(null);
            fetchExpenses(pagination.page);
            fetchStats();
        } catch (error) {
            console.error('Error approving expense:', error);
            handleMoneyError(error);
            setApproveDialog((d) => d && ({ ...d, error: apiErrorMessage(error, 'Failed to approve expense') }));
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
                return { icon: FiCheckCircle, color: 'bg-success-chip text-success' };
            case 'rejected':
                return { icon: FiXCircle, color: 'bg-destructive-chip text-destructive' };
            default:
                return { icon: FiClock, color: 'bg-warning-chip text-warning-chip-foreground' };
        }
    };

    const getCategoryLabel = (value) => {
        return CATEGORIES.find((c) => c.value === value)?.label || value;
    };

    const expenseColumns = [
        {
            id: 'category',
            header: 'Category',
            accessorFn: (e) => getCategoryLabel(e.category) || '',
            cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
        },
        {
            id: 'description',
            header: 'Description',
            accessorFn: (e) => e.description || '',
            cell: ({ getValue }) => (getValue() ? <span className="text-muted-foreground">{getValue()}</span> : <Dash />),
        },
        {
            id: 'amount',
            header: 'Amount',
            accessorFn: (e) => Number(e.amount) || 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => <span className="font-medium">{formatCurrency(getValue())}</span>,
        },
        {
            id: 'date',
            header: 'Date',
            accessorFn: (e) => new Date(e.date || e.createdAt).getTime() || 0,
            cell: ({ row: { original: e } }) => <span className="text-muted-foreground">{new Date(e.date || e.createdAt).toLocaleDateString()}</span>,
        },
        {
            id: 'status',
            header: 'Status',
            accessorFn: (e) => e.status || '',
            cell: ({ getValue }) => <StatusBadge kind="expense" value={getValue()} size="sm" />,
        },
        rowActions(
            (e) => [
                ...(e.status === 'pending'
                    ? [
                          { label: approvingId === e._id ? 'Approving…' : 'Approve', icon: FiCheck, disabled: approvingId === e._id, onSelect: () => handleApprove(e._id) },
                          { label: 'Reject', icon: FiX, onSelect: () => setRejectModal({ show: true, expenseId: e._id, reason: '' }) },
                          { separator: true },
                      ]
                    : []),
                { label: 'Edit', icon: FiEdit2, onSelect: () => openModal(e) },
                { separator: true },
                { label: 'Delete', icon: FiTrash2, danger: true, onSelect: () => handleDelete(e._id) },
            ],
            { label: 'Expense actions' }
        ),
    ];

    return (
        <div className="p-6 animate-fadeIn min-h-full">
            {/* Header */}
            <PageHeader
                title={<>Expenses</>}
                subtitle={<>{pagination.total} expenses recorded</>}
                actions={
                    <>
                        <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold hover:shadow-md transition-all"
                >
                    <FiPlus />
                    Add Expense
                </button>
                    </>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                    <p className="text-sm text-muted-foreground">Total Approved</p>
                    <p className="text-2xl font-bold text-success">{formatCurrency(stats.totalExpenses)}</p>
                </div>
                <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                    <p className="text-sm text-muted-foreground">Pending Approval</p>
                    <p className="text-2xl font-bold text-warning-chip-foreground">
                        {formatCurrency(Math.round((stats.pendingTotal || 0) * 100) / 100)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{stats.pendingCount} pending</p>
                </div>
                <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                    <p className="text-sm text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.monthExpenses)}</p>
                </div>
            </div>

            <DataTable
                caption="Expenses"
                data={filteredExpenses}
                columns={expenseColumns}
                getRowId={(e) => e._id}
                loading={loading}
                error={error ? { message: error, onRetry: () => { fetchExpenses(1); fetchStats(); } } : null}
                search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search expenses' }}
                filters={
                    <FilterButton
                        label="Filter expenses"
                        summary={[
                            rangeLabel(range),
                            statusFilter !== 'all' && STATUS_LABEL[statusFilter],
                            categoryFilter !== 'all' && getCategoryLabel(categoryFilter),
                        ].filter(Boolean).join(' · ')}
                        count={(statusFilter !== 'all') + (categoryFilter !== 'all')}
                        onReset={resetFilters}
                    >
                        <DateRangeFields value={range} onChange={setRange} />
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Status">
                                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="all">All</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </Select>
                            </Field>
                            <Field label="Category">
                                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                    <option value="all">All</option>
                                    {CATEGORIES.map((c) => (
                                        <option key={c.value} value={c.value}>
                                            {c.label}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        </div>
                    </FilterButton>
                }
                isFiltered={!!searchQuery.trim() || statusFilter !== 'all' || categoryFilter !== 'all' || !!range.from || !!range.to}
                onClearFilters={() => {
                    setSearchQuery('');
                    resetFilters();
                }}
                empty={{ icon: FiDollarSign, title: 'No expenses yet', description: 'Record rent, bills and other costs here.' }}
                onRowClick={(e) => openModal(e)}
                rowLabel={(e) => `Edit expense: ${getCategoryLabel(e.category)} ${formatCurrency(e.amount)}`}
                rowTone={(e) => (e.status === 'pending' ? 'attention' : null)}
                server={{
                    page: pagination.page,
                    pageSize,
                    total: pagination.total,
                    onPageChange: (p) => fetchExpenses(p),
                    onPageSizeChange: (n) => {
                        setPageSize(n);
                        try {
                            localStorage.setItem('ds.table.expenses.pageSize', JSON.stringify(n));
                        } catch {
                            /* storage blocked */
                        }
                    },
                }}
            />

            {/* Add/Edit Modal */}
            {showModal && (
                <DialogShell size="md" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-hairline">
                            <h3 className="text-xl font-semibold text-foreground">
                                {editingExpense ? 'Edit Expense' : 'Add Expense'}
                            </h3>
                            <button data-dialog-close
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg transition-colors text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Category *
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) =>
                                        setFormData({ ...formData, category: e.target.value })
                                    }
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground focus:outline-none focus:border-primary/30"
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Amount *
                                </label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) =>
                                        setFormData({ ...formData, amount: e.target.value })
                                    }
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary/30"
                                    required
                                    min="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary/30"
                                    rows="3"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) =>
                                            setFormData({ ...formData, date: e.target.value })
                                        }
                                        className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground focus:outline-none focus:border-primary/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Payment Method
                                    </label>
                                    <select
                                        value={formData.paymentMethod}
                                        onChange={(e) =>
                                            setFormData({ ...formData, paymentMethod: e.target.value })
                                        }
                                        className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground focus:outline-none focus:border-primary/30"
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        {moneyBookOn && <option value="online">Online</option>}
                                        <option value="bank_transfer">Bank Transfer</option>
                                        {(!moneyBookOn || chequeTracking || formData.paymentMethod === 'cheque') && <option value="cheque">Cheque</option>}
                                    </select>
                                </div>
                            </div>

                            {moneyBookOn && (
                                <AccountPicker
                                    method={formData.paymentMethod}
                                    value={moneyForm.accountId}
                                    onChange={(id) => setMoneyForm((m) => ({ ...m, accountId: id }))}
                                    amount={round2(formData.amount)}
                                    direction="out"
                                    pending={formData.paymentMethod === 'cheque' && chequeTracking}
                                    onInsufficientChange={setAccountShort}
                                />
                            )}
                            {moneyBookOn && chequeTracking && formData.paymentMethod === 'cheque' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Cheque number</label>
                                        <input
                                            type="text"
                                            maxLength={50}
                                            value={moneyForm.chequeNumber}
                                            onChange={(e) => setMoneyForm((m) => ({ ...m, chequeNumber: e.target.value }))}
                                            className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground focus:outline-none focus:border-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Cheque date</label>
                                        <input
                                            type="date"
                                            value={moneyForm.chequeDate}
                                            onChange={(e) => setMoneyForm((m) => ({ ...m, chequeDate: e.target.value }))}
                                            className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground focus:outline-none focus:border-primary/30"
                                        />
                                    </div>
                                </div>
                            )}

                            {!moneyBookOn && formData.paymentMethod === 'cash' && cashBalance != null && (
                                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                                    (Number(formData.amount) || 0) > cashBalance
                                        ? 'bg-destructive-chip border-destructive/30'
                                        : 'bg-muted/40 border-hairline'
                                }`}>
                                    <span className="text-xs font-medium text-muted-foreground">Cash in Hand</span>
                                    <span className={`text-sm font-bold ${
                                        (Number(formData.amount) || 0) > cashBalance
                                            ? 'text-destructive'
                                            : 'text-foreground'
                                    }`}>{formatCurrency(cashBalance)}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) =>
                                        setFormData({ ...formData, notes: e.target.value })
                                    }
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary/30"
                                    rows="2"
                                    placeholder="Additional notes..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <FiSave />
                                    {submitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </DialogShell>
            )}
            {/* Approve: which account pays (Money Book on) */}
            {approveDialog && (
                <Modal title="Approve expense" onClose={() => setApproveDialog(null)}>
                    <div className="p-5 space-y-4">
                        <ErrorBox>{approveDialog.error}</ErrorBox>
                        <p className="text-sm text-muted-foreground">
                            {approveDialog.expense.description || getCategoryLabel(approveDialog.expense.category)} · <b>{formatCurrency(approveDialog.expense.amount)}</b>
                        </p>
                        <AccountPicker
                            method={approveDialog.expense.paymentMethod || 'cash'}
                            value={approveDialog.accountId}
                            onChange={(id) => setApproveDialog((d) => d && ({ ...d, accountId: id }))}
                            amount={approveDialog.expense.amount}
                            direction="out"
                            pending={approveDialog.expense.paymentMethod === 'cheque' && chequeTracking}
                            onInsufficientChange={(v) => setApproveDialog((d) => d && ({ ...d, short: v }))}
                        />
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setApproveDialog(null)} className={btnGhost}>Cancel</button>
                            <button
                                type="button"
                                onClick={confirmApprove}
                                disabled={approvingId === approveDialog.expense._id || approveDialog.short}
                                className={btnSolid('emerald')}
                            >
                                {approvingId === approveDialog.expense._id ? 'Approving…' : 'Approve'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            {/* Reject Reason Modal */}
            {rejectModal.show && (
                <DialogShell size="md" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-hairline">
                            <h3 className="text-lg font-semibold text-foreground">Reject Expense</h3>
                            <button data-dialog-close
                                onClick={() => setRejectModal({ show: false, expenseId: null, reason: '' })}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Rejection Reason</label>
                                <textarea
                                    value={rejectModal.reason}
                                    onChange={e => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Enter reason for rejection..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-hairline rounded-xl focus:ring-2 focus:ring-destructive bg-card text-foreground resize-none"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRejectModal({ show: false, expenseId: null, reason: '' })}
                                    className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={rejecting}
                                    className="flex-1 py-3 bg-destructive text-white rounded-xl font-medium hover:bg-destructive/90 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {rejecting ? 'Rejecting...' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    </DialogShell>
            )}
        </div>
    );
};

export default Expenses;
