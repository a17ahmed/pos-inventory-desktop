import React, { useState, useEffect, useCallback } from 'react';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { KpiCard, KpiStrip, ChartPanel, BarChart, AreaChart, DonutChart, HorizontalBarChart, SegmentedControl, Tabs, Button, IconButton, Input, Field, StateCard } from '../components/ui';
import { CARD_FRAME } from '../components/ui/Card';
import { useBusiness } from '../context/BusinessContext';
import { appAlert } from '../components/AppDialog';
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
    getProfitReport,
    getSalesTimeline,
    getSalesByProduct,
    getSalesByCategory,
    getPaymentMethodReport,
    getTaxReport,
    getReturnAnalysis,
    getDiscountReport,
} from '../services/api/bills';

// True on Windows, where the native min/max/close overlay covers the top-right
// of the window — so header buttons there need space reserved to stay clickable.
const IS_WIN = typeof navigator !== 'undefined' &&
    (navigator.userAgentData?.platform === 'Windows' || /Win/i.test(navigator.userAgent));

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


// ── Timeline helpers ─────────────────────────────────────────────
const MEASURES = [
    { value: 'totalSales', label: 'Revenue' },
    { value: 'totalProfit', label: 'Profit' },
    { value: 'billCount', label: 'Bills' },
];

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const isoWeekKey = (d) => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const wd = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - wd);
    const y = t.getUTCFullYear();
    const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return `${y}-W${pad2(w)}`;
};
const dm = (d, opts) => d.toLocaleDateString('en-GB', opts);

/**
 * The server only returns periods that had bills. Fill every day / week / month of the range
 * (zeros included) so the chart has no gaps, and add a short `label` and a long `full` name.
 */
