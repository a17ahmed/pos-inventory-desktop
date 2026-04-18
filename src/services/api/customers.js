import api from '../api';

export const getCustomers = (params) =>
    api.get('/customer', { params });

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
