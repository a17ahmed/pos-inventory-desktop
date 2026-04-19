import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { getAllReceipts, getReceiptStats, getReceiptsPaginated } from '../services/api/receipts';
import { getCustomer } from '../services/api/customers';
import { printReceipt } from '../utils/printReceipt';
import { downloadReceipt } from '../utils/downloadReceipt';
import {
    FiSearch,
    FiFileText,
    FiCalendar,
    FiDownload,
    FiPrinter,
    FiEye,
    FiX,
    FiDollarSign,
    FiShoppingCart,
    FiTrendingUp,
    FiRefreshCw,
    FiLoader,
    FiCornerDownLeft,
    FiInbox,
} from 'react-icons/fi';

const Receipts = () => {
    const { business } = useBusiness();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('all');
    const [showDetail, setShowDetail] = useState(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalReceipts, setTotalReceipts] = useState(0);
    const scrollContainerRef = useRef(null);

    // Stats from API
    const [stats, setStats] = useState({
        todaySales: 0,
        todayOrders: 0,
        totalSales: 0,
        todayCollected: 0,
        todayCredit: 0,
        todayCashRefund: 0,
        todayLedgerAdjust: 0,
        todayCashInDrawer: 0,
        todayRefunded: 0,
    });

    useEffect(() => {
        fetchReceipts(1, true);
        fetchStats();
    }, []);

    // When date filter changes, fetch appropriately
    useEffect(() => {
        if (dateFilter !== 'all') {
            // Load all receipts when filtering by date
            fetchAllReceipts();
        } else {
            // Reset to paginated loading when switching to "All"
            setPage(1);
            setHasMore(true);
            fetchReceipts(1, true);
        }
    }, [dateFilter]);

    const fetchAllReceipts = async () => {
        setLoading(true);
        try {
            const res = await getAllReceipts();
            const data = res.data?.receipts || res.data || [];
            setReceipts(Array.isArray(data) ? data : []);
            setHasMore(false);
            setTotalReceipts(data.length);
        } catch (error) {
            console.error('Error fetching all receipts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await getReceiptStats();
            const d = res.data || {};
            setStats({
                todaySales: d.todaySales ?? 0,
                todayOrders: d.todayOrders ?? 0,
                totalSales: d.monthOrders ?? 0,
                todayCollected: d.todayCollected ?? 0,
                todayCredit: d.todayCredit ?? 0,
                todayCashRefund: d.todayCashRefund ?? 0,
                todayLedgerAdjust: d.todayLedgerAdjust ?? 0,
                todayCashInDrawer: d.todayCashInDrawer ?? 0,
                todayRefunded: d.todayRefunded ?? 0,
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchReceipts = async (pageNum = 1, reset = false) => {
        if (reset) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const res = await getReceiptsPaginated(pageNum);

            // Handle both old (array) and new (object with receipts) response formats
            const data = res.data?.receipts || res.data || [];
            const pagination = res.data?.pagination;

            if (reset) {
                setReceipts(Array.isArray(data) ? data : []);
            } else {
                setReceipts(prev => [...prev, ...(Array.isArray(data) ? data : [])]);
            }

            if (pagination) {
                setHasMore(pagination.hasMore);
                setTotalReceipts(pagination.total);
                setPage(pagination.page);
            } else {
                // Fallback for old API format
                setHasMore(data.length === 30);
                setTotalReceipts(data.length);
            }
        } catch (error) {
            console.error('Error fetching receipts:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Use ref to track current page for scroll handler
    const pageRef = useRef(page);
    const loadingMoreRef = useRef(loadingMore);
    const hasMoreRef = useRef(hasMore);

    // Keep refs in sync with state
    useEffect(() => {
        pageRef.current = page;
    }, [page]);

    useEffect(() => {
        loadingMoreRef.current = loadingMore;
    }, [loadingMore]);

    useEffect(() => {
        hasMoreRef.current = hasMore;
    }, [hasMore]);

    // Handle scroll for infinite loading (only when viewing "All" receipts)
    const handleScroll = useCallback(() => {
        // Don't auto-load when filtering by date (client-side filtering)
        if (dateFilter !== 'all') return;
        if (loadingMoreRef.current || !hasMoreRef.current) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // Load more when user scrolls to within 300px of bottom
        if (distanceFromBottom < 300) {
            fetchReceipts(pageRef.current + 1, false);
        }
    }, [dateFilter]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            // Use passive listener for better scroll performance
            container.addEventListener('scroll', handleScroll, { passive: true });
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    const handleRefresh = () => {
        setPage(1);
        setHasMore(true);
        fetchReceipts(1, true);
        fetchStats();
    };

    const filteredReceipts = receipts.filter((r) => {
        const matchesSearch =
            r.receiptNumber?.toString().includes(searchQuery) ||
            r.billNumber?.toString().includes(searchQuery) ||
            r.customerName?.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesDate = true;
        if (dateFilter !== 'all') {
            const receiptDate = new Date(r.createdAt);
            const now = new Date();

            switch (dateFilter) {
                case 'today':
                    matchesDate = receiptDate.toDateString() === now.toDateString();
                    break;
                case 'week':
                    // Use midnight 7 days ago (consistent with backend)
                    const weekAgo = new Date(now);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    weekAgo.setHours(0, 0, 0, 0);
                    matchesDate = receiptDate >= weekAgo;
                    break;
                case 'month':
                    matchesDate =
                        receiptDate.getMonth() === now.getMonth() &&
                        receiptDate.getFullYear() === now.getFullYear();
                    break;
            }
        }

        return matchesSearch && matchesDate;
    });

    const currency = business?.currency || 'Rs.';

    const formatCurrency = (amount) => {
        return `${currency} ${(amount || 0).toLocaleString()}`;
    };

    const buildReceiptOpts = async (receipt) => {
        const items = (receipt.items || []).map(it => ({
            name: it.name,
            qty: it.qty || it.quantity || 0,
            price: it.price || it.sellingPrice || 0,
            discountAmount: it.discountAmount || 0,
        }));
        const subtotal = items.reduce((s, it) => s + (it.price * it.qty - (Number(it.discountAmount) || 0)), 0);
        // Use paymentStatus from bill data — if unpaid, it's credit
        const paymentMethod = receipt.paymentStatus === 'unpaid'
            ? 'credit'
            : (receipt.payments?.[0]?.method || 'cash');

        // Fetch customer's total account balance for credit bills
        let customerBalance = 0;
        if (receipt.customer && receipt.paymentStatus === 'unpaid') {
            try {
                const res = await getCustomer(receipt.customer);
                customerBalance = res.data?.balance || res.data?.totalDue || 0;
            } catch {
                customerBalance = 0;
            }
        }

        return {
            store: business,
            currency,
            billNumber: receipt.billNumber || '-',
            date: new Date(receipt.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
            customerName: receipt.customerName || 'Walk-in',
            cashierName: receipt.cashierName || '',
            customerBalance,
            items,
            subtotal,
            tax: receipt.totalTax || 0,
            itemDiscounts: receipt.totalItemDiscount || 0,
            billDiscount: receipt.billDiscountAmount || 0,
            total: receipt.total || 0,
            paymentMethod,
            amountPaid: receipt.amountPaid || 0,
            amountDue: receipt.amountDue || 0,
            cashGiven: receipt.cashGiven || 0,
            change: receipt.change || 0,
        };
    };

    const handlePrint = async (receipt) => {
        const opts = await buildReceiptOpts(receipt);
        printReceipt(opts);
    };

    const handleDownload = async (receipt) => {
        const opts = await buildReceiptOpts(receipt);
        downloadReceipt(opts);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString('en-PK', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getReceiptType = (receipt) => {
        if (receipt.type === 'refund') {
            return { label: 'Refund', color: 'bg-[rgba(255,107,107,0.15)] text-d-red', hasReturns: false };
        }
        // Check if this sale has returns
        const hasReturns = (receipt.totalReturned > 0) || (receipt.returns && receipt.returns.length > 0);
        return {
            label: 'Sale',
            color: 'bg-[rgba(52,232,161,0.15)] text-d-green',
            hasReturns
        };
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading receipts...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-hidden flex flex-col">
            <div className="p-6 animate-fade-slide-up flex flex-col flex-1 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Sales Report</h1>
                        <p className="text-slate-500 dark:text-d-muted">
                            {totalReceipts > 0 ? `${totalReceipts} total receipts` : `${receipts.length} receipts`}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2.5 text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-all"
                    >
                        <FiRefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Stats Cards — Row 1: Sales overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {/* Today's Sales (total billed) */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(91,156,246,0.1)] rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-d-blue" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Today's Sales</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading font-display">{formatCurrency(stats.todaySales)}</p>
                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Total billed</p>
                    </div>

                    {/* Collected (paid by customers) */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(52,232,161,0.1)] rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-d-green" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Collected</span>
                        </div>
                        <p className="text-2xl font-bold text-d-green font-display">{formatCurrency(stats.todayCollected)}</p>
                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Amount received from customers</p>
                    </div>

                    {/* Credit (owed by customers) */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(255,107,107,0.1)] rounded-xl flex items-center justify-center">
                                <FiTrendingUp className="text-d-red" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Credit</span>
                        </div>
                        <p className="text-2xl font-bold text-d-red font-display">{formatCurrency(stats.todayCredit)}</p>
                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Amount owed by customers</p>
                    </div>
                </div>

                {/* Stats Cards — Row 2: Refunds & Drawer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Total Refunded */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(255,107,107,0.1)] rounded-xl flex items-center justify-center">
                                <FiCornerDownLeft className="text-d-red" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Total Refunded</span>
                        </div>
                        <p className="text-2xl font-bold text-d-red font-display">{formatCurrency(stats.todayRefunded)}</p>
                        <div className="flex flex-col gap-0.5 mt-2">
                            {stats.todayCashRefund > 0 && (
                                <p className="text-xs text-slate-400 dark:text-d-faint">Cash return: {formatCurrency(stats.todayCashRefund)}</p>
                            )}
                            {stats.todayLedgerAdjust > 0 && (
                                <p className="text-xs text-slate-400 dark:text-d-faint">Ledger adjust: {formatCurrency(stats.todayLedgerAdjust)}</p>
                            )}
                            {stats.todayRefunded === 0 && (
                                <p className="text-xs text-slate-400 dark:text-d-faint">No refunds today</p>
                            )}
                        </div>
                    </div>

                    {/* Cash in Drawer = Collected - Cash Refunds */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(52,232,161,0.15)] rounded-xl flex items-center justify-center">
                                <FiInbox className="text-d-green" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Cash in Drawer</span>
                        </div>
                        <p className="text-2xl font-bold text-d-green font-display">{formatCurrency(stats.todayCashInDrawer)}</p>
                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Collected minus cash refunds</p>
                    </div>

                    {/* Today's Orders */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(255,210,100,0.1)] rounded-xl flex items-center justify-center">
                                <FiShoppingCart className="text-d-accent" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Today's Orders</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{stats.todayOrders}</p>
                    </div>

                    {/* Month Orders */}
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(91,156,246,0.1)] rounded-xl flex items-center justify-center">
                                <FiFileText className="text-d-blue" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">This Month</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{stats.totalSales || totalReceipts}</p>
                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Total receipts</p>
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
                            placeholder="Search by receipt # or customer..."
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text placeholder-d-faint focus:outline-none focus:border-d-border-hover transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border">
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'today', label: 'Today' },
                            { value: 'week', label: 'Week' },
                            { value: 'month', label: 'Month' },
                        ].map((filter) => (
                            <button
                                key={filter.value}
                                onClick={() => setDateFilter(filter.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    dateFilter === filter.value
                                        ? 'bg-d-accent text-d-card'
                                        : 'text-slate-500 dark:text-d-muted hover:text-slate-700 dark:text-d-text'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Receipts Table */}
                <div
                    ref={scrollContainerRef}
                    className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border overflow-hidden max-h-[calc(100vh-350px)] overflow-y-auto"
                >
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-d-elevated sticky top-0 z-10 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
                            <tr>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Receipt #</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Customer</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Items</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Total</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Type</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Date</th>
                                <th className="text-right py-4 px-6 font-semibold text-slate-600 dark:text-d-muted text-sm bg-slate-50 dark:bg-d-elevated">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReceipts.map((receipt) => {
                                const type = getReceiptType(receipt);
                                return (
                                    <tr
                                        key={receipt._id}
                                        className={`border-t border-slate-200 dark:border-d-border transition-colors ${
                                            type.label === 'Refund'
                                                ? 'bg-red-100 dark:bg-[#3d2020] hover:bg-red-200 dark:hover:bg-[#4a2525]'
                                                : type.hasReturns
                                                    ? 'bg-amber-100 dark:bg-[#3d3520] hover:bg-amber-200 dark:hover:bg-[#4a4025]'
                                                    : 'hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)]'
                                        }`}
                                    >
                                        <td className="py-4 px-6 font-medium text-slate-800 dark:text-d-heading">
                                            #{receipt.receiptNumber || receipt.billNumber || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-slate-700 dark:text-d-text">
                                            {receipt.customerName || 'Walk-in'}
                                        </td>
                                        <td className="py-4 px-6 text-slate-500 dark:text-d-muted">
                                            {receipt.items?.length || 0} items
                                        </td>
                                        <td className="py-4 px-6 font-semibold font-display">
                                            <span className={receipt.totalBill < 0 ? 'text-d-red' : 'text-d-green'}>
                                                {formatCurrency(Math.abs(receipt.totalBill))}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${type.color}`}>
                                                    {type.label}
                                                </span>
                                                {type.hasReturns && (
                                                    <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-[rgba(255,107,107,0.15)] text-d-red">
                                                        HAS RETURNS
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-slate-500 dark:text-d-muted text-sm">
                                            {formatDate(receipt.createdAt)}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setShowDetail(receipt)}
                                                    className="p-2 text-slate-500 dark:text-d-muted hover:text-d-accent hover:bg-[rgba(255,210,100,0.1)] rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FiEye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handlePrint(receipt)}
                                                    className="p-2 text-slate-500 dark:text-d-muted hover:text-d-blue hover:bg-[rgba(91,156,246,0.1)] rounded-lg transition-colors"
                                                    title="Print"
                                                >
                                                    <FiPrinter size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredReceipts.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-d-faint">
                            <FiFileText size={48} />
                            <p className="mt-4 text-slate-500 dark:text-d-muted">No receipts found</p>
                        </div>
                    )}

                    {/* Loading More Indicator */}
                    {loadingMore && (
                        <div className="flex items-center justify-center py-6 gap-3">
                            <FiLoader className="animate-spin text-d-accent" size={20} />
                            <span className="text-slate-500 dark:text-d-muted">Loading more receipts...</span>
                        </div>
                    )}

                    {/* Load More Button - only show when viewing "All" receipts */}
                    {hasMore && !loading && receipts.length > 0 && dateFilter === 'all' && (
                        <div className="flex justify-center py-6">
                            <button
                                onClick={() => fetchReceipts(page + 1, false)}
                                disabled={loadingMore}
                                className="px-6 py-3 bg-gradient-to-r from-d-accent to-d-accent-s text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loadingMore ? (
                                    <>
                                        <FiLoader className="animate-spin" size={16} />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        Load More ({receipts.length} of {totalReceipts})
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* End of List Indicator */}
                    {!hasMore && receipts.length > 0 && !loading && dateFilter === 'all' && (
                        <div className="text-center py-6 text-slate-400 dark:text-d-faint text-sm">
                            You've reached the end ({totalReceipts} receipts)
                        </div>
                    )}

                    {/* Filtered results count */}
                    {dateFilter !== 'all' && !loading && (
                        <div className="text-center py-6 text-slate-400 dark:text-d-faint text-sm">
                            {filteredReceipts.length > 0
                                ? `${filteredReceipts.length} ${dateFilter === 'today' ? "today's" : dateFilter === 'week' ? "this week's" : "this month's"} receipts`
                                : `No receipts ${dateFilter === 'today' ? "today" : dateFilter === 'week' ? "this week" : "this month"}`
                            }
                        </div>
                    )}
                </div>
            </div>

            {/* Receipt Detail Modal */}
            {showDetail && (() => {
                const r = showDetail;
                const type = getReceiptType(r);
                const totalBill = r.total ?? r.totalBill ?? 0;
                const hasDiscount = (r.totalDiscount || 0) > 0;
                const hasReturns = r.returns && r.returns.length > 0;
                const hasPayments = r.payments && r.payments.length > 0;
                const paymentMethod = hasPayments ? r.payments[0]?.method : (r.paymentMethod || 'cash');

                return (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl w-full max-w-2xl animate-pop-in max-h-[90vh] overflow-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border sticky top-0 bg-white dark:bg-d-card z-10">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                    Receipt #{r.receiptNumber || r.billNumber}
                                </h3>
                                <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${type.color}`}>
                                    {type.label}
                                </span>
                                {r.paymentStatus && r.paymentStatus !== 'paid' && (
                                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${r.paymentStatus === 'unpaid' ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-d-red' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                                        {r.paymentStatus === 'unpaid' ? 'Unpaid' : 'Partial'}
                                    </span>
                                )}
                                {r.returnStatus && r.returnStatus !== 'none' && (
                                    <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400">
                                        {r.returnStatus === 'full' ? 'Fully Returned' : 'Partial Return'}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowDetail(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass rounded-lg transition-colors text-slate-500 dark:text-d-muted"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-d-elevated rounded-xl p-4">
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-d-faint uppercase tracking-wider">Customer</p>
                                    <p className="font-medium text-slate-800 dark:text-d-text mt-0.5">{r.customerName || 'Walk-in'}</p>
                                    {r.customerPhone && <p className="text-xs text-slate-500 dark:text-d-muted">{r.customerPhone}</p>}
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-d-faint uppercase tracking-wider">Date & Time</p>
                                    <p className="font-medium text-slate-800 dark:text-d-text mt-0.5">{formatDate(r.createdAt)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-d-faint uppercase tracking-wider">Cashier</p>
                                    <p className="font-medium text-slate-800 dark:text-d-text mt-0.5">{r.cashierName || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-d-faint uppercase tracking-wider">Payment</p>
                                    <p className="font-medium text-slate-800 dark:text-d-text mt-0.5 capitalize">{paymentMethod}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-d-faint uppercase tracking-wider">Items</p>
                                    <p className="font-medium text-slate-800 dark:text-d-text mt-0.5">{r.totalQty || r.items?.length || 0} qty ({r.items?.length || 0} products)</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-d-faint uppercase tracking-wider">Status</p>
                                    <p className="font-medium text-slate-800 dark:text-d-text mt-0.5 capitalize">{r.status || 'completed'}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <h4 className="font-semibold text-slate-800 dark:text-d-heading mb-3">Items</h4>
                                <div className="bg-white dark:bg-d-bg rounded-xl border border-slate-200 dark:border-d-border overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-d-glass">
                                            <tr>
                                                <th className="text-left py-2.5 px-4 font-medium text-slate-500 dark:text-d-muted">Item</th>
                                                <th className="text-center py-2.5 px-4 font-medium text-slate-500 dark:text-d-muted">Qty</th>
                                                <th className="text-right py-2.5 px-4 font-medium text-slate-500 dark:text-d-muted">Price</th>
                                                {hasDiscount && <th className="text-right py-2.5 px-4 font-medium text-slate-500 dark:text-d-muted">Discount</th>}
                                                <th className="text-right py-2.5 px-4 font-medium text-slate-500 dark:text-d-muted">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {r.items?.map((item, i) => {
                                                const qty = item.qty || item.quantity || 0;
                                                const lineTotal = item.itemTotal || (item.price * qty);
                                                return (
                                                    <tr key={i} className="border-t border-slate-100 dark:border-d-border">
                                                        <td className="py-3 px-4">
                                                            <p className="font-medium text-slate-800 dark:text-d-text">{item.name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {item.category && <span className="text-xs text-slate-400 dark:text-d-faint">{item.category}</span>}
                                                                {item.barcode && <span className="text-xs text-slate-400 dark:text-d-faint font-mono">#{item.barcode}</span>}
                                                            </div>
                                                            {item.returnedQty > 0 && (
                                                                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">{item.returnedQty} returned</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-center text-slate-700 dark:text-d-text">{qty}</td>
                                                        <td className="py-3 px-4 text-right text-slate-600 dark:text-d-muted">{formatCurrency(item.price)}</td>
                                                        {hasDiscount && (
                                                            <td className="py-3 px-4 text-right text-red-500 dark:text-d-red">
                                                                {(item.discountAmount || 0) > 0 ? `-${formatCurrency(item.discountAmount)}` : '-'}
                                                            </td>
                                                        )}
                                                        <td className="py-3 px-4 text-right font-semibold text-slate-800 dark:text-d-text">{formatCurrency(lineTotal)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals Breakdown */}
                            {(() => {
                                // r.subtotal is AFTER item discounts (sum of itemTotal).
                                // To show a meaningful breakdown, compute the gross (before any discounts).
                                const grossSubtotal = r.items?.reduce((s, it) => s + (it.price * (it.qty || it.quantity || 0)), 0) || 0;
                                return (
                            <div className="bg-slate-50 dark:bg-d-elevated rounded-xl p-4 space-y-2">
                                <div className="flex justify-between text-sm text-slate-600 dark:text-d-muted">
                                    <span>Subtotal</span>
                                    <span className="text-slate-800 dark:text-d-text">{formatCurrency(grossSubtotal)}</span>
                                </div>
                                {(r.totalTax || 0) > 0 && (
                                    <div className="flex justify-between text-sm text-slate-600 dark:text-d-muted">
                                        <span>Tax / GST</span>
                                        <span className="text-slate-800 dark:text-d-text">+{formatCurrency(r.totalTax)}</span>
                                    </div>
                                )}
                                {(r.totalItemDiscount || 0) > 0 && (
                                    <div className="flex justify-between text-sm text-red-500 dark:text-d-red">
                                        <span>Item Discounts</span>
                                        <span>-{formatCurrency(r.totalItemDiscount)}</span>
                                    </div>
                                )}
                                {(r.billDiscountAmount || 0) > 0 && (
                                    <div className="flex justify-between text-sm text-red-500 dark:text-d-red">
                                        <span>Bill Discount {r.billDiscountReason ? `(${r.billDiscountReason})` : ''}</span>
                                        <span>-{formatCurrency(r.billDiscountAmount)}</span>
                                    </div>
                                )}
                                {hasDiscount && (
                                    <div className="flex justify-between text-sm font-medium text-slate-600 dark:text-d-muted">
                                        <span>Total Discount</span>
                                        <span className="text-red-500 dark:text-d-red">-{formatCurrency(r.totalDiscount)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200 dark:border-d-border">
                                    <span className="text-slate-800 dark:text-d-heading">Total</span>
                                    <span className={`font-display ${totalBill < 0 ? 'text-red-500 dark:text-d-red' : 'text-emerald-600 dark:text-d-green'}`}>
                                        {formatCurrency(Math.abs(totalBill))}
                                    </span>
                                </div>

                                {(r.totalRefunded || 0) > 0 && (
                                    <>
                                        <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                                            <span>Total Refunded</span>
                                            <span>-{formatCurrency(r.totalRefunded)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-semibold text-slate-800 dark:text-d-heading">
                                            <span>Net Amount</span>
                                            <span>{formatCurrency(r.netAmount)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                                );
                            })()}

                            {/* Payment Details */}
                            <div>
                                <h4 className="font-semibold text-slate-800 dark:text-d-heading mb-3">Payment Details</h4>
                                <div className="bg-white dark:bg-d-bg rounded-xl border border-slate-200 dark:border-d-border p-4 space-y-2">
                                    {hasPayments ? (
                                        r.payments.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="capitalize font-medium text-slate-700 dark:text-d-text">{p.method}</span>
                                                    {p.reference && <span className="text-xs text-slate-400 dark:text-d-faint font-mono">Ref: {p.reference}</span>}
                                                    {p.note && <span className="text-xs text-slate-400 dark:text-d-faint">({p.note})</span>}
                                                </div>
                                                <span className="font-semibold text-slate-800 dark:text-d-text">{formatCurrency(p.amount)}</span>
                                            </div>
                                        ))
                                    ) : (r.amountPaid || 0) > 0 ? (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="capitalize font-medium text-slate-700 dark:text-d-text">{paymentMethod}</span>
                                            <span className="font-semibold text-slate-800 dark:text-d-text">{formatCurrency(r.amountPaid)}</span>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 dark:text-d-faint italic">No payments recorded</p>
                                    )}

                                    {(r.cashGiven || 0) > 0 && (
                                        <div className="border-t border-slate-100 dark:border-d-border pt-2 mt-2 space-y-1">
                                            <div className="flex justify-between text-sm text-slate-500 dark:text-d-muted">
                                                <span>Cash Given</span>
                                                <span>{formatCurrency(r.cashGiven)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm text-slate-500 dark:text-d-muted">
                                                <span>Change</span>
                                                <span>{formatCurrency(r.change)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {(r.amountDue || 0) !== 0 && (
                                        <div className="border-t border-slate-100 dark:border-d-border pt-2 mt-2">
                                            <div className={`flex justify-between text-sm font-semibold ${r.amountDue > 0 ? 'text-red-600 dark:text-d-red' : 'text-emerald-600 dark:text-d-green'}`}>
                                                <span>{r.amountDue > 0 ? 'Amount Due' : 'Credit (overpaid)'}</span>
                                                <span>{formatCurrency(Math.abs(r.amountDue))}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Returns Section */}
                            {hasReturns && (
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-d-heading mb-3">Returns</h4>
                                    <div className="space-y-3">
                                        {r.returns.map((ret, ri) => (
                                            <div key={ri} className="bg-red-50 dark:bg-red-500/5 rounded-xl border border-red-200 dark:border-red-500/20 p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-red-700 dark:text-d-red text-sm">
                                                        Return {ret.returnNumber || `#${ri + 1}`}
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-d-muted">
                                                        {ret.returnedAt ? formatDate(ret.returnedAt) : '-'}
                                                        {ret.processedByName && ` by ${ret.processedByName}`}
                                                    </span>
                                                </div>
                                                {ret.items?.map((ri2, j) => (
                                                    <div key={j} className="flex justify-between text-sm py-1">
                                                        <span className="text-slate-700 dark:text-d-text">
                                                            {ri2.name} x {ri2.quantity}
                                                            {ri2.reason && <span className="ml-2 text-xs text-slate-400 dark:text-d-faint capitalize">({ri2.reason.replace('_', ' ')})</span>}
                                                        </span>
                                                        <span className="text-red-600 dark:text-d-red font-medium">-{formatCurrency(ri2.refundAmount)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-red-200 dark:border-red-500/20">
                                                    <span className="text-red-700 dark:text-d-red">Refund ({ret.refundMethod?.replace('_', ' ') || 'cash'})</span>
                                                    <span className="text-red-700 dark:text-d-red">-{formatCurrency(ret.refundAmount)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Profit Breakdown (for admin context) */}
                            {(r.billProfit !== undefined || r.netProfit !== undefined) && (() => {
                                const totalCost = r.totalCost || 0;
                                const billProfit = r.billProfit || 0;
                                const hasReturns = (r.totalRefunded || 0) > 0;
                                const returnedCost = r.items?.reduce((s, it) => s + ((it.costPrice || 0) * (it.returnedQty || 0)), 0) || 0;
                                const keptCost = totalCost - returnedCost;
                                const netProfit = r.netProfit || 0;
                                return (
                                <div className="bg-slate-50 dark:bg-d-elevated rounded-xl p-4">
                                    <h4 className="font-semibold text-slate-800 dark:text-d-heading mb-3 text-sm">Profit Breakdown</h4>
                                    <div className="space-y-2 text-sm">
                                        {/* Revenue */}
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-d-muted">Revenue (Sale Total)</span>
                                            <span className="text-slate-800 dark:text-d-text font-medium">{formatCurrency(r.total)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-d-muted">Total Cost of Goods</span>
                                            <span className="text-red-500 dark:text-d-red">-{formatCurrency(totalCost)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-slate-200 dark:border-d-border pt-2">
                                            <span className="text-slate-700 dark:text-d-text font-medium">Gross Profit</span>
                                            <span className={`font-semibold ${billProfit >= 0 ? 'text-emerald-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}`}>
                                                {formatCurrency(billProfit)}
                                            </span>
                                        </div>

                                        {hasReturns && (
                                            <>
                                                <div className="border-t border-slate-200 dark:border-d-border pt-2 mt-1">
                                                    <p className="text-xs text-slate-400 dark:text-d-faint uppercase tracking-wider mb-2">After Returns</p>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 dark:text-d-muted">Refunded to Customer</span>
                                                    <span className="text-orange-500">-{formatCurrency(r.totalRefunded)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 dark:text-d-muted">Cost Recovered (Restocked)</span>
                                                    <span className="text-emerald-500 dark:text-d-green">+{formatCurrency(returnedCost)}</span>
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-400 dark:text-d-faint">
                                                    <span>Kept Revenue</span>
                                                    <span>{formatCurrency((r.total || 0) - (r.totalRefunded || 0))}</span>
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-400 dark:text-d-faint">
                                                    <span>Kept Cost</span>
                                                    <span>{formatCurrency(keptCost)}</span>
                                                </div>
                                            </>
                                        )}

                                        <div className="flex justify-between border-t border-slate-200 dark:border-d-border pt-2">
                                            <span className="text-slate-800 dark:text-d-heading font-semibold">Net Profit</span>
                                            <span className={`font-bold ${netProfit >= 0 ? 'text-emerald-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}`}>
                                                {formatCurrency(netProfit)}
                                            </span>
                                        </div>

                                        {/* Per-item cost breakdown */}
                                        {r.items && r.items.length > 0 && (
                                            <div className="border-t border-slate-200 dark:border-d-border pt-2 mt-1">
                                                <p className="text-xs text-slate-400 dark:text-d-faint uppercase tracking-wider mb-2">Item Cost Details</p>
                                                {r.items.map((it, idx) => {
                                                    const qty = it.qty || it.quantity || 0;
                                                    const cost = (it.costPrice || 0) * qty;
                                                    const profit = (it.itemProfit || 0);
                                                    const retQty = it.returnedQty || 0;
                                                    return (
                                                        <div key={idx} className="flex justify-between items-start py-1">
                                                            <div>
                                                                <span className="text-slate-600 dark:text-d-muted">{it.name}</span>
                                                                <span className="text-xs text-slate-400 dark:text-d-faint ml-1">
                                                                    (cost {formatCurrency(it.costPrice || 0)} × {qty}{retQty > 0 ? `, ${retQty} returned` : ''})
                                                                </span>
                                                            </div>
                                                            <span className={`text-xs font-medium ${(it.netProfit || profit) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                {formatCurrency(it.netProfit ?? profit)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })()}

                            {/* Notes */}
                            {r.notes && (
                                <div className="text-sm text-slate-500 dark:text-d-muted bg-slate-50 dark:bg-d-elevated rounded-xl p-3">
                                    <span className="font-medium text-slate-700 dark:text-d-text">Note: </span>{r.notes}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => handlePrint(r)} className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass transition-colors flex items-center justify-center gap-2">
                                    <FiPrinter size={18} />
                                    Print
                                </button>
                                <button onClick={() => handleDownload(r)} className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center justify-center gap-2">
                                    <FiDownload size={18} />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default Receipts;
