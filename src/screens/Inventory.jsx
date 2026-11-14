import React, { useState, useEffect, useCallback } from 'react';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { cn, Tabs, DataTable, Dash, Select, StatusChip, IconButton, Button, StateCard } from '../components/ui';
import { PageHeader } from '../components/ui/PageHeader';
import { DialogShell } from '../components/ui/Dialog';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import {
    ADJUST_REASONS,
    NOTE_MAX,
    adjustReasonLabel,
    reasonsForOperation,
    stockAfterAdjust,
    adjustFormError,
} from '../utils/stockAdjustment';
import {
    FiPackage,
    FiDollarSign,
    FiTrendingUp,
    FiAlertTriangle,
    FiRefreshCw,
    FiSearch,
    FiDownload,
    FiFilter,
    FiArchive,
    FiActivity,
    FiAlertCircle,
    FiX,
    FiArrowUp,
    FiArrowDown,
    FiMinus,
    FiCalendar,
    FiFileText,
    FiChevronDown,
} from 'react-icons/fi';
import {
    getProducts,
    getInventoryValuation,
    getStockMovements,
    getLowStockProducts,
    getDeadStock,
    updateStock,
} from '../services/api/products';
import { appAlert } from '../components/AppDialog';
import { stockLevel, needsRestock } from '../utils/stock';

// ── Tabs ─────────────────────────────────────────────────────
const TABS = [
    { key: 'overview', label: 'Overview', icon: FiPackage },
    { key: 'sheet', label: 'Stock Sheet', icon: FiFileText },
    { key: 'movements', label: 'Movements', icon: FiActivity },
    { key: 'lowstock', label: 'Low Stock', icon: FiAlertTriangle },
    { key: 'deadstock', label: 'Dead Stock', icon: FiArchive },
];

