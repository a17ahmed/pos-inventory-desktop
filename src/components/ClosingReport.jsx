import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import AccountReconciliation from './moneybook/AccountReconciliation';
import {
    FiChevronDown,
    FiChevronRight,
    FiDollarSign,
    FiCreditCard,
    FiSmartphone,
    FiPackage,
    FiExternalLink,
    FiPhone,
    FiCheckCircle,
    FiAlertTriangle,
} from 'react-icons/fi';
import {
    cn,
    KpiStrip,
    KpiCard,
    SectionCard,
    StatusChip,
    Button,
    Dialog,
    EmptyState,
    TablePager,
    CARD_FRAME,
    TABLE_CARD,
    TABLE_TH,
    TABLE_TD,
    TABLE_ROW,
    TABLE_SCROLL,
} from './ui';
import { formatAmount } from '../utils/money';

const METHOD = {
    cash: { label: 'Cash', tone: 'success' },
    card: { label: 'Card', tone: 'info' },
    upi: { label: 'Online', tone: 'accent' },
    online: { label: 'Online', tone: 'accent' },
    store_credit: { label: 'Store credit', tone: 'warning' },
    credit: { label: 'On credit', tone: 'destructive' },
    mixed: { label: 'Mixed', tone: 'neutral' },
};

const TENDER_META = {
    cash: { label: 'Cash', icon: FiDollarSign, expectedLabel: 'Expected in drawer', hint: 'Count the drawer' },
    card: { label: 'Card', icon: FiCreditCard, expectedLabel: 'Expected this period', hint: 'Check the card machine / bank statement' },
    online: { label: 'Online', icon: FiSmartphone, expectedLabel: 'Expected this period', hint: 'Check the wallet / bank statement' },
};

