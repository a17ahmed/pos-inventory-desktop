import { useEffect, useRef, useState } from 'react';
import { getDashboardSummary, getSalesInsights } from '../../services/api/dashboard';
import { parseYmd, ymd, todayYmd, periodFor, summaryFilterFor } from '../../components/ui/InsightDrawer';

// Shared by the admin dashboard and its insight windows. The numbers are computed exactly as the
// old dashboard did (design stage changes the look, never the maths).

export const hourLabel = (h) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);
export const hourRange = (h) => `${hourLabel(h)} – ${hourLabel((h + 1) % 24)}`;

/** The summary's chartData → [{ key, label, sales, bills }] with no gaps. */
export function seriesFromSummary(chartData = [], filter) {
    const map = {};
    chartData.forEach((c) => {
        map[c._id] = { sales: c.revenue || 0, bills: c.orders || 0 };
    });
    if (filter === 'today') {
        return Array.from({ length: 24 }, (_, h) => ({ key: h, label: hourLabel(h), range: hourRange(h), sales: map[h]?.sales || 0, bills: map[h]?.bills || 0 }));
    }
    // The server's "week" is the last 7 × 24 hours, which touches 8 calendar days
    const from = filter === 'week' ? ymd(new Date(Date.now() - 7 * 86400000)) : periodFor('month').from;
    const out = [];
    for (let d = parseYmd(from); ymd(d) <= todayYmd(); d.setDate(d.getDate() + 1)) {
        const key = ymd(d);
        out.push({
            key,
            label: d.toLocaleDateString('en-GB', filter === 'week' ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' }),
            range: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
            sales: map[key]?.sales || 0,
            bills: map[key]?.bills || 0,
        });
    }
    return out;
}

/** P&L figures from the summary, as the old dashboard computed them. */
export function profitFromSummary(data) {
    const s = data?.stats || {};
    const expenses = (data?.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const linkedReturns = s.linkedReturns || 0;
    const standaloneRefunds = s.standaloneRefunds || 0;
    const returns = linkedReturns + standaloneRefunds;
    const cogs = s.adjustedCogs ?? s.totalCost ?? 0;
    const netRevenue = s.netRevenue || 0;
    const grossProfit = netRevenue - cogs;
    const netProfit = grossProfit - expenses;
    return {
        grossRevenue: s.grossRevenue || 0,
        linkedReturns,
        standaloneRefunds,
        returns,
        netRevenue,
        cogs,
        grossProfit,
        expenses,
        netProfit,
        profitMargin: netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0,
        grossMargin: netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
        discount: s.totalDiscount || 0,
    };
}

const summaryCache = new Map(); // filter → { at, data }

/** The dashboard summary for today / week / month (cached for 30 s between the page and windows). */
export function useSummary(filter, { enabled = true, refreshKey = 0 } = {}) {
    const [state, setState] = useState({ data: summaryCache.get(filter)?.data || null, loading: true, error: null });
    useEffect(() => {
        if (!enabled || !filter) return undefined;
        const hit = summaryCache.get(filter);
        if (hit && Date.now() - hit.at < 30000 && refreshKey === hit.refreshKey) {
            setState({ data: hit.data, loading: false, error: null });
            return undefined;
        }
        const controller = new AbortController();
        setState((s) => ({ ...s, loading: true, error: null }));
        getDashboardSummary(filter, { signal: controller.signal })
            .then(({ data }) => {
                summaryCache.set(filter, { at: Date.now(), data, refreshKey });
                setState({ data, loading: false, error: null });
            })
            .catch((err) => {
                if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
                setState({ data: null, loading: false, error: err.response?.data?.message || "Couldn't load the dashboard." });
            });
        return () => controller.abort();
    }, [filter, enabled, refreshKey]);
    return state;
}

/**
 * Sales insights for a period. { data, loading, error, unsupported } — `unsupported` = the server
 * doesn't have the endpoint yet (404): windows then use the summary (today / week / month only).
 */
let insightsSupported = null; // null = unknown, true / false after the first answer
export function useSalesInsights(period, { enabled = true, refreshKey = 0 } = {}) {
    const [state, setState] = useState({ data: null, loading: true, error: null, unsupported: insightsSupported === false });
    const seq = useRef(0);
    useEffect(() => {
        if (!enabled || !period) return undefined;
        if (insightsSupported === false) {
            setState({ data: null, loading: false, error: null, unsupported: true });
            return undefined;
        }
        const id = ++seq.current;
        setState((s) => ({ ...s, loading: true, error: null }));
        getSalesInsights({ from: period.from, to: period.to })
            .then(({ data }) => {
                if (id !== seq.current) return;
                insightsSupported = true;
                setState({ data, loading: false, error: null, unsupported: false });
            })
            .catch((err) => {
                if (id !== seq.current) return;
                if (err.response?.status === 404) {
                    insightsSupported = false;
                    setState({ data: null, loading: false, error: null, unsupported: true });
                } else {
                    setState({ data: null, loading: false, error: err.response?.data?.message || "Couldn't load these figures.", unsupported: false });
                }
            });
        return undefined;
    }, [enabled, period?.from, period?.to, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
    return state;
}

export { summaryFilterFor };
