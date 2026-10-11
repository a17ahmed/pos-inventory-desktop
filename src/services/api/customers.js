import api from '../api';

export const getCustomers = (params) =>
    api.get('/customer', { params });

// KPI cards (business-wide totals) — computed server-side so the list can stay paged.
export const getCustomerSummary = () =>
    api.get('/customer/summary');

export const searchCustomers = (q) =>
    api.get('/customer/search', { params: { q } });

export const getCustomer = (id) =>
    api.get(`/customer/${id}`);

export const getCustomerLedger = (id, params) =>
    api.get(`/customer/${id}/ledger`, { params });

export const createCustomer = (data) =>
    api.post('/customer', data);

export const updateCustomer = (id, data) =>
    api.patch(`/customer/${id}`, data);

export const deleteCustomer = (id) =>
    api.delete(`/customer/${id}`);

// FIFO collection — customer pays lump sum, auto-applied to outstanding bills oldest-first
export const collectFromCustomer = (id, data) =>
    api.post(`/customer/${id}/collect`, data);

// ─── Special rates (fixed per-unit price per product for this customer) ──────
// Populated list with computed priceChanged / belowCost / beyondLimit flags.
export const getCustomerRates = (id) =>
    api.get(`/customer/${id}/rates`);

// Create or update one rate. Response carries `warnings` (BELOW_COST / BEYOND_LIMIT).
export const saveCustomerRate = (id, productId, data) =>
    api.put(`/customer/${id}/rates/${productId}`, data);

export const deleteCustomerRate = (id, productId) =>
    api.delete(`/customer/${id}/rates/${productId}`);

// Replace the whole list: rates = [{ product, rate, note }]
export const replaceCustomerRates = (id, rates) =>
    api.put(`/customer/${id}/rates`, { rates });
