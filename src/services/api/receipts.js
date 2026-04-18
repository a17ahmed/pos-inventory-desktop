import api from '../api';

// ─── Compatibility shim around the /bill API ─────────────────
// The Receipts screen was built against a legacy /receipt endpoint
// that no longer exists. This shim routes everything to /bill and
// remaps the response shape so Receipts.jsx keeps working.

// Map a backend bill doc → legacy receipt shape the screen expects
const billToReceipt = (bill) => ({
    ...bill,
    // Field name aliases
    receiptNumber: bill.billNumber,
    totalBill: bill.total,
    totalReturned: bill.totalRefunded,
    // receiptType: 'sale' | 'return' | 'sale_refund' etc — map from status/returnStatus
    receiptType:
        bill.returnStatus && bill.returnStatus !== 'none'
            ? 'sale_refund'
            : bill.type || 'sale',
});

const remapListResponse = (res) => {
    const bills = res.data?.bills || [];
    return {
        ...res,
        data: {
            receipts: bills.map(billToReceipt),
            pagination: res.data?.pagination,
        },
    };
};

export const getReceipts = (params) =>
    api.get('/bill', { params }).then(remapListResponse);

export const getAllReceipts = () =>
    api.get('/bill', { params: { all: true } }).then(remapListResponse);

export const getReceiptsPaginated = (page, limit = 30) =>
    api.get('/bill', { params: { page, limit } }).then(remapListResponse);

export const getReceiptStats = (params) =>
    api.get('/bill/stats', { params });

export const getTopProducts = (limit = 12) =>
    api.get('/bill/top-products', { params: { limit } });

export const createReceipt = (data) =>
    api.post('/bill', data);
