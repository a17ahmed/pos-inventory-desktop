import api from '../api';

export const getLastClosing = () =>
    api.get('/closing/last');

export const getClosingPreview = (params) =>
    api.get('/closing/preview', { params });

export const createClosing = (data) =>
    api.post('/closing', data);

export const getClosings = (params) =>
    api.get('/closing', { params });

export const getClosing = (id) =>
    api.get(`/closing/${id}`);
