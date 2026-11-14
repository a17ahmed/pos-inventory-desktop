import React from 'react';
import { FiPrinter, FiDownload, FiSlash, FiCornerDownLeft, FiArrowRight, FiRotateCcw } from 'react-icons/fi';
import {
    cn,
    Drawer,
    DrawerSection,
    DetailList,
    KpiStrip,
    Stat,
    StatusChip,
    Alert,
    Button,
    IconButton,
    TABLE_HEAD_ROW,
    TABLE_TH,
    TABLE_ROW,
    TABLE_TD,
} from '../ui';
import { mergeReceiptItems } from '../../utils/receiptItems';
import { getPrimaryPaymentMethod, formatPaymentMethod } from '../../utils/billCredit';

// One bill, in the same layout as the dashboard windows (design Stage 7): header with the bill
// number and status, a strip of the figures that matter, then the sections. Everything the old
// receipt popup showed is still here; only the layout changed. Opened from Receipts.

const R = 'text-right tabular-nums';

/** A label / amount line for the totals and profit blocks. */
const Line = ({ label, value, tone, strong, sub, sign }) => (
    <div className={cn('flex items-baseline justify-between gap-3 py-1', strong && 'pt-2 mt-1 shadow-[inset_0_1px_0_var(--hairline)] font-semibold', sub && 'text-body-sm text-muted-foreground')}>
        <span className={cn(!strong && !sub && 'text-muted-foreground')}>{label}</span>
        <span className={cn('tabular-nums', tone === 'destructive' && 'text-destructive', tone === 'success' && 'text-success', tone === 'warning' && 'text-warning-chip-foreground')}>
            {sign}
            {value}
        </span>
    </div>
);

