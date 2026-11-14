import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiInbox } from 'react-icons/fi';
import {
    Button,
    IconButton,
    Input,
    SegmentedControl,
    Stat,
    BarChart,
    HorizontalBarChart,
    DonutChart,
    StatusBadge,
    StateCard,
    EmptyState,
    todayYmd,
    parseYmd,
    ymd,
    CARD_FRAME,
} from '../../components/ui';
import { getInventoryValuation, getDeadStock, getLowStockProducts } from '../../services/api/products';
import { getCustomers, getCustomerSummary } from '../../services/api/customers';
import { getSupplyStats } from '../../services/api/supplies';
import { getVendors } from '../../services/api/vendors';
import { getExpenses, getExpenseStats } from '../../services/api/expenses';
import { getClosings, getLastClosing } from '../../services/api/closing';
import { getCashBookSummary } from '../../services/api/cashbook';
import { getMoneyBalances } from '../../services/api/moneyBook';
import { getReceipts } from '../../services/api/receipts';
import { useSalesInsights, hourLabel, hourRange } from './dashboardData';
import { useFmt } from './InsightWindows';
import { useLoad, TabCard, Figures, MiniTable, shortDate, shortTime, daysAgo } from './shopTabKit';

// The Dashboard's tabs (owner only), modelled on the platform admin's shop page. Each tab is a
// summary of one part of the shop + one focused list; the full screens stay in the sidebar.

const methodLabel = (m) => String(m || 'other').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const addDays = (s, n) => {
    const d = parseYmd(s);
    d.setDate(d.getDate() + n);
    return ymd(d);
};
const NEEDS_SERVER = (
    <EmptyState icon={FiInbox} title="Needs the server update" className={CARD_FRAME}>
        This tab reads the sales-insights endpoint, which the server doesn't have yet (backend prompt for Stage 7).
    </EmptyState>
);

// ───────────────────────── Today & bills ─────────────────────────

