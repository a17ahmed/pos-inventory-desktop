import api from '../api';

export const getBusinessTypes = () =>
    api.get('/business-types');

export const registerBusiness = (data) =>
    api.post('/business/register', data);

export const getBusinessById = (id) =>
    api.get(`/business/${id}`);

export const updateBusiness = (id, data) =>
    api.patch(`/business/${id}`, data);

export const updateAdmin = (id, data) =>
    api.patch(`/admin/${id}`, data);

export const changeAdminPassword = (data) =>
    api.post('/admin/change-password', data);
