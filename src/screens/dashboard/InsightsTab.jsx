import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiArchive, FiArrowRight, FiChevronRight, FiClock, FiFileText, FiTruck } from 'react-icons/fi';
import { getExpenses } from '../../services/api/expenses';
import { getCheques } from '../../services/api/moneyBook';
import {
    cn,
    SegmentedControl,
    Button,
    KpiCard,
    KpiStrip,
    Stat,
    ChartPanel,
    BarChart,
    DonutChart,
    HorizontalBarChart,
    InsightDrawer,
    periodFor,
    summaryFilterFor,
    StateCard,
    CARD_FRAME,
} from '../../components/ui';
import { useSummary, seriesFromSummary, profitFromSummary } from './dashboardData';
import { useFmt, WINDOWS, WindowBody } from './InsightWindows';

// Dashboard → Insights (design Stage 7): tile strip → sales chart + "needs attention" →
// product panels → people & payments. Every tile and panel opens its side window
// (?tab=insights&insight=…&from=…&to=…&p=…), so the back button closes it and a window can be linked to.

const FILTER_LABEL = { today: 'today', week: 'last 7 days', month: 'this month' };
const PREV_LABEL = { today: 'vs yesterday', week: 'vs the 7 days before', month: 'vs last month' };
const filterToPreset = { today: 'day', week: 'week', month: 'month' };
const TAB = 'insights';

const Panel = ({ title, description, onOpen, openLabel, children, className }) => (
    <section className={cn(CARD_FRAME, 'p-4 flex flex-col min-w-0', className)} aria-label={title}>
        <div className="flex items-start gap-2 mb-3">
            <div className="flex-1 min-w-0">
                <h3 className="font-heading text-h5 text-foreground">{title}</h3>
                {description ? <p className="text-body-sm text-muted-foreground">{description}</p> : null}
            </div>
            {onOpen ? (
                <Button size="xs" variant="ghost" onClick={onOpen} aria-label={openLabel || `Open ${title}`}>
                    Details <FiChevronRight aria-hidden="true" />
                </Button>
            ) : null}
        </div>
        <div className="flex-1 min-h-0 text-body">{children}</div>
    </section>
);

const AttentionRow = ({ icon: Icon, tone, label, value, onClick }) => (
    <li>
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 rounded-row px-2 py-2 text-left hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
            <span
                className={cn(
                    'w-8 h-8 flex-none rounded-lg inline-flex items-center justify-center',
                    tone === 'destructive' ? 'bg-destructive-chip text-destructive-chip-foreground' : tone === 'warning' ? 'bg-warning-chip text-warning-chip-foreground' : 'bg-muted text-muted-foreground'
                )}
            >
                <Icon className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0 text-body truncate">{label}</span>
            <span className="flex-none text-body font-medium tabular-nums">{value}</span>
            <FiChevronRight className="w-4 h-4 flex-none text-muted-foreground" aria-hidden="true" />
        </button>
    </li>
);