/** label · value line in the Sales and Settlement cards. */
const Line = ({ label, value, tone, strong, icon: Icon, onClick, className }) => {
    const valueClass = cn(
        'tabular-nums whitespace-nowrap',
        strong ? 'font-semibold' : '',
        tone === 'muted' ? 'text-muted-foreground' : tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : 'text-foreground'
    );
    const inner = (
        <>
            <span className={cn('flex items-center gap-2 min-w-0', strong ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> : null}
                {label}
            </span>
            <span className="flex items-center gap-1">
                <span className={valueClass}>{value}</span>
                {onClick ? <FiChevronRight className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> : null}
            </span>
        </>
    );
    const base = cn('flex items-center justify-between gap-3 py-1.5 text-body', className);
    return onClick ? (
        <button type="button" onClick={onClick} className={cn(base, 'w-full -mx-2 px-2 rounded-row text-left hover:bg-[var(--hover-overlay)]')} style={{ width: 'calc(100% + 1rem)' }}>
            {inner}
        </button>
    ) : (
        <div className={base}>{inner}</div>
    );
};

const Rule = () => <div className="my-1.5 border-t border-hairline" />;

const ClosingReport = ({ data, tenderEditors, accountEditors }) => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    const [expandedBill, setExpandedBill] = useState(null);
    const [billPage, setBillPage] = useState(1);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const PAGE_SIZE = 10;

    const currency = business?.currency || 'PKR';
    const fmt = (amount) => formatAmount(amount, { currency, decimals: 2 });

    if (!data) return null;

    const {
        grossSales, totalDiscounts, totalReturns, netSales, totalOrders, totalItemsSold,
        cogs, grossProfit, totalExpenses, netProfit,
        cashSales, cardSales, upiSales, storeCreditUsed, creditExtended, creditExtendedByCustomer = [],
        settlementTotal, costPlusProfit, reconciled, reconciliationDifference,
        collectionsReceived, outstandingReceivable,
        tenderReconciliation = {},
        accountReconciliation = [],
        totalMoneyExpected = null,
        bills = [],
    } = data;

    const bal = (v) => Number(v || 0);
    const isNegCredit = bal(outstandingReceivable) < 0;

    const varianceLabel = (v) => {
        if (v == null) return '—';
        if (v === 0) return 'Exact match';
        return v < 0 ? `Short ${fmt(Math.abs(v))}` : `Over ${fmt(Math.abs(v))}`;
    };

    const tenders = ['cash', 'card', 'online'].map((k) => ({
        key: k,
        t: tenderReconciliation[k] || { expected: 0, counted: null, variance: null, reconciled: null },
    }));
    const matched = tenders.filter(({ t }) => t.reconciled === true).length;
    const mismatched = tenders.filter(({ t }) => t.reconciled === false).length;

    const billPages = Math.max(1, Math.ceil(bills.length / PAGE_SIZE));
    const page = Math.min(billPage, billPages);
    const visibleBills = bills.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="flex flex-col gap-5">
            {/* Headline figures */}
            <KpiStrip cols={4}>
                <KpiCard size="sm" label="Net sales" value={fmt(netSales)} note={`${(totalOrders || 0).toLocaleString()} bills · ${(totalItemsSold || 0).toLocaleString()} items`} />
                <KpiCard size="sm" label="Net profit" value={fmt(netProfit)} tone={bal(netProfit) < 0 ? 'destructive' : 'success'} note={`after ${fmt(totalExpenses)} expenses`} />
                <KpiCard size="sm" label="Credit given" value={fmt(creditExtended)} note={creditExtendedByCustomer.length ? `${creditExtendedByCustomer.length} customer${creditExtendedByCustomer.length === 1 ? '' : 's'}` : 'none this period'} />
                <KpiCard
                    size="sm"
                    label="Money check"
                    value={`${matched} of 3 match`}
                    tone={mismatched ? 'destructive' : matched === 3 ? 'success' : undefined}
                    note={mismatched ? `${mismatched} with a difference` : matched === 3 ? 'Cash, card and online all match' : 'Type what you counted below'}
                />
            </KpiStrip>

            {/* Money Book: per-account counted vs expected (closings before the Money Book skip this) */}
            <AccountReconciliation rows={accountReconciliation} totalMoneyExpected={totalMoneyExpected} fmt={fmt} editors={accountEditors} />

            {/* Tender check — does each tender match what the books say? Each is checked on its own. */}
            <section aria-label="Cash, card and online check">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {tenders.map(({ key, t }) => {
                        const m = TENDER_META[key];
                        const Icon = m.icon;
                        const editor = tenderEditors?.[key];
                        const tone = t.reconciled === true ? 'success' : t.reconciled === false ? (bal(t.variance) < 0 ? 'destructive' : 'warning') : 'neutral';
                        return (
                            <div
                                key={key}
                                className={cn(
                                    CARD_FRAME,
                                    'p-4 flex flex-col gap-3',
                                    t.reconciled === false && 'border-destructive/40'
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 font-heading text-h4 text-foreground">
                                        <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                        {m.label}
                                    </span>
                                    <StatusChip
                                        size="sm"
                                        tone={tone}
                                        icon={t.reconciled === true ? FiCheckCircle : t.reconciled === false ? FiAlertTriangle : null}
                                        label={t.reconciled === true ? 'Matches' : t.reconciled === false ? varianceLabel(t.variance) : 'Not checked'}
                                    />
                                </div>
                                <dl className="grid grid-cols-2 gap-3">
                                    <div>
                                        <dt className="font-mono text-overline-lg uppercase text-muted-foreground">{m.expectedLabel}</dt>
                                        <dd className="mt-1 text-body-lg font-semibold tabular-nums text-foreground">{fmt(t.expected)}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-mono text-overline-lg uppercase text-muted-foreground">Difference</dt>
                                        <dd
                                            className={cn(
                                                'mt-1 text-body-lg font-semibold tabular-nums',
                                                t.reconciled === true ? 'text-success' : t.reconciled === false ? (bal(t.variance) < 0 ? 'text-destructive' : 'text-warning-chip-foreground') : 'text-muted-foreground'
                                            )}
                                        >
                                            {t.variance != null ? `${t.variance > 0 ? '+' : ''}${fmt(t.variance)}` : '—'}
                                        </dd>
                                    </div>
                                </dl>
                                <div>
                                    <p className="font-mono text-overline-lg uppercase text-muted-foreground mb-1">Counted</p>
                                    {editor || <p className="text-body-lg font-semibold tabular-nums text-foreground">{t.counted != null ? fmt(t.counted) : '—'}</p>}
                                    <p className="mt-1 text-caption text-muted-foreground">
                                        {m.hint}
                                        {key === 'cash' ? (
                                            <>
                                                {' · '}
                                                <Button variant="link" className="text-caption" onClick={() => navigate('/cashbook')}>
                                                    Drawer detail
                                                    <FiExternalLink aria-hidden="true" />
                                                </Button>
                                            </>
                                        ) : null}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* Internal consistency check only: cost + profit vs settlement is forced equal by the bill
                    maths, so it can't catch a miscount — it only flags a data problem. */}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
                    <span>Sales maths check:</span>
                    <span>cost + profit {fmt(costPlusProfit)}</span>
                    <span>· settled {fmt(settlementTotal)}</span>
                    {reconciled ? (
                        <span className="inline-flex items-center gap-1 text-success">
                            <FiCheckCircle className="w-3 h-3" aria-hidden="true" /> adds up
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-destructive">
                            <FiAlertTriangle className="w-3 h-3" aria-hidden="true" /> {fmt(reconciliationDifference)} off — a data problem, tell support
                        </span>
                    )}
                </p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Sales and profit">
                    <Line label="Gross sales" value={fmt(grossSales)} />
                    <Line label="Discounts" value={`− ${fmt(totalDiscounts)}`} tone="muted" />
                    <Line label="Returns" value={`− ${fmt(totalReturns)}`} tone="muted" />
                    <Line label="Net sales" value={fmt(netSales)} strong />
                    <Rule />
                    <Line label="Cost of goods sold" value={`− ${fmt(cogs)}`} tone="muted" />
                    <Line label="Gross profit" value={fmt(grossProfit)} strong />
                    <Line label="Expenses" value={`− ${fmt(totalExpenses)}`} tone="muted" />
                    <Line label="Net profit" value={fmt(netProfit)} strong tone={bal(netProfit) < 0 ? 'destructive' : 'success'} />
                </SectionCard>

                <SectionCard title="How it was paid">
                    <Line icon={FiDollarSign} label="Cash" value={fmt(cashSales)} />
                    <Line icon={FiCreditCard} label="Card" value={fmt(cardSales)} />
                    <Line icon={FiSmartphone} label="Online" value={fmt(upiSales)} />
                    <Line label="Store credit used" value={fmt(storeCreditUsed)} />
                    <Line
                        label="Given on credit"
                        value={fmt(creditExtended)}
                        onClick={creditExtendedByCustomer.length > 0 ? () => setShowCreditModal(true) : undefined}
                    />
                    <Rule />
                    <Line label="Total" value={fmt(settlementTotal)} strong />
                    <p className="mt-3 font-mono text-overline-lg uppercase text-muted-foreground">Customer balances — for information</p>
                    <Line label="Old credit paid back" value={fmt(collectionsReceived)} tone="muted" />
                    <Line
                        label="Still owed by customers"
                        value={isNegCredit ? `${fmt(Math.abs(bal(outstandingReceivable)))} (shop owes them)` : fmt(outstandingReceivable)}
                    />
                </SectionCard>
            </div>

            {/* Bill by bill */}
            <section className={TABLE_CARD} aria-labelledby="closing-bills-title">
                <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
                    <div>
                        <h3 id="closing-bills-title" className="font-heading text-h4 text-foreground">
                            Bills
                        </h3>
                        <p className="mt-0.5 text-caption text-muted-foreground">
                            {bills.length} in this period · click one to see its items
                        </p>
                    </div>
                </div>
                {bills.length === 0 ? (
                    <EmptyState icon={FiPackage} title="No bills in this period" size="sm" />
                ) : (
                    <>
                        <div className={TABLE_SCROLL}>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TABLE_TH, 'w-8')}>
                                            <span className="sr-only">Open</span>
                                        </th>
                                        <th className={TABLE_TH}>Bill</th>
                                        <th className={TABLE_TH}>Date</th>
                                        <th className={TABLE_TH}>Customer</th>
                                        <th className={TABLE_TH}>Paid by</th>
                                        <th className={cn(TABLE_TH, 'text-right')}>Total</th>
                                        <th className={cn(TABLE_TH, 'text-right')}>Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleBills.map((b, idx) => {
                                        const key = b.billNumber ?? idx;
                                        const isOpen = expandedBill === key;
                                        const creditAmt = b.creditAmount ?? b.amountDue ?? 0;
                                        const method = METHOD[b.paymentMethod] || { label: b.paymentMethod || 'Unknown', tone: 'neutral' };
                                        return (
                                            <React.Fragment key={key}>
                                                <tr
                                                    className={cn(TABLE_ROW, 'cursor-pointer', isOpen && 'bg-muted/40')}
                                                    onClick={() => setExpandedBill(isOpen ? null : key)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setExpandedBill(isOpen ? null : key);
                                                        }
                                                    }}
                                                    tabIndex={0}
                                                    aria-expanded={isOpen}
                                                    aria-label={`Bill #${b.billNumber}, ${isOpen ? 'hide' : 'show'} items`}
                                                >
                                                    <td className={cn(TABLE_TD, 'text-muted-foreground')}>
                                                        {isOpen ? <FiChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <FiChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
                                                    </td>
                                                    <td className={cn(TABLE_TD, 'font-mono font-medium')}>#{b.billNumber}</td>
                                                    <td className={cn(TABLE_TD, 'text-muted-foreground whitespace-nowrap')}>
                                                        {b.date ? new Date(b.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}
                                                    </td>
                                                    <td className={TABLE_TD}>{b.customerName || <span className="text-muted-foreground">Walk-in</span>}</td>
                                                    <td className={TABLE_TD}>
                                                        <StatusChip size="sm" tone={method.tone} label={method.label} />
                                                    </td>
                                                    <td className={cn(TABLE_TD, 'text-right tabular-nums font-medium whitespace-nowrap')}>{fmt(b.billTotal)}</td>
                                                    <td className={cn(TABLE_TD, 'text-right tabular-nums whitespace-nowrap', bal(b.billProfit) < 0 ? 'text-destructive' : 'text-success')}>
                                                        {fmt(b.billProfit)}
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr className="bg-muted/40 shadow-[inset_0_-1px_0_var(--hairline)]">
                                                        <td colSpan={7} className="px-4 pb-3 pt-1">
                                                            <div className="rounded-xl border border-hairline bg-card overflow-hidden">
                                                                <table className="w-full border-collapse text-body-sm">
                                                                    <thead>
                                                                        <tr className="text-muted-foreground">
                                                                            <th className="text-left font-medium py-1.5 px-3">Item</th>
                                                                            <th className="text-right font-medium py-1.5 px-3">Qty</th>
                                                                            <th className="text-right font-medium py-1.5 px-3">Price</th>
                                                                            <th className="text-right font-medium py-1.5 px-3">Cost</th>
                                                                            <th className="text-right font-medium py-1.5 px-3">Profit</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(b.items || []).map((it, i) => {
                                                                            const lp = it.lineProfit ?? ((it.price || 0) - (it.costPrice || 0)) * (it.qty || 0);
                                                                            return (
                                                                                <tr key={i} className="border-t border-hairline">
                                                                                    <td className="py-1.5 px-3 text-foreground">{it.name}</td>
                                                                                    <td className="py-1.5 px-3 text-right tabular-nums">× {it.qty}</td>
                                                                                    <td className="py-1.5 px-3 text-right tabular-nums">{fmt(it.price)}</td>
                                                                                    <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{fmt(it.costPrice)}</td>
                                                                                    <td className={cn('py-1.5 px-3 text-right tabular-nums font-medium', lp < 0 ? 'text-destructive' : 'text-success')}>{fmt(lp)}</td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/40 border-t border-hairline text-body-sm text-muted-foreground">
                                                                    <span>Paid {fmt(b.amountPaid)}</span>
                                                                    <span className={creditAmt < 0 ? 'text-info' : creditAmt > 0 ? 'text-destructive' : ''}>
                                                                        {creditAmt < 0
                                                                            ? `Shop owes the customer ${fmt(Math.abs(creditAmt))}`
                                                                            : creditAmt > 0
                                                                              ? `On credit ${fmt(creditAmt)}`
                                                                              : 'Fully paid'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {billPages > 1 ? (
                            <TablePager page={page} pageSize={PAGE_SIZE} total={bills.length} onPageChange={setBillPage} noun="bills" />
                        ) : null}
                    </>
                )}
            </section>

            {/* Given on credit — who owes what */}
            <Dialog
                open={showCreditModal}
                onClose={() => setShowCreditModal(false)}
                closeOnScrim
                title="Given on credit"
                description={`${creditExtendedByCustomer.length} customer${creditExtendedByCustomer.length === 1 ? '' : 's'} · ${fmt(creditExtended)} in all`}
                flush
            >
                <ul className="divide-y divide-[var(--hairline)] border-t border-hairline">
                    {creditExtendedByCustomer.map((c, i) => (
                        <li key={c.customerId || i} className="flex items-center justify-between gap-3 px-5 py-3">
                            <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{c.customerName || 'Unknown'}</p>
                                {c.customerPhone ? (
                                    <a href={`tel:${c.customerPhone}`} className="mt-0.5 inline-flex items-center gap-1 text-body-sm text-primary hover:underline">
                                        <FiPhone className="w-3 h-3" aria-hidden="true" />
                                        {c.customerPhone}
                                    </a>
                                ) : null}
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-semibold tabular-nums text-foreground">{fmt(c.amount)}</p>
                                <p className="text-caption text-muted-foreground">
                                    {c.billCount} bill{c.billCount === 1 ? '' : 's'}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
};

export default ClosingReport;
