import api from '../api';

export const getDashboardSummary = (filter = 'today', config = {}) =>
    api.get('/v1/dashboard/summary', { params: { filter }, ...config });

/**
 * Sales insights for a date range (design/backend-prompts/stage-07-sales-insights.md).
 * from / to: local YYYY-MM-DD, inclusive. Older servers answer 404 — the app falls back to
 * getDashboardSummary for today / last 7 days / this month.
 */
export const getSalesInsights = ({ from, to }, config = {}) =>
    api.get('/v1/dashboard/insights/sales', { params: { from, to }, ...config });
