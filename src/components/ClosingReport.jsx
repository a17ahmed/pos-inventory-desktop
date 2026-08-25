import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import {
    FiChevronDown,
    FiChevronRight,
    FiDollarSign,
    FiCreditCard,
    FiSmartphone,
    FiUsers,
    FiPackage,
    FiExternalLink,
    FiX,
    FiPhone,
} from 'react-icons/fi';

const PAYMENT_META = {
    cash: { label: 'Cash', color: 'text-emerald-600 dark:text-d-green bg-emerald-50 dark:bg-[rgba(52,232,161,0.1)]' },
    card: { label: 'Card', color: 'text-blue-600 dark:text-[#60a5fa] bg-blue-50 dark:bg-[rgba(96,165,250,0.1)]' },
    upi: { label: 'UPI', color: 'text-purple-600 dark:text-[#c084fc] bg-purple-50 dark:bg-[rgba(168,85,247,0.1)]' },
    online: { label: 'Online', color: 'text-purple-600 dark:text-[#c084fc] bg-purple-50 dark:bg-[rgba(168,85,247,0.1)]' },
    store_credit: { label: 'Store Credit', color: 'text-amber-600 dark:text-d-accent bg-amber-50 dark:bg-[rgba(255,210,100,0.1)]' },
    credit: { label: 'On Credit', color: 'text-red-600 dark:text-d-red bg-red-50 dark:bg-[rgba(255,107,107,0.1)]' },
    mixed: { label: 'Mixed', color: 'text-slate-600 dark:text-d-text bg-slate-100 dark:bg-d-glass' },
};

const TENDER_META = {
    cash: { label: 'Cash', icon: FiDollarSign, iconColor: 'text-emerald-500', expectedLabel: 'Expected (drawer, all-time)', hint: 'Physically count the drawer' },
    card: { label: 'Card', icon: FiCreditCard, iconColor: 'text-blue-500', expectedLabel: 'Expected (this period)', hint: 'Check your bank/merchant statement' },
    online: { label: 'Online / UPI', icon: FiSmartphone, iconColor: 'text-purple-500', expectedLabel: 'Expected (this period)', hint: 'Check gateway/bank statement' },
};

