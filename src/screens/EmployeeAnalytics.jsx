import React, { useState, useEffect, useMemo } from 'react';
import { toLocalDateStr } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getReceiptStats, getTopProducts } from '../services/api/receipts';
import { getSalesByCashier } from '../services/api/bills';
import {
    FiTrendingUp,
    FiShoppingCart,
    FiDollarSign,
    FiArrowUp,
    FiArrowDown,
    FiCalendar,
    FiAward,
    FiActivity,
    FiPackage,
} from 'react-icons/fi';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

const EmployeeAnalytics = () => {
    const { user } = useAuth();
    const { business } = useBusiness();
    const currency = business?.currency || 'Rs.';

    const [timeFilter, setTimeFilter] = useState('today');
    const [stats, setStats] = useState({ grossRevenue: 0, totalOrders: 0, avgOrderValue: 0, growth: 0 });
    const [chartData, setChartData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [myStats, setMyStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchData();
    }, [timeFilter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            let startDate = new Date();
            switch (timeFilter) {
                case 'today': startDate.setHours(0, 0, 0, 0); break;
                case 'week': startDate.setDate(now.getDate() - 7); break;
                case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            }
            const dateParams = { startDate: startDate.toISOString(), endDate: now.toISOString() };

            const [statsRes, topRes, cashierRes] = await Promise.all([
                getReceiptStats({ filter: timeFilter, chart: 'true' }),
                getTopProducts(5).catch(() => ({ data: [] })),
                getSalesByCashier(dateParams).catch(() => ({ data: { cashiers: [] } })),
            ]);

            const s = statsRes.data;
            setStats({
                grossRevenue: s.grossRevenue || 0,
                totalOrders: s.totalOrders || 0,
                avgOrderValue: s.avgOrderValue || 0,
                growth: s.growth || 0,
            });

            setTopProducts(Array.isArray(topRes.data) ? topRes.data : []);

            // Find this employee's stats from cashier data
            const cashiers = cashierRes.data?.cashiers || [];
            const me = cashiers.find(c =>
                c.cashierId === user?._id || c.cashierName === user?.name
            );
            setMyStats(me || null);

            // Build chart
            buildChart(s.chartData || [], startDate, now, timeFilter);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const buildChart = (chartItems, startDate, _endDate, filter) => {
        const dataMap = {};
        chartItems.forEach(item => {
            dataMap[item._id] = { revenue: item.revenue, orders: item.orders };
        });

        const data = [];
        if (filter === 'today') {
            for (let h = 0; h < 24; h++) {
                data.push({
                    name: `${h}:00`,
                    sales: dataMap[h]?.revenue || 0,
                    orders: dataMap[h]?.orders || 0,
                });
            }
        } else if (filter === 'week') {
            for (let i = 0; i < 7; i++) {
                const day = new Date(startDate);
                day.setDate(startDate.getDate() + i);
                const key = toLocalDateStr(day);
                const dayName = day.toLocaleDateString('en', { weekday: 'short' });
                data.push({
                    name: dayName,
                    sales: dataMap[key]?.revenue || 0,
                    orders: dataMap[key]?.orders || 0,
                });
            }
        } else {
            for (let w = 0; w < 5; w++) {
                const ws = new Date(startDate);
                ws.setDate(startDate.getDate() + w * 7);
                const we = new Date(ws);
                we.setDate(ws.getDate() + 7);
                let weekSales = 0, weekOrders = 0;
                Object.entries(dataMap).forEach(([key, val]) => {
                    const d = new Date(key);
                    if (d >= ws && d < we) { weekSales += val.revenue; weekOrders += val.orders; }
                });
                data.push({ name: `W${w + 1}`, sales: weekSales, orders: weekOrders });
            }
        }
        setChartData(data);
    };

    const fmt = (n) => (n || 0).toLocaleString();
    const fmtShort = (n) => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return (n || 0).toLocaleString();
    };

    const greeting = useMemo(() => {
        const h = currentTime.getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, [currentTime]);

    const target = 5000;
    const progressPercent = Math.min(100, (stats.grossRevenue / target) * 100);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-d-bg p-6 animate-fade-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                        {greeting}, {user?.name || 'Staff'}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-d-muted mt-1">
                        {currentTime.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* Time Filter */}
                <div className="flex gap-1 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl p-1">
                    {[
                        { key: 'today', label: 'Today' },
                        { key: 'week', label: 'Week' },
                        { key: 'month', label: 'Month' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setTimeFilter(f.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                timeFilter === f.key
                                    ? 'bg-amber-100 dark:bg-[rgba(255,210,100,0.12)] text-amber-700 dark:text-d-accent'
                                    : 'text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Revenue */}
                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-[rgba(52,232,161,0.1)] flex items-center justify-center">
                            <FiDollarSign className="text-emerald-600 dark:text-d-green" size={20} />
                        </div>
                        {stats.growth !== 0 && (
                            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                                stats.growth >= 0
                                    ? 'text-emerald-700 dark:text-d-green bg-emerald-50 dark:bg-[rgba(52,232,161,0.08)]'
                                    : 'text-red-600 dark:text-d-red bg-red-50 dark:bg-[rgba(255,107,107,0.08)]'
                            }`}>
                                {stats.growth >= 0 ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}
                                {Math.abs(stats.growth).toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{currency} {fmt(stats.grossRevenue)}</p>
                    <p className="text-xs text-slate-500 dark:text-d-muted mt-1">Total Revenue</p>
                </div>

                {/* Orders */}
                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-[rgba(91,156,246,0.1)] flex items-center justify-center">
                            <FiShoppingCart className="text-blue-600 dark:text-d-blue" size={20} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{stats.totalOrders}</p>
                    <p className="text-xs text-slate-500 dark:text-d-muted mt-1">Total Orders</p>
                </div>

                {/* Avg Order Value */}
                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-[rgba(255,210,100,0.1)] flex items-center justify-center">
                            <FiTrendingUp className="text-amber-600 dark:text-d-accent" size={20} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{currency} {fmt(Math.round(stats.avgOrderValue))}</p>
                    <p className="text-xs text-slate-500 dark:text-d-muted mt-1">Avg Order Value</p>
                </div>

                {/* My Sales */}
                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-[rgba(168,130,255,0.1)] flex items-center justify-center">
                            <FiAward className="text-purple-600 dark:text-[#a882ff]" size={20} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                        {myStats ? `${currency} ${fmt(Math.round(myStats.totalRevenue || 0))}` : '-'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-d-muted mt-1">
                        My Sales {myStats ? `(${myStats.totalBills || 0} bills)` : ''}
                    </p>
                </div>
            </div>

            {/* Chart + Target */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-d-text mb-4 flex items-center gap-2">
                        <FiActivity size={16} className="text-slate-400 dark:text-d-muted" />
                        Revenue Trend
                    </h3>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="empRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={fmtShort} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(13,15,23,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        color: '#f0f2f8',
                                    }}
                                    formatter={(v) => [`${currency} ${fmt(v)}`, 'Revenue']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    fill="url(#empRevenueGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Target Progress */}
                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5 flex flex-col">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-d-text mb-4 flex items-center gap-2">
                        <FiCalendar size={16} className="text-slate-400 dark:text-d-muted" />
                        Daily Target
                    </h3>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="relative w-32 h-32 mb-4">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                                <circle
                                    cx="60" cy="60" r="52" fill="none"
                                    stroke={progressPercent >= 100 ? '#34e8a1' : '#f59e0b'}
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    strokeDasharray={`${progressPercent * 3.267} 326.7`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                                    {Math.round(progressPercent)}%
                                </span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-d-text font-medium">
                            {currency} {fmt(stats.grossRevenue)} / {fmt(target)}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-d-muted mt-1">
                            {stats.grossRevenue >= target ? 'Target achieved!' : `${currency} ${fmt(target - stats.grossRevenue)} remaining`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Top Products */}
            {topProducts.length > 0 && (
                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-d-text mb-4 flex items-center gap-2">
                        <FiPackage size={16} className="text-slate-400 dark:text-d-muted" />
                        Top Selling Products
                    </h3>
                    <div className="space-y-3">
                        {topProducts.slice(0, 5).map((p, i) => (
                            <div key={p._id || i} className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-[rgba(255,210,100,0.1)] flex items-center justify-center text-xs font-bold text-amber-700 dark:text-d-accent flex-shrink-0">
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-d-text truncate">{p.name}</p>
                                    <p className="text-xs text-slate-400 dark:text-d-muted">{p.category || 'General'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-d-text">
                                        {currency} {fmt(p.price || p.sellingPrice || 0)}
                                    </p>
                                    {p.totalSold != null && (
                                        <p className="text-xs text-slate-400 dark:text-d-muted">{p.totalSold} sold</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeAnalytics;
