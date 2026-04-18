import api from '../api';

export const getSupplies = (params) =>
    api.get('/supply', { params });

export const getSupplyStats = () =>
    api.get('/supply/stats');

export const createSupply = (formData) =>
    api.post('/supply', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const updateSupply = (id, formData) =>
    api.patch(`/supply/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const deleteSupply = (id) =>
    api.delete(`/supply/${id}`);

export const paySupply = (id, data) =>
    api.patch(`/supply/${id}/pay`, data);
