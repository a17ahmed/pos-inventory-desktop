import api from '../api';

export const getPendingBills = () =>
    api.get('/pending-bill');

export const createPendingBill = (data) =>
    api.post('/pending-bill', data);

export const resumePendingBill = (id) =>
    api.patch(`/pending-bill/${id}/resume`);

export const cancelPendingBill = (id) =>
    api.patch(`/pending-bill/${id}/cancel`);

export const deletePendingBill = (id) =>
    api.delete(`/pending-bill/${id}`);
