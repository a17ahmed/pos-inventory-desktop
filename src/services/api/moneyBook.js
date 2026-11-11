import api from '../api';

// Money Book (/money-book/*). Only call these when MoneyBookContext says the
// shop is switched on — except getMoneyBookSettings / getPickerAccounts,
// which are the detection calls themselves.

// ─── Detection / config ──────────────────────────────────────
export const getMoneyBookSettings = () => api.get('/money-book/settings');
export const updateMoneyBookSettings = (methodAccounts) => api.put('/money-book/settings', { methodAccounts });

// ─── Accounts ────────────────────────────────────────────────
export const getMoneyAccounts = (params) => api.get('/money-book/accounts', { params });
// Names only, for staff without cashbook.view
export const getPickerAccounts = () => api.get('/money-book/accounts/picker');
export const createMoneyAccount = (data) => api.post('/money-book/accounts', data);
export const updateMoneyAccount = (id, data) => api.patch(`/money-book/accounts/${id}`, data);
export const archiveMoneyAccount = (id) => api.post(`/money-book/accounts/${id}/archive`);
export const restoreMoneyAccount = (id) => api.post(`/money-book/accounts/${id}/restore`);
export const reorderMoneyAccounts = (order) => api.put('/money-book/accounts/reorder', { order });
export const setAccountOpeningBalance = (id, data) => api.post(`/money-book/accounts/${id}/opening-balance`, data);

// ─── Ledger & reports ────────────────────────────────────────
export const getMoneyEntries = (params) => api.get('/money-book/entries', { params });
export const getMoneySummary = (params) => api.get('/money-book/summary', { params });
export const getMoneyBalances = (params) => api.get('/money-book/balances', { params });

// ─── Movements ───────────────────────────────────────────────
export const getTransfers = (params) => api.get('/money-book/transfers', { params });
export const createTransfer = (data) => api.post('/money-book/transfers', data);
export const reverseTransfer = (transferId, note) =>
    api.post(`/money-book/transfers/${transferId}/reverse`, note ? { note } : {});
export const moneyDeposit = (data) => api.post('/money-book/deposit', data);
export const moneyWithdraw = (data) => api.post('/money-book/withdraw', data);
export const createAdjustment = (data) => api.post('/money-book/adjustments', data);

// ─── Cheques ─────────────────────────────────────────────────
export const getCheques = (params) => api.get('/money-book/cheques', { params });
export const clearCheque = (entryId, date) =>
    api.post(`/money-book/cheques/${entryId}/clear`, date ? { date } : {});
export const cancelCheque = (entryId, reason) => api.post(`/money-book/cheques/${entryId}/cancel`, { reason });