const ClosingReport = ({ data, meta, tenderEditors }) => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    const [expandedBill, setExpandedBill] = useState(null);
    const [billPage, setBillPage] = useState(1);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const PAGE_SIZE = 10;

    const currency = business?.currency || 'Rs.';
    const fmt = (amount) =>
        `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (!data) return null;

    const {
        periodStart, periodEnd,
        grossSales, totalDiscounts, totalReturns, netSales, totalOrders, totalItemsSold,
        cogs, grossProfit, totalExpenses, netProfit,
        cashSales, cardSales, upiSales, storeCreditUsed, creditExtended, creditExtendedByCustomer = [],
        settlementTotal, costPlusProfit, reconciled, reconciliationDifference,
        collectionsReceived, outstandingReceivable,
        tenderReconciliation = {},
        bills = [],
    } = data;

    const bal = (v) => Number(v || 0);
    const isNegCredit = bal(outstandingReceivable) < 0;

    const varianceLabel = (v) => {
        if (v == null) return '—';
        if (v === 0) return 'Exact match';
        return v < 0 ? `Short by ${fmt(Math.abs(v))}` : `Over by ${fmt(Math.abs(v))}`;
    };

    const billPages = Math.max(1, Math.ceil(bills.length / PAGE_SIZE));
    const visibleBills = bills.slice((billPage - 1) * PAGE_SIZE, billPage * PAGE_SIZE);

    const paymentBadge = (method) => {
        const m = PAYMENT_META[method] || { label: method || 'Unknown', color: 'text-slate-600 dark:text-d-text bg-slate-100 dark:bg-d-glass' };
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${m.color}`}>
                {m.label}
            </span>
        );
    };

    return (
        <div className="space-y-5">
            {/* Meta header (only present for saved/frozen closings) */}
            {meta && (
                <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-d-heading">
                                Closing #{meta.closingNumber}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-d-muted mt-0.5">
                                {new Date(periodStart).toLocaleString()} &rarr; {new Date(periodEnd).toLocaleString()}
                            </p>
                        </div>
                        <div className="text-right text-sm">
                            <p className="text-slate-500 dark:text-d-muted">
                                Closed by <span className="font-medium text-slate-700 dark:text-d-text">{meta.closedBy?.name || '—'}</span>
                            </p>
                            <p className="text-slate-400 dark:text-d-faint text-xs mt-0.5">
                                {meta.closedAt ? new Date(meta.closedAt).toLocaleString() : ''}
                            </p>
                        </div>
                    </div>
                    {meta.countedNote && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-d-border text-sm text-slate-600 dark:text-d-text">
                            <span className="font-medium">Note: </span>{meta.countedNote}
                        </div>
                    )}
                </div>
            )}

            {/* Tender Reconciliation — the real check: does each externally-verifiable
                tender match what the books say? Cash/Card/Online are independent —
                each is checked (or not) on its own. */}
            <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-d-border">
                {['cash', 'card', 'online'].map((key) => {
                    const meta_ = TENDER_META[key];
                    const t = tenderReconciliation[key] || { expected: 0, counted: null, variance: null, reconciled: null };
                    const Icon = meta_.icon;
                    const editor = tenderEditors?.[key];

                    const badgeClass =
                        t.reconciled === true
                            ? 'bg-emerald-100 dark:bg-[rgba(52,232,161,0.15)] text-emerald-700 dark:text-d-green'
                            : t.reconciled === false
                                ? bal(t.variance) < 0
                                    ? 'bg-red-100 dark:bg-[rgba(255,107,107,0.15)] text-red-700 dark:text-d-red'
                                    : 'bg-amber-100 dark:bg-[rgba(255,210,100,0.15)] text-amber-700 dark:text-d-accent'
                                : 'bg-slate-100 dark:bg-d-glass text-slate-500 dark:text-d-muted';

                    const badgeLabel =
                        t.reconciled === true ? 'Matches' : t.reconciled === false ? varianceLabel(t.variance) : 'Not checked';

                    return (
                        <div key={key} className="p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-d-heading">
                                    <Icon size={16} className={meta_.iconColor} />
                                    {meta_.label}
                                    {key === 'cash' && (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/cashbook')}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium text-primary-600 dark:text-d-accent hover:bg-primary-50 dark:hover:bg-[rgba(255,210,100,0.1)] transition-colors"
                                        >
                                            <FiExternalLink size={12} />
                                            View Detail
                                        </button>
                                    )}
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                                    {badgeLabel}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-d-faint">{meta_.expectedLabel}</p>
                                    <p className="text-base font-bold text-slate-800 dark:text-d-heading mt-0.5">{fmt(t.expected)}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Counted</p>
                                    {editor ? (
                                        <div className="mt-1">{editor}</div>
                                    ) : (
                                        <p className="text-base font-bold text-slate-800 dark:text-d-heading mt-0.5">
                                            {t.counted != null ? fmt(t.counted) : '—'}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-slate-400 dark:text-d-faint mt-1">{meta_.hint}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Variance</p>
                                    <p
                                        className={`text-base font-bold mt-0.5 ${
                                            t.reconciled === true
                                                ? 'text-emerald-700 dark:text-d-green'
                                                : t.reconciled === false
                                                    ? bal(t.variance) < 0
                                                        ? 'text-red-700 dark:text-d-red'
                                                        : 'text-amber-700 dark:text-d-accent'
                                                    : 'text-slate-400 dark:text-d-faint'
                                        }`}
                                    >
                                        {t.variance != null ? fmt(t.variance) : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Sales math check — secondary/internal consistency check only.
                Cost+Profit vs Settlement is algebraically forced to match by the
                bill schema (total = amountPaid + amountDue), so this can never
                catch shrinkage or a miscount — it only flags a genuine data bug. */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-d-glass border border-slate-200 dark:border-d-border rounded-xl px-4 py-3 text-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-d-muted">
                    <FiPackage size={13} />
                    Sales Math Check
                </div>
                <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-d-muted">
                    <span>Cost + Profit: <span className="font-medium text-slate-700 dark:text-d-text">{fmt(costPlusProfit)}</span></span>
                    <span>Settlement: <span className="font-medium text-slate-700 dark:text-d-text">{fmt(settlementTotal)}</span></span>
                    {reconciled ? (
                        <span className="text-emerald-600 dark:text-d-green font-medium">✓ Matches</span>
                    ) : (
                        <span className="text-red-600 dark:text-d-red font-medium">✗ {fmt(reconciliationDifference)} off — data issue</span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Sales & Profit */}
                <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-d-heading uppercase tracking-wide mb-4 flex items-center gap-2">
                        <FiPackage size={14} /> Sales &amp; Profit
                    </h3>
                    <div className="space-y-2 text-sm">
                        <Row label="Gross Sales" value={fmt(grossSales)} />
                        <Row label="Discounts" value={`− ${fmt(totalDiscounts)}`} muted />
                        <Row label="Returns" value={`− ${fmt(totalReturns)}`} muted />
                        <Row label="Net Sales" value={fmt(netSales)} bold />
                        <div className="border-t border-slate-100 dark:border-d-border my-2" />
                        <Row label="Cost of Goods Sold" value={`− ${fmt(cogs)}`} muted />
                        <Row label="Gross Profit" value={fmt(grossProfit)} bold />
                        <Row label="Expenses" value={`− ${fmt(totalExpenses)}`} muted />
                        <Row label="Net Profit" value={fmt(netProfit)} bold highlight />
                        <div className="border-t border-slate-100 dark:border-d-border my-2" />
                        <Row label="Total Orders" value={totalOrders?.toLocaleString() ?? 0} />
                        <Row label="Items Sold" value={totalItemsSold?.toLocaleString() ?? 0} />
                    </div>
                </div>

                {/* Settlement breakdown */}
                <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-d-heading uppercase tracking-wide mb-4 flex items-center gap-2">
                        <FiCreditCard size={14} /> Settlement Breakdown
                    </h3>
                    <div className="space-y-2 text-sm">
                        <Row icon={<FiDollarSign size={13} className="text-emerald-500" />} label="Cash" value={fmt(cashSales)} />
                        <Row icon={<FiCreditCard size={13} className="text-blue-500" />} label="Card" value={fmt(cardSales)} />
                        <Row icon={<FiSmartphone size={13} className="text-purple-500" />} label="UPI / Online" value={fmt(upiSales)} />
                        <Row icon={<FiDollarSign size={13} className="text-amber-500" />} label="Store Credit Used" value={fmt(storeCreditUsed)} />
                        <Row
                            icon={<FiUsers size={13} className="text-red-500" />}
                            label="Credit Extended (new)"
                            value={fmt(creditExtended)}
                            onClick={creditExtendedByCustomer.length > 0 ? () => setShowCreditModal(true) : undefined}
                        />
                        <div className="border-t border-slate-100 dark:border-d-border my-2" />
                        <Row label="Settlement Total" value={fmt(settlementTotal)} bold />
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-d-border">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-d-faint mb-2">
                            Receivables — informational only
                        </p>
                        <div className="space-y-2 text-sm">
                            <Row label="Collections Received (prior credit)" value={fmt(collectionsReceived)} muted />
                            <Row
                                label="Outstanding Receivable"
                                value={isNegCredit ? `${fmt(Math.abs(bal(outstandingReceivable)))} (owed to customer)` : fmt(outstandingReceivable)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bill-by-bill detail */}
            <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-d-border flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-d-heading uppercase tracking-wide">
                        Bill Detail ({bills.length})
                    </h3>
                </div>
                {bills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-d-faint">
                        <FiPackage size={36} />
                        <p className="mt-3 text-sm">No bills in this period</p>
                    </div>
                ) : (
                    <>
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-d-glass">
                                <tr>
                                    <th className="w-8" />
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-d-muted">Bill #</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-d-muted">Date</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-d-muted">Customer</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-d-muted">Method</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 dark:text-d-muted">Total</th>
                                    <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 dark:text-d-muted">Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleBills.map((b, idx) => {
                                    const key = b.billNumber ?? idx;
                                    const isOpen = expandedBill === key;
                                    const creditAmt = b.creditAmount ?? b.amountDue ?? 0;
                                    return (
                                        <React.Fragment key={key}>
                                            <tr
                                                className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] cursor-pointer transition-colors"
                                                onClick={() => setExpandedBill(isOpen ? null : key)}
                                            >
                                                <td className="pl-4 text-slate-400 dark:text-d-faint">
                                                    {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                                                </td>
                                                <td className="py-3 px-4 text-sm font-medium text-slate-800 dark:text-d-heading">
                                                    #{b.billNumber}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-500 dark:text-d-muted">
                                                    {b.date ? new Date(b.date).toLocaleString() : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-600 dark:text-d-text">
                                                    {b.customerName || 'Walk-in'}
                                                </td>
                                                <td className="py-3 px-4">{paymentBadge(b.paymentMethod)}</td>
                                                <td className="py-3 px-4 text-sm text-right font-semibold text-slate-800 dark:text-d-heading">
                                                    {fmt(b.billTotal)}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-right font-semibold text-emerald-600 dark:text-d-green">
                                                    {fmt(b.billProfit)}
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr className="bg-slate-50 dark:bg-[rgba(255,255,255,0.02)]">
                                                    <td colSpan={7} className="px-4 pb-4 pt-1">
                                                        <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl overflow-hidden">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-slate-100 dark:bg-d-glass">
                                                                    <tr>
                                                                        <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-d-muted">Item</th>
                                                                        <th className="text-center py-2 px-3 font-medium text-slate-500 dark:text-d-muted">Qty</th>
                                                                        <th className="text-right py-2 px-3 font-medium text-slate-500 dark:text-d-muted">Price</th>
                                                                        <th className="text-right py-2 px-3 font-medium text-slate-500 dark:text-d-muted">Cost</th>
                                                                        <th className="text-right py-2 px-3 font-medium text-slate-500 dark:text-d-muted">Profit</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(b.items || []).map((it, i) => (
                                                                        <tr key={i} className="border-t border-slate-100 dark:border-d-border">
                                                                            <td className="py-2 px-3 text-slate-700 dark:text-d-text">{it.name}</td>
                                                                            <td className="py-2 px-3 text-center text-slate-600 dark:text-d-muted">× {it.qty}</td>
                                                                            <td className="py-2 px-3 text-right text-slate-600 dark:text-d-muted">{fmt(it.price)}</td>
                                                                            <td className="py-2 px-3 text-right text-slate-600 dark:text-d-muted">{fmt(it.costPrice)}</td>
                                                                            <td className="py-2 px-3 text-right font-semibold text-emerald-600 dark:text-d-green">
                                                                                {fmt(it.lineProfit ?? ((it.price || 0) - (it.costPrice || 0)) * (it.qty || 0))}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-d-glass text-xs text-slate-500 dark:text-d-muted">
                                                                <span>Paid: {fmt(b.amountPaid)}</span>
                                                                <span className={creditAmt < 0 ? 'text-blue-600 dark:text-[#60a5fa]' : creditAmt > 0 ? 'text-red-600 dark:text-d-red' : ''}>
                                                                    {creditAmt < 0
                                                                        ? `Store owes customer: ${fmt(Math.abs(creditAmt))}`
                                                                        : creditAmt > 0
                                                                            ? `On credit: ${fmt(creditAmt)}`
                                                                            : 'Fully settled'}
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

                        {billPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-d-border">
                                <p className="text-sm text-slate-500 dark:text-d-muted">
                                    Page {billPage} of {billPages} ({bills.length} bills)
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        disabled={billPage <= 1}
                                        onClick={() => setBillPage((p) => p - 1)}
                                        className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        disabled={billPage >= billPages}
                                        onClick={() => setBillPage((p) => p + 1)}
                                        className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Credit Extended — who owes what */}
            {showCreditModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Credit Extended</h3>
                                <p className="text-sm text-slate-500 dark:text-d-muted mt-0.5">
                                    {creditExtendedByCustomer.length} customer{creditExtendedByCustomer.length === 1 ? '' : 's'} — {fmt(creditExtended)} total
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCreditModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-500 dark:text-d-muted shrink-0"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {creditExtendedByCustomer.map((c, i) => (
                                <div
                                    key={c.customerId || i}
                                    className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-d-border last:border-b-0"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-800 dark:text-d-heading truncate">{c.customerName || 'Unknown'}</p>
                                        {c.customerPhone && (
                                            <a
                                                href={`tel:${c.customerPhone}`}
                                                className="flex items-center gap-1 text-xs text-primary-600 dark:text-d-accent hover:underline mt-0.5"
                                            >
                                                <FiPhone size={11} />
                                                {c.customerPhone}
                                            </a>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="font-bold text-slate-800 dark:text-d-heading tabular-nums">{fmt(c.amount)}</p>
                                        <p className="text-xs text-slate-400 dark:text-d-faint">
                                            {c.billCount} bill{c.billCount === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Row = ({ label, value, icon, muted, bold, highlight, onClick }) => {
    const content = (
        <>
            <span className={`flex items-center gap-1.5 ${muted ? 'text-slate-400 dark:text-d-faint' : 'text-slate-600 dark:text-d-text'}`}>
                {icon}
                {label}
            </span>
            <span className="flex items-center gap-1">
                <span
                    className={`tabular-nums ${
                        highlight
                            ? 'font-bold text-emerald-600 dark:text-d-green text-base'
                            : bold
                                ? 'font-bold text-slate-800 dark:text-d-heading'
                                : muted
                                    ? 'text-slate-400 dark:text-d-faint'
                                    : 'font-medium text-slate-700 dark:text-d-text'
                    }`}
                >
                    {value}
                </span>
                {onClick && <FiChevronRight size={13} className="text-slate-400 dark:text-d-faint" />}
            </span>
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="w-full flex items-center justify-between -mx-1 px-1 py-0.5 rounded-lg hover:bg-slate-50 dark:hover:bg-d-glass transition-colors text-left"
            >
                {content}
            </button>
        );
    }

    return <div className="flex items-center justify-between">{content}</div>;
};

export default ClosingReport;
