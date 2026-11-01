// A bill can hold the same product on more than one line — items added to
// today's bill later are saved as their own lines (the backend keeps them apart
// for history and returns). Receipts show them as one line with the quantity
// added up. Lines only combine when product, rate and per-unit discount match,
// so a changed price still shows on its own line.

const lineQty = (it) => Number(it.qty ?? it.quantity) || 0;
const linePrice = (it) => Number(it.price ?? it.sellingPrice) || 0;
const unitDiscount = (it) => {
    const qty = lineQty(it);
    return qty > 0 ? Math.round(((Number(it.discountAmount) || 0) / qty) * 100) / 100 : 0;
};
const lineKey = (it) => `${it.product?._id || it.product || it.name}|${linePrice(it)}|${unitDiscount(it)}`;

const SUMMED = ['discountAmount', 'returnedQty', 'itemTotal', 'itemProfit', 'netProfit'];

// Each combined line keeps the original bill lines it was built from in
// `lines`, so a return can still be sent per original line.
export const mergeReceiptItems = (items = []) => {
    const merged = [];
    const byKey = new Map();
    items.forEach((it) => {
        const key = lineKey(it);
        const existing = byKey.get(key);
        if (!existing) {
            const copy = { ...it, qty: lineQty(it), lines: [it] };
            byKey.set(key, copy);
            merged.push(copy);
            return;
        }
        existing.lines.push(it);
        existing.qty += lineQty(it);
        if ('quantity' in existing) existing.quantity = existing.qty;
        SUMMED.forEach((f) => {
            if (existing[f] != null || it[f] != null) existing[f] = (Number(existing[f]) || 0) + (Number(it[f]) || 0);
        });
    });
    return merged;
};
