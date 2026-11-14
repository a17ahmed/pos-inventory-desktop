import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiInbox, FiPackage, FiArchive, FiUsers, FiTrendingUp } from 'react-icons/fi';
import { useBusiness } from '../../context/BusinessContext';
import { getReceipts } from '../../services/api/receipts';
import { getExpenses } from '../../services/api/expenses';
import {
    cn,
    KpiStrip,
    Stat,
    percentChange,
    ChartPanel,
    BarChart,
    DonutChart,
    HorizontalBarChart,
    SegmentedControl,
    DrawerSection,
    DataTable,
    Dash,
    StatusChip,
    Alert,
    Skeleton,
    summaryFilterFor,
    daysBetween,
    parseYmd,
} from '../../components/ui';
import { formatAmount, formatCompact } from '../../utils/money';
import { useSummary, useSalesInsights, seriesFromSummary, profitFromSummary, hourLabel, hourRange } from './dashboardData';

// The drill-down windows (design/06-charts.md §3). Each one is the body of an InsightDrawer.
// Windows marked "summary" read the existing /v1/dashboard/summary (today / last 7 days / this month).
// The Sales window reads the new insights endpoint and falls back to the summary on older servers.

export const useFmt = () => {
    const { business } = useBusiness();
    const currency = business?.currency || 'PKR';
    return useMemo(
        () => ({
            money: (v) => formatAmount(v, { currency }),
            compact: (v) => formatCompact(v, { currency }),
            currency,
        }),
        [currency]
    );
};

const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : '—');
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
const pct = (v) => `${(Number(v) || 0).toFixed(1)}%`;

const Loading = () => (
    <div className="px-5 py-4 flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-32 w-full" />
    </div>
);
const ErrorNote = ({ children }) => (
    <div className="px-5 py-4">
        <Alert tone="destructive">{children}</Alert>
    </div>
);

/** Sales | Bills chart over the period. series: [{ key, label, range, sales, bills }] */
function SalesChart({ series, fmt, bucket, peak }) {
    const [measure, setMeasure] = useState('sales');
    const yKey = measure === 'sales' ? 'sales' : 'bills';
    const peakRow = peak || [...series].sort((a, b) => b.sales - a.sales).find((d) => d.sales > 0);
    const empty = !series.some((d) => d.sales > 0 || d.bills > 0);
    return (
        <ChartPanel
            flat
            title={bucket === 'hour' ? 'By hour' : 'By day'}
            description={
                peakRow && !empty
                    ? `Peak: ${peakRow.range || peakRow.label}, ${fmt.money(peakRow.sales)}, ${peakRow.bills} bill${peakRow.bills === 1 ? '' : 's'}`
                    : 'When the bills were made, Pakistan time.'
            }
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
            isEmpty={empty}
            empty={{ icon: FiInbox, title: 'No sales in this period', description: 'Pick another date.' }}
            table={{
                filename: 'sales',
                columns: [
                    { key: 'range', label: bucket === 'hour' ? 'Hour' : 'Day' },
                    { key: 'bills', label: 'Bills', align: 'right' },
                    { key: 'sales', label: 'Sales', align: 'right', format: fmt.money },
                ],
                rows: series.filter((d) => d.sales > 0 || d.bills > 0).map((d) => ({ ...d, range: d.range || d.label })),
                totals: { bills: series.reduce((s, d) => s + d.bills, 0), sales: series.reduce((s, d) => s + d.sales, 0) },
            }}
        >
            <BarChart
                data={series}
                xKey="label"
                yKey={yKey}
                highlight={peakRow?.label}
                format={measure === 'sales' ? fmt.compact : (v) => v}
                tooltipTitle={(d) => d.range || d.label}
                tooltipRows={(d) => [
                    ['Sales', fmt.money(d.sales)],
                    ['Bills', d.bills],
                ]}
            />
        </ChartPanel>
    );
}

const methodsDonut = (rows) =>
    rows.map((m) => ({
        label: String(m.method || m._id || 'other').replace(/_/g, ' '),
        value: Number(m.amount ?? m.totalAmount ?? m.total ?? 0),
        count: m.payments ?? m.transactionCount ?? m.count ?? m.billCount,
    }));

// ───────────────────────────── Sales ─────────────────────────────

