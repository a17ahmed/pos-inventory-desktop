import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { PageHeader, Tabs, Button, DataTable, rowActions, Dash, StatusBadge, StatusChip, FilterButton, DateRangeFields, rangeLabel, Field, Select } from '../components/ui';
import { DialogShell } from '../components/ui/Dialog';
import { toast } from '../components/ui/Toast';
import { todayLocalDate, toLocalDateStr } from '../utils/date';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { getVendors, createVendor, updateVendor, deleteVendor } from '../services/api/vendors';
import { getSupplies, getSupplyStats, createSupply, updateSupply, deleteSupply, paySupply, returnSupply } from '../services/api/supplies';
import { getCashBalance } from '../services/api/cashbook';
import { getProducts } from '../services/api/products';
import ProductFormModal from '../components/ProductFormModal';
import { appAlert, appConfirm } from '../components/AppDialog';
import AccountPicker from '../components/AccountPicker';
import ChequeFields from '../components/moneybook/ChequeFields';
import { useMoneyBook } from '../context/MoneyBookContext';
import { apiErrorMessage, round2 } from '../utils/moneyBook';
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

const PAY_STATUS_LABEL = { unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid' };

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
    const [productsLoading, setProductsLoading] = useState(false);

    // ── Supplies list ────────────────────────────────────────────────────────
    const [supplies, setSupplies] = useState([]); // current page only
    const [supplyTotal, setSupplyTotal] = useState(0);
    const [supplyPagination, setSupplyPagination] = useState({ page: 1, totalPages: 1 });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [vendorFilter, setVendorFilter] = useState('');
    const [supplyRange, setSupplyRange] = useState({ from: '', to: '' }); // bill date; '' = all dates
    const [supplyPageSize, setSupplyPageSize] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('ds.table.supplies.pageSize')) || 50;
        } catch {
            return 50;
        }
    });
    // Search text also goes to the server (debounced); older servers ignore it and the
    // page shown is filtered here instead.
    const [serverSearch, setServerSearch] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setServerSearch(searchQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

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

    // ── Money Book (only when the shop has it on) ────────────────────────────
    const { isOn: moneyBookOn, chequeTracking, moneyFields, handleMoneyError } = useMoneyBook();
    // Cheque only with cheque tracking once the Money Book is on; unchanged otherwise
    const payMethods = PAY_METHODS.filter((m) => m.id !== 'cheque' || !moneyBookOn || chequeTracking);
    const emptyMoneyPay = { method: 'cash', accountId: null, chequeNumber: '', chequeDate: '' };
    const [supplyPay, setSupplyPay] = useState(emptyMoneyPay); // supply create: initial payment
    const [supplyShort, setSupplyShort] = useState(false);
    const [payMoney, setPayMoney] = useState(emptyMoneyPay);   // pay modal (method lives in payMethod)
    const [payShort, setPayShort] = useState(false);
    const chequeFor = (method, m) => (method === 'cheque' && chequeTracking
        ? { chequeNumber: m.chequeNumber.trim(), chequeDate: m.chequeDate }
        : {});

    // ── Return modal ─────────────────────────────────────────────────────────
    const [returningSupply, setReturningSupply] = useState(null);
    const [returnLines, setReturnLines] = useState({}); // { [productId]: { qty, reason } }
    const [returnNote, setReturnNote] = useState('');
    const [returning, setReturning] = useState(false);

    const showToast = (message) => toast.success(message, { id: 'vendors', duration: 4500 });
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

    // Products are only needed inside the supply / return / new-product popups, so they're loaded
    // when one of those opens — not with the page (a big catalogue made the page slow to open).
    const fetchProducts = useCallback(async () => {
        setProductsLoading(true);
        try {
            const res = await getProducts();
            const data = res.data;
            setProducts(Array.isArray(data) ? data : data?.products || []);
        } catch (err) {
            console.error('Error fetching products:', err);
        } finally {
            setProductsLoading(false);
        }
    }, []);

    // One page at a time (limit ≤ 100). Money stats come from getSupplyStats
    // (server-side), so paging the list here doesn't affect any totals.
    const fetchSupplies = useCallback(async (pageNum = 1) => {
        setLoading(true);
        setError(null);
        try {
            const params = { page: pageNum, limit: supplyPageSize };
            if (statusFilter !== 'all') params.paymentStatus = statusFilter;
            if (vendorFilter) params.vendor = vendorFilter;
            if (supplyRange.from) params.startDate = supplyRange.from;
            if (supplyRange.to) params.endDate = supplyRange.to;
            if (serverSearch) params.search = serverSearch;
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
    }, [statusFilter, vendorFilter, supplyRange.from, supplyRange.to, supplyPageSize, serverSearch]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await getSupplyStats();
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, []);

    const resetSupplyFilters = () => {
        setStatusFilter('all');
        setVendorFilter('');
        setSupplyRange({ from: '', to: '' });
    };

    // Switching tabs only reloads data that is older than FRESH_MS. Saving, paying or returning
    // still reloads at once (those call the fetch functions directly).
    const FRESH_MS = 30000;
    const loadedAt = useRef({ vendors: 0, stats: 0, supplies: { key: null, at: 0 } });
    const fresh = (at) => Date.now() - at < FRESH_MS;

    // Initial load (products wait for a popup that needs them)
    useEffect(() => {
        fetchVendors().then(() => {
            loadedAt.current.vendors = Date.now();
        });
    }, [fetchVendors]);

    useEffect(() => {
        if (activeTab !== 'supplies') return;
        // a filter change always reloads; coming back to the tab only when stale
        const key = JSON.stringify([statusFilter, vendorFilter, supplyRange, supplyPageSize, serverSearch]);
        const last = loadedAt.current.supplies;
        if (last.key === key && fresh(last.at)) return;
        loadedAt.current.supplies = { key, at: Date.now() };
        fetchSupplies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, fetchSupplies]);

    // Vendor totals change with every supply, payment and return — reload on tab switch when stale
    useEffect(() => {
        if (activeTab !== 'vendors' || fresh(loadedAt.current.vendors)) return;
        loadedAt.current.vendors = Date.now();
        fetchVendors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, fetchVendors]);

    useEffect(() => {
        // Both tabs show money cards sourced from stats, so load it for either (when stale).
        if ((activeTab !== 'supplies' && activeTab !== 'stats') || fresh(loadedAt.current.stats)) return;
        loadedAt.current.stats = Date.now();
        fetchStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setSupplyPay(emptyMoneyPay);
        setSupplyShort(false);
        if (!moneyBookOn) getCashBalance().then(res => setCashBalance(res.data?.balance ?? null)).catch(() => setCashBalance(null));
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
        if (!moneyBookOn && paid > 0 && supplyCashBalance != null && paid > supplyCashBalance) {
            appAlert(`Insufficient cash. Available balance: ${formatCurrency(supplyCashBalance)}`);
            return;
        }
        if (moneyBookOn && paid > 0 && supplyShort) {
            appAlert('Not enough money in the selected account. Choose another account or pay less now.');
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
            // Money Book on: how the paid-now part was paid and from which account
            if (!editingSupply && paid > 0) {
                const extra = moneyFields({
                    paymentMethod: supplyPay.method,
                    paymentAccountId: supplyPay.accountId,
                    ...chequeFor(supplyPay.method, supplyPay),
                });
                Object.entries(extra).forEach(([k, v]) => formData.append(k, v));
            }
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
            handleMoneyError(err);
            appAlert(err.response?.data?.code ? apiErrorMessage(err, 'Failed to save supply') : supplyErrorMessage(err, 'Failed to save supply'));
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
        setPayMoney(emptyMoneyPay);
        setPayShort(false);
        setShowPayModal(true);
    };

    const handlePay = async (e) => {
        e.preventDefault();
        if (!payAmount || Number(payAmount) <= 0) return;
        if (moneyBookOn && payShort) {
            appAlert('Not enough money in the selected account. Choose another account.');
            return;
        }
        setPaying(true);
        try {
            await paySupply(payingSupply._id, {
                amount: Number(payAmount),
                method: payMethod,
                ...moneyFields({ accountId: payMoney.accountId, ...chequeFor(payMethod, payMoney) }),
            });
            setShowPayModal(false);
            setPayingSupply(null);
            fetchSupplies();
            fetchStats();
        } catch (err) {
            console.error('Error recording payment:', err);
            handleMoneyError(err);
            appAlert(apiErrorMessage(err, 'Failed to record payment'));
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
                    color: 'bg-success-chip text-success',
                    label: 'Paid',
                };
            case 'partial':
                return {
                    icon: FiClock,
                    color: 'bg-warning-chip text-warning-chip-foreground',
                    label: 'Partial',
                };
            default:
                return {
                    icon: FiAlertCircle,
                    color: 'bg-destructive-chip text-destructive',
                    label: 'Unpaid',
                };
        }
    };

    // =========================================================================
    // Render helpers
    // =========================================================================

    // Loading: the table's shape in grey (the label is kept for screen readers)
    const renderLoadingSpinner = (label = 'Loading...') => (
        <div aria-label={label}>
            <TableSkeleton columns={6} />
        </div>
    );

    const renderError = () => (
        <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-destructive-chip rounded-full flex items-center justify-center">
                    <FiXCircle size={32} className="text-destructive" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Failed to load data</h2>
                <p className="text-muted-foreground">{error}</p>
                <button
                    onClick={() => fetchSupplies(1)}
                    className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                >
                    Try Again
                </button>
            </div>
        </div>
    );

    // =========================================================================
    // TAB: Supplies
    // =========================================================================

    const vendorNameOf = (x) => (typeof x.vendor === 'object' ? x.vendor?.name || '' : x.vendor || '');
    const supplyColumns = [
        {
            id: 'date',
            header: 'Date',
            accessorFn: (x) => new Date(x.billDate || x.createdAt).getTime() || 0,
            cell: ({ row: { original: x } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(x.billDate || x.createdAt).toLocaleDateString()}</span>,
        },
        { id: 'vendor', header: 'Vendor', accessorFn: vendorNameOf, cell: ({ getValue }) => (getValue() ? <span className="font-medium">{getValue()}</span> : <Dash />) },
        { id: 'bill', header: 'Bill #', accessorFn: (x) => x.billNumber || '', meta: { mono: true }, cell: ({ getValue }) => getValue() || <Dash /> },
        {
            id: 'items',
            header: 'Items',
            accessorFn: (x) => x.items?.length || 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
        },
        {
            id: 'total',
            header: 'Total',
            accessorFn: (x) => Number(x.totalAmount) || 0,
            meta: { align: 'right' },
            cell: ({ row: { original: x } }) => (
                <div>
                    <span className="font-medium">{formatCurrency(x.totalAmount)}</span>
                    {(x.totalReturned || 0) > 0 && <p className="text-body-sm text-warning-chip-foreground whitespace-nowrap">− {formatCurrency(x.totalReturned)} returned</p>}
                </div>
            ),
        },
        {
            id: 'paid',
            header: 'Paid',
            accessorFn: (x) => Number(x.paidAmount) || 0,
            meta: { align: 'right' },
            cell: ({ row: { original: x } }) => (
                <div>
                    <span>{formatCurrency(x.paidAmount)}</span>
                    {(x.creditApplied || 0) > 0 && <p className="text-body-sm text-muted-foreground whitespace-nowrap">incl. {formatCurrency(x.creditApplied)} vendor credit</p>}
                </div>
            ),
        },
        {
            id: 'remaining',
            header: 'Remaining',
            accessorFn: (x) => Number(x.remainingAmount) || 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => <span className={getValue() > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>{formatCurrency(getValue())}</span>,
        },
        {
            id: 'status',
            header: 'Status',
            accessorFn: (x) => x.paymentStatus || '',
            cell: ({ row: { original: x } }) => {
                const owes = (x.balance || 0) < 0 ? -x.balance : 0;
                return (
                    <div className="flex flex-col items-start gap-1">
                        <StatusBadge kind="payment" value={x.paymentStatus} size="sm" />
                        {owes > 0 && <StatusChip size="xs" tone="success" label={`Vendor owes you ${formatCurrency(owes)}`} />}
                    </div>
                );
            },
        },
        rowActions(
            (x) => {
                const canDelete = !(x.payments?.length > 0) && !(x.returns?.length > 0);
                return [
                    x.paymentStatus !== 'paid' && { label: 'Record payment', icon: FiCreditCard, onSelect: () => openPayModal(x) },
                    (x.items || []).some((i) => returnableQty(i) > 0) && { label: 'Return items to vendor', icon: FiCornerUpLeft, onSelect: () => openReturnModal(x) },
                    { label: 'Edit', icon: FiEdit2, onSelect: () => openSupplyModal(x) },
                    ...(canDelete ? [{ separator: true }, { label: 'Delete', icon: FiTrash2, danger: true, onSelect: () => handleDeleteSupply(x._id) }] : []),
                ];
            },
            { label: 'Supply actions' }
        ),
    ];

    const vendorColumns = [
        { id: 'name', header: 'Name', accessorFn: (v) => v.name || '', cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
        { id: 'company', header: 'Company', accessorFn: (v) => v.company || '', cell: ({ getValue }) => getValue() || <Dash /> },
        { id: 'phone', header: 'Phone', accessorFn: (v) => v.phone || '', meta: { mono: true }, cell: ({ getValue }) => getValue() || <Dash /> },
        { id: 'business', header: 'Total business', accessorFn: (v) => Number(v.totalBusiness) || 0, meta: { align: 'right' }, cell: ({ getValue }) => formatCurrency(getValue()) },
        { id: 'paid', header: 'Total paid', accessorFn: (v) => Number(v.totalPaid) || 0, meta: { align: 'right' }, cell: ({ getValue }) => formatCurrency(getValue()) },
        {
            id: 'remaining',
            header: 'Remaining',
            accessorFn: (v) => Number(v.totalRemaining) || 0,
            meta: { align: 'right' },
            cell: ({ row: { original: v } }) => (
                <div>
                    <span className={(v.totalRemaining || 0) > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>{formatCurrency(v.totalRemaining || 0)}</span>
                    {(v.totalCredit || 0) > 0 && <p className="text-body-sm text-success whitespace-nowrap">Credit: {formatCurrency(v.totalCredit)} (vendor owes you)</p>}
                </div>
            ),
        },
        { id: 'supplies', header: 'Supplies', accessorFn: (v) => v.supplyCount ?? 0, meta: { align: 'right' } },
        rowActions(
            (v) => [
                { label: 'View ledger', icon: FiBookOpen, onSelect: () => navigate(`/vendors/${v._id}/ledger`) },
                { label: 'Edit', icon: FiEdit2, onSelect: () => openVendorModal(v) },
                { separator: true },
                { label: 'Delete', icon: FiTrash2, danger: true, onSelect: () => handleDeleteVendor(v._id) },
            ],
            { label: 'Vendor actions' }
        ),
    ];

    const renderSuppliesTab = () => (
        <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                    <p className="text-sm text-muted-foreground">Total Outstanding</p>
                    <p className="text-2xl font-bold text-destructive">{formatCurrency(outstandingTotal)}</p>
                </div>
                <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                    <p className="text-sm text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(thisMonthTotal)}</p>
                </div>
                <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                    <p className="text-sm text-muted-foreground">Total Supplies</p>
                    <p className="text-2xl font-bold text-primary">{supplyTotal}</p>
                </div>
            </div>

            <DataTable
                caption="Supplies"
                data={filteredSupplies}
                columns={supplyColumns}
                getRowId={(x) => x._id}
                loading={loading}
                error={error ? { message: error, onRetry: () => fetchSupplies(supplyPagination.page) } : null}
                search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search by vendor or bill #' }}
                filters={
                    <FilterButton
                        label="Filter supplies"
                        summary={[
                            rangeLabel(supplyRange),
                            statusFilter !== 'all' && PAY_STATUS_LABEL[statusFilter],
                            vendorFilter && (vendors.find((v) => v._id === vendorFilter)?.name || 'One vendor'),
                        ].filter(Boolean).join(' · ')}
                        count={(statusFilter !== 'all') + !!vendorFilter}
                        onReset={resetSupplyFilters}
                    >
                        <DateRangeFields label="Bill date" value={supplyRange} onChange={setSupplyRange} />
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Payment">
                                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="all">All</option>
                                    <option value="unpaid">Unpaid</option>
                                    <option value="partial">Partial</option>
                                    <option value="paid">Paid</option>
                                </Select>
                            </Field>
                            <Field label="Vendor">
                                <Select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
                                    <option value="">All vendors</option>
                                    {vendors.map((v) => (
                                        <option key={v._id} value={v._id}>
                                            {v.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        </div>
                    </FilterButton>
                }
                isFiltered={!!searchQuery || statusFilter !== 'all' || !!vendorFilter || !!supplyRange.from || !!supplyRange.to}
                onClearFilters={() => {
                    setSearchQuery('');
                    resetSupplyFilters();
                }}
                empty={{ icon: FiPackage, title: 'No supplies yet', description: 'Add your first supply record to get started.' }}
                onRowClick={(x) => openSupplyModal(x)}
                rowLabel={(x) => `Edit supply ${x.billNumber || ''}`}
                server={{
                    page: supplyPagination.page,
                    pageSize: supplyPageSize,
                    total: supplyTotal,
                    onPageChange: (p) => fetchSupplies(p),
                    onPageSizeChange: (n) => {
                        setSupplyPageSize(n);
                        try {
                            localStorage.setItem('ds.table.supplies.pageSize', JSON.stringify(n));
                        } catch {
                            /* storage blocked */
                        }
                    },
                }}
            />
        </>
    );

    // =========================================================================
    // TAB: Vendors
    // =========================================================================

    const renderVendorsTab = () => (
        <DataTable
            id="vendors"
            caption="Vendors"
            data={vendors}
            columns={vendorColumns}
            getRowId={(v) => v._id}
            empty={{ icon: FiUsers, title: 'No vendors yet', description: 'Add vendors to start tracking supply purchases.' }}
            onRowClick={(v) => drillToVendor(v._id)}
            rowLabel={(v) => `Open ledger of ${v.name}`}
            initialSort={[{ id: 'name', desc: false }]}
        />
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
                color: 'bg-success-chip text-success',
                label: 'Paid',
            },
            partial: {
                color: 'bg-warning-chip text-warning-chip-foreground',
                label: 'Partial',
            },
            unpaid: {
                color: 'bg-destructive-chip text-destructive',
                label: 'Unpaid',
            },
        };

        return (
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-destructive-chip rounded-xl flex items-center justify-center">
                                <FiAlertCircle className="text-destructive" size={20} />
                            </div>
                            <p className="text-sm text-muted-foreground">Total Outstanding</p>
                        </div>
                        <p className="text-2xl font-bold text-destructive">
                            {formatCurrency(overall.totalRemaining ?? overall.totalOutstanding ?? overall.outstanding ?? 0)}
                        </p>
                    </div>

                    <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-info-chip rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-info" size={20} />
                            </div>
                            <p className="text-sm text-muted-foreground">This Month Total</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">
                            {formatCurrency(thisMonth.totalAmount || thisMonth.total || 0)}
                        </p>
                    </div>

                    <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                                <FiPackage className="text-primary" size={20} />
                            </div>
                            <p className="text-sm text-muted-foreground">Total Supplies</p>
                        </div>
                        <p className="text-2xl font-bold text-primary">
                            {overall.totalSupplies || overall.count || 0}
                        </p>
                    </div>

                    <div className="bg-card rounded-2xl p-6 shadow-sm border border-hairline">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                                <FiUsers className="text-primary" size={20} />
                            </div>
                            <p className="text-sm text-muted-foreground">Total Vendors</p>
                        </div>
                        <p className="text-2xl font-bold text-primary">{vendors.length}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Vendors */}
                    <div className="bg-card rounded-2xl shadow-sm border border-hairline overflow-hidden">
                        <div className="px-6 py-4 border-b border-hairline">
                            <h3 className="font-semibold text-foreground">Top Vendors by Outstanding</h3>
                        </div>
                        {byVendor.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <FiUsers size={36} />
                                <p className="mt-3 text-sm">No vendor data available</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Vendor</th>
                                        <th className="text-right py-3 px-6 text-sm font-medium text-muted-foreground">Total</th>
                                        <th className="text-right py-3 px-6 text-sm font-medium text-muted-foreground">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byVendor.slice(0, 8).map((v, idx) => (
                                        <tr
                                            key={v._id || idx}
                                            className="border-t border-hairline hover:bg-[var(--hover-overlay)] transition-colors"
                                        >
                                            <td className="py-3 px-6 font-medium text-foreground">
                                                {v.name || v.vendorName || '—'}
                                            </td>
                                            <td className="py-3 px-6 text-right text-foreground">
                                                {formatCurrency(v.totalAmount || v.total || 0)}
                                            </td>
                                            <td className="py-3 px-6 text-right font-semibold">
                                                <span
                                                    className={
                                                        (v.remaining || v.totalRemaining || 0) > 0
                                                            ? 'text-destructive'
                                                            : 'text-success'
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
                    <div className="bg-card rounded-2xl shadow-sm border border-hairline overflow-hidden">
                        <div className="px-6 py-4 border-b border-hairline">
                            <h3 className="font-semibold text-foreground">Payment Status Breakdown</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {byStatus.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
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
                                            className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-hairline"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${cfg.color}`}
                                                >
                                                    {cfg.label}
                                                </span>
                                                <span className="text-sm text-muted-foreground">
                                                    {s.count || 0} record{(s.count || 0) !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <span className="font-semibold text-foreground">
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
        <div className="p-6 animate-fadeIn min-h-full">
            {/* ── Page Header + tabs ──────────────────────────────────── */}
            <PageHeader
                title="Vendors & Supplies"
                subtitle="Manage suppliers and incoming inventory purchases"
                actions={
                    <>
                        {activeTab === 'supplies' && (
                            <Button onClick={() => openSupplyModal()}>
                                <FiPlus aria-hidden="true" />
                                Add Supply
                            </Button>
                        )}
                        {activeTab === 'vendors' && (
                            <Button onClick={() => openVendorModal()}>
                                <FiPlus aria-hidden="true" />
                                Add Vendor
                            </Button>
                        )}
                    </>
                }
                tabs={
                    <Tabs
                        label="Vendors sections"
                        value={activeTab}
                        onChange={setActiveTab}
                        items={TABS.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
                    />
                }
            />

            {/* ── Tab Content ──────────────────────────────────────────────── */}
            {activeTab === 'supplies' && renderSuppliesTab()}
            {activeTab === 'vendors' && renderVendorsTab()}
            {activeTab === 'stats' && renderStatsTab()}

            {/* ================================================================
                MODAL: Add / Edit Supply
            ================================================================ */}
            {showSupplyModal && (
                <DialogShell size="lg" className="max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-hairline sticky top-0 bg-card z-10">
                            <h3 className="text-xl font-semibold text-foreground">
                                {editingSupply ? 'Edit Supply' : 'Add Supply'}
                            </h3>
                            <button data-dialog-close
                                onClick={closeSupplyModal}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg transition-colors text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSupplySubmit} className="p-6 space-y-5">
                            {/* Vendor + Bill Number */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Vendor *
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={supplyForm.vendor}
                                            onChange={(e) => handleVendorSelectChange(e.target.value)}
                                            required
                                            disabled={!!editingSupply}
                                            className="appearance-none w-full px-4 py-2 pr-10 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
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
                                        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        {editingSupply && (
                                            <p className="mt-1 text-xs text-muted-foreground">Vendor cannot be changed after a supply is created.</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Bill Number
                                    </label>
                                    <input
                                        type="text"
                                        value={supplyForm.billNumber}
                                        onChange={(e) =>
                                            setSupplyForm({ ...supplyForm, billNumber: e.target.value })
                                        }
                                        placeholder="e.g. INV-1023"
                                        className="w-full px-4 py-2 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground placeholder:text-placeholder"
                                    />
                                </div>
                            </div>

                            {/* Bill Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Bill Date
                                    </label>
                                    <input
                                        type="date"
                                        value={supplyForm.billDate}
                                        onChange={(e) =>
                                            setSupplyForm({ ...supplyForm, billDate: e.target.value })
                                        }
                                        className="w-full px-4 py-2 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-medium text-foreground">
                                            Paid Amount
                                        </label>
                                        {!moneyBookOn && !editingSupply && supplyCashBalance != null && (
                                            <span className={`text-xs font-medium ${
                                                (Number(supplyForm.paidAmount) || 0) > supplyCashBalance
                                                    ? 'text-destructive'
                                                    : 'text-muted-foreground'
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
                                        className={`w-full px-4 py-2 bg-card border rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground placeholder:text-placeholder read-only:opacity-60 read-only:cursor-not-allowed read-only:focus:ring-0 ${
                                            !moneyBookOn && !editingSupply && (Number(supplyForm.paidAmount) || 0) > supplyCashBalance && supplyCashBalance != null
                                                ? 'border-destructive'
                                                : 'border-hairline'
                                        }`}
                                    />
                                    {editingSupply && (
                                        <p className="mt-1 text-xs text-muted-foreground">Use "Pay" to record a payment.</p>
                                    )}
                                </div>
                            </div>

                            {/* Money Book on: how the paid-now part is paid */}
                            {moneyBookOn && !editingSupply && (Number(supplyForm.paidAmount) || 0) > 0 && (
                                <div className="space-y-3 p-4 rounded-xl border border-hairline">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Paid by</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {payMethods.map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setSupplyPay((p) => ({ ...p, method: m.id }))}
                                                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                                        supplyPay.method === m.id
                                                            ? 'bg-primary text-white'
                                                            : 'bg-muted/40 border border-hairline text-muted-foreground hover:border-border'
                                                    }`}
                                                >
                                                    {m.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <AccountPicker
                                        method={supplyPay.method}
                                        value={supplyPay.accountId}
                                        onChange={(id) => setSupplyPay((p) => ({ ...p, accountId: id }))}
                                        amount={round2(supplyForm.paidAmount)}
                                        direction="out"
                                        pending={supplyPay.method === 'cheque' && chequeTracking}
                                        onInsufficientChange={setSupplyShort}
                                    />
                                    {supplyPay.method === 'cheque' && chequeTracking && (
                                        <ChequeFields
                                            number={supplyPay.chequeNumber}
                                            date={supplyPay.chequeDate}
                                            onChange={({ number, date }) => setSupplyPay((p) => ({ ...p, chequeNumber: number, chequeDate: date }))}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Items Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-foreground">
                                        Items *
                                    </label>
                                    {!itemsLocked && (
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className="flex items-center gap-1 text-sm text-primary hover:text-primary font-medium transition-colors"
                                        >
                                            <FiPlus size={14} />
                                            Add Item
                                        </button>
                                    )}
                                </div>

                                {itemsLocked && (
                                    <div className="mb-3 p-3 bg-muted/40 border border-hairline rounded-xl text-xs text-muted-foreground">
                                        This supply has returns, so its items can't be changed. Bill number, date and notes can still be edited.
                                    </div>
                                )}

                                {/* Items Header */}
                                <div className="grid grid-cols-12 gap-2 mb-2 px-1">
                                    <span className="col-span-5 text-xs text-muted-foreground font-medium">Product</span>
                                    <span className="col-span-2 text-xs text-muted-foreground font-medium">Qty</span>
                                    <span className="col-span-2 text-xs text-muted-foreground font-medium">Unit Price</span>
                                    <span className="col-span-2 text-xs text-muted-foreground font-medium">Total</span>
                                    <span className="col-span-1" />
                                </div>

                                {productsLoading && products.length === 0 && (
                                    <p className="mb-3 text-body-sm text-muted-foreground" role="status">
                                        Loading products…
                                    </p>
                                )}
                                {!productsLoading && products.length === 0 && (
                                    <div className="mb-3 p-3 bg-warning-chip border border-warning/30 rounded-xl text-xs text-warning-chip-foreground">
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
                                                    className="disabled:opacity-60 disabled:cursor-not-allowed appearance-none w-full px-3 py-2 pr-9 bg-card border border-hairline rounded-xl text-sm focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
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
                                                <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.qty}
                                                onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                                                disabled={itemsLocked}
                                                className="disabled:opacity-60 disabled:cursor-not-allowed col-span-2 px-3 py-2 bg-card border border-hairline rounded-xl text-sm focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
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
                                                className="disabled:opacity-60 disabled:cursor-not-allowed col-span-2 px-3 py-2 bg-card border border-hairline rounded-xl text-sm focus:ring-2 focus:ring-ring focus:outline-none text-foreground placeholder:text-placeholder"
                                            />
                                            <div className="col-span-2 px-3 py-2 bg-muted/40 border border-hairline rounded-xl text-sm text-muted-foreground font-medium text-right">
                                                {item.total.toLocaleString()}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(idx)}
                                                disabled={supplyItems.length === 1 || itemsLocked}
                                                className="col-span-1 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive-chip rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                                            >
                                                <FiMinus size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Items Total */}
                                <div className="flex justify-end mt-3 pt-3 border-t border-hairline">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-muted-foreground">Items Total:</span>
                                        <span className="font-bold text-foreground text-lg">
                                            {formatCurrency(itemsTotal)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Receipt Image */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Receipt Image
                                </label>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-accent transition-colors text-sm text-muted-foreground">
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
                                            className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive-chip transition-colors"
                                        >
                                            <FiX size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={supplyForm.notes}
                                    onChange={(e) =>
                                        setSupplyForm({ ...supplyForm, notes: e.target.value })
                                    }
                                    placeholder="Any additional notes..."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none resize-none text-foreground placeholder:text-placeholder"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeSupplyModal}
                                    className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {submitting ? (
                                        <div className="w-4 h-4 border-2 border-hairline border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiSave size={16} />
                                    )}
                                    {submitting ? 'Saving...' : 'Save Supply'}
                                </button>
                            </div>
                        </form>
                    </DialogShell>
            )}

            {/* ================================================================
                MODAL: Record Payment
            ================================================================ */}
            {showPayModal && payingSupply && (
                <DialogShell size="sm" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-hairline">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Record Payment</h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Remaining:{' '}
                                    <span className="font-semibold text-destructive">
                                        {formatCurrency(payingSupply.remainingAmount || 0)}
                                    </span>
                                </p>
                            </div>
                            <button data-dialog-close
                                onClick={() => setShowPayModal(false)}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg transition-colors text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handlePay} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
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
                                    className="w-full px-4 py-2.5 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-lg font-medium text-foreground placeholder:text-placeholder"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Method
                                </label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {payMethods.map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setPayMethod(m.id)}
                                            className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                                                payMethod === m.id
                                                    ? 'bg-primary text-white'
                                                    : 'bg-muted/40 border border-hairline text-muted-foreground hover:border-border'
                                            }`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <AccountPicker
                                method={payMethod}
                                value={payMoney.accountId}
                                onChange={(id) => setPayMoney((p) => ({ ...p, accountId: id }))}
                                amount={round2(payAmount)}
                                direction="out"
                                pending={payMethod === 'cheque' && chequeTracking}
                                onInsufficientChange={setPayShort}
                            />
                            {moneyBookOn && payMethod === 'cheque' && chequeTracking && (
                                <ChequeFields
                                    number={payMoney.chequeNumber}
                                    date={payMoney.chequeDate}
                                    onChange={({ number, date }) => setPayMoney((p) => ({ ...p, chequeNumber: number, chequeDate: date }))}
                                />
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPayModal(false)}
                                    className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={paying}
                                    className="flex-1 py-3 bg-success text-white rounded-xl font-medium hover:bg-success/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {paying ? (
                                        <div className="w-4 h-4 border-2 border-hairline border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiCheckCircle size={16} />
                                    )}
                                    {paying ? 'Saving...' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </DialogShell>
            )}

            {/* ================================================================
                MODAL: Return items to vendor
            ================================================================ */}
            {returningSupply && (
                <DialogShell size="lg" className="max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-hairline">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Return items to vendor</h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Supply #{returningSupply.supplyNumber}
                                    {returningSupply.billNumber ? ` · Bill ${returningSupply.billNumber}` : ''}
                                    {' · '}
                                    {typeof returningSupply.vendor === 'object' ? returningSupply.vendor?.name : ''}
                                </p>
                            </div>
                            <button data-dialog-close
                                onClick={() => setReturningSupply(null)}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg transition-colors text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground">
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
                                            <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                                            <div className="text-caption text-muted-foreground">
                                                {formatCurrency(item.unitPrice)} each
                                                {item.gst > 0 ? ` + ${item.gst}% GST` : ''}
                                                {item.returnedQty > 0 ? ` · ${item.returnedQty} already returned` : ''}
                                            </div>
                                            {inStock < fromSupply && (
                                                <div className="text-caption text-primary">
                                                    Only {inStock} in stock — the rest was sold
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-center text-sm text-muted-foreground">{max}</div>
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
                                            className={`col-span-2 px-3 py-2 bg-card border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed ${
                                                qty > 0 ? 'border-primary/30' : 'border-hairline'
                                            }`}
                                        />
                                        <select
                                            value={line.reason || 'defective'}
                                            disabled={max === 0}
                                            onChange={(e) => setReturnLine(productId, { reason: e.target.value })}
                                            className="col-span-3 px-2 py-2 bg-card border border-hairline rounded-xl text-sm text-foreground focus:outline-none disabled:cursor-not-allowed"
                                        >
                                            {RETURN_REASONS.map((r) => (
                                                <option key={r.id} value={r.id}>{r.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Note (optional)</label>
                                <input
                                    type="text"
                                    value={returnNote}
                                    onChange={(e) => setReturnNote(e.target.value)}
                                    placeholder="e.g. 2 cartons broken in delivery"
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            <div className="p-3 rounded-xl bg-muted/40 border border-hairline text-sm space-y-1">
                                <div className="flex justify-between font-semibold text-foreground">
                                    <span>Return amount</span>
                                    <span>{formatCurrency(returnTotal)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Reduces what you owe on this supply. If it's already paid, the vendor owes you the
                                    difference, and that credit is used on their unpaid supplies automatically.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 p-6 border-t border-hairline">
                            <button
                                type="button"
                                onClick={() => setReturningSupply(null)}
                                className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReturn}
                                disabled={returning || returnSelection.length === 0}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {returning ? (
                                    <div className="w-4 h-4 border-2 border-hairline border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <FiCornerUpLeft size={16} />
                                )}
                                {returning ? 'Returning...' : 'Return items'}
                            </button>
                        </div>
                    </DialogShell>
            )}

            {/* ================================================================
                MODAL: Add / Edit Vendor
            ================================================================ */}
            {showVendorModal && (
                <DialogShell size="md" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-hairline">
                            <h3 className="text-xl font-semibold text-foreground">
                                {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
                            </h3>
                            <button data-dialog-close
                                onClick={closeVendorModal}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg transition-colors text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleVendorSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
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
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground placeholder:text-placeholder"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Company
                                </label>
                                <input
                                    type="text"
                                    value={vendorForm.company}
                                    onChange={(e) =>
                                        setVendorForm({ ...vendorForm, company: e.target.value })
                                    }
                                    placeholder="Company or business name"
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground placeholder:text-placeholder"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={vendorForm.phone}
                                    onChange={(e) =>
                                        setVendorForm({ ...vendorForm, phone: e.target.value })
                                    }
                                    placeholder="+92 300 0000000"
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground placeholder:text-placeholder"
                                />
                            </div>

                            {/* Opening Balance — only when adding new vendor */}
                            {!editingVendor && (
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
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
                                        className="w-full px-4 py-2 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none text-foreground placeholder:text-placeholder"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Previous balance from old system (if any)</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={vendorForm.notes}
                                    onChange={(e) =>
                                        setVendorForm({ ...vendorForm, notes: e.target.value })
                                    }
                                    placeholder="Any notes about this vendor..."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-card border border-hairline rounded-xl focus:ring-2 focus:ring-ring focus:outline-none resize-none text-foreground placeholder:text-placeholder"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeVendorModal}
                                    className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={vendorSubmitting}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {vendorSubmitting ? (
                                        <div className="w-4 h-4 border-2 border-hairline border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiSave size={16} />
                                    )}
                                    {vendorSubmitting ? 'Saving...' : 'Save Vendor'}
                                </button>
                            </div>
                        </form>
                    </DialogShell>
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
