import React, { useState, useEffect, useCallback } from 'react';
import { todayLocalDate, toLocalDateStr } from '../utils/date';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { getVendors, createVendor, updateVendor, deleteVendor } from '../services/api/vendors';
import { getSupplies, getSupplyStats, createSupply, updateSupply, deleteSupply, paySupply, returnSupply } from '../services/api/supplies';
import { getCashBalance } from '../services/api/cashbook';
import { getProducts } from '../services/api/products';
import ProductFormModal from '../components/ProductFormModal';
import { appAlert, appConfirm } from '../components/AppDialog';
import {
    FiPlus,
    FiSearch,
    FiEdit2,
    FiTrash2,
    FiSave,
    FiX,
    FiXCircle,
    FiPackage,
    FiUsers,
    FiBarChart2,
    FiDollarSign,
    FiAlertCircle,
    FiCreditCard,
    FiImage,
    FiCheckCircle,
    FiClock,
    FiMinus,
    FiChevronDown,
    FiBookOpen,
    FiCornerUpLeft,
} from 'react-icons/fi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TODAY = todayLocalDate();

const defaultSupplyForm = () => ({
    vendor: '',
    billNumber: '',
    billDate: TODAY,
    paidAmount: '',
    notes: '',
});

const defaultItem = () => ({ product: '', name: '', qty: 1, unitPrice: '', total: 0 });

const defaultVendorForm = () => ({
    name: '',
    phone: '',
    company: '',
    notes: '',
    openingBalance: 0,
});

// Server error text, plus the item list when the server says stock already went out.
const supplyErrorMessage = (err, fallback) => {
    const data = err.response?.data;
    const lines = (data?.outOfStock || []).map(
        (o) => `• ${o.name}: needs ${o.requested}, only ${o.available} in stock`
    );
    return [data?.message || fallback, ...(lines.length ? ['', ...lines] : [])].join('\n');
};

const PAY_METHODS = [
    { id: 'cash', label: 'Cash' },
    { id: 'bank_transfer', label: 'Bank' },
    { id: 'online', label: 'Online' },
    { id: 'cheque', label: 'Cheque' },
    { id: 'card', label: 'Card' },
];

const RETURN_REASONS = [
    { id: 'defective', label: 'Defective' },
    { id: 'damaged', label: 'Damaged' },
    { id: 'expired', label: 'Expired' },
    { id: 'wrong_item', label: 'Wrong item' },
    { id: 'excess', label: 'Excess' },
    { id: 'other', label: 'Other' },
];

// Units of a supply line that can still go back to the vendor
const returnableQty = (item) => Math.max(0, (item.quantity ?? item.qty ?? 0) - (item.returnedQty || 0));

// Same math as the server: qty × unit price, plus GST on it
const returnLineAmount = (item, qty) => {
    const base = qty * (item.unitPrice || 0);
    const gst = item.gst > 0 ? Math.round(base * item.gst) / 100 : 0;
    return base + gst;
};

const ADD_VENDOR_OPTION = '__add_vendor__';
const ADD_PRODUCT_OPTION = '__add_product__';