const Inventory = () => {
    const { business } = useBusiness();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    // Data states
    const [allProducts, setAllProducts] = useState([]);
    const [valuation, setValuation] = useState(null);
    const [movements, setMovements] = useState([]);
    const [movementsMeta, setMovementsMeta] = useState({ total: 0, page: 1, totalPages: 1 });
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [deadStockData, setDeadStockData] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [movementType, setMovementType] = useState('');
    const [movementPage, setMovementPage] = useState(1);
    const [deadStockDays, setDeadStockDays] = useState(30);

    // Adjust stock modal
    const [adjustModal, setAdjustModal] = useState(null);
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustOp, setAdjustOp] = useState('set');
    const [adjustReason, setAdjustReason] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [adjustSaving, setAdjustSaving] = useState(false);
    const [movementReason, setMovementReason] = useState(''); // manual adjustments only

    // Adjusting stock needs Products → Update Stock (admins always can);
    // the backend enforces it too.
    const { isAdmin, permissions } = useAuth();
    const canAdjustStock = !!isAdmin || permissions?.products?.updateStock === true;

    // Print
    const [showPrintView, setShowPrintView] = useState(false);

    const currency = business?.currency || 'Rs.';
    const fmt = (n) => `${currency} ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    // ── Fetch data ─────────────────────────────────────────────
    const [loadError, setLoadError] = useState(null);
    const fetchProducts = useCallback(async () => {
        setLoadError(null);
        try {
            const res = await getProducts();
            setAllProducts(res.data || []);
            // Derive low stock from products
            const low = (res.data || []).filter(needsRestock);
            setLowStockProducts(low);
        } catch (err) {
            console.error('Error fetching products:', err);
            setLoadError(err.response?.data?.message || (!navigator.onLine ? 'You seem to be offline.' : 'The server didn\'t answer.'));
        }
    }, []);

    const fetchOverview = useCallback(async () => {
        try {
            const valRes = await getInventoryValuation();
            setValuation(valRes.data);
        } catch (err) {
            console.error('Error fetching overview:', err);
        }
    }, []);

    const fetchMovements = useCallback(async (page = 1) => {
        try {
            const params = { page, limit: 30 };
            if (movementType) params.type = movementType;
            if (movementType === 'manual_adjustment' && movementReason) params.reason = movementReason;
            const res = await getStockMovements(params);
            setMovements(res.data?.movements || []);
            setMovementsMeta({
                total: res.data?.total || 0,
                page: res.data?.page || 1,
                totalPages: res.data?.totalPages || 1,
            });
        } catch (err) {
            console.error('Error fetching movements:', err);
        }
    }, [movementType, movementReason]);

    const fetchDeadStock = useCallback(async () => {
        try {
            const res = await getDeadStock(deadStockDays);
            setDeadStockData(res.data);
        } catch (err) {
            console.error('Error fetching dead stock:', err);
        }
    }, [deadStockDays]);

    // Initial load — fetch all products (used for sheet, low stock, overview counts)
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchProducts(), fetchOverview()]);
            setLoading(false);
        };
        load();
    }, [fetchProducts, fetchOverview]);

    // Tab-specific loading
    useEffect(() => {
        if (activeTab === 'movements') fetchMovements(1);
        if (activeTab === 'deadstock') fetchDeadStock();
    }, [activeTab, fetchMovements, fetchDeadStock]);

    // Refetch movements on page/filter change
    useEffect(() => {
        if (activeTab === 'movements') fetchMovements(movementPage);
    }, [movementPage, movementType, movementReason, activeTab, fetchMovements]);

    // ── Group products by category (for stock sheet) ───────────
    const groupedProducts = React.useMemo(() => {
        let filtered = allProducts;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = allProducts.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.barcode?.includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.category?.toLowerCase().includes(q)
            );
        }
        // Group by category
        const groups = {};
        filtered.forEach(p => {
            const cat = p.category || 'Uncategorized';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        });
        // Sort categories alphabetically, compute subtotals
        return Object.keys(groups).sort().map(cat => {
            const products = groups[cat];
            const totalQty = products.reduce((s, p) => s + (p.stockQuantity ?? 0), 0);
            const totalCost = products.reduce((s, p) => s + (p.costPrice || 0) * (p.stockQuantity ?? 0), 0);
            const totalRetail = products.reduce((s, p) => s + (p.sellingPrice || 0) * (p.stockQuantity ?? 0), 0);
            return { category: cat, products, totalQty, totalCost, totalRetail };
        });
    }, [allProducts, searchQuery]);

    const grandTotal = React.useMemo(() => {
        return groupedProducts.reduce((acc, cat) => ({
            products: acc.products + cat.products.length,
            qty: acc.qty + cat.totalQty,
            cost: acc.cost + cat.totalCost,
            retail: acc.retail + cat.totalRetail,
        }), { products: 0, qty: 0, cost: 0, retail: 0 });
    }, [groupedProducts]);

    // ── Adjust stock ───────────────────────────────────────────
    const openAdjust = (product) => {
        setAdjustModal(product);
        setAdjustQty('');
        setAdjustOp('subtract');
        setAdjustReason('');
        setAdjustNote('');
    };

    const changeAdjustOp = (op) => {
        setAdjustOp(op);
        // Drop a reason that doesn't fit the new operation (transfer out = subtract only, …)
        if (adjustReason && !reasonsForOperation(op).some((r) => r.value === adjustReason)) setAdjustReason('');
        if (op === 'set' && adjustQty === '') setAdjustQty(String(adjustModal?.stockQuantity ?? 0));
    };

    const adjustCurrent = adjustModal?.stockQuantity ?? 0;
    const adjustError = adjustModal
        ? adjustFormError({ current: adjustCurrent, op: adjustOp, qty: adjustQty, reason: adjustReason, note: adjustNote, trackStock: adjustModal.trackStock })
        : '';

    const handleAdjustStock = async () => {
        if (!adjustModal || adjustError || adjustSaving) return;
        setAdjustSaving(true);
        try {
            const note = adjustNote.trim();
            await updateStock(adjustModal._id, {
                quantity: Number(adjustQty),
                operation: adjustOp,
                reason: adjustReason,
                ...(note ? { note } : {}),
            });
            setAdjustModal(null);
            // Refresh relevant data
            fetchProducts();
            fetchOverview();
            if (activeTab === 'movements') fetchMovements(movementPage);
        } catch (err) {
            appAlert(err.response?.data?.message || 'Failed to adjust stock');
        } finally {
            setAdjustSaving(false);
        }
    };

    // ── Print handler ──────────────────────────────────────────
    const handlePrintSheet = () => {
        setShowPrintView(true);
        const html = document.documentElement;
        const wasDark = html.classList.contains('dark');
        if (wasDark) html.classList.remove('dark');
        setTimeout(() => {
            window.print();
            if (wasDark) html.classList.add('dark');
            setShowPrintView(false);
        }, 200);
    };

    // ── Movement type label & color ────────────────────────────
    const movementLabel = (type) => {
        const map = {
            supply_in: { label: 'Supply In', color: 'text-success bg-success-chip' },
            supply_update_reverse: { label: 'Supply Reversed', color: 'text-warning-chip-foreground bg-warning-chip' },
            supply_update_add: { label: 'Supply Added', color: 'text-success bg-success-chip' },
            supply_delete: { label: 'Supply Deleted', color: 'text-destructive bg-destructive-chip' },
            supply_return: { label: 'Supply Return', color: 'text-warning-chip-foreground bg-warning-chip' },
            bill_sold: { label: 'Sold', color: 'text-info bg-info-chip' },
            bill_return: { label: 'Customer Return', color: 'text-primary bg-accent' },
            bill_cancel: { label: 'Bill Cancelled', color: 'text-muted-foreground bg-muted' },
            manual_adjustment: { label: 'Manual Adjust', color: 'text-muted-foreground bg-muted' },
        };
        return map[type] || { label: type, color: 'text-muted-foreground bg-muted' };
    };
    const MOVEMENT_TONE = {
        supply_in: 'success', supply_update_add: 'success', supply_update_reverse: 'warning', supply_return: 'warning',
        supply_delete: 'destructive', bill_sold: 'info', bill_return: 'accent', bill_cancel: 'neutral', manual_adjustment: 'neutral',
    };

    const movementColumns = [
        {
            id: 'date',
            header: 'Date',
            accessorFn: (m) => new Date(m.createdAt).getTime() || 0,
            cell: ({ row: { original: m } }) => (
                <span className="whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <span className="text-muted-foreground ml-1 text-body-sm">{new Date(m.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
            ),
        },
        { id: 'product', header: 'Product', accessorFn: (m) => m.productName || '', cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
        {
            id: 'type',
            header: 'Type',
            accessorFn: (m) => movementLabel(m.type).label,
            cell: ({ row: { original: m } }) => <StatusChip size="sm" shape="tag" tone={MOVEMENT_TONE[m.type] || 'neutral'} label={movementLabel(m.type).label} />,
        },
        {
            id: 'qty',
            header: 'Qty',
            accessorFn: (m) => m.quantity || 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => {
                const q = getValue();
                return (
                    <span className={cn('inline-flex items-center justify-end gap-1 font-medium', q > 0 ? 'text-success' : 'text-destructive')}>
                        {q > 0 ? <FiArrowUp size={12} aria-hidden="true" /> : <FiArrowDown size={12} aria-hidden="true" />}
                        {q > 0 ? '+' : ''}
                        {q}
                    </span>
                );
            },
        },
        { id: 'before', header: 'Before', accessorFn: (m) => m.previousStock ?? 0, meta: { align: 'right' }, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span> },
        { id: 'after', header: 'After', accessorFn: (m) => m.newStock ?? 0, meta: { align: 'right' }, cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
        { id: 'ref', header: 'Reference', accessorFn: (m) => m.referenceNumber || '', meta: { mono: true }, cell: ({ getValue }) => getValue() || <Dash /> },
        {
            id: 'reason',
            header: 'Reason / By',
            enableSorting: false,
            meta: { cellClassName: 'max-w-[280px] text-body-sm' },
            cell: ({ row: { original: m } }) => (
                <>
                    {m.type === 'manual_adjustment' && m.adjustmentReason ? (
                        <>
                            <div className="font-medium">{adjustReasonLabel(m.adjustmentReason)}</div>
                            {m.note && <div className="text-muted-foreground break-words">{m.note}</div>}
                        </>
                    ) : m.reason ? (
                        <div className="text-muted-foreground break-words">{m.reason}</div>
                    ) : null}
                    {m.performedBy && <div className="text-muted-foreground">by {m.performedBy}</div>}
                    {!m.reason && !m.adjustmentReason && !m.performedBy && <Dash />}
                </>
            ),
        },
    ];

    const productInfoColumns = [
        {
            id: 'name',
            header: 'Product',
            accessorFn: (p) => p.name || '',
            cell: ({ row: { original: p } }) => (
                <div>
                    <p className="font-medium">{p.name}</p>
                    {p.sku && <p className="font-mono text-mono-xs text-muted-foreground">{p.sku}</p>}
                </div>
            ),
        },
        { id: 'category', header: 'Category', accessorFn: (p) => p.category || '', cell: ({ getValue }) => (getValue() ? <span className="text-muted-foreground">{getValue()}</span> : <Dash />) },
    ];
    const lowStockColumns = [
        ...productInfoColumns,
        {
            id: 'stock',
            header: 'Current stock',
            accessorFn: (p) => p.stockQuantity ?? 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => (
                <span className="inline-flex items-center gap-2 justify-end">
                    <span className={cn('font-semibold', getValue() === 0 ? 'text-destructive' : 'text-warning-chip-foreground')}>{getValue()}</span>
                    {getValue() === 0 && <StatusChip size="xs" shape="tag" tone="destructive" label="Out" />}
                </span>
            ),
        },
        { id: 'alert', header: 'Alert level', accessorFn: (p) => p.lowStockAlert || 10, meta: { align: 'right' }, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span> },
        { id: 'cost', header: 'Cost price', accessorFn: (p) => Number(p.costPrice) || 0, meta: { align: 'right' }, cell: ({ getValue }) => fmt(getValue()) },
        { id: 'sell', header: 'Sell price', accessorFn: (p) => Number(p.sellingPrice) || 0, meta: { align: 'right' }, cell: ({ getValue }) => fmt(getValue()) },
    ];
    const deadStockColumns = [
        ...productInfoColumns,
        { id: 'stock', header: 'Stock', accessorFn: (p) => p.stockQuantity ?? 0, meta: { align: 'right' }, cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
        {
            id: 'costValue',
            header: 'Cost value',
            accessorFn: (p) => (p.costPrice || 0) * (p.stockQuantity || 0),
            meta: { align: 'right' },
            cell: ({ getValue }) => <span className="text-destructive">{fmt(getValue())}</span>,
        },
        { id: 'retail', header: 'Retail value', accessorFn: (p) => (p.sellingPrice || 0) * (p.stockQuantity || 0), meta: { align: 'right' }, cell: ({ getValue }) => fmt(getValue()) },
    ];

    // ── Loading state ──────────────────────────────────────────
    if (loading) {
        return (
            <PageSkeleton cards={4} columns={6} />
        );
    }

    // ══════════════════════════════════════════════════════════
    // PRINT VIEW — Stock Sheet
    // ══════════════════════════════════════════════════════════
    if (showPrintView) {
        return (
            <div className="fixed inset-0 z-50 bg-card overflow-auto print-static print:bg-card print:z-auto">
                <div className="max-w-[900px] mx-auto p-8">
                    {/* Print header */}
                    <div className="flex items-center justify-between mb-6 no-print">
                        <h2 className="text-xl font-bold text-foreground">Inventory Stock Sheet</h2>
                        <button onClick={() => setShowPrintView(false)} className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg">
                            <FiX size={20} />
                        </button>
                    </div>

                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-foreground">{business?.name || 'Business'}</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Inventory Stock Sheet — {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6 border border-hairline rounded-lg p-4">
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground uppercase">Total Products</p>
                            <p className="text-lg font-bold text-foreground">{grandTotal.products}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground uppercase">Total Items in Stock</p>
                            <p className="text-lg font-bold text-foreground">{grandTotal.qty.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground uppercase">Total Stock Value (Cost)</p>
                            <p className="text-lg font-bold text-foreground">{fmt(grandTotal.cost)}</p>
                        </div>
                    </div>

                    {/* Category tables */}
                    {groupedProducts.map((cat) => (
                        <div key={cat.category} className="mb-6 break-inside-avoid">
                            <div className="flex items-center justify-between bg-muted px-4 py-2 rounded-t-lg">
                                <span className="font-semibold text-foreground">{cat.category}</span>
                                <span className="text-sm text-muted-foreground">
                                    {cat.products.length} products | {cat.totalQty} items
                                </span>
                            </div>
                            <table className="w-full text-sm border border-hairline border-t-0">
                                <thead>
                                    <tr className="bg-muted/40 text-muted-foreground">
                                        <th className="text-left py-2 px-3 font-medium">Product</th>
                                        <th className="text-right py-2 px-3 font-medium">Quantity</th>
                                        <th className="text-right py-2 px-3 font-medium">Cost Price</th>
                                        <th className="text-right py-2 px-3 font-medium">Sell Price</th>
                                        <th className="text-right py-2 px-3 font-medium">Profit Margin</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cat.products.map((p) => {
                                        const stock = p.stockQuantity ?? 0;
                                        const margin = p.sellingPrice > 0 ? ((p.sellingPrice - (p.costPrice || 0)) / p.sellingPrice * 100) : 0;
                                        return (
                                            <tr key={p._id} className="border-t border-hairline">
                                                <td className="py-2 px-3 text-foreground">{p.name}</td>
                                                <td className={`py-2 px-3 text-right font-medium ${stock === 0 ? 'text-destructive' : 'text-foreground'}`}>
                                                    {stock}
                                                </td>
                                                <td className="py-2 px-3 text-right text-muted-foreground">{fmt(p.costPrice)}</td>
                                                <td className="py-2 px-3 text-right text-muted-foreground">{fmt(p.sellingPrice)}</td>
                                                <td className="py-2 px-3 text-right text-muted-foreground">{margin.toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })}
                                    {/* Category Total */}
                                    <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                                        <td className="py-2 px-3 text-foreground">{cat.category} Total</td>
                                        <td className="py-2 px-3 text-right text-foreground">{cat.totalQty}</td>
                                        <td className="py-2 px-3 text-right text-foreground">{fmt(cat.totalCost)}</td>
                                        <td className="py-2 px-3 text-right text-foreground">{fmt(cat.totalRetail)}</td>
                                        <td className="py-2 px-3 text-right text-muted-foreground">
                                            {cat.totalRetail > 0 ? ((cat.totalRetail - cat.totalCost) / cat.totalRetail * 100).toFixed(1) : 0}%
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ))}

                    {/* Grand total */}
                    <div className="border-t-2 border-border mt-4 pt-3">
                        <div className="flex justify-between text-base font-bold text-foreground">
                            <span>GRAND TOTAL</span>
                            <span>{grandTotal.qty.toLocaleString()} items</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Total Stock Value (at Cost):</span>
                            <span className="font-bold text-foreground">{fmt(grandTotal.cost)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Total Retail Value:</span>
                            <span className="font-bold text-foreground">{fmt(grandTotal.retail)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Potential Profit:</span>
                            <span className="font-bold text-success">{fmt(grandTotal.retail - grandTotal.cost)}</span>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center mt-8">
                        Generated on {new Date().toLocaleString()} | {business?.name}
                    </p>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════
    // MAIN RENDER
    // ══════════════════════════════════════════════════════════
    return (
        <div className="h-full overflow-auto">
            <div className="p-6 animate-fade-slide-up">
                {/* Header */}
                <PageHeader
                    title="Inventory"
                    subtitle="Stock levels, movements and what your stock is worth."
                    actions={
                        <>
                            <Button variant="ghost" onClick={() => { fetchProducts(); fetchOverview(); }}>
                                <FiRefreshCw aria-hidden="true" />
                                Refresh
                            </Button>
                            <Button onClick={handlePrintSheet}>
                                <FiDownload aria-hidden="true" />
                                Download sheet
                            </Button>
                        </>
                    }
                />

                {loadError ? (
                    <StateCard kind="error" className="mb-5" title="Couldn't load your products" onRetry={() => { fetchProducts(); fetchOverview(); }}>
                        {loadError} Stock figures below may be missing.
                    </StateCard>
                ) : null}

                {/* Tabs */}
                <Tabs
                    className="mb-6"
                    label="Inventory sections"
                    value={activeTab}
                    onChange={setActiveTab}
                    items={TABS.map((t) => ({
                        value: t.key,
                        label: t.label,
                        icon: t.icon,
                        count: t.key === 'lowstock' && lowStockProducts.length > 0 ? lowStockProducts.length : undefined,
                    }))}
                />

                {/* ── OVERVIEW TAB ────────────────────────────────────── */}
                {activeTab === 'overview' && valuation && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Products', value: valuation.summary?.totalProducts || 0, icon: FiPackage, color: 'text-info', bg: 'bg-info-chip' },
                                { label: 'Total Items in Stock', value: (valuation.summary?.totalItems || 0).toLocaleString(), icon: FiArchive, color: 'text-success', bg: 'bg-success-chip' },
                                { label: 'Total Cost Value', value: fmt(valuation.summary?.totalCostValue), icon: FiDollarSign, color: 'text-primary', bg: 'bg-accent' },
                                { label: 'Total Retail Value', value: fmt(valuation.summary?.totalRetailValue), icon: FiTrendingUp, color: 'text-primary', bg: 'bg-accent' },
                            ].map((card, i) => (
                                <div key={i} className="bg-card rounded-2xl border border-hairline p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                                            <card.icon size={20} className={card.color} />
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{card.label}</p>
                                    <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Potential Profit & Margin */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-card rounded-2xl border border-hairline p-5">
                                <p className="text-sm text-muted-foreground mb-1">Potential Profit (if all sold)</p>
                                <p className="text-2xl font-bold text-success">{fmt(valuation.summary?.totalPotentialProfit)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Retail Value - Cost Value</p>
                            </div>
                            <div className="bg-card rounded-2xl border border-hairline p-5">
                                <p className="text-sm text-muted-foreground mb-1">Average Margin</p>
                                <p className="text-2xl font-bold text-primary">{(valuation.summary?.avgMargin || 0).toFixed(1)}%</p>
                                <p className="text-xs text-muted-foreground mt-1">Across all products</p>
                            </div>
                        </div>

                        {/* Category Breakdown */}
                        {valuation.byCategory && valuation.byCategory.length > 0 && (
                            <div className="bg-card rounded-2xl border border-hairline overflow-hidden">
                                <div className="px-6 py-4 border-b border-hairline">
                                    <h3 className="font-semibold text-foreground">Valuation by Category</h3>
                                </div>
                                <table className="w-full">
                                    <thead>
                                                    <tr className="bg-muted/30 shadow-[inset_0_-1px_0_var(--border)]">
                                            <th className="h-[var(--head-h)] px-4 text-left font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Category</th>
                                            <th className="h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Products</th>
                                            <th className="h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Items</th>
                                            <th className="h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Cost Value</th>
                                            <th className="h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Retail Value</th>
                                            <th className="h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {valuation.byCategory.map((cat, i) => (
                                            <tr key={i} className="h-[var(--row-h)] shadow-[inset_0_1px_0_var(--hairline)] hover:bg-[var(--hover-overlay)]">
                                                <td className="py-1.5 px-4 font-medium text-foreground">{cat._id || cat.category || 'Uncategorized'}</td>
                                                <td className="py-1.5 px-4 text-right text-muted-foreground">{cat.productCount}</td>
                                                <td className="py-1.5 px-4 text-right text-muted-foreground">{(cat.itemCount || 0).toLocaleString()}</td>
                                                <td className="py-1.5 px-4 text-right text-muted-foreground">{fmt(cat.costValue)}</td>
                                                <td className="py-1.5 px-4 text-right font-medium text-foreground">{fmt(cat.retailValue)}</td>
                                                <td className="py-1.5 px-4 text-right font-medium text-success">{fmt(cat.potentialProfit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Low stock preview */}
                        {lowStockProducts.length > 0 && (
                            <div className="bg-card rounded-2xl border border-destructive/30 overflow-hidden">
                                <div className="px-6 py-4 border-b border-destructive/30 bg-destructive-chip flex items-center gap-2">
                                    <FiAlertTriangle className="text-destructive" size={18} />
                                    <h3 className="font-semibold text-destructive">Low Stock Alert — {lowStockProducts.length} products</h3>
                                </div>
                                <div className="divide-y divide-[var(--hairline)]">
                                    {lowStockProducts.slice(0, 5).map((p) => (
                                        <div key={p._id} className="px-6 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-foreground">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">{p.category}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${(p.stockQuantity || 0) === 0 ? 'text-destructive' : 'text-warning-chip-foreground'}`}>
                                                    {p.stockQuantity ?? 0} left
                                                </p>
                                                <p className="text-xs text-muted-foreground">Alert at {p.lowStockAlert || 10}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {lowStockProducts.length > 5 && (
                                        <div className="px-6 py-3 text-center">
                                            <button
                                                onClick={() => setActiveTab('lowstock')}
                                                className="text-sm text-primary hover:underline"
                                            >
                                                View all {lowStockProducts.length} low stock items
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── STOCK SHEET TAB ─────────────────────────────────── */}
                {activeTab === 'sheet' && (
                    <div className="space-y-4">
                        {/* Search */}
                        <div className="relative max-w-md">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products..."
                                className="w-full pl-12 pr-4 py-3 bg-card border border-hairline rounded-xl text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary/30 transition-colors"
                            />
                        </div>

                        {/* Grand total bar */}
                        <div className="bg-card rounded-2xl border border-hairline p-4 flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                                {grandTotal.products} Products | {grandTotal.qty.toLocaleString()} Items in Stock
                            </span>
                            <div className="text-sm">
                                <span className="text-muted-foreground">Total Stock Value: </span>
                                <strong className="text-foreground">{fmt(grandTotal.cost)}</strong>
                            </div>
                        </div>

                        {/* Categories — each in its own card */}
                        {groupedProducts.length > 0 ? (
                            <div className="space-y-5">
                                {groupedProducts.map((cat, catIdx) => {
                                    const COLORS = ['border-l-chart-1', 'border-l-chart-2', 'border-l-chart-3', 'border-l-chart-4', 'border-l-chart-5', 'border-l-chart-6'];
                                    const accent = COLORS[catIdx % COLORS.length];
                                    return (
                                        <div key={cat.category} className={`bg-card rounded-2xl border border-hairline overflow-hidden border-l-4 ${accent}`}>
                                            {/* Category header */}
                                            <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-bold text-foreground">{cat.category}</h3>
                                                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                                                        {cat.products.length} {cat.products.length === 1 ? 'product' : 'products'}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {cat.totalQty} items | Stock Value: <strong className="text-foreground">{fmt(cat.totalCost)}</strong>
                                                </div>
                                            </div>

                                            {/* Products table */}
                                            <div className="overflow-auto max-h-[max(320px,calc(100vh-300px))] print:max-h-none print:overflow-visible">
<table className="w-full text-sm">
                                                <thead>
                                                    <tr>
                                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-left font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Product</th>
                                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Quantity</th>
                                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Cost Price</th>
                                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Sell Price</th>
                                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Margin</th>
                                                        {canAdjustStock && <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-center font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap no-print w-16">Adjust</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cat.products.map((p) => {
                                                        const stock = p.stockQuantity ?? 0;
                                                        const margin = p.sellingPrice > 0 ? ((p.sellingPrice - (p.costPrice || 0)) / p.sellingPrice * 100) : 0;
                                                        const level = stockLevel(p);
                                                        const isLow = level === 'low';
                                                        const isOut = level === 'out';
                                                        return (
                                                            <tr key={p._id} className="h-[var(--row-h)] shadow-[inset_0_1px_0_var(--hairline)] hover:bg-[var(--hover-overlay)]">
                                                                <td className="py-1.5 px-4">
                                                                    <p className="font-medium text-foreground">{p.name}</p>
                                                                    {p.sku && <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>}
                                                                </td>
                                                                <td className="py-1.5 px-4 text-right">
                                                                    <span className={`font-semibold tabular-nums ${isOut ? 'text-destructive' : isLow ? 'text-warning-chip-foreground' : ''}`}>
                                                                        {stock}
                                                                    </span>
                                                                    {isOut && <StatusChip className="ml-2" size="xs" shape="tag" tone="destructive" label="Out" />}
                                                                    {!isOut && isLow && <StatusChip className="ml-2" size="xs" shape="tag" tone="warning" label="Low" />}
                                                                </td>
                                                                <td className="py-1.5 px-4 text-right text-muted-foreground">{fmt(p.costPrice)}</td>
                                                                <td className="py-1.5 px-4 text-right text-muted-foreground">{fmt(p.sellingPrice)}</td>
                                                                <td className="py-1.5 px-4 text-right text-muted-foreground">{margin.toFixed(1)}%</td>
                                                                {canAdjustStock && (
                                                                <td className="py-1.5 px-4 text-center no-print">
                                                                    <IconButton label="Adjust stock" size="xs" onClick={() => openAdjust(p)}>
                                                                        <FiActivity />
                                                                    </IconButton>
                                                                </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                {/* Category total footer */}
                                                <tfoot>
                                                    <tr className="bg-muted/50 shadow-[inset_0_1px_0_var(--border)]">
                                                        <td className="py-1.5 px-4 font-semibold text-foreground">{cat.category} Total</td>
                                                        <td className="py-1.5 px-4 text-right font-semibold text-foreground">{cat.totalQty}</td>
                                                        <td className="py-1.5 px-4 text-right font-semibold text-foreground">{fmt(cat.totalCost)}</td>
                                                        <td className="py-1.5 px-4 text-right font-semibold text-foreground">{fmt(cat.totalRetail)}</td>
                                                        <td className="py-1.5 px-4 text-right font-semibold text-foreground">
                                                            {cat.totalRetail > 0 ? ((cat.totalRetail - cat.totalCost) / cat.totalRetail * 100).toFixed(1) : 0}%
                                                        </td>
                                                        <td className="no-print"></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Grand Total card */}
                                <div className="bg-foreground rounded-2xl border border-border p-5 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Grand Total</p>
                                        <p className="text-2xl font-bold text-white mt-1">{fmt(grandTotal.cost)}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Total stock value at cost price</p>
                                    </div>
                                    <div className="flex items-center gap-8 text-right">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">Products</p>
                                            <p className="text-xl font-bold text-white">{grandTotal.products}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">Items</p>
                                            <p className="text-xl font-bold text-white">{grandTotal.qty.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">Retail Value</p>
                                            <p className="text-xl font-bold text-white">{fmt(grandTotal.retail)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">Avg Margin</p>
                                            <p className="text-xl font-bold text-success">
                                                {grandTotal.retail > 0 ? ((grandTotal.retail - grandTotal.cost) / grandTotal.retail * 100).toFixed(1) : 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-hairline">
                                <FiPackage size={48} className="text-placeholder" />
                                <p className="mt-4 text-muted-foreground">No products found</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── MOVEMENTS TAB ───────────────────────────────────── */}
                {activeTab === 'movements' && (
                    <DataTable
                        caption="Stock movements"
                        data={movements}
                        columns={movementColumns}
                        getRowId={(m) => m._id}
                        filters={
                            <>
                                <Select
                                    className="w-[200px]"
                                    aria-label="Movement type"
                                    value={movementType}
                                    onChange={(e) => { setMovementType(e.target.value); setMovementPage(1); }}
                                >
                                    <option value="">All types</option>
                                    <option value="supply_in">Supply In</option>
                                    <option value="bill_sold">Sold</option>
                                    <option value="bill_return">Customer Return</option>
                                    <option value="bill_cancel">Bill Cancelled</option>
                                    <option value="supply_return">Supply Return</option>
                                    <option value="manual_adjustment">Manual Adjustment</option>
                                    <option value="supply_update_reverse">Supply Reversed</option>
                                    <option value="supply_update_add">Supply Added</option>
                                    <option value="supply_delete">Supply Deleted</option>
                                </Select>
                                {movementType === 'manual_adjustment' && (
                                    <Select
                                        className="w-[180px]"
                                        aria-label="Adjustment reason"
                                        value={movementReason}
                                        onChange={(e) => { setMovementReason(e.target.value); setMovementPage(1); }}
                                    >
                                        <option value="">All reasons</option>
                                        {ADJUST_REASONS.map((r) => (
                                            <option key={r.value} value={r.value}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </Select>
                                )}
                            </>
                        }
                        isFiltered={!!movementType}
                        onClearFilters={() => {
                            setMovementType('');
                            setMovementReason('');
                            setMovementPage(1);
                        }}
                        empty={{ icon: FiActivity, title: 'No stock movements yet', description: 'Supplies, sales, returns and adjustments show here.' }}
                        server={{ page: movementsMeta.page || 1, pageSize: 30, total: movementsMeta.total || 0, onPageChange: setMovementPage, noun: 'movements' }}
                    />
                )}

                {/* ── LOW STOCK TAB ───────────────────────────────────── */}
                {activeTab === 'lowstock' && (
                    <DataTable
                        id="inventory-lowstock"
                        caption="Products that need restocking"
                        data={lowStockProducts}
                        columns={lowStockColumns}
                        getRowId={(p) => p._id}
                        empty={{ icon: FiPackage, title: 'All stocked up!', description: 'No products are below their low stock threshold.' }}
                        rowTone={(p) => ((p.stockQuantity ?? 0) === 0 ? null : 'attention')}
                        initialSort={[{ id: 'stock', desc: false }]}
                    />
                )}

                {/* ── DEAD STOCK TAB ──────────────────────────────────── */}
                {activeTab === 'deadstock' && (
                    <div className="space-y-4">
                        {/* Days filter */}
                        <div className="flex items-center gap-3">
                            <FiCalendar className="text-muted-foreground" size={16} />
                            <span className="text-sm text-muted-foreground">Not sold in last</span>
                            <Select className="w-[120px]" aria-label="Days without a sale" value={deadStockDays} onChange={(e) => setDeadStockDays(Number(e.target.value))}>
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
                                <option value={60}>60 days</option>
                                <option value={90}>90 days</option>
                            </Select>
                        </div>

                        {deadStockData && (
                            <>
                                {/* Summary */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-card rounded-2xl border border-hairline p-5">
                                        <p className="text-sm text-muted-foreground">Dead Stock Products</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">{deadStockData.summary?.deadProducts || 0}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            of {deadStockData.summary?.totalProducts || 0} total ({(deadStockData.summary?.deadPercentage || 0).toFixed(1)}%)
                                        </p>
                                    </div>
                                    <div className="bg-card rounded-2xl border border-hairline p-5">
                                        <p className="text-sm text-muted-foreground">Capital Locked</p>
                                        <p className="text-2xl font-bold text-destructive mt-1">{fmt(deadStockData.summary?.totalDeadCostValue || deadStockData.summary?.totalDeadValue)}</p>
                                        <p className="text-xs text-muted-foreground mt-1">At cost price</p>
                                    </div>
                                    <div className="bg-card rounded-2xl border border-hairline p-5">
                                        <p className="text-sm text-muted-foreground">Retail Value</p>
                                        <p className="text-2xl font-bold text-primary mt-1">
                                            {fmt(
                                                deadStockData.summary?.totalDeadRetailValue ??
                                                    // The server sends the list as `deadStock` and no retail total — add it up here
                                                    (deadStockData.deadStock || deadStockData.products || []).reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.stockQuantity || 0), 0)
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">If sold at full price</p>
                                    </div>
                                </div>

                                {/* Dead stock table */}
                                <DataTable
                                    id="inventory-deadstock"
                                    caption="Dead stock"
                                    data={deadStockData.deadStock || deadStockData.products || []}
                                    columns={deadStockColumns}
                                    getRowId={(p) => p._id}
                                    empty={{ icon: FiArchive, title: 'No dead stock!', description: `All products have been sold within the last ${deadStockDays} days.` }}
                                    initialSort={[{ id: 'costValue', desc: true }]}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── ADJUST STOCK MODAL ──────────────────────────────── */}
            {adjustModal && (() => {
                const after = stockAfterAdjust(adjustCurrent, adjustOp, adjustQty);
                const change = after === null ? null : after - adjustCurrent;
                const reasonDef = ADJUST_REASONS.find((r) => r.value === adjustReason);
                const field = 'w-full h-10 px-3 bg-card border border-hairline rounded-lg text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary';
                const label = 'block mb-1.5 text-xs font-medium text-muted-foreground';
                return (
                    <DialogShell size="md" className="max-h-[90vh] overflow-y-auto">
                            {/* Header: product + current stock */}
                            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-hairline">
                                <div className="min-w-0">
                                    <h3 className="text-base font-semibold text-foreground">Adjust stock</h3>
                                    <p className="mt-0.5 text-sm text-muted-foreground truncate">
                                        {adjustModal.name} · <span className="tabular-nums">In stock: <b className="font-semibold text-foreground">{adjustCurrent}</b></span>
                                    </p>
                                </div>
                                <button data-dialog-close onClick={() => setAdjustModal(null)} aria-label="Close" className="p-1.5 -mr-1.5 hover:bg-[var(--hover-overlay)] rounded-lg text-muted-foreground">
                                    <FiX size={18} />
                                </button>
                            </div>

                            <div className="px-5 py-4 space-y-4">
                                {/* Operation — compact segmented control */}
                                <div className="grid grid-cols-3 p-1 rounded-lg bg-muted border border-hairline">
                                    {[
                                        { value: 'subtract', label: 'Subtract', icon: FiArrowDown },
                                        { value: 'add', label: 'Add', icon: FiArrowUp },
                                        { value: 'set', label: 'Set to', icon: FiMinus },
                                    ].map((op) => (
                                        <button
                                            key={op.value}
                                            type="button"
                                            onClick={() => changeAdjustOp(op.value)}
                                            className={`h-8 flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
                                                adjustOp === op.value
                                                    ? 'bg-card text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <op.icon size={13} />
                                            {op.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Quantity + resulting stock side by side */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="adjust-qty" className={label}>{adjustOp === 'set' ? 'New stock' : 'Quantity'}</label>
                                        <input
                                            id="adjust-qty"
                                            type="number"
                                            inputMode="numeric"
                                            value={adjustQty}
                                            onChange={(e) => setAdjustQty(e.target.value)}
                                            min="0"
                                            step="1"
                                            placeholder="0"
                                            className={`${field} tabular-nums font-semibold`}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <p className={label}>{adjustOp === 'set' ? 'Change' : 'New stock'}</p>
                                        <div className="h-10 px-3 flex items-center rounded-lg bg-muted/40 border border-dashed border-hairline text-sm tabular-nums">
                                            {after === null ? (
                                                <span className="text-muted-foreground">—</span>
                                            ) : adjustOp === 'set' ? (
                                                <b className={`font-semibold ${change > 0 ? 'text-success' : change < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                    {change > 0 ? '+' : ''}{change}
                                                </b>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {adjustCurrent} → <b className={`font-semibold ${after < 0 ? 'text-destructive' : 'text-foreground'}`}>{after}</b>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Reason — dropdown; "Other" lets them type it */}
                                <div>
                                    <label htmlFor="adjust-reason" className={label}>Reason <span className="text-destructive">*</span></label>
                                    <div className="relative">
                                        <select
                                            id="adjust-reason"
                                            value={adjustReason}
                                            onChange={(e) => setAdjustReason(e.target.value)}
                                            className={`${field} appearance-none pr-9 ${adjustReason ? '' : 'text-muted-foreground'}`}
                                        >
                                            <option value="" disabled>Select a reason…</option>
                                            {reasonsForOperation(adjustOp).map((r) => (
                                                <option key={r.value} value={r.value} className="text-foreground">{r.label}</option>
                                            ))}
                                        </select>
                                        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                                    </div>
                                </div>

                                {/* Typed reason for "Other", otherwise an optional note */}
                                {adjustReason && (
                                    <div>
                                        <label htmlFor="adjust-note" className={label}>
                                            {reasonDef?.noteRequired ? <>Type the reason <span className="text-destructive">*</span></> : <>Note <span className="font-normal text-muted-foreground">(optional)</span></>}
                                        </label>
                                        <input
                                            id="adjust-note"
                                            type="text"
                                            value={adjustNote}
                                            onChange={(e) => setAdjustNote(e.target.value)}
                                            maxLength={NOTE_MAX}
                                            autoFocus={!!reasonDef?.noteRequired}
                                            placeholder={
                                                reasonDef?.noteRequired ? 'e.g. Given to staff, sample for customer'
                                                    : adjustReason === 'transfer_out' || adjustReason === 'transfer_in' ? 'e.g. Branch 2'
                                                    : 'e.g. Counted shelf today'
                                            }
                                            className={field}
                                        />
                                        {adjustNote.length > NOTE_MAX - 40 && (
                                            <p className="mt-1 text-right text-caption text-muted-foreground">{adjustNote.length}/{NOTE_MAX}</p>
                                        )}
                                    </div>
                                )}

                                {adjustError && (adjustQty !== '' || adjustReason) && (
                                    <p className="text-body text-destructive">{adjustError}</p>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-2 px-5 py-4 border-t border-hairline">
                                <button
                                    onClick={() => setAdjustModal(null)}
                                    className="h-10 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAdjustStock}
                                    disabled={!!adjustError || adjustSaving}
                                    className="h-10 px-5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {adjustSaving ? 'Saving…' : 'Update stock'}
                                </button>
                            </div>
                        </DialogShell>
                );
            })()}
        </div>
    );
};

export default Inventory;
