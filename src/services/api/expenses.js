import api from '../api';

export const getExpenses = (params) =>
    api.get('/expense', { params });

// KPI cards (approved totals, pending count) — server-side so the list can stay paged.
export const getExpenseStats = (params) =>
    api.get('/expense/stats', { params });

export const createExpense = (data) =>
    api.post('/expense', data);

export const updateExpense = (id, data) =>
    api.patch(`/expense/${id}`, data);

export const deleteExpense = (id) =>
    api.delete(`/expense/${id}`);

export const approveExpense = (id) =>
    api.post(`/expense/${id}/approve`);

export const rejectExpense = (id, reason) =>
    api.post(`/expense/${id}/reject`, { reason });