export default function BillDetailDrawer({
    receipt: r,
    onClose,
    formatCurrency: money,
    formatDate,
    getReceiptType,
    accountsById,
    canViewProfit,
    onPrint,
    onDownload,
    cancelAllowed,
    onCancel,
    onReturn,
    onOpenCustomer,
}) {
    if (!r) return null;
    const type = getReceiptType(r);
    const total = r.total ?? r.totalBill ?? 0;
    const items = mergeReceiptItems(r.items || []);
    const qty = r.totalQty || (r.items || []).reduce((s, it) => s + (it.qty || it.quantity || 0), 0);
    const hasDiscount = (r.totalDiscount || 0) > 0;
    const hasPayments = r.payments && r.payments.length > 0;
    const method = hasPayments ? getPrimaryPaymentMethod(r) : r.paymentMethod || 'cash';
    const paid = r.amountPaid ?? (hasPayments ? r.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0);
    const due = r.amountDue || 0;
    const refunded = r.totalRefunded || 0;
    const grossSubtotal = (r.items || []).reduce((s, it) => s + it.price * (it.qty || it.quantity || 0), 0);
    const showProfit = canViewProfit && (r.billProfit !== undefined || r.netProfit !== undefined);
    const accountName = (p) => (p.account ? accountsById?.get(String(p.account?._id || p.account))?.name : null);

    return (
        <Drawer
            open
            onClose={onClose}
            size="md"
            eyebrow={`Bill #${r.receiptNumber || r.billNumber}`}
            title={r.customerName || 'Walk-in customer'}
            meta={
                <>
                    <StatusChip
                        size="sm"
                        tone={type.cancelled ? 'neutral' : type.label === 'Refund' ? 'destructive' : 'success'}
                        icon={type.cancelled ? FiSlash : type.label === 'Refund' ? FiCornerDownLeft : undefined}
                        label={type.label}
                    />
                    {!type.cancelled && r.paymentStatus && r.paymentStatus !== 'paid' ? (
                        <StatusChip size="sm" tone={r.paymentStatus === 'unpaid' ? 'destructive' : 'warning'} label={r.paymentStatus === 'unpaid' ? 'Unpaid' : 'Partly paid'} />
                    ) : null}
                    {!type.cancelled && r.paymentStatus === 'paid' ? <StatusChip size="sm" tone="success" label="Paid" /> : null}
                    {r.returnStatus && r.returnStatus !== 'none' ? (
                        <StatusChip size="sm" tone="warning" icon={FiCornerDownLeft} label={r.returnStatus === 'full' ? 'Fully returned' : 'Partly returned'} />
                    ) : null}
                    <span className="text-body-sm text-muted-foreground">
                        {formatDate(r.createdAt)}
                        {r.cashierName ? ` · by ${r.cashierName}` : ''}
                    </span>
                </>
            }
            actions={
                <>
                    <IconButton label="Print receipt" size="xs" onClick={() => onPrint(r)}>
                        <FiPrinter />
                    </IconButton>
                    <IconButton label="Download receipt" size="xs" onClick={() => onDownload(r)}>
                        <FiDownload />
                    </IconButton>
                </>
            }
            footerStart={
                cancelAllowed ? (
                    <Button variant="outline" className="text-destructive" onClick={() => onCancel(r)} title="Only for bills created by mistake. If the customer returned goods, use Returns.">
                        <FiSlash aria-hidden="true" />
                        Cancel bill
                    </Button>
                ) : null
            }
            footer={
                <>
                    {onReturn && r.status === 'completed' && r.type !== 'return' && r.returnStatus !== 'full' ? (
                        <Button variant="outline" onClick={() => onReturn(r)} title="Take items from this bill back and refund them">
                            <FiRotateCcw aria-hidden="true" />
                            Return items
                        </Button>
                    ) : null}
                    <Button variant="outline" onClick={() => onPrint(r)}>
                        <FiPrinter aria-hidden="true" />
                        Print
                    </Button>
                    <Button onClick={() => onDownload(r)}>
                        <FiDownload aria-hidden="true" />
                        Download
                    </Button>
                </>
            }
        >
            {type.cancelled && (
                <DrawerSection>
                    <Alert tone="neutral" icon={FiSlash} title={`${type.label}${r.cancelledAt ? ` on ${formatDate(r.cancelledAt)}` : ''}${r.cancelledByName || r.cancelledBy?.name ? ` by ${r.cancelledByName || r.cancelledBy?.name}` : ''}`}>
                        {r.cancelReason ? `Reason: ${r.cancelReason}. ` : ''}Not counted in reports, the cash book or the customer's balance.
                    </Alert>
                </DrawerSection>
            )}

            {/* The figures */}
            <DrawerSection>
                <KpiStrip cols={4} className="gap-y-4">
                    <Stat label="Total" value={money(Math.abs(total))} tone={total < 0 ? 'destructive' : undefined} note={`${qty} item${qty === 1 ? '' : 's'} · ${items.length} product${items.length === 1 ? '' : 's'}`} />
                    <Stat label="Paid" value={money(paid)} note={<span className="capitalize">{String(method).replace(/_/g, ' ')}</span>} tone={paid > 0 ? 'success' : undefined} />
                    <Stat
                        label={due < 0 ? 'Credit (overpaid)' : 'Due'}
                        value={money(Math.abs(due))}
                        tone={due > 0 ? 'destructive' : due < 0 ? 'success' : undefined}
                        note={due > 0 ? 'Not paid yet' : due < 0 ? 'Kept as store credit' : 'Nothing owed'}
                    />
                    {showProfit ? (
                        <Stat label="Profit" value={money(r.netProfit ?? r.billProfit ?? 0)} tone={(r.netProfit ?? r.billProfit ?? 0) < 0 ? 'destructive' : 'success'} note={refunded > 0 ? 'After returns' : undefined} />
                    ) : (
                        <Stat label="Discount" value={money(r.totalDiscount || 0)} />
                    )}
                    {showProfit && hasDiscount ? <Stat label="Discount" value={money(r.totalDiscount)} tone="warning" /> : null}
                    {refunded > 0 ? <Stat label="Refunded" value={money(refunded)} tone="destructive" note={`Net ${money(r.netAmount ?? total - refunded)}`} /> : null}
                    {(r.cashGiven || 0) > 0 ? <Stat label="Cash given" value={money(r.cashGiven)} note={`Change ${money(r.change || 0)}`} /> : null}
                </KpiStrip>
            </DrawerSection>

            {/* Who / when */}
            <DrawerSection title="Bill">
                <DetailList
                    rows={[
                        [
                            'Customer',
                            <span key="c">
                                {r.customer && onOpenCustomer ? (
                                    <button type="button" onClick={() => onOpenCustomer(r)} className="inline-flex items-center gap-1 text-primary hover:underline">
                                        {r.customerName} <FiArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                ) : (
                                    r.customerName || <span className="text-muted-foreground">Walk-in</span>
                                )}
                                {r.customerPhone ? <span className="block text-body-sm text-muted-foreground font-mono">{r.customerPhone}</span> : null}
                                {r.customerAddress ? <span className="block text-body-sm text-muted-foreground">{r.customerAddress}</span> : null}
                            </span>,
                        ],
                        ['Date & time', formatDate(r.createdAt)],
                        ['Cashier', r.cashierName || '—'],
                        ['Payment', <span key="m" className="capitalize">{String(method).replace(/_/g, ' ')}</span>],
                        ['Status', <span key="s" className="capitalize">{r.status || 'completed'}</span>],
                        ...(r.revisionCount > 0 ? [['Updated', `${r.revisionCount} time${r.revisionCount === 1 ? '' : 's'} (items added later)`]] : []),
                    ]}
                />
            </DrawerSection>

            {/* Items */}
            <DrawerSection title={`Items · ${items.length}`}>
                <div className="-mx-5 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className={TABLE_HEAD_ROW}>
                                <th className={cn(TABLE_TH, 'pl-5')}>Item</th>
                                <th className={cn(TABLE_TH, 'text-right')}>Qty</th>
                                <th className={cn(TABLE_TH, 'text-right')}>Price</th>
                                {hasDiscount && <th className={cn(TABLE_TH, 'text-right')}>Discount</th>}
                                <th className={cn(TABLE_TH, 'text-right pr-5')}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => {
                                const q = item.qty || item.quantity || 0;
                                const line = item.itemTotal || item.price * q;
                                return (
                                    <tr key={i} className={TABLE_ROW}>
                                        <td className={cn(TABLE_TD, 'pl-5 py-2')}>
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-body-sm text-muted-foreground">
                                                {[item.category, item.barcode && `#${item.barcode}`].filter(Boolean).join(' · ')}
                                            </p>
                                            {item.returnedQty > 0 ? <StatusChip className="mt-1" size="xs" shape="tag" tone="warning" label={`${item.returnedQty} returned`} /> : null}
                                        </td>
                                        <td className={cn(TABLE_TD, R)}>{q}</td>
                                        <td className={cn(TABLE_TD, R, 'text-muted-foreground')}>{money(item.price)}</td>
                                        {hasDiscount && (
                                            <td className={cn(TABLE_TD, R, (item.discountAmount || 0) > 0 && 'text-destructive')}>
                                                {(item.discountAmount || 0) > 0 ? `−${money(item.discountAmount)}` : '—'}
                                            </td>
                                        )}
                                        <td className={cn(TABLE_TD, R, 'pr-5 font-medium')}>{money(line)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </DrawerSection>

            {/* Totals */}
            <DrawerSection title="Totals">
                <Line label="Subtotal" value={money(grossSubtotal)} />
                {(r.totalTax || 0) > 0 && <Line label="Tax / GST" value={money(r.totalTax)} sign="+" />}
                {(r.totalItemDiscount || 0) > 0 && <Line label="Item discounts" value={money(r.totalItemDiscount)} sign="−" tone="destructive" />}
                {(r.billDiscountAmount || 0) > 0 && <Line label={`Bill discount${r.billDiscountReason ? ` (${r.billDiscountReason})` : ''}`} value={money(r.billDiscountAmount)} sign="−" tone="destructive" />}
                <Line label="Total" value={money(Math.abs(total))} strong tone={total < 0 ? 'destructive' : undefined} />
                {refunded > 0 && (
                    <>
                        <Line label="Refunded" value={money(refunded)} sign="−" tone="warning" />
                        <Line label="Net amount" value={money(r.netAmount)} strong />
                    </>
                )}
            </DrawerSection>

            {/* Payments */}
            <DrawerSection title="Payments">
                {hasPayments ? (
                    <ul className="flex flex-col">
                        {r.payments.map((p, i) => {
                            const credit = p.creditFrom || p.method === 'store_credit';
                            return (
                                <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 shadow-[inset_0_-1px_0_var(--hairline)] last:shadow-none">
                                    <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className={cn('font-medium', !credit && 'capitalize')}>{credit ? `Paid by credit (from Bill #${p.creditFromBillNumber ?? ''})` : formatPaymentMethod(p)}</span>
                                        {accountName(p) ? <StatusChip size="xs" shape="tag" tone="neutral" label={`→ ${accountName(p)}`} /> : null}
                                        {p.reference ? <span className="font-mono text-mono-xs text-muted-foreground">Ref {p.reference}</span> : null}
                                        {p.note && !credit ? <span className="text-body-sm text-muted-foreground">({p.note})</span> : null}
                                        {p.paidAt ? <span className="text-body-sm text-muted-foreground">{formatDate(p.paidAt)}</span> : null}
                                    </div>
                                    <span className="flex-none font-medium tabular-nums">{money(p.amount)}</span>
                                </li>
                            );
                        })}
                    </ul>
                ) : paid > 0 ? (
                    <Line label={<span className="capitalize">{String(method)}</span>} value={money(paid)} />
                ) : (
                    <p className="text-body-sm text-muted-foreground">No payments recorded.</p>
                )}
                {(r.cashGiven || 0) > 0 && (
                    <div className="mt-1">
                        <Line label="Cash given" value={money(r.cashGiven)} sub />
                        <Line label="Change" value={money(r.change || 0)} sub />
                    </div>
                )}
                {due !== 0 && <Line label={due > 0 ? 'Amount due' : 'Credit (overpaid)'} value={money(Math.abs(due))} strong tone={due > 0 ? 'destructive' : 'success'} />}
            </DrawerSection>

            {/* Returns */}
            {r.returns && r.returns.length > 0 && (
                <DrawerSection title={`Returns · ${r.returns.length}`}>
                    <div className="flex flex-col gap-3">
                        {r.returns.map((ret, i) => (
                            <div key={i} className="rounded-xl border border-hairline bg-warning-chip/40 px-3 py-2">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="font-medium">Return {ret.returnNumber || `#${i + 1}`}</span>
                                    <span className="text-body-sm text-muted-foreground">
                                        {ret.returnedAt ? formatDate(ret.returnedAt) : '—'}
                                        {ret.processedByName ? ` · by ${ret.processedByName}` : ''}
                                    </span>
                                </div>
                                {ret.items?.map((it, j) => (
                                    <div key={j} className="flex justify-between gap-3 py-0.5 text-body">
                                        <span>
                                            {it.name} × {it.quantity}
                                            {it.reason ? <span className="ml-2 text-body-sm text-muted-foreground capitalize">({it.reason.replace('_', ' ')})</span> : null}
                                        </span>
                                        <span className="tabular-nums text-destructive">−{money(it.refundAmount)}</span>
                                    </div>
                                ))}
                                <Line label={<span className="capitalize">Refund ({ret.refundMethod?.replace('_', ' ') || 'cash'})</span>} value={money(ret.cashRefundAmount ?? ret.refundAmount)} sign="−" strong tone="destructive" />
                                {ret.debtCancelled > 0 && <Line label="Outstanding balance cancelled" value={money(ret.debtCancelled)} sub />}
                            </div>
                        ))}
                    </div>
                </DrawerSection>
            )}

            {/* Profit — only with the pos.viewProfit permission, as before */}
            {showProfit &&
                (() => {
                    const totalCost = r.totalCost || 0;
                    const returnedCost = (r.items || []).reduce((s, it) => s + (it.costPrice || 0) * (it.returnedQty || 0), 0);
                    const netProfit = r.netProfit || 0;
                    return (
                        <DrawerSection title="Profit">
                            <Line label="Revenue (sale total)" value={money(r.total)} />
                            <Line label="Cost of goods" value={money(totalCost)} sign="−" tone="destructive" />
                            <Line label="Gross profit" value={money(r.billProfit || 0)} strong tone={(r.billProfit || 0) < 0 ? 'destructive' : 'success'} />
                            {refunded > 0 && (
                                <>
                                    <p className="mt-2 font-mono text-overline-lg uppercase text-muted-foreground">After returns</p>
                                    <Line label="Refunded to customer" value={money(refunded)} sign="−" tone="warning" />
                                    <Line label="Cost recovered (restocked)" value={money(returnedCost)} sign="+" tone="success" />
                                    <Line label="Kept revenue" value={money((r.total || 0) - refunded)} sub />
                                    <Line label="Kept cost" value={money(totalCost - returnedCost)} sub />
                                </>
                            )}
                            <Line label="Net profit" value={money(netProfit)} strong tone={netProfit < 0 ? 'destructive' : 'success'} />
                            {(r.items || []).length > 0 && (
                                <div className="mt-3">
                                    <p className="font-mono text-overline-lg uppercase text-muted-foreground mb-1">Cost per item</p>
                                    {r.items.map((it, idx) => {
                                        const q = it.qty || it.quantity || 0;
                                        const p = it.netProfit ?? it.itemProfit ?? 0;
                                        return (
                                            <div key={idx} className="flex justify-between gap-3 py-0.5 text-body-sm">
                                                <span className="text-muted-foreground">
                                                    {it.name} · cost {money(it.costPrice || 0)} × {q}
                                                    {it.returnedQty > 0 ? `, ${it.returnedQty} returned` : ''}
                                                </span>
                                                <span className={cn('tabular-nums font-medium', p < 0 ? 'text-destructive' : 'text-success')}>{money(p)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </DrawerSection>
                    );
                })()}

            {r.notes ? (
                <DrawerSection title="Note">
                    <p>{r.notes}</p>
                </DrawerSection>
            ) : null}
        </Drawer>
    );
}
