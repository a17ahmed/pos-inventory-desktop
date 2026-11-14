import React, { useEffect, useMemo, useState } from 'react';
import { FiChevronRight, FiChevronDown, FiChevronUp, FiBarChart2, FiShoppingBag } from 'react-icons/fi';
import api from '../../services/api';
import { cn, ChartPanel, GroupedBarChart, HorizontalBarChart, Button } from '../ui';
import { CARD_FRAME } from '../ui/Card';

// The top of a customer's ledger: the all-time figures (balance due, billed, paid, returns, bills,
// credit limit used, last purchase) and — worked out here from the statement, no extra backend —
// a "bought vs paid" bar per month and the products this customer buys most (last 6 months).

const MONTHS = 6;
const MAX_PAGES = 10; // 200 lines a page — plenty for 6 months of one customer

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const fmtShort = (currency) => (v) => {
    const n = Math.abs(Number(v) || 0);
    if (n >= 1e6) return `${currency} ${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
    if (n >= 1e3) return `${currency} ${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
    return `${currency} ${Math.round(n)}`;
};

const HIDE_KEY = 'ds.customerLedger.hideCharts';

/** Loads the last 6 months of statement lines quietly (no top loading bar). */
function useRecentLines(customerId, reloadKey) {
    const [state, setState] = useState({ loading: true, error: null, lines: [], from: null });
    useEffect(() => {
        if (!customerId) return undefined;
        let cancelled = false;
        const now = new Date();
        const fromDate = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1);
        const params = { period: 'custom', from: ymd(fromDate), to: ymd(now), type: 'all', sort: 'oldest', limit: 200 };
        (async () => {
            setState((s) => ({ ...s, loading: true, error: null }));
            try {
                let lines = [];
                for (let page = 1; page <= MAX_PAGES; page += 1) {
                    const res = await api.get(`/customer/${customerId}/statement`, { params: { ...params, page }, silent: true });
                    const data = res.data || {};
                    lines = lines.concat(data.entries || []);
                    if (!data.pagination?.hasMore || !(data.entries || []).length) break;
                }
                if (!cancelled) setState({ loading: false, error: null, lines, from: fromDate });
            } catch (err) {
                if (!cancelled) setState({ loading: false, error: err.response?.data?.message || 'Could not load', lines: [], from: fromDate });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [customerId, reloadKey]);
    return state;
}

const Figure = ({ label, value, tone, sub, className, children }) => (
    <div className={cn('px-5 py-4 min-w-0', className)}>
        <p className="font-mono text-overline-lg uppercase text-muted-foreground truncate">{label}</p>
        <p className={cn('mt-1 font-heading text-h4 tabular-nums truncate', tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'destructive' ? 'text-destructive' : 'text-foreground')}>
            {value}
        </p>
        {sub ? <p className="mt-0.5 text-body-sm text-muted-foreground truncate">{sub}</p> : null}
        {children}
    </div>
);

/**
 * <LedgerOverview customer={…} summary={statement.summary} currency="PKR" fmt={formatCurrency} onViewBills={…} />
 */
export default function LedgerOverview({ customer, summary = {}, currency = 'PKR', fmt, onViewBills }) {
    const amountDue = summary.amountDue || 0;
    const creditLimit = Number(customer?.creditLimit) || 0;
    const usedPct = creditLimit > 0 ? Math.max(0, (amountDue / creditLimit) * 100) : 0;
    const usedTone = usedPct >= 100 ? 'bg-destructive' : usedPct >= 80 ? 'bg-warning' : 'bg-primary';

    const [hidden, setHidden] = useState(() => {
        try {
            return localStorage.getItem(HIDE_KEY) === '1';
        } catch {
            return false;
        }
    });
    const toggle = () =>
        setHidden((h) => {
            try {
                localStorage.setItem(HIDE_KEY, h ? '0' : '1');
            } catch {
                /* ignore */
            }
            return !h;
        });

    // reload the charts whenever the all-time figures change (payment, new bill, return…)
    const reloadKey = `${summary.totalBilled}|${summary.totalPaid}|${summary.totalReturns}|${amountDue}`;
    // wait for the statement's figures first, so the charts load once (not once before, once after)
    const ready = !hidden && summary.totalBilled !== undefined;
    const recent = useRecentLines(ready ? customer?._id : null, reloadKey);

    const { months, products, lastPurchase } = useMemo(() => {
        const now = new Date();
        const byMonth = [];
        for (let i = MONTHS - 1; i >= 0; i -= 1) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            byMonth.push({ key: monthKey(d), label: d.toLocaleDateString('en-GB', { month: 'short' }), full: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), bought: 0, paid: 0 });
        }
        const idx = Object.fromEntries(byMonth.map((m, i) => [m.key, i]));
        const prod = new Map();
        let last = null;
        recent.lines.forEach((e) => {
            if (e.type === 'cancelled') return;
            const d = new Date(e.date);
            const m = byMonth[idx[monthKey(d)]];
            if (e.type === 'bill') {
                if (m) m.bought += Number(e.debit) || 0;
                if (!last || d > last) last = d;
                (e.items || []).forEach((it) => {
                    const qty = Number(it.qty) || 0;
                    const keep = Number(it.remainingQty ?? qty);
                    if (keep <= 0) return;
                    const amount = qty > 0 ? ((Number(it.itemTotal) || 0) * keep) / qty : 0;
                    const key = it.product || it.name;
                    const p = prod.get(key) || { key, label: it.name || 'Item', value: 0, qty: 0, bills: 0 };
                    p.value += amount;
                    p.qty += keep;
                    p.bills += 1;
                    prod.set(key, p);
                });
            } else if (e.type === 'payment') {
                if (m) m.paid += Number(e.credit) || 0;
            }
        });
        const top = [...prod.values()].sort((a, b) => b.value - a.value).slice(0, 5);
        return { months: byMonth, products: top, lastPurchase: last };
    }, [recent.lines]);

    const lastBuy = customer?.lastPurchase ? new Date(customer.lastPurchase) : lastPurchase;
    const daysAgo = lastBuy ? Math.floor((Date.now() - lastBuy.getTime()) / 86400000) : null;
    const short = fmtShort(currency);
    const noActivity = !months.some((m) => m.bought || m.paid);

    return (
        <div className="mb-5 flex flex-col gap-4">
            {/* Figures */}
            <div className={cn(CARD_FRAME, 'overflow-hidden grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-hairline [&>*]:border-hairline [&>*]:border-b xl:[&>*]:border-b-0 [&>*:not(:last-child)]:border-r')}>
                <button
                    type="button"
                    onClick={onViewBills}
                    disabled={amountDue === 0}
                    className={cn(
                        'col-span-2 md:col-span-1 text-left px-5 py-4 min-w-0 transition-colors enabled:hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                        amountDue > 0 && 'bg-destructive-chip/40',
                        amountDue < 0 && 'bg-success-chip/40'
                    )}
                >
                    <span className="font-mono text-overline-lg uppercase text-muted-foreground">{amountDue < 0 ? 'Store credit' : 'Balance due'}</span>
                    <span className={cn('mt-1 block font-heading text-h3 tabular-nums', amountDue > 0 ? 'text-destructive' : amountDue < 0 ? 'text-success' : 'text-foreground')}>
                        {fmt(Math.abs(amountDue))}
                    </span>
                    {creditLimit > 0 ? (
                        <span className="mt-1.5 block">
                            <span className="block h-1.5 rounded-full bg-muted overflow-hidden">
                                <span className={cn('block h-full rounded-full', usedTone)} style={{ width: `${Math.min(100, usedPct)}%` }} />
                            </span>
                            <span className={cn('mt-1 block text-body-sm', usedPct >= 100 ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                                {Math.round(usedPct)}% of {fmt(creditLimit)} limit{usedPct >= 100 ? ' — over the limit' : ` · ${fmt(Math.max(0, creditLimit - amountDue))} left`}
                            </span>
                        </span>
                    ) : (
                        <span className="mt-1 block text-body-sm text-muted-foreground">No credit limit</span>
                    )}
                    {amountDue !== 0 ? (
                        <span className={cn('mt-1.5 inline-flex items-center text-body-sm font-medium', amountDue > 0 ? 'text-destructive' : 'text-success')}>
                            View bills <FiChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                    ) : null}
                </button>
                <Figure label="Total billed" value={fmt(summary.totalBilled || 0)} />
                <Figure label="Total paid" value={fmt(summary.totalPaid || 0)} tone="success" />
                <Figure label="Returns" value={fmt(summary.totalReturns || 0)} tone={summary.totalReturns ? 'warning' : undefined} />
                <Figure
                    label="Bills"
                    value={(summary.totalBills || 0).toLocaleString()}
                    sub={summary.totalBills ? `avg ${fmt((summary.totalBilled || 0) / summary.totalBills)}` : null}
                />
                <Figure
                    label="Last purchase"
                    value={lastBuy ? lastBuy.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    sub={daysAgo == null ? 'No bills yet' : daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
                />
            </div>

            {/* Charts (last 6 months) */}
            <div className="flex items-center justify-between -mb-2">
                <p className="text-body-sm text-muted-foreground">{hidden ? 'Charts hidden' : `Last ${MONTHS} months`}</p>
                <Button variant="ghost" size="xs" onClick={toggle} aria-expanded={!hidden}>
                    {hidden ? <FiChevronDown aria-hidden="true" /> : <FiChevronUp aria-hidden="true" />}
                    {hidden ? 'Show charts' : 'Hide charts'}
                </Button>
            </div>
            {hidden ? null : (
                <div className="grid gap-4 lg:grid-cols-5">
                    <ChartPanel
                        className="lg:col-span-3"
                        title="Bought vs paid"
                        description="Billed and paid each month"
                        loading={recent.loading}
                        error={recent.error}
                        isEmpty={noActivity}
                        empty={{ icon: FiBarChart2, title: 'No activity', description: `No bills or payments in the last ${MONTHS} months.` }}
                        table={{
                            filename: `${(customer?.name || 'customer').replace(/\s+/g, '_')}-bought-vs-paid`,
                            columns: [
                                { key: 'full', label: 'Month' },
                                { key: 'bought', label: 'Bought', align: 'right', format: fmt },
                                { key: 'paid', label: 'Paid', align: 'right', format: fmt },
                            ],
                            rows: months,
                        }}
                    >
                        <GroupedBarChart
                            data={months}
                            series={[
                                { key: 'bought', label: 'Bought' },
                                { key: 'paid', label: 'Paid', color: 'var(--success)' },
                            ]}
                            format={fmt}
                            axisFormat={short}
                            tooltipTitle={(d) => d.full}
                            height={220}
                        />
                    </ChartPanel>
                    <ChartPanel
                        className="lg:col-span-2"
                        title="Top products"
                        description="What this customer buys most (after returns)"
                        loading={recent.loading}
                        error={recent.error}
                        isEmpty={!products.length}
                        empty={{ icon: FiShoppingBag, title: 'No products yet', description: `Nothing bought in the last ${MONTHS} months.` }}
                    >
                        <HorizontalBarChart data={products.map((p) => ({ ...p, note: `${p.qty.toLocaleString()} unit${p.qty === 1 ? '' : 's'} · ${p.bills} bill${p.bills === 1 ? '' : 's'}` }))} format={fmt} />
                    </ChartPanel>
                </div>
            )}
        </div>
    );
}
