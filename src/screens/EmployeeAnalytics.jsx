import React, { useState, useEffect, useMemo } from 'react';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { toLocalDateStr } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getReceiptStats, getTopProducts } from '../services/api/receipts';
import { getSalesByCashier } from '../services/api/bills';
import { FiBarChart2, FiPackage } from 'react-icons/fi';
import { KpiCard, KpiStrip, ChartPanel, BarChart, HorizontalBarChart, SegmentedControl, StateCard } from '../components/ui';

const EmployeeAnalytics = () => {
    const { user } = useAuth();
    const { business } = useBusiness();
    const currency = business?.currency || 'Rs.';

    const [timeFilter, setTimeFilter] = useState('today');
    const [stats, setStats] = useState({ grossRevenue: 0, totalOrders: 0, avgOrderValue: 0, growth: 0 });
    const [chartData, setChartData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [myStats, setMyStats] = useState(null);
    const [canSeeMine, setCanSeeMine] = useState(true); // the by-cashier report needs the Reports permission
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
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
        setLoadError(null);
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
                getSalesByCashier(dateParams).catch(() => null),
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
            setCanSeeMine(!!cashierRes);
            const cashiers = cashierRes?.data?.cashiers || [];
            const myId = String(user?._id || user?.id || '');
            const me = cashiers.find(c => (myId && String(c.cashierId) === myId) || c.cashierName === user?.name);
            setMyStats(me || null);

            // Build chart
            buildChart(s.chartData || [], startDate, now, timeFilter);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            setLoadError(error.response?.data?.message || (!navigator.onLine ? 'You seem to be offline.' : "The server didn't answer."));
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
                    full: `${h}:00 – ${h + 1}:00`,
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
                    full: day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
                    sales: dataMap[key]?.revenue || 0,
                    orders: dataMap[key]?.orders || 0,
                });
            }
        } else {
            // this month, one bar per day up to today
            const today = new Date();
            for (let d = 1; d <= today.getDate(); d++) {
                const day = new Date(today.getFullYear(), today.getMonth(), d);
                const key = toLocalDateStr(day);
                data.push({ name: String(d), full: day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), sales: dataMap[key]?.revenue || 0, orders: dataMap[key]?.orders || 0 });
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
            <PageSkeleton variant="report" cards={4} />
        );
    }

    const money = (n) => `${currency} ${fmt(Math.round(n || 0))}`;
    const share = stats.grossRevenue > 0 && myStats ? ((myStats.totalRevenue || 0) / stats.grossRevenue) * 100 : 0;
    const now = new Date();
    const highlight =
        timeFilter === 'today' ? `${now.getHours()}:00` : timeFilter === 'week' ? now.toLocaleDateString('en', { weekday: 'short' }) : String(now.getDate());
    const periodWord = { today: 'today', week: 'the last 7 days', month: 'this month' }[timeFilter];
    const hasSales = chartData.some((d) => d.sales > 0);
    const busiest = hasSales ? chartData.reduce((b, d) => (d.sales > b.sales ? d : b)) : null;

    return (
        <div className="h-full overflow-y-auto p-6 animate-fade-slide-up">
            <PageHeader
                title={`${greeting}, ${user?.name || 'Staff'}`}
                subtitle={currentTime.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                actions={
                    <SegmentedControl
                        label="Period"
                        value={timeFilter}
                        onChange={setTimeFilter}
                        options={[
                            { value: 'today', label: 'Today' },
                            { value: 'week', label: 'Week' },
                            { value: 'month', label: 'Month' },
                        ]}
                    />
                }
            />

            {loadError ? (
                <StateCard kind="error" className="mb-5" title="Couldn't load the sales figures" onRetry={fetchData}>
                    {loadError}
                </StateCard>
            ) : null}

            <KpiStrip cols={canSeeMine ? 4 : 3} className="mb-5">
                <KpiCard
                    label="Shop sales"
                    value={money(stats.grossRevenue)}
                    note={`all counters, ${periodWord}`}
                    delta={stats.growth ? { value: stats.growth, label: timeFilter === 'today' ? 'vs yesterday' : 'vs before' } : null}
                />
                <KpiCard label="Bills" value={fmt(stats.totalOrders)} note={`avg ${money(stats.avgOrderValue)}`} />
                {canSeeMine ? (
                    <KpiCard
                        label="My sales"
                        value={myStats ? money(myStats.totalRevenue) : money(0)}
                        tone={myStats ? 'accent' : undefined}
                        note={myStats ? `${myStats.totalBills || 0} bill${myStats.totalBills === 1 ? '' : 's'} · ${share.toFixed(0)}% of the shop` : `No bills by you ${periodWord}`}
                    />
                ) : null}
                {timeFilter === 'today' ? (
                    <KpiCard
                        label="Daily target"
                        value={`${Math.round(progressPercent)}%`}
                        tone={progressPercent >= 100 ? 'success' : undefined}
                        note={stats.grossRevenue >= target ? 'Target reached' : `${money(target - stats.grossRevenue)} to go of ${money(target)}`}
                    >
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${progressPercent >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progressPercent}%` }} />
                        </div>
                    </KpiCard>
                ) : (
                    <KpiCard
                        label="Busiest day"
                        value={busiest ? busiest.full || busiest.name : '—'}
                        note={busiest ? `${money(busiest.sales)} · ${fmt(busiest.orders)} bills` : `No sales ${periodWord}`}
                    />
                )}
            </KpiStrip>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartPanel
                    className="lg:col-span-2"
                    title="Sales"
                    description={timeFilter === 'today' ? 'By hour, today' : timeFilter === 'week' ? 'By day, last 7 days' : 'By day, this month'}
                    isEmpty={!hasSales}
                    empty={{ icon: FiBarChart2, title: 'No sales yet', description: `Nothing sold ${periodWord}.` }}
                    table={{
                        filename: `sales-${timeFilter}`,
                        columns: [
                            { key: 'full', label: timeFilter === 'today' ? 'Hour' : 'Day' },
                            { key: 'orders', label: 'Bills', align: 'right' },
                            { key: 'sales', label: 'Sales', align: 'right', format: money },
                        ],
                        rows: chartData.filter((d) => d.sales || d.orders),
                    }}
                >
                    <BarChart
                        data={chartData}
                        xKey="name"
                        yKey="sales"
                        highlight={highlight}
                        format={money}
                        axisFormat={fmtShort}
                        tooltipTitle={(d) => d.full || d.name}
                        tooltipRows={(d) => [
                            ['Sales', money(d.sales)],
                            ['Bills', fmt(d.orders)],
                        ]}
                        height={240}
                    />
                </ChartPanel>

                <ChartPanel
                    title="Top sellers"
                    description="Best-selling products in the shop, all time"
                    isEmpty={!topProducts.length}
                    empty={{ icon: FiPackage, title: 'No sales yet', description: 'Top products show here once things sell.' }}
                >
                    <HorizontalBarChart
                        data={topProducts.slice(0, 5).map((p, i) => ({
                            key: p._id || i,
                            label: p.name,
                            value: Number(p.totalQtySold ?? p.totalSold) || 0,
                            note: `${p.category || 'General'} · ${money(p.totalRevenue ?? 0)} sold`,
                        }))}
                        format={(v) => `${fmt(v)} units`}
                    />
                </ChartPanel>
            </div>
        </div>
    );
};

export default EmployeeAnalytics;