export default function InsightsTab({ refreshKey = 0, onOpenTab }) {
    const navigate = useNavigate();
    const fmt = useFmt();
    const [timeFilter, setTimeFilter] = useState('today');
    const [measure, setMeasure] = useState('sales');
    const [now, setNow] = useState(new Date());
    const [retry, setRetry] = useState(0);
    const { data, loading, error } = useSummary(timeFilter, { refreshKey: refreshKey + retry });

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);

    // Things waiting for someone (counts only; best effort)
    const [pending, setPending] = useState({ expenses: null, cheques: null });
    useEffect(() => {
        let live = true;
        Promise.all([
            getExpenses({ page: 1, limit: 1, status: 'pending' }).then((r) => r.data?.total ?? null).catch(() => null),
            data?.moneyBook ? getCheques({ status: 'pending', page: 1, limit: 1 }).then((r) => r.data?.pagination?.total ?? null).catch(() => null) : Promise.resolve(null),
        ]).then(([expenses, cheques]) => live && setPending({ expenses, cheques }));
        return () => {
            live = false;
        };
    }, [refreshKey, !!data?.moneyBook]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── side-window state lives in the URL (next to ?tab=insights) ──
    const [params, setParams] = useSearchParams();
    const insight = params.get('insight');
    const win = WINDOWS[insight];
    const [salesLimited, setSalesLimited] = useState(false);
    const period = useMemo(() => {
        const from = params.get('from');
        const to = params.get('to');
        if (from && to) return { preset: params.get('p') || (from === to ? 'day' : 'custom'), from, to };
        return periodFor(filterToPreset[timeFilter]);
    }, [params, timeFilter]);
    const limited = win?.range === 'summary' || (win?.range === 'insights' && salesLimited);
    const openWindow = (kind) => {
        const p = periodFor(filterToPreset[timeFilter]);
        setParams({ tab: TAB, insight: kind, from: p.from, to: p.to, p: p.preset });
    };
    const setPeriod = (p) => setParams({ tab: TAB, insight, from: p.from, to: p.to, p: p.preset }, { replace: true });
    const closeWindow = () => setParams({ tab: TAB });
    // A limited window can only show today / last 7 days / this month — snap to today otherwise
    useEffect(() => {
        if (win && limited && !summaryFilterFor(period)) setPeriod(periodFor('day'));
    }, [win, limited, period]); // eslint-disable-line react-hooks/exhaustive-deps

    const s = data?.stats || {};
    const pl = profitFromSummary(data);
    const series = useMemo(() => seriesFromSummary(s.chartData, timeFilter), [s.chartData, timeFilter]);
    const peak = [...series].sort((a, b) => b.sales - a.sales).find((d) => d.sales > 0);
    const currentHourLabel = timeFilter === 'today' ? series[now.getHours()]?.label : undefined;
    const lowStock = data?.lowStock || [];
    const dead = data?.deadStock || {};
    const ov = data?.supplyStats?.overall || {};
    const cashiers = [...(data?.salesByCashier || [])].sort((a, b) => b.totalSales - a.totalSales);
    const products = data?.salesByProduct || [];
    const bestMargins = products
        .filter((p) => p.transactionCount >= 2 && p.netRevenue > 0)
        .map((p) => ({ name: p.name, margin: (p.totalProfit / p.netRevenue) * 100, profit: p.totalProfit }))
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 5);
    const top = (data?.topProducts || []).slice(0, 5);
    const methods = (data?.paymentMethods || []).map((m) => ({ label: m.method || m._id || 'other', value: m.totalAmount ?? m.total ?? 0, count: m.transactionCount ?? m.count }));

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body-sm text-muted-foreground">Figures for {FILTER_LABEL[timeFilter]}. Click a tile or “Details” to open its window.</p>
                <SegmentedControl
                    label="Period"
                    size="xs"
                    value={timeFilter}
                    onChange={setTimeFilter}
                    options={[
                        { value: 'today', label: 'Today' },
                        { value: 'week', label: 'Week' },
                        { value: 'month', label: 'Month' },
                    ]}
                />
            </div>

            {error && !data ? (
                <StateCard kind="error" onRetry={() => setRetry((k) => k + 1)}>
                    {error}
                </StateCard>
            ) : (
                <>
                    {/* Tiles */}
                    <KpiStrip cols={5}>
                        <KpiCard label="Revenue" loading={loading && !data} value={fmt.money(s.grossRevenue)} delta={{ value: s.growth, label: PREV_LABEL[timeFilter] }} onClick={() => openWindow('sales')} ariaLabel="Revenue — open the Sales window" />
                        <KpiCard
                            label="Net profit"
                            loading={loading && !data}
                            value={fmt.money(pl.netProfit)}
                            tone={pl.netProfit < 0 ? 'destructive' : pl.netProfit > 0 ? 'success' : undefined}
                            note={`${pl.profitMargin.toFixed(0)}% margin`}
                            onClick={() => openWindow('profit')}
                            ariaLabel="Net profit — open the Profit window"
                        />
                        <KpiCard label="Orders" loading={loading && !data} value={(s.totalOrders || 0).toLocaleString()} note={`avg ${fmt.money(s.avgOrderValue)}`} onClick={() => openWindow('orders')} ariaLabel="Orders — open the Orders window" />
                        <KpiCard
                            label={data?.moneyBook ? 'Money' : 'Cash in hand'}
                            loading={loading && !data}
                            value={fmt.money(data?.moneyBook ? data.moneyBook.total : data?.cashBalance?.balance)}
                            note={data?.moneyBook ? `Cash ${fmt.money(data?.cashBalance?.balance)}` : 'In the drawer'}
                            onClick={() => openWindow('money')}
                            ariaLabel="Money — open the Money window"
                        />
                        <KpiCard
                            label="Costs"
                            loading={loading && !data}
                            value={fmt.money(pl.cogs + pl.returns + pl.expenses)}
                            note={`Goods ${fmt.compact(pl.cogs)} · Returns ${fmt.compact(pl.returns)} · Expenses ${fmt.compact(pl.expenses)}`}
                            onClick={() => openWindow('costs')}
                            ariaLabel="Costs — open the Costs window"
                        />
                    </KpiStrip>

                    {/* Sales chart + needs attention */}
                    <div className="grid gap-4 lg:grid-cols-3">
                        <ChartPanel
                            className="lg:col-span-2"
                            title="Sales"
                            description={
                                peak
                                    ? `${timeFilter === 'today' ? 'By hour' : 'By day'}. Peak: ${peak.range}, ${fmt.money(peak.sales)}, ${peak.bills} bill${peak.bills === 1 ? '' : 's'}.`
                                    : `${timeFilter === 'today' ? 'By hour' : 'By day'}, Pakistan time.`
                            }
                            loading={loading && !data}
                            isEmpty={!series.some((d) => d.sales > 0)}
                            empty={{ title: `No sales ${FILTER_LABEL[timeFilter]}`, description: 'Sales show here as bills are made.' }}
                            controls={
                                <SegmentedControl
                                    label="Measure"
                                    size="xs"
                                    value={measure}
                                    onChange={setMeasure}
                                    options={[
                                        { value: 'sales', label: 'Sales' },
                                        { value: 'bills', label: 'Bills' },
                                    ]}
                                />
                            }
                            table={{
                                filename: `sales-${timeFilter}`,
                                columns: [
                                    { key: 'range', label: timeFilter === 'today' ? 'Hour' : 'Day' },
                                    { key: 'bills', label: 'Bills', align: 'right' },
                                    { key: 'sales', label: 'Sales', align: 'right', format: fmt.money },
                                ],
                                rows: series.filter((d) => d.sales > 0 || d.bills > 0),
                                totals: { bills: series.reduce((a, d) => a + d.bills, 0), sales: series.reduce((a, d) => a + d.sales, 0) },
                            }}
                            footer={
                                <button type="button" onClick={() => openWindow('sales')} className="inline-flex items-center gap-1.5 text-body font-medium text-primary hover:underline">
                                    Open the Sales window <FiArrowRight className="w-4 h-4" aria-hidden="true" />
                                </button>
                            }
                        >
                            <BarChart
                                data={series}
                                yKey={measure}
                                highlight={currentHourLabel || peak?.label}
                                format={measure === 'sales' ? fmt.compact : (v) => v}
                                tooltipTitle={(d) => d.range}
                                tooltipRows={(d) => [
                                    ['Sales', fmt.money(d.sales)],
                                    ['Bills', d.bills],
                                ]}
                                height={250}
                            />
                        </ChartPanel>

                        <Panel title="Needs attention" description="Click a line to see it.">
                            <ul className="flex flex-col gap-0.5">
                                <AttentionRow icon={FiAlertTriangle} tone={lowStock.length ? 'warning' : undefined} label="Low stock" value={lowStock.length} onClick={() => openWindow('lowstock')} />
                                <AttentionRow icon={FiArchive} tone={dead.summary?.deadProducts ? 'destructive' : undefined} label={`Dead stock · ${fmt.compact(dead.summary?.totalDeadValue)}`} value={dead.summary?.deadProducts || 0} onClick={() => openWindow('deadstock')} />
                                <AttentionRow icon={FiClock} tone={pending.expenses ? 'warning' : undefined} label="Expenses waiting approval" value={pending.expenses ?? '—'} onClick={() => onOpenTab?.('expenses')} />
                                {data?.moneyBook ? <AttentionRow icon={FiFileText} tone={pending.cheques ? 'warning' : undefined} label="Cheques not cleared" value={pending.cheques ?? '—'} onClick={() => navigate('/cashbook')} /> : null}
                                <AttentionRow icon={FiTruck} tone={ov.totalRemaining > 0 ? 'warning' : undefined} label="Owed to vendors" value={fmt.compact(ov.totalRemaining)} onClick={() => onOpenTab?.('vendors')} />
                            </ul>
                        </Panel>
                    </div>

                    {/* Products */}
                    <div className="grid gap-4 lg:grid-cols-3">
                        <Panel title="Top sellers" description="All time, by quantity" onOpen={() => openWindow('topsellers')}>
                            {top.length ? (
                                <HorizontalBarChart data={top.map((p) => ({ key: p._id, label: p.name, value: p.totalQtySold, note: fmt.money(p.totalRevenue) }))} format={(v) => `${v} sold`} />
                            ) : (
                                <p className="text-body-sm text-muted-foreground">No sales yet.</p>
                            )}
                        </Panel>
                        <Panel title="Best margins" description={`Sold at least twice, ${FILTER_LABEL[timeFilter]}`} onOpen={() => openWindow('margins')}>
                            {bestMargins.length ? (
                                <ul className="flex flex-col">
                                    {bestMargins.map((p) => (
                                        <li key={p.name} className="flex items-baseline justify-between gap-3 py-1.5 shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none">
                                            <span className="min-w-0 truncate">{p.name}</span>
                                            <span className="flex-none text-body-sm text-muted-foreground tabular-nums">{fmt.money(p.profit)}</span>
                                            <span className="flex-none w-12 text-right font-medium tabular-nums text-success">{p.margin.toFixed(0)}%</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-body-sm text-muted-foreground">Not enough sales {FILTER_LABEL[timeFilter]}.</p>
                            )}
                        </Panel>
                        <Panel title="Payment methods" description={`Money taken ${FILTER_LABEL[timeFilter]}`} onOpen={() => openWindow('payments')}>
                            {methods.length ? <DonutChart data={methods} format={fmt.money} height={120} /> : <p className="text-body-sm text-muted-foreground">No payments {FILTER_LABEL[timeFilter]}.</p>}
                        </Panel>
                    </div>

                    {/* People + stock + supply */}
                    <div className="grid gap-4 lg:grid-cols-3">
                        <Panel title="Employee performance" description={`Sales ${FILTER_LABEL[timeFilter]}`} onOpen={() => openWindow('employees')}>
                            {cashiers.length ? (
                                <HorizontalBarChart data={cashiers.map((c) => ({ key: c.cashierId || c.cashierName, label: c.cashierName, value: c.totalSales, note: `${c.billCount} bills · avg ${fmt.money(c.avgOrderValue)}` }))} format={fmt.money} />
                            ) : (
                                <p className="text-body-sm text-muted-foreground">No sales {FILTER_LABEL[timeFilter]}.</p>
                            )}
                            <p className="mt-3 text-body-sm text-muted-foreground">
                                {data?.employeeCount || 0} employees · {cashiers.length} sold {FILTER_LABEL[timeFilter]}
                            </p>
                        </Panel>
                        <Panel title="Inventory" onOpen={() => onOpenTab?.('products')} openLabel="Open the Products tab">
                            <KpiStrip cols={3} className="!grid-cols-3">
                                <Stat label="Units sold" value={(data?.topProducts || []).reduce((a, p) => a + (p.totalQtySold || 0), 0)} note="all time" />
                                <Stat label="Dead items" value={dead.summary?.deadProducts || 0} tone={dead.summary?.deadProducts ? 'destructive' : undefined} />
                                <Stat label="Low stock" value={lowStock.length} tone={lowStock.length ? 'warning' : undefined} />
                            </KpiStrip>
                        </Panel>
                        <Panel title="Supplies" onOpen={() => onOpenTab?.('vendors')} openLabel="Open the Vendors & supplies tab">
                            <KpiStrip cols={3} className="!grid-cols-3">
                                <Stat label="Supplies" value={ov.count || 0} />
                                <Stat label="Paid" value={fmt.compact(ov.totalPaid)} />
                                <Stat label="Owed" value={fmt.compact(ov.totalRemaining)} tone={ov.totalRemaining > 0 ? 'destructive' : undefined} />
                            </KpiStrip>
                        </Panel>
                    </div>
                </>
            )}

            <InsightDrawer
                open={!!win}
                onClose={closeWindow}
                title={win?.title}
                period={win && win.range !== 'none' ? period : null}
                onPeriodChange={setPeriod}
                limited={limited}
                note={win?.range === 'insights' && salesLimited ? 'Pick any date once the server is updated (backend prompt for Stage 7).' : null}
                reportLink={win?.report ? { to: win.report, label: win.reportLabel } : null}
            >
                {win ? <WindowBody kind={insight} period={period} onLimited={setSalesLimited} /> : null}
            </InsightDrawer>
        </>
    );
}
