import React, { useMemo, useState } from 'react';
import { FiAlertTriangle, FiArchive, FiChevronRight, FiClock, FiServer, FiTruck, FiUsers } from 'react-icons/fi';
import { cn, SegmentedControl, Stat, BarLineChart, StateCard, EmptyState, HorizontalBarChart, percentChange, todayYmd, parseYmd, ymd, CARD_FRAME } from '../../components/ui';
import { getExpenseStats } from '../../services/api/expenses';
import { getCustomerSummary } from '../../services/api/customers';
import { useSalesInsights, useSummary } from './dashboardData';
import { useFmt } from './InsightWindows';
import { useLoad, TabCard, Figures } from './shopTabKit';

// Dashboard → Overview (owner only): the shop over the last 7 / 30 / 90 / 180 days — headline
// figures, sales + bills per day, what needs attention (each line opens its tab) and the best
// sellers of the period. Reads /v1/dashboard/insights/sales (one call per range).

const RANGES = [7, 30, 90, 180];
const STORE_KEY = 'ds.dashboard.overviewDays';

const readDays = () => {
    try {
        const v = Number(localStorage.getItem(STORE_KEY));
        return RANGES.includes(v) ? v : 30;
    } catch {
        return 30;
    }
};

const lastDays = (n) => {
    const to = todayYmd();
    const d = parseYmd(to);
    d.setDate(d.getDate() - (n - 1));
    return { preset: 'custom', from: ymd(d), to };
};

const longDay = (s) => parseYmd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const AttentionRow = ({ icon: Icon, tone, label, value, onClick }) => (
    <li>
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left shadow-[inset_0_-1px_0_var(--hairline)] hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
            <span
                className={cn(
                    'w-7 h-7 flex-none rounded-lg inline-flex items-center justify-center',
                    tone === 'destructive' ? 'bg-destructive-chip text-destructive-chip-foreground' : tone === 'warning' ? 'bg-warning-chip text-warning-chip-foreground' : 'bg-muted text-muted-foreground'
                )}
            >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0 text-body truncate">{label}</span>
            <span className="flex-none text-body font-medium tabular-nums">{value}</span>
            <FiChevronRight className="w-4 h-4 flex-none text-muted-foreground" aria-hidden="true" />
        </button>
    </li>
);

