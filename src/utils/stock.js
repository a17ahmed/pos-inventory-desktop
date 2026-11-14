// One stock rule for every screen (Products, Inventory, …):
//   • "track stock" off → 'untracked' (the count isn't kept, so never warn — these still sell)
//   • tracked and 0 or less → 'out'
//   • tracked and at or below the product's own alert level (default 10) → 'low'
//   • otherwise → 'ok'
export const DEFAULT_LOW_STOCK_ALERT = 10;

export const stockQty = (p) => Number(p?.stockQuantity ?? p?.stock ?? 0) || 0;
export const lowStockAlertOf = (p) => Number(p?.lowStockAlert) || DEFAULT_LOW_STOCK_ALERT;

export const stockLevel = (p) => {
    if (p?.trackStock === false) return 'untracked';
    const q = stockQty(p);
    if (q <= 0) return 'out';
    if (q <= lowStockAlertOf(p)) return 'low';
    return 'ok';
};

/** Tracked products that need restocking (out or low). */
export const needsRestock = (p) => {
    const l = stockLevel(p);
    return l === 'out' || l === 'low';
};