export function TodayTab({ refreshKey }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    const today = todayYmd();
    const [day, setDay] = useState(today);
    const [measure, setMeasure] = useState('sales');
    const period = useMemo(() => ({ preset: 'day', from: day, to: day }), [day]);
    const ins = useSalesInsights(period, { refreshKey });
    const bills = useLoad(() => getReceipts({ page: 1, limit: 100, startDate: day, endDate: day }).then((r) => r.data?.receipts || []), [day, refreshKey]);
    const d = ins.data || {};
    const loading = ins.loading && !ins.data;
    const hasProfit = d.profit !== undefined && d.profit !== null;

    // Only the hours between the first and last bill (the endpoint already fills the gaps with 0)
    const series = useMemo(() => {
        const rows = (d.series || []).map((r) => ({ key: r.key, label: hourLabel(Number(r.key)), range: hourRange(Number(r.key)), sales: r.sales || 0, bills: r.bills || 0 }));
        const used = rows.filter((r) => r.bills > 0 || r.sales > 0);
        if (!used.length) return rows;
        const first = rows.indexOf(used[0]);
        const last = rows.indexOf(used[used.length - 1]);
        return rows.slice(first, last + 1);
    }, [d.series]);

    if (ins.unsupported) return NEEDS_SERVER;

    const title = parseYmd(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return (
        <>
            <TabCard
                title={day === today ? `Today, ${title}` : title}
                description="Pakistan time, midnight to midnight."
                controls={
                    <div className="flex items-center gap-1">
                        <IconButton label="Day before" size="xs" variant="outline" onClick={() => setDay(addDays(day, -1))}>
                            <FiChevronLeft />
                        </IconButton>
                        <Input type="date" size="xs" className="w-[140px]" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Day" />
                        <IconButton label="Day after" size="xs" variant="outline" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>
                            <FiChevronRight />
                        </IconButton>
                        <Button size="xs" variant="outline" disabled={day === today} onClick={() => setDay(today)}>
                            Today
                        </Button>
                    </div>
                }
            >
                {ins.error && !ins.data ? (
                    <StateCard kind="error">{ins.error}</StateCard>
                ) : (
                    <Figures loading={loading} count={10} cols={5}>
                        <Stat label="Bills" value={d.bills || 0} note={`${d.cancelled || 0} cancelled · ${d.onHold || 0} on hold`} />
                        <Stat label="Sales" value={fmt.money(d.sales)} />
                        <Stat label="Paid" value={fmt.money(d.paid)} />
                        <Stat label="On credit" value={fmt.money(d.creditGiven)} note="Not paid yet" tone={d.creditGiven > 0 ? 'warning' : undefined} />
                        <Stat label="Profit" value={hasProfit ? fmt.money(d.profit) : '—'} note="After returns" tone={hasProfit && d.profit < 0 ? 'destructive' : undefined} />
                        <Stat label="Discount given" value={fmt.money(d.discount)} />
                        <Stat label="Items sold" value={(d.itemsSold || 0).toLocaleString()} />
                        <Stat label="With a customer" value={d.billsWithCustomer || 0} note={`of ${d.bills || 0} bills`} />
                        <Stat label="First bill" value={d.firstBillAt ? shortTime(d.firstBillAt) : '—'} />
                        <Stat label="Last bill" value={d.lastBillAt ? shortTime(d.lastBillAt) : '—'} />
                    </Figures>
                )}
            </TabCard>

            <TabCard
                title="By hour"
                description="When the bills were made, Pakistan time."
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
            >
                {loading ? null : series.some((r) => r.bills > 0) ? (
                    <BarChart
                        data={series}
                        yKey={measure}
                        format={measure === 'sales' ? fmt.compact : (v) => v}
                        tooltipTitle={(r) => r.range}
                        tooltipRows={(r) => [
                            ['Sales', fmt.money(r.sales)],
                            ['Bills', r.bills],
                        ]}
                        highlight={d.peak ? hourLabel(Number(d.peak.key)) : undefined}
                        height={240}
                    />
                ) : (
                    <p className="py-8 text-center text-body-sm text-muted-foreground">No bills on this day.</p>
                )}
            </TabCard>

            <div className="grid gap-4 lg:grid-cols-2 items-start">
                <TabCard title="Sales by cashier" description="Completed bills on this day.">
                    {(d.byCashier || []).length ? (
                        <HorizontalBarChart
                            data={d.byCashier.map((c) => ({ key: c.cashier, label: c.cashier || '—', value: c.sales, note: `${c.bills} bill${c.bills === 1 ? '' : 's'}` }))}
                            format={fmt.money}
                        />
                    ) : (
                        <p className="text-body-sm text-muted-foreground">{loading ? '…' : 'No sales on this day.'}</p>
                    )}
                </TabCard>
                <TabCard title="Payment methods" description="Money taken on this day (store credit not counted).">
                    {(d.byPaymentMethod || []).length ? (
                        <DonutChart data={d.byPaymentMethod.map((m) => ({ label: methodLabel(m.method), value: m.amount, count: m.payments }))} format={fmt.money} countLabel="Payments" height={140} />
                    ) : (
                        <p className="text-body-sm text-muted-foreground">{loading ? '…' : 'No payments on this day.'}</p>
                    )}
                </TabCard>
            </div>

            <TabCard title="Bills" description={`Every bill made on this day${bills.data?.length >= 100 ? ' (first 100)' : ''}. Click one to open it.`} link={{ to: '/receipts', label: 'Open Receipts' }} flush>
                <MiniTable
                    loading={bills.loading}
                    error={bills.error}
                    onRetry={bills.reload}
                    rows={bills.data}
                    empty="No bills on this day."
                    onRowClick={(b) => navigate(`/receipts?bill=${b._id}`)}
                    columns={[
                        { key: 'billNumber', label: 'Bill', render: (b) => <span className="font-mono">#{b.billNumber}</span> },
                        { key: 'time', label: 'Time', render: (b) => shortTime(b.createdAt) },
                        { key: 'customer', label: 'Customer', render: (b) => b.customerName || 'Walk-in' },
                        { key: 'cashier', label: 'Cashier', render: (b) => b.cashierName || '—' },
                        { key: 'items', label: 'Items', align: 'right', render: (b) => b.totalQty ?? b.items?.length ?? 0 },
                        { key: 'total', label: 'Total', align: 'right', render: (b) => fmt.money(b.total) },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (b) =>
                                b.status === 'completed' ? <StatusBadge kind="payment" value={b.paymentStatus} size="sm" /> : <StatusBadge kind="bill" value={b.status} size="sm" />,
                        },
                    ]}
                />
            </TabCard>
        </>
    );
}

// ───────────────────────── Products ─────────────────────────

export function ProductsTab({ refreshKey }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    const val = useLoad(() => getInventoryValuation().then((r) => r.data), [refreshKey]);
    const dead = useLoad(() => getDeadStock(30).then((r) => r.data), [refreshKey]);
    const low = useLoad(() => getLowStockProducts().then((r) => (Array.isArray(r.data) ? r.data : r.data?.products || [])), [refreshKey]);
    const s = val.data?.summary || {};
    const ds = dead.data?.summary || {};
    const deadRows = [...(dead.data?.deadStock || [])].sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0));
    return (
        <>
            <TabCard title="Stock" description="What the shop's counted stock is worth now." link={{ to: '/inventory', label: 'Open Inventory' }}>
                {val.error ? (
                    <StateCard kind="error" onRetry={val.reload}>
                        {val.error}
                    </StateCard>
                ) : (
                    <Figures loading={val.loading || dead.loading || low.loading} count={6}>
                        <Stat label="Products in stock" value={(s.totalProducts || 0).toLocaleString()} note={`${(s.totalItems || 0).toLocaleString()} items`} />
                        <Stat label="Stock at cost" value={fmt.money(s.totalCostValue)} />
                        <Stat label="At selling price" value={fmt.money(s.totalRetailValue)} />
                        <Stat label="Profit if all sold" value={fmt.money(s.totalPotentialProfit)} note={`Average margin ${(s.avgMargin || 0).toFixed(1)}%`} tone={s.totalPotentialProfit < 0 ? 'destructive' : undefined} />
                        <Stat label="Low on stock" value={(low.data || []).length} note="At or below their alert level" tone={(low.data || []).length ? 'warning' : undefined} />
                        <Stat label="Not selling" value={ds.deadProducts || 0} note={`No sale in 30 days · ${fmt.money(ds.totalDeadValue)} at cost`} tone={ds.deadProducts ? 'destructive' : undefined} />
                    </Figures>
                )}
            </TabCard>

            <TabCard title="Not selling" description="Products in stock with no sale in the last 30 days." flush>
                <MiniTable
                    loading={dead.loading}
                    error={dead.error}
                    onRetry={dead.reload}
                    rows={deadRows}
                    maxRows={50}
                    empty="Every product in stock sold in the last 30 days."
                    onRowClick={() => navigate('/products')}
                    columns={[
                        { key: 'name', label: 'Product', className: 'font-medium' },
                        { key: 'category', label: 'Category', render: (p) => p.category || '—' },
                        { key: 'stockQuantity', label: 'In stock', align: 'right' },
                        { key: 'sellingPrice', label: 'Price', align: 'right', render: (p) => fmt.money(p.sellingPrice) },
                        { key: 'stockValue', label: 'Value at cost', align: 'right', render: (p) => fmt.money(p.stockValue) },
                    ]}
                />
            </TabCard>

            <TabCard title="Low on stock" description="At or below their alert level — time to reorder." link={{ to: '/products', label: 'Open Products' }} flush>
                <MiniTable
                    loading={low.loading}
                    error={low.error}
                    onRetry={low.reload}
                    rows={[...(low.data || [])].sort((a, b) => (a.stockQuantity || 0) - (b.stockQuantity || 0))}
                    maxRows={50}
                    empty="Nothing is low on stock."
                    onRowClick={() => navigate('/products')}
                    columns={[
                        { key: 'name', label: 'Product', className: 'font-medium' },
                        { key: 'category', label: 'Category', render: (p) => p.category || '—' },
                        {
                            key: 'stockQuantity',
                            label: 'In stock',
                            align: 'right',
                            render: (p) => <span className={p.stockQuantity <= 0 ? 'text-destructive font-medium' : 'text-warning-chip-foreground font-medium'}>{p.stockQuantity}</span>,
                        },
                        { key: 'lowStockAlert', label: 'Alert at', align: 'right' },
                        { key: 'costPrice', label: 'Cost', align: 'right', render: (p) => fmt.money(p.costPrice) },
                    ]}
                />
            </TabCard>
        </>
    );
}

