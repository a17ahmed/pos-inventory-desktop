import api from '../api';

export const getDashboardSummary = (filter = 'today', config = {}) =>
    api.get('/v1/dashboard/summary', { params: { filter }, ...config });
