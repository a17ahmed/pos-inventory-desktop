import api from '../api';

export const getVendors = () =>
    api.get('/vendor');

export const getVendor = (id) =>
    api.get(`/vendor/${id}`);

export const getVendorLedger = (id, params) =>
    api.get(`/vendor/${id}/ledger`, { params });

export const createVendor = (data) =>
    api.post('/vendor', data);

export const updateVendor = (id, data) =>
    api.patch(`/vendor/${id}`, data);

export const deleteVendor = (id) =>
    api.delete(`/vendor/${id}`);

// FIFO payment — lump sum distributed across pending supplies oldest-first
export const payVendor = (id, data) =>
    api.post(`/vendor/${id}/pay`, data);
