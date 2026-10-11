import React, { useMemo, useState } from 'react';
import { FiSearch, FiTrash2, FiAlertTriangle, FiTag } from 'react-icons/fi';
import { getRateStatus } from '../utils/specialRates';

const fmt = (n) => `Rs. ${(Number(n) || 0).toLocaleString()}`;

const Warning = ({ children, danger }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] ${
        danger
            ? 'bg-red-50 dark:bg-[rgba(255,107,107,0.1)] text-red-600 dark:text-d-red'
            : 'bg-amber-50 dark:bg-[rgba(255,210,100,0.1)] text-amber-700 dark:text-d-accent'
    }`}>
        <FiAlertTriangle size={11} />
        {children}
    </span>
);

/**
 * Edits a customer's special rates (fixed per-unit price per product).
 * Controlled: `value` is a draft list from toDraftRates(); the parent saves it.
 * products: the business's active products (for search, current price and limits).
 */
const SpecialRatesEditor = ({ value = [], onChange, products = [], readOnly = false, allowSellBelowCost = false }) => {
    const [query, setQuery] = useState('');

    const productsById = useMemo(() => {
        const map = {};
        products.forEach((p) => { map[p._id] = p; });
        return map;
    }, [products]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const taken = new Set(value.map((r) => r.product));
        return products
            .filter((p) => !taken.has(p._id)
                && (p.name?.toLowerCase().includes(q) || p.barcode?.includes(q)))
            .slice(0, 8);
    }, [query, products, value]);

    const addProduct = (p) => {
        onChange([{ product: p._id, rate: '', note: '' }, ...value]);
        setQuery('');
    };
    const updateRow = (productId, patch) =>
        onChange(value.map((r) => (r.product === productId ? { ...r, ...patch } : r)));
    const removeRow = (productId) => onChange(value.filter((r) => r.product !== productId));

    return (
        <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-d-muted">
                A special rate is the fixed price this customer pays per unit. It's applied automatically in the POS when this customer is attached to a bill.
            </p>

            {!readOnly && (
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" size={16} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (matches[0]) addProduct(matches[0]);
                            }
                        }}
                        placeholder="Search product by name or barcode to add a rate"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl focus:ring-2 focus:ring-primary-500 dark:focus:border-d-border-hover focus:outline-none text-slate-800 dark:text-d-text"
                    />
                    {matches.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-xl shadow-lg z-20 overflow-hidden">
                            {matches.map((p) => (
                                <button
                                    key={p._id}
                                    type="button"
                                    onClick={() => addProduct(p)}
                                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-d-glass"
                                >
                                    <span className="text-slate-800 dark:text-d-text truncate">{p.name}</span>
                                    <span className="text-slate-500 dark:text-d-muted ml-3 flex-shrink-0">{fmt(p.sellingPrice ?? p.price)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {value.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-d-faint">
                    <FiTag size={24} />
                    <p className="mt-2 text-sm">No special rates yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {value.map((r) => {
                        const p = productsById[r.product];
                        const price = Number(p?.sellingPrice ?? p?.price) || 0;
                        const rate = Number(r.rate);
                        const hasRate = r.rate !== '' && rate >= 0;
                        const unchanged = r.savedRate != null && rate === Number(r.savedRate);
                        const status = p && hasRate
                            ? getRateStatus(
                                { price, costPrice: p.costPrice, maxDiscountPercent: p.maxDiscountPercent },
                                { rate, priceWhenSaved: unchanged ? r.priceWhenSaved : null }
                            )
                            : null;
                        const tooHigh = hasRate && p && rate >= price;
                        return (
                            <div key={r.product} className="p-3 rounded-xl border border-slate-200 dark:border-d-border bg-white dark:bg-d-elevated">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-slate-800 dark:text-d-text truncate">
                                            {p?.name || 'Product no longer available'}
                                        </div>
                                        {p && (
                                            <div className="text-[11px] text-slate-500 dark:text-d-muted">
                                                Price now {fmt(price)}
                                            </div>
                                        )}
                                    </div>
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => removeRow(r.product)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-d-red rounded-lg"
                                            title="Remove rate"
                                        >
                                            <FiTrash2 size={15} />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                    <label className="text-xs text-slate-500 dark:text-d-muted flex-shrink-0">Rate</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={r.rate}
                                        disabled={readOnly}
                                        autoFocus={r.rate === '' && !readOnly}
                                        onChange={(e) => updateRow(r.product, { rate: e.target.value === '' ? '' : Number(e.target.value) })}
                                        placeholder="0"
                                        className="w-28 px-3 py-1.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-sm text-slate-800 dark:text-d-text focus:outline-none focus:border-amber-300 disabled:opacity-60"
                                    />
                                    {status && !tooHigh && (
                                        <span className="text-xs text-emerald-600 dark:text-d-green">
                                            {fmt(status.discountPerUnit)} off per unit
                                        </span>
                                    )}
                                    <input
                                        type="text"
                                        value={r.note}
                                        disabled={readOnly}
                                        maxLength={200}
                                        onChange={(e) => updateRow(r.product, { note: e.target.value })}
                                        placeholder="Note (optional)"
                                        className="flex-1 min-w-0 px-3 py-1.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-sm text-slate-800 dark:text-d-text focus:outline-none focus:border-amber-300 disabled:opacity-60"
                                    />
                                </div>

                                {(tooHigh || status?.priceChanged || status?.beyondLimit) && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {tooHigh && <Warning danger>Must be lower than the price ({fmt(price)})</Warning>}
                                        {!tooHigh && status.priceChanged && (
                                            <Warning>Price changed {fmt(status.priceWhenSaved)} → {fmt(price)} since saved</Warning>
                                        )}
                                        {!tooHigh && status.belowCost && (
                                            <Warning danger>
                                                Below cost ({fmt(p.costPrice)}){!allowSellBelowCost && ' — POS will sell at the limit price'}
                                            </Warning>
                                        )}
                                        {!tooHigh && status.beyondLimit && !status.belowCost && (
                                            <Warning>Beyond discount limit (lowest {fmt(status.limitPrice)})</Warning>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SpecialRatesEditor;
