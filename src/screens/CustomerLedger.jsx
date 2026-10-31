import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import {
    PERIOD_OPTIONS,
    DEFAULT_PERIOD,
    describeSinceZero,
    TYPE_OPTIONS,
    PAGE_SIZE,
    returnNote,
    formatDateRange,
    STATEMENT_PDF_WIDTH,
    formatBalance,
    describePeriod,
    loadStatement,
    loadPendingBills,
    loadFullStatement,
    buildStatementHtml,
} from '../utils/customerStatement';
import {
    getCustomer,
    getCustomerLedger,
    collectFromCustomer,
    getCustomerRates,
    replaceCustomerRates,
} from '../services/api/customers';
import { getProducts } from '../services/api/products';
import SpecialRatesEditor from '../components/SpecialRatesEditor';
import {
    canSaveCustomerRates,
    toDraftRates,
    toRatesPayload,
    validateDraftRates,
    friendlyRateError,
} from '../utils/specialRates';
import { addBillPayment } from '../services/api/bills';
import { appAlert, appConfirm } from '../components/AppDialog';
import {
    FiArrowLeft,
    FiDownload,
    FiPrinter,
    FiDollarSign,
    FiTrendingUp,
    FiTrendingDown,
    FiAlertCircle,
    FiUser,
    FiPhone,
    FiMail,
    FiMapPin,
    FiCalendar,
    FiPlus,
    FiX,
    FiSearch,
    FiChevronDown,
    FiArrowDown,
    FiChevronRight,
    FiChevronLeft,
    FiFilter,
    FiCheck,
    FiRefreshCw,
    FiFileText,
} from 'react-icons/fi';

// Table heading cell
const TH = 'py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-d-muted whitespace-nowrap';

const METHOD_LABEL = { cash: 'Cash', card: 'Card', online: 'Online', bank_transfer: 'Bank transfer', cheque: 'Cheque', store_credit: 'Store credit' };

const CustomerLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { business } = useBusiness();

    const [customer, setCustomer] = useState(null);

    // Special Rates tab
    const { isAdmin, permissions } = useAuth();
    const canSaveRates = canSaveCustomerRates(isAdmin, permissions);
    const [pageTab, setPageTab] = useState('ledger'); // 'ledger' | 'rates'
    const [ratesDraft, setRatesDraft] = useState([]);
    const [ratesOriginal, setRatesOriginal] = useState(null); // JSON of loaded payload; null = not loaded
    const [ratesLoaded, setRatesLoaded] = useState([]); // loaded draft, for "Discard changes"
    const [rateProducts, setRateProducts] = useState([]);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [savingRates, setSavingRates] = useState(false);
    const rateProductsById = useMemo(() => {
        const map = {};
        rateProducts.forEach((p) => { map[p._id] = p; });
        return map;
    }, [rateProducts]);
    const ratesDirty = ratesOriginal !== null && JSON.stringify(toRatesPayload(ratesDraft)) !== ratesOriginal;

    const loadRates = useCallback(async () => {
        setRatesLoading(true);
        try {
            const [ratesRes, productsRes] = await Promise.all([getCustomerRates(id), getProducts()]);
            const draft = toDraftRates(ratesRes.data?.rates);
            setRateProducts(productsRes.data || []);
            setRatesDraft(draft);
            setRatesLoaded(draft);
            setRatesOriginal(JSON.stringify(toRatesPayload(draft)));
        } catch (err) {
            console.error('Error loading special rates:', err);
            appAlert(err.response?.data?.message || 'Failed to load special rates');
        } finally {
            setRatesLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (pageTab === 'rates' && ratesOriginal === null) loadRates();
    }, [pageTab, ratesOriginal, loadRates]);

    const saveRates = async () => {
        const rateError = validateDraftRates(ratesDraft, rateProductsById);
        if (rateError) {
            appAlert(rateError);
            return;
        }
        setSavingRates(true);
        try {
            await replaceCustomerRates(id, toRatesPayload(ratesDraft));
            await loadRates();
        } catch (err) {
            appAlert(friendlyRateError(err.response?.data?.message || 'Failed to save special rates', rateProductsById));
        } finally {
            setSavingRates(false);
        }
    };
    // Statement: one period at a time. The cards use `summary` (all-time) and
    // never change with filters; every line's balance comes from the backend.
    const [statement, setStatement] = useState(null); // { summary, period, entries, pagination }
    const [loading, setLoading] = useState(true);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const tableScrollRef = useRef(null);
    const [error, setError] = useState(null);

    // Filters (all applied server-side)
    const [periodPreset, setPeriodPreset] = useState(DEFAULT_PERIOD);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('oldest');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState(''); // debounced searchInput
    const [openMenu, setOpenMenu] = useState(null); // 'filters' when the filter menu is open
    const filterMenuRef = useRef(null);
    // The filter menu edits a draft; Apply commits it (one reload, not one per click)
    const [draft, setDraft] = useState({ period: DEFAULT_PERIOD, from: '', to: '', type: 'all' });

    // Bills behind Amount Due — the Amount Due panel and Record Payment both use it
    const [pending, setPending] = useState(null); // { bills, totalDue, availableCredit, amountDue }
    const [showPendingPanel, setShowPendingPanel] = useState(false);
    const [loadingPending, setLoadingPending] = useState(false);

    // Print / PDF of the selected period
    const [exporting, setExporting] = useState(false);
    const [printHtml, setPrintHtml] = useState('');

    // Row expansion
    const [expandedRow, setExpandedRow] = useState(null);

    // Record payment modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMode, setPaymentMode] = useState('fifo'); // 'fifo' | 'specific'
    const [paymentForm, setPaymentForm] = useState({
        billId: '',
        amount: '',
        method: 'cash',
        note: '',
    });
    const [submittingPayment, setSubmittingPayment] = useState(false);

    const currency = business?.currency || 'Rs.';
    const formatNumber = (amount) => Math.abs(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const formatCurrency = (amount) =>
        `${currency} ${Math.abs(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    // =========================================================================
    // Data
    // =========================================================================

    const customIncomplete = periodPreset === 'custom' && (!customFrom || !customTo);
    const statementParams = useMemo(() => {
        const params = { period: periodPreset, type: typeFilter, sort: sortOrder, limit: pageSize };
        if (periodPreset === 'custom') {
            params.from = customFrom;
            params.to = customTo;
        }
        if (searchQuery.trim()) params.search = searchQuery.trim();
        return params;
    }, [periodPreset, customFrom, customTo, typeFilter, sortOrder, searchQuery, pageSize]);

    // Close the open filter dropdown on outside click / Escape.
    useEffect(() => {
        if (!openMenu) return undefined;
        const onDown = (e) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) setOpenMenu(null);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpenMenu(null); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [openMenu]);

    // Search by bill number — wait until typing pauses.
    useEffect(() => {
        const t = setTimeout(() => setSearchQuery(searchInput), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const fetchCustomer = useCallback(async () => {
        try {
            const res = await getCustomer(id);
            setCustomer(res.data);
        } catch (err) {
            console.error('Error fetching customer:', err);
        }
    }, [id]);

    useEffect(() => {
        fetchCustomer();
    }, [fetchCustomer]);

    // One page of lines for the current filters. A filter change goes back to
    // page 1. Balances are per line from the backend, so every page is correct.
    const fetchStatement = useCallback(async (pageNum = 1) => {
        if (customIncomplete) return;
        setLoading(true);
        setError(null);
        try {
            const data = await loadStatement(id, { ...statementParams, page: pageNum });
            if (import.meta.env.DEV && data?.period?.preset === 'sinceZero'
                && Math.abs((data.period.closingBalance || 0) - (data.summary?.amountDue || 0)) > 0.005) {
                console.warn('[statement] since-last-zero closing', data.period.closingBalance, '≠ amount due', data.summary?.amountDue);
            }
            setStatement(data);
            setExpandedRow(null);
            if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
        } catch (err) {
            console.error('Error fetching statement:', err);
            setError(err.response?.data?.message || 'Failed to load ledger');
        } finally {
            setLoading(false);
        }
    }, [id, statementParams, customIncomplete]);

    useEffect(() => {
        fetchStatement(1);
    }, [fetchStatement]);

    const fetchPending = useCallback(async () => {
        setLoadingPending(true);
        try {
            const data = await loadPendingBills(id, { sort: 'oldest' });
            setPending(data);
            return data;
        } catch (err) {
            appAlert(err.response?.data?.message || 'Failed to load unpaid bills');
            return null;
        } finally {
            setLoadingPending(false);
        }
    }, [id]);

    const refreshAll = () => {
        fetchCustomer();
        fetchStatement(statement?.pagination?.page || 1);
        if (pending) fetchPending();
    };

    const openPendingPanel = () => {
        setShowPendingPanel(true);
        fetchPending();
    };

    // Record Payment uses the backend's unpaid-bill list (no per-line summing here).
    const outstandingBills = pending?.bills || [];
    const totalOutstanding = pending?.totalDue || 0;

    const openPaymentModal = async () => {
        const data = await fetchPending();
        if (!data) return;
        setPaymentMode('fifo');
        // Amount starts empty on purpose — staff kept saving the pre-filled total
        // outstanding instead of what the customer actually paid.
        setPaymentForm({
            billId: data.bills?.[0]?.billId || '',
            amount: '',
            method: 'cash',
            note: '',
        });
        setShowPaymentModal(true);
    };

    const submitPayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentForm.amount);
        if (!amount || amount <= 0) {
            appAlert('Enter a valid amount');
            return;
        }

        if (paymentMode === 'fifo' && amount > totalOutstanding + 0.01) {
            appAlert(`Amount exceeds total outstanding (${formatCurrency(totalOutstanding)})`);
            return;
        }
        if (paymentMode === 'specific' && !paymentForm.billId) {
            appAlert('Select a bill');
            return;
        }

        // Confirm the exact amount before saving.
        const methodLabel = { cash: 'cash', card: 'card', online: 'online' }[paymentForm.method] || paymentForm.method;
        const target = paymentMode === 'fifo'
            ? 'applied to the oldest unpaid bills first'
            : `on Bill #${outstandingBills.find((b) => String(b.billId) === String(paymentForm.billId))?.billNumber ?? ''}`;
        const ok = await appConfirm(
            `Record ${formatCurrency(amount)} (${methodLabel}) from ${customer?.name || 'this customer'}, ${target}?`,
            { title: 'Confirm payment', confirmText: `Record ${formatCurrency(amount)}` }
        );
        if (!ok) return;

        setSubmittingPayment(true);
        try {
            let res;
            if (paymentMode === 'fifo') {
                res = await collectFromCustomer(id, {
                    amount,
                    method: paymentForm.method,
                    note: paymentForm.note,
                });
            } else {
                res = await addBillPayment(paymentForm.billId, {
                    amount,
                    method: paymentForm.method,
                    note: paymentForm.note,
                });
            }
            setShowPaymentModal(false);
            fetchStatement(statement?.pagination?.page || 1);
            fetchPending();
            // Store credit is applied to unpaid bills before the payment — say so.
            const moves = res?.data?.creditSettlement || [];
            if (moves.length > 0) {
                appAlert(
                    moves.map((m) => `Credit ${formatCurrency(m.amount)} from Bill #${m.fromNumber} was applied to Bill #${m.toNumber} first.`).join('\n'),
                    { title: 'Store credit applied' }
                );
            }
        } catch (err) {
            console.error('Payment error:', err);
            appAlert(err.response?.data?.message || 'Failed to record payment');
        } finally {
            setSubmittingPayment(false);
        }
    };

    // Print / PDF: the selected period as a statement — every page of lines
    // (cancelled bills excluded), opening and closing balance, all-time Amount Due.
    const exportStatement = async (mode) => {
        if (customIncomplete || exporting) return;
        setExporting(true);
        try {
            const full = await loadFullStatement(id, statementParams);
            const periodText = describePeriod(full.period, periodPreset);
            const html = buildStatementHtml({
                business,
                customer,
                statement: full,
                currency: business?.currency || 'PKR',
                periodText,
                paged: mode === 'pdf',
            });

            if (mode === 'pdf') {
                const container = document.createElement('div');
                // Fixed width so page breaks don't depend on the window size
                container.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${STATEMENT_PDF_WIDTH}px;`;
                container.innerHTML = html;
                document.body.appendChild(container);
                try {
                    await html2pdf()
                        .set({
                            margin: [8, 6, 8, 6],
                            filename: `statement-${(customer?.name || 'customer').replace(/\s+/g, '_')}-${periodText.replace(/[^a-z0-9]+/gi, '_')}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2, useCORS: true },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                            // Pages are already split into tables (page-break-before);
                            // only keep a single line from being cut in half.
                            pagebreak: { mode: ['css'], avoid: 'tr' },
                        })
                        .from(container.firstElementChild)
                        .save();
                } finally {
                    document.body.removeChild(container);
                }
            } else {
                // Render the statement into the print-only block, then print.
                setPrintHtml(html);
                await new Promise((r) => setTimeout(r, 200));
                if (window.electronAPI?.printPage) {
                    const res = await window.electronAPI.printPage();
                    if (res && res.success === false && res.failureReason && res.failureReason !== 'cancelled') {
                        appAlert(res.failureReason, { title: 'Printing failed', danger: true });
                    }
                } else {
                    window.print();
                }
                setPrintHtml('');
            }
        } catch (err) {
            console.error('Statement export error:', err);
            appAlert(err.response?.data?.message || 'Could not prepare the statement');
        } finally {
            setExporting(false);
        }
    };

    // =========================================================================
    // Render
    // =========================================================================

    if (loading && !statement) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading ledger...</p>
                </div>
            </div>
        );
    }

    if (error && !statement) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4 text-center">
                    <FiAlertCircle size={48} className="text-red-500 dark:text-d-red" />
                    <p className="text-slate-700 dark:text-d-text">{error}</p>
                    <button
                        onClick={() => navigate('/customers')}
                        className="px-4 py-2 bg-primary-500 dark:bg-d-accent text-white dark:text-d-card rounded-xl"
                    >
                        Back to Customers
                    </button>
                </div>
            </div>
        );
    }

    const summary = statement?.summary || {};
    const period = statement?.period || {};
    const entries = statement?.entries || [];
    const pagination = statement?.pagination || {};
    const amountDue = summary.amountDue || 0;

    const openFilters = () => {
        setDraft({ period: periodPreset, from: customFrom, to: customTo, type: typeFilter });
        setOpenMenu((m) => (m === 'filters' ? null : 'filters'));
    };
    const draftIncomplete = draft.period === 'custom' && (!draft.from || !draft.to);
    const applyFilters = () => {
        if (draftIncomplete) return;
        setPeriodPreset(draft.period);
        setCustomFrom(draft.from);
        setCustomTo(draft.to);
        setTypeFilter(draft.type);
        setOpenMenu(null);
    };
    const activeFilterCount = (periodPreset !== DEFAULT_PERIOD ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);
    const periodLabel = periodPreset === 'custom'
        ? (customIncomplete ? 'Custom dates' : formatDateRange(customFrom, customTo))
        : (PERIOD_OPTIONS.find((o) => o.value === periodPreset)?.label || 'Today');
    const typeLabel = TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label || 'All';

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-d-bg print:bg-white print:h-auto print:overflow-visible">
            {/* Print-only statement (filled just before printing) */}
            {printHtml && <div className="hidden print:block" dangerouslySetInnerHTML={{ __html: printHtml }} />}
            <div className="max-w-[1400px] mx-auto p-6 print:hidden">
                {/* Header — the customer is the title */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <button onClick={() => navigate('/customers')} title="Back to customers" aria-label="Back to customers" className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted hover:text-slate-900 dark:hover:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <FiArrowLeft size={16} />
                        </button>
                        <div className="w-10 h-10 shrink-0 rounded-[10px] bg-amber-400 dark:bg-d-accent text-slate-900 dark:text-d-bg flex items-center justify-center text-[17px] font-bold">
                            {(customer?.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-d-heading truncate">{customer?.name || 'Customer'}</h1>
                            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-d-muted truncate">
                                {[
                                    customer?.phone,
                                    customer?.email,
                                    customer?.address,
                                    customer?.lastPurchase && `Last purchase ${new Date(customer.lastPurchase).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
                                    customer?.creditLimit ? `Credit limit ${formatCurrency(customer.creditLimit)}` : null,
                                    customer?.creditDays ? `${customer.creditDays} credit days` : null,
                                ].filter(Boolean).join('  ·  ')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={refreshAll} title="Refresh" aria-label="Refresh" className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted hover:text-slate-900 dark:hover:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={() => exportStatement('print')} disabled={exporting || customIncomplete} title="Print the selected period as a statement" aria-label="Print statement" className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted hover:text-slate-900 dark:hover:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <FiPrinter size={15} />
                        </button>
                        <button onClick={() => exportStatement('pdf')} disabled={exporting || customIncomplete} title="Download the selected period as a PDF" aria-label="Download PDF" className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted hover:text-slate-900 dark:hover:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            {exporting ? <FiRefreshCw size={15} className="animate-spin" /> : <FiDownload size={15} />}
                        </button>
                        <button
                            onClick={openPaymentModal}
                            disabled={amountDue <= 0 || loadingPending}
                            className="h-9 flex items-center gap-1.5 px-3.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-d-green dark:hover:brightness-110 text-white dark:text-d-bg rounded-[10px] text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <FiPlus size={15} strokeWidth={2.5} />
                            Record payment
                        </button>
                    </div>
                </div>

                {/* Summary — one box, five all-time figures (never change with filters) */}
                <div className="grid grid-cols-2 md:grid-cols-5 mb-5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-d-border">
                    <SummaryFigure label="Total billed" value={formatCurrency(summary.totalBilled || 0)} />
                    <SummaryFigure label="Total paid" value={formatCurrency(summary.totalPaid || 0)} tone="green" />
                    <SummaryFigure label="Returns" value={formatCurrency(summary.totalReturns || 0)} tone="amber" />
                    <SummaryFigure label="Bills" value={(summary.totalBills || 0).toLocaleString()} />
                    <SummaryFigure
                        label={amountDue < 0 ? 'Store credit' : 'Amount due'}
                        value={formatCurrency(Math.abs(amountDue))}
                        tone={amountDue > 0 ? 'red' : amountDue < 0 ? 'green' : undefined}
                        tinted={amountDue !== 0}
                        action={amountDue !== 0 ? 'View bills' : undefined}
                        onClick={openPendingPanel}
                    />
                </div>

                {/* Ledger — one box: tabs + tools, period line, table, pages */}
                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl">
                    <div ref={filterMenuRef} className="flex flex-wrap items-center justify-between gap-3 px-4 border-b border-slate-200 dark:border-d-border print:hidden">
                        <div className="flex gap-6">
                            {[
                                { id: 'ledger', label: 'Ledger' },
                                { id: 'rates', label: 'Special rates' },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setPageTab(t.id)}
                                    className={`-mb-px pt-4 pb-3.5 text-sm border-b-2 transition-colors ${
                                        pageTab === t.id
                                            ? 'border-amber-500 dark:border-d-accent text-slate-900 dark:text-d-heading font-semibold'
                                            : 'border-transparent text-slate-500 dark:text-d-muted hover:text-slate-800 dark:hover:text-d-text font-medium'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        {pageTab === 'ledger' && (
                            <div className="relative flex items-center gap-2 py-2.5">
                                <div className="relative">
                                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-muted" size={14} />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        placeholder="Search bill number"
                                        aria-label="Search bill number"
                                        className="w-56 h-[34px] pl-8 pr-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-[9px] text-[13px] text-slate-700 dark:text-d-text placeholder-slate-400 dark:placeholder-d-muted focus:outline-none focus:border-amber-400 dark:focus:border-d-border-hover"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={openFilters}
                                    title="Filters"
                                    aria-label={`Filters${activeFilterCount ? ` (${activeFilterCount} active)` : ''}`}
                                    className={`relative h-[34px] w-[34px] flex items-center justify-center rounded-[9px] border transition-colors ${
                                        activeFilterCount || openMenu === 'filters'
                                            ? 'bg-amber-50 border-amber-300 text-amber-600 dark:bg-[rgba(255,210,100,0.1)] dark:border-[rgba(255,210,100,0.35)] dark:text-d-accent'
                                            : 'border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted hover:text-slate-900 dark:hover:text-d-text'
                                    }`}
                                >
                                    <FiFilter size={15} />
                                    {activeFilterCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 dark:bg-d-accent text-white dark:text-d-bg text-[10px] font-bold flex items-center justify-center">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSortOrder(sortOrder === 'oldest' ? 'newest' : 'oldest')}
                                    title={sortOrder === 'oldest' ? 'Oldest first — click for newest first' : 'Newest first — click for oldest first'}
                                    aria-label={sortOrder === 'oldest' ? 'Sort: oldest first' : 'Sort: newest first'}
                                    className={`h-[34px] w-[34px] flex items-center justify-center rounded-[9px] border transition-colors ${
                                        sortOrder === 'newest'
                                            ? 'bg-amber-50 border-amber-300 text-amber-600 dark:bg-[rgba(255,210,100,0.1)] dark:border-[rgba(255,210,100,0.35)] dark:text-d-accent'
                                            : 'border-slate-200 dark:border-d-border text-slate-500 dark:text-d-muted hover:text-slate-900 dark:hover:text-d-text'
                                    }`}
                                >
                                    <SortIcon newestFirst={sortOrder === 'newest'} />
                                </button>

                                {openMenu === 'filters' && (
                                    <FilterMenu
                                        draft={draft}
                                        setDraft={setDraft}
                                        incomplete={draftIncomplete}
                                        onApply={applyFilters}
                                        onReset={() => setDraft({ period: DEFAULT_PERIOD, from: '', to: '', type: 'all' })}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {pageTab === 'rates' && (
                        <div className="p-6 max-w-3xl print:hidden">
                            {ratesLoading && ratesOriginal === null ? (
                                <div className="py-8 text-center text-sm text-slate-400 dark:text-d-faint">Loading special rates…</div>
                            ) : (
                                <>
                                    {!canSaveRates && (
                                        <p className="text-xs text-amber-600 dark:text-d-accent mb-3">You don't have permission to change customer rates.</p>
                                    )}
                                    <SpecialRatesEditor
                                        value={ratesDraft}
                                        onChange={setRatesDraft}
                                        products={rateProducts}
                                        readOnly={!canSaveRates}
                                        allowSellBelowCost={business?.settings?.allowSellBelowCost === true}
                                    />
                                    {canSaveRates && (
                                        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-d-border">
                                            <button
                                                type="button"
                                                disabled={!ratesDirty || savingRates}
                                                onClick={() => setRatesDraft(ratesLoaded)}
                                                className="px-4 py-2.5 text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-xl font-medium transition-colors disabled:opacity-50"
                                            >
                                                Discard changes
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!ratesDirty || savingRates}
                                                onClick={saveRates}
                                                className="px-5 py-2.5 bg-primary-500 dark:bg-d-accent text-white dark:text-d-card rounded-xl font-medium hover:bg-primary-600 dark:hover:bg-d-accent-s transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {savingRates ? 'Saving...' : 'Save rates'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                {pageTab === 'ledger' && (<>
                {/* Period line — the active filters as chips, then the period figures.
                    Opening/closing are for the whole period, whatever the type/search filter. */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 border-b border-slate-200 dark:border-d-border text-[13px] text-slate-500 dark:text-d-muted">
                    <div className="flex flex-wrap items-center gap-2">
                        <FilterChip
                            icon={<FiCalendar size={12} />}
                            label={periodPreset === 'custom' || periodPreset === 'all' ? periodLabel : describePeriod(period, periodPreset)}
                            onClear={periodPreset !== DEFAULT_PERIOD ? () => setPeriodPreset(DEFAULT_PERIOD) : undefined}
                            clearLabel="Back to since last zero"
                        />
                        {typeFilter !== 'all' && (
                            <FilterChip label={typeLabel} onClear={() => setTypeFilter('all')} clearLabel="Show all types" />
                        )}
                        {typeFilter !== 'cancelled' && period.cancelledCount > 0 && (
                            <button onClick={() => setTypeFilter('cancelled')} className="text-xs hover:text-slate-800 dark:hover:text-d-text">
                                {period.cancelledCount} cancelled hidden · <span className="underline underline-offset-2">show</span>
                            </button>
                        )}
                    </div>
                    <span className="tabular-nums">Opening <BalanceText value={period.openingBalance} currency={currency} /></span>
                    <span className="tabular-nums">Bills <b className="font-semibold text-red-600 dark:text-d-red">+{formatNumber(period.bills)}</b></span>
                    <span className="tabular-nums">Paid <b className="font-semibold text-emerald-600 dark:text-d-green">−{formatNumber(period.payments)}</b></span>
                    <span className="tabular-nums">Returns <b className="font-semibold text-amber-600 dark:text-d-accent">−{formatNumber(period.returns)}</b></span>
                    <span className="tabular-nums ml-auto">Closing <BalanceText value={period.closingBalance} currency={currency} strong /></span>
                    {period.sinceZero && describeSinceZero(period.sinceZero) && (
                        <span className="w-full text-xs text-slate-400 dark:text-d-muted">
                            {describeSinceZero(period.sinceZero)}
                        </span>
                    )}
                    {statement?.legacy && (
                        <span className="w-full text-[11px]" title="The statement API isn't available on this server yet">
                            Using the older ledger API
                        </span>
                    )}
                </div>

                {/* Ledger Table */}
                <div>
                    {entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-d-glass flex items-center justify-center text-slate-400 dark:text-d-muted">
                                <FiFileText size={18} />
                            </div>
                            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-d-text">No transactions in this period</p>
                            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-d-muted">
                                {typeFilter !== 'all' || searchQuery ? 'Try another type or clear the search.' : 'Pick another period from the filter menu.'}
                            </p>
                        </div>
                    ) : (
                        <>
                        {/* Lines scroll inside the card; the heading row stays on top.
                            Fills the window height, never shorter than 320px. */}
                        <div
                            ref={tableScrollRef}
                            className={`overflow-auto min-h-[320px] max-h-[calc(100vh-240px)] transition-opacity ${loading ? 'opacity-60' : ''}`}
                        >
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-d-elevated">
                                    <tr>
                                        <th className="w-8"></th>
                                        <th className={TH}>Date</th>
                                        <th className={TH}>Bill</th>
                                        <th className={TH}>Description</th>
                                        <th className={TH}>Method</th>
                                        <th className={`${TH} text-right`}>Debit</th>
                                        <th className={`${TH} text-right`}>Credit</th>
                                        <th className={`${TH} text-right`}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry, idx) => {
                                        const isExpanded = expandedRow === idx;
                                        const hasDetails =
                                            (entry.items && entry.items.length > 0) ||
                                            (entry.returnItems && entry.returnItems.length > 0) ||
                                            entry.notes;
                                        const d = new Date(entry.date);
                                        // Cancelled bills: shown for reference only — greyed, no
                                        // amounts, balance unaffected, and never printed.
                                        const isCancelled = entry.type === 'cancelled';
                                        return (
                                            <React.Fragment key={entry.id || idx}>
                                                <tr
                                                    onClick={() => hasDetails && setExpandedRow(isExpanded ? null : idx)}
                                                    className={`border-t border-slate-100 dark:border-white/[0.06] hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors ${
                                                        hasDetails ? 'cursor-pointer' : ''
                                                    } ${isCancelled ? 'opacity-60 print:hidden' : ''}`}
                                                >
                                                    <td className="py-3 px-2 text-center">
                                                        {hasDetails &&
                                                            (isExpanded ? (
                                                                <FiChevronDown size={14} className="text-slate-400 mx-auto" />
                                                            ) : (
                                                                <FiChevronRight size={14} className="text-slate-400 mx-auto" />
                                                            ))}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-800 dark:text-d-text">
                                                        {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        <span className="ml-1.5 text-xs text-slate-400 dark:text-d-muted">
                                                            {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-500 dark:text-d-muted">
                                                        {entry.billNumber ? `#${entry.billNumber}` : ''}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <TypeBadge type={entry.type} />
                                                            <span className={isCancelled ? 'text-slate-400 dark:text-d-muted line-through' : entry.type === 'credit_transfer' ? 'text-slate-500 dark:text-d-muted' : 'text-slate-800 dark:text-d-text'}>
                                                                {entry.description}
                                                            </span>
                                                        </div>
                                                        {entry.type === 'return' && returnNote(entry, formatCurrency) && (
                                                            <div className="mt-0.5 text-xs text-slate-500 dark:text-d-muted">{returnNote(entry, formatCurrency)}</div>
                                                        )}
                                                        {isCancelled && (
                                                            <div className="text-[11px] text-slate-500 dark:text-d-muted mt-0.5">
                                                                {formatCurrency(entry.billTotal || 0)} bill · not counted
                                                                {entry.cancelReason ? ` · Reason: ${entry.cancelReason}` : ''}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap text-[13px] text-slate-500 dark:text-d-muted">
                                                        {entry.method && (
                                                            <div>
                                                                {METHOD_LABEL[entry.method] || entry.method}
                                                                {entry.method === 'store_credit' && entry.fromBillNumber ? ` · from #${entry.fromBillNumber}` : ''}
                                                            </div>
                                                        )}
                                                        {entry.receivedBy && (
                                                            <div className="text-xs text-slate-400 dark:text-d-faint">{entry.receivedBy}</div>
                                                        )}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right whitespace-nowrap tabular-nums ${entry.type === 'credit_transfer' ? 'text-slate-500 dark:text-d-muted' : 'text-red-600 dark:text-d-red'}`}>
                                                        {entry.debit > 0 ? formatNumber(entry.debit) : <span className="text-slate-300 dark:text-d-faint">—</span>}
                                                    </td>
                                                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums text-emerald-600 dark:text-d-green">
                                                        {entry.credit > 0 ? formatNumber(entry.credit) : <span className="text-slate-300 dark:text-d-faint">—</span>}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap tabular-nums ${(entry.balance || 0) < 0 ? 'text-emerald-600 dark:text-d-green' : 'text-slate-900 dark:text-d-heading'}`}>
                                                        {(entry.balance || 0) < 0 ? 'Cr ' : ''}{formatNumber(Math.abs(entry.balance || 0))}
                                                    </td>
                                                </tr>
                                                {isExpanded && hasDetails && (
                                                    <tr className={`bg-slate-50/70 dark:bg-d-glass ${isCancelled ? 'print:hidden' : ''}`}>
                                                        <td></td>
                                                        <td colSpan={7} className="py-5 px-5">
                                                            {entry.items && entry.items.length > 0 && (
                                                                <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                                                                    {/* Gradient Header */}
                                                                    <div className="relative px-6 py-4 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-d-elevated dark:via-d-card dark:to-d-elevated border-b border-slate-200 dark:border-d-border">
                                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 to-primary-600 dark:from-d-accent dark:to-d-accent/50" />
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-9 h-9 rounded-xl bg-primary-500 dark:bg-d-accent flex items-center justify-center shadow-sm">
                                                                                    <FiFileText size={16} className="text-white dark:text-d-card" />
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-sm font-bold text-slate-800 dark:text-d-heading">
                                                                                            Bill #{entry.billNumber}
                                                                                        </span>
                                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 dark:bg-d-text text-white dark:text-d-card">
                                                                                            {entry.items.length} {entry.items.length === 1 ? 'item' : 'items'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-d-text mt-0.5 font-medium">
                                                                                        <FiCalendar size={10} />
                                                                                        <span>{new Date(entry.date).toLocaleString()}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            {entry.discountMode && entry.discountMode !== 'none' && (
                                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 dark:bg-d-accent border border-amber-600 dark:border-d-accent shadow-sm">
                                                                                    <FiTrendingDown size={11} className="text-white dark:text-d-card" />
                                                                                    <span className="text-[10px] font-bold text-white dark:text-d-card uppercase tracking-wide">
                                                                                        {entry.discountMode === 'item' ? 'Item Discount' : 'Bill Discount'}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Items table */}
                                                                    <div className="px-6 py-2">
                                                                        <table className="w-full text-sm">
                                                                            <thead>
                                                                                <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 dark:text-d-text border-b border-slate-200 dark:border-d-border">
                                                                                    <th className="text-left py-3">Item</th>
                                                                                    <th className="text-center py-3 w-20">Qty</th>
                                                                                    <th className="text-right py-3 w-32">Unit Price</th>
                                                                                    <th className="text-right py-3 w-32">Discount</th>
                                                                                    <th className="text-right py-3 w-32">Line Total</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 dark:divide-d-border">
                                                                                {entry.items.map((it, i) => {
                                                                                    const lineGross = (it.price || 0) * (it.qty || 0);
                                                                                    const lineDiscount = it.discountAmount || 0;
                                                                                    const lineTotal = it.itemTotal != null ? it.itemTotal : lineGross - lineDiscount;
                                                                                    return (
                                                                                        <tr key={i} className="text-slate-700 dark:text-d-text hover:bg-slate-50/50 dark:hover:bg-d-elevated/50 transition-colors">
                                                                                            <td className="py-4">
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-d-border flex items-center justify-center text-[12px] font-bold text-slate-700 dark:text-d-heading">
                                                                                                        {i + 1}
                                                                                                    </div>
                                                                                                    <div className="font-semibold text-slate-800 dark:text-d-heading">{it.name}</div>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="py-4 text-center">
                                                                                                <span className="inline-flex items-center justify-center min-w-[40px] px-3 py-1 rounded-lg bg-primary-500 dark:bg-d-accent text-xs font-bold text-white dark:text-d-card shadow-sm">
                                                                                                    × {it.qty}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-4 text-right text-slate-600 dark:text-d-muted tabular-nums font-medium">
                                                                                                {formatCurrency(it.price)}
                                                                                            </td>
                                                                                            <td className="py-4 text-right tabular-nums">
                                                                                                {lineDiscount > 0 ? (
                                                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 dark:bg-d-accent text-white dark:text-d-card text-xs font-bold shadow-sm">
                                                                                                        − {formatCurrency(lineDiscount)}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-slate-400 dark:text-d-muted">—</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-4 text-right font-bold text-slate-900 dark:text-d-heading tabular-nums text-[15px]">
                                                                                                {formatCurrency(lineTotal)}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>

                                                                    {/* Totals block */}
                                                                    <div className="px-6 py-5 bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-d-elevated dark:to-d-bg border-t border-slate-200 dark:border-d-border">
                                                                        <div className="ml-auto max-w-sm space-y-2.5">
                                                                            <div className="flex justify-between items-center text-sm">
                                                                                <span className="text-slate-500 dark:text-d-muted font-medium">Subtotal</span>
                                                                                <span className="text-slate-700 dark:text-d-text tabular-nums font-semibold">
                                                                                    {formatCurrency((entry.subtotal || 0) + (entry.totalItemDiscount || 0))}
                                                                                </span>
                                                                            </div>
                                                                            {entry.discountMode === 'item' && (entry.totalItemDiscount || 0) > 0 && (
                                                                                <div className="flex justify-between items-center text-sm">
                                                                                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-d-accent font-medium">
                                                                                        <FiTrendingDown size={12} />
                                                                                        Item Discount
                                                                                    </span>
                                                                                    <span className="text-amber-600 dark:text-d-accent font-bold tabular-nums">
                                                                                        − {formatCurrency(entry.totalItemDiscount)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {entry.discountMode === 'bill' && (entry.billDiscountAmount || 0) > 0 && (
                                                                                <div className="flex justify-between items-start text-sm">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-d-accent font-medium">
                                                                                            <FiTrendingDown size={12} />
                                                                                            Bill Discount
                                                                                        </span>
                                                                                        {entry.billDiscountReason && (
                                                                                            <span className="text-[10px] text-slate-400 dark:text-d-faint italic ml-5 mt-0.5">
                                                                                                {entry.billDiscountReason}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="text-amber-600 dark:text-d-accent font-bold tabular-nums">
                                                                                        − {formatCurrency(entry.billDiscountAmount)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {(entry.totalTax || 0) > 0 && (
                                                                                <div className="flex justify-between items-center text-sm">
                                                                                    <span className="text-slate-500 dark:text-d-muted font-medium">Tax</span>
                                                                                    <span className="text-slate-700 dark:text-d-text tabular-nums font-semibold">
                                                                                        {formatCurrency(entry.totalTax)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {(entry.totalDiscount || 0) > 0 && (
                                                                                <div className="flex justify-between items-center text-[11px] text-emerald-600 dark:text-d-green pt-1">
                                                                                    <span className="font-medium">You saved</span>
                                                                                    <span className="font-bold tabular-nums">
                                                                                        {formatCurrency(entry.totalDiscount)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-slate-300 dark:border-d-border">
                                                                                <span className="text-xs font-bold text-slate-500 dark:text-d-muted uppercase tracking-[0.1em]">
                                                                                    Grand Total
                                                                                </span>
                                                                                <span className="text-2xl font-extrabold text-slate-900 dark:text-d-heading tabular-nums">
                                                                                    {formatCurrency(entry.debit || 0)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {entry.returnItems && entry.returnItems.length > 0 && (
                                                                <div className="mt-4 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl overflow-hidden shadow-sm">
                                                                    <div className="flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-[rgba(255,107,107,0.08)] border-b border-red-100 dark:border-[rgba(255,107,107,0.2)]">
                                                                        <FiRefreshCw size={14} className="text-red-500 dark:text-d-red" />
                                                                        <span className="text-xs font-bold text-red-700 dark:text-d-red uppercase tracking-wider">
                                                                            Returned Items
                                                                        </span>
                                                                    </div>
                                                                    <ul className="px-5 py-3 text-sm text-slate-700 dark:text-d-text space-y-1.5">
                                                                        {entry.returnItems.map((it, i) => (
                                                                            <li key={i} className="flex justify-between">
                                                                                <span>{it.name} <span className="text-slate-400 dark:text-d-faint">× {it.qty ?? it.quantity ?? 1}</span></span>
                                                                                <span className="font-medium text-red-600 dark:text-d-red tabular-nums">
                                                                                    {formatCurrency(it.refundAmount || (it.price * (it.qty ?? it.quantity ?? 1)))}
                                                                                </span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                    {entry.debtWriteOff > 0 && (
                                                                        <div className="px-5 py-3 border-t border-slate-100 dark:border-d-border space-y-1.5 text-sm">
                                                                            <div className="flex justify-between text-slate-500 dark:text-d-muted">
                                                                                <span>Items returned value</span>
                                                                                <span className="tabular-nums">{formatCurrency(entry.credit)}</span>
                                                                            </div>
                                                                            <div className="border-t border-dashed border-slate-200 dark:border-d-border my-1" />
                                                                            <div className="flex justify-between text-slate-400 dark:text-d-faint text-xs">
                                                                                <span>Unpaid amount reduced</span>
                                                                                <span className="tabular-nums">{formatCurrency(entry.debtWriteOff)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between font-semibold text-emerald-600 dark:text-d-green">
                                                                                <span>Store credit issued</span>
                                                                                <span className="tabular-nums">{formatCurrency(entry.storeCredit || 0)}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {entry.notes && (
                                                                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-d-muted">
                                                                    <span className="font-medium">{entry.type === 'return' ? 'Reason:' : 'Note:'}</span>
                                                                    <span className="text-slate-700 dark:text-d-text">
                                                                        {entry.notes.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                {/* Closing balance — shown once the last line of the period is loaded */}
                                {!pagination.hasMore && (
                                    <tfoot className="bg-slate-50 dark:bg-d-elevated border-t border-slate-200 dark:border-d-border">
                                        <tr>
                                            <td colSpan={7} className="py-3 px-4 text-right text-[13px] text-slate-500 dark:text-d-muted">
                                                Closing balance · {describePeriod(period, periodPreset)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold">
                                                <BalanceText value={period.closingBalance} currency={currency} strong />
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                        <LedgerPager
                            pagination={pagination}
                            shown={entries.length}
                            pageSize={pageSize}
                            loading={loading}
                            onPage={(n) => fetchStatement(n)}
                            onPageSize={setPageSize}
                        />
                        </>
                    )}
                </div>
                </>)}
                </div>
            </div>

            {/* Amount Due panel — the unpaid bills behind Amount Due, oldest first */}
            {showPendingPanel && (
                <div className="fixed inset-0 bg-black/40 z-50 flex justify-end print:hidden" onClick={() => setShowPendingPanel(false)}>
                    <div className="w-full max-w-md h-full bg-white dark:bg-d-card border-l border-slate-200 dark:border-d-border shadow-2xl flex flex-col animate-fade-slide-left" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-d-border">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-d-heading">What makes up {amountDue < 0 ? 'the credit' : 'Amount Due'}</h3>
                                <p className="text-xs text-slate-500 dark:text-d-muted">Unpaid bills, oldest first</p>
                            </div>
                            <button onClick={() => setShowPendingPanel(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-2">
                            {loadingPending && !pending ? (
                                <p className="text-sm text-slate-400 dark:text-d-faint text-center py-8">Loading…</p>
                            ) : (pending?.bills || []).length === 0 ? (
                                <p className="text-sm text-slate-400 dark:text-d-faint text-center py-8">No unpaid bills</p>
                            ) : (
                                pending.bills.map((b) => (
                                    <div key={b.billId} className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-d-border">
                                        <div>
                                            <div className="font-semibold text-slate-800 dark:text-d-heading text-sm">Bill #{b.billNumber}</div>
                                            <div className="text-[11px] text-slate-500 dark:text-d-muted">
                                                {b.date ? new Date(b.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                                {b.ageDays != null ? ` · ${b.ageDays} day${b.ageDays === 1 ? '' : 's'} old` : ''}
                                                {b.total != null && b.total !== b.due ? ` · of ${formatCurrency(b.total)}` : ''}
                                            </div>
                                        </div>
                                        <div className="font-bold text-red-600 dark:text-d-red text-sm">{formatCurrency(b.due)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                        {pending && (
                            <div className="px-5 py-4 border-t border-slate-100 dark:border-d-border space-y-1 text-sm">
                                <div className="flex justify-between text-slate-500 dark:text-d-muted">
                                    <span>Unpaid bills</span><span>{formatCurrency(pending.totalDue)}</span>
                                </div>
                                {(pending.availableCredit || 0) > 0 && (
                                    <div className="flex justify-between text-emerald-600 dark:text-d-green">
                                        <span>Available credit</span><span>−{formatCurrency(pending.availableCredit)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-slate-800 dark:text-d-heading pt-1 border-t border-slate-100 dark:border-d-border">
                                    <span>{(pending.amountDue || 0) < 0 ? 'Store credit' : 'Amount Due'}</span>
                                    <span>{formatCurrency(Math.abs(pending.amountDue || 0))}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Record Payment Modal */}
            {showPaymentModal && (() => {
                const selectedBill = outstandingBills.find((b) => String(b.billId) === String(paymentForm.billId));
                const dueAmount = paymentMode === 'fifo' ? totalOutstanding : (selectedBill?.due || 0);
                const enteredAmount = parseFloat(paymentForm.amount) || 0;
                const remaining = Math.max(0, dueAmount - enteredAmount);
                const isOverpay = enteredAmount > dueAmount + 0.01;

                // FIFO allocation preview — walk outstanding bills oldest-first
                let remainingToAllocate = enteredAmount;
                const allocationPreview = [];
                if (paymentMode === 'fifo') {
                    for (const b of outstandingBills) {
                        if (remainingToAllocate <= 0.0001) break;
                        const apply = Math.min(b.due, remainingToAllocate);
                        allocationPreview.push({
                            billNumber: b.billNumber,
                            due: b.due,
                            apply,
                            remainingDue: b.due - apply,
                            fullyPaid: b.due - apply <= 0.0001,
                        });
                        remainingToAllocate -= apply;
                    }
                }
                return (
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl w-full max-w-md animate-pop-in max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-d-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-[rgba(52,232,161,0.12)] flex items-center justify-center">
                                        <FiDollarSign className="text-emerald-600 dark:text-d-green" size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-d-heading">Record Payment</h2>
                                        <p className="text-[11px] text-slate-500 dark:text-d-muted">Collect from {customer?.name}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="p-2 text-slate-400 dark:text-d-faint hover:bg-slate-100 dark:hover:bg-d-glass hover:text-slate-600 dark:hover:text-d-text rounded-lg transition-colors"
                                >
                                    <FiX size={18} />
                                </button>
                            </div>

                            <form onSubmit={submitPayment} className="p-6 space-y-5">
                                {/* Mode toggle */}
                                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentMode('fifo');
                                        }}
                                        className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                                            paymentMode === 'fifo'
                                                ? 'bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading shadow-sm'
                                                : 'text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text'
                                        }`}
                                    >
                                        Auto (FIFO)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentMode('specific');
                                            const first = outstandingBills[0];
                                            setPaymentForm((p) => ({
                                                ...p,
                                                billId: first?.billId || '',
                                            }));
                                        }}
                                        className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                                            paymentMode === 'specific'
                                                ? 'bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading shadow-sm'
                                                : 'text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text'
                                        }`}
                                    >
                                        Specific Bill
                                    </button>
                                </div>

                                {/* FIFO info banner */}
                                {paymentMode === 'fifo' && (
                                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-[rgba(59,130,246,0.08)] border border-blue-200 dark:border-[rgba(59,130,246,0.2)] rounded-xl">
                                        <FiAlertCircle className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" size={14} />
                                        <div className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                                            Amount will be auto-applied to <strong>{outstandingBills.length} outstanding bill{outstandingBills.length === 1 ? '' : 's'}</strong>, oldest first (FIFO). Total due: <strong>{formatCurrency(totalOutstanding)}</strong>
                                        </div>
                                    </div>
                                )}

                                {/* Bill selector — only in specific mode */}
                                {paymentMode === 'specific' && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-d-muted mb-2 uppercase tracking-wide">
                                            Bill to settle
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={paymentForm.billId}
                                                onChange={(e) => {
                                                    const bill = outstandingBills.find((b) => String(b.billId) === e.target.value);
                                                    setPaymentForm((p) => ({
                                                        ...p,
                                                        billId: e.target.value,
                                                        amount: bill ? String(bill.due) : p.amount,
                                                    }));
                                                }}
                                                className="w-full appearance-none pl-4 pr-10 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text focus:outline-none focus:border-primary-400 dark:focus:border-d-border-hover cursor-pointer"
                                            >
                                                {outstandingBills.map((b) => (
                                                    <option key={b.billId} value={b.billId}>
                                                        #{b.billNumber} — Due {formatCurrency(b.due)}
                                                    </option>
                                                ))}
                                            </select>
                                            <FiChevronDown
                                                size={15}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint pointer-events-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Amount */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-d-muted uppercase tracking-wide">
                                            Amount
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentForm((p) => ({ ...p, amount: String(dueAmount) }))}
                                            className="text-[11px] font-medium text-primary-600 dark:text-d-accent hover:underline"
                                        >
                                            Pay full ({formatCurrency(dueAmount)})
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 dark:text-d-faint">
                                            {currency}
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={paymentForm.amount}
                                            onChange={(e) => {
                                                const v = e.target.value.replace(/[^0-9.]/g, '');
                                                setPaymentForm((p) => ({ ...p, amount: v }));
                                            }}
                                            placeholder="0"
                                            className={`w-full pl-14 pr-4 py-4 bg-slate-50 dark:bg-d-bg border rounded-xl text-2xl font-bold text-slate-800 dark:text-d-text focus:outline-none transition-colors ${
                                                isOverpay
                                                    ? 'border-red-300 dark:border-d-red/50 focus:border-red-400'
                                                    : 'border-slate-200 dark:border-d-border focus:border-primary-400 dark:focus:border-d-border-hover'
                                            }`}
                                            required
                                        />
                                    </div>
                                    {/* Quick chips */}
                                    <div className="flex gap-2 mt-2">
                                        {[
                                            { label: '25%', value: dueAmount * 0.25 },
                                            { label: '50%', value: dueAmount * 0.5 },
                                            { label: '75%', value: dueAmount * 0.75 },
                                            { label: 'Full', value: dueAmount },
                                        ].map((chip) => (
                                            <button
                                                key={chip.label}
                                                type="button"
                                                onClick={() => setPaymentForm((p) => ({ ...p, amount: String(Math.round(chip.value * 100) / 100) }))}
                                                className="flex-1 py-1.5 bg-slate-100 dark:bg-d-glass text-slate-600 dark:text-d-muted text-[11px] font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-d-glass-hover transition-colors"
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                    </div>
                                    {isOverpay && (
                                        <p className="mt-2 text-[11px] text-red-500 dark:text-d-red flex items-center gap-1">
                                            <FiAlertCircle size={11} />
                                            Amount exceeds outstanding due
                                        </p>
                                    )}
                                </div>

                                {/* Method — icon pills */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-d-muted mb-2 uppercase tracking-wide">
                                        Payment Method
                                    </label>
                                    {/* No "Credit" here — store credit is applied to unpaid bills automatically. */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'cash', label: 'Cash' },
                                            { id: 'card', label: 'Card' },
                                            { id: 'online', label: 'Online' },
                                        ].map((m) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setPaymentForm((p) => ({ ...p, method: m.id }))}
                                                className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                                                    paymentForm.method === m.id
                                                        ? 'bg-primary-500 dark:bg-d-accent text-white dark:text-d-card shadow-sm'
                                                        : 'bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border text-slate-600 dark:text-d-muted hover:border-slate-300 dark:hover:border-d-border-hover'
                                                }`}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Note */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-d-muted mb-2 uppercase tracking-wide">
                                        Note (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={paymentForm.note}
                                        onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))}
                                        placeholder="Reference, cheque #, etc."
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-primary-400 dark:focus:border-d-border-hover"
                                    />
                                </div>

                                {/* Specific-bill summary preview */}
                                {paymentMode === 'specific' && selectedBill && enteredAmount > 0 && !isOverpay && (
                                    <div className="p-3 bg-emerald-50 dark:bg-[rgba(52,232,161,0.08)] border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-xl space-y-1">
                                        <div className="flex justify-between text-xs text-slate-600 dark:text-d-muted">
                                            <span>Outstanding on #{selectedBill.billNumber}</span>
                                            <span>{formatCurrency(dueAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-emerald-700 dark:text-d-green font-medium">
                                            <span>Paying now</span>
                                            <span>− {formatCurrency(enteredAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-d-heading pt-1.5 border-t border-emerald-200 dark:border-[rgba(52,232,161,0.2)]">
                                            <span>Remaining after</span>
                                            <span>{formatCurrency(remaining)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* FIFO allocation preview */}
                                {paymentMode === 'fifo' && enteredAmount > 0 && !isOverpay && allocationPreview.length > 0 && (
                                    <div className="p-3 bg-emerald-50 dark:bg-[rgba(52,232,161,0.08)] border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-xl space-y-2">
                                        <div className="text-[11px] font-semibold text-slate-500 dark:text-d-muted uppercase tracking-wide">
                                            Will be applied to
                                        </div>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {allocationPreview.map((a) => (
                                                <div key={a.billNumber} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-700 dark:text-d-text">#{a.billNumber}</span>
                                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                                            a.fullyPaid
                                                                ? 'bg-emerald-200 dark:bg-d-green/20 text-emerald-700 dark:text-d-green'
                                                                : 'bg-amber-200 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                                        }`}>
                                                            {a.fullyPaid ? 'PAID' : 'PARTIAL'}
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-600 dark:text-d-muted">
                                                        <span className="text-emerald-700 dark:text-d-green font-semibold">{formatCurrency(a.apply)}</span>
                                                        <span className="text-slate-400 dark:text-d-faint"> / {formatCurrency(a.due)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-d-heading pt-2 border-t border-emerald-200 dark:border-[rgba(52,232,161,0.2)]">
                                            <span>Balance after</span>
                                            <span>{formatCurrency(remaining)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowPaymentModal(false)}
                                        className="flex-1 py-3 text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingPayment || isOverpay || enteredAmount <= 0}
                                        className="flex-[2] py-3 bg-emerald-500 dark:bg-d-green text-white dark:text-d-card rounded-xl font-bold text-sm hover:shadow-[0_4px_20px_rgba(52,232,161,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                    >
                                        {submittingPayment ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white dark:border-d-card border-t-transparent rounded-full animate-spin" />
                                                Recording...
                                            </>
                                        ) : (
                                            <>
                                                <FiDollarSign size={15} />
                                                Record {enteredAmount > 0 ? formatCurrency(enteredAmount) : 'Payment'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

// Balance with the "Cr" convention: negative = the shop owes the customer (green).
const BalanceText = ({ value, currency, strong = false }) => {
    const v = Math.round((Number(value) || 0) * 100) / 100;
    return (
        <span className={`${strong ? 'font-bold' : 'font-semibold'} ${v < 0 ? 'text-emerald-600 dark:text-d-green' : 'text-slate-800 dark:text-d-heading'}`}>
            {formatBalance(v, currency)}
        </span>
    );
};

// ↑↓ icon for the sort button; the arrow for the current direction is solid
const SortIcon = ({ newestFirst }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 4v16M7 4L4 7M7 4l3 3" opacity={newestFirst ? 0.4 : 1} />
        <path d="M17 20V4M17 20l-3-3M17 20l3-3" opacity={newestFirst ? 1 : 0.4} />
    </svg>
);

// Small chip in the period line: "All time ✕"
const FilterChip = ({ icon, label, onClear, clearLabel }) => (
    <span className="inline-flex items-center gap-1.5 h-[26px] pl-2.5 pr-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-d-border text-slate-800 dark:text-d-text font-medium">
        {icon && <span className="text-slate-400 dark:text-d-muted">{icon}</span>}
        {label}
        {onClear ? (
            <button type="button" onClick={onClear} title={clearLabel} aria-label={clearLabel} className="w-[18px] h-[18px] flex items-center justify-center rounded-full text-slate-400 dark:text-d-muted hover:text-slate-800 dark:hover:text-d-text">
                <FiX size={11} strokeWidth={2.5} />
            </button>
        ) : <span className="w-1" />}
    </span>
);

// The menu under the filter icon: period + type, applied together
const FilterMenu = ({ draft, setDraft, incomplete, onApply, onReset }) => {
    const pick = (active) => `h-8 rounded-lg border text-[13px] transition-colors ${
        active
            ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold dark:bg-[rgba(255,210,100,0.12)] dark:border-[rgba(255,210,100,0.45)] dark:text-d-accent'
            : 'border-slate-200 dark:border-d-border text-slate-700 dark:text-d-text hover:border-slate-300 dark:hover:border-white/20'
    }`;
    const label = 'mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-d-muted';
    const dateInput = 'mt-1 w-full h-8 px-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-lg text-[13px] text-slate-700 dark:text-d-text';
    return (
        <div className="absolute right-0 top-full mt-1 z-30 w-[340px] p-4 flex flex-col gap-4 bg-white dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-2xl shadow-xl dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] animate-pop-in">
            <div>
                <p className={label}>Period</p>
                {/* The default gets its own full-width row */}
                <button type="button" onClick={() => setDraft((d) => ({ ...d, period: DEFAULT_PERIOD }))} className={`${pick(draft.period === DEFAULT_PERIOD)} w-full mb-1.5`}>
                    {PERIOD_OPTIONS.find((o) => o.value === DEFAULT_PERIOD)?.label}
                </button>
                <div className="grid grid-cols-3 gap-1.5">
                    {PERIOD_OPTIONS.filter((o) => o.value !== 'custom' && o.value !== DEFAULT_PERIOD).map((o) => (
                        <button key={o.value} type="button" onClick={() => setDraft((d) => ({ ...d, period: o.value }))} className={pick(draft.period === o.value)}>
                            {o.label}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                    <label className="text-xs text-slate-500 dark:text-d-muted">
                        From
                        <input
                            type="date"
                            value={draft.from}
                            max={draft.to || undefined}
                            onChange={(e) => setDraft((d) => ({ ...d, period: 'custom', from: e.target.value }))}
                            className={dateInput}
                        />
                    </label>
                    <label className="text-xs text-slate-500 dark:text-d-muted">
                        To
                        <input
                            type="date"
                            value={draft.to}
                            min={draft.from || undefined}
                            onChange={(e) => setDraft((d) => ({ ...d, period: 'custom', to: e.target.value }))}
                            className={dateInput}
                        />
                    </label>
                </div>
            </div>
            <div>
                <p className={label}>Show</p>
                <div className="flex flex-wrap gap-1.5">
                    {TYPE_OPTIONS.map((o) => (
                        <button key={o.value} type="button" onClick={() => setDraft((d) => ({ ...d, type: o.value }))} className={`${pick(draft.type === o.value)} px-3 rounded-full`}>
                            {o.value === 'all' ? 'All' : o.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-d-border">
                <button type="button" onClick={onReset} className="text-[13px] text-slate-500 dark:text-d-muted hover:text-slate-900 dark:hover:text-d-text">
                    Reset
                </button>
                <button
                    type="button"
                    onClick={onApply}
                    disabled={incomplete}
                    className="h-8 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-d-accent dark:hover:brightness-110 text-white dark:text-d-bg text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {incomplete ? 'Pick both dates' : 'Apply'}
                </button>
            </div>
        </div>
    );
};

// Footer under the ledger table: "Showing 51–100 of 105", page size, Prev / 1 2 3 / Next.
const LedgerPager = ({ pagination, shown, pageSize, loading, onPage, onPageSize }) => {
    const page = pagination.page || 1;
    const pages = Math.max(1, pagination.pages || Math.ceil((pagination.total || 0) / (pagination.limit || pageSize)) || 1);
    const total = pagination.total ?? shown;
    const first = total === 0 ? 0 : (page - 1) * (pagination.limit || pageSize) + 1;
    const last = first === 0 ? 0 : first + shown - 1;

    // 1 … 4 5 6 … 12
    const numbers = [];
    for (let n = 1; n <= pages; n++) {
        if (n === 1 || n === pages || Math.abs(n - page) <= 1) numbers.push(n);
        else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
    }

    const navBtn = 'h-[30px] flex items-center gap-1 px-2.5 rounded-lg text-[13px] border border-slate-200 dark:border-d-border text-slate-600 dark:text-d-text hover:bg-slate-50 dark:hover:bg-d-glass disabled:opacity-40 disabled:cursor-not-allowed';
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 dark:border-d-border text-[13px] text-slate-500 dark:text-d-muted">
            <div className="flex items-center gap-3">
                <span className="tabular-nums"><b className="font-semibold text-slate-800 dark:text-d-text">{first}–{last}</b> of {total} lines</span>
                <label className="flex items-center gap-1.5">
                    Rows
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSize(Number(e.target.value))}
                        className="px-1.5 py-1 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-md text-xs text-slate-700 dark:text-d-text"
                    >
                        {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                </label>
            </div>
            {pages > 1 && (
                <div className="flex items-center gap-1">
                    <button className={navBtn} disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>
                        <FiChevronLeft size={13} /> Prev
                    </button>
                    {numbers.map((n, i) => (n === '…' ? (
                        <span key={`gap-${i}`} className="px-1.5">…</span>
                    ) : (
                        <button
                            key={n}
                            disabled={loading}
                            onClick={() => n !== page && onPage(n)}
                            className={`h-[30px] min-w-[30px] px-2 rounded-lg text-[13px] tabular-nums ${
                                n === page
                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-bg font-semibold'
                                    : 'text-slate-600 dark:text-d-text hover:bg-slate-100 dark:hover:bg-d-glass'
                            }`}
                        >
                            {n}
                        </button>
                    )))}
                    <button className={navBtn} disabled={loading || page >= pages} onClick={() => onPage(page + 1)}>
                        Next <FiChevronRight size={13} />
                    </button>
                </div>
            )}
        </div>
    );
};

// One figure in the summary box
const SummaryFigure = ({ label, value, tone, tinted = false, action, onClick }) => {
    const color = {
        green: 'text-emerald-600 dark:text-d-green',
        amber: 'text-amber-600 dark:text-d-accent',
        red: 'text-red-600 dark:text-d-red',
    }[tone] || 'text-slate-900 dark:text-d-heading';
    const tint = tinted
        ? (tone === 'red' ? 'bg-red-50/70 dark:bg-[rgba(255,107,107,0.06)]' : 'bg-emerald-50/70 dark:bg-[rgba(52,232,161,0.06)]')
        : '';
    const body = (
        <>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-d-muted">
                <span>{label}</span>
                {action && <span className={`flex items-center ${tone === 'red' ? 'text-red-500 dark:text-[#ff8f8f]' : 'text-emerald-600 dark:text-d-green'}`}>{action} <FiChevronRight size={12} /></span>}
            </div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
        </>
    );
    return action && onClick ? (
        <button type="button" onClick={onClick} className={`text-left px-5 py-4 ${tint} hover:brightness-[0.98] dark:hover:bg-white/[0.04] transition-colors`}>
            {body}
        </button>
    ) : (
        <div className={`px-5 py-4 ${tint}`}>{body}</div>
    );
};

// Type of a ledger line as a small coloured word (SALE, PAID, …)
const TypeBadge = ({ type }) => {
    const config = {
        opening_balance: { label: 'OPENING', cls: 'text-indigo-600 dark:text-[#a5a9ff]' },
        bill: { label: 'SALE', cls: 'text-red-600 dark:text-d-red' },
        payment: { label: 'PAID', cls: 'text-emerald-600 dark:text-d-green' },
        return: { label: 'RETURN', cls: 'text-amber-600 dark:text-d-accent' },
        cancelled: { label: 'CANCELLED', cls: 'text-slate-400 dark:text-d-muted' },
        credit_transfer: { label: 'CREDIT MOVED', cls: 'text-slate-500 dark:text-d-muted' },
    };
    const c = config[type] || { label: String(type || '').toUpperCase(), cls: 'text-slate-500 dark:text-d-muted' };
    return <span className={`shrink-0 text-[11px] font-semibold tracking-wide ${c.cls}`}>{c.label}</span>;
};

export default CustomerLedger;
