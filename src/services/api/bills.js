import api from '../api';

// ─── Create / Read ───────────────────────────────────────────
export const createBill = (data) => api.post('/bill', data);
export const getBills = (params) => api.get('/bill', { params });
export const getBill = (id) => api.get(`/bill/${id}`);
export const updateBill = (id, data) => api.patch(`/bill/${id}`, data);

// Cancel a completed sale created by mistake (reason required). Unlike a
// return, the sale is treated as never having happened: stock comes back, the
// cash is reversed and the customer balance is recalculated.
export const cancelBill = (id, reason) => api.post(`/bill/${id}/cancel`, { reason });

// ─── Payments ────────────────────────────────────────────────
export const addBillPayment = (id, data) => api.post(`/bill/${id}/payment`, data);

// ─── Stats / Top Products ────────────────────────────────────
export const getBillStats = (params) => api.get('/bill/stats', { params });
export const getTopProducts = (limit = 12) => api.get(`/bill/top-products?limit=${limit}`);

// ─── Reports ─────────────────────────────────────────────────
export const getProfitReport = (params) => api.get('/bill/report/profit', { params });
export const getSalesTimeline = (params) => api.get('/bill/report/timeline', { params });
export const getSalesByProduct = (params) => api.get('/bill/report/sales-by-product', { params });
export const getSalesByCategory = (params) => api.get('/bill/report/sales-by-category', { params });
export const getSalesByCashier = (params) => api.get('/bill/report/sales-by-cashier', { params });
export const getPaymentMethodReport = (params) => api.get('/bill/report/payment-methods', { params });
export const getTaxReport = (params) => api.get('/bill/report/tax', { params });
export const getCustomerSalesReport = (params) => api.get('/bill/report/customer-sales', { params });
export const getDiscountReport = (params) => api.get('/bill/report/discounts', { params });
export const getReturnAnalysis = (params) => api.get('/bill/report/returns', { params });