const fillTimeline = (rows, group, range) => {
    const byKey = new Map(rows.map((r) => [r.period, r]));
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const out = [];
    const seen = new Set();
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (let guard = 0; d <= end && guard < 800; guard += 1) {
        const key = group === 'month' ? monthKeyOf(d) : group === 'week' ? isoWeekKey(d) : dayKey(d);
        if (!seen.has(key)) {
            seen.add(key);
            const first = new Date(d);
            const label = group === 'month' ? dm(first, { month: 'short' }) : dm(first, { day: 'numeric', month: 'short' });
            const full =
                group === 'month'
                    ? dm(first, { month: 'long', year: 'numeric' })
                    : group === 'week'
                      ? `Week of ${dm(first, { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : dm(first, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            const r = byKey.get(key) || {};
            out.push({ period: key, totalSales: 0, totalProfit: 0, billCount: 0, ...r, label, full });
        }
        d.setDate(d.getDate() + 1);
    }
    return out;
};

const shortMoney = (v) => {
    const n = Math.abs(Number(v) || 0);
    const sign = Number(v) < 0 ? '−' : '';
    if (n >= 1e6) return `${sign}${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
    if (n >= 1e3) return `${sign}${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
    return `${sign}${Math.round(n)}`;
};

const METHOD_LABEL = { cash: 'Cash', card: 'Card', online: 'Online', store_credit: 'Store credit', split: 'Split', credit: 'On credit' };
const methodLabel = (m) => METHOD_LABEL[m] || String(m || 'Unknown').replace(/_/g, ' ');

// ── Card wrapper ─────────────────────────────────────────────────
const Card = ({ children, className = '' }) => <div className={`${CARD_FRAME} p-6 min-w-0 ${className}`}>{children}</div>;

const CardTitle = ({ children }) => <h3 className="font-heading text-h4 text-foreground mb-3">{children}</h3>;

// Old colour names → figure tone
const TONE = { green: 'success', red: 'destructive', orange: 'warning' };
const StatCard = ({ label, value, color, sub, tone }) => <KpiCard label={label} value={value} note={sub} tone={tone || TONE[color]} />;

// ── Table component ──────────────────────────────────────────────
const DataTable = ({ columns, data, footer, compact }) => (
    <div className="overflow-auto max-h-[max(320px,calc(100vh-300px))] print:max-h-none print:overflow-visible">
        <table className={`w-full ${compact ? 'text-xs' : 'text-sm'}`}>
            <thead>
                <tr className="border-b border-border bg-muted/30 print:bg-transparent print:border-black">
                    {columns.map((col, i) => (
                        <th key={i} className={`sticky top-0 z-[1] print:static bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] print:bg-transparent print:shadow-none h-[var(--head-h)] px-3 font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap print:h-auto print:py-2 print:text-black ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} className="py-6 text-center text-muted-foreground">No data for this period</td>
                    </tr>
                ) : (
                    data.map((row, ri) => (
                        <tr key={ri} className="border-b border-hairline print:border-hairline hover:bg-[var(--hover-overlay)] print:hover:bg-transparent">
                            {columns.map((col, ci) => (
                                <td key={ci} className={`py-2 px-3 text-foreground print:text-black ${col.align === 'right' ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>
                                    {col.render ? col.render(row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))
                )}
            </tbody>
            {footer && (
                <tfoot>
                    <tr className="border-t border-border print:border-black bg-muted/50 print:bg-muted font-semibold">
                        {footer.map((cell, i) => (
                            <td key={i} className={`py-2 px-3 text-foreground print:text-black ${columns[i]?.align === 'right' ? 'text-right tabular-nums' : ''}`}>
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
    <div className={`flex justify-between items-center py-2.5 ${indent ? 'pl-6' : ''} ${border ? 'border-b-2 border-border print:border-black' : 'border-b border-hairline print:border-hairline'} ${bg ? '-mx-6 px-6 bg-muted/50 print:bg-muted' : ''}`}>
        <div className="flex-1">
            <span className={`${bold ? 'font-semibold text-foreground print:text-black' : indent ? 'text-muted-foreground text-sm print:text-muted-foreground' : 'text-foreground print:text-black'} ${negative ? 'text-destructive print:text-black flex items-center gap-1.5' : ''}`}>
                {negative && <FiMinusCircle size={14} className="print:hidden" />}
                {label}
            </span>
            {formula && <span className="text-xs text-muted-foreground ml-2 print:text-muted-foreground">({formula})</span>}
            {sub && <span className="text-xs text-muted-foreground ml-2">({sub})</span>}
        </div>
        <div className="flex items-center gap-3">
            <span className={`${bold ? 'font-bold text-lg text-foreground print:text-black' : negative ? 'text-destructive print:text-black' : 'text-foreground print:text-black'} tabular-nums`}>
                {negative ? `- ${fmt(Math.abs(amount))}` : fmt(amount)}
            </span>
            {growth !== undefined && (
                <span className={`flex items-center text-xs print:hidden ${growth >= 0 ? 'text-success' : 'text-destructive'}`}>
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
        <h3 className="text-lg font-bold text-foreground print:text-black border-b-2 border-border print:border-black pb-2 mb-4">
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
    const [groupChoice, setGroupChoice] = useState(null); // null = pick from the period
    const [measure, setMeasure] = useState('totalSales');
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
    const rangeDays = Math.round((new Date(dateParams.endDate) - new Date(dateParams.startDate)) / 86400000) + 1;
    const timelineGroup = groupChoice || (rangeDays > 92 ? 'month' : 'day');
    const setTimelineGroup = setGroupChoice;
    const periodLabel = getFilterLabel(timeFilter, customStart, customEnd);

    // ── Fetch data for active tab ────────────────────────────────
    const [loadError, setLoadError] = useState(null);
    const fetchData = useCallback(async () => {
        if (timeFilter === 'custom' && (!customStart || !customEnd)) return;
        setLoading(true);
        setLoadError(null);
        try {
            const params = { startDate: dateParams.startDate, endDate: dateParams.endDate };

            if (tab === 'pnl') {
                const [profitRes, timelineRes] = await Promise.all([
                    getProfitReport(params),
                    getSalesTimeline({ ...params, groupBy: timelineGroup }),
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
            setLoadError(err.response?.data?.message || (!navigator.onLine ? 'You seem to be offline.' : 'The server didn\'t answer.'));
        } finally {
            setLoading(false);
        }
    }, [tab, timeFilter, customStart, customEnd, timelineGroup]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Fetch ALL data for detailed report + PDF ─────────────────
    const fetchAllAndShowReport = async () => {
        setDetailedLoading(true);
        try {
            const params = { startDate: dateParams.startDate, endDate: dateParams.endDate };
            const [profitRes, timelineRes, productsRes, categoriesRes, paymentsRes, taxRes, returnsRes, discountsRes] = await Promise.all([
                getProfitReport(params),
                getSalesTimeline({ ...params, groupBy: timelineGroup }),
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

    const handlePrint = async () => {
        const html = document.documentElement;
        const wasDark = html.classList.contains('dark');
        if (wasDark) html.classList.remove('dark');
        // Let the light-mode styles apply before capturing the print view.
        await new Promise((r) => setTimeout(r, 150));
        try {
            // Electron: generate the PDF with Chromium's own engine and save it to
            // Downloads (no OS print dialog — that silently fails on some Windows PCs).
            if (window.electronAPI?.exportReportPdf) {
                const res = await window.electronAPI.exportReportPdf({ filename: `${business?.name || 'Sales'} Report` });
                if (!res?.success) {
                    appAlert(res?.error || 'Could not create the PDF.', { title: 'Download failed', danger: true });
                }
            } else {
                window.print();
            }
        } finally {
            if (wasDark) html.classList.add('dark');
        }
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
            <div className="fixed inset-0 z-50 bg-card overflow-auto print-static print:bg-card print:z-auto">
                {/* Close / Print bar — hidden on print */}
                <div
                    className="sticky top-0 z-10 bg-card border-b border-border p-4 flex items-center justify-between print:hidden"
                    style={IS_WIN ? { paddingRight: 148 } : undefined}
                >
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowDetailedReport(false)} className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg">
                            <FiX size={20} />
                        </button>
                        <h2 className="text-lg font-semibold text-foreground">Detailed Sales Report</h2>
                    </div>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium">
                        <FiDownload size={18} />
                        Download PDF
                    </button>
                </div>

                {/* Report body */}
                <div className="max-w-[1000px] mx-auto p-8 print:p-4 print:max-w-none">
                    {/* ── Report Header ──────────────────────────────── */}
                    <div className="text-center mb-8 print:mb-6">
                        <h1 className="text-2xl font-bold text-foreground print:text-black">{business?.name || 'Business'}</h1>
                        <h2 className="text-xl font-semibold text-foreground print:text-black mt-1">Sales Report</h2>
                        <p className="text-muted-foreground print:text-muted-foreground mt-1">
                            Period: {fmtDate(dateParams.startDate)} — {fmtDate(dateParams.endDate)}
                        </p>
                        <p className="text-xs text-muted-foreground print:text-muted-foreground mt-1">Generated on {fmtDate(new Date())}</p>
                    </div>

                    {/* ── Section 1: P&L Statement ──────────────────── */}
                    <PrintSection title="1. Profit & Loss Statement">
                        <p className="text-sm text-muted-foreground print:text-muted-foreground mb-4">
                            This section shows how your net profit is calculated step by step — from total sales down to the final number after subtracting costs, refunds, and expenses.
                        </p>
                        <div className="border border-border print:border-black rounded-lg print:rounded-none overflow-hidden">
                            <div className="p-4 print:p-2">
                                <PnlRow label="Gross Revenue" amount={p.grossRevenue} bold formula={`${p.totalOrders} orders total`} />
                                <PnlRow label={`Sales (${p.totalOrders} orders, ${p.totalItems} items)`} amount={p.grossRevenue} indent />
                                <PnlRow label="Item-level Discounts" amount={p.totalItemDiscount} negative indent />
                                <PnlRow label="Bill-level Discounts" amount={p.totalBillDiscount} negative indent />
                                <PnlRow label="Total Discounts" amount={p.totalDiscount} negative formula={`Item disc. + Bill disc.`} />
                                <PnlRow label="Net Revenue (after discounts)" amount={p.netRevenue} bold border bg formula="Gross Revenue - Total Discounts" />
                                <PnlRow label="Returns & Refunds" amount={p.totalRefunded} negative />
                                <PnlRow label="Revenue After Returns" amount={p.revenueAfterReturns} bold border formula="Net Revenue − Returns" />
                                <PnlRow label="COGS (net of returns)" amount={p.adjustedCogs} negative formula="costPrice × (qty − returnedQty)" />
                                <PnlRow label="Gross Profit" amount={p.revenueAfterReturns - (p.adjustedCogs || 0)} bold border formula="Revenue After Returns − COGS" />
                                <PnlRow label="Returned Profit" amount={p.returnedProfit} negative indent formula="Profit lost from returned items" />
                                <PnlRow label="Sales Net Profit" amount={p.salesNetProfit} bold border bg formula="Gross Profit - Returned Profit" />
                                <PnlRow label="Operating Expenses" amount={d.expenses.total} negative />
                                {d.expenses.breakdown.map((e, i) => (
                                    <PnlRow key={i} label={`${e.label} (${e.count} entries)`} amount={e.amount} indent />
                                ))}
                                <div className={`flex justify-between items-center py-4 px-4 mt-2 print:border-t-2 print:border-black ${netProfit >= 0 ? 'bg-success-chip/50 print:bg-muted' : 'bg-destructive-chip/50 print:bg-muted'}`}>
                                    <div>
                                        <span className="font-bold text-lg text-foreground print:text-black">NET PROFIT</span>
                                        <span className="text-xs text-muted-foreground print:text-muted-foreground ml-2">(Sales Net Profit - Expenses)</span>
                                    </div>
                                    <span className={`font-heading text-h3 tabular-nums print:text-black ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                        {fmt(netProfit)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-4 text-center text-sm">
                            <div className="border border-border print:border-border rounded-lg p-3 print:p-2">
                                <div className="text-muted-foreground print:text-muted-foreground">Profit Margin</div>
                                <div className="text-xl font-bold font-mono text-foreground print:text-black">{pct(p.profitMargin)}</div>
                            </div>
                            <div className="border border-border print:border-border rounded-lg p-3 print:p-2">
                                <div className="text-muted-foreground print:text-muted-foreground">Avg Order Value</div>
                                <div className="text-xl font-bold font-mono text-foreground print:text-black">{fmt(p.avgOrderValue)}</div>
                            </div>
                            <div className="border border-border print:border-border rounded-lg p-3 print:p-2">
                                <div className="text-muted-foreground print:text-muted-foreground">Discount Rate</div>
                                <div className="text-xl font-bold font-mono text-foreground print:text-black">{p.grossRevenue > 0 ? pct((p.totalDiscount / p.grossRevenue) * 100) : '0.0%'}</div>
                            </div>
                        </div>
                    </PrintSection>

                    {/* ── Section 2: Daily/Period Breakdown ─────────── */}
                    {timelineRows.length > 0 && (
                        <PrintSection title="2. Daily Sales Breakdown">
                            <p className="text-sm text-muted-foreground print:text-muted-foreground mb-3">
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
                                        <span className={r.totalProfit >= 0 ? 'text-success print:text-black' : 'text-destructive print:text-black'}>{fmt(r.totalProfit)}</span>
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
                            <p className="text-sm text-muted-foreground print:text-muted-foreground mb-3">
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
                            <p className="text-sm text-muted-foreground print:text-muted-foreground mb-3">
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
                            <p className="text-sm text-muted-foreground print:text-muted-foreground mb-3">
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
                            <p className="text-sm text-muted-foreground print:text-muted-foreground mb-3">
                                Tax collected on sold items (excludes returned items).
                            </p>
                            <div className="mb-3 text-sm text-foreground">
                                <span className="font-semibold">Total Tax Collected: </span>
                                <span className="font-mono">{fmtDec(taxData.overall?.totalTax || taxData.summary?.totalTaxCollected)}</span>
                                <span className="mx-4 text-placeholder print:text-muted-foreground">|</span>
                                <span className="font-semibold">Revenue: </span>
                                <span className="font-mono">{fmt(taxData.overall?.totalRevenue || taxData.summary?.totalRevenue)}</span>
                            </div>
                            {taxData.byRate?.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold mb-2 text-foreground print:text-black">By GST Rate</h4>
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
                                    <h4 className="text-sm font-semibold mb-2 text-foreground print:text-black">By Category</h4>
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
                            <p className="text-sm text-muted-foreground print:text-muted-foreground mb-3">
                                Summary of all returns processed during this period.
                            </p>
                            <div className="grid grid-cols-4 gap-3 mb-4 text-center text-sm">
                                <div className="border border-border print:border-border rounded-lg p-2">
                                    <div className="text-muted-foreground print:text-muted-foreground">Bills with Returns</div>
                                    <div className="text-lg font-bold font-mono text-foreground">{retData.summary.billsWithReturns}</div>
                                </div>
                                <div className="border border-border print:border-border rounded-lg p-2">
                                    <div className="text-muted-foreground print:text-muted-foreground">Return Rate</div>
                                    <div className="text-lg font-bold font-mono text-foreground">{pct(retData.summary.returnRate)}</div>
                                </div>
                                <div className="border border-border print:border-border rounded-lg p-2">
                                    <div className="text-muted-foreground print:text-muted-foreground">Total Refunded</div>
                                    <div className="text-lg font-bold font-mono">{fmt(retData.summary.totalRefunded)}</div>
                                </div>
                                <div className="border border-border print:border-border rounded-lg p-2">
                                    <div className="text-muted-foreground print:text-muted-foreground">Refund %</div>
                                    <div className="text-lg font-bold font-mono text-foreground">{pct(retData.summary.refundPercentage)}</div>
                                </div>
                            </div>
                            {retData.byReason?.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold mb-2 text-foreground print:text-black">By Reason</h4>
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
                                    <h4 className="text-sm font-semibold mb-2 text-foreground print:text-black">Most Returned Products</h4>
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
                                <div className="border border-border print:border-border rounded-lg p-2">
                                    <div className="text-muted-foreground print:text-muted-foreground">Total Discounts</div>
                                    <div className="text-lg font-bold font-mono text-foreground">{fmt(discData.summary.totalDiscount)}</div>
                                </div>
                                <div className="border border-border print:border-border rounded-lg p-2">
                                    <div className="text-muted-foreground print:text-muted-foreground">Bills</div>
                                    <div className="text-lg font-bold font-mono text-foreground">{discData.summary.discountedBills}</div>
                                </div>
                                <div className="border border-border print:border-border rounded-lg p-2">
                                    <div className="text-muted-foreground print:text-muted-foreground">Item Discounts</div>
                                    <div className="text-lg font-bold font-mono text-foreground">{fmt(discData.summary.totalItemDiscount)}</div>
                                </div>
                                <div className="border border-border print:border-border rounded-lg p-2">
                                    <div className="text-muted-foreground print:text-muted-foreground">Bill Discounts</div>
                                    <div className="text-lg font-bold font-mono text-foreground">{fmt(discData.summary.totalBillDiscount)}</div>
                                </div>
                            </div>
                            {discData.byCashier?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold mb-2 text-foreground print:text-black">By Cashier</h4>
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
                    <div className="border-t-2 border-border print:border-black pt-4 mt-8 text-center text-xs text-muted-foreground print:text-muted-foreground">
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
        const timelineRows = fillTimeline(timeline, timelineGroup, dateParams);
        const measureFmt = measure === 'billCount' ? (v) => Number(v || 0).toLocaleString() : fmt;
        const axisFmt = measure === 'billCount' ? (v) => v : shortMoney;
        const tooltipRows = (d) => [
            ['Revenue', fmt(d.totalSales)],
            ['Profit', fmt(d.totalProfit)],
            ['Bills', Number(d.billCount || 0).toLocaleString()],
        ];
        const peak = timelineRows.reduce((best, r) => (!best || (r[measure] || 0) > (best[measure] || 0) ? r : best), null);

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
                        <h2 className="font-heading text-h4 text-foreground mb-3">Profit &amp; Loss statement</h2>
                        <div>
                            <PnlRow label="Gross Revenue" amount={pnl.grossRevenue} bold formula={`${pnl.totalOrders} orders`} />
                            <PnlRow label={`Sales (${pnl.totalOrders} orders, ${pnl.totalItems} items)`} amount={pnl.grossRevenue} indent />
                            <PnlRow label="Item Discounts" amount={pnl.totalItemDiscount} negative indent />
                            <PnlRow label="Bill Discounts" amount={pnl.totalBillDiscount} negative indent />
                            <PnlRow label="Total Discounts" amount={pnl.totalDiscount} negative />
                            <PnlRow label="Net Revenue" amount={pnl.netRevenue} bold border bg formula="Gross − Discounts" />
                            <PnlRow label="Returns & Refunds" amount={pnl.totalRefunded} negative />
                            <PnlRow label="Revenue After Returns" amount={pnl.revenueAfterReturns} bold border formula="Net Revenue − Returns" />
                            <PnlRow label="COGS (net of returns)" amount={pnl.adjustedCogs} negative formula="costPrice × (qty − returnedQty)" />
                            <PnlRow label="Gross Profit" amount={pnl.revenueAfterReturns - (pnl.adjustedCogs || 0)} bold border formula="Revenue After Returns − COGS" />
                            <PnlRow label="Operating Expenses" amount={expenses.total} negative />
                            {expenses.breakdown.map((e, i) => (
                                <PnlRow key={i} label={e.label} amount={e.amount} indent />
                            ))}
                            <div className={`flex justify-between items-center py-4 -mx-6 px-6 mt-2 rounded-b-xl ${netProfit >= 0 ? 'bg-success-chip/50' : 'bg-destructive-chip/50'}`}>
                                <div>
                                    <span className="font-bold text-lg text-foreground">Net Profit</span>
                                    <span className="text-xs text-muted-foreground ml-2">(Sales Profit - Expenses)</span>
                                </div>
                                <span className={`font-heading text-h3 tabular-nums ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    {fmt(netProfit)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Expense breakdown */}
                    <ChartPanel
                        className="lg:self-start"
                        title="Expenses"
                        description={`${fmt(expenses.total)} approved in this period`}
                        isEmpty={!expenses.breakdown.length}
                        empty={{ title: 'No expenses', description: 'No approved expenses in this period.' }}
                        table={{
                            filename: 'expenses-by-category',
                            columns: [
                                { key: 'label', label: 'Category' },
                                { key: 'count', label: 'Entries', align: 'right' },
                                { key: 'amount', label: 'Amount', align: 'right', format: fmt },
                            ],
                            rows: expenses.breakdown,
                        }}
                    >
                        <DonutChart data={expenses.breakdown.map((e) => ({ label: e.label, value: e.amount, count: e.count }))} format={fmt} countLabel="Entries" height={150} />
                    </ChartPanel>
                </div>

                {/* Sales over time */}
                <ChartPanel
                    className="mb-6"
                    title="Sales over time"
                    description={`${MEASURES.find((m) => m.value === measure)?.label} by ${timelineGroup} · ${periodLabel}`}
                    controls={
                        <div className="flex flex-wrap items-center gap-2">
                            <SegmentedControl label="Measure" size="xs" value={measure} onChange={setMeasure} options={MEASURES} />
                            <SegmentedControl
                                label="Group by"
                                size="xs"
                                value={timelineGroup}
                                onChange={setTimelineGroup}
                                options={[
                                    { value: 'day', label: 'Day' },
                                    { value: 'week', label: 'Week' },
                                    { value: 'month', label: 'Month' },
                                ]}
                            />
                        </div>
                    }
                    isEmpty={!timeline.length}
                    empty={{ title: 'No sales', description: 'No bills in this period.' }}
                    table={{
                        filename: `sales-by-${timelineGroup}`,
                        columns: [
                            { key: 'label', label: timelineGroup === 'day' ? 'Date' : timelineGroup === 'week' ? 'Week' : 'Month' },
                            { key: 'billCount', label: 'Bills', align: 'right' },
                            { key: 'totalSales', label: 'Revenue', align: 'right', format: fmt },
                            { key: 'totalProfit', label: 'Profit', align: 'right', format: fmt },
                        ],
                        rows: timelineRows,
                    }}
                >
                    {timelineRows.length > 60 ? (
                        <AreaChart data={timelineRows} yKey={measure} format={measureFmt} axisFormat={axisFmt} tooltipTitle={(d) => d.full} tooltipRows={tooltipRows} height={260} />
                    ) : (
                        <BarChart
                            data={timelineRows}
                            yKey={measure}
                            format={measureFmt}
                            axisFormat={axisFmt}
                            highlight={peak?.label}
                            tooltipTitle={(d) => d.full}
                            tooltipRows={tooltipRows}
                            height={260}
                        />
                    )}
                </ChartPanel>

                {/* Daily breakdown table */}
                {timeline.length > 0 && (
                    <Card>
                        <CardTitle>{timelineGroup === 'day' ? 'Day by day' : timelineGroup === 'week' ? 'Week by week' : 'Month by month'}</CardTitle>
                        <DataTable
                            compact
                            columns={[
                                { key: 'period', label: timelineGroup === 'day' ? 'Date' : timelineGroup === 'week' ? 'Week' : 'Month', render: (r) => r.full },
                                { key: 'billCount', label: 'Bills', align: 'right' },
                                { key: 'totalQty', label: 'Items', align: 'right' },
                                { key: 'totalSales', label: 'Revenue', align: 'right', render: (r) => fmt(r.totalSales) },
                                { key: 'totalDiscount', label: 'Discount', align: 'right', render: (r) => fmt(r.totalDiscount) },
                                { key: 'totalRefunded', label: 'Refunds', align: 'right', render: (r) => fmt(r.totalRefunded) },
                                { key: 'netSales', label: 'Net Sales', align: 'right', render: (r) => fmt(r.netSales) },
                                { key: 'totalProfit', label: 'Profit', align: 'right', render: (r) => (
                                    <span className={r.totalProfit >= 0 ? 'text-success' : 'text-destructive'}>{fmt(r.totalProfit)}</span>
                                )},
                            ]}
                            data={timelineRows.filter((r) => r.billCount)}
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
                <h3 className="font-heading text-h4 text-foreground mb-3">Sales by Product
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
                            <span className={r.totalProfit >= 0 ? 'text-success' : 'text-destructive'}>
                                {fmt(r.totalProfit)}
                            </span>
                        )},
                        { key: 'margin', label: 'Margin', align: 'right', render: (r) => {
                            const margin = r.netRevenue > 0 ? (r.totalProfit / r.netRevenue) * 100 : 0;
                            return <span className={margin >= 0 ? 'text-success' : 'text-destructive'}>{pct(margin)}</span>;
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
                    <h3 className="font-heading text-h4 text-foreground mb-3">Sales by Category
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
                                <span className={r.totalProfit >= 0 ? 'text-success' : 'text-destructive'}>{fmt(r.totalProfit)}</span>
                            )},
                            { key: 'pct', label: '% Share', align: 'right', render: (r) => pct(r.revenuePercentage || (totalRev > 0 ? (r.grossRevenue / totalRev) * 100 : 0)) },
                        ]}
                        data={rows}
                    />
                </Card>

                <ChartPanel
                    title="Revenue share"
                    description="Gross revenue by category"
                    isEmpty={!rows.length}
                    empty={{ title: 'No sales', description: 'No sales in this period.' }}
                >
                    <DonutChart data={rows.map((r) => ({ label: r.category || 'Uncategorized', value: r.grossRevenue || 0 }))} format={fmt} height={160} />
                </ChartPanel>
            </div>
        );
    };

    // ── Payment Methods ──────────────────────────────────────────
    const renderPayments = () => {
        const methods = payments.methods || [];
        const count = methods.reduce((n, m) => n + (m.transactionCount || 0), 0);
        const top = [...methods].sort((x, y) => (y.totalAmount || 0) - (x.totalAmount || 0))[0];
        return (
            <>
                <KpiStrip cols={3} className="mb-6">
                    <StatCard label="Money taken" value={fmt(payments.grandTotal)} />
                    <StatCard label="Payments" value={count.toLocaleString()} sub={count ? `avg ${fmt((payments.grandTotal || 0) / count)}` : null} />
                    <StatCard label="Most used" value={top ? methodLabel(top.method) : '—'} sub={top ? `${pct(top.percentage)} of the money` : null} />
                </KpiStrip>
                <ChartPanel
                    title="Payment methods"
                    description="How customers paid in this period"
                    isEmpty={!methods.length}
                    empty={{ title: 'No payments', description: 'No payments in this period.' }}
                    table={{
                        filename: 'payment-methods',
                        columns: [
                            { key: 'method', label: 'Method', format: methodLabel },
                            { key: 'transactionCount', label: 'Payments', align: 'right' },
                            { key: 'totalAmount', label: 'Amount', align: 'right', format: fmt },
                            { key: 'percentage', label: 'Share', align: 'right', format: pct },
                        ],
                        rows: methods,
                    }}
                >
                    <DonutChart data={methods.map((m) => ({ label: methodLabel(m.method), value: m.totalAmount || 0, count: m.transactionCount }))} format={fmt} countLabel="Payments" height={180} />
                </ChartPanel>
            </>
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
                        <h3 className="font-heading text-h4 text-foreground mb-3">Tax by Rate</h3>
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
                        <h3 className="font-heading text-h4 text-foreground mb-3">Tax by Category</h3>
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
                    <ChartPanel className="lg:self-start" title="Returns by reason" description="How many returns gave each reason" isEmpty={!byReason.length} empty={{ title: 'No returns', description: 'No returns in this period.' }}>
                        <HorizontalBarChart data={byReason.map((r) => ({ key: r._id || 'unknown', label: (r._id || 'unknown').replace(/_/g, ' '), value: r.count || 0 }))} format={(v) => `${v} return${v === 1 ? '' : 's'}`} />
                    </ChartPanel>

                    <Card>
                        <h3 className="font-heading text-h4 text-foreground mb-3">Most Returned Products</h3>
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
                        <h3 className="font-heading text-h4 text-foreground mb-3">Discounts by Cashier</h3>
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
                        <h3 className="font-heading text-h4 text-foreground mb-3">Recent Discounted Bills</h3>
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
                <PageSkeleton variant="report" bare />
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
        <div className="p-6 animate-fadeIn min-h-full h-full overflow-auto">
            {/* Header */}
            <PageHeader
                title="Reports"
                subtitle={`${TABS.find((t) => t.key === tab)?.label} — ${periodLabel}`}
                actions={
                    <>
                        <IconButton label="Refresh" variant="outline" onClick={fetchData}>
                            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                        </IconButton>
                        <Button onClick={fetchAllAndShowReport} loading={detailedLoading} disabled={detailedLoading}>
                            <FiFileText aria-hidden="true" />
                            Detailed report
                        </Button>
                    </>
                }
            />

            {loadError ? (
                <StateCard kind="error" onRetry={fetchData} className="mb-5" title="Couldn't load this report">
                    {loadError} The figures below may be out of date.
                </StateCard>
            ) : null}

            {/* Period + sections */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <Tabs
                    label="Report sections"
                    value={tab}
                    onChange={setTab}
                    items={TABS.map((t) => ({ value: t.key, label: t.label }))}
                />
                <div className="flex flex-wrap items-end gap-2 pb-1.5">
                    {timeFilter === 'custom' && (
                        <>
                            <Field label="From">
                                <Input type="date" size="xs" className="w-[150px]" value={customStart} max={customEnd || undefined} onChange={(e) => setCustomStart(e.target.value)} />
                            </Field>
                            <Field label="To">
                                <Input type="date" size="xs" className="w-[150px]" value={customEnd} min={customStart || undefined} onChange={(e) => setCustomEnd(e.target.value)} />
                            </Field>
                        </>
                    )}
                    <SegmentedControl
                        label="Period"
                        value={timeFilter}
                        onChange={(k) => {
                            setTimeFilter(k);
                            setGroupChoice(null);
                        }}
                        options={TIME_FILTERS.map((f) => ({ value: f.key, label: f.label }))}
                    />
                </div>
            </div>

            {/* Tab Content */}
            {renderContent()}
        </div>
    );
};

export default Reports;
