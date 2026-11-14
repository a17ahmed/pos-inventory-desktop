import React, { useState, useEffect, useCallback } from 'react';
import {
    cn,
    DataTable,
    Dash,
    StatusChip,
    PageHeader,
    Tabs,
    Button,
    Input,
    Textarea,
    Field,
    Checkbox,
    Alert,
    Dialog,
    ConfirmDialog,
    SectionCard,
    Skeleton,
} from '../components/ui';
import { formatAmount } from '../utils/money';
import { useBusiness } from '../context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLastClosing, getClosingPreview, createClosing, getClosings } from '../services/api/closing';
import ClosingReport from '../components/ClosingReport';
import { appAlert } from '../components/AppDialog';
import { FiPlus, FiClock, FiLock, FiCalendar } from 'react-icons/fi';

const TABS = [
    { value: 'new', label: 'New closing', icon: FiPlus },
    { value: 'history', label: 'History', icon: FiClock },
];

const when = (d) =>
    new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const toDatetimeLocalValue = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const Closing = () => {
    const navigate = useNavigate();
    const { isAdmin, permissions } = useAuth();
    const { business } = useBusiness();
    const money = (n) => formatAmount(n, { currency: business?.currency || 'PKR', decimals: 2 });
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
    // Money Book: counted / statement balance per account { [accountId]: '123' }
    const [accountCounts, setAccountCounts] = useState({});
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

    // Only accounts the closer actually typed a figure for (sent only when the
    // preview has per-account rows, i.e. the Money Book is on)
    const accountCountList = () => Object.entries(accountCounts)
        .map(([accountId, v]) => ({ accountId, counted: toNumOrUndefined(v) }))
        .filter((c) => c.counted !== undefined);
    const hasAccountRows = (preview?.accountReconciliation?.length || 0) > 0;
    // The drawer is counted in the account table → no separate cash input
    const drawerCountedByAccount = hasAccountRows && preview.accountReconciliation.some((r) => r.systemKey === 'cash_drawer');

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
            const counts = accountCountList();
            if (counts.length) params.accountCounts = counts.map((c) => `${c.accountId}:${c.counted}`).join(',');
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
    }, [overrideStart, overrideEnd, countedCash, countedCard, countedOnline, accountCounts]);

    useEffect(() => {
        const handle = setTimeout(() => {
            fetchPreview();
        }, 400);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overrideStart, overrideEnd, countedCash, countedCard, countedOnline, accountCounts]);

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

    const [historyError, setHistoryError] = useState(null);
    const fetchHistory = useCallback(async (page = 1) => {
        setLoadingHistory(true);
        setHistoryError(null);
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
            setHistoryError(err.response?.data?.message || (!navigator.onLine ? 'You seem to be offline.' : 'The server didn\'t answer.'));
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
                countedCash: drawerCountedByAccount ? undefined : toNumOrUndefined(countedCash),
                ...(hasAccountRows && accountCountList().length ? { accountCounts: accountCountList() } : {}),
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
        <div className="flex flex-col gap-5">
            {/* Period */}
            <SectionCard>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-accent text-accent-foreground inline-flex items-center justify-center">
                        <FiCalendar className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div className="flex-1 min-w-[240px]">
                        <p className="font-mono text-overline-lg uppercase text-muted-foreground">
                            {!overrideStart && !overrideEnd ? 'Period · since the last closing' : 'Period · picked by you'}
                        </p>
                        {loadingPreview && !preview ? (
                            <Skeleton className="mt-1.5 h-5 w-72" />
                        ) : preview ? (
                            <p className="mt-0.5 text-body-lg font-medium text-foreground">
                                {when(preview.periodStart)} <span className="text-muted-foreground">→</span> {when(preview.periodEnd)}
                            </p>
                        ) : (
                            <p className="mt-0.5 text-body-lg text-muted-foreground">—</p>
                        )}
                        <p className="mt-0.5 text-body-sm text-muted-foreground">
                            {loadingLast
                                ? 'Looking up the last closing…'
                                : lastClosing
                                  ? `Last closing #${lastClosing.closingNumber} ended ${when(lastClosing.periodEnd)}`
                                  : 'No closings yet — this will be the first one.'}
                            {loadingPreview && preview ? ' · updating…' : ''}
                        </p>
                    </div>
                    <Button variant="outline" onClick={openPeriodModal}>
                        <FiClock aria-hidden="true" />
                        Change period
                    </Button>
                </div>
            </SectionCard>

            {previewError && <Alert tone="destructive" title="Couldn't work out this closing">{previewError}</Alert>}

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
                                    cash: drawerCountedByAccount ? (
                                        <p className="text-body-sm text-muted-foreground">Count the drawer in the Money accounts table above.</p>
                                    ) : cashNegative ? (
                                        <Alert tone="destructive">Sort out cash first — the expected amount is below zero.</Alert>
                                    ) : (
                                        <Input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            mono
                                            value={countedCash}
                                            onChange={(e) => setCountedCash(e.target.value)}
                                            placeholder="0.00"
                                            aria-label="Cash counted"
                                        />
                                    ),
                                    card: (
                                        <Input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            mono
                                            value={countedCard}
                                            onChange={(e) => setCountedCard(e.target.value)}
                                            placeholder="0.00"
                                            aria-label="Card total counted"
                                        />
                                    ),
                                    online: (
                                        <Input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            mono
                                            value={countedOnline}
                                            onChange={(e) => setCountedOnline(e.target.value)}
                                            placeholder="0.00"
                                            aria-label="Online total counted"
                                        />
                                    ),
                                }; })()
                                : null
                        }
                        accountEditors={
                            canCreate && hasAccountRows
                                ? Object.fromEntries(preview.accountReconciliation.map((r) => [
                                    String(r.account),
                                    <Input
                                        key={String(r.account)}
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        mono
                                        size="xs"
                                        className="w-36 text-right"
                                        value={accountCounts[String(r.account)] ?? ''}
                                        onChange={(e) => setAccountCounts((c) => ({ ...c, [String(r.account)]: e.target.value }))}
                                        placeholder="0.00"
                                        aria-label={`${r.name} counted`}
                                    />,
                                ]))
                                : undefined
                        }
                    />

                    {/* Note + finalize */}
                    {canCreate && (
                        <SectionCard
                            title="Finish the closing"
                            description="Locks this period for good. Bills, returns and expenses in it can't be changed afterwards."
                            footer={
                                <Button onClick={() => setShowConfirm(true)} disabled={!canFinalize}>
                                    <FiLock aria-hidden="true" />
                                    Finalize closing
                                </Button>
                            }
                        >
                            <div className="flex flex-col gap-4">
                                <Field label="Note" optional>
                                    <Textarea
                                        value={countedNote}
                                        onChange={(e) => setCountedNote(e.target.value)}
                                        rows={2}
                                        className="resize-none"
                                        placeholder="e.g. Drawer counted by Ali, all good"
                                    />
                                </Field>

                                {anyTenderUnresolved && (
                                    <div className="rounded-xl border border-warning/40 bg-warning-chip px-3">
                                        <Checkbox
                                            checked={acknowledgeMismatch}
                                            onChange={setAcknowledgeMismatch}
                                            label="Finalize anyway"
                                            description="Some amounts above are not counted yet or don't match. I've checked them and want to lock this closing."
                                        />
                                    </div>
                                )}

                                {finalizeError && <Alert tone="destructive" title="Couldn't finalize">{finalizeError}</Alert>}
                            </div>
                        </SectionCard>
                    )}
                </>
            )}
        </div>
    );

    // =========================================================================
    // Render: History tab
    // =========================================================================

    const TENDER_LABEL = { cash: 'Cash', card: 'Card', online: 'Online' };
    const historyColumns = [
        { id: 'number', header: '#', accessorFn: (c) => c.closingNumber || 0, meta: { mono: true }, cell: ({ getValue }) => <span className="font-medium">#{getValue()}</span> },
        {
            id: 'period',
            header: 'Period',
            accessorFn: (c) => new Date(c.periodStart).getTime() || 0,
            cell: ({ row: { original: c } }) => (
                <span className="whitespace-nowrap">
                    {when(c.periodStart)} – {when(c.periodEnd)}
                </span>
            ),
        },
        {
            id: 'sales',
            header: 'Net sales',
            accessorFn: (c) => c.netSales ?? 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => <span className="font-medium tabular-nums whitespace-nowrap">{money(getValue())}</span>,
        },
        {
            id: 'profit',
            header: 'Net profit',
            accessorFn: (c) => c.netProfit ?? 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => (
                <span className={cn('font-medium tabular-nums whitespace-nowrap', getValue() < 0 ? 'text-destructive' : 'text-success')}>{money(getValue())}</span>
            ),
        },
        {
            id: 'tenders',
            header: 'Tenders',
            enableSorting: false,
            cell: ({ row: { original: c } }) => (
                <div className="flex flex-wrap items-center gap-1">
                    {['cash', 'card', 'online'].map((key) => {
                        const status = c.tenderReconciliation?.[key]?.reconciled;
                        return (
                            <StatusChip
                                key={key}
                                size="xs"
                                shape="dot"
                                tone={status === true ? 'success' : status === false ? 'destructive' : 'neutral'}
                                label={TENDER_LABEL[key]}
                                title={`${TENDER_LABEL[key]}: ${status === true ? 'Matches' : status === false ? 'Variance' : 'Not checked'}`}
                            />
                        );
                    })}
                </div>
            ),
        },
        { id: 'by', header: 'Closed by', accessorFn: (c) => c.closedBy?.name || '', cell: ({ getValue }) => getValue() || <Dash /> },
    ];

    const renderHistory = () => (
        <DataTable
            caption="Closing history"
            data={closings}
            columns={historyColumns}
            getRowId={(c) => c._id}
            loading={loadingHistory}
            error={historyError ? { message: historyError, onRetry: () => fetchHistory(pagination.page || 1) } : null}
            empty={{ icon: FiClock, title: 'No closings yet', description: 'Finalize your first closing from the New closing tab.' }}
            onRowClick={(c) => navigate(`/closing/${c._id}`)}
            rowLabel={(c) => `Open closing #${c.closingNumber}`}
            rowTone={(c) => (['cash', 'card', 'online'].some((k) => c.tenderReconciliation?.[k]?.reconciled === false) ? 'attention' : null)}
            server={{ page: pagination.page || 1, pageSize: pagination.limit || 20, total: pagination.total || 0, onPageChange: fetchHistory, noun: 'closings' }}
        />
    );

    // =========================================================================
    // Main render
    // =========================================================================

    return (
        <div className="p-6 animate-fadeIn min-h-full">
            <PageHeader
                title="Closing"
                subtitle="Count the money, check it against the sales, and lock the period."
                tabs={<Tabs items={TABS} value={activeTab} onChange={setActiveTab} label="Closing sections" bordered={false} />}
            />

            {activeTab === 'new' ? renderNewClosing() : renderHistory()}

            <ConfirmDialog
                open={showConfirm}
                tone="warning"
                icon={FiLock}
                title="Lock this closing?"
                message={preview ? `${when(preview.periodStart)} → ${when(preview.periodEnd)}` : ''}
                note="Once locked it can't be edited or undone."
                confirmText="Lock closing"
                cancelText="Not yet"
                loading={finalizing}
                onConfirm={handleFinalize}
                onCancel={() => setShowConfirm(false)}
            />

            <Dialog
                open={showPeriodModal}
                onClose={() => setShowPeriodModal(false)}
                title="Change period"
                description="Normally a closing runs from the end of the last one until now."
                footerBar
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowPeriodModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={applyCustomRange} disabled={!draftStart || !draftEnd}>
                            Use these dates
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <p className="font-mono text-overline-lg uppercase text-muted-foreground mb-1.5">Quick</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="xs" onClick={() => applyPreset('default')}>
                                Since the last closing
                            </Button>
                            <Button variant="outline" size="xs" onClick={() => applyPreset('today')}>
                                Today
                            </Button>
                            <Button variant="outline" size="xs" onClick={() => applyPreset('week')}>
                                This week
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-hairline pt-4">
                        <Field label="From">
                            <Input type="datetime-local" value={draftStart} max={draftEnd || undefined} onChange={(e) => setDraftStart(e.target.value)} />
                        </Field>
                        <Field label="To">
                            <Input type="datetime-local" value={draftEnd} min={draftStart || undefined} onChange={(e) => setDraftEnd(e.target.value)} />
                        </Field>
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default Closing;
