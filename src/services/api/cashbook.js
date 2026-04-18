import api from '../api';

export const getCashBalance = () =>
    api.get('/cashbook/balance');

export const getCashBook = (params) =>
    api.get('/cashbook', { params });

export const getCashBookSummary = (params) =>
    api.get('/cashbook/summary', { params });

export const setOpeningBalance = (data) =>
    api.post('/cashbook/opening-balance', data);

export const manualDeposit = (data) =>
    api.post('/cashbook/deposit', data);

export const manualWithdraw = (data) =>
    api.post('/cashbook/withdraw', data);
