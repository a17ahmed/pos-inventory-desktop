import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader, DataTable, rowActions, Dash, SegmentedControl, KpiStrip, KpiCard } from '../components/ui';
import { DialogShell } from '../components/ui/Dialog';
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
    const [pageSize, setPageSize] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('ds.table.customers.pageSize')) || 50;
        } catch {
            return 50;
        }
    });

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
            const params = { page: pageNum, limit: pageSize };
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
    }, [duesFilter, searchQuery, pageSize]);

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

    // Round to paisa so float noise like -0.0000001 shows as 0, not "Cr -0".
    const balanceOf = (c) => Math.round((c.balance || 0) * 100) / 100;
    const customerColumns = [
        {
            id: 'name',
            header: 'Name',
            accessorFn: (c) => c.name || '',
            cell: ({ row: { original: c } }) => (
                <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{c.name}</p>
                    {c.address ? (
                        <p className="text-body-sm text-muted-foreground flex items-center gap-1 truncate">
                            <FiMapPin size={11} aria-hidden="true" />
                            {c.address}
                        </p>
                    ) : null}
                </div>
            ),
        },
        { id: 'phone', header: 'Phone', accessorFn: (c) => c.phone || '', meta: { mono: true }, cell: ({ getValue }) => getValue() || <Dash /> },
        { id: 'email', header: 'Email', accessorFn: (c) => c.email || '', cell: ({ getValue }) => getValue() || <Dash /> },
        {
            id: 'creditLimit',
            header: 'Credit limit',
            accessorFn: (c) => Number(c.creditLimit) || 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => (getValue() ? formatCurrency(getValue()) : <Dash />),
        },
        {
            id: 'balance',
            header: 'Balance',
            accessorFn: balanceOf,
            meta: { align: 'right' },
            cell: ({ getValue }) => {
                const b = getValue();
                return (
                    <div>
                        <span className={b > 0 ? 'text-destructive font-medium' : b < 0 ? 'text-success font-medium' : 'text-muted-foreground'}>
                            {formatCurrency(Math.abs(b))}
                        </span>
                        {b < 0 && <p className="text-body-sm text-success">Available credit</p>}
                    </div>
                );
            },
        },
        { id: 'purchases', header: 'Purchases', accessorFn: (c) => c.totalPurchases || 0, meta: { align: 'right' } },
        rowActions(
            (c) => [
                { label: 'View ledger', icon: FiBookOpen, onSelect: () => openLedger(c) },
                { label: 'Edit', icon: FiEdit2, onSelect: () => openModal(c) },
                { separator: true },
                { label: 'Delete', icon: FiTrash2, danger: true, onSelect: () => handleDelete(c) },
            ],
            { label: 'Customer actions' }
        ),
    ];

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
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <PageHeader
                    title={<>Customers</>}
                    subtitle={<>Manage your customers and their credit terms</>}
                    actions={
                        <>
                            <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <FiPlus size={18} />
                        Add Customer
                    </button>
                        </>
                    }
                />

                {/* Figures — "owed" tiles switch the list to customers with dues */}
                <KpiStrip cols={3} className="mb-5">
                    <KpiCard
                        label="Customers"
                        value={Number(summary.totalCustomers || 0).toLocaleString()}
                        note={duesFilter === 'dues' ? 'Showing customers with dues' : 'All customers'}
                        onClick={duesFilter === 'dues' ? () => setDuesFilter('all') : undefined}
                        ariaLabel="Show all customers"
                    />
                    <KpiCard
                        label="Owed to you"
                        value={formatCurrency(summary.totalOutstandingDues)}
                        tone={summary.totalOutstandingDues > 0 ? 'destructive' : undefined}
                        note={summary.customersWithDues ? `by ${summary.customersWithDues} customer${summary.customersWithDues === 1 ? '' : 's'}` : 'Nobody owes anything'}
                        onClick={summary.customersWithDues ? () => setDuesFilter('dues') : undefined}
                        ariaLabel="Show customers who owe money"
                    />
                    <KpiCard
                        label="Customers with dues"
                        value={Number(summary.customersWithDues || 0).toLocaleString()}
                        tone={summary.customersWithDues > 0 ? 'warning' : undefined}
                        note={summary.totalCustomers ? `${Math.round(((summary.customersWithDues || 0) / summary.totalCustomers) * 100)}% of customers` : null}
                        onClick={summary.customersWithDues ? () => setDuesFilter('dues') : undefined}
                        ariaLabel="Show customers who owe money"
                    />
                </KpiStrip>

                <DataTable
                    caption="Customers"
                    data={filteredCustomers}
                    columns={customerColumns}
                    getRowId={(c) => c._id}
                    loading={loading}
                    error={error ? { message: error, onRetry: () => { fetchCustomers(1); fetchSummary(); } } : null}
                    search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search by name, phone, or email' }}
                    filters={
                        <SegmentedControl
                            label="Customers to show"
                            value={duesFilter}
                            onChange={setDuesFilter}
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'dues', label: 'With dues' },
                            ]}
                        />
                    }
                    isFiltered={!!searchQuery.trim() || duesFilter !== 'all'}
                    onClearFilters={() => {
                        setSearchQuery('');
                        setDuesFilter('all');
                    }}
                    empty={{ icon: FiUsers, title: 'No customers yet', description: 'Add your first customer to get started.' }}
                    onRowClick={openLedger}
                    rowLabel={(c) => `Open ledger of ${c.name}`}
                    server={{
                        page: pagination.page,
                        pageSize,
                        total: pagination.total,
                        onPageChange: (p) => fetchCustomers(p),
                        onPageSizeChange: (n) => {
                            setPageSize(n);
                            try {
                                localStorage.setItem('ds.table.customers.pageSize', JSON.stringify(n));
                            } catch {
                                /* storage blocked */
                            }
                        },
                    }}
                />
            </div>

            {/* Modal */}
            {showModal && (
                <DialogShell size="md" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline sticky top-0 bg-card z-10">
                            <h2 className="text-xl font-bold text-foreground">
                                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
                            </h2>
                            <button data-dialog-close
                                onClick={closeModal}
                                className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Tabs */}
                            <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border border-hairline">
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
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {modalTab === 'rates' && (
                                ratesLoading || !rateProducts ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">Loading special rates…</div>
                                ) : (
                                    <>
                                        {!canSaveRates && (
                                            <p className="text-xs text-primary">You don't have permission to change customer rates.</p>
                                        )}
                                        <SpecialRatesEditor
                                            compact
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
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Name <span className="text-destructive">*</span>
                                </label>
                                <div className="relative">
                                    <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        placeholder="Customer name"
                                        className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Phone <span className="text-destructive">*</span>
                                </label>
                                <div className="relative">
                                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        required
                                        placeholder="+92 300 1234567"
                                        className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Email
                                </label>
                                <div className="relative">
                                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="customer@example.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Address
                                </label>
                                <div className="relative">
                                    <FiMapPin className="absolute left-3 top-3 text-muted-foreground" size={16} />
                                    <textarea
                                        value={form.address}
                                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                                        placeholder="Street, City"
                                        rows={2}
                                        className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground resize-none"
                                    />
                                </div>
                            </div>

                            {/* Opening Balance — only when adding new customer */}
                            {!editingCustomer && (
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">
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
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Previous balance from old system (if any)</p>
                                </div>
                            )}

                            {/* Credit Terms — edit mode only */}
                            {editingCustomer && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">
                                            Credit Days
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.creditDays}
                                            onChange={(e) =>
                                                setForm({ ...form, creditDays: e.target.value })
                                            }
                                            className="w-full px-4 py-2.5 bg-muted/40 border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">
                                            Credit Limit
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.creditLimit}
                                            onChange={(e) =>
                                                setForm({ ...form, creditLimit: e.target.value })
                                            }
                                            className="w-full px-4 py-2.5 bg-muted/40 border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Notes
                                </label>
                                <div className="relative">
                                    <FiFileText className="absolute left-3 top-3 text-muted-foreground" size={16} />
                                    <textarea
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        placeholder="Any notes about this customer..."
                                        rows={3}
                                        className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground resize-none"
                                    />
                                </div>
                            </div>

                            </>)}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2.5 text-muted-foreground hover:bg-[var(--hover-overlay)] rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
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
                    </DialogShell>
            )}

        </div>
    );
};

export default Customers;
