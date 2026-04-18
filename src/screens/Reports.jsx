import React, { useState, useEffect, useCallback } from 'react';
import { useBusiness } from '../context/BusinessContext';
import {
    FiTrendingUp,
    FiTrendingDown,
    FiDollarSign,
    FiShoppingCart,
    FiMinusCircle,
    FiPieChart,
    FiRefreshCw,
    FiArrowUp,
    FiArrowDown,
    FiPackage,
    FiGrid,
    FiCreditCard,
    FiPercent,
    FiRotateCcw,
    FiTag,
    FiDownload,
    FiCalendar,
    FiX,
    FiFileText,
} from 'react-icons/fi';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LineChart,
    Line,
} from 'recharts';
import {
    getProfitReport,
    getSalesTimeline,
    getSalesByProduct,
    getSalesByCategory,
    getPaymentMethodReport,
    getTaxReport,
    getReturnAnalysis,
    getDiscountReport,
} from '../services/api/bills';

// ── Constants ──────────��─────────────────────────────────────────
const TABS = [
    { key: 'pnl', label: 'P&L Overview', icon: FiPieChart },
    { key: 'products', label: 'By Product', icon: FiPackage },
    { key: 'categories', label: 'By Category', icon: FiGrid },
    { key: 'payments', label: 'Payments', icon: FiCreditCard },
    { key: 'tax', label: 'Tax / GST', icon: FiPercent },
    { key: 'returns', label: 'Returns', icon: FiRotateCcw },
    { key: 'discounts', label: 'Discounts', icon: FiTag },
];

const TIME_FILTERS = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
    { key: 'custom', label: 'Custom' },
];

const PIE_COLORS = [
    '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#eab308', '#06b6d4', '#6366f1',
];

const PAYMENT_COLORS = {
    cash: '#22c55e',
    card: '#3b82f6',
    online: '#8b5cf6',
    store_credit: '#f97316',
    unknown: '#64748b',
};

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDec = (n) => `Rs. ${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${(n || 0).toFixed(1)}%`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const getDateRange = (filter, customStart, customEnd) => {
    if (filter === 'custom' && customStart && customEnd) {
        // Parse "YYYY-MM-DD" as local dates, not UTC
        const [sy, sm, sd] = customStart.split('-').map(Number);
        const [ey, em, ed] = customEnd.split('-').map(Number);
        return {
            startDate: new Date(sy, sm - 1, sd).toISOString(),
            endDate: new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString(),
        };
    }
    const now = new Date();
    let startDate, endDate = now.toISOString();

    switch (filter) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            break;
        case 'week': {
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString();
            break;
        }
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1).toISOString();
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    return { startDate, endDate };
};

const getFilterLabel = (filter, customStart, customEnd) => {
    switch (filter) {
        case 'today': return 'Today';
        case 'week': return 'Last 7 Days';
        case 'month': return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        case 'year': return `Year ${new Date().getFullYear()}`;
        case 'custom': return customStart && customEnd ? `${fmtDate(customStart)} - ${fmtDate(customEnd)}` : 'Custom Range';
        default: return '';
    }
};

// ── Card wrapper ─────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
    <div className={`bg-white dark:bg-d-card rounded-2xl shadow-sm border border-slate-100 dark:border-d-border p-6 ${className}`}>
        {children}
    </div>
);

