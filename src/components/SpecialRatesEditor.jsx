import React, { useMemo, useState } from 'react';
import { FiSearch, FiTrash2, FiAlertTriangle, FiTag, FiPlus } from 'react-icons/fi';
import { getRateStatus } from '../utils/specialRates';
import { useBusiness } from '../context/BusinessContext';
import { formatAmount } from '../utils/money';
import { cn, Input, IconButton, StatusChip, EmptyState, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from './ui';

/**
 * Edits a customer's special rates (fixed per-unit price per product).
 * Controlled: `value` is a draft list from toDraftRates(); the parent saves it.
 * products: the business's active products (for search, current price and limits).
 * `compact` = one card per product (narrow places like the customer popup); otherwise a table.
 * The rules (what's too high, below cost, beyond the limit) are unchanged — only the look.
 */
const SpecialRatesEditor = ({ value = [], onChange, products = [], readOnly = false, allowSellBelowCost = false, compact = false }) => {
    const { business } = useBusiness();
    const fmt = (n) => formatAmount(n, { currency: business?.currency || 'PKR' });
    const [query, setQuery] = useState('');

    const productsById = useMemo(() => {
        const map = {};
        products.forEach((p) => {
            map[p._id] = p;
        });
        return map;
    }, [products]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const taken = new Set(value.map((r) => r.product));
        return products.filter((p) => !taken.has(p._id) && (p.name?.toLowerCase().includes(q) || p.barcode?.includes(q))).slice(0, 8);
    }, [query, products, value]);

    const addProduct = (p) => {
        onChange([{ product: p._id, rate: '', note: '' }, ...value]);
        setQuery('');
    };
    const updateRow = (productId, patch) => onChange(value.map((r) => (r.product === productId ? { ...r, ...patch } : r)));
    const removeRow = (productId) => onChange(value.filter((r) => r.product !== productId));

    // Everything the row needs, worked out once (same rules as before)
    const rows = value.map((r) => {
        const p = productsById[r.product];
        const price = Number(p?.sellingPrice ?? p?.price) || 0;
        const rate = Number(r.rate);
        const hasRate = r.rate !== '' && rate >= 0;
        const unchanged = r.savedRate != null && rate === Number(r.savedRate);
        const status = p && hasRate ? getRateStatus({ price, costPrice: p.costPrice, maxDiscountPercent: p.maxDiscountPercent }, { rate, priceWhenSaved: unchanged ? r.priceWhenSaved : null }) : null;
        const tooHigh = hasRate && p && rate >= price;
        const warnings = [];
        if (tooHigh) warnings.push({ danger: true, text: `Must be lower than the price (${fmt(price)})` });
        if (!tooHigh && status?.priceChanged) warnings.push({ text: `Price changed ${fmt(status.priceWhenSaved)} → ${fmt(price)} since saved` });
        if (!tooHigh && status?.belowCost) warnings.push({ danger: true, text: `Below cost (${fmt(p.costPrice)})${!allowSellBelowCost ? ' — POS will sell at the limit price' : ''}` });
        if (!tooHigh && status?.beyondLimit && !status?.belowCost) warnings.push({ text: `Beyond discount limit (lowest ${fmt(status.limitPrice)})` });
        return { r, p, price, status, tooHigh, warnings };
    });

    const Warnings = ({ list }) =>
        list.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
                {list.map((w) => (
                    <StatusChip key={w.text} size="xs" shape="tag" tone={w.danger ? 'destructive' : 'warning'} icon={FiAlertTriangle} label={w.text} />
                ))}
            </div>
        ) : null;

    const rateInput = (r) => (
        <Input
            type="number"
            min="0"
            step="0.01"
            mono
            size="xs"
            className="w-28 text-right"
            value={r.rate}
            disabled={readOnly}
            autoFocus={r.rate === '' && !readOnly}
            onChange={(e) => updateRow(r.product, { rate: e.target.value === '' ? '' : Number(e.target.value) })}
            placeholder="0"
            aria-label="Special rate"
        />
    );
    const noteInput = (r, className) => (
        <Input
            size="xs"
            className={className}
            value={r.note}
            disabled={readOnly}
            maxLength={200}
            onChange={(e) => updateRow(r.product, { note: e.target.value })}
            placeholder="Note (optional)"
            aria-label="Note"
        />
    );
    const saving = ({ status, tooHigh }) =>
        status && !tooHigh ? <span className="text-success font-medium tabular-nums">{fmt(status.discountPerUnit)} off</span> : <span className="text-muted-foreground">—</span>;

    return (
        <div className="flex flex-col gap-3">
            <p className="text-body-sm text-muted-foreground">
                A special rate is the fixed price this customer pays per unit. It's applied automatically in the POS when this customer is attached to a bill.
            </p>

            {!readOnly && (
                <div className="relative">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                        className="pl-9"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (matches[0]) addProduct(matches[0]);
                            }
                        }}
                        placeholder="Search a product by name or barcode to add a rate"
                        aria-label="Add a product"
                    />
                    {matches.length > 0 && (
                        <ul className="absolute left-0 right-0 mt-1 z-20 bg-popover text-popover-foreground border border-hairline rounded-pop shadow-2 p-1.5 max-h-72 overflow-y-auto">
                            {matches.map((p) => (
                                <li key={p._id}>
                                    <button
                                        type="button"
                                        onClick={() => addProduct(p)}
                                        className="w-full flex items-center gap-2 min-h-9 px-2.5 rounded-[7px] text-body text-left hover:bg-[var(--hover-overlay)] focus-visible:bg-[var(--hover-overlay)] outline-none"
                                    >
                                        <FiPlus className="w-3.5 h-3.5 text-muted-foreground flex-none" aria-hidden="true" />
                                        <span className="flex-1 min-w-0 truncate">{p.name}</span>
                                        <span className="flex-none text-muted-foreground tabular-nums">{fmt(p.sellingPrice ?? p.price)}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {value.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-hairline">
                    <EmptyState icon={FiTag} title="No special rates yet">
                        {readOnly ? 'This customer pays the normal prices.' : 'Search a product above to give this customer a fixed price for it.'}
                    </EmptyState>
                </div>
            ) : compact ? (
                <ul className="flex flex-col gap-2">
                    {rows.map((row) => (
                        <li key={row.r.product} className="rounded-xl border border-hairline bg-card px-3 py-2.5">
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{row.p?.name || 'Product no longer available'}</p>
                                    {row.p ? <p className="text-body-sm text-muted-foreground">Price now {fmt(row.price)}</p> : null}
                                </div>
                                {!readOnly && (
                                    <IconButton label="Remove rate" size="2xs" onClick={() => removeRow(row.r.product)}>
                                        <FiTrash2 />
                                    </IconButton>
                                )}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-body">
                                {rateInput(row.r)}
                                {saving(row)}
                            </div>
                            <div className="mt-2">{noteInput(row.r)}</div>
                            <Warnings list={row.warnings} />
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="rounded-2xl border border-hairline overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className={TABLE_HEAD_ROW}>
                                <th className={TABLE_TH}>Product</th>
                                <th className={cn(TABLE_TH, 'text-right')}>Price now</th>
                                <th className={cn(TABLE_TH, 'text-right')}>Special rate</th>
                                <th className={cn(TABLE_TH, 'text-right')}>Saving / unit</th>
                                <th className={TABLE_TH}>Note</th>
                                {!readOnly ? (
                                    <th className={TABLE_TH}>
                                        <span className="sr-only">Remove</span>
                                    </th>
                                ) : null}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.r.product} className={cn(TABLE_ROW, row.warnings.some((w) => w.danger) && 'bg-destructive-chip/30')}>
                                    <td className={cn(TABLE_TD, 'py-2 min-w-[200px]')}>
                                        <p className="font-medium">{row.p?.name || 'Product no longer available'}</p>
                                        <Warnings list={row.warnings} />
                                    </td>
                                    <td className={cn(TABLE_TD, 'text-right tabular-nums text-muted-foreground whitespace-nowrap')}>{row.p ? fmt(row.price) : '—'}</td>
                                    <td className={cn(TABLE_TD, 'text-right')}>
                                        <div className="flex justify-end">{rateInput(row.r)}</div>
                                    </td>
                                    <td className={cn(TABLE_TD, 'text-right whitespace-nowrap')}>{saving(row)}</td>
                                    <td className={cn(TABLE_TD, 'w-[32%]')}>{noteInput(row.r)}</td>
                                    {!readOnly ? (
                                        <td className={cn(TABLE_TD, 'w-12 text-right')}>
                                            <IconButton label="Remove rate" size="2xs" onClick={() => removeRow(row.r.product)}>
                                                <FiTrash2 />
                                            </IconButton>
                                        </td>
                                    ) : null}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SpecialRatesEditor;