// ───────────────────────── Customers ─────────────────────────

export function CustomersTab({ refreshKey }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    const sum = useLoad(() => getCustomerSummary().then((r) => r.data), [refreshKey]);
    const owing = useLoad(
        () =>
            getCustomers({ hasDues: 'true', limit: 100 }).then((r) => {
                const list = r.data?.customers || r.data || [];
                return [...list].sort((a, b) => (b.balance || 0) - (a.balance || 0));
            }),
        [refreshKey]
    );
    const s = sum.data || {};
    const overLimit = (owing.data || []).filter((c) => c.creditLimit > 0 && c.balance > c.creditLimit).length;
    return (
        <>
            <TabCard title="Customers" description="Credit customers and what they owe the shop." link={{ to: '/customers', label: 'Open Customers' }}>
                {sum.error ? (
                    <StateCard kind="error" onRetry={sum.reload}>
                        {sum.error}
                    </StateCard>
                ) : (
                    <Figures loading={sum.loading} count={4}>
                        <Stat label="Customers" value={(s.totalCustomers || 0).toLocaleString()} note="Active" />
                        <Stat label="Owe the shop" value={fmt.money(s.totalOutstandingDues)} tone={s.totalOutstandingDues > 0 ? 'warning' : undefined} note="Money still to collect" />
                        <Stat label="With dues" value={s.customersWithDues || 0} note={`of ${s.totalCustomers || 0} customers`} />
                        <Stat label="Over their limit" value={owing.loading ? '—' : overLimit} tone={overLimit ? 'destructive' : undefined} note="Owe more than their credit limit" />
                    </Figures>
                )}
            </TabCard>

            <TabCard title="Who owes the most" description="Customers with money still to pay. Click one to open their ledger." flush>
                <MiniTable
                    loading={owing.loading}
                    error={owing.error}
                    onRetry={owing.reload}
                    rows={owing.data}
                    maxRows={50}
                    empty="No customer owes the shop anything."
                    onRowClick={(c) => navigate(`/customers/${c._id}/ledger`)}
                    columns={[
                        { key: 'name', label: 'Customer', className: 'font-medium' },
                        { key: 'phone', label: 'Phone', render: (c) => <span className="font-mono">{c.phone || '—'}</span> },
                        { key: 'balance', label: 'Owes', align: 'right', render: (c) => <span className="text-destructive font-medium">{fmt.money(c.balance)}</span> },
                        {
                            key: 'creditLimit',
                            label: 'Credit limit',
                            align: 'right',
                            render: (c) => (c.creditLimit > 0 ? <span className={c.balance > c.creditLimit ? 'text-destructive' : ''}>{fmt.money(c.creditLimit)}</span> : '—'),
                        },
                        { key: 'totalBilled', label: 'Bought in all', align: 'right', render: (c) => fmt.money(c.totalBilled) },
                        { key: 'lastPurchase', label: 'Last visit', render: (c) => daysAgo(c.lastPurchase) },
                    ]}
                />
            </TabCard>
        </>
    );
}

