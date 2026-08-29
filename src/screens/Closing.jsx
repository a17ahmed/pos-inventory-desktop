import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLastClosing, getClosingPreview, createClosing, getClosings } from '../services/api/closing';
import ClosingReport from '../components/ClosingReport';
import { appAlert } from '../components/AppDialog';
import {
    FiPlus,
    FiClock,
    FiXCircle,
    FiLock,
    FiX,
} from 'react-icons/fi';

const TABS = [
    { id: 'new', label: 'New Closing', icon: FiPlus },
    { id: 'history', label: 'History', icon: FiClock },
];

const toDatetimeLocalValue = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const Closing = () => {
    const navigate = useNavigate();
    const { isAdmin, permissions } = useAuth();
    const canCreate = isAdmin || permissions?.closing?.create === true;

    const [activeTab, setActiveTab] = useState('new');

    // ── Last closing ─────────────────────────────────────────────────────────
    const [lastClosing, setLastClosing] = useState(null);
    const [loadingLast, setLoadingLast] = useState(true);

    // ── New closing (preview) ────────────────────────────────────────────────
    // overrideStart/overrideEnd are '' unless the owner explicitly picks a
    // custom range — empty means "let the backend decide" (last closing's
    // end -> now), which is what avoids a client-guessed zero-width window.
    const [overrideStart, setOverrideStart] = useState('');
    const [overrideEnd, setOverrideEnd] = useState('');
    // Independent per-tender counts — never pre-filled from any computed
    // figure. Start empty; the closer types in what they actually observed.
    const [countedCash, setCountedCash] = useState('');
    const [countedCard, setCountedCard] = useState('');
    const [countedOnline, setCountedOnline] = useState('');
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [previewError, setPreviewError] = useState(null);
    const [countedNote, setCountedNote] = useState('');
    const [acknowledgeMismatch, setAcknowledgeMismatch] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [finalizing, setFinalizing] = useState(false);
    const [finalizeError, setFinalizeError] = useState(null);

    // Period-edit modal (mirrors the ledger Filter modal pattern)
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [draftStart, setDraftStart] = useState('');
    const [draftEnd, setDraftEnd] = useState('');

    // ── History ───────────────────────────────────────────────────────────────
    const [closings, setClosings] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loadingHistory, setLoadingHistory] = useState(false);

    // =========================================================================
    // Load last closing (informational banner only)
    // =========================================================================

    useEffect(() => {
        (async () => {
            setLoadingLast(true);
            try {
                const res = await getLastClosing();
                const raw = res.data;
                const last = raw && raw.closing !== undefined ? raw.closing : raw;
                setLastClosing(last || null);
            } catch (err) {
                console.error('Error fetching last closing:', err);
            } finally {
                setLoadingLast(false);
            }
        })();
    }, []);

    // =========================================================================
    // Preview fetch — fires on mount (no params, backend picks the default
    // range), whenever the owner applies an explicit period override, and
    // (debounced) as they type a tender count so the variance updates live.
    // =========================================================================

    const toNumOrUndefined = (v) => (v !== '' && !isNaN(Number(v)) ? Number(v) : undefined);

    const fetchPreview = useCallback(async () => {
        setLoadingPreview(true);
        setPreviewError(null);
        try {
            const params = {};
            if (overrideStart) params.startDate = overrideStart;
            if (overrideEnd) params.endDate = overrideEnd;
            const cash = toNumOrUndefined(countedCash);
            const card = toNumOrUndefined(countedCard);
            const online = toNumOrUndefined(countedOnline);
            if (cash !== undefined) params.countedCash = cash;
            if (card !== undefined) params.countedCard = card;
            if (online !== undefined) params.countedOnline = online;
            const res = await getClosingPreview(params);
            setPreview(res.data);
            setAcknowledgeMismatch(false);
        } catch (err) {
            console.error('Error fetching closing preview:', err);
            setPreviewError(err.response?.data?.message || 'Failed to load closing preview');
            setPreview(null);
        } finally {
            setLoadingPreview(false);
        }
    }, [overrideStart, overrideEnd, countedCash, countedCard, countedOnline]);

    useEffect(() => {
        const handle = setTimeout(() => {
            fetchPreview();
        }, 400);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overrideStart, overrideEnd, countedCash, countedCard, countedOnline]);

    // =========================================================================
    // Period-edit modal handlers
    // =========================================================================

    const openPeriodModal = () => {
        setDraftStart(overrideStart || (preview?.periodStart ? toDatetimeLocalValue(preview.periodStart) : ''));
        setDraftEnd(overrideEnd || (preview?.periodEnd ? toDatetimeLocalValue(preview.periodEnd) : ''));
        setShowPeriodModal(true);
    };

    const applyPreset = (preset) => {
        if (preset === 'default') {
            setOverrideStart('');
            setOverrideEnd('');
            setShowPeriodModal(false);
            return;
        }
        const now = new Date();
        let start;
        if (preset === 'today') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (preset === 'week') {
            const dayOfWeek = now.getDay();
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            start = new Date(now);
            start.setDate(now.getDate() - diffToMonday);
            start.setHours(0, 0, 0, 0);
        }
        setOverrideStart(toDatetimeLocalValue(start));
        setOverrideEnd(toDatetimeLocalValue(now));
        setShowPeriodModal(false);
    };

    const applyCustomRange = () => {
        setOverrideStart(draftStart);
        setOverrideEnd(draftEnd);
        setShowPeriodModal(false);
    };

    // =========================================================================
    // History fetch
    // =========================================================================

    const fetchHistory = useCallback(async (page = 1) => {
        setLoadingHistory(true);
        try {
            const res = await getClosings({ page, limit: 20 });
            const data = res.data;
            if (data && Array.isArray(data.closings)) {
                setClosings(data.closings);
            } else if (Array.isArray(data)) {
                setClosings(data);
            } else {
                setClosings([]);
            }
            setPagination(data?.pagination || { page: 1, pages: 1, total: 0 });
        } catch (err) {
            console.error('Error fetching closing history:', err);
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'history') fetchHistory(1);
    }, [activeTab, fetchHistory]);

    // =========================================================================
    // Finalize
    // =========================================================================

    const handleFinalize = async () => {
        if (!preview) return;
        setFinalizing(true);
        setFinalizeError(null);
        try {
            // Lock exactly the period that was previewed/reviewed on screen —
            // not the raw override (which may be '' when using the default).
            const res = await createClosing({
                periodStart: preview.periodStart,
                periodEnd: preview.periodEnd,
                countedCash: toNumOrUndefined(countedCash),
                countedCard: toNumOrUndefined(countedCard),
                countedOnline: toNumOrUndefined(countedOnline),
                countedNote: countedNote || undefined,
            });
            setShowConfirm(false);
            appAlert(
                `Closing #${res.data.closingNumber} finalized.\n\nDon't forget to physically collect the counted cash and update the Cash Book's opening balance to match — this keeps tomorrow's reconciliation starting from the right number.`
            );
            navigate(`/closing/${res.data._id}`);
        } catch (err) {
            console.error('Error finalizing closing:', err);
            setFinalizeError(err.response?.data?.message || 'Failed to finalize closing');
            setShowConfirm(false);
        } finally {
            setFinalizing(false);
        }
    };

    // Tender reconciliation (cash/card/online) is the real gate now — the
    // settlement "sales math" check is algebraically forced to match and
    // can't catch shrinkage, so it's shown as secondary info only.
    // If every tender that's checkable is actually reconciled, finalize is
    // allowed directly; otherwise an explicit acknowledgment is required.
    const tenderStatuses = preview
        ? ['cash', 'card', 'online'].map((k) => preview.tenderReconciliation?.[k]?.reconciled ?? null)
        : [];
    const allTendersReconciled = tenderStatuses.length > 0 && tenderStatuses.every((r) => r === true);
    const anyTenderUnresolved = tenderStatuses.some((r) => r !== true);
    const canFinalize = preview && !previewError && (allTendersReconciled || acknowledgeMismatch);

    // =========================================================================
    // Render: New Closing tab
    // =========================================================================

    const renderNewClosing = () => (
        <div className="space-y-5">
            {/* Last closing banner */}
            <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-[rgba(255,210,100,0.12)] flex items-center justify-center shrink-0">
                    <FiLock size={16} className="text-primary-600 dark:text-d-accent" />
                </div>
                <div className="text-sm">
                    {loadingLast ? (
                        <span className="text-slate-400 dark:text-d-faint">Loading last closing…</span>
                    ) : lastClosing ? (
                        <>
                            <span className="text-slate-500 dark:text-d-muted">Last closed: </span>
                            <span className="font-medium text-slate-800 dark:text-d-heading">
                                #{lastClosing.closingNumber} — {new Date(lastClosing.periodEnd).toLocaleString()}
                            </span>
                        </>
                    ) : (
                        <span className="text-slate-500 dark:text-d-muted">No closings yet — this will be the first one.</span>
                    )}
                </div>
            </div>

            {/* Period summary */}
            <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-500 dark:text-d-muted mb-1">Period</p>
                        {loadingPreview && !preview ? (
                            <p className="text-sm text-slate-400 dark:text-d-faint">Calculating default period…</p>
                        ) : preview ? (
                            <p className="text-sm font-medium text-slate-800 dark:text-d-heading">
                                {new Date(preview.periodStart).toLocaleString()}
                                <span className="text-slate-400 dark:text-d-faint mx-2">&rarr;</span>
                                {new Date(preview.periodEnd).toLocaleString()}
                            </p>
                        ) : (
                            <p className="text-sm text-slate-400 dark:text-d-faint">—</p>
                        )}
                        {!overrideStart && !overrideEnd && (
                            <p className="text-xs text-slate-400 dark:text-d-faint mt-0.5">
                                Default — since last closing
                            </p>
                        )}
                    </div>
                    {loadingPreview && preview && (
                        <span className="text-xs text-slate-400 dark:text-d-faint">Updating…</span>
                    )}
                    <button
                        onClick={openPeriodModal}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm font-medium text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass transition-colors shrink-0"
                    >
                        <FiClock size={14} />
                        Edit Period
                    </button>
                </div>
            </div>

            {previewError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-[rgba(255,107,107,0.08)] border border-red-200 dark:border-[rgba(255,107,107,0.2)] rounded-xl text-sm text-red-700 dark:text-d-red">
                    <FiXCircle size={16} />
                    {previewError}
                </div>
            )}

            {preview && !previewError && (
                <>
                    <ClosingReport
                        data={preview}
                        tenderEditors={
                            canCreate
                                ? (() => {
                                    const cashExpected = preview?.tenderReconciliation?.cash?.expected ?? 0;
                                    const cashNegative = cashExpected < 0;
                                    return {
                                    cash: cashNegative ? (
                                        <div className="w-full px-3 py-2 bg-red-50 dark:bg-[rgba(255,107,107,0.08)] border border-red-200 dark:border-[rgba(255,107,107,0.2)] rounded-lg text-xs text-red-600 dark:text-d-red font-medium">
                                            Reconcile cash first — expected is negative
                                        </div>
                                    ) : (
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={countedCash}
                                            onChange={(e) => setCountedCash(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-2 py-1 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-base font-bold text-slate-800 dark:text-d-heading focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    ),
                                    card: (
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={countedCard}
                                            onChange={(e) => setCountedCard(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-2 py-1 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-base font-bold text-slate-800 dark:text-d-heading focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    ),
                                    online: (
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={countedOnline}
                                            onChange={(e) => setCountedOnline(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-2 py-1 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-base font-bold text-slate-800 dark:text-d-heading focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    ),
                                }; })()
                                : null
                        }
                    />

                    {/* Note + Finalize */}
                    {canCreate && (
                        <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-5 shadow-sm space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-1">
                                    Note (optional)
                                </label>
                                <textarea
                                    value={countedNote}
                                    onChange={(e) => setCountedNote(e.target.value)}
                                    rows={2}
                                    placeholder="e.g. cash drawer counted, all good"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                />
                            </div>

                            {anyTenderUnresolved && (
                                <label className="flex items-start gap-2 text-sm text-amber-700 dark:text-d-accent bg-amber-50 dark:bg-[rgba(255,210,100,0.08)] border border-amber-200 dark:border-[rgba(255,210,100,0.2)] rounded-xl p-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={acknowledgeMismatch}
                                        onChange={(e) => setAcknowledgeMismatch(e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <span>
                                        I've reviewed the tender reconciliation above (including any unchecked or mismatched
                                        amounts) and want to finalize this closing anyway.
                                    </span>
                                </label>
                            )}

                            {finalizeError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-[rgba(255,107,107,0.08)] border border-red-200 dark:border-[rgba(255,107,107,0.2)] rounded-xl text-sm text-red-700 dark:text-d-red">
                                    <FiXCircle size={15} className="shrink-0" />
                                    {finalizeError}
                                </div>
                            )}

                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={!canFinalize}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <FiLock size={16} />
                                Finalize Closing
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // =========================================================================
    // Render: History tab
    // =========================================================================

    const renderHistory = () => (
        <div className="bg-white dark:bg-d-card rounded-2xl shadow-sm border border-slate-100 dark:border-d-border overflow-hidden">
            {loadingHistory ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-primary-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                </div>
            ) : closings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                    <FiClock size={44} />
                    <p className="mt-4 text-base">No closings yet</p>
                    <p className="text-sm mt-1">Finalize your first closing from the New Closing tab</p>
                </div>
            ) : (
                <>
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-d-glass">
                            <tr>
                                <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">#</th>
                                <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Period</th>
                                <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Net Sales</th>
                                <th className="text-right py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Net Profit</th>
                                <th className="text-center py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Tenders</th>
                                <th className="text-left py-4 px-6 font-medium text-slate-600 dark:text-d-muted">Closed By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {closings.map((c) => (
                                <tr
                                    key={c._id}
                                    onClick={() => navigate(`/closing/${c._id}`)}
                                    className="border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] cursor-pointer transition-colors"
                                >
                                    <td className="py-4 px-6 font-semibold text-slate-800 dark:text-d-heading">
                                        #{c.closingNumber}
                                    </td>
                                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-d-text">
                                        {new Date(c.periodStart).toLocaleDateString()} – {new Date(c.periodEnd).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-6 text-right font-medium text-slate-800 dark:text-d-heading">
                                        {(c.netSales ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-4 px-6 text-right font-medium text-emerald-600 dark:text-d-green">
                                        {(c.netProfit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {['cash', 'card', 'online'].map((key) => {
                                                const t = c.tenderReconciliation?.[key];
                                                const status = t?.reconciled;
                                                const dotClass =
                                                    status === true
                                                        ? 'bg-emerald-500 dark:bg-d-green'
                                                        : status === false
                                                            ? 'bg-red-500 dark:bg-d-red'
                                                            : 'bg-slate-300 dark:bg-d-faint';
                                                const label = key === 'online' ? 'Online' : key === 'card' ? 'Card' : 'Cash';
                                                const title = `${label}: ${status === true ? 'Matches' : status === false ? 'Variance' : 'Not checked'}`;
                                                return (
                                                    <span
                                                        key={key}
                                                        title={title}
                                                        className={`w-2.5 h-2.5 rounded-full ${dotClass}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-d-text">
                                        {c.closedBy?.name || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {pagination.pages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-d-border">
                            <p className="text-sm text-slate-500 dark:text-d-muted">
                                Page {pagination.page} of {pagination.pages} ({pagination.total} closings)
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={pagination.page <= 1}
                                    onClick={() => fetchHistory(pagination.page - 1)}
                                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => fetchHistory(pagination.page + 1)}
                                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // =========================================================================
    // Main render
    // =========================================================================

    return (
        <div className="p-6 animate-fadeIn bg-slate-50 dark:bg-d-bg min-h-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Store Closing</h1>
                    <p className="text-slate-500 dark:text-d-muted">Reconcile goods sold against how it was settled</p>
                </div>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-d-card rounded-xl p-1 border border-slate-200 dark:border-d-border mb-6 w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === t.id
                                ? 'bg-primary-500 dark:bg-d-accent text-white dark:text-d-card shadow-sm'
                                : 'text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover'
                        }`}
                    >
                        <t.icon size={15} />
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'new' ? renderNewClosing() : renderHistory()}

            {/* Confirm finalize modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-sm animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Finalize Closing?</h3>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-500 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 dark:text-d-text">
                                This locks the period from <strong>{preview && new Date(preview.periodStart).toLocaleString()}</strong> to{' '}
                                <strong>{preview && new Date(preview.periodEnd).toLocaleString()}</strong>. Once finalized, it{' '}
                                <strong>cannot be edited or undone</strong>.
                            </p>
                        </div>
                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFinalize}
                                disabled={finalizing}
                                className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                            >
                                {finalizing ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <FiLock size={15} />
                                )}
                                {finalizing ? 'Finalizing...' : 'Confirm & Lock'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Period modal */}
            {showPeriodModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-md animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">Edit Period</h3>
                            <button
                                onClick={() => setShowPeriodModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-500 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-2">
                                    Quick Ranges
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => applyPreset('default')}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-d-border text-sm font-medium text-left text-slate-700 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass hover:border-primary-300 dark:hover:border-d-accent/50 transition-colors"
                                    >
                                        Since Last Closing <span className="text-slate-400 dark:text-d-faint font-normal">(default)</span>
                                    </button>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('today')}
                                            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-d-border text-sm font-medium text-slate-700 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass hover:border-primary-300 dark:hover:border-d-accent/50 transition-colors"
                                        >
                                            Today
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('week')}
                                            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-d-border text-sm font-medium text-slate-700 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass hover:border-primary-300 dark:hover:border-d-accent/50 transition-colors"
                                        >
                                            This Week
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-d-border pt-5">
                                <label className="block text-sm font-medium text-slate-700 dark:text-d-text mb-2">
                                    Custom Range
                                </label>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-d-bg rounded-xl pl-3 pr-2 py-2 border border-slate-200 dark:border-d-border">
                                        <span className="text-xs text-slate-400 dark:text-d-faint w-9 shrink-0">From</span>
                                        <input
                                            type="datetime-local"
                                            value={draftStart}
                                            onChange={(e) => setDraftStart(e.target.value)}
                                            className="bg-transparent text-sm text-slate-700 dark:text-d-text focus:outline-none flex-1"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-d-bg rounded-xl pl-3 pr-2 py-2 border border-slate-200 dark:border-d-border">
                                        <span className="text-xs text-slate-400 dark:text-d-faint w-9 shrink-0">To</span>
                                        <input
                                            type="datetime-local"
                                            value={draftEnd}
                                            onChange={(e) => setDraftEnd(e.target.value)}
                                            className="bg-transparent text-sm text-slate-700 dark:text-d-text focus:outline-none flex-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                type="button"
                                onClick={() => setShowPeriodModal(false)}
                                className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={applyCustomRange}
                                disabled={!draftStart || !draftEnd}
                                className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Closing;