export function SalesWindow({ period, onLimited }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    const ins = useSalesInsights(period);
    const filter = summaryFilterFor(period) || 'today';
    const sum = useSummary(filter, { enabled: ins.unsupported });
    // Tell the window frame when only today / week / month can be shown (older server)
    useEffect(() => {
        onLimited?.(!!ins.unsupported);
    }, [ins.unsupported, onLimited]);

    if (ins.loading || (ins.unsupported && sum.loading)) return <Loading />;
    if (ins.error) return <ErrorNote>{ins.error}</ErrorNote>;

    if (ins.unsupported) {
        if (sum.error) return <ErrorNote>{sum.error}</ErrorNote>;
        const d = sum.data || {};
        const s = d.stats || {};
        const series = seriesFromSummary(s.chartData, filter);
        const prevNote = filter === 'today' ? 'vs yesterday' : filter === 'week' ? 'vs the week before' : 'vs last month';
        return (
            <>
                <DrawerSection>
                    <KpiStrip cols={3} className="gap-y-4">
                        <Stat label="Sales" value={fmt.money(s.grossRevenue)} delta={{ value: s.growth, label: prevNote }} />
                        <Stat label="Bills" value={s.totalOrders || 0} note="Completed" />
                        <Stat label="Average bill" value={fmt.money(s.avgOrderValue)} />
                        <Stat label="Items sold" value={(s.totalItems || 0).toLocaleString()} />
                        <Stat label="Discount given" value={fmt.money(s.totalDiscount)} />
                        <Stat label="Refunds" value={fmt.money(s.totalRefunded)} tone={s.totalRefunded > 0 ? 'destructive' : undefined} />
                    </KpiStrip>
                </DrawerSection>
                <DrawerSection>
                    <SalesChart series={series} fmt={fmt} bucket={filter === 'today' ? 'hour' : 'day'} />
                </DrawerSection>
                <CashierAndMethods cashiers={(d.salesByCashier || []).map((c) => ({ key: c.cashierId || c.cashierName, label: c.cashierName, value: c.totalSales, note: `${c.billCount} bills` }))} methods={methodsDonut(d.paymentMethods || [])} fmt={fmt} onCashier={() => navigate('/employees')} />
                <TopProductsSection rows={(d.salesByProduct || []).map((p) => ({ name: p.name, qty: p.netQtySold ?? p.totalQtySold, sales: p.netRevenue }))} fmt={fmt} />
            </>
        );
    }

    // New endpoint
    const d = ins.data || {};
    const p = d.previous || {};
    const days = daysBetween(period.from, period.to);
    const prevNote = days === 1 ? 'vs day before' : `vs previous ${days} days`;
    const series = (d.series || []).map((r) => ({
        ...r,
        label: d.bucket === 'hour' ? hourLabel(Number(r.key)) : r.label || parseYmd(r.key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        range: d.bucket === 'hour' ? hourRange(Number(r.key)) : parseYmd(r.key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
        sales: r.sales || 0,
        bills: r.bills || 0,
    }));
    const peak = d.peak ? series.find((r) => String(r.key) === String(d.peak.key)) : null;
    const hasProfit = d.profit !== undefined && d.profit !== null;
    return (
        <>
            <DrawerSection>
                <KpiStrip cols={4} className="gap-y-4">
                    <Stat label="Bills" value={d.bills || 0} note={`Completed. Also ${d.cancelled || 0} cancelled, ${d.onHold || 0} on hold`} delta={{ value: percentChange(d.bills, p.bills), label: prevNote }} />
                    <Stat label="Sales" value={fmt.money(d.sales)} delta={{ value: percentChange(d.sales, p.sales), label: prevNote }} />
                    <Stat label="Paid" value={fmt.money(d.paid)} note="Money taken in this period" delta={{ value: percentChange(d.paid, p.paid) }} />
                    <Stat label="On credit" value={fmt.money(d.creditGiven)} note="Not paid yet" tone={d.creditGiven > 0 ? 'warning' : undefined} />
                    {hasProfit ? <Stat label="Profit" value={fmt.money(d.profit)} note="After returns" tone={d.profit < 0 ? 'destructive' : 'success'} delta={{ value: percentChange(d.profit, p.profit) }} /> : null}
                    <Stat label="Discount given" value={fmt.money(d.discount)} delta={{ value: percentChange(d.discount, p.discount), goodWhen: 'down' }} />
                    <Stat label="Items sold" value={(d.itemsSold || 0).toLocaleString()} delta={{ value: percentChange(d.itemsSold, p.itemsSold) }} />
                    <Stat label="With a customer" value={`${d.billsWithCustomer || 0} of ${d.bills || 0}`} note="bills" />
                    <Stat label="Average bill" value={fmt.money(d.averageBill)} delta={{ value: percentChange(d.averageBill, p.averageBill) }} />
                    <Stat
                        label="Biggest bill"
                        value={d.largestBill ? fmt.money(d.largestBill.total) : <Dash />}
                        note={d.largestBill ? `#${d.largestBill.billNumber} · ${time(d.largestBill.createdAt)}` : undefined}
                    />
                    <Stat label="First bill" value={time(d.firstBillAt)} />
                    <Stat label="Last bill" value={time(d.lastBillAt)} />
                </KpiStrip>
                {d.refunds?.count ? (
                    <p className="mt-3 text-body-sm text-muted-foreground">
                        Returns in this period: {d.refunds.count} · {fmt.money(d.refunds.amount)}
                    </p>
                ) : null}
            </DrawerSection>
            <DrawerSection>
                <SalesChart series={series} fmt={fmt} bucket={d.bucket} peak={peak} />
            </DrawerSection>
            <CashierAndMethods
                cashiers={(d.byCashier || []).map((c) => ({ key: c.cashier, label: c.cashier, value: c.sales, note: `${c.bills} bills` }))}
                methods={methodsDonut(d.byPaymentMethod || [])}
                accounts={d.byAccount ? d.byAccount.map((a) => ({ label: a.name, value: a.amount, count: a.count })) : null}
                fmt={fmt}
                onCashier={() => navigate('/employees')}
            />
            <DrawerSection title="Biggest bills">
                <BillsTable rows={d.topBills || []} fmt={fmt} empty="No bills in this period." />
            </DrawerSection>
            {d.billSizeSpread?.some((b) => b.count) ? (
                <DrawerSection title="Bill sizes">
                    <HorizontalBarChart
                        data={d.billSizeSpread.map((b) => ({
                            key: b.key,
                            label: b.label,
                            value: b.count,
                            note: d.bills ? `${Math.round((b.count / d.bills) * 100)}% of bills` : null,
                        }))}
                        format={(v) => `${v} bill${v === 1 ? '' : 's'}`}
                    />
                </DrawerSection>
            ) : null}
            <TopProductsSection rows={(d.topProducts || []).map((t) => ({ name: t.name, qty: t.qty, sales: t.sales }))} fmt={fmt} />
        </>
    );
}

function CashierAndMethods({ cashiers, methods, accounts, fmt, onCashier }) {
    const [view, setView] = useState('method');
    return (
        <div className="grid gap-0 lg:grid-cols-2 lg:divide-x divide-hairline">
            <DrawerSection title="Sales by cashier">
                {cashiers.length ? <HorizontalBarChart data={cashiers} format={fmt.money} onSelect={onCashier} /> : <p className="text-body-sm text-muted-foreground">No sales.</p>}
            </DrawerSection>
            <DrawerSection
                title="Payment methods"
                actions={
                    accounts ? (
                        <SegmentedControl
                            label="Group payments by"
                            size="xs"
                            value={view}
                            onChange={setView}
                            options={[
                                { value: 'method', label: 'Method' },
                                { value: 'account', label: 'Account' },
                            ]}
                        />
                    ) : null
                }
            >
                {(view === 'account' && accounts ? accounts : methods).length ? (
                    <DonutChart data={view === 'account' && accounts ? accounts : methods} format={fmt.money} height={140} />
                ) : (
                    <p className="text-body-sm text-muted-foreground">No payments.</p>
                )}
            </DrawerSection>
        </div>
    );
}

function TopProductsSection({ rows, fmt }) {
    const top = [...rows].sort((a, b) => (b.sales || 0) - (a.sales || 0)).slice(0, 5);
    return (
        <DrawerSection title="Top products">
            {top.length ? (
                <HorizontalBarChart data={top.map((t) => ({ key: t.name, label: t.name, value: t.sales, note: `${t.qty ?? 0} sold` }))} format={fmt.money} />
            ) : (
                <p className="text-body-sm text-muted-foreground">No products sold.</p>
            )}
        </DrawerSection>
    );
}

function BillsTable({ rows, fmt, empty }) {
    if (!rows.length) return <p className="text-body-sm text-muted-foreground">{empty}</p>;
    return (
        <div className="-mx-1">
            <DataTable
                caption="Bills"
                maxHeight={null}
                data={rows}
                getRowId={(b) => String(b.billId || b._id || b.billNumber)}
                columns={[
                    { id: 'n', header: 'Bill', accessorFn: (b) => b.billNumber, meta: { mono: true }, cell: ({ getValue }) => `#${getValue()}` },
                    { id: 't', header: 'Time', accessorFn: (b) => b.createdAt, cell: ({ getValue }) => <span className="text-muted-foreground whitespace-nowrap">{dateTime(getValue())}</span> },
                    { id: 'c', header: 'Customer', accessorFn: (b) => b.customerName || '', cell: ({ getValue }) => getValue() || <span className="text-muted-foreground">Walk-in</span> },
                    { id: 'k', header: 'Cashier', accessorFn: (b) => b.cashierName || '', cell: ({ getValue }) => getValue() || <Dash /> },
                    { id: 'v', header: 'Total', accessorFn: (b) => Number(b.total ?? b.totalBill) || 0, meta: { align: 'right' }, cell: ({ getValue }) => <span className="font-medium">{fmt.money(getValue())}</span> },
                ]}
            />
        </div>
    );
}

// ───────────────────────────── Profit (summary) ─────────────────────────────

export function ProfitWindow({ period }) {
    const fmt = useFmt();
    const filter = summaryFilterFor(period) || 'today';
    const { data, loading, error } = useSummary(filter);
    if (loading) return <Loading />;
    if (error) return <ErrorNote>{error}</ErrorNote>;
    const pl = profitFromSummary(data);
    const products = (data?.salesByProduct || [])
        .filter((p) => (p.netRevenue || 0) > 0)
        .map((p) => ({ name: p.name, sales: p.netRevenue, profit: p.totalProfit, qty: p.netQtySold ?? p.totalQtySold, margin: (p.totalProfit / p.netRevenue) * 100 }));
    const best = [...products].sort((a, b) => b.margin - a.margin).slice(0, 5);
    const worst = [...products].sort((a, b) => a.margin - b.margin).slice(0, 5);
    const belowCost = products.filter((p) => p.profit < 0);
    const lines = [
        ['Gross revenue', pl.grossRevenue, ''],
        ['Bill returns', -pl.linkedReturns, '−', true],
        ['Standalone refunds', -pl.standaloneRefunds, '−', true],
        ['Net revenue', pl.netRevenue, '='],
        ['Cost of goods', -pl.cogs, '−'],
        ['Gross profit', pl.grossProfit, '='],
        ['Expenses', -pl.expenses, '−'],
        ['Net profit', pl.netProfit, '=', false, true],
    ];
    return (
        <>
            <DrawerSection>
                <KpiStrip cols={4} className="gap-y-4">
                    <Stat label="Net sales" value={fmt.money(pl.netRevenue)} />
                    <Stat label="Cost of goods" value={fmt.money(pl.cogs)} />
                    <Stat label="Gross profit" value={fmt.money(pl.grossProfit)} note={`${pct(pl.grossMargin)} margin`} />
                    <Stat label="Net profit" value={fmt.money(pl.netProfit)} note={`${pct(pl.profitMargin)} margin`} tone={pl.netProfit < 0 ? 'destructive' : 'success'} />
                    <Stat label="Expenses" value={fmt.money(pl.expenses)} />
                    <Stat label="Returns" value={fmt.money(pl.returns)} />
                    <Stat label="Discounts" value={fmt.money(pl.discount)} />
                </KpiStrip>
            </DrawerSection>
            <DrawerSection title="How net profit is worked out">
                <table className="w-full border-collapse text-body">
                    <tbody>
                        {lines.map(([label, v, sign, sub, bold]) => (
                            <tr key={label} className={cn('shadow-[inset_0_-1px_0_var(--hairline)]', bold && 'font-semibold shadow-none')}>
                                <td className={cn('py-1.5 w-6 font-mono text-muted-foreground', sub && 'pl-4')}>{sign}</td>
                                <td className={cn('py-1.5', sub && 'pl-4 text-muted-foreground text-body-sm')}>{label}</td>
                                <td className={cn('py-1.5 text-right tabular-nums', v < 0 && !bold && 'text-destructive', bold && (v < 0 ? 'text-destructive' : 'text-success'))}>{fmt.money(Math.abs(v))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="mt-2 text-body-sm text-muted-foreground">Revenue − returns − cost of goods − expenses = net profit.</p>
            </DrawerSection>
            {belowCost.length > 0 && (
                <DrawerSection>
                    <Alert tone="warning" title={`${belowCost.length} product${belowCost.length === 1 ? '' : 's'} sold below cost`}>
                        {belowCost.map((p) => `${p.name} (${fmt.money(p.profit)})`).join(' · ')}
                    </Alert>
                </DrawerSection>
            )}
            <div className="grid lg:grid-cols-2 lg:divide-x divide-hairline">
                <DrawerSection title="Best margins">
                    <MarginList rows={best} fmt={fmt} />
                </DrawerSection>
                <DrawerSection title="Lowest margins">
                    <MarginList rows={worst} fmt={fmt} />
                </DrawerSection>
            </div>
        </>
    );
}

const MarginList = ({ rows, fmt }) =>
    rows.length ? (
        <ul className="flex flex-col">
            {rows.map((p) => (
                <li key={p.name} className="flex items-baseline justify-between gap-3 py-1.5 shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="flex-none text-body-sm text-muted-foreground tabular-nums">{fmt.money(p.profit)}</span>
                    <span className={cn('flex-none w-14 text-right font-medium tabular-nums', p.margin < 0 ? 'text-destructive' : 'text-success')}>{pct(p.margin)}</span>
                </li>
            ))}
        </ul>
    ) : (
        <p className="text-body-sm text-muted-foreground">No products sold.</p>
    );

// ───────────────────────────── Orders (summary + latest bills) ─────────────────────────────

export function OrdersWindow({ period }) {
    const fmt = useFmt();
    const filter = summaryFilterFor(period) || 'today';
    const { data, loading, error } = useSummary(filter);
    const [bills, setBills] = useState({ rows: [], loading: true });
    useEffect(() => {
        let live = true;
        setBills({ rows: [], loading: true });
        getReceipts({ page: 1, limit: 10, startDate: period.from, endDate: period.to })
            .then((res) => live && setBills({ rows: res.data?.receipts || res.data || [], loading: false }))
            .catch(() => live && setBills({ rows: [], loading: false }));
        return () => {
            live = false;
        };
    }, [period.from, period.to]);
    if (loading) return <Loading />;
    if (error) return <ErrorNote>{error}</ErrorNote>;
    const s = data?.stats || {};
    const series = seriesFromSummary(s.chartData, filter);
    return (
        <>
            <DrawerSection>
                <KpiStrip cols={4} className="gap-y-4">
                    <Stat label="Bills" value={s.totalOrders || 0} />
                    <Stat label="Average bill" value={fmt.money(s.avgOrderValue)} />
                    <Stat label="Items per bill" value={s.totalOrders ? ((s.totalItems || 0) / s.totalOrders).toFixed(1) : '0'} />
                    <Stat label="Returns" value={fmt.money(s.totalRefunded)} tone={s.totalRefunded > 0 ? 'destructive' : undefined} />
                </KpiStrip>
            </DrawerSection>
            <DrawerSection>
                <SalesChart series={series} fmt={fmt} bucket={filter === 'today' ? 'hour' : 'day'} />
            </DrawerSection>
            <DrawerSection title="Latest bills">
                {bills.loading ? (
                    <Skeleton className="h-32 w-full" />
                ) : (
                    <BillsTable rows={bills.rows.map((b) => ({ ...b, billNumber: b.billNumber || b.receiptNumber, total: b.total ?? b.totalBill }))} fmt={fmt} empty="No bills in this period." />
                )}
            </DrawerSection>
        </>
    );
}

// ───────────────────────────── Money (not period-based) ─────────────────────────────

export function MoneyWindow() {
    const fmt = useFmt();
    const navigate = useNavigate();
    const { data, loading, error } = useSummary('today');
    if (loading) return <Loading />;
    if (error) return <ErrorNote>{error}</ErrorNote>;
    const mb = data?.moneyBook;
    const cash = data?.cashBalance || {};
    return (
        <>
            <DrawerSection>
                <KpiStrip cols={3} className="gap-y-4">
                    <Stat label="Cash in hand" value={fmt.money(cash.balance)} />
                    {mb ? <Stat label="Total money" value={fmt.money(mb.total)} tone={mb.total < 0 ? 'destructive' : undefined} /> : null}
                    <Stat label="Cash in today" value={fmt.money(cash.today?.totalIn)} tone="success" />
                    <Stat label="Cash out today" value={fmt.money(cash.today?.totalOut)} tone={cash.today?.totalOut > 0 ? 'destructive' : undefined} />
                </KpiStrip>
            </DrawerSection>
            {mb ? (
                <DrawerSection title="Balance by account">
                    <HorizontalBarChart
                        data={(mb.accounts || []).map((a) => ({ key: a._id, label: a.name, value: a.balance, note: a.type }))}
                        format={fmt.money}
                        onSelect={() => navigate('/cashbook')}
                    />
                </DrawerSection>
            ) : (
                <DrawerSection>
                    <p className="text-body-sm text-muted-foreground">Turn on the Money Book to see bank and wallet balances here.</p>
                </DrawerSection>
            )}
        </>
    );
}

// ───────────────────────────── Costs (summary + expenses) ─────────────────────────────

export function CostsWindow({ period }) {
    const fmt = useFmt();
    const filter = summaryFilterFor(period) || 'today';
    const { data, loading, error } = useSummary(filter);
    const [exp, setExp] = useState({ rows: [], pending: 0, loading: true });
    useEffect(() => {
        let live = true;
        Promise.all([
            getExpenses({ page: 1, limit: 100, status: 'approved', startDate: period.from, endDate: period.to }).catch(() => null),
            getExpenses({ page: 1, limit: 1, status: 'pending' }).catch(() => null),
        ]).then(([a, p]) => {
            if (!live) return;
            const list = a?.data?.expenses || (Array.isArray(a?.data) ? a.data : []);
            setExp({ rows: list, pending: p?.data?.total ?? 0, loading: false });
        });
        return () => {
            live = false;
        };
    }, [period.from, period.to]);
    if (loading) return <Loading />;
    if (error) return <ErrorNote>{error}</ErrorNote>;
    const pl = profitFromSummary(data);
    const byCat = {};
    exp.rows.forEach((e) => {
        const k = e.category || 'other';
        byCat[k] = byCat[k] || { label: k.replace(/_/g, ' '), value: 0, count: 0 };
        byCat[k].value += Number(e.amount) || 0;
        byCat[k].count += 1;
    });
    return (
        <>
            <DrawerSection>
                <KpiStrip cols={4} className="gap-y-4">
                    <Stat label="Cost of goods" value={fmt.money(pl.cogs)} />
                    <Stat label="Returns" value={fmt.money(pl.returns)} />
                    <Stat label="Expenses" value={fmt.money(pl.expenses)} />
                    <Stat label="Waiting approval" value={exp.loading ? '…' : exp.pending} note="expenses" tone={exp.pending > 0 ? 'warning' : undefined} />
                </KpiStrip>
            </DrawerSection>
            <DrawerSection title="Expenses by category">
                {exp.loading ? <Skeleton className="h-32 w-full" /> : Object.keys(byCat).length ? <DonutChart data={Object.values(byCat)} format={fmt.money} height={150} /> : <p className="text-body-sm text-muted-foreground">No approved expenses in this period.</p>}
            </DrawerSection>
        </>
    );
}

// ───────────────────────────── Panel windows (summary lists) ─────────────────────────────

const TableSection = (props) => (
    <DrawerSection>
        <div className="-mx-1">
            <DataTable maxHeight={null} {...props} />
        </div>
    </DrawerSection>
);

export function ListWindow({ kind, period }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    const filter = summaryFilterFor(period) || 'today';
    const { data, loading, error } = useSummary(kind === 'employees' || kind === 'margins' || kind === 'payments' ? filter : 'today');
    if (loading) return <Loading />;
    if (error) return <ErrorNote>{error}</ErrorNote>;
    const d = data || {};
    const money = (v) => fmt.money(v);
    if (kind === 'topsellers')
        return (
            <TableSection
                caption="Top sellers, all time"
                data={d.topProducts || []}
                getRowId={(p) => p._id}
                initialSort={[{ id: 'qty', desc: true }]}
                empty={{ icon: FiTrendingUp, title: 'No sales yet' }}
                columns={[
                    { id: 'name', header: 'Product', accessorKey: 'name', cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
                    { id: 'cat', header: 'Category', accessorFn: (p) => p.category || '', cell: ({ getValue }) => getValue() || <Dash /> },
                    { id: 'qty', header: 'Sold', accessorFn: (p) => p.totalQtySold || 0, meta: { align: 'right' } },
                    { id: 'rev', header: 'Revenue', accessorFn: (p) => p.totalRevenue || 0, meta: { align: 'right' }, cell: ({ getValue }) => money(getValue()) },
                    { id: 'profit', header: 'Profit', accessorFn: (p) => p.totalProfit || 0, meta: { align: 'right' }, cell: ({ getValue }) => <span className={getValue() < 0 ? 'text-destructive' : ''}>{money(getValue())}</span> },
                ]}
            />
        );
    if (kind === 'margins')
        return (
            <TableSection
                caption="Margins by product"
                data={(d.salesByProduct || []).filter((p) => (p.netRevenue || 0) > 0).map((p) => ({ ...p, margin: (p.totalProfit / p.netRevenue) * 100 }))}
                getRowId={(p) => p._id}
                initialSort={[{ id: 'margin', desc: true }]}
                empty={{ icon: FiTrendingUp, title: 'No sales in this period' }}
                rowTone={(p) => (p.margin < 0 ? 'attention' : null)}
                columns={[
                    { id: 'name', header: 'Product', accessorKey: 'name', cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
                    { id: 'qty', header: 'Sold', accessorFn: (p) => p.netQtySold ?? p.totalQtySold ?? 0, meta: { align: 'right' } },
                    { id: 'rev', header: 'Net revenue', accessorFn: (p) => p.netRevenue || 0, meta: { align: 'right' }, cell: ({ getValue }) => money(getValue()) },
                    { id: 'profit', header: 'Profit', accessorFn: (p) => p.totalProfit || 0, meta: { align: 'right' }, cell: ({ getValue }) => money(getValue()) },
                    { id: 'margin', header: 'Margin', accessorFn: (p) => p.margin, meta: { align: 'right' }, cell: ({ getValue }) => <span className={cn('font-medium', getValue() < 0 ? 'text-destructive' : 'text-success')}>{pct(getValue())}</span> },
                ]}
            />
        );
    if (kind === 'deadstock')
        return (
            <>
                <DrawerSection>
                    <KpiStrip cols={3}>
                        <Stat label="Dead products" value={d.deadStock?.summary?.deadProducts || 0} note={`not sold in ${d.deadStock?.days || 30} days`} />
                        <Stat label="Capital locked" value={money(d.deadStock?.summary?.totalDeadValue)} tone="destructive" note="at cost price" />
                    </KpiStrip>
                </DrawerSection>
                <TableSection
                    caption="Dead stock"
                    data={d.deadStock?.deadStock || []}
                    getRowId={(p) => p._id}
                    initialSort={[{ id: 'value', desc: true }]}
                    empty={{ icon: FiArchive, title: 'No dead stock', description: 'Everything sold recently.' }}
                    columns={[
                        { id: 'name', header: 'Product', accessorKey: 'name', cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
                        { id: 'stock', header: 'Stock', accessorFn: (p) => p.stockQuantity || 0, meta: { align: 'right' } },
                        { id: 'value', header: 'Value at cost', accessorFn: (p) => p.stockValue ?? (p.costPrice || 0) * (p.stockQuantity || 0), meta: { align: 'right' }, cell: ({ getValue }) => <span className="text-destructive">{money(getValue())}</span> },
                    ]}
                />
            </>
        );
    if (kind === 'lowstock')
        return (
            <TableSection
                caption="Low stock"
                data={d.lowStock || []}
                getRowId={(p) => p._id}
                initialSort={[{ id: 'stock', desc: false }]}
                empty={{ icon: FiPackage, title: 'All stocked up', description: 'No product is below its alert level.' }}
                onRowClick={() => navigate('/inventory')}
                rowLabel={(p) => `${p.name} — open Inventory`}
                columns={[
                    { id: 'name', header: 'Product', accessorKey: 'name', cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
                    { id: 'stock', header: 'Stock', accessorFn: (p) => p.stockQuantity ?? 0, meta: { align: 'right' }, cell: ({ getValue }) => (getValue() === 0 ? <StatusChip size="xs" shape="tag" tone="destructive" label="Out" /> : <span className="font-medium text-warning-chip-foreground">{getValue()}</span>) },
                    { id: 'alert', header: 'Alert level', accessorFn: (p) => p.lowStockAlert || 10, meta: { align: 'right' }, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span> },
                ]}
            />
        );
    if (kind === 'employees')
        return (
            <TableSection
                caption="Employee performance"
                data={d.salesByCashier || []}
                getRowId={(c) => c.cashierId || c.cashierName}
                initialSort={[{ id: 'sales', desc: true }]}
                empty={{ icon: FiUsers, title: 'No sales in this period' }}
                onRowClick={() => navigate('/employees')}
                rowLabel={(c) => `${c.cashierName} — open Employees`}
                columns={[
                    { id: 'name', header: 'Employee', accessorKey: 'cashierName', cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
                    { id: 'sales', header: 'Sales', accessorFn: (c) => c.totalSales || 0, meta: { align: 'right' }, cell: ({ getValue }) => money(getValue()) },
                    { id: 'bills', header: 'Bills', accessorFn: (c) => c.billCount || 0, meta: { align: 'right' } },
                    { id: 'profit', header: 'Profit', accessorFn: (c) => c.totalProfit || 0, meta: { align: 'right' }, cell: ({ getValue }) => <span className={getValue() < 0 ? 'text-destructive' : ''}>{money(getValue())}</span> },
                    { id: 'avg', header: 'Average bill', accessorFn: (c) => c.avgOrderValue || 0, meta: { align: 'right' }, cell: ({ getValue }) => money(getValue()) },
                ]}
            />
        );
    if (kind === 'payments')
        return (
            <DrawerSection title="Payment methods">
                {(d.paymentMethods || []).length ? <DonutChart data={methodsDonut(d.paymentMethods)} format={money} height={160} /> : <p className="text-body-sm text-muted-foreground">No payments in this period.</p>}
            </DrawerSection>
        );
    return null;
}

/** Window catalogue: title, whether its data knows any date range, whether it has a period at all. */
export const WINDOWS = {
    sales: { title: 'Sales', range: 'insights', report: '/reports' },
    profit: { title: 'Profit', range: 'summary', report: '/reports' },
    orders: { title: 'Orders', range: 'summary', report: '/receipts' },
    money: { title: 'Money', range: 'none', report: '/cashbook', reportLabel: 'Open the Money Book' },
    costs: { title: 'Costs', range: 'summary', report: '/expenses', reportLabel: 'Open Expenses' },
    topsellers: { title: 'Top sellers (all time)', range: 'none', report: '/reports' },
    margins: { title: 'Margins by product', range: 'summary', report: '/reports' },
    deadstock: { title: 'Dead stock', range: 'none', report: '/inventory', reportLabel: 'Open Inventory' },
    lowstock: { title: 'Low stock', range: 'none', report: '/inventory', reportLabel: 'Open Inventory' },
    employees: { title: 'Employee performance', range: 'summary', report: '/employees', reportLabel: 'Open Employees' },
    payments: { title: 'Payment methods', range: 'summary', report: '/reports' },
};

export function WindowBody({ kind, period, onLimited }) {
    if (kind === 'sales') return <SalesWindow period={period} onLimited={onLimited} />;
    if (kind === 'profit') return <ProfitWindow period={period} />;
    if (kind === 'orders') return <OrdersWindow period={period} />;
    if (kind === 'money') return <MoneyWindow />;
    if (kind === 'costs') return <CostsWindow period={period} />;
    return <ListWindow kind={kind} period={period} />;
}