// ───────────────────────── Vendors & supplies ─────────────────────────

export function VendorsTab({ refreshKey }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    const stats = useLoad(() => getSupplyStats().then((r) => r.data), [refreshKey]);
    const vendors = useLoad(
        () =>
            getVendors().then((r) => {
                const list = Array.isArray(r.data) ? r.data : r.data?.vendors || [];
                return [...list].sort((a, b) => (b.netBalance || 0) - (a.netBalance || 0) || (b.totalBusiness || 0) - (a.totalBusiness || 0));
            }),
        [refreshKey]
    );
    const o = stats.data?.overall || {};
    const m = stats.data?.thisMonth || {};
    const owed = (vendors.data || []).reduce((a, v) => a + Math.max(0, v.netBalance || 0), 0);
    return (
        <>
            <TabCard title="Vendors & supplies" description="What the shop has bought and still owes." link={{ to: '/vendors', label: 'Open Vendors' }}>
                {stats.error ? (
                    <StateCard kind="error" onRetry={stats.reload}>
                        {stats.error}
                    </StateCard>
                ) : (
                    <Figures loading={stats.loading || vendors.loading} count={6}>
                        <Stat label="Vendors" value={(vendors.data || []).length} />
                        <Stat label="Supplies" value={(o.count || 0).toLocaleString()} note={`${m.count || 0} this month`} />
                        <Stat label="Bought in all" value={fmt.money(o.totalAmount)} />
                        <Stat label="Bought this month" value={fmt.money(m.totalAmount)} />
                        <Stat label="Paid in all" value={fmt.money(o.totalPaid)} />
                        <Stat label="Owed to vendors" value={fmt.money(owed)} tone={owed > 0 ? 'destructive' : undefined} note="After returns" />
                    </Figures>
                )}
            </TabCard>

            <TabCard title="Vendors" description="Biggest balance first. Click one to open their ledger." flush>
                <MiniTable
                    loading={vendors.loading}
                    error={vendors.error}
                    onRetry={vendors.reload}
                    rows={vendors.data}
                    maxRows={50}
                    empty="No vendors yet."
                    onRowClick={(v) => navigate(`/vendors/${v._id}/ledger`)}
                    columns={[
                        { key: 'name', label: 'Vendor', className: 'font-medium', render: (v) => v.name + (v.company ? ` · ${v.company}` : '') },
                        { key: 'supplyCount', label: 'Supplies', align: 'right', render: (v) => v.supplyCount || 0 },
                        { key: 'totalBusiness', label: 'Bought', align: 'right', render: (v) => fmt.money(v.totalBusiness) },
                        { key: 'totalPaid', label: 'Paid', align: 'right', render: (v) => fmt.money(v.totalPaid) },
                        { key: 'totalReturned', label: 'Returned', align: 'right', render: (v) => fmt.money(v.totalReturned) },
                        {
                            key: 'netBalance',
                            label: 'Owed',
                            align: 'right',
                            render: (v) => <span className={v.netBalance > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>{fmt.money(Math.max(0, v.netBalance || 0))}</span>,
                        },
                    ]}
                />
            </TabCard>
        </>
    );
}

// ───────────────────────── Expenses ─────────────────────────

export function ExpensesTab({ refreshKey }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    const stats = useLoad(() => getExpenseStats().then((r) => r.data), [refreshKey]);
    const recent = useLoad(() => getExpenses({ page: 1, limit: 15 }).then((r) => r.data?.expenses || []), [refreshKey]);
    const s = stats.data || {};
    const labels = s.categoryLabels || {};
    return (
        <>
            <TabCard title="Expenses" description="Rent, bills, wages and other costs." link={{ to: '/expenses', label: 'Open Expenses' }}>
                {stats.error ? (
                    <StateCard kind="error" onRetry={stats.reload}>
                        {stats.error}
                    </StateCard>
                ) : (
                    <Figures loading={stats.loading} count={4}>
                        <Stat label="Today" value={fmt.money(s.todayExpenses)} />
                        <Stat label="This month" value={fmt.money(s.monthExpenses)} />
                        <Stat label="All time" value={fmt.money(s.totalExpenses)} note={`${s.expenseCount || 0} approved`} />
                        <Stat label="Waiting approval" value={s.pendingCount || 0} note={fmt.money(s.pendingTotal)} tone={s.pendingCount ? 'warning' : undefined} />
                    </Figures>
                )}
            </TabCard>

            <div className="grid gap-4 lg:grid-cols-5 items-start">
                <TabCard className="lg:col-span-2" title="By category" description="Approved expenses, all time.">
                    {(s.byCategory || []).length ? (
                        <HorizontalBarChart data={s.byCategory.map((c) => ({ key: c.category, label: c.label || c.category, value: c.total, note: `${c.count} expense${c.count === 1 ? '' : 's'}` }))} format={fmt.money} />
                    ) : (
                        <p className="text-body-sm text-muted-foreground">{stats.loading ? '…' : 'No expenses yet.'}</p>
                    )}
                </TabCard>
                <TabCard className="lg:col-span-3" title="Latest expenses" flush>
                    <MiniTable
                        loading={recent.loading}
                        error={recent.error}
                        onRetry={recent.reload}
                        rows={recent.data}
                        empty="No expenses yet."
                        onRowClick={() => navigate('/expenses')}
                        columns={[
                            { key: 'date', label: 'Date', render: (e) => shortDate(e.date) },
                            { key: 'category', label: 'Category', render: (e) => labels[e.category] || e.category },
                            { key: 'description', label: 'What for', className: 'max-w-[220px] truncate', render: (e) => e.description || '—' },
                            { key: 'amount', label: 'Amount', align: 'right', render: (e) => fmt.money(e.amount) },
                            { key: 'status', label: 'Status', render: (e) => <StatusBadge kind="expense" value={e.status} size="sm" /> },
                        ]}
                    />
                </TabCard>
            </div>
        </>
    );
}

// ───────────────────────── Money ─────────────────────────

const ACCOUNT_TYPE = { cash: 'Cash', bank: 'Bank', wallet: 'Wallet', card_machine: 'Card machine' };
const CASHBOOK_LABEL = {
    sale_collection: 'Sales',
    customer_payment: 'Customer payments',
    customer_refund: 'Refunds',
    sale_cancel: 'Cancelled sales',
    supplier_payment: 'Paid to vendors',
    expense: 'Expenses',
    transfer_in: 'Transfers in',
    transfer_out: 'Transfers out',
    transfer_fee: 'Transfer fees',
    deposit: 'Money added',
    withdrawal: 'Money taken out',
};

export function MoneyTab({ refreshKey }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    // Money Book accounts when the shop has it; the drawer's cash book otherwise
    const balances = useLoad(
        () =>
            getMoneyBalances()
                .then((r) => r.data)
                .catch((err) => {
                    if ([403, 404, 409].includes(err.response?.status)) return null;
                    throw err;
                }),
        [refreshKey]
    );
    const cash = useLoad(() => getCashBookSummary().then((r) => r.data), [refreshKey]);
    const mb = balances.data;
    const c = cash.data || {};
    const flows = (period) =>
        Object.entries(c[period]?.byType || {})
            .map(([type, v]) => ({ type, label: CASHBOOK_LABEL[type] || methodLabel(type), in: v.in || 0, out: v.out || 0, count: v.count || 0 }))
            .sort((a, b) => b.in + b.out - (a.in + a.out));
    return (
        <>
            <TabCard title="Money" description={mb ? 'Every account the shop keeps money in.' : 'The cash drawer.'} link={{ to: '/cashbook', label: mb ? 'Open Money Book' : 'Open Cash Book' }}>
                {cash.error && balances.error ? (
                    <StateCard kind="error" onRetry={cash.reload}>
                        {cash.error}
                    </StateCard>
                ) : (
                    <Figures loading={balances.loading || cash.loading} count={4}>
                        {mb ? <Stat label="All accounts" value={fmt.money(mb.totals?.total)} /> : null}
                        <Stat label="Cash in drawer" value={fmt.money(c.currentBalance)} />
                        {mb ? <Stat label="Bank" value={fmt.money(mb.totals?.byType?.bank)} /> : null}
                        <Stat label="Drawer today" value={fmt.money(c.today?.net)} note={`In ${fmt.money(c.today?.totalIn)} · out ${fmt.money(c.today?.totalOut)}`} tone={c.today?.net < 0 ? 'destructive' : undefined} />
                        <Stat label="Drawer this month" value={fmt.money(c.thisMonth?.net)} note={`In ${fmt.money(c.thisMonth?.totalIn)} · out ${fmt.money(c.thisMonth?.totalOut)}`} tone={c.thisMonth?.net < 0 ? 'destructive' : undefined} />
                    </Figures>
                )}
            </TabCard>

            <div className="grid gap-4 lg:grid-cols-2 items-start">
                {mb ? (
                    <TabCard title="Accounts" description="Balance of each account now." flush>
                        <MiniTable
                            rows={mb.accounts || []}
                            empty="No accounts."
                            onRowClick={() => navigate('/cashbook')}
                            columns={[
                                { key: 'name', label: 'Account', className: 'font-medium' },
                                { key: 'type', label: 'Type', render: (a) => ACCOUNT_TYPE[a.type] || a.type },
                                { key: 'balance', label: 'Balance', align: 'right', render: (a) => <span className={a.balance < 0 ? 'text-destructive' : ''}>{fmt.money(a.balance)}</span> },
                            ]}
                        />
                    </TabCard>
                ) : null}
                <TabCard title="Drawer this month" description="Money in and out of the cash drawer, by kind." flush className={mb ? '' : 'lg:col-span-2'}>
                    <MiniTable
                        loading={cash.loading}
                        error={cash.error}
                        onRetry={cash.reload}
                        rows={cash.data ? flows('thisMonth') : null}
                        rowKey={(r) => r.type}
                        empty="No money moved this month."
                        columns={[
                            { key: 'label', label: 'Kind', className: 'font-medium' },
                            { key: 'count', label: 'Times', align: 'right' },
                            { key: 'in', label: 'In', align: 'right', render: (r) => (r.in ? <span className="text-success">{fmt.money(r.in)}</span> : '—') },
                            { key: 'out', label: 'Out', align: 'right', render: (r) => (r.out ? <span className="text-destructive">{fmt.money(r.out)}</span> : '—') },
                        ]}
                    />
                </TabCard>
            </div>
        </>
    );
}

// ───────────────────────── Closings ─────────────────────────

const moneyCheck = (cl) => {
    const t = cl.tenderReconciliation || {};
    const parts = Object.values(t).filter((x) => x && typeof x === 'object');
    if (!parts.length) return { ok: !!cl.reconciled, text: cl.reconciled ? 'Matched' : 'Not checked' };
    const ok = parts.filter((x) => x.reconciled).length;
    return { ok: ok === parts.length, text: `${ok} of ${parts.length} matched` };
};

export function ClosingsTab({ refreshKey }) {
    const fmt = useFmt();
    const navigate = useNavigate();
    const last = useLoad(
        () =>
            getLastClosing()
                .then((r) => r.data)
                .catch((err) => {
                    if (err.response?.status === 404) return null;
                    throw err;
                }),
        [refreshKey]
    );
    const list = useLoad(() => getClosings({ page: 1, limit: 30 }).then((r) => r.data?.closings || []), [refreshKey]);
    const l = last.data;
    return (
        <>
            <TabCard
                title={l ? `Last closing · #${l.closingNumber}` : 'Closings'}
                description={l ? `${shortDate(l.periodStart)} to ${shortDate(l.periodEnd)} · closed by ${l.closedBy?.name || '—'} on ${shortDate(l.closedAt)}` : 'Close the books to lock a period.'}
                link={{ to: '/closing', label: 'Open Closing' }}
            >
                {last.error ? (
                    <StateCard kind="error" onRetry={last.reload}>
                        {last.error}
                    </StateCard>
                ) : !last.loading && !l ? (
                    <p className="text-body-sm text-muted-foreground">No closing yet.</p>
                ) : (
                    <Figures loading={last.loading} count={8}>
                        <Stat label="Net sales" value={fmt.money(l?.netSales)} note={`${l?.totalOrders || 0} bills`} />
                        <Stat label="Net profit" value={fmt.money(l?.netProfit)} tone={l?.netProfit < 0 ? 'destructive' : undefined} />
                        <Stat label="Returns" value={fmt.money(l?.totalReturns)} />
                        <Stat label="Expenses" value={fmt.money(l?.totalExpenses)} />
                        <Stat label="Cash sales" value={fmt.money(l?.cashSales)} />
                        <Stat label="Credit given" value={fmt.money(l?.creditExtended)} tone={l?.creditExtended > 0 ? 'warning' : undefined} />
                        <Stat label="Still to collect" value={fmt.money(l?.outstandingReceivable)} />
                        <Stat label="Money check" value={l ? moneyCheck(l).text : '—'} tone={l && !moneyCheck(l).ok ? 'warning' : 'success'} />
                    </Figures>
                )}
            </TabCard>

            <TabCard title="All closings" description="Newest first. Click one to open it." flush>
                <MiniTable
                    loading={list.loading}
                    error={list.error}
                    onRetry={list.reload}
                    rows={list.data}
                    empty="No closings yet."
                    onRowClick={(cl) => navigate(`/closing/${cl._id}`)}
                    columns={[
                        { key: 'closingNumber', label: 'Closing', render: (cl) => <span className="font-mono">#{cl.closingNumber}</span> },
                        { key: 'period', label: 'Period', render: (cl) => `${shortDate(cl.periodStart)} – ${shortDate(cl.periodEnd)}` },
                        { key: 'netSales', label: 'Net sales', align: 'right', render: (cl) => fmt.money(cl.netSales) },
                        { key: 'netProfit', label: 'Net profit', align: 'right', render: (cl) => fmt.money(cl.netProfit) },
                        {
                            key: 'check',
                            label: 'Money check',
                            render: (cl) => {
                                const m = moneyCheck(cl);
                                return <span className={m.ok ? 'text-success' : 'text-warning-chip-foreground'}>{m.text}</span>;
                            },
                        },
                        { key: 'closedBy', label: 'Closed by', render: (cl) => cl.closedBy?.name || '—' },
                    ]}
                />
            </TabCard>
        </>
    );
}
