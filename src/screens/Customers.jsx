import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import {
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
} from '../services/api/customers';
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
    const navigate = useNavigate();

    const [customers, setCustomers] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [duesFilter, setDuesFilter] = useState('all'); // 'all' | 'dues'

    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [form, setForm] = useState(defaultCustomerForm());
    const [submitting, setSubmitting] = useState(false);

    const formatCurrency = (amount) =>
        `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;

    // =========================================================================
    // Data fetching
    // =========================================================================

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { limit: 200 };
            if (duesFilter === 'dues') params.hasDues = 'true';
            const res = await getCustomers(params);
            const data = res.data;
            if (data && Array.isArray(data.customers)) {
                setCustomers(data.customers);
                setTotal(data.total || data.customers.length);
            } else if (Array.isArray(data)) {
                setCustomers(data);
                setTotal(data.length);
            } else {
                setCustomers([]);
                setTotal(0);
            }
        } catch (err) {
            console.error('Error fetching customers:', err);
            setError(err.response?.data?.message || 'Failed to load customers');
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [duesFilter]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    // =========================================================================
    // Derived values
    // =========================================================================

    const filteredCustomers = customers.filter((c) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (c.name || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
        );
    });

    const totalOutstanding = customers.reduce(
        (acc, c) => acc + (c.balance > 0 ? c.balance : 0),
        0
    );
    const customersWithDues = customers.filter((c) => c.balance > 0).length;

    // =========================================================================
    // Modal handlers
    // =========================================================================

    const openModal = (customer = null) => {
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
            alert('Name and phone are required');
            return;
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
            } else {
                if (Number(form.openingBalance) > 0) {
                    payload.openingBalance = Number(form.openingBalance);
                }
                await createCustomer(payload);
            }

            closeModal();
            fetchCustomers();
        } catch (err) {
            console.error('Error saving customer:', err);
            alert(err.response?.data?.message || 'Failed to save customer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (customer) => {
        if (customer.balance > 0) {
            alert(
                `Cannot delete customer with outstanding balance of ${formatCurrency(customer.balance)}`
            );
            return;
        }
        if (!window.confirm(`Delete customer "${customer.name}"?`)) return;
        try {
            await deleteCustomer(customer._id);
            fetchCustomers();
        } catch (err) {
            console.error('Error deleting customer:', err);
            alert(err.response?.data?.message || 'Failed to delete customer');
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
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{total}</p>
                    </div>
                    <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-red-100 dark:bg-[rgba(255,107,107,0.15)] rounded-xl flex items-center justify-center">
                                <FiAlertCircle className="text-red-500 dark:text-d-red" size={20} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Outstanding Dues</p>
                        </div>
                        <p className="text-2xl font-bold text-red-600 dark:text-d-red">
                            {formatCurrency(totalOutstanding)}
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
                            {customersWithDues}
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
                                onClick={fetchCustomers}
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
                                    const balance = customer.balance || 0;
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
                                                    {balance < 0 ? 'Cr ' : ''}{formatCurrency(balance)}
                                                </span>
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