const TABS = [
    { id: 'supplies', label: 'Supplies', icon: FiPackage },
    { id: 'vendors', label: 'Vendors', icon: FiUsers },
    { id: 'stats', label: 'Stats', icon: FiBarChart2 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Vendors = () => {
    const navigate = useNavigate();
    const { business } = useBusiness();

    // ── Tab ──────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('supplies');

    // ── Shared loading / error ────────────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ── Vendors list ─────────────────────────────────────────────────────────
    const [vendors, setVendors] = useState([]);

    // ── Products list (for supply item picker) ───────────────────────────────
    const [products, setProducts] = useState([]);

    // ── Supplies list ────────────────────────────────────────────────────────
    const [supplies, setSupplies] = useState([]); // current page only
    const [supplyTotal, setSupplyTotal] = useState(0);
    const [supplyPagination, setSupplyPagination] = useState({ page: 1, totalPages: 1 });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [vendorFilter, setVendorFilter] = useState('');

    // ── Stats ─────────────────────────────────────────────────────────────────
    const [stats, setStats] = useState(null);

    // ── Supply modal ─────────────────────────────────────────────────────────
    const [showSupplyModal, setShowSupplyModal] = useState(false);
    const [supplyCashBalance, setCashBalance] = useState(null);
    const [editingSupply, setEditingSupply] = useState(null);
    const [supplyForm, setSupplyForm] = useState(defaultSupplyForm());
    const [supplyItems, setSupplyItems] = useState([defaultItem()]);
    const [receiptFile, setReceiptFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // ── Pay modal ────────────────────────────────────────────────────────────
    const [showPayModal, setShowPayModal] = useState(false);
    const [payingSupply, setPayingSupply] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('cash');

    // ── Return modal ─────────────────────────────────────────────────────────
    const [returningSupply, setReturningSupply] = useState(null);
    const [returnLines, setReturnLines] = useState({}); // { [productId]: { qty, reason } }
    const [returnNote, setReturnNote] = useState('');
    const [returning, setReturning] = useState(false);

    const [toast, setToast] = useState('');
    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(''), 4500);
    };
    const [paying, setPaying] = useState(false);

    // ── Vendor modal ─────────────────────────────────────────────────────────
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [vendorForm, setVendorForm] = useState(defaultVendorForm());
    const [vendorSubmitting, setVendorSubmitting] = useState(false);
    const [supplyVendorRequest, setSupplyVendorRequest] = useState(false);

    // ── Quick Add Product modal (triggered from Add Supply item picker) ──────
    const [showProductModal, setShowProductModal] = useState(false);
    const [productModalTargetIndex, setProductModalTargetIndex] = useState(null);

    // ── Currency formatter ───────────────────────────────────────────────────
    const formatCurrency = (amount) =>
        `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;

    // =========================================================================
    // Data fetching
    // =========================================================================

    const fetchVendors = useCallback(async () => {
        try {
            const res = await getVendors();
            const data = res.data;
            setVendors(Array.isArray(data) ? data : data?.vendors || []);
        } catch (err) {
            console.error('Error fetching vendors:', err);
        }
    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            const res = await getProducts();
            const data = res.data;
            setProducts(Array.isArray(data) ? data : data?.products || []);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    }, []);

    // One page at a time (limit ≤ 100). Money stats come from getSupplyStats
    // (server-side), so paging the list here doesn't affect any totals.
    const fetchSupplies = useCallback(async (pageNum = 1) => {
        setLoading(true);
        setError(null);
        try {
            const params = { page: pageNum, limit: 50 };
            if (statusFilter !== 'all') params.paymentStatus = statusFilter;
            if (vendorFilter) params.vendor = vendorFilter;
            const res = await getSupplies(params);
            const data = res.data;
            const list = Array.isArray(data?.supplies)
                ? data.supplies
                : (Array.isArray(data) ? data : []);
            setSupplies(list);
            setSupplyTotal(data?.total ?? list.length);
            setSupplyPagination({ page: data?.page ?? pageNum, totalPages: data?.totalPages ?? 1 });
        } catch (err) {
            console.error('Error fetching supplies:', err);
            setError(err.response?.data?.message || 'Failed to load supplies');
            setSupplies([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, vendorFilter]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await getSupplyStats();
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchVendors();
        fetchProducts();
    }, [fetchVendors, fetchProducts]);

    useEffect(() => {
        if (activeTab === 'supplies') fetchSupplies();
    }, [activeTab, fetchSupplies]);

    // Vendor totals change with every supply, payment and return — reload on tab switch
    useEffect(() => {
        if (activeTab === 'vendors') fetchVendors();
    }, [activeTab, fetchVendors]);

    useEffect(() => {
        // Both tabs show money cards sourced from stats, so load it for either.
        if (activeTab === 'supplies' || activeTab === 'stats') fetchStats();
    }, [activeTab, fetchStats]);

    // =========================================================================
    // Derived values
    // =========================================================================

    const productCategories = [...new Set(products.map((p) => p.category).filter(Boolean))];

    const filteredSupplies = supplies.filter((s) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const vendorName =
            typeof s.vendor === 'object'
                ? (s.vendor?.name || '').toLowerCase()
                : (s.vendor || '').toLowerCase();
        return (
            vendorName.includes(q) ||
            (s.billNumber || '').toLowerCase().includes(q)
        );
    });

    // Money cards use server-side stats (getSupplyStats), NOT the paginated list —
    // summing only the current page would undercount once there are >50 supplies.
    const outstandingTotal = stats?.overall?.totalRemaining ?? 0;
    const thisMonthTotal = stats?.thisMonth?.totalAmount ?? stats?.thisMonth?.total ?? 0;

    // =========================================================================
    // Supply modal handlers
    // =========================================================================

    const openSupplyModal = (supply = null) => {
        if (supply) {
            setEditingSupply(supply);
            setSupplyForm({
                vendor: supply.vendor?._id || supply.vendor || '',
                billNumber: supply.billNumber || '',
                billDate: supply.billDate
                    ? toLocalDateStr(supply.billDate)
                    : TODAY,
                paidAmount: supply.paidAmount ?? '',
                notes: supply.notes || '',
            });
            setSupplyItems(
                supply.items?.length
                    ? supply.items.map((i) => ({
                          product: (typeof i.product === 'object' ? i.product?._id : i.product) || '',
                          name: i.name || '',
                          qty: i.qty ?? i.quantity ?? 1,
                          unitPrice: i.unitPrice ?? i.price ?? '',
                          total: i.total || 0,
                      }))
                    : [defaultItem()]
            );
        } else {
            setEditingSupply(null);
            setSupplyForm(defaultSupplyForm());
            setSupplyItems([defaultItem()]);
        }
        setReceiptFile(null);
        getCashBalance().then(res => setCashBalance(res.data?.balance ?? null)).catch(() => setCashBalance(null));
        setShowSupplyModal(true);
        // Refresh products in case new ones were added
        fetchProducts();
    };

    const closeSupplyModal = () => {
        setShowSupplyModal(false);
        setEditingSupply(null);
        setReceiptFile(null);
    };

    const updateItem = (index, field, value) => {
        setSupplyItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            const qty = parseFloat(field === 'qty' ? value : next[index].qty) || 0;
            const price = parseFloat(field === 'unitPrice' ? value : next[index].unitPrice) || 0;
            next[index].total = qty * price;
            return next;
        });
    };

    const selectProductForItem = (index, productId) => {
        setSupplyItems((prev) => {
            const next = [...prev];
            const prod = products.find((p) => p._id === productId);
            const currentQty = parseFloat(next[index].qty) || 1;
            const newUnitPrice = prod?.costPrice ? prod.costPrice : next[index].unitPrice || '';
            next[index] = {
                ...next[index],
                product: productId,
                name: prod?.name || '',
                unitPrice: newUnitPrice,
                total: (parseFloat(newUnitPrice) || 0) * currentQty,
            };
            return next;
        });
    };

    const handleVendorSelectChange = (value) => {
        if (value === ADD_VENDOR_OPTION) {
            setSupplyVendorRequest(true);
            openVendorModal();
            return;
        }
        setSupplyForm((prev) => ({ ...prev, vendor: value }));
    };

    const handleProductSelectChange = (index, value) => {
        if (value === ADD_PRODUCT_OPTION) {
            setProductModalTargetIndex(index);
            setShowProductModal(true);
            return;
        }
        selectProductForItem(index, value);
    };

    const addItem = () => setSupplyItems((prev) => [...prev, defaultItem()]);

    const removeItem = (index) =>
        setSupplyItems((prev) => prev.filter((_, i) => i !== index));

    const itemsTotal = supplyItems.reduce((acc, i) => acc + (i.total || 0), 0);

    // A supply with returns keeps its items (the server rejects changes);
    // bill no / date / notes can still be edited.
    const itemsLocked = !!editingSupply && (editingSupply.returns?.length || 0) > 0;

    const handleSupplySubmit = async (e) => {
        e.preventDefault();

        // Validate: every item must have a product picked
        const missingProduct = supplyItems.some((i) => !i.product);
        if (missingProduct) {
            appAlert('Please select a product for every supply item.');
            return;
        }

        // Validate: paid amount cannot exceed total (create only — paid is
        // read-only when editing; payments go through Pay)
        const paid = editingSupply ? 0 : Number(supplyForm.paidAmount) || 0;
        if (paid > itemsTotal) {
            appAlert(`Paid amount (${paid}) cannot exceed items total (${itemsTotal}).`);
            return;
        }

        // Validate: cannot pay more cash than available
        if (paid > 0 && supplyCashBalance != null && paid > supplyCashBalance) {
            appAlert(`Insufficient cash. Available balance: ${formatCurrency(supplyCashBalance)}`);
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            // Vendor is fixed at creation — the backend rejects `vendor` on update
            if (!editingSupply) formData.append('vendor', supplyForm.vendor);
            formData.append('billNumber', supplyForm.billNumber);
            formData.append('billDate', supplyForm.billDate);
            // Paid amount can't be edited (server returns 400) — only sent on create
            if (!editingSupply) formData.append('paidAmount', supplyForm.paidAmount || 0);
            formData.append('notes', supplyForm.notes);
            if (!itemsLocked) {
                formData.append(
                    'items',
                    JSON.stringify(
                        supplyItems.map((i) => ({
                            product: i.product,
                            name: i.name,
                            quantity: Number(i.qty),
                            unitPrice: Number(i.unitPrice),
                            total: i.total,
                        }))
                    )
                );
            }
            if (receiptFile) formData.append('receiptImage', receiptFile);

            if (editingSupply) {
                await updateSupply(editingSupply._id, formData);
            } else {
                await createSupply(formData);
            }

            closeSupplyModal();
            fetchSupplies();
            fetchStats();
        } catch (err) {
            console.error('Error saving supply:', err);
            appAlert(supplyErrorMessage(err, 'Failed to save supply'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSupply = async (id) => {
        if (!(await appConfirm('Delete this supply record?', { danger: true }))) return;
        try {
            await deleteSupply(id);
            fetchSupplies();
            fetchStats();
        } catch (err) {
            console.error('Error deleting supply:', err);
            appAlert(supplyErrorMessage(err, 'Failed to delete supply'));
        }
    };

    // =========================================================================
    // Pay modal handlers
    // =========================================================================

    const openPayModal = (supply) => {
        setPayingSupply(supply);
        setPayAmount('');
        setPayMethod('cash');
        setShowPayModal(true);
    };

    const handlePay = async (e) => {
        e.preventDefault();
        if (!payAmount || Number(payAmount) <= 0) return;
        setPaying(true);
        try {
            await paySupply(payingSupply._id, {
                amount: Number(payAmount),
                method: payMethod,
            });
            setShowPayModal(false);
            setPayingSupply(null);
            fetchSupplies();
            fetchStats();
        } catch (err) {
            console.error('Error recording payment:', err);
            appAlert(err.response?.data?.message || 'Failed to record payment');
        } finally {
            setPaying(false);
        }
    };

    // =========================================================================
    // Return modal handlers
    // =========================================================================

    const itemProductId = (item) => String(typeof item.product === 'object' ? item.product?._id : item.product);

    // What can go back now: not more than this supply delivered (minus earlier
    // returns), and not more than is still in stock (the rest was sold).
    const returnLimit = (item) => {
        const fromSupply = returnableQty(item);
        const prod = products.find((p) => p._id === itemProductId(item));
        const inStock = prod?.trackStock ? Math.max(0, Math.floor(prod.stockQuantity || 0)) : Infinity;
        return { max: Math.min(fromSupply, inStock), fromSupply, inStock };
    };

    const openReturnModal = (supply) => {
        fetchProducts(); // fresh stock for the limits
        const lines = {};
        for (const item of supply.items || []) lines[itemProductId(item)] = { qty: '', reason: 'defective' };
        setReturnLines(lines);
        setReturnNote('');
        setReturningSupply(supply);
    };

    const setReturnLine = (productId, patch) =>
        setReturnLines((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));

    const returnSelection = (returningSupply?.items || [])
        .map((item) => {
            const productId = itemProductId(item);
            const line = returnLines[productId] || {};
            const qty = Math.min(parseInt(line.qty, 10) || 0, returnLimit(item).max);
            return { item, productId, qty, reason: line.reason || 'defective', amount: returnLineAmount(item, qty) };
        })
        .filter((l) => l.qty > 0);
    const returnTotal = returnSelection.reduce((sum, l) => sum + l.amount, 0);

    const handleReturn = async () => {
        if (returnSelection.length === 0) return;
        const summary = returnSelection.map((l) => `• ${l.item.name} × ${l.qty} — ${formatCurrency(l.amount)}`).join('\n');
        const ok = await appConfirm(
            `Return these items to the vendor?\n\n${summary}\n\nTotal: ${formatCurrency(returnTotal)}\nStock goes down by the returned quantity.`,
            { confirmText: 'Return items' }
        );
        if (!ok) return;
        setReturning(true);
        try {
            const res = await returnSupply(returningSupply._id, {
                items: returnSelection.map((l) => ({ product: l.productId, quantity: l.qty, reason: l.reason })),
                note: returnNote.trim(),
            });
            const moves = res.data?.creditSettlement || [];
            const balance = res.data?.supply?.balance;
            const parts = [`Returned ${formatCurrency(res.data?.totalRefund ?? returnTotal)}`];
            parts.push(...moves.map((m) => `${formatCurrency(m.amount)} credit used on Supply #${m.toNumber}`));
            if (balance < -0.005) parts.push(`Vendor owes you ${formatCurrency(-balance)}`);
            showToast(parts.join(' · '));
            setReturningSupply(null);
            fetchSupplies(supplyPagination.page);
            fetchStats();
            fetchVendors();
        } catch (err) {
            console.error('Error returning supply:', err);
            appAlert(supplyErrorMessage(err, 'Failed to return items'));
        } finally {
            setReturning(false);
        }
    };

    // =========================================================================
    // Vendor modal handlers
    // =========================================================================

    const openVendorModal = (vendor = null) => {
        if (vendor) {
            setEditingVendor(vendor);
            setVendorForm({
                name: vendor.name || '',
                phone: vendor.phone || '',
                company: vendor.company || '',
                notes: vendor.notes || '',
            });
        } else {
            setEditingVendor(null);
            setVendorForm(defaultVendorForm());
        }
        setShowVendorModal(true);
    };

    const closeVendorModal = () => {
        setShowVendorModal(false);
        setEditingVendor(null);
        setSupplyVendorRequest(false);
    };

    const handleVendorSubmit = async (e) => {
        e.preventDefault();
        setVendorSubmitting(true);
        try {
            let newVendor = null;
            if (editingVendor) {
                const { openingBalance, ...updateData } = vendorForm;
                await updateVendor(editingVendor._id, updateData);
            } else {
                const payload = { ...vendorForm };
                payload.openingBalance = Number(payload.openingBalance) || 0;
                const res = await createVendor(payload);
                newVendor = res?.data?.vendor || res?.data;
            }
            const wasSupplyRequest = supplyVendorRequest;
            setShowVendorModal(false);
            setEditingVendor(null);
            setSupplyVendorRequest(false);
            await fetchVendors();
            if (wasSupplyRequest && newVendor?._id) {
                setSupplyForm((prev) => ({ ...prev, vendor: newVendor._id }));
            }
        } catch (err) {
            console.error('Error saving vendor:', err);
            appAlert(err.response?.data?.message || 'Failed to save vendor');
        } finally {
            setVendorSubmitting(false);
        }
    };

    // =========================================================================
    // Quick Add Product modal handlers (from Add Supply item picker)
    // =========================================================================

    const closeProductModal = () => {
        setShowProductModal(false);
        setProductModalTargetIndex(null);
    };

    const handleProductSaved = async (newProduct) => {
        const targetIndex = productModalTargetIndex;
        setProductModalTargetIndex(null);
        await fetchProducts();
        if (newProduct?._id && targetIndex !== null) {
            setSupplyItems((prev) => {
                const next = [...prev];
                const currentQty = parseFloat(next[targetIndex].qty) || 1;
                const unitPrice = newProduct.costPrice || next[targetIndex].unitPrice || '';
                next[targetIndex] = {
                    ...next[targetIndex],
                    product: newProduct._id,
                    name: newProduct.name || '',
                    unitPrice,
                    total: (parseFloat(unitPrice) || 0) * currentQty,
                };
                return next;
            });
        }
    };

    const handleDeleteVendor = async (id) => {
        if (!(await appConfirm('Delete this vendor? This will not delete their supply records.', { danger: true }))) return;
        try {
            await deleteVendor(id);
            fetchVendors();
        } catch (err) {
            console.error('Error deleting vendor:', err);
            appAlert(err.response?.data?.message || 'Failed to delete vendor');
        }
    };

    const drillToVendor = (vendorId) => {
        navigate(`/vendors/${vendorId}/ledger`);
    };

    // =========================================================================
    // Status badge helper
    // =========================================================================

    const getStatusBadge = (status) => {
        switch (status) {
            case 'paid':
                return {
                    icon: FiCheckCircle,
                    color: 'bg-green-100 text-green-700 dark:bg-[rgba(52,232,161,0.15)] dark:text-d-green',
                    label: 'Paid',
                };
            case 'partial':
                return {
                    icon: FiClock,
                    color: 'bg-yellow-100 text-yellow-700 dark:bg-[rgba(255,210,100,0.15)] dark:text-d-accent',
                    label: 'Partial',
                };
            default:
                return {
                    icon: FiAlertCircle,
                    color: 'bg-red-100 text-red-700 dark:bg-[rgba(255,107,107,0.15)] dark:text-d-red',
                    label: 'Unpaid',
                };
        }
    };

    // =========================================================================
    // Render helpers
    // =========================================================================

    const renderLoadingSpinner = (label = 'Loading...') => (
        <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 dark:text-d-muted">{label}</p>
            </div>
        </div>
    );

    const renderError = () => (
        <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-[rgba(255,107,107,0.15)] rounded-full flex items-center justify-center">
                    <FiXCircle size={32} className="text-red-500 dark:text-d-red" />
                </div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-d-heading">Failed to load data</h2>
                <p className="text-slate-500 dark:text-d-muted">{error}</p>
                <button
                    onClick={() => fetchSupplies(1)}
                    className="px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
                >
                    Try Again
                </button>
            </div>
        </div>
    );

    // =========================================================================
    // TAB: Supplies
    // =========================================================================

    const renderSuppliesTab = () => (
        <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                    <p className="text-sm text-slate-500 dark:text-d-muted">Total Outstanding</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-d-red">{formatCurrency(outstandingTotal)}</p>
                </div>
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                    <p className="text-sm text-slate-500 dark:text-d-muted">This Month</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{formatCurrency(thisMonthTotal)}</p>
                </div>
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                    <p className="text-sm text-slate-500 dark:text-d-muted">Total Supplies</p>
                    <p className="text-2xl font-bold text-primary-600">{supplyTotal}</p>
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
                        placeholder="Search by vendor or bill #..."
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                    />
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border">
                    {['all', 'unpaid', 'partial', 'paid'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                                statusFilter === s
                                    ? 'bg-primary-500 dark:bg-d-accent text-white dark:text-d-card'
                                    : 'text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {vendorFilter && (
                    <button
                        onClick={() => setVendorFilter('')}
                        className="flex items-center gap-1 px-3 py-2 bg-primary-50 text-primary-600 border border-primary-200 rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors"
                    >
                        <FiX size={14} />
                        Clear Vendor Filter
                    </button>
                )}
            </div>

            {/* Table */}
            {loading ? (
                renderLoadingSpinner('Loading supplies...')
            ) : error ? (
                renderError()
            ) : (
                <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-d-glass">
                            <tr>
                                <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Date</th>
                                <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Vendor</th>
                                <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Bill #</th>
                                <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Items</th>
                                <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Total</th>
                                <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Paid</th>
                                <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Remaining</th>
                                <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Status</th>
                                <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSupplies.map((supply) => {
                                const badge = getStatusBadge(supply.paymentStatus);
                                // remainingAmount already accounts for returns and credit
                                const remaining = supply.remainingAmount || 0;
                                const vendorOwes = (supply.balance || 0) < 0 ? -supply.balance : 0;
                                const canDelete = !(supply.payments?.length > 0) && !(supply.returns?.length > 0);
                                const vendorName =
                                    typeof supply.vendor === 'object'
                                        ? supply.vendor?.name || '—'
                                        : supply.vendor || '—';
                                return (
                                    <tr
                                        key={supply._id}
                                        className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                                    >
                                        <td className="py-4 px-6 text-slate-500 dark:text-d-muted text-sm whitespace-nowrap">
                                            {new Date(supply.billDate || supply.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 px-6 font-medium text-slate-800 dark:text-d-heading">
                                            {vendorName}
                                        </td>
                                        <td className="py-4 px-6 text-slate-600 dark:text-d-text text-sm">
                                            {supply.billNumber || '—'}
                                        </td>
                                        <td className="py-4 px-6 text-slate-600 dark:text-d-text text-sm">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-d-glass text-slate-600 dark:text-d-muted rounded-full text-xs font-medium">
                                                {supply.items?.length || 0} item{supply.items?.length !== 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right font-semibold text-slate-800 dark:text-d-heading">
                                            {formatCurrency(supply.totalAmount)}
                                            {(supply.totalReturned || 0) > 0 && (
                                                <div className="text-[11px] font-normal text-amber-600 dark:text-d-accent whitespace-nowrap">
                                                    − {formatCurrency(supply.totalReturned)} returned
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right text-green-600 dark:text-d-green font-medium">
                                            {formatCurrency(supply.paidAmount)}
                                            {(supply.creditApplied || 0) > 0 && (
                                                <div className="text-[11px] italic font-normal text-slate-400 dark:text-d-faint whitespace-nowrap">
                                                    incl. {formatCurrency(supply.creditApplied)} vendor credit
                                                </div>
                                            )}
                                        </td>
                                        <td className={`py-4 px-6 text-right font-semibold ${remaining > 0 ? 'text-red-600 dark:text-d-red' : 'text-slate-400 dark:text-d-faint'}`}>
                                            {formatCurrency(remaining)}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col items-start gap-1">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}
                                                >
                                                    <badge.icon size={11} />
                                                    {badge.label}
                                                </span>
                                                {vendorOwes > 0 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-emerald-50 text-emerald-700 dark:bg-[rgba(52,232,161,0.12)] dark:text-d-green">
                                                        Vendor owes you {formatCurrency(vendorOwes)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-end gap-1">
                                                {supply.paymentStatus !== 'paid' && (
                                                    <button
                                                        onClick={() => openPayModal(supply)}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 dark:bg-[rgba(52,232,161,0.1)] text-green-600 dark:text-d-green hover:bg-green-100 dark:hover:bg-[rgba(52,232,161,0.18)] rounded-lg transition-colors"
                                                        title="Record Payment"
                                                    >
                                                        <FiCreditCard size={13} />
                                                        Pay
                                                    </button>
                                                )}
                                                {(supply.items || []).some((i) => returnableQty(i) > 0) && (
                                                    <button
                                                        onClick={() => openReturnModal(supply)}
                                                        className="p-2 text-slate-500 dark:text-d-muted hover:text-amber-600 dark:hover:text-d-accent hover:bg-amber-50 dark:hover:bg-[rgba(255,185,50,0.1)] rounded-lg transition-colors"
                                                        title="Return items to vendor"
                                                    >
                                                        <FiCornerUpLeft size={15} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openSupplyModal(supply)}
                                                    className="p-2 text-slate-500 dark:text-d-muted hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <FiEdit2 size={15} />
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteSupply(supply._id)}
                                                        className="p-2 text-slate-500 dark:text-d-muted hover:text-red-500 dark:hover:text-d-red hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredSupplies.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                            <FiPackage size={48} />
                            <p className="mt-4 text-base">No supplies found</p>
                            <p className="text-sm mt-1">Add your first supply record to get started</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {supplyPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-d-border">
                            <p className="text-sm text-slate-500 dark:text-d-muted">
                                Page {supplyPagination.page} of {supplyPagination.totalPages} ({supplyTotal} supplies)
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={supplyPagination.page <= 1 || loading}
                                    onClick={() => fetchSupplies(supplyPagination.page - 1)}
                                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={supplyPagination.page >= supplyPagination.totalPages || loading}
                                    onClick={() => fetchSupplies(supplyPagination.page + 1)}
                                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );

    // =========================================================================
    // TAB: Vendors
    // =========================================================================

    const renderVendorsTab = () => (
        <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border overflow-hidden">
            <table className="w-full">
                <thead className="bg-slate-50 dark:bg-d-glass">
                    <tr>
                        <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Name</th>
                        <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Company</th>
                        <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Phone</th>
                        <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Total Business</th>
                        <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Total Paid</th>
                        <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Remaining</th>
                        <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Supplies</th>
                        <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {vendors.map((vendor) => {
                        const remaining = vendor.totalRemaining || 0;
                        const credit = vendor.totalCredit || 0;
                        return (
                            <tr
                                key={vendor._id}
                                className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
                                onClick={() => drillToVendor(vendor._id)}
                            >
                                <td className="py-4 px-6 font-semibold text-slate-800 dark:text-d-heading">
                                    {vendor.name}
                                </td>
                                <td className="py-4 px-6 text-slate-600 dark:text-d-text">
                                    {vendor.company || '—'}
                                </td>
                                <td className="py-4 px-6 text-slate-600 dark:text-d-text">
                                    {vendor.phone || '—'}
                                </td>
                                <td className="py-4 px-6 text-right font-medium text-slate-800 dark:text-d-heading">
                                    {formatCurrency(vendor.totalBusiness)}
                                </td>
                                <td className="py-4 px-6 text-right text-green-600 dark:text-d-green font-medium">
                                    {formatCurrency(vendor.totalPaid)}
                                </td>
                                <td className="py-4 px-6 text-right font-semibold">
                                    <span className={remaining > 0 ? 'text-red-600 dark:text-d-red' : 'text-slate-500 dark:text-d-muted'}>
                                        {formatCurrency(remaining)}
                                    </span>
                                    {credit > 0 && (
                                        <div className="text-[11px] font-medium text-emerald-600 dark:text-d-green whitespace-nowrap">
                                            Credit: {formatCurrency(credit)} (vendor owes you)
                                        </div>
                                    )}
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <span className="px-2 py-1 bg-slate-100 dark:bg-d-glass text-slate-600 dark:text-d-muted rounded-full text-xs font-medium">
                                        {vendor.supplyCount ?? 0}
                                    </span>
                                </td>
                                <td className="py-4 px-6">
                                    <div
                                        className="flex items-center justify-end gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={() => navigate(`/vendors/${vendor._id}/ledger`)}
                                            className="p-2 text-slate-500 dark:text-d-muted hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-[rgba(91,156,246,0.1)] rounded-lg transition-colors"
                                            title="View Ledger"
                                        >
                                            <FiBookOpen size={15} />
                                        </button>
                                        <button
                                            onClick={() => openVendorModal(vendor)}
                                            className="p-2 text-slate-500 dark:text-d-muted hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteVendor(vendor._id)}
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
            {vendors.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                    <FiUsers size={48} />
                    <p className="mt-4 text-base">No vendors yet</p>
                    <p className="text-sm mt-1">Add vendors to start tracking supply purchases</p>
                </div>
            )}
        </div>
    );

    // =========================================================================
    // TAB: Stats
    // =========================================================================

    const renderStatsTab = () => {
        if (!stats) return renderLoadingSpinner('Loading stats...');

        const overall = stats.overall || {};
        const thisMonth = stats.thisMonth || {};
        const byVendor = stats.byVendor || [];
        const byStatus = stats.byStatus || [];

        const statusConfig = {
            paid: {
                color: 'bg-green-100 text-green-700 dark:bg-[rgba(52,232,161,0.15)] dark:text-d-green',
                label: 'Paid',
            },
            partial: {
                color: 'bg-yellow-100 text-yellow-700 dark:bg-[rgba(255,210,100,0.15)] dark:text-d-accent',
                label: 'Partial',
            },
            unpaid: {
                color: 'bg-red-100 text-red-700 dark:bg-[rgba(255,107,107,0.15)] dark:text-d-red',
                label: 'Unpaid',
            },
        };

        return (
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-red-100 dark:bg-[rgba(255,107,107,0.15)] rounded-xl flex items-center justify-center">
                                <FiAlertCircle className="text-red-500 dark:text-d-red" size={20} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Total Outstanding</p>
                        </div>
                        <p className="text-2xl font-bold text-red-600 dark:text-d-red">
                            {formatCurrency(overall.totalRemaining ?? overall.totalOutstanding ?? overall.outstanding ?? 0)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-[rgba(96,165,250,0.15)] rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-blue-500 dark:text-[#60a5fa]" size={20} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">This Month Total</p>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                            {formatCurrency(thisMonth.totalAmount || thisMonth.total || 0)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                                <FiPackage className="text-primary-500" size={20} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Total Supplies</p>
                        </div>
                        <p className="text-2xl font-bold text-primary-600">
                            {overall.totalSupplies || overall.count || 0}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-purple-100 dark:bg-[rgba(168,85,247,0.15)] rounded-xl flex items-center justify-center">
                                <FiUsers className="text-purple-500 dark:text-[#c084fc]" size={20} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Total Vendors</p>
                        </div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-[#c084fc]">{vendors.length}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Vendors */}
                    <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-d-border">
                            <h3 className="font-semibold text-slate-800 dark:text-d-heading">Top Vendors by Outstanding</h3>
                        </div>
                        {byVendor.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-d-faint">
                                <FiUsers size={36} />
                                <p className="mt-3 text-sm">No vendor data available</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-d-glass">
                                    <tr>
                                        <th className="text-left py-3 px-6 text-sm font-medium text-slate-600 dark:text-d-muted">Vendor</th>
                                        <th className="text-right py-3 px-6 text-sm font-medium text-slate-600 dark:text-d-muted">Total</th>
                                        <th className="text-right py-3 px-6 text-sm font-medium text-slate-600 dark:text-d-muted">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byVendor.slice(0, 8).map((v, idx) => (
                                        <tr
                                            key={v._id || idx}
                                            className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                                        >
                                            <td className="py-3 px-6 font-medium text-slate-800 dark:text-d-heading">
                                                {v.name || v.vendorName || '—'}
                                            </td>
                                            <td className="py-3 px-6 text-right text-slate-700 dark:text-d-text">
                                                {formatCurrency(v.totalAmount || v.total || 0)}
                                            </td>
                                            <td className="py-3 px-6 text-right font-semibold">
                                                <span
                                                    className={
                                                        (v.remaining || v.totalRemaining || 0) > 0
                                                            ? 'text-red-600 dark:text-d-red'
                                                            : 'text-green-600 dark:text-d-green'
                                                    }
                                                >
                                                    {formatCurrency(v.remaining || v.totalRemaining || 0)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Status Breakdown */}
                    <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-d-border overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-d-border">
                            <h3 className="font-semibold text-slate-800 dark:text-d-heading">Payment Status Breakdown</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {byStatus.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-d-faint">
                                    <FiBarChart2 size={36} />
                                    <p className="mt-3 text-sm">No status data available</p>
                                </div>
                            ) : (
                                byStatus.map((s, idx) => {
                                    const cfg =
                                        statusConfig[s._id] ||
                                        statusConfig[s.status] ||
                                        statusConfig['unpaid'];
                                    const statusKey = s._id || s.status || 'unpaid';
                                    return (
                                        <div
                                            key={statusKey || idx}
                                            className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-d-glass border border-slate-100 dark:border-d-border"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${cfg.color}`}
                                                >
                                                    {cfg.label}
                                                </span>
                                                <span className="text-sm text-slate-500 dark:text-d-muted">
                                                    {s.count || 0} record{(s.count || 0) !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <span className="font-semibold text-slate-800 dark:text-d-heading">
                                                {formatCurrency(s.totalAmount || s.total || 0)}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // =========================================================================
    // Main render
    // =========================================================================

    return (
        <div className="p-6 animate-fadeIn bg-slate-50 dark:bg-d-bg min-h-full">
            {/* ── Page Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Vendors & Supplies</h1>
                    <p className="text-slate-500 dark:text-d-muted">Manage suppliers and incoming inventory purchases</p>
                </div>

                {activeTab === 'supplies' && (
                    <button
                        onClick={() => openSupplyModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
                    >
                        <FiPlus />
                        Add Supply
                    </button>
                )}

                {activeTab === 'vendors' && (
                    <button
                        onClick={() => openVendorModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
                    >
                        <FiPlus />
                        Add Vendor
                    </button>
                )}
            </div>

            {/* ── Tab Bar ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border mb-6 w-fit">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'bg-primary-500 dark:bg-d-accent text-white dark:text-d-card shadow-sm'
                                : 'text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover'
                        }`}
                    >
                        <tab.icon size={15} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ──────────────────────────────────────────────── */}
            {activeTab === 'supplies' && renderSuppliesTab()}
            {activeTab === 'vendors' && renderVendorsTab()}
            {activeTab === 'stats' && renderStatsTab()}

            {/* ================================================================
                MODAL: Add / Edit Supply
            ================================================================ */}
            {showSupplyModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border sticky top-0 bg-white dark:bg-d-card z-10">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                {editingSupply ? 'Edit Supply' : 'Add Supply'}
                            </h3>
                            <button
                                onClick={closeSupplyModal}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-500 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSupplySubmit} className="p-6 space-y-5">
                            {/* Vendor + Bill Number */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                        Vendor *
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={supplyForm.vendor}
                                            onChange={(e) => handleVendorSelectChange(e.target.value)}
                                            required
                                            disabled={!!editingSupply}
                                            className="appearance-none w-full px-4 py-2 pr-10 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Select vendor...</option>
                                            {vendors.map((v) => (
                                                <option key={v._id} value={v._id}>
                                                    {v.name}
                                                    {v.company ? ` — ${v.company}` : ''}
                                                </option>
                                            ))}
                                            {!editingSupply && <option value={ADD_VENDOR_OPTION}>+ Add New Vendor</option>}
                                        </select>
                                        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-muted" />
                                        {editingSupply && (
                                            <p className="mt-1 text-xs text-slate-500 dark:text-d-muted">Vendor cannot be changed after a supply is created.</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                        Bill Number
                                    </label>
                                    <input
                                        type="text"
                                        value={supplyForm.billNumber}
                                        onChange={(e) =>
                                            setSupplyForm({ ...supplyForm, billNumber: e.target.value })
                                        }
                                        placeholder="e.g. INV-1023"
                                        className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                    />
                                </div>
                            </div>

                            {/* Bill Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                        Bill Date
                                    </label>
                                    <input
                                        type="date"
                                        value={supplyForm.billDate}
                                        onChange={(e) =>
                                            setSupplyForm({ ...supplyForm, billDate: e.target.value })
                                        }
                                        className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-d-text">
                                            Paid Amount
                                        </label>
                                        {!editingSupply && supplyCashBalance != null && (
                                            <span className={`text-xs font-medium ${
                                                (Number(supplyForm.paidAmount) || 0) > supplyCashBalance
                                                    ? 'text-red-500 dark:text-d-red'
                                                    : 'text-slate-400 dark:text-d-faint'
                                            }`}>
                                                Cash: {supplyCashBalance < 0 ? '-' : ''}{formatCurrency(Math.abs(supplyCashBalance))}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={supplyForm.paidAmount}
                                        onChange={(e) =>
                                            setSupplyForm({ ...supplyForm, paidAmount: e.target.value })
                                        }
                                        readOnly={!!editingSupply}
                                        placeholder="0"
                                        className={`w-full px-4 py-2 bg-white dark:bg-d-bg border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint read-only:opacity-60 read-only:cursor-not-allowed read-only:focus:ring-0 ${
                                            !editingSupply && (Number(supplyForm.paidAmount) || 0) > supplyCashBalance && supplyCashBalance != null
                                                ? 'border-red-400 dark:border-red-500'
                                                : 'border-slate-200 dark:border-d-border'
                                        }`}
                                    />
                                    {editingSupply && (
                                        <p className="mt-1 text-xs text-slate-500 dark:text-d-muted">Use "Pay" to record a payment.</p>
                                    )}
                                </div>
                            </div>

                            {/* Items Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-d-text">
                                        Items *
                                    </label>
                                    {!itemsLocked && (
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                                        >
                                            <FiPlus size={14} />
                                            Add Item
                                        </button>
                                    )}
                                </div>

                                {itemsLocked && (
                                    <div className="mb-3 p-3 bg-slate-50 dark:bg-d-glass border border-slate-200 dark:border-d-border rounded-xl text-xs text-slate-600 dark:text-d-muted">
                                        This supply has returns, so its items can't be changed. Bill number, date and notes can still be edited.
                                    </div>
                                )}

                                {/* Items Header */}
                                <div className="grid grid-cols-12 gap-2 mb-2 px-1">
                                    <span className="col-span-5 text-xs text-slate-500 dark:text-d-muted font-medium">Product</span>
                                    <span className="col-span-2 text-xs text-slate-500 dark:text-d-muted font-medium">Qty</span>
                                    <span className="col-span-2 text-xs text-slate-500 dark:text-d-muted font-medium">Unit Price</span>
                                    <span className="col-span-2 text-xs text-slate-500 dark:text-d-muted font-medium">Total</span>
                                    <span className="col-span-1" />
                                </div>

                                {products.length === 0 && (
                                    <div className="mb-3 p-3 bg-yellow-50 dark:bg-[rgba(255,210,100,0.08)] border border-yellow-200 dark:border-[rgba(255,210,100,0.22)] rounded-xl text-xs text-yellow-800 dark:text-d-accent">
                                        No products found. Please add products first from the Products screen, then come back to record a supply.
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {supplyItems.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-5 relative">
                                                <select
                                                    value={item.product}
                                                    onChange={(e) => handleProductSelectChange(idx, e.target.value)}
                                                    required
                                                    disabled={itemsLocked}
                                                    className="disabled:opacity-60 disabled:cursor-not-allowed appearance-none w-full px-3 py-2 pr-9 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                                >
                                                    <option value="">Select product…</option>
                                                    {products
                                                        .filter((p) => p._id === item.product || !supplyItems.some((si, si_idx) => si_idx !== idx && si.product === p._id))
                                                        .map((p) => (
                                                        <option key={p._id} value={p._id}>
                                                            {p.name}
                                                            {p.trackStock ? ` (stock: ${p.stockQuantity ?? 0})` : ''}
                                                        </option>
                                                    ))}
                                                    <option value={ADD_PRODUCT_OPTION}>+ Add New Product</option>
                                                </select>
                                                <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-muted" />
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.qty}
                                                onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                                                disabled={itemsLocked}
                                                className="disabled:opacity-60 disabled:cursor-not-allowed col-span-2 px-3 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.unitPrice}
                                                onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                                                placeholder="0"
                                                required
                                                disabled={itemsLocked}
                                                className="disabled:opacity-60 disabled:cursor-not-allowed col-span-2 px-3 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                            />
                                            <div className="col-span-2 px-3 py-2 bg-slate-50 dark:bg-d-glass border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-600 dark:text-d-text font-medium text-right">
                                                {item.total.toLocaleString()}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(idx)}
                                                disabled={supplyItems.length === 1 || itemsLocked}
                                                className="col-span-1 p-2 text-slate-400 dark:text-d-faint hover:text-red-500 dark:hover:text-d-red hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                                            >
                                                <FiMinus size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Items Total */}
                                <div className="flex justify-end mt-3 pt-3 border-t border-slate-100 dark:border-d-border">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-slate-500 dark:text-d-muted">Items Total:</span>
                                        <span className="font-bold text-slate-800 dark:text-d-heading text-lg">
                                            {formatCurrency(itemsTotal)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Receipt Image */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Receipt Image
                                </label>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 dark:border-[rgba(255,255,255,0.15)] rounded-xl cursor-pointer hover:border-primary-400 dark:hover:border-d-border-hover hover:bg-primary-50 dark:hover:bg-[rgba(255,210,100,0.05)] transition-colors text-sm text-slate-600 dark:text-d-text">
                                        <FiImage size={16} />
                                        {receiptFile ? receiptFile.name : 'Choose image...'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => setReceiptFile(e.target.files[0] || null)}
                                        />
                                    </label>
                                    {receiptFile && (
                                        <button
                                            type="button"
                                            onClick={() => setReceiptFile(null)}
                                            className="p-1.5 text-slate-400 dark:text-d-faint hover:text-red-500 dark:hover:text-d-red rounded-lg hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.1)] transition-colors"
                                        >
                                            <FiX size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={supplyForm.notes}
                                    onChange={(e) =>
                                        setSupplyForm({ ...supplyForm, notes: e.target.value })
                                    }
                                    placeholder="Any additional notes..."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none resize-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeSupplyModal}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {submitting ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiSave size={16} />
                                    )}
                                    {submitting ? 'Saving...' : 'Save Supply'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================================================================
                MODAL: Record Payment
            ================================================================ */}
            {showPayModal && payingSupply && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-sm animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Record Payment</h3>
                                <p className="text-sm text-slate-500 dark:text-d-muted mt-0.5">
                                    Remaining:{' '}
                                    <span className="font-semibold text-red-600 dark:text-d-red">
                                        {formatCurrency(payingSupply.remainingAmount || 0)}
                                    </span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPayModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-500 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handlePay} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Payment Amount *
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    required
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-lg font-medium text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Method
                                </label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {PAY_METHODS.map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setPayMethod(m.id)}
                                            className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                                                payMethod === m.id
                                                    ? 'bg-primary-500 dark:bg-d-accent text-white dark:text-d-card'
                                                    : 'bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border text-slate-600 dark:text-d-muted hover:border-slate-300'
                                            }`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPayModal(false)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={paying}
                                    className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {paying ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiCheckCircle size={16} />
                                    )}
                                    {paying ? 'Saving...' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================================================================
                MODAL: Return items to vendor
            ================================================================ */}
            {returningSupply && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-xl animate-fadeIn max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Return items to vendor</h3>
                                <p className="text-sm text-slate-500 dark:text-d-muted mt-0.5">
                                    Supply #{returningSupply.supplyNumber}
                                    {returningSupply.billNumber ? ` · Bill ${returningSupply.billNumber}` : ''}
                                    {' · '}
                                    {typeof returningSupply.vendor === 'object' ? returningSupply.vendor?.name : ''}
                                </p>
                            </div>
                            <button
                                onClick={() => setReturningSupply(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-500 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 dark:text-d-muted">
                                <span className="col-span-5">Item</span>
                                <span className="col-span-2 text-center">Can return</span>
                                <span className="col-span-2">Qty</span>
                                <span className="col-span-3">Reason</span>
                            </div>
                            {(returningSupply.items || []).map((item) => {
                                const productId = itemProductId(item);
                                const line = returnLines[productId] || {};
                                const { max, fromSupply, inStock } = returnLimit(item);
                                const qty = parseInt(line.qty, 10) || 0;
                                return (
                                    <div key={productId} className={`grid grid-cols-12 gap-2 items-center ${max === 0 ? 'opacity-50' : ''}`}>
                                        <div className="col-span-5 min-w-0">
                                            <div className="text-sm font-medium text-slate-800 dark:text-d-heading truncate">{item.name}</div>
                                            <div className="text-[11px] text-slate-400 dark:text-d-faint">
                                                {formatCurrency(item.unitPrice)} each
                                                {item.gst > 0 ? ` + ${item.gst}% GST` : ''}
                                                {item.returnedQty > 0 ? ` · ${item.returnedQty} already returned` : ''}
                                            </div>
                                            {inStock < fromSupply && (
                                                <div className="text-[11px] text-amber-600 dark:text-d-accent">
                                                    Only {inStock} in stock — the rest was sold
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-center text-sm text-slate-600 dark:text-d-text">{max}</div>
                                        <input
                                            type="number"
                                            min="0"
                                            max={max}
                                            step="1"
                                            value={line.qty ?? ''}
                                            disabled={max === 0}
                                            onChange={(e) => {
                                                const v = e.target.value === '' ? '' : String(Math.min(max, Math.max(0, parseInt(e.target.value, 10) || 0)));
                                                setReturnLine(productId, { qty: v });
                                            }}
                                            placeholder="0"
                                            className={`col-span-2 px-3 py-2 bg-white dark:bg-d-bg border rounded-xl text-sm text-slate-800 dark:text-d-text focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed ${
                                                qty > 0 ? 'border-amber-300 dark:border-d-accent/50' : 'border-slate-200 dark:border-d-border'
                                            }`}
                                        />
                                        <select
                                            value={line.reason || 'defective'}
                                            disabled={max === 0}
                                            onChange={(e) => setReturnLine(productId, { reason: e.target.value })}
                                            className="col-span-3 px-2 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text focus:outline-none disabled:cursor-not-allowed"
                                        >
                                            {RETURN_REASONS.map((r) => (
                                                <option key={r.id} value={r.id}>{r.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">Note (optional)</label>
                                <input
                                    type="text"
                                    value={returnNote}
                                    onChange={(e) => setReturnNote(e.target.value)}
                                    placeholder="e.g. 2 cartons broken in delivery"
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-d-glass border border-slate-200 dark:border-d-border text-sm space-y-1">
                                <div className="flex justify-between font-semibold text-slate-800 dark:text-d-heading">
                                    <span>Return amount</span>
                                    <span>{formatCurrency(returnTotal)}</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-d-muted">
                                    Reduces what you owe on this supply. If it's already paid, the vendor owes you the
                                    difference, and that credit is used on their unpaid supplies automatically.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-d-border">
                            <button
                                type="button"
                                onClick={() => setReturningSupply(null)}
                                className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReturn}
                                disabled={returning || returnSelection.length === 0}
                                className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {returning ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <FiCornerUpLeft size={16} />
                                )}
                                {returning ? 'Returning...' : 'Return items'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg bg-slate-800 dark:bg-d-elevated border border-transparent dark:border-d-border text-sm text-white dark:text-d-text animate-pop-in">
                    {toast}
                </div>
            )}

            {/* ================================================================
                MODAL: Add / Edit Vendor
            ================================================================ */}
            {showVendorModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-md animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
                            </h3>
                            <button
                                onClick={closeVendorModal}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-500 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleVendorSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={vendorForm.name}
                                    onChange={(e) =>
                                        setVendorForm({ ...vendorForm, name: e.target.value })
                                    }
                                    placeholder="Vendor / contact name"
                                    required
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Company
                                </label>
                                <input
                                    type="text"
                                    value={vendorForm.company}
                                    onChange={(e) =>
                                        setVendorForm({ ...vendorForm, company: e.target.value })
                                    }
                                    placeholder="Company or business name"
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={vendorForm.phone}
                                    onChange={(e) =>
                                        setVendorForm({ ...vendorForm, phone: e.target.value })
                                    }
                                    placeholder="+92 300 0000000"
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                />
                            </div>

                            {/* Opening Balance — only when adding new vendor */}
                            {!editingVendor && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                        Opening Balance
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={vendorForm.openingBalance}
                                        onChange={(e) =>
                                            setVendorForm({ ...vendorForm, openingBalance: e.target.value })
                                        }
                                        placeholder="0"
                                        className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                    />
                                    <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Previous balance from old system (if any)</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={vendorForm.notes}
                                    onChange={(e) =>
                                        setVendorForm({ ...vendorForm, notes: e.target.value })
                                    }
                                    placeholder="Any notes about this vendor..."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none resize-none text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeVendorModal}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={vendorSubmitting}
                                    className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {vendorSubmitting ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiSave size={16} />
                                    )}
                                    {vendorSubmitting ? 'Saving...' : 'Save Vendor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ProductFormModal
                show={showProductModal}
                onClose={closeProductModal}
                categories={productCategories}
                onSaved={handleProductSaved}
            />
        </div>
    );
};

export default Vendors;
