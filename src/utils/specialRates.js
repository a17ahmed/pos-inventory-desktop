// Customer special rates — a fixed per-unit price a customer pays for a product.
// Stored on the customer as specialRates: [{ product, rate, priceWhenSaved, note, ... }].
// The POS turns a rate into a normal line discount: (price - rate) * qty.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// Directional rounding to the paisa (epsilon absorbs float noise like 21.999999).
const floor2 = (n) => Math.floor((Number(n) || 0) * 100 + 1e-6) / 100;
const ceil2 = (n) => Math.ceil((Number(n) || 0) * 100 - 1e-6) / 100;

// `product` is an id string in customer payloads, a populated object from GET /customer/:id/rates.
const rateProductId = (r) => String(r?.product?._id ?? r?.product ?? '');

// { [productId]: rateObj } for O(1) lookup when items are added to the cart.
export const buildRateMap = (specialRates = []) => {
    const map = {};
    for (const r of specialRates || []) {
        const id = rateProductId(r);
        if (id) map[id] = r;
    }
    return map;
};

// Max discount per unit allowed by the product's limit. maxDiscountPercent is a
// share of PROFIT, not of the selling price; no cap set = full profit.
// Same math as getItemDiscountCap in Dashboard.jsx (which is per line, not per unit).
export const getMaxDiscountPerUnit = ({ price, costPrice, maxDiscountPercent }) => {
    const profit = Math.max(0, (Number(price) || 0) - (Number(costPrice) || 0));
    if (maxDiscountPercent === null || maxDiscountPercent === undefined) return profit;
    return Math.max(0, profit * (maxDiscountPercent / 100));
};

// Total Rs off for a line sold at the customer's rate. Never negative
// (a rate above the current price gives no discount).
export const rateLineDiscount = (price, rate, qty) =>
    round2(Math.max(0, (Number(price) || 0) - (Number(rate) || 0)) * (Number(qty) || 0));

/**
 * Compare a saved rate against the product as it is today.
 * item: { price, costPrice, maxDiscountPercent } — a cart line or product (price = current selling price)
 * rateObj: { rate, priceWhenSaved }
 */
export const getRateStatus = (item, rateObj) => {
    const price = Number(item?.price) || 0;
    const cost = Number(item?.costPrice) || 0;
    const rate = Number(rateObj?.rate) || 0;
    const discountPerUnit = Math.max(0, price - rate);
    const maxPerUnit = getMaxDiscountPerUnit({ price, costPrice: cost, maxDiscountPercent: item?.maxDiscountPercent });
    const priceWhenSaved = rateObj?.priceWhenSaved;

    return {
        discountPerUnit: round2(discountPerUnit),
        priceChanged: priceWhenSaved != null && round2(priceWhenSaved) !== round2(price),
        priceWhenSaved,
        belowCost: rate < cost,
        lossPerUnit: round2(Math.max(0, cost - rate)),
        beyondLimit: round2(discountPerUnit) > round2(maxPerUnit),
        limitPrice: ceil2(price - maxPerUnit), // lowest price the product limit allows (rounded up, never promises less)
    };
};

/**
 * Line-level limit check for the POS — matches the server, which caps each line at
 * maxDiscountPerUnit × qty (+0.01). The cap is floored to the paisa so a discount at
 * the cap can never round above it; checking per unit instead lets the rounding
 * error grow with qty and the server rejects the bill.
 * item: cart line { price, costPrice, maxDiscountPercent, qty }
 */
export const getRateLine = (item, rateObj) => {
    const qty = Number(item?.qty) || 0;
    const fullDiscount = rateLineDiscount(item?.price, rateObj?.rate, qty);
    const rawCap = getMaxDiscountPerUnit(item || {}) * qty;
    // Server allows +0.01 per line; half of that keeps sub-paisa overshoots from
    // prompting the cashier while staying safely inside the server's tolerance.
    return { fullDiscount, cap: floor2(rawCap), beyondLimit: fullDiscount > rawCap + 0.005 };
};

// Backend `warnings` codes from saving a rate → user-facing text.
const WARNING_TEXT = {
    BELOW_COST: 'below cost price',
    BEYOND_LIMIT: "beyond the product's discount limit",
};
export const describeRateWarnings = (codes = []) =>
    codes.map((c) => WARNING_TEXT[c]).filter(Boolean).join(' and ');

// Permission checks. Use isAdmin from useAuth — `permissions` is also null for an
// employee whose permissions haven't loaded yet, so null alone doesn't mean admin.
export const canSaveCustomerRates = (isAdmin, permissions) =>
    !!isAdmin || permissions?.pos?.saveCustomerRates === true;

export const canSellBeyondLimit = (isAdmin, permissions) =>
    !!isAdmin || permissions?.pos?.sellBeyondLimit === true;

// ── Rates editor (Customers modal / Ledger tab) ─────────────────────────────
// Draft row: { product: id, rate: number | '', note, priceWhenSaved, savedRate }
// savedRate = the rate as loaded from the server; the "price changed" warning only
// applies while the rate is unchanged (the server re-stamps priceWhenSaved otherwise).
export const toDraftRates = (rates = []) =>
    (rates || []).map((r) => ({
        product: rateProductId(r),
        rate: r.rate,
        note: r.note || '',
        priceWhenSaved: r.priceWhenSaved,
        savedRate: r.rate,
    }));

export const toRatesPayload = (draft = []) =>
    draft.map((r) => ({ product: r.product, rate: round2(r.rate), note: (r.note || '').trim() }));

// Returns an error message for the first invalid row, or null.
export const validateDraftRates = (draft = [], productsById = {}) => {
    for (const r of draft) {
        const p = productsById[r.product];
        const name = p?.name || 'a product';
        const rate = Number(r.rate);
        // 0 is allowed (free item); the server accepts it too.
        if (r.rate === '' || !(rate >= 0)) return `Enter a rate for ${name}`;
        const price = Number(p?.sellingPrice ?? p?.price);
        if (p && rate >= price) return `Rate for ${name} must be lower than its price`;
    }
    return null;
};

// Server messages for the rates endpoints carry raw product ids — show names instead.
export const friendlyRateError = (message = '', productsById = {}) =>
    String(message).replace(/\b[a-f0-9]{24}\b/g, (id) => productsById[id]?.name || id);
