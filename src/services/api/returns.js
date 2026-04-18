import api from '../api';

// ─── Read ────────────────────────────────────────────────────
export const getReturns = (params) =>
    api.get('/bill/returns', { params });

export const getTodayReturnsSummary = () =>
    api.get('/bill/returns/today-summary');

// Lookup a sale bill by bill number (for linked return from receipt)
export const getBillForReturn = (billNumber) =>
    api.get(`/bill/returns/receipt/${billNumber}`);

// Lookup walk-in bills containing a specific product (return-without-receipt)
// Customer bills are intentionally excluded — customer returns go via ledger.
export const lookupBillsByProduct = (productId, days = 60) =>
    api.get(`/bill/returns/product/${productId}`, { params: { days } });

// ─── Write ───────────────────────────────────────────────────
// Linked return against an existing bill. Backend auto-selects refund method:
//   - customer bill → ledger_adjust
//   - walk-in bill  → cash
export const processReturn = (billId, data) =>
    api.post(`/bill/${billId}/return`, data);

// Standalone (receiptless) refund — requires returns.create permission
export const createStandaloneRefund = (data) =>
    api.post('/bill/returns/standalone', data);

// Cancel/reverse a previously-processed return entry
export const cancelReturn = (billId, returnId) =>
    api.patch(`/bill/${billId}/return/${returnId}/cancel`);

// ─── Legacy names (used by existing Returns.jsx screen) ──────
// Kept so imports don't break while the screen is migrated.
export const getTodaySummary = getTodayReturnsSummary;
export const getReturnByReceipt = getBillForReturn;
export const getReturnProductByBarcode = (barcode) =>
    api.get(`/product/barcode/${barcode}`);
export const createReturn = (data) => {
    if (data?.billId) {
        const { billId, ...rest } = data;
        return processReturn(billId, rest);
    }
    return createStandaloneRefund(data);
};