export default function OverviewTab({ refreshKey = 0, onOpenTab }) {
    const fmt = useFmt();
    const [days, setDaysState] = useState(readDays);
    const setDays = (v) => {
        const n = Number(v);
        setDaysState(n);
        try {
            localStorage.setItem(STORE_KEY, String(n));
        } catch {
            /* per-computer convenience only */
        }
    };
    const period = useMemo(() => lastDays(days), [days]);
    const [retry, setRetry] = useState(0);
    const ins = useSalesInsights(period, { refreshKey: refreshKey + retry });
    // "Needs attention" counts: stock + vendors from the dashboard summary, the rest best effort
    const sum = useSummary('today', { refreshKey });
    const exp = useLoad(() => getExpenseStats().then((r) => r.data).catch(() => null), [refreshKey]);
    const cust = useLoad(() => getCustomerSummary().then((r) => r.data).catch(() => null), [refreshKey]);

    const d = ins.data || {};
    const p = d.previous || {};
    const prevNote = `vs the ${days} days before`;
    const series = useMemo(
        () =>
            (d.series || []).map((r) => {
                const day = parseYmd(r.key);
                return {
                    key: r.key,
                    label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    range: day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
                    sales: r.sales || 0,
                    bills: r.bills || 0,
                };
            }),
        [d.series]
    );
    const daysWithSales = series.filter((r) => r.bills > 0).length;
    const hasProfit = d.profit !== undefined && d.profit !== null;
    const loading = ins.loading && !ins.data;
    const lowStock = sum.data?.lowStock?.length;
    const dead = sum.data?.deadStock?.summary || {};
    const owedVendors = sum.data?.supplyStats?.overall?.totalRemaining;
    const top = d.topProducts || [];

    if (ins.unsupported) {
        return (
            <EmptyState icon={FiServer} title="Overview needs the server update" className={CARD_FRAME}>
                The server doesn't have the sales-insights endpoint yet (backend prompt for Stage 7). The other tabs work meanwhile.
            </EmptyState>
        );
    }

    return (
        <>
            <TabCard
                title={`Last ${days} days`}
                description={`${longDay(period.from)} to ${longDay(period.to)}, Pakistan time.`}
                controls={<SegmentedControl label="Range" size="xs" value={String(days)} onChange={setDays} options={RANGES.map((n) => ({ value: String(n), label: `${n} days` }))} />}
            >
                {ins.error && !ins.data ? (
                    <StateCard kind="error" onRetry={() => setRetry((k) => k + 1)}>
                        {ins.error}
                    </StateCard>
                ) : (
                    <Figures loading={loading} count={8}>
                        <Stat label="Bills" value={(d.bills || 0).toLocaleString()} note={`On ${daysWithSales} of ${days} days`} delta={{ value: percentChange(d.bills, p.bills) }} />
                        <Stat label="Sales" value={fmt.money(d.sales)} delta={{ value: percentChange(d.sales, p.sales), label: prevNote }} />
                        <Stat label="Profit" value={hasProfit ? fmt.money(d.profit) : '—'} note="After returns" tone={hasProfit && d.profit < 0 ? 'destructive' : undefined} delta={hasProfit ? { value: percentChange(d.profit, p.profit) } : undefined} />
                        <Stat label="Cancelled" value={(d.cancelled || 0).toLocaleString()} note="Bills, not counted in sales" />
                        <Stat label="Returns" value={(d.refunds?.count || 0).toLocaleString()} note={`${fmt.money(d.refunds?.amount || 0)} refunded`} />
                        <Stat label="Money taken" value={fmt.money(d.paid)} note="Cash, card and online" delta={{ value: percentChange(d.paid, p.paid) }} />
                        <Stat label="On credit" value={fmt.money(d.creditGiven)} note="Not paid yet" tone={d.creditGiven > 0 ? 'warning' : undefined} />
                        <Stat label="Average bill" value={fmt.money(d.averageBill)} delta={{ value: percentChange(d.averageBill, p.averageBill) }} />
                    </Figures>
                )}
            </TabCard>

            <TabCard title="Sales and bills per day" description="Completed bills, Pakistan time. Cancelled bills aren't counted.">
                {loading ? (
                    <div className="h-[340px]" />
                ) : series.some((r) => r.sales > 0 || r.bills > 0) ? (
                    <BarLineChart
                        data={series}
                        barKey="sales"
                        lineKey="bills"
                        barLabel="Sales"
                        lineLabel="Bills"
                        barFormat={fmt.compact}
                        tooltipTitle={(r) => r.range}
                        tooltipRows={(r) => [
                            ['Sales', fmt.money(r.sales)],
                            ['Bills', r.bills],
                        ]}
                    />
                ) : (
                    <p className="py-10 text-center text-body-sm text-muted-foreground">No sales in the last {days} days.</p>
                )}
            </TabCard>

            <div className="grid gap-4 lg:grid-cols-2 items-start">
                <TabCard title="Needs attention" description="Click a line to open its tab." flush>
                    <ul>
                        <AttentionRow icon={FiAlertTriangle} tone={lowStock ? 'warning' : undefined} label="Low on stock" value={lowStock ?? '—'} onClick={() => onOpenTab?.('products')} />
                        <AttentionRow icon={FiArchive} tone={dead.deadProducts ? 'destructive' : undefined} label={`Not selling · ${fmt.money(dead.totalDeadValue || 0)} at cost`} value={dead.deadProducts ?? '—'} onClick={() => onOpenTab?.('products')} />
                        <AttentionRow icon={FiUsers} tone={cust.data?.totalOutstandingDues ? 'warning' : undefined} label="Customers owe the shop" value={cust.data ? fmt.money(cust.data.totalOutstandingDues) : '—'} onClick={() => onOpenTab?.('customers')} />
                        <AttentionRow icon={FiTruck} tone={owedVendors > 0 ? 'destructive' : undefined} label="Owed to vendors" value={owedVendors == null ? '—' : fmt.money(owedVendors)} onClick={() => onOpenTab?.('vendors')} />
                        <AttentionRow icon={FiClock} tone={exp.data?.pendingCount ? 'warning' : undefined} label="Expenses waiting approval" value={exp.data ? exp.data.pendingCount || 0 : '—'} onClick={() => onOpenTab?.('expenses')} />
                    </ul>
                </TabCard>
                <TabCard title="Best sellers" description={`By sales, last ${days} days.`}>
                    {top.length ? (
                        <HorizontalBarChart data={top.map((t) => ({ key: t.productId || t.name, label: t.name, value: t.sales, note: `${t.qty} sold` }))} format={fmt.money} />
                    ) : (
                        <p className="text-body-sm text-muted-foreground">{loading ? '…' : `Nothing sold in the last ${days} days.`}</p>
                    )}
                </TabCard>
            </div>
        </>
    );
}
