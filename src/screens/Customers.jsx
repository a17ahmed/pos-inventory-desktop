import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import {
    getCustomers,
    getCustomerSummary,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerRates,
    replaceCustomerRates,
} from '../services/api/customers';
import { getProducts } from '../services/api/products';
import SpecialRatesEditor from '../components/SpecialRatesEditor';
import {
    canSaveCustomerRates,
    toDraftRates,
    toRatesPayload,
    validateDraftRates,
    friendlyRateError,
} from '../utils/specialRates';
import {
    FiPlus,
    FiSearch,
    FiEdit2,
    FiTrash2,
    FiSave,
    FiX,
    FiXCircle,
    FiUsers,
    FiDollarSign,
    FiAlertCircle,
    FiPhone,
    FiMail,
    FiMapPin,
    FiFileText,
    FiBookOpen,
} from 'react-icons/fi';
import { appAlert, appConfirm } from '../components/AppDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultCustomerForm = () => ({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    creditDays: 0,
    creditLimit: 0,
    openingBalance: 0,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Customers = () => {
    const { business } = useBusiness();
    const { isAdmin, permissions } = useAuth();
    const navigate = useNavigate();
    const canSaveRates = canSaveCustomerRates(isAdmin, permissions);

    const [customers, setCustomers] = useState([]); // current page only
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [summary, setSummary] = useState({ totalCustomers: 0, totalOutstandingDues: 0, customersWithDues: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [duesFilter, setDuesFilter] = useState('all'); // 'all' | 'dues'

    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [form, setForm] = useState(defaultCustomerForm());
    const [submitting, setSubmitting] = useState(false);

    // Special rates tab in the add/edit modal
    const [modalTab, setModalTab] = useState('details'); // 'details' | 'rates'
    const [ratesDraft, setRatesDraft] = useState([]);
    const [ratesOriginal, setRatesOriginal] = useState('[]'); // JSON of the loaded payload, for dirty check
    const [ratesLoading, setRatesLoading] = useState(false);
    const [rateProducts, setRateProducts] = useState(null); // loaded on first modal open
    const rateProductsById = React.useMemo(() => {
        const map = {};
        (rateProducts || []).forEach((p) => { map[p._id] = p; });
        return map;
    }, [rateProducts]);
    const ratesDirty = JSON.stringify(toRatesPayload(ratesDraft)) !== ratesOriginal;

    const formatCurrency = (amount) =>
        `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;

    // =========================================================================
    // Data fetching
    // =========================================================================

    // List: one page at a time (limit ≤ 100). Only the current page is held in state.
    const fetchCustomers = useCallback(async (pageNum = 1) => {
        setLoading(true);
        setError(null);
        try {
            const params = { page: pageNum, limit: 50 };
            if (duesFilter === 'dues') params.hasDues = 'true';
            if (searchQuery.trim()) params.search = searchQuery.trim();
            const res = await getCustomers(params);
            const data = res.data;
            const list = Array.isArray(data?.customers)
                ? data.customers
                : (Array.isArray(data) ? data : []);
            setCustomers(list);
            setPagination({
                page: data?.page ?? pageNum,
                totalPages: data?.totalPages ?? 1,
                total: data?.total ?? list.length,
            });
        } catch (err) {
            console.error('Error fetching customers:', err);
            setError(err.response?.data?.message || 'Failed to load customers');
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [duesFilter, searchQuery]);

    // KPI cards: business-wide totals from the server summary (independent of paging).
    const fetchSummary = useCallback(async () => {
        try {
            const res = await getCustomerSummary();
            setSummary(res.data || { totalCustomers: 0, totalOutstandingDues: 0, customersWithDues: 0 });
        } catch (err) {
            console.error('Error fetching customer summary:', err);
        }
    }, []);

    // Debounced: re-query page 1 whenever the search text or dues filter changes
    // (fetchCustomers is memoised on [duesFilter, searchQuery]).
    useEffect(() => {
        const t = setTimeout(() => fetchCustomers(1), 300);
        return () => clearTimeout(t);
    }, [fetchCustomers]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    // =========================================================================
    // Derived values
    // =========================================================================

    // Search is server-side now (?search=), so the current page is already the
    // filtered result — no client-side filtering.
    const filteredCustomers = customers;

    // =========================================================================
    // Modal handlers
    // =========================================================================

    const loadModalRates = async (customer) => {
        setModalTab('details');
        setRatesDraft([]);
        setRatesOriginal('[]');
        if (!rateProducts) {
            getProducts().then((res) => setRateProducts(res.data || [])).catch(() => setRateProducts([]));
        }
        if (!customer) return;
        setRatesLoading(true);
        try {
            const res = await getCustomerRates(customer._id);
            const draft = toDraftRates(res.data?.rates);
            setRatesDraft(draft);
            setRatesOriginal(JSON.stringify(toRatesPayload(draft)));
        } catch (err) {
            console.error('Error loading special rates:', err);
        } finally {
            setRatesLoading(false);
        }
    };

    const openModal = (customer = null) => {
        loadModalRates(customer);
        if (customer) {
            setEditingCustomer(customer);
            setForm({
                name: customer.name || '',
                phone: customer.phone || '',
                email: customer.email || '',
                address: customer.address || '',
                notes: customer.notes || '',
                creditDays: customer.creditDays || 0,
                creditLimit: customer.creditLimit || 0,
            });
        } else {
            setEditingCustomer(null);
            setForm(defaultCustomerForm());
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingCustomer(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.phone.trim()) {
            setModalTab('details');
            appAlert('Name and phone are required');
            return;
        }
        const saveRates = canSaveRates && ratesDirty;
        if (saveRates) {
            const rateError = validateDraftRates(ratesDraft, rateProductsById);
            if (rateError) {
                setModalTab('rates');
                appAlert(rateError);
                return;
            }
        }
        setSubmitting(true);
        try {
            const payload = {
                name: form.name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim(),
                address: form.address.trim(),
                notes: form.notes.trim(),
            };

            if (editingCustomer) {
                // update can accept credit fields too
                payload.creditDays = Number(form.creditDays) || 0;
                payload.creditLimit = Number(form.creditLimit) || 0;
                await updateCustomer(editingCustomer._id, payload);
                if (saveRates) {
                    try {
                        await replaceCustomerRates(editingCustomer._id, toRatesPayload(ratesDraft));
                    } catch (err) {
                        // Details are saved; keep the modal open on the rates tab to fix them.
                        setModalTab('rates');
                        appAlert('Customer saved, but special rates were not: '
                            + friendlyRateError(err.response?.data?.message || err.message, rateProductsById));
                        fetchCustomers(1);
                        return;
                    }
                }
            } else {
                if (Number(form.openingBalance) > 0) {
                    payload.openingBalance = Number(form.openingBalance);
                }
                const sentRates = saveRates ? toRatesPayload(ratesDraft) : [];
                if (sentRates.length > 0) payload.specialRates = sentRates;
                const res = await createCustomer(payload);
                // POST /customer returns the existing customer when the phone is already
                // registered, and leaves that customer's rates untouched.
                const saved = res.data?.customer || res.data;
                if (sentRates.length > 0 && Array.isArray(saved?.specialRates)) {
                    const savedIds = new Set(saved.specialRates.map((r) => String(r.product?._id ?? r.product)));
                    if (!sentRates.every((r) => savedIds.has(r.product))) {
                        appAlert(`A customer with this phone number already exists (${saved.name}). `
                            + 'Their special rates were not changed — edit that customer to manage rates.');
                    }
                }
            }

            closeModal();
            fetchCustomers(1);
            fetchSummary();
        } catch (err) {
            console.error('Error saving customer:', err);
            appAlert(friendlyRateError(err.response?.data?.message || 'Failed to save customer', rateProductsById));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (customer) => {
        if (customer.balance > 0) {
            appAlert(
                `Cannot delete customer with outstanding balance of ${formatCurrency(customer.balance)}`
            );
            return;
        }
        if (!(await appConfirm(`Delete customer "${customer.name}"?`, { danger: true }))) return;
        try {
            await deleteCustomer(customer._id);
            fetchCustomers(pagination.page);
            fetchSummary();
        } catch (err) {
            console.error('Error deleting customer:', err);
            appAlert(err.response?.data?.message || 'Failed to delete customer');
        }
    };

    const openLedger = (customer) => {
        navigate(`/customers/${customer._id}/ledger`);
    };

    // =========================================================================
    // Render
    // =========================================================================

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-d-bg">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-d-heading">
                            Customers
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-d-muted mt-1">
                            Manage your customers and their credit terms
                        </p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 dark:bg-d-accent text-white dark:text-d-card rounded-xl font-medium hover:bg-primary-600 dark:hover:bg-d-accent-s transition-colors shadow-sm"
                    >
                        <FiPlus size={18} />
                        Add Customer
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-primary-100 dark:bg-[rgba(255,210,100,0.15)] rounded-xl flex items-center justify-center">
                                <FiUsers className="text-primary-600 dark:text-d-accent" size={20} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Total Customers</p>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{summary.totalCustomers}</p>
                    </div>
                    <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-red-100 dark:bg-[rgba(255,107,107,0.15)] rounded-xl flex items-center justify-center">
                                <FiAlertCircle className="text-red-500 dark:text-d-red" size={20} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Outstanding Dues</p>
                        </div>
                        <p className="text-2xl font-bold text-red-600 dark:text-d-red">
                            {formatCurrency(summary.totalOutstandingDues)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-yellow-100 dark:bg-[rgba(255,210,100,0.15)] rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-yellow-600 dark:text-d-accent" size={20} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Customers with Dues</p>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                            {summary.customersWithDues}
                        </p>
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
                            placeholder="Search by name, phone, or email..."
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'dues', label: 'With Dues' },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setDuesFilter(f.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    duesFilter === f.id
                                        ? 'bg-primary-500 dark:bg-d-accent text-white dark:text-d-card'
                                        : 'text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-primary-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-500 dark:text-d-muted">Loading customers...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-[rgba(255,107,107,0.15)] rounded-full flex items-center justify-center">
                                <FiXCircle size={32} className="text-red-500 dark:text-d-red" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                Failed to load customers
                            </h2>
                            <p className="text-slate-500 dark:text-d-muted">{error}</p>
                            <button
                                onClick={() => { fetchCustomers(1); fetchSummary(); }}
                                className="px-4 py-2 bg-primary-500 dark:bg-d-accent text-white dark:text-d-card rounded-xl hover:bg-primary-600 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-d-glass">
                                <tr>
                                    <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">
                                        Name
                                    </th>
                                    <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">
                                        Phone
                                    </th>
                                    <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">
                                        Email
                                    </th>
                                    <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">
                                        Credit Limit
                                    </th>
                                    <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">
                                        Balance
                                    </th>
                                    <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">
                                        Purchases
                                    </th>
                                    <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map((customer) => {
                                    // Round to paisa so float noise like -0.0000001 shows as 0, not "Cr -0".
                                    const balance = Math.round((customer.balance || 0) * 100) / 100;
                                    return (
                                        <tr
                                            key={customer._id}
                                            onClick={() => openLedger(customer)}
                                            className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
                                        >
                                            <td className="py-4 px-6">
                                                <div className="font-semibold text-slate-800 dark:text-d-heading">
                                                    {customer.name}
                                                </div>
                                                {customer.address && (
                                                    <div className="text-xs text-slate-500 dark:text-d-muted mt-0.5 flex items-center gap-1">
                                                        <FiMapPin size={11} />
                                                        {customer.address}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-slate-600 dark:text-d-text text-sm">
                                                {customer.phone}
                                            </td>
                                            <td className="py-4 px-6 text-slate-600 dark:text-d-text text-sm">
                                                {customer.email || '—'}
                                            </td>
                                            <td className="py-4 px-6 text-right text-slate-600 dark:text-d-text">
                                                {customer.creditLimit
                                                    ? formatCurrency(customer.creditLimit)
                                                    : '—'}
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold">
                                                <span
                                                    className={
                                                        balance > 0
                                                            ? 'text-red-600 dark:text-d-red'
                                                            : balance < 0
                                                                ? 'text-emerald-600 dark:text-d-green'
                                                                : 'text-slate-500 dark:text-d-muted'
                                                    }
                                                >
                                                    {balance < 0 ? formatCurrency(-balance) : formatCurrency(balance)}
                                                </span>
                                                {balance < 0 && (
                                                    <div className="text-[11px] font-normal text-emerald-600 dark:text-d-green">Available credit</div>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-d-glass text-slate-600 dark:text-d-muted rounded-full text-xs font-medium">
                                                    {customer.totalPurchases || 0}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openLedger(customer); }}
                                                        className="p-2 text-slate-500 dark:text-d-muted hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
                                                        title="View Ledger"
                                                    >
                                                        <FiBookOpen size={15} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openModal(customer); }}
                                                        className="p-2 text-slate-500 dark:text-d-muted hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(customer); }}
                                                        className="p-2 text-slate-500 dark:text-d-muted hover:text-red-500 dark:hover:text-d-red hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredCustomers.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                                <FiUsers size={48} />
                                <p className="mt-4 text-base">No customers found</p>
                                <p className="text-sm mt-1">
                                    Add your first customer to get started
                                </p>
                            </div>
                        )}

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-d-border">
                                <p className="text-sm text-slate-500 dark:text-d-muted">
                                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} customers)
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        disabled={pagination.page <= 1 || loading}
                                        onClick={() => fetchCustomers(pagination.page - 1)}
                                        className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        disabled={pagination.page >= pagination.totalPages || loading}
                                        onClick={() => fetchCustomers(pagination.page + 1)}
                                        className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-d-border sticky top-0 bg-white dark:bg-d-card z-10">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-d-heading">
                                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 text-slate-400 dark:text-d-faint hover:text-slate-600 dark:hover:text-d-text rounded-lg transition-colors"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Tabs */}
                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-d-bg rounded-xl p-1 border border-slate-200 dark:border-d-border">
                                {[
                                    { id: 'details', label: 'Details' },
                                    { id: 'rates', label: `Special Rates${ratesDraft.length ? ` (${ratesDraft.length})` : ''}` },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setModalTab(t.id)}
                                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                            modalTab === t.id
                                                ? 'bg-white dark:bg-d-card text-slate-800 dark:text-d-heading shadow-sm'
                                                : 'text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {modalTab === 'rates' && (
                                ratesLoading || !rateProducts ? (
                                    <div className="py-8 text-center text-sm text-slate-400 dark:text-d-faint">Loading special rates…</div>
                                ) : (
                                    <>
                                        {!canSaveRates && (
                                            <p className="text-xs text-amber-600 dark:text-d-accent">You don't have permission to change customer rates.</p>
                                        )}
                                        <SpecialRatesEditor
                                            value={ratesDraft}
                                            onChange={setRatesDraft}
                                            products={rateProducts}
                                            readOnly={!canSaveRates}
                                            allowSellBelowCost={business?.settings?.allowSellBelowCost === true}
                                        />
                                    </>
                                )
                            )}

                            {modalTab === 'details' && (<>
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1.5">
                                    Name <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" size={16} />
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        placeholder="Customer name"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1.5">
                                    Phone <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" size={16} />
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        required
                                        placeholder="+92 300 1234567"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1.5">
                                    Email
                                </label>
                                <div className="relative">
                                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" size={16} />
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="customer@example.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1.5">
                                    Address
                                </label>
                                <div className="relative">
                                    <FiMapPin className="absolute left-3 top-3 text-slate-400 dark:text-d-faint" size={16} />
                                    <textarea
                                        value={form.address}
                                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                                        placeholder="Street, City"
                                        rows={2}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text resize-none"
                                    />
                                </div>
                            </div>

                            {/* Opening Balance — only when adding new customer */}
                            {!editingCustomer && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1.5">
                                        Opening Balance
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.openingBalance}
                                        onChange={(e) =>
                                            setForm({ ...form, openingBalance: e.target.value })
                                        }
                                        placeholder="0"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                    />
                                    <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Previous balance from old system (if any)</p>
                                </div>
                            )}

                            {/* Credit Terms — edit mode only */}
                            {editingCustomer && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1.5">
                                            Credit Days
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.creditDays}
                                            onChange={(e) =>
                                                setForm({ ...form, creditDays: e.target.value })
                                            }
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1.5">
                                            Credit Limit
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.creditLimit}
                                            onChange={(e) =>
                                                setForm({ ...form, creditLimit: e.target.value })
                                            }
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1.5">
                                    Notes
                                </label>
                                <div className="relative">
                                    <FiFileText className="absolute left-3 top-3 text-slate-400 dark:text-d-faint" size={16} />
                                    <textarea
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        placeholder="Any notes about this customer..."
                                        rows={3}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text resize-none"
                                    />
                                </div>
                            </div>

                            </>)}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-d-border">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2.5 text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 dark:bg-d-accent text-white dark:text-d-card rounded-xl font-medium hover:bg-primary-600 dark:hover:bg-d-accent-s transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <FiSave size={16} />
                                    {submitting
                                        ? 'Saving...'
                                        : editingCustomer
                                            ? 'Update Customer'
                                            : 'Add Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Customers;
