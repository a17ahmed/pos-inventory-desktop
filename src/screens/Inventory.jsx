import React, { useState, useEffect, useCallback } from 'react';
import { useBusiness } from '../context/BusinessContext';
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
} from 'react-icons/fi';
import {
    getProducts,
    getInventoryValuation,
    getStockMovements,
    getLowStockProducts,
    getDeadStock,
    updateStock,
} from '../services/api/products';

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

    // Print
    const [showPrintView, setShowPrintView] = useState(false);

    const currency = business?.currency || 'Rs.';
    const fmt = (n) => `${currency} ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    // ── Fetch data ─────────────────────────────────────────────
    const fetchProducts = useCallback(async () => {
        try {
            const res = await getProducts();
            setAllProducts(res.data || []);
            // Derive low stock from products
            const low = (res.data || []).filter(p => p.trackStock !== false && (p.stockQuantity ?? 0) <= (p.lowStockAlert || 10));
            setLowStockProducts(low);
        } catch (err) {
            console.error('Error fetching products:', err);
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
    }, [movementType]);

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
    }, [movementPage, movementType, activeTab, fetchMovements]);

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
    const handleAdjustStock = async () => {
        if (!adjustModal || !adjustQty) return;
        try {
            await updateStock(adjustModal._id, { quantity: Number(adjustQty), operation: adjustOp });
            setAdjustModal(null);
            setAdjustQty('');
            // Refresh relevant data
            fetchProducts();
            fetchOverview();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to adjust stock');
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
            supply_in: { label: 'Supply In', color: 'text-emerald-600 dark:text-d-green bg-emerald-50 dark:bg-emerald-500/10' },
            supply_update_reverse: { label: 'Supply Reversed', color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10' },
            supply_update_add: { label: 'Supply Added', color: 'text-emerald-600 dark:text-d-green bg-emerald-50 dark:bg-emerald-500/10' },
            supply_delete: { label: 'Supply Deleted', color: 'text-red-600 dark:text-d-red bg-red-50 dark:bg-red-500/10' },
            supply_return: { label: 'Supply Return', color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10' },
            bill_sold: { label: 'Sold', color: 'text-blue-600 dark:text-d-blue bg-blue-50 dark:bg-blue-500/10' },
            bill_return: { label: 'Customer Return', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10' },
            manual_adjustment: { label: 'Manual Adjust', color: 'text-slate-600 dark:text-d-muted bg-slate-100 dark:bg-white/5' },
        };
        return map[type] || { label: type, color: 'text-slate-600 dark:text-d-muted bg-slate-100 dark:bg-white/5' };
    };

    // ── Loading state ──────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading inventory...</p>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════
    // PRINT VIEW — Stock Sheet
    // ══════════════════════════════════════════════════════════
    if (showPrintView) {
        return (
            <div className="fixed inset-0 z-50 bg-white overflow-auto print-static print:bg-white print:z-auto">
                <div className="max-w-[900px] mx-auto p-8">
                    {/* Print header */}
                    <div className="flex items-center justify-between mb-6 no-print">
                        <h2 className="text-xl font-bold text-slate-800">Inventory Stock Sheet</h2>
                        <button onClick={() => setShowPrintView(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                            <FiX size={20} />
                        </button>
                    </div>

                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-900">{business?.name || 'Business'}</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Inventory Stock Sheet — {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6 border border-slate-200 rounded-lg p-4">
                        <div className="text-center">
                            <p className="text-xs text-slate-500 uppercase">Total Products</p>
                            <p className="text-lg font-bold text-slate-800">{grandTotal.products}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-slate-500 uppercase">Total Items in Stock</p>
                            <p className="text-lg font-bold text-slate-800">{grandTotal.qty.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-slate-500 uppercase">Total Stock Value (Cost)</p>
                            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.cost)}</p>
                        </div>
                    </div>

                    {/* Category tables */}
                    {groupedProducts.map((cat) => (
                        <div key={cat.category} className="mb-6 break-inside-avoid">
                            <div className="flex items-center justify-between bg-slate-100 px-4 py-2 rounded-t-lg">
                                <span className="font-semibold text-slate-800">{cat.category}</span>
                                <span className="text-sm text-slate-500">
                                    {cat.products.length} products | {cat.totalQty} items
                                </span>
                            </div>
                            <table className="w-full text-sm border border-slate-200 border-t-0">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600">
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
                                            <tr key={p._id} className="border-t border-slate-100">
                                                <td className="py-2 px-3 text-slate-800">{p.name}</td>
                                                <td className={`py-2 px-3 text-right font-medium ${stock === 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                                    {stock}
                                                </td>
                                                <td className="py-2 px-3 text-right text-slate-600">{fmt(p.costPrice)}</td>
                                                <td className="py-2 px-3 text-right text-slate-600">{fmt(p.sellingPrice)}</td>
                                                <td className="py-2 px-3 text-right text-slate-600">{margin.toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })}
                                    {/* Category Total */}
                                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                                        <td className="py-2 px-3 text-slate-800">{cat.category} Total</td>
                                        <td className="py-2 px-3 text-right text-slate-800">{cat.totalQty}</td>
                                        <td className="py-2 px-3 text-right text-slate-800">{fmt(cat.totalCost)}</td>
                                        <td className="py-2 px-3 text-right text-slate-800">{fmt(cat.totalRetail)}</td>
                                        <td className="py-2 px-3 text-right text-slate-600">
                                            {cat.totalRetail > 0 ? ((cat.totalRetail - cat.totalCost) / cat.totalRetail * 100).toFixed(1) : 0}%
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ))}

                    {/* Grand total */}
                    <div className="border-t-2 border-slate-800 mt-4 pt-3">
                        <div className="flex justify-between text-base font-bold text-slate-800">
                            <span>GRAND TOTAL</span>
                            <span>{grandTotal.qty.toLocaleString()} items</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-slate-600">Total Stock Value (at Cost):</span>
                            <span className="font-bold text-slate-800">{fmt(grandTotal.cost)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-slate-600">Total Retail Value:</span>
                            <span className="font-bold text-slate-800">{fmt(grandTotal.retail)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-slate-600">Potential Profit:</span>
                            <span className="font-bold text-emerald-700">{fmt(grandTotal.retail - grandTotal.cost)}</span>
                        </div>
                    </div>

                    <p className="text-xs text-slate-400 text-center mt-8">
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
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-auto">
            <div className="p-6 animate-fade-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Inventory</h1>
                        <p className="text-slate-500 dark:text-d-muted">Stock management & valuation</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { fetchProducts(); fetchOverview(); }}
                            className="flex items-center gap-2 px-4 py-2.5 text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-all"
                        >
                            <FiRefreshCw size={18} />
                            Refresh
                        </button>
                        <button
                            onClick={handlePrintSheet}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all"
                        >
                            <FiDownload size={18} />
                            Download Sheet
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border mb-6 overflow-x-auto">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                        : 'text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass'
                                }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                                {tab.key === 'lowstock' && lowStockProducts.length > 0 && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-white/20' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-d-red'}`}>
                                        {lowStockProducts.length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── OVERVIEW TAB ────────────────────────────────────── */}
                {activeTab === 'overview' && valuation && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Products', value: valuation.summary?.totalProducts || 0, icon: FiPackage, color: 'text-blue-600 dark:text-d-blue', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                                { label: 'Total Items in Stock', value: (valuation.summary?.totalItems || 0).toLocaleString(), icon: FiArchive, color: 'text-emerald-600 dark:text-d-green', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                                { label: 'Total Cost Value', value: fmt(valuation.summary?.totalCostValue), icon: FiDollarSign, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
                                { label: 'Total Retail Value', value: fmt(valuation.summary?.totalRetailValue), icon: FiTrendingUp, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
                            ].map((card, i) => (
                                <div key={i} className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                                            <card.icon size={20} className={card.color} />
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">{card.label}</p>
                                    <p className="text-2xl font-bold text-slate-800 dark:text-d-heading mt-1">{card.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Potential Profit & Margin */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-5">
                                <p className="text-sm text-slate-500 dark:text-d-muted mb-1">Potential Profit (if all sold)</p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-d-green">{fmt(valuation.summary?.totalPotentialProfit)}</p>
                                <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Retail Value - Cost Value</p>
                            </div>
                            <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-5">
                                <p className="text-sm text-slate-500 dark:text-d-muted mb-1">Average Margin</p>
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{(valuation.summary?.avgMargin || 0).toFixed(1)}%</p>
                                <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Across all products</p>
                            </div>
                        </div>

                        {/* Category Breakdown */}
                        {valuation.byCategory && valuation.byCategory.length > 0 && (
                            <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200 dark:border-d-border">
                                    <h3 className="font-semibold text-slate-800 dark:text-d-heading">Valuation by Category</h3>
                                </div>
                                <table className="w-full">
                                    <thead className="bg-slate-50 dark:bg-d-glass">
                                        <tr>
                                            <th className="text-left py-3 px-6 text-sm font-medium text-slate-500 dark:text-d-muted">Category</th>
                                            <th className="text-right py-3 px-6 text-sm font-medium text-slate-500 dark:text-d-muted">Products</th>
                                            <th className="text-right py-3 px-6 text-sm font-medium text-slate-500 dark:text-d-muted">Items</th>
                                            <th className="text-right py-3 px-6 text-sm font-medium text-slate-500 dark:text-d-muted">Cost Value</th>
                                            <th className="text-right py-3 px-6 text-sm font-medium text-slate-500 dark:text-d-muted">Retail Value</th>
                                            <th className="text-right py-3 px-6 text-sm font-medium text-slate-500 dark:text-d-muted">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {valuation.byCategory.map((cat, i) => (
                                            <tr key={i} className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-6 font-medium text-slate-800 dark:text-d-text">{cat._id || cat.category || 'Uncategorized'}</td>
                                                <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{cat.productCount}</td>
                                                <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{(cat.itemCount || 0).toLocaleString()}</td>
                                                <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{fmt(cat.costValue)}</td>
                                                <td className="py-3 px-6 text-right font-medium text-slate-800 dark:text-d-text">{fmt(cat.retailValue)}</td>
                                                <td className="py-3 px-6 text-right font-medium text-emerald-600 dark:text-d-green">{fmt(cat.potentialProfit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Low stock preview */}
                        {lowStockProducts.length > 0 && (
                            <div className="bg-white dark:bg-d-card rounded-2xl border border-red-200 dark:border-red-500/20 overflow-hidden">
                                <div className="px-6 py-4 border-b border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 flex items-center gap-2">
                                    <FiAlertTriangle className="text-red-500 dark:text-d-red" size={18} />
                                    <h3 className="font-semibold text-red-700 dark:text-d-red">Low Stock Alert — {lowStockProducts.length} products</h3>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-d-border">
                                    {lowStockProducts.slice(0, 5).map((p) => (
                                        <div key={p._id} className="px-6 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-slate-800 dark:text-d-text">{p.name}</p>
                                                <p className="text-xs text-slate-400 dark:text-d-faint">{p.category}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${(p.stockQuantity || 0) === 0 ? 'text-red-600 dark:text-d-red' : 'text-orange-500'}`}>
                                                    {p.stockQuantity ?? 0} left
                                                </p>
                                                <p className="text-xs text-slate-400 dark:text-d-faint">Alert at {p.lowStockAlert || 10}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {lowStockProducts.length > 5 && (
                                        <div className="px-6 py-3 text-center">
                                            <button
                                                onClick={() => setActiveTab('lowstock')}
                                                className="text-sm text-amber-600 dark:text-d-accent hover:underline"
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
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products..."
                                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover transition-colors"
                            />
                        </div>

                        {/* Grand total bar */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-4 flex items-center justify-between">
                            <span className="font-semibold text-slate-800 dark:text-d-heading">
                                {grandTotal.products} Products | {grandTotal.qty.toLocaleString()} Items in Stock
                            </span>
                            <div className="text-sm">
                                <span className="text-slate-500 dark:text-d-muted">Total Stock Value: </span>
                                <strong className="text-slate-800 dark:text-d-text">{fmt(grandTotal.cost)}</strong>
                            </div>
                        </div>

                        {/* Categories — each in its own card */}
                        {groupedProducts.length > 0 ? (
                            <div className="space-y-5">
                                {groupedProducts.map((cat, catIdx) => {
                                    const COLORS = ['border-l-amber-500', 'border-l-blue-500', 'border-l-emerald-500', 'border-l-purple-500', 'border-l-rose-500', 'border-l-cyan-500', 'border-l-orange-500', 'border-l-pink-500'];
                                    const accent = COLORS[catIdx % COLORS.length];
                                    return (
                                        <div key={cat.category} className={`bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border overflow-hidden border-l-4 ${accent}`}>
                                            {/* Category header */}
                                            <div className="px-6 py-4 border-b border-slate-200 dark:border-d-border flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-bold text-slate-800 dark:text-d-heading">{cat.category}</h3>
                                                    <span className="text-xs font-medium text-slate-400 dark:text-d-faint bg-slate-100 dark:bg-d-glass px-2.5 py-1 rounded-full">
                                                        {cat.products.length} {cat.products.length === 1 ? 'product' : 'products'}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-d-muted">
                                                    {cat.totalQty} items | Stock Value: <strong className="text-slate-800 dark:text-d-text">{fmt(cat.totalCost)}</strong>
                                                </div>
                                            </div>

                                            {/* Products table */}
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50/80 dark:bg-d-glass">
                                                    <tr>
                                                        <th className="text-left py-2.5 px-6 font-medium text-slate-500 dark:text-d-muted">Product</th>
                                                        <th className="text-right py-2.5 px-6 font-medium text-slate-500 dark:text-d-muted">Quantity</th>
                                                        <th className="text-right py-2.5 px-6 font-medium text-slate-500 dark:text-d-muted">Cost Price</th>
                                                        <th className="text-right py-2.5 px-6 font-medium text-slate-500 dark:text-d-muted">Sell Price</th>
                                                        <th className="text-right py-2.5 px-6 font-medium text-slate-500 dark:text-d-muted">Margin</th>
                                                        <th className="text-center py-2.5 px-6 font-medium text-slate-500 dark:text-d-muted no-print w-16">Adjust</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cat.products.map((p) => {
                                                        const stock = p.stockQuantity ?? 0;
                                                        const margin = p.sellingPrice > 0 ? ((p.sellingPrice - (p.costPrice || 0)) / p.sellingPrice * 100) : 0;
                                                        const isLow = stock <= (p.lowStockAlert || 10);
                                                        const isOut = stock === 0;
                                                        return (
                                                            <tr key={p._id} className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                                <td className="py-3 px-6">
                                                                    <p className="font-medium text-slate-800 dark:text-d-text">{p.name}</p>
                                                                    {p.sku && <p className="text-xs text-slate-400 dark:text-d-faint font-mono">{p.sku}</p>}
                                                                </td>
                                                                <td className="py-3 px-6 text-right">
                                                                    <span className={`font-semibold ${isOut ? 'text-red-600 dark:text-d-red' : isLow ? 'text-orange-500' : 'text-slate-800 dark:text-d-text'}`}>
                                                                        {stock}
                                                                    </span>
                                                                    {isOut && <span className="ml-2 text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-d-red px-1.5 py-0.5 rounded font-medium">OUT</span>}
                                                                    {!isOut && isLow && <span className="ml-2 text-xs bg-orange-100 dark:bg-orange-500/20 text-orange-600 px-1.5 py-0.5 rounded font-medium">LOW</span>}
                                                                </td>
                                                                <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{fmt(p.costPrice)}</td>
                                                                <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{fmt(p.sellingPrice)}</td>
                                                                <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{margin.toFixed(1)}%</td>
                                                                <td className="py-3 px-6 text-center no-print">
                                                                    <button
                                                                        onClick={() => { setAdjustModal(p); setAdjustQty(String(stock)); setAdjustOp('set'); }}
                                                                        className="p-1.5 text-slate-400 dark:text-d-faint hover:text-amber-500 dark:hover:text-d-accent hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                                                                        title="Adjust stock"
                                                                    >
                                                                        <FiActivity size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                {/* Category total footer */}
                                                <tfoot>
                                                    <tr className="border-t-2 border-slate-200 dark:border-d-faint bg-slate-50 dark:bg-white/[0.03]">
                                                        <td className="py-3 px-6 font-semibold text-slate-700 dark:text-d-heading">{cat.category} Total</td>
                                                        <td className="py-3 px-6 text-right font-semibold text-slate-700 dark:text-d-heading">{cat.totalQty}</td>
                                                        <td className="py-3 px-6 text-right font-semibold text-slate-700 dark:text-d-heading">{fmt(cat.totalCost)}</td>
                                                        <td className="py-3 px-6 text-right font-semibold text-slate-700 dark:text-d-heading">{fmt(cat.totalRetail)}</td>
                                                        <td className="py-3 px-6 text-right font-semibold text-slate-700 dark:text-d-heading">
                                                            {cat.totalRetail > 0 ? ((cat.totalRetail - cat.totalCost) / cat.totalRetail * 100).toFixed(1) : 0}%
                                                        </td>
                                                        <td className="no-print"></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    );
                                })}

                                {/* Grand Total card */}
                                <div className="bg-slate-800 dark:bg-d-elevated rounded-2xl border border-slate-700 dark:border-d-border p-5 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-400 dark:text-d-muted uppercase tracking-wider font-medium">Grand Total</p>
                                        <p className="text-2xl font-bold text-white dark:text-d-heading mt-1">{fmt(grandTotal.cost)}</p>
                                        <p className="text-xs text-slate-400 dark:text-d-faint mt-0.5">Total stock value at cost price</p>
                                    </div>
                                    <div className="flex items-center gap-8 text-right">
                                        <div>
                                            <p className="text-xs text-slate-400 dark:text-d-muted uppercase">Products</p>
                                            <p className="text-xl font-bold text-white dark:text-d-heading">{grandTotal.products}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 dark:text-d-muted uppercase">Items</p>
                                            <p className="text-xl font-bold text-white dark:text-d-heading">{grandTotal.qty.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 dark:text-d-muted uppercase">Retail Value</p>
                                            <p className="text-xl font-bold text-white dark:text-d-heading">{fmt(grandTotal.retail)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 dark:text-d-muted uppercase">Avg Margin</p>
                                            <p className="text-xl font-bold text-emerald-400 dark:text-d-green">
                                                {grandTotal.retail > 0 ? ((grandTotal.retail - grandTotal.cost) / grandTotal.retail * 100).toFixed(1) : 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border">
                                <FiPackage size={48} className="text-slate-300 dark:text-d-faint" />
                                <p className="mt-4 text-slate-500 dark:text-d-muted">No products found</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── MOVEMENTS TAB ───────────────────────────────────── */}
                {activeTab === 'movements' && (
                    <div className="space-y-4">
                        {/* Filter */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <FiFilter className="text-slate-400 dark:text-d-faint" size={16} />
                                <select
                                    value={movementType}
                                    onChange={(e) => { setMovementType(e.target.value); setMovementPage(1); }}
                                    className="px-4 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-700 dark:text-d-text focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                >
                                    <option value="">All Types</option>
                                    <option value="supply_in">Supply In</option>
                                    <option value="bill_sold">Sold</option>
                                    <option value="bill_return">Customer Return</option>
                                    <option value="supply_return">Supply Return</option>
                                    <option value="manual_adjustment">Manual Adjustment</option>
                                    <option value="supply_update_reverse">Supply Reversed</option>
                                    <option value="supply_update_add">Supply Added</option>
                                    <option value="supply_delete">Supply Deleted</option>
                                </select>
                            </div>
                            <span className="text-sm text-slate-400 dark:text-d-faint">{movementsMeta.total} records</span>
                        </div>

                        {/* Movements table */}
                        <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-d-glass">
                                    <tr>
                                        <th className="text-left py-3 px-5 font-medium text-slate-500 dark:text-d-muted">Date</th>
                                        <th className="text-left py-3 px-5 font-medium text-slate-500 dark:text-d-muted">Product</th>
                                        <th className="text-left py-3 px-5 font-medium text-slate-500 dark:text-d-muted">Type</th>
                                        <th className="text-right py-3 px-5 font-medium text-slate-500 dark:text-d-muted">Qty</th>
                                        <th className="text-right py-3 px-5 font-medium text-slate-500 dark:text-d-muted">Before</th>
                                        <th className="text-right py-3 px-5 font-medium text-slate-500 dark:text-d-muted">After</th>
                                        <th className="text-left py-3 px-5 font-medium text-slate-500 dark:text-d-muted">Reference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((m, i) => {
                                        const ml = movementLabel(m.type);
                                        const isPositive = (m.quantity || 0) > 0;
                                        return (
                                            <tr key={m._id || i} className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-5 text-slate-600 dark:text-d-muted whitespace-nowrap">
                                                    {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    <span className="text-slate-400 dark:text-d-faint ml-1 text-xs">
                                                        {new Date(m.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-5 font-medium text-slate-800 dark:text-d-text">{m.productName}</td>
                                                <td className="py-3 px-5">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${ml.color}`}>
                                                        {ml.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-5 text-right">
                                                    <span className={`font-semibold flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}`}>
                                                        {isPositive ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}
                                                        {isPositive ? '+' : ''}{m.quantity}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-5 text-right text-slate-500 dark:text-d-muted">{m.previousStock}</td>
                                                <td className="py-3 px-5 text-right font-medium text-slate-800 dark:text-d-text">{m.newStock}</td>
                                                <td className="py-3 px-5 text-slate-500 dark:text-d-muted font-mono text-xs">{m.referenceNumber || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                    {movements.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-20 text-center text-slate-400 dark:text-d-faint">
                                                <FiActivity size={36} className="mx-auto mb-3 opacity-40" />
                                                <p className="text-slate-500 dark:text-d-muted">No stock movements found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {movementsMeta.totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setMovementPage(p => Math.max(1, p - 1))}
                                    disabled={movementsMeta.page <= 1}
                                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-d-border text-sm text-slate-600 dark:text-d-muted hover:bg-slate-50 dark:hover:bg-d-glass disabled:opacity-40 transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-slate-500 dark:text-d-muted">
                                    Page {movementsMeta.page} of {movementsMeta.totalPages}
                                </span>
                                <button
                                    onClick={() => setMovementPage(p => Math.min(movementsMeta.totalPages, p + 1))}
                                    disabled={movementsMeta.page >= movementsMeta.totalPages}
                                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-d-border text-sm text-slate-600 dark:text-d-muted hover:bg-slate-50 dark:hover:bg-d-glass disabled:opacity-40 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── LOW STOCK TAB ───────────────────────────────────── */}
                {activeTab === 'lowstock' && (
                    <div className="space-y-4">
                        {lowStockProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border">
                                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                    <FiPackage size={28} className="text-emerald-500 dark:text-d-green" />
                                </div>
                                <p className="text-lg font-semibold text-slate-800 dark:text-d-heading">All stocked up!</p>
                                <p className="text-slate-500 dark:text-d-muted mt-1">No products are below their low stock threshold.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200 dark:border-d-border flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiAlertTriangle className="text-red-500 dark:text-d-red" size={18} />
                                        <h3 className="font-semibold text-slate-800 dark:text-d-heading">{lowStockProducts.length} Products Need Restocking</h3>
                                    </div>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-d-glass">
                                        <tr>
                                            <th className="text-left py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Product</th>
                                            <th className="text-left py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Category</th>
                                            <th className="text-right py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Current Stock</th>
                                            <th className="text-right py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Alert Level</th>
                                            <th className="text-right py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Cost Price</th>
                                            <th className="text-right py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Sell Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lowStockProducts.map((p) => {
                                            const stock = p.stockQuantity ?? 0;
                                            const isOut = stock === 0;
                                            return (
                                                <tr key={p._id} className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="py-3 px-6">
                                                        <p className="font-medium text-slate-800 dark:text-d-text">{p.name}</p>
                                                        {p.sku && <p className="text-xs text-slate-400 dark:text-d-faint font-mono">{p.sku}</p>}
                                                    </td>
                                                    <td className="py-3 px-6 text-slate-500 dark:text-d-muted">{p.category || '-'}</td>
                                                    <td className="py-3 px-6 text-right">
                                                        <span className={`font-bold ${isOut ? 'text-red-600 dark:text-d-red' : 'text-orange-500'}`}>
                                                            {stock}
                                                        </span>
                                                        {isOut && <span className="ml-2 text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-d-red px-1.5 py-0.5 rounded font-medium">OUT</span>}
                                                    </td>
                                                    <td className="py-3 px-6 text-right text-slate-500 dark:text-d-muted">{p.lowStockAlert || 10}</td>
                                                    <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{fmt(p.costPrice)}</td>
                                                    <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{fmt(p.sellingPrice)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── DEAD STOCK TAB ──────────────────────────────────── */}
                {activeTab === 'deadstock' && (
                    <div className="space-y-4">
                        {/* Days filter */}
                        <div className="flex items-center gap-3">
                            <FiCalendar className="text-slate-400 dark:text-d-faint" size={16} />
                            <span className="text-sm text-slate-600 dark:text-d-muted">Not sold in last</span>
                            <select
                                value={deadStockDays}
                                onChange={(e) => setDeadStockDays(Number(e.target.value))}
                                className="px-4 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-700 dark:text-d-text focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                            >
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
                                <option value={60}>60 days</option>
                                <option value={90}>90 days</option>
                            </select>
                        </div>

                        {deadStockData && (
                            <>
                                {/* Summary */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-5">
                                        <p className="text-sm text-slate-500 dark:text-d-muted">Dead Stock Products</p>
                                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading mt-1">{deadStockData.summary?.deadProducts || 0}</p>
                                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">
                                            of {deadStockData.summary?.totalProducts || 0} total ({(deadStockData.summary?.deadPercentage || 0).toFixed(1)}%)
                                        </p>
                                    </div>
                                    <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-5">
                                        <p className="text-sm text-slate-500 dark:text-d-muted">Capital Locked</p>
                                        <p className="text-2xl font-bold text-red-600 dark:text-d-red mt-1">{fmt(deadStockData.summary?.totalDeadCostValue || deadStockData.summary?.totalDeadValue)}</p>
                                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">At cost price</p>
                                    </div>
                                    <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-5">
                                        <p className="text-sm text-slate-500 dark:text-d-muted">Retail Value</p>
                                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{fmt(deadStockData.summary?.totalDeadRetailValue)}</p>
                                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">If sold at full price</p>
                                    </div>
                                </div>

                                {/* Dead stock table */}
                                {(deadStockData.products || []).length > 0 ? (
                                    <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-d-glass">
                                                <tr>
                                                    <th className="text-left py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Product</th>
                                                    <th className="text-left py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Category</th>
                                                    <th className="text-right py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Stock</th>
                                                    <th className="text-right py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Cost Value</th>
                                                    <th className="text-right py-3 px-6 font-medium text-slate-500 dark:text-d-muted">Retail Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(deadStockData.products || []).map((p) => (
                                                    <tr key={p._id} className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                        <td className="py-3 px-6">
                                                            <p className="font-medium text-slate-800 dark:text-d-text">{p.name}</p>
                                                            {p.sku && <p className="text-xs text-slate-400 dark:text-d-faint font-mono">{p.sku}</p>}
                                                        </td>
                                                        <td className="py-3 px-6 text-slate-500 dark:text-d-muted">{p.category || '-'}</td>
                                                        <td className="py-3 px-6 text-right font-medium text-slate-800 dark:text-d-text">{p.stockQuantity ?? 0}</td>
                                                        <td className="py-3 px-6 text-right text-red-600 dark:text-d-red">{fmt((p.costPrice || 0) * (p.stockQuantity || 0))}</td>
                                                        <td className="py-3 px-6 text-right text-slate-600 dark:text-d-muted">{fmt((p.sellingPrice || 0) * (p.stockQuantity || 0))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border">
                                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                            <FiArchive size={28} className="text-emerald-500 dark:text-d-green" />
                                        </div>
                                        <p className="text-lg font-semibold text-slate-800 dark:text-d-heading">No dead stock!</p>
                                        <p className="text-slate-500 dark:text-d-muted mt-1">All products have been sold within the last {deadStockDays} days.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── ADJUST STOCK MODAL ──────────────────────────────── */}
            {adjustModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl w-full max-w-sm animate-pop-in">
                        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Adjust Stock</h3>
                            <button onClick={() => setAdjustModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass rounded-lg text-slate-500 dark:text-d-muted">
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <p className="font-medium text-slate-800 dark:text-d-text">{adjustModal.name}</p>
                                <p className="text-sm text-slate-500 dark:text-d-muted">Current stock: {adjustModal.stockQuantity ?? 0}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">Operation</label>
                                <div className="flex gap-2">
                                    {[
                                        { value: 'set', label: 'Set to', icon: FiMinus },
                                        { value: 'add', label: 'Add', icon: FiArrowUp },
                                        { value: 'subtract', label: 'Subtract', icon: FiArrowDown },
                                    ].map((op) => (
                                        <button
                                            key={op.value}
                                            type="button"
                                            onClick={() => setAdjustOp(op.value)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                                                adjustOp === op.value
                                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card border-amber-500 dark:border-d-accent'
                                                    : 'border-slate-200 dark:border-d-border text-slate-600 dark:text-d-muted hover:bg-slate-50 dark:hover:bg-d-glass'
                                            }`}
                                        >
                                            <op.icon size={14} />
                                            {op.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-2">Quantity</label>
                                <input
                                    type="number"
                                    value={adjustQty}
                                    onChange={(e) => setAdjustQty(e.target.value)}
                                    min="0"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text text-lg font-semibold text-center focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setAdjustModal(null)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAdjustStock}
                                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md transition-all"
                                >
                                    Update Stock
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