const STAT_COLORS = {
    blue:   { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
    green:  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
    red:    { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
};

const StatCard = ({ label, value, icon: Icon, color = 'blue', sub }) => {
    const c = STAT_COLORS[color] || STAT_COLORS.blue;
    return (
        <Card>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-500 dark:text-d-muted text-sm">{label}</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-d-heading mt-1">{value}</p>
                    {sub && <p className="text-xs text-slate-400 dark:text-d-muted mt-1">{sub}</p>}
                </div>
                <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center print:hidden`}>
                    <Icon size={24} className={c.text} />
                </div>
            </div>
        </Card>
    );
};

// ── Table component ──────────────────────────────────────────────
const DataTable = ({ columns, data, footer, compact }) => (
    <div className="overflow-x-auto">
        <table className={`w-full ${compact ? 'text-xs' : 'text-sm'}`}>
            <thead>
                <tr className="border-b border-slate-200 dark:border-d-border print:border-black">
                    {columns.map((col, i) => (
                        <th key={i} className={`py-2 px-3 text-slate-500 dark:text-d-muted font-medium print:text-black ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} className="py-6 text-center text-slate-400 dark:text-d-muted">No data for this period</td>
                    </tr>
                ) : (
                    data.map((row, ri) => (
                        <tr key={ri} className="border-b border-slate-50 dark:border-d-border/50 print:border-gray-200 hover:bg-slate-100 dark:hover:bg-white/5 print:hover:bg-transparent">
                            {columns.map((col, ci) => (
                                <td key={ci} className={`py-2 px-3 text-slate-700 dark:text-d-text print:text-black ${col.align === 'right' ? 'text-right font-mono' : ''}`}>
                                    {col.render ? col.render(row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))
                )}
            </tbody>
            {footer && (
                <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-d-border print:border-black bg-slate-100 dark:bg-white/10 print:bg-gray-100 font-semibold">
                        {footer.map((cell, i) => (
                            <td key={i} className={`py-2 px-3 text-slate-800 dark:text-d-heading print:text-black ${columns[i]?.align === 'right' ? 'text-right font-mono' : ''}`}>
                                {cell}
                            </td>
                        ))}
                    </tr>
                </tfoot>
            )}
        </table>
    </div>
);

// ── P&L line row ─────────────────────────────────────────────────
const PnlRow = ({ label, amount, indent, bold, negative, border, bg, growth, sub, formula }) => (
    <div className={`flex justify-between items-center py-2.5 ${indent ? 'pl-6' : ''} ${border ? 'border-b-2 border-slate-200 dark:border-d-border print:border-black' : 'border-b border-slate-50 dark:border-d-border/50 print:border-gray-200'} ${bg ? '-mx-6 px-6 bg-slate-50 dark:bg-d-elevated print:bg-gray-100' : ''}`}>
        <div className="flex-1">
            <span className={`${bold ? 'font-semibold text-slate-800 dark:text-d-heading print:text-black' : indent ? 'text-slate-500 dark:text-d-muted text-sm print:text-gray-600' : 'text-slate-600 dark:text-d-text print:text-black'} ${negative ? 'text-red-500 dark:text-d-red print:text-black flex items-center gap-1.5' : ''}`}>
                {negative && <FiMinusCircle size={14} className="print:hidden" />}
                {label}
            </span>
            {formula && <span className="text-xs text-slate-400 dark:text-d-muted ml-2 print:text-gray-500">({formula})</span>}
            {sub && <span className="text-xs text-slate-400 dark:text-d-muted ml-2">({sub})</span>}
        </div>
        <div className="flex items-center gap-3">
            <span className={`${bold ? 'font-bold text-lg text-slate-800 dark:text-d-heading print:text-black' : negative ? 'text-red-500 dark:text-d-red print:text-black' : 'text-slate-700 dark:text-d-text print:text-black'} font-mono`}>
                {negative ? `- ${fmt(Math.abs(amount))}` : fmt(amount)}
            </span>
            {growth !== undefined && (
                <span className={`flex items-center text-xs print:hidden ${growth >= 0 ? 'text-green-500 dark:text-d-green' : 'text-red-500 dark:text-d-red'}`}>
                    {growth >= 0 ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}
                    {Math.abs(growth).toFixed(1)}%
                </span>
            )}
        </div>
    </div>
);

// ── Print section header ─────────────────────────────────────────
const PrintSection = ({ title, children }) => (
    <div className="mb-8 print:break-inside-avoid">
        <h3 className="text-lg font-bold text-slate-800 dark:text-d-heading print:text-black border-b-2 border-slate-300 dark:border-d-border print:border-black pb-2 mb-4">
            {title}
        </h3>
        {children}
    </div>
);

// ═════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════
const Reports = () => {
    const { business } = useBusiness();
    const [tab, setTab] = useState('pnl');
    const [timeFilter, setTimeFilter] = useState('month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [loading, setLoading] = useState(true);
    const [showDetailedReport, setShowDetailedReport] = useState(false);
    const [detailedLoading, setDetailedLoading] = useState(false);

    // Data stores per tab
    const [pnl, setPnl] = useState(null);
    const [expenses, setExpenses] = useState({ total: 0, breakdown: [] });
    const [timeline, setTimeline] = useState([]);
    const [products, setProducts] = useState({ data: [], summary: {} });
    const [categories, setCategories] = useState([]);
    const [payments, setPayments] = useState({ methods: [], grandTotal: 0 });
    const [tax, setTax] = useState({ byRate: [], byCategory: [], overall: {} });
    const [returns, setReturns] = useState(null);
    const [discounts, setDiscounts] = useState(null);

    // All data for detailed report
    const [allData, setAllData] = useState(null);

    const dateParams = getDateRange(timeFilter, customStart, customEnd);
    const periodLabel = getFilterLabel(timeFilter, customStart, customEnd);

    // ── Fetch data for active tab ────────────────────────────────
    const fetchData = useCallback(async () => {
        if (timeFilter === 'custom' && (!customStart || !customEnd)) return;
        setLoading(true);
        try {
            const params = { startDate: dateParams.startDate, endDate: dateParams.endDate };

            if (tab === 'pnl') {
                const [profitRes, timelineRes] = await Promise.all([
                    getProfitReport(params),
                    getSalesTimeline({ ...params, groupBy: timeFilter === 'year' ? 'month' : 'day' }),
                ]);
                const p = profitRes.data;
                setPnl(p);
                setTimeline(timelineRes.data?.timeline || []);
                const expBreakdown = (p.expenseBreakdown || []).map(e => ({
                    category: e._id || 'other',
                    amount: e.amount || 0,
                    count: e.count || 0,
                    label: (e._id || 'other').charAt(0).toUpperCase() + (e._id || 'other').slice(1).replace('_', ' '),
                }));
                setExpenses({ total: p.totalExpenses || 0, breakdown: expBreakdown });

            } else if (tab === 'products') {
                const res = await getSalesByProduct(params);
                setProducts({ data: res.data?.products || [], summary: res.data?.summary || {} });

            } else if (tab === 'categories') {
                const res = await getSalesByCategory(params);
                setCategories(res.data?.categories || []);

            } else if (tab === 'payments') {
                const res = await getPaymentMethodReport(params);
                setPayments(res.data || { methods: [], grandTotal: 0 });

            } else if (tab === 'tax') {
                const res = await getTaxReport(params);
                setTax(res.data || { byRate: [], byCategory: [], overall: {} });

            } else if (tab === 'returns') {
                const res = await getReturnAnalysis(params);
                setReturns(res.data);

            } else if (tab === 'discounts') {
                const res = await getDiscountReport(params);
                setDiscounts(res.data);
            }
        } catch (err) {
            console.error('Report fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [tab, timeFilter, customStart, customEnd]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Fetch ALL data for detailed report + PDF ─────────────────
    const fetchAllAndShowReport = async () => {
        setDetailedLoading(true);
        try {
            const params = { startDate: dateParams.startDate, endDate: dateParams.endDate };
            const [profitRes, timelineRes, productsRes, categoriesRes, paymentsRes, taxRes, returnsRes, discountsRes] = await Promise.all([
                getProfitReport(params),
                getSalesTimeline({ ...params, groupBy: timeFilter === 'year' ? 'month' : 'day' }),
                getSalesByProduct(params),
                getSalesByCategory(params),
                getPaymentMethodReport(params),
                getTaxReport(params),
                getReturnAnalysis(params),
                getDiscountReport(params),
            ]);

            const p = profitRes.data;
            const expBreakdown = (p.expenseBreakdown || []).map(e => ({
                category: e._id || 'other',
                amount: e.amount || 0,
                count: e.count || 0,
                label: (e._id || 'other').charAt(0).toUpperCase() + (e._id || 'other').slice(1).replace('_', ' '),
            }));

            setAllData({
                pnl: p,
                expenses: { total: p.totalExpenses || 0, breakdown: expBreakdown },
                timeline: timelineRes.data?.timeline || [],
                products: { data: productsRes.data?.products || [], summary: productsRes.data?.summary || {} },
                categories: categoriesRes.data?.categories || [],
                payments: paymentsRes.data || { methods: [], grandTotal: 0 },
                tax: taxRes.data || { byRate: [], byCategory: [], overall: {} },
                returns: returnsRes.data,
                discounts: discountsRes.data,
            });
            setShowDetailedReport(true);
        } catch (err) {
            console.error('Error fetching detailed report:', err);
        } finally {
            setDetailedLoading(false);
        }
    };

    const handlePrint = () => {
        const html = document.documentElement;
        const wasDark = html.classList.contains('dark');
        if (wasDark) html.classList.remove('dark');
        setTimeout(() => {
            window.print();
            if (wasDark) html.classList.add('dark');
        }, 100);
    };

    // ═════════════════════════════════════════════════════════════
    // DETAILED REPORT (print-friendly, comprehensive)
    // ═════════════════════════════════════════════════════════════
    const renderDetailedReport = () => {
        if (!allData) return null;
        const d = allData;
        const p = d.pnl;
        const netProfit = p.trueNetProfit ?? ((p.salesNetProfit || 0) - d.expenses.total);
        const timelineRows = d.timeline || [];
        const productRows = d.products.data || [];
        const ps = d.products.summary || {};
        const catRows = d.categories || [];
        const payMethods = d.payments.methods || [];
        const taxData = d.tax;
        const retData = d.returns || {};
        const discData = d.discounts || {};

        return (
            <div className="fixed inset-0 z-50 bg-white dark:bg-d-bg overflow-auto print-static print:bg-white print:z-auto">
                {/* Close / Print bar — hidden on print */}
                <div className="sticky top-0 z-10 bg-white dark:bg-d-card border-b border-slate-200 dark:border-d-border p-4 flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowDetailedReport(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg">
                            <FiX size={20} />
                        </button>
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Detailed Sales Report</h2>
                    </div>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium">
                        <FiDownload size={18} />
                        Download PDF
                    </button>
                </div>

                {/* Report body */}
                <div className="max-w-[1000px] mx-auto p-8 print:p-4 print:max-w-none">
                    {/* ── Report Header ──────────────────────────────── */}
                    <div className="text-center mb-8 print:mb-6">
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading print:text-black">{business?.name || 'Business'}</h1>
                        <h2 className="text-xl font-semibold text-slate-600 dark:text-d-text print:text-black mt-1">Sales Report</h2>
                        <p className="text-slate-500 dark:text-d-muted print:text-gray-600 mt-1">
                            Period: {fmtDate(dateParams.startDate)} — {fmtDate(dateParams.endDate)}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-d-faint print:text-gray-500 mt-1">Generated on {fmtDate(new Date())}</p>
                    </div>

                    {/* ── Section 1: P&L Statement ──────────────────── */}
                    <PrintSection title="1. Profit & Loss Statement">
                        <p className="text-sm text-slate-500 dark:text-d-muted print:text-gray-600 mb-4">
                            This section shows how your net profit is calculated step by step — from total sales down to the final number after subtracting costs, refunds, and expenses.
                        </p>
                        <div className="border border-slate-200 dark:border-d-border print:border-black rounded-lg print:rounded-none overflow-hidden">
                            <div className="p-4 print:p-2">
                                <PnlRow label="Gross Revenue" amount={p.grossRevenue} bold formula={`${p.totalOrders} orders total`} />
                                <PnlRow label={`Sales (${p.totalOrders} orders, ${p.totalItems} items)`} amount={p.grossRevenue} indent />
                                <PnlRow label="Item-level Discounts" amount={p.totalItemDiscount} negative indent />
                                <PnlRow label="Bill-level Discounts" amount={p.totalBillDiscount} negative indent />
                                <PnlRow label="Total Discounts" amount={p.totalDiscount} negative formula={`Item disc. + Bill disc.`} />
                                <PnlRow label="Net Revenue (after discounts)" amount={p.netRevenue} bold border bg formula="Gross Revenue - Total Discounts" />
                                <PnlRow label="Returns & Refunds" amount={p.totalRefunded} negative />
                                <PnlRow label="Revenue after Returns" amount={p.revenueAfterReturns} bold border formula="Net Revenue - Returns" />
                                <PnlRow label="Cost of Goods Sold (COGS)" amount={p.totalCost} negative formula="Sum of costPrice x netQtySold" />
                                <PnlRow label="Gross Profit" amount={p.grossProfit} bold border formula="Net Revenue - COGS" />
                                <PnlRow label="Returned Profit" amount={p.returnedProfit} negative indent formula="Profit lost from returned items" />
                                <PnlRow label="Sales Net Profit" amount={p.salesNetProfit} bold border bg formula="Gross Profit - Returned Profit" />
                                <PnlRow label="Operating Expenses" amount={d.expenses.total} negative />
                                {d.expenses.breakdown.map((e, i) => (
                                    <PnlRow key={i} label={`${e.label} (${e.count} entries)`} amount={e.amount} indent />
                                ))}
                                <div className={`flex justify-between items-center py-4 px-4 mt-2 print:border-t-2 print:border-black ${netProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20 print:bg-gray-100' : 'bg-red-50 dark:bg-red-900/20 print:bg-gray-100'}`}>
                                    <div>
                                        <span className="font-bold text-lg text-slate-800 dark:text-d-heading print:text-black">NET PROFIT</span>
                                        <span className="text-xs text-slate-400 dark:text-d-muted print:text-gray-500 ml-2">(Sales Net Profit - Expenses)</span>
                                    </div>
                                    <span className={`font-bold text-2xl font-mono print:text-black ${netProfit >= 0 ? 'text-green-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}`}>
                                        {fmt(netProfit)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-4 text-center text-sm">
                            <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-3 print:p-2">
                                <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Profit Margin</div>
                                <div className="text-xl font-bold font-mono text-slate-800 dark:text-d-heading print:text-black">{pct(p.profitMargin)}</div>
                            </div>
                            <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-3 print:p-2">
                                <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Avg Order Value</div>
                                <div className="text-xl font-bold font-mono text-slate-800 dark:text-d-heading print:text-black">{fmt(p.avgOrderValue)}</div>
                            </div>
                            <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-3 print:p-2">
                                <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Discount Rate</div>
                                <div className="text-xl font-bold font-mono text-slate-800 dark:text-d-heading print:text-black">{p.grossRevenue > 0 ? pct((p.totalDiscount / p.grossRevenue) * 100) : '0.0%'}</div>
                            </div>
                        </div>
                    </PrintSection>

                    {/* ── Section 2: Daily/Period Breakdown ─────────── */}
                    {timelineRows.length > 0 && (
                        <PrintSection title="2. Daily Sales Breakdown">
                            <p className="text-sm text-slate-500 dark:text-d-muted print:text-gray-600 mb-3">
                                Day-by-day breakdown of sales, discounts, refunds, and profit.
                            </p>
                            <DataTable
                                compact
                                columns={[
                                    { key: 'period', label: 'Date' },
                                    { key: 'billCount', label: 'Bills', align: 'right' },
                                    { key: 'totalQty', label: 'Items', align: 'right' },
                                    { key: 'totalSales', label: 'Revenue', align: 'right', render: (r) => fmt(r.totalSales) },
                                    { key: 'totalDiscount', label: 'Discount', align: 'right', render: (r) => fmt(r.totalDiscount) },
                                    { key: 'totalRefunded', label: 'Refunds', align: 'right', render: (r) => fmt(r.totalRefunded) },
                                    { key: 'netSales', label: 'Net Sales', align: 'right', render: (r) => fmt(r.netSales) },
                                    { key: 'totalProfit', label: 'Profit', align: 'right', render: (r) => (
                                        <span className={r.totalProfit >= 0 ? 'text-green-600 print:text-black' : 'text-red-600 print:text-black'}>{fmt(r.totalProfit)}</span>
                                    )},
                                    { key: 'avgOrderValue', label: 'Avg Order', align: 'right', render: (r) => fmt(r.avgOrderValue) },
                                ]}
                                data={timelineRows}
                                footer={[
                                    'Total',
                                    timelineRows.reduce((s, r) => s + r.billCount, 0),
                                    timelineRows.reduce((s, r) => s + r.totalQty, 0),
                                    fmt(timelineRows.reduce((s, r) => s + r.totalSales, 0)),
                                    fmt(timelineRows.reduce((s, r) => s + r.totalDiscount, 0)),
                                    fmt(timelineRows.reduce((s, r) => s + r.totalRefunded, 0)),
                                    fmt(timelineRows.reduce((s, r) => s + r.netSales, 0)),
                                    fmt(timelineRows.reduce((s, r) => s + r.totalProfit, 0)),
                                    fmt(p.avgOrderValue),
                                ]}
                            />
                        </PrintSection>
                    )}

                    {/* ── Section 3: Sales by Product ──────────────── */}
                    {productRows.length > 0 && (
                        <PrintSection title="3. Sales by Product">
                            <p className="text-sm text-slate-500 dark:text-d-muted print:text-gray-600 mb-3">
                                Every product sold in this period with quantity, revenue, cost, and profit breakdown.
                            </p>
                            <DataTable
                                compact
                                columns={[
                                    { key: 'name', label: 'Product' },
                                    { key: 'category', label: 'Category' },
                                    { key: 'totalQtySold', label: 'Sold', align: 'right' },
                                    { key: 'totalReturnedQty', label: 'Ret.', align: 'right' },
                                    { key: 'netQtySold', label: 'Net', align: 'right' },
                                    { key: 'netRevenue', label: 'Revenue', align: 'right', render: (r) => fmt(r.netRevenue) },
                                    { key: 'totalItemDiscount', label: 'Disc.', align: 'right', render: (r) => fmt(r.totalItemDiscount) },
                                    { key: 'totalCost', label: 'Cost', align: 'right', render: (r) => fmt(r.totalCost) },
                                    { key: 'totalProfit', label: 'Profit', align: 'right', render: (r) => fmt(r.totalProfit) },
                                    { key: 'margin', label: 'Margin', align: 'right', render: (r) => pct(r.netRevenue > 0 ? (r.totalProfit / r.netRevenue) * 100 : 0) },
                                ]}
                                data={productRows}
                                footer={ps.netQtySold !== undefined ? [
                                    'TOTAL', '', ps.totalQtySold, ps.totalReturnedQty, ps.netQtySold,
                                    fmt(ps.netRevenue), fmt(ps.totalItemDiscount), fmt(ps.totalCost), fmt(ps.totalProfit),
                                    ps.netRevenue > 0 ? pct((ps.totalProfit / ps.netRevenue) * 100) : '0.0%',
                                ] : null}
                            />
                        </PrintSection>
                    )}

                    {/* ── Section 4: Sales by Category ─────────────── */}
                    {catRows.length > 0 && (
                        <PrintSection title="4. Sales by Category">
                            <p className="text-sm text-slate-500 dark:text-d-muted print:text-gray-600 mb-3">
                                Revenue, cost, and profit grouped by product category.
                            </p>
                            <DataTable
                                compact
                                columns={[
                                    { key: 'category', label: 'Category', render: (r) => r.category || 'Uncategorized' },
                                    { key: 'netQtySold', label: 'Net Qty', align: 'right' },
                                    { key: 'grossRevenue', label: 'Gross Rev.', align: 'right', render: (r) => fmt(r.grossRevenue) },
                                    { key: 'totalDiscount', label: 'Discount', align: 'right', render: (r) => fmt(r.totalDiscount) },
                                    { key: 'netRevenue', label: 'Net Rev.', align: 'right', render: (r) => fmt(r.netRevenue) },
                                    { key: 'totalCost', label: 'Cost', align: 'right', render: (r) => fmt(r.totalCost) },
                                    { key: 'totalProfit', label: 'Profit', align: 'right', render: (r) => fmt(r.totalProfit) },
                                    { key: 'pct', label: '% Share', align: 'right', render: (r) => pct(r.revenuePercentage) },
                                ]}
                                data={catRows}
                            />
                        </PrintSection>
                    )}

                    {/* ── Section 5: Payment Methods ───────────────── */}
                    {payMethods.length > 0 && (
                        <PrintSection title="5. Payment Methods">
                            <p className="text-sm text-slate-500 dark:text-d-muted print:text-gray-600 mb-3">
                                How customers paid — cash, card, online, or store credit.
                            </p>
                            <DataTable
                                compact
                                columns={[
                                    { key: 'method', label: 'Method', render: (r) => (r.method || '').replace('_', ' ').toUpperCase() },
                                    { key: 'transactionCount', label: 'Transactions', align: 'right' },
                                    { key: 'totalAmount', label: 'Amount', align: 'right', render: (r) => fmt(r.totalAmount) },
                                    { key: 'percentage', label: '% Share', align: 'right', render: (r) => pct(r.percentage) },
                                ]}
                                data={payMethods}
                                footer={['TOTAL', payMethods.reduce((s, m) => s + m.transactionCount, 0), fmt(d.payments.grandTotal), '100.0%']}
                            />
                        </PrintSection>
                    )}

                    {/* ── Section 6: Tax / GST ─────────────────────── */}
                    {(taxData.byRate?.length > 0 || taxData.byCategory?.length > 0) && (
                        <PrintSection title="6. Tax / GST Collection">
                            <p className="text-sm text-slate-500 dark:text-d-muted print:text-gray-600 mb-3">
                                Tax collected on sold items (excludes returned items).
                            </p>
                            <div className="mb-3 text-sm text-slate-700 dark:text-d-text">
                                <span className="font-semibold">Total Tax Collected: </span>
                                <span className="font-mono">{fmtDec(taxData.overall?.totalTax || taxData.summary?.totalTaxCollected)}</span>
                                <span className="mx-4 text-slate-300 dark:text-d-border print:text-gray-400">|</span>
                                <span className="font-semibold">Revenue: </span>
                                <span className="font-mono">{fmt(taxData.overall?.totalRevenue || taxData.summary?.totalRevenue)}</span>
                            </div>
                            {taxData.byRate?.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold mb-2 text-slate-600 dark:text-d-text print:text-black">By GST Rate</h4>
                                    <DataTable
                                        compact
                                        columns={[
                                            { key: 'gstRate', label: 'GST / Unit', align: 'right', render: (r) => fmtDec(r.gstRate) },
                                            { key: 'taxableAmount', label: 'Taxable Amt', align: 'right', render: (r) => fmt(r.taxableAmount) },
                                            { key: 'taxCollected', label: 'Tax Collected', align: 'right', render: (r) => fmtDec(r.taxCollected) },
                                            { key: 'itemCount', label: 'Items', align: 'right' },
                                        ]}
                                        data={taxData.byRate}
                                    />
                                </div>
                            )}
                            {taxData.byCategory?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold mb-2 text-slate-600 dark:text-d-text print:text-black">By Category</h4>
                                    <DataTable
                                        compact
                                        columns={[
                                            { key: 'category', label: 'Category' },
                                            { key: 'taxableAmount', label: 'Taxable Amt', align: 'right', render: (r) => fmt(r.taxableAmount) },
                                            { key: 'taxCollected', label: 'Tax Collected', align: 'right', render: (r) => fmtDec(r.taxCollected) },
                                        ]}
                                        data={taxData.byCategory}
                                    />
                                </div>
                            )}
                        </PrintSection>
                    )}

                    {/* ── Section 7: Returns ───────────────────────── */}
                    {retData.summary && (retData.summary.billsWithReturns > 0) && (
                        <PrintSection title="7. Returns & Refunds">
                            <p className="text-sm text-slate-500 dark:text-d-muted print:text-gray-600 mb-3">
                                Summary of all returns processed during this period.
                            </p>
                            <div className="grid grid-cols-4 gap-3 mb-4 text-center text-sm">
                                <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-2">
                                    <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Bills with Returns</div>
                                    <div className="text-lg font-bold font-mono text-slate-800 dark:text-d-heading">{retData.summary.billsWithReturns}</div>
                                </div>
                                <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-2">
                                    <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Return Rate</div>
                                    <div className="text-lg font-bold font-mono text-slate-800 dark:text-d-heading">{pct(retData.summary.returnRate)}</div>
                                </div>
                                <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-2">
                                    <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Total Refunded</div>
                                    <div className="text-lg font-bold font-mono">{fmt(retData.summary.totalRefunded)}</div>
                                </div>
                                <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-2">
                                    <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Refund %</div>
                                    <div className="text-lg font-bold font-mono text-slate-800 dark:text-d-heading">{pct(retData.summary.refundPercentage)}</div>
                                </div>
                            </div>
                            {retData.byReason?.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold mb-2 text-slate-600 dark:text-d-text print:text-black">By Reason</h4>
                                    <DataTable
                                        compact
                                        columns={[
                                            { key: 'reason', label: 'Reason', render: (r) => (r._id || 'unknown').replace('_', ' ') },
                                            { key: 'count', label: 'Count', align: 'right' },
                                            { key: 'totalQty', label: 'Qty', align: 'right' },
                                            { key: 'totalRefund', label: 'Refund Amt', align: 'right', render: (r) => fmt(r.totalRefund) },
                                        ]}
                                        data={retData.byReason}
                                    />
                                </div>
                            )}
                            {retData.byProduct?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold mb-2 text-slate-600 dark:text-d-text print:text-black">Most Returned Products</h4>
                                    <DataTable
                                        compact
                                        columns={[
                                            { key: 'productName', label: 'Product' },
                                            { key: 'returnedQty', label: 'Qty Returned', align: 'right' },
                                            { key: 'returnCount', label: 'Times', align: 'right' },
                                            { key: 'refundAmount', label: 'Refunded', align: 'right', render: (r) => fmt(r.refundAmount) },
                                        ]}
                                        data={retData.byProduct}
                                    />
                                </div>
                            )}
                        </PrintSection>
                    )}

                    {/* ── Section 8: Discounts ─────────────────────── */}
                    {discData.summary && (discData.summary.discountedBills > 0) && (
                        <PrintSection title="8. Discount Analysis">
                            <div className="grid grid-cols-4 gap-3 mb-4 text-center text-sm">
                                <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-2">
                                    <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Total Discounts</div>
                                    <div className="text-lg font-bold font-mono text-slate-800 dark:text-d-heading">{fmt(discData.summary.totalDiscount)}</div>
                                </div>
                                <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-2">
                                    <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Bills</div>
                                    <div className="text-lg font-bold font-mono text-slate-800 dark:text-d-heading">{discData.summary.discountedBills}</div>
                                </div>
                                <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-2">
                                    <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Item Discounts</div>
                                    <div className="text-lg font-bold font-mono text-slate-800 dark:text-d-heading">{fmt(discData.summary.totalItemDiscount)}</div>
                                </div>
                                <div className="border border-slate-200 dark:border-d-border print:border-gray-400 rounded-lg p-2">
                                    <div className="text-slate-500 dark:text-d-muted print:text-gray-600">Bill Discounts</div>
                                    <div className="text-lg font-bold font-mono text-slate-800 dark:text-d-heading">{fmt(discData.summary.totalBillDiscount)}</div>
                                </div>
                            </div>
                            {discData.byCashier?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold mb-2 text-slate-600 dark:text-d-text print:text-black">By Cashier</h4>
                                    <DataTable
                                        compact
                                        columns={[
                                            { key: 'cashierName', label: 'Cashier' },
                                            { key: 'billCount', label: 'Bills', align: 'right' },
                                            { key: 'totalDiscount', label: 'Total Discount', align: 'right', render: (r) => fmt(r.totalDiscount) },
                                            { key: 'avgDiscount', label: 'Avg/Bill', align: 'right', render: (r) => fmt(r.avgDiscount) },
                                        ]}
                                        data={discData.byCashier}
                                    />
                                </div>
                            )}
                        </PrintSection>
                    )}

                    {/* ── Footer ────────────────────────────────────── */}
                    <div className="border-t-2 border-slate-300 dark:border-d-border print:border-black pt-4 mt-8 text-center text-xs text-slate-400 dark:text-d-muted print:text-gray-500">
                        <p>End of Report — {business?.name || 'Business'} — Period: {fmtDate(dateParams.startDate)} to {fmtDate(dateParams.endDate)}</p>
                        <p className="mt-1">Generated automatically from POS system data</p>
                    </div>
                </div>
            </div>
        );
    };

    // ═════════════════════════════════════════════════════════════
    // TAB RENDERERS (same as before but with formulas shown)
    // ═════════════════════════════════════════════════════════════

    // ── P&L ──────────────────────────────────────────────────────
    const renderPnL = () => {
        if (!pnl) return null;
        const profitMargin = pnl.profitMargin || 0;
        const netProfit = pnl.trueNetProfit ?? ((pnl.salesNetProfit || 0) - expenses.total);

        return (
            <>
                {/* Key metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Net Revenue" value={fmt(pnl.netRevenue)} icon={FiDollarSign} color="green" />
                    <StatCard label="Profit Margin" value={pct(profitMargin)} icon={profitMargin >= 0 ? FiTrendingUp : FiTrendingDown} color={profitMargin >= 0 ? 'green' : 'red'} />
                    <StatCard label="Total Orders" value={pnl.totalOrders || 0} icon={FiShoppingCart} color="blue" sub={`Avg: ${fmt(pnl.avgOrderValue)}`} />
                    <StatCard label="Items Sold" value={(pnl.totalItems || 0).toLocaleString()} icon={FiPackage} color="purple" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* P&L Statement */}
                    <Card className="lg:col-span-2">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                            <FiPieChart className="text-primary-500" />
                            Profit & Loss Statement
                        </h2>
                        <div>
                            <PnlRow label="Gross Revenue" amount={pnl.grossRevenue} bold formula={`${pnl.totalOrders} orders`} />
                            <PnlRow label={`Sales (${pnl.totalOrders} orders, ${pnl.totalItems} items)`} amount={pnl.grossRevenue} indent />
                            <PnlRow label="Item Discounts" amount={pnl.totalItemDiscount} negative indent />
                            <PnlRow label="Bill Discounts" amount={pnl.totalBillDiscount} negative indent />
                            <PnlRow label="Total Discounts" amount={pnl.totalDiscount} negative />
                            <PnlRow label="Returns & Refunds" amount={pnl.totalRefunded} negative />
                            <PnlRow label="Net Revenue" amount={pnl.netRevenue} bold border bg formula="Gross - Discounts" />
                            <PnlRow label="Cost of Goods Sold" amount={pnl.totalCost} negative formula="costPrice x netQtySold" />
                            <PnlRow label="Gross Profit" amount={pnl.grossProfit} bold border formula="Revenue - COGS" />
                            <PnlRow label="Operating Expenses" amount={expenses.total} negative />
                            {expenses.breakdown.map((e, i) => (
                                <PnlRow key={i} label={e.label} amount={e.amount} indent />
                            ))}
                            <div className={`flex justify-between items-center py-4 -mx-6 px-6 mt-2 rounded-b-xl ${netProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                <div>
                                    <span className="font-bold text-lg text-slate-800 dark:text-d-heading">Net Profit</span>
                                    <span className="text-xs text-slate-400 dark:text-d-muted ml-2">(Sales Profit - Expenses)</span>
                                </div>
                                <span className={`font-bold text-2xl font-mono ${netProfit >= 0 ? 'text-green-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}`}>
                                    {fmt(netProfit)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Expense breakdown */}
                    <Card>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Expense Breakdown</h3>
                        {expenses.breakdown.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={expenses.breakdown} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
                                            {expenses.breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => fmt(v)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {expenses.breakdown.map((e, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm">
                                            <span className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                <span className="text-slate-600 dark:text-d-text">{e.label}</span>
                                            </span>
                                            <span className="font-mono text-slate-700 dark:text-d-text">{fmt(e.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center text-sm font-semibold pt-2 border-t border-slate-100 dark:border-d-border">
                                        <span className="text-slate-800 dark:text-d-heading">Total</span>
                                        <span className="font-mono text-slate-800 dark:text-d-heading">{fmt(expenses.total)}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-40 flex items-center justify-center text-slate-400 dark:text-d-muted">No expenses</div>
                        )}
                    </Card>
                </div>

                {/* Sales Timeline */}
                {timeline.length > 0 && (
                    <Card className="mb-6">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Sales Timeline</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={timeline}>
                                <CartesianGrid strokeDasharray="3 3" className="dark:opacity-30" />
                                <XAxis dataKey="period" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                                <YAxis stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(v) => fmt(v)} />
                                <Legend />
                                <Line type="monotone" dataKey="totalSales" name="Revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="totalProfit" name="Profit" stroke="#22c55e" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                )}

                {/* Daily breakdown table */}
                {timeline.length > 0 && (
                    <Card>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Daily Breakdown</h3>
                        <DataTable
                            compact
                            columns={[
                                { key: 'period', label: 'Date' },
                                { key: 'billCount', label: 'Bills', align: 'right' },
                                { key: 'totalQty', label: 'Items', align: 'right' },
                                { key: 'totalSales', label: 'Revenue', align: 'right', render: (r) => fmt(r.totalSales) },
                                { key: 'totalDiscount', label: 'Discount', align: 'right', render: (r) => fmt(r.totalDiscount) },
                                { key: 'totalRefunded', label: 'Refunds', align: 'right', render: (r) => fmt(r.totalRefunded) },
                                { key: 'netSales', label: 'Net Sales', align: 'right', render: (r) => fmt(r.netSales) },
                                { key: 'totalProfit', label: 'Profit', align: 'right', render: (r) => (
                                    <span className={r.totalProfit >= 0 ? 'text-green-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}>{fmt(r.totalProfit)}</span>
                                )},
                            ]}
                            data={timeline}
                            footer={[
                                'Total',
                                timeline.reduce((s, r) => s + r.billCount, 0),
                                timeline.reduce((s, r) => s + r.totalQty, 0),
                                fmt(timeline.reduce((s, r) => s + r.totalSales, 0)),
                                fmt(timeline.reduce((s, r) => s + r.totalDiscount, 0)),
                                fmt(timeline.reduce((s, r) => s + r.totalRefunded, 0)),
                                fmt(timeline.reduce((s, r) => s + r.netSales, 0)),
                                fmt(timeline.reduce((s, r) => s + r.totalProfit, 0)),
                            ]}
                        />
                    </Card>
                )}
            </>
        );
    };

    // ── Sales by Product ─────────────────────────────────────────
    const renderProducts = () => {
        const rows = products.data;
        const s = products.summary;
        return (
            <Card>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                    <FiPackage className="text-primary-500" /> Sales by Product
                </h3>
                <DataTable
                    columns={[
                        { key: 'name', label: 'Product' },
                        { key: 'category', label: 'Category' },
                        { key: 'totalQtySold', label: 'Sold', align: 'right' },
                        { key: 'totalReturnedQty', label: 'Returned', align: 'right' },
                        { key: 'netQtySold', label: 'Net Qty', align: 'right' },
                        { key: 'netRevenue', label: 'Revenue', align: 'right', render: (r) => fmt(r.netRevenue) },
                        { key: 'totalCost', label: 'Cost', align: 'right', render: (r) => fmt(r.totalCost) },
                        { key: 'totalProfit', label: 'Profit', align: 'right', render: (r) => (
                            <span className={r.totalProfit >= 0 ? 'text-green-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}>
                                {fmt(r.totalProfit)}
                            </span>
                        )},
                        { key: 'margin', label: 'Margin', align: 'right', render: (r) => {
                            const margin = r.netRevenue > 0 ? (r.totalProfit / r.netRevenue) * 100 : 0;
                            return <span className={margin >= 0 ? 'text-green-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}>{pct(margin)}</span>;
                        }},
                    ]}
                    data={rows}
                    footer={s.netQtySold !== undefined ? [
                        'Total', '', s.totalQtySold, s.totalReturnedQty, s.netQtySold,
                        fmt(s.netRevenue), fmt(s.totalCost), fmt(s.totalProfit),
                        s.netRevenue > 0 ? pct((s.totalProfit / s.netRevenue) * 100) : '0.0%',
                    ] : null}
                />
            </Card>
        );
    };

    // ── Sales by Category ────────────────────────────────────────
    const renderCategories = () => {
        const rows = Array.isArray(categories) ? categories : [];
        const totalRev = rows.reduce((s, r) => s + (r.grossRevenue || 0), 0);

        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                        <FiGrid className="text-primary-500" /> Sales by Category
                    </h3>
                    <DataTable
                        columns={[
                            { key: 'category', label: 'Category', render: (r) => r.category || 'Uncategorized' },
                            { key: 'netQtySold', label: 'Net Qty', align: 'right' },
                            { key: 'grossRevenue', label: 'Gross Revenue', align: 'right', render: (r) => fmt(r.grossRevenue) },
                            { key: 'totalDiscount', label: 'Discount', align: 'right', render: (r) => fmt(r.totalDiscount) },
                            { key: 'netRevenue', label: 'Net Revenue', align: 'right', render: (r) => fmt(r.netRevenue) },
                            { key: 'totalCost', label: 'Cost', align: 'right', render: (r) => fmt(r.totalCost) },
                            { key: 'totalProfit', label: 'Profit', align: 'right', render: (r) => (
                                <span className={r.totalProfit >= 0 ? 'text-green-600 dark:text-d-green' : 'text-red-600 dark:text-d-red'}>{fmt(r.totalProfit)}</span>
                            )},
                            { key: 'pct', label: '% Share', align: 'right', render: (r) => pct(r.revenuePercentage || (totalRev > 0 ? (r.grossRevenue / totalRev) * 100 : 0)) },
                        ]}
                        data={rows}
                    />
                </Card>

                <Card>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Revenue Share</h3>
                    {rows.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={rows} dataKey="grossRevenue" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}>
                                    {rows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v) => fmt(v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-slate-400 dark:text-d-muted">No data</div>
                    )}
                </Card>
            </div>
        );
    };

    // ── Payment Methods ──────────────────────────────────────────
    const renderPayments = () => {
        const methods = payments.methods || [];
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4 flex items-center gap-2">
                        <FiCreditCard className="text-primary-500" /> Payment Methods
                    </h3>
                    {methods.length > 0 ? (
                        <div className="space-y-4">
                            {methods.map((m, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-slate-700 dark:text-d-text font-medium capitalize">{m.method.replace('_', ' ')}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-400 dark:text-d-muted">{m.transactionCount} transactions</span>
                                            <span className="font-mono font-semibold text-slate-800 dark:text-d-heading">{fmt(m.totalAmount)}</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-d-elevated rounded-full h-3">
                                        <div
                                            className="h-3 rounded-full transition-all"
                                            style={{
                                                width: `${m.percentage || 0}%`,
                                                backgroundColor: PAYMENT_COLORS[m.method] || PAYMENT_COLORS.unknown,
                                            }}
                                        />
                                    </div>
                                    <div className="text-right text-xs text-slate-400 dark:text-d-muted mt-0.5">{pct(m.percentage)}</div>
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-d-border font-semibold">
                                <span className="text-slate-800 dark:text-d-heading">Grand Total</span>
                                <span className="font-mono text-lg text-slate-800 dark:text-d-heading">{fmt(payments.grandTotal)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-slate-400 dark:text-d-muted">No payment data</div>
                    )}
                </Card>

                <Card>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Distribution</h3>
                    {methods.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={methods} dataKey="totalAmount" nameKey="method" cx="50%" cy="50%" outerRadius={100} label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}>
                                    {methods.map((m, i) => <Cell key={i} fill={PAYMENT_COLORS[m.method] || PAYMENT_COLORS.unknown} />)}
                                </Pie>
                                <Tooltip formatter={(v) => fmt(v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-slate-400 dark:text-d-muted">No data</div>
                    )}
                </Card>
            </div>
        );
    };

    // ── Tax / GST ────────────────────────────────────────────────
    const renderTax = () => {
        const overall = tax.overall || {};
        return (
            <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <StatCard label="Total Tax Collected" value={fmtDec(overall.totalTax)} icon={FiPercent} color="purple" />
                    <StatCard label="Total Revenue" value={fmt(overall.totalRevenue)} icon={FiDollarSign} color="blue" />
                    <StatCard label="Bills with Tax" value={overall.billCount || 0} icon={FiShoppingCart} color="green" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Tax by Rate</h3>
                        <DataTable
                            columns={[
                                { key: 'gstRate', label: 'GST / Unit', align: 'right', render: (r) => fmtDec(r.gstRate) },
                                { key: 'taxableAmount', label: 'Taxable Amount', align: 'right', render: (r) => fmt(r.taxableAmount) },
                                { key: 'taxCollected', label: 'Tax Collected', align: 'right', render: (r) => fmtDec(r.taxCollected) },
                                { key: 'itemCount', label: 'Items', align: 'right' },
                            ]}
                            data={tax.byRate || []}
                        />
                    </Card>

                    <Card>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Tax by Category</h3>
                        <DataTable
                            columns={[
                                { key: 'category', label: 'Category' },
                                { key: 'taxableAmount', label: 'Taxable Amount', align: 'right', render: (r) => fmt(r.taxableAmount) },
                                { key: 'taxCollected', label: 'Tax Collected', align: 'right', render: (r) => fmtDec(r.taxCollected) },
                            ]}
                            data={tax.byCategory || []}
                        />
                    </Card>
                </div>
            </>
        );
    };

    // ── Returns ──────────────────────────────────────────────────
    const renderReturns = () => {
        if (!returns) return null;
        const summary = returns.summary || {};
        const byReason = returns.byReason || [];
        const byProduct = returns.byProduct || [];

        return (
            <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Bills with Returns" value={summary.billsWithReturns || 0} icon={FiRotateCcw} color="red" />
                    <StatCard label="Return Rate" value={pct(summary.returnRate)} icon={FiTrendingDown} color="orange" />
                    <StatCard label="Total Refunded" value={fmt(summary.totalRefunded)} icon={FiDollarSign} color="red" />
                    <StatCard label="Refund %" value={pct(summary.refundPercentage)} icon={FiPercent} color="red" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Returns by Reason</h3>
                        {byReason.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={byReason.map(r => ({ ...r, reason: (r._id || 'unknown').replace('_', ' ') }))} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" className="dark:opacity-30" />
                                    <XAxis type="number" stroke="#94a3b8" />
                                    <YAxis type="category" dataKey="reason" width={120} stroke="#94a3b8" tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#ef4444" radius={[0, 8, 8, 0]} name="Count" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-40 flex items-center justify-center text-slate-400 dark:text-d-muted">No returns</div>
                        )}
                    </Card>

                    <Card>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Most Returned Products</h3>
                        <DataTable
                            columns={[
                                { key: 'productName', label: 'Product' },
                                { key: 'returnedQty', label: 'Qty Returned', align: 'right' },
                                { key: 'returnCount', label: 'Times', align: 'right' },
                                { key: 'refundAmount', label: 'Refunded', align: 'right', render: (r) => fmt(r.refundAmount) },
                            ]}
                            data={byProduct.slice(0, 10)}
                        />
                    </Card>
                </div>
            </>
        );
    };

    // ── Discounts ────────────────────────────────────────────────
    const renderDiscounts = () => {
        if (!discounts) return null;
        const summary = discounts.summary || {};
        const byCashier = discounts.byCashier || [];
        const recentDiscounted = discounts.recentDiscounted || [];

        return (
            <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Total Discounts" value={fmt(summary.totalDiscount)} icon={FiTag} color="orange" />
                    <StatCard label="Bills with Discount" value={summary.discountedBills || 0} icon={FiShoppingCart} color="blue" />
                    <StatCard label="Item Discounts" value={fmt(summary.totalItemDiscount)} icon={FiPackage} color="purple" />
                    <StatCard label="Bill Discounts" value={fmt(summary.totalBillDiscount)} icon={FiDollarSign} color="green" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Discounts by Cashier</h3>
                        <DataTable
                            columns={[
                                { key: 'cashierName', label: 'Cashier' },
                                { key: 'totalDiscount', label: 'Total Discount', align: 'right', render: (r) => fmt(r.totalDiscount) },
                                { key: 'billCount', label: 'Bills', align: 'right' },
                                { key: 'avgDiscount', label: 'Avg/Bill', align: 'right', render: (r) => fmt(r.avgDiscount) },
                            ]}
                            data={byCashier}
                        />
                    </Card>

                    <Card>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Recent Discounted Bills</h3>
                        <DataTable
                            columns={[
                                { key: 'billNumber', label: 'Bill #', render: (r) => `#${r.billNumber}` },
                                { key: 'cashierName', label: 'Cashier' },
                                { key: 'discountMode', label: 'Type', render: (r) => (r.discountMode || '').replace('_', ' ') },
                                { key: 'totalDiscount', label: 'Discount', align: 'right', render: (r) => fmt(r.totalDiscount) },
                                { key: 'total', label: 'Bill Total', align: 'right', render: (r) => fmt(r.total) },
                            ]}
                            data={recentDiscounted.slice(0, 10)}
                        />
                    </Card>
                </div>
            </>
        );
    };

    // ── Tab content router ───────────────────────────────────────
    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-500 dark:text-d-muted">Loading report...</p>
                    </div>
                </div>
            );
        }

        switch (tab) {
            case 'pnl': return renderPnL();
            case 'products': return renderProducts();
            case 'categories': return renderCategories();
            case 'payments': return renderPayments();
            case 'tax': return renderTax();
            case 'returns': return renderReturns();
            case 'discounts': return renderDiscounts();
            default: return null;
        }
    };

    // ═════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════

    // If detailed report is open, render that instead
    if (showDetailedReport) return renderDetailedReport();

    return (
        <div className="p-6 animate-fadeIn bg-slate-50 dark:bg-d-bg min-h-full h-full overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Reports</h1>
                    <p className="text-slate-500 dark:text-d-muted text-sm">{TABS.find(t => t.key === tab)?.label} — {periodLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Download Detailed Report */}
                    <button
                        onClick={fetchAllAndShowReport}
                        disabled={detailedLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white hover:bg-primary-600 rounded-xl transition-colors font-medium disabled:opacity-50"
                    >
                        {detailedLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <FiFileText size={18} />
                        )}
                        Detailed Report
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-xl transition-colors"
                    >
                        <FiRefreshCw size={18} />
                    </button>
                    <div className="flex items-center bg-white dark:bg-d-card rounded-xl p-1 shadow-sm border border-slate-200 dark:border-d-border">
                        {TIME_FILTERS.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setTimeFilter(f.key)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    timeFilter === f.key
                                        ? 'bg-primary-500 text-white'
                                        : 'text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Custom date range */}
            {timeFilter === 'custom' && (
                <div className="flex items-center gap-3 mb-6 bg-white dark:bg-d-card rounded-xl p-4 shadow-sm border border-slate-200 dark:border-d-border">
                    <FiCalendar className="text-slate-400" size={18} />
                    <label className="text-sm text-slate-600 dark:text-d-text">From:</label>
                    <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="px-3 py-2 border border-slate-200 dark:border-d-border rounded-lg bg-slate-50 dark:bg-d-bg text-slate-700 dark:text-d-text text-sm"
                    />
                    <label className="text-sm text-slate-600 dark:text-d-text">To:</label>
                    <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="px-3 py-2 border border-slate-200 dark:border-d-border rounded-lg bg-slate-50 dark:bg-d-bg text-slate-700 dark:text-d-text text-sm"
                    />
                    {customStart && customEnd && (
                        <span className="text-xs text-slate-400 dark:text-d-muted ml-2">
                            {fmtDate(customStart)} — {fmtDate(customEnd)}
                        </span>
                    )}
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto bg-white dark:bg-d-card rounded-xl p-1 shadow-sm border border-slate-200 dark:border-d-border">
                {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                tab === t.key
                                    ? 'bg-primary-500 text-white'
                                    : 'text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover'
                            }`}
                        >
                            <Icon size={16} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {renderContent()}
        </div>
    );
};

export default Reports;
