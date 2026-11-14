import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader, Button, DataTable, KpiStrip, KpiCard, rowActions, StatusChip, SegmentedControl, DrawerShell, Input, Select, Dash, Popover, Field } from '../components/ui';
import { DialogShell } from '../components/ui/Dialog';
import { toast } from '../components/ui/Toast';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getReceipts, getReceiptStats, getReceipt } from '../services/api/receipts';
import { cancelBill } from '../services/api/bills';
import { getCancelState, estimateCashReversal, isCancelledBill, isCancelledHold } from '../utils/billCancel';
import { getCreditPayments, getPrimaryPaymentMethod, formatPaymentMethod } from '../utils/billCredit';
import { printReceipt } from '../utils/printReceipt';
import { downloadReceipt } from '../utils/downloadReceipt';
import { mergeReceiptItems } from '../utils/receiptItems';
import BillDetailDrawer from '../components/receipts/BillDetailDrawer';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMoneyBook } from '../context/MoneyBookContext';
import {
    FiSearch,
    FiFileText,
    FiCalendar,
    FiDownload,
    FiPrinter,
    FiEye,
    FiX,
    FiRefreshCw,
    FiLoader,
    FiCornerDownLeft,
    FiSlash,
    FiAlertTriangle,
    FiFilter,
} from 'react-icons/fi';

// Local YYYY-MM-DD — never toISOString(), which shifts to UTC and can land on
// the wrong calendar day. The backend applies start-of-day/end-of-day in the
// business timezone, so we send the plain local date only.
const fmtLocalDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;


const Receipts = () => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    // Money Book: account names for payments that carry one
    const { accountsById } = useMoneyBook();
    const { permissions, isAdmin } = useAuth();
    // Admins bypass all permission checks (permissions is null for them).
    const canViewProfit = !permissions || permissions.pos?.viewProfit === true;
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    // Date range (local YYYY-MM-DD, '' = open). Opens on today, like the reference "Bills" list.
    const [range, setRange] = useState(() => {
        const t = fmtLocalDate(new Date());
        return { from: t, to: t };
    });
    const [showDetail, setShowDetail] = useState(null);
    // /receipts?bill=<id> (e.g. from the Dashboard's "Today & bills") opens that bill's window
    const [searchParams, setSearchParams] = useSearchParams();
    const linkedBillId = searchParams.get('bill');
    useEffect(() => {
        if (!linkedBillId) return undefined;
        let live = true;
        getReceipt(linkedBillId)
            .then((res) => live && setShowDetail(res.data))
            .catch((err) => {
                if (!live) return;
                toast.error(err.response?.status === 404 ? 'That bill was not found.' : "Couldn't open that bill.");
                setSearchParams({}, { replace: true });
            });
        return () => {
            live = false;
        };
    }, [linkedBillId]); // eslint-disable-line react-hooks/exhaustive-deps
    const closeDetail = () => {
        setShowDetail(null);
        if (linkedBillId) setSearchParams({}, { replace: true });
    };
    const [statusFilter, setStatusFilter] = useState('all'); // all | paid | partial | unpaid | cancelled
    const [methodFilter, setMethodFilter] = useState('all'); // all | cash | card | online | store_credit

    // Cancel bill (for bills created by mistake)
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelError, setCancelError] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }, []);
    // Paging (Stage 6): real pages instead of the endless scroll
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('ds.table.receipts.pageSize')) || 25;
        } catch {
            return 25;
        }
    });
    const [totalReceipts, setTotalReceipts] = useState(0);
    const [loadError, setLoadError] = useState(null);
    // The search text is sent to the server (debounced); servers that don't search yet
    // ignore it and the page shown is filtered here instead.
    const [serverSearch, setServerSearch] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setServerSearch(searchQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // Stats from API
    const [stats, setStats] = useState({
        todaySales: 0,
        todayOrders: 0,
        totalSales: 0,
        todayCollected: 0,
        todayCredit: 0,
        todayCashRefund: 0,
        todayLedgerAdjust: 0,
        todayCashInDrawer: 0,
        todayRefunded: 0,
    });

    useEffect(() => {
        fetchStats();
    }, []);

    // Any filter change → back to page 1 (date scoping and paging are server-side)
    useEffect(() => {
        setPage(1);
    }, [range.from, range.to, statusFilter, methodFilter, serverSearch, pageSize]);

    useEffect(() => {
        fetchReceipts(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, range.from, range.to, statusFilter, methodFilter, serverSearch]);

    const fetchStats = async () => {
        try {
            const res = await getReceiptStats();
            const d = res.data || {};
            setStats({
                todaySales: d.todaySales ?? 0,
                todayOrders: d.todayOrders ?? 0,
                totalSales: d.monthOrders ?? 0,
                todayCollected: d.todayCollected ?? 0,
                todayCredit: d.todayCredit ?? 0,
                todayCashRefund: d.todayCashRefund ?? 0,
                todayLedgerAdjust: d.todayLedgerAdjust ?? 0,
                todayCashInDrawer: d.todayCashInDrawer ?? 0,
                todayRefunded: d.todayRefunded ?? 0,
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    // silent: reload in place without the loading rows (e.g. after cancelling a bill)
    const requestSeq = useRef(0);
    const fetchReceipts = async (pageNum = page, silent = false) => {
        const seq = ++requestSeq.current; // only the newest answer is shown
        if (!silent) setLoading(true);
        setLoadError(null);
        try {
            // Server-side date scoping when a filter is active (empty for "All").
            const params = {
                page: pageNum,
                limit: pageSize,
                ...(range.from ? { startDate: range.from } : {}),
                ...(range.to ? { endDate: range.to } : {}),
                ...(statusFilter === 'cancelled' ? { status: 'cancelled' } : statusFilter !== 'all' ? { paymentStatus: statusFilter } : {}),
                // Not supported by the server yet (backend prompt stage 6) — also filtered below
                ...(methodFilter !== 'all' ? { paymentMethod: methodFilter } : {}),
                ...(serverSearch ? { search: serverSearch } : {}),
            };
            const res = await getReceipts(params);
            if (seq !== requestSeq.current) return;

            // Handle both old (array) and new (object with receipts) response formats
            const data = res.data?.receipts || res.data || [];
            const pagination = res.data?.pagination;
            setReceipts(Array.isArray(data) ? data : []);
            setTotalReceipts(pagination ? pagination.total : Array.isArray(data) ? data.length : 0);
        } catch (error) {
            if (seq !== requestSeq.current) return;
            console.error('Error fetching receipts:', error);
            setLoadError(error.response?.data?.message || "Couldn't load the receipts. Check the connection and try again.");
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    };

    const handleRefresh = () => {
        fetchReceipts(page);
        fetchStats();
    };

    // Also filtered here, for servers that don't search yet (harmless when they do)
    const usesMethod = (r, m) =>
        (r.payments || []).some((p) => (p.creditFrom ? 'store_credit' : p.method || 'cash') === m) || (!(r.payments || []).length && (r.paymentMethod || 'cash') === m);
    const filteredReceipts = receipts.filter(
        (r) =>
            (r.receiptNumber?.toString().includes(searchQuery) ||
                r.billNumber?.toString().includes(searchQuery) ||
                r.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (r.customerPhone || '').includes(searchQuery)) &&
            (methodFilter === 'all' || usesMethod(r, methodFilter))
    );
    const singleDay = !!range.from && range.from === range.to;
    const rangeText = !range.from && !range.to
        ? 'All dates'
        : singleDay
          ? new Date(`${range.from}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : `${range.from ? new Date(`${range.from}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '…'} – ${range.to ? new Date(`${range.to}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'today'}`;
    const presetRange = (key) => {
        const now = new Date();
        const t = fmtLocalDate(now);
        if (key === 'today') return { from: t, to: t };
        if (key === 'week') {
            const st = new Date(now);
            st.setDate(st.getDate() - 6);
            return { from: fmtLocalDate(st), to: t };
        }
        if (key === 'month') return { from: fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: t };
        return { from: '', to: '' };
    };
    const activePreset = ['today', 'week', 'month', 'all'].find((k) => {
        const p = presetRange(k);
        return p.from === range.from && p.to === range.to;
    });
    const STATUS_WORD = { paid: 'Paid', partial: 'Part paid', unpaid: 'Unpaid', cancelled: 'Cancelled' };
    const METHOD_WORD = { cash: 'Cash', card: 'Card', online: 'Online', store_credit: 'Store credit' };
    const filterSummary = [
        { today: 'Today', week: '7 days', month: 'This month', all: 'All dates' }[activePreset] || rangeText,
        STATUS_WORD[statusFilter],
        METHOD_WORD[methodFilter],
    ]
        .filter(Boolean)
        .join(' · ');
    const extraFilters = (statusFilter !== 'all' ? 1 : 0) + (methodFilter !== 'all' ? 1 : 0);

    const currency = business?.currency || 'Rs.';

    const formatCurrency = (amount) => {
        return `${currency} ${(amount || 0).toLocaleString()}`;
    };

    const buildReceiptOpts = async (receipt) => {
        const items = (receipt.items || []).map(it => ({
            product: it.product?._id || it.product,
            name: it.name,
            qty: it.qty || it.quantity || 0,
            price: it.price || it.sellingPrice || 0,
            discountAmount: it.discountAmount || 0,
            returnedQty: it.returnedQty || 0,
        }));
        const subtotal = items.reduce((s, it) => s + (it.price * it.qty - (Number(it.discountAmount) || 0)), 0);
        // Use paymentStatus from bill data — if unpaid, it's credit
        const paymentMethod = receipt.paymentStatus === 'unpaid'
            ? 'credit'
            : getPrimaryPaymentMethod(receipt);

        // Frozen at bill creation time — always reflects the customer's balance
        // as of this sale, unaffected by payments made afterward
        const customerBalanceBefore = receipt.customerBalanceBefore || 0;

        return {
            store: business,
            currency,
            billNumber: receipt.billNumber || '-',
            date: new Date(receipt.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
            customerName: receipt.customerName || 'Walk-in',
            customerPhone: receipt.customerPhone || '',
            customerAddress: receipt.customerAddress || '',
            cashierName: receipt.cashierName || '',
            customerBalanceBefore,
            items,
            subtotal,
            tax: receipt.totalTax || 0,
            itemDiscounts: receipt.totalItemDiscount || 0,
            billDiscount: receipt.billDiscountAmount || 0,
            total: receipt.total || 0,
            paymentMethod,
            amountPaid: receipt.amountPaid || 0,
            amountDue: receipt.amountDue || 0,
            cashGiven: receipt.cashGiven || 0,
            change: receipt.change || 0,
            totalRefunded: receipt.totalRefunded || 0,
            netAmount: receipt.netAmount ?? ((receipt.total || 0) - (receipt.totalRefunded || 0)),
            creditPayments: getCreditPayments(receipt),
            // Reprint of a bill that had items added later: lines are combined, header says so
            ...(receipt.revisionCount > 0 ? { title: `SALE INVOICE - UPDATE ${receipt.revisionCount}` } : {}),
        };
    };

    const handlePrint = async (receipt) => {
        const opts = await buildReceiptOpts(receipt);
        printReceipt(opts);
    };

    const handleDownload = async (receipt) => {
        const opts = await buildReceiptOpts(receipt);
        downloadReceipt(opts);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString('en-PK', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getReceiptType = (receipt) => {
        if (isCancelledBill(receipt)) {
            return {
                label: isCancelledHold(receipt) ? 'Cancelled hold' : 'Cancelled',
                color: 'bg-muted text-muted-foreground',
                hasReturns: false,
                cancelled: true,
            };
        }
        if (receipt.type === 'refund') {
            return { label: 'Refund', color: 'bg-destructive-chip text-destructive', hasReturns: false };
        }
        // Check if this sale has returns
        const hasReturns = (receipt.totalReturned > 0) || (receipt.returns && receipt.returns.length > 0);
        return {
            label: 'Sale',
            color: 'bg-success-chip text-success',
            hasReturns
        };
    };

    const billStatus = (r) => {
        const type = getReceiptType(r);
        if (type.cancelled) return { label: type.label, tone: 'destructive' };
        if (type.label === 'Refund') return { label: 'Refund', tone: 'destructive' };
        if (r.paymentStatus === 'partial') return { label: 'Part paid', tone: 'warning' };
        if (r.paymentStatus === 'unpaid') return { label: 'Unpaid', tone: 'neutral' };
        return { label: 'Paid', tone: 'success' };
    };
    const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const receiptColumns = [
        {
            id: 'number',
            header: 'Bill',
            accessorFn: (r) => Number(r.receiptNumber || r.billNumber) || 0,
            cell: ({ row: { original: r } }) => <span className="font-semibold tabular-nums">#{r.receiptNumber || r.billNumber || '-'}</span>,
        },
        {
            id: 'time',
            header: 'Time',
            accessorFn: (r) => new Date(r.createdAt).getTime() || 0,
            cell: ({ row: { original: r } }) => (
                <div className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {timeOf(r.createdAt)}
                    {/* a longer range also needs the day */}
                    {!singleDay ? <p className="text-body-sm">{new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p> : null}
                </div>
            ),
        },
        {
            id: 'customer',
            header: 'Customer',
            accessorFn: (r) => r.customerName || '',
            cell: ({ row: { original: r } }) =>
                r.customerName ? (
                    <div className="min-w-0">
                        <p className="truncate">{r.customerName}</p>
                        {r.customerPhone ? <p className="font-mono text-mono-xs text-muted-foreground">{r.customerPhone}</p> : null}
                    </div>
                ) : (
                    <span className="text-muted-foreground">Walk-in</span>
                ),
        },
        { id: 'cashier', header: 'Cashier', accessorFn: (r) => r.cashierName || '', cell: ({ getValue }) => getValue() || <Dash /> },
        {
            id: 'items',
            header: 'Items',
            accessorFn: (r) => r.totalQty || (r.items || []).reduce((n, it) => n + (it.qty || it.quantity || 0), 0),
            meta: { align: 'right' },
        },
        {
            id: 'total',
            header: 'Total',
            accessorFn: (r) => r.totalBill ?? r.total ?? 0,
            meta: { align: 'right' },
            cell: ({ row: { original: r } }) => {
                const type = getReceiptType(r);
                const v = r.totalBill ?? r.total ?? 0;
                return (
                    <span className={type.cancelled ? 'line-through text-muted-foreground' : v < 0 ? 'text-destructive font-semibold' : 'font-semibold'}>
                        {formatCurrency(Math.abs(v))}
                    </span>
                );
            },
        },
        {
            id: 'paid',
            header: 'Paid',
            accessorFn: (r) => r.amountPaid || 0,
            meta: { align: 'right' },
            cell: ({ getValue }) => formatCurrency(getValue()),
        },
        {
            id: 'due',
            header: 'Due',
            accessorFn: (r) => (getReceiptType(r).cancelled ? 0 : Math.max(0, r.amountDue || 0)),
            meta: { align: 'right' },
            cell: ({ getValue }) => (getValue() > 0 ? <span className="font-medium text-warning-chip-foreground">{formatCurrency(getValue())}</span> : <Dash />),
        },
        {
            id: 'status',
            header: 'Status',
            accessorFn: (r) => billStatus(r).label,
            cell: ({ row: { original: r } }) => {
                const st = billStatus(r);
                return (
                    <div className="flex flex-wrap items-center gap-1">
                        <StatusChip size="sm" shape="tag" tone={st.tone} label={st.label} />
                        {getReceiptType(r).hasReturns ? <StatusChip size="sm" shape="tag" tone="warning" icon={FiCornerDownLeft} label={r.returnStatus === 'full' ? 'Returned' : 'Part returned'} /> : null}
                    </div>
                );
            },
        },
        rowActions(
            (r) => [
                { label: 'View details', icon: FiEye, onSelect: () => setShowDetail(r) },
                { label: 'Print', icon: FiPrinter, onSelect: () => handlePrint(r) },
                { label: 'Download', icon: FiDownload, onSelect: () => handleDownload(r) },
                ...(cancelStateFor(r).allowed
                    ? [{ separator: true }, { label: 'Cancel bill', icon: FiSlash, danger: true, onSelect: () => openCancel(r) }]
                    : []),
            ],
            { label: 'Receipt actions' }
        ),
    ];


    const cancelStateFor = (receipt) => getCancelState(receipt, { isAdmin, permissions, business, online });

    const openCancel = (receipt) => {
        setCancelTarget(receipt);
        setCancelReason('');
        setCancelError('');
    };

    const submitCancel = async () => {
        const reason = cancelReason.trim();
        if (!reason) {
            setCancelError('A reason is required to cancel a bill');
            return;
        }
        setCancelling(true);
        setCancelError('');
        try {
            const res = await cancelBill(cancelTarget._id, reason);
            const cash = Number(res.data?.cashReversed) || 0;
            // Money Book servers say which account each part came back from
            const reversed = (res.data?.reversed || []).filter((x) => Number(x.amount) > 0);
            const moneyText = reversed.length
                ? ` — ${reversed.map((x) => `${formatCurrency(x.amount)} back from ${x.name}`).join(', ')}`
                : cash > 0 ? ` — ${formatCurrency(cash)} taken out of the cash book` : '';
            toast.success(`${res.data?.message || 'Bill cancelled'}${moneyText}`, { id: 'receipts', duration: 5000 });
            setCancelTarget(null);
            setShowDetail(null);
            fetchReceipts(page, true);
            fetchStats();
        } catch (err) {
            setCancelError(err.response?.data?.message || 'Failed to cancel the bill');
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-6 animate-fade-slide-up">
                {/* Header */}
                <PageHeader
                    title={<>Sales Report</>}
                    subtitle={<>{totalReceipts > 0 ? `${totalReceipts} total receipts` : `${receipts.length} receipts`}</>}
                    actions={
                        <Button variant="ghost" onClick={handleRefresh}>
                            <FiRefreshCw aria-hidden="true" className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </Button>
                    }
                />

                {/* Today at a glance — admins can open the dashboard window behind each tile */}
                <KpiStrip cols={5} className="mb-5">
                    <KpiCard
                        label="Sales today"
                        value={formatCurrency(stats.todaySales)}
                        note={`${stats.todayOrders || 0} bill${stats.todayOrders === 1 ? '' : 's'} · ${stats.totalSales || totalReceipts} this month`}
                        onClick={isAdmin ? () => navigate('/dashboard?insight=sales') : undefined}
                        ariaLabel="Sales today — open the sales window"
                    />
                    <KpiCard
                        label="Collected"
                        value={formatCurrency(stats.todayCollected)}
                        tone="success"
                        note="Received from customers"
                        onClick={isAdmin ? () => navigate('/dashboard?insight=payments') : undefined}
                        ariaLabel="Collected today — open payment methods"
                    />
                    <KpiCard
                        label="On credit"
                        value={formatCurrency(stats.todayCredit)}
                        tone={stats.todayCredit > 0 ? 'destructive' : undefined}
                        note="Owed by customers"
                    />
                    <KpiCard
                        label="Refunded"
                        value={formatCurrency(stats.todayRefunded)}
                        tone={stats.todayRefunded > 0 ? 'destructive' : undefined}
                        note={
                            stats.todayRefunded > 0
                                ? [stats.todayCashRefund > 0 && `Cash ${formatCurrency(stats.todayCashRefund)}`, stats.todayLedgerAdjust > 0 && `Ledger ${formatCurrency(stats.todayLedgerAdjust)}`].filter(Boolean).join(' · ')
                                : 'No refunds today'
                        }
                    />
                    <KpiCard
                        label="Cash in drawer"
                        value={formatCurrency(stats.todayCashInDrawer)}
                        tone="success"
                        note="Collected minus cash refunds"
                        onClick={isAdmin ? () => navigate('/dashboard?insight=money') : undefined}
                        ariaLabel="Cash in drawer — open the money window"
                    />
                </KpiStrip>

                <DataTable
                    id="receipts"
                    caption="Receipts"
                    data={filteredReceipts}
                    columns={receiptColumns}
                    getRowId={(r) => r._id}
                    loading={loading}
                    error={loadError ? { message: loadError, onRetry: () => fetchReceipts(page) } : null}
                    search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Bill #, customer or phone', className: 'sm:w-[280px]' }}
                    title="Bills"
                    description={`${rangeText} · ${totalReceipts.toLocaleString()} bill${totalReceipts === 1 ? '' : 's'}, newest first. Click a bill to see it.`}
                    filters={
                        <Popover
                            label="Filter bills"
                            width={360}
                            trigger={
                                <Button variant="outline" aria-label={`Filter bills — now: ${filterSummary}`}>
                                    <FiFilter aria-hidden="true" />
                                    <span className="max-w-[220px] truncate">{filterSummary}</span>
                                    {extraFilters > 0 ? (
                                        <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-caption font-semibold px-1.5 leading-[18px]">{extraFilters}</span>
                                    ) : null}
                                </Button>
                            }
                        >
                            {({ close }) => (
                                <div className="flex flex-col gap-3.5">
                                    <div>
                                        <p className="font-mono text-overline-lg uppercase text-muted-foreground mb-1.5">Dates</p>
                                        <SegmentedControl
                                            label="Quick dates"
                                            size="xs"
                                            value={activePreset || ''}
                                            onChange={(k) => setRange(presetRange(k))}
                                            options={[
                                                { value: 'today', label: 'Today' },
                                                { value: 'week', label: '7 days' },
                                                { value: 'month', label: 'Month' },
                                                { value: 'all', label: 'All' },
                                            ]}
                                        />
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <Field label="From">
                                                <Input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                                            </Field>
                                            <Field label="To">
                                                <Input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                                            </Field>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Field label="Status">
                                            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                                <option value="all">All</option>
                                                <option value="paid">Paid</option>
                                                <option value="partial">Part paid</option>
                                                <option value="unpaid">Unpaid</option>
                                                <option value="cancelled">Cancelled</option>
                                            </Select>
                                        </Field>
                                        <Field label="Payment">
                                            <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                                                <option value="all">All</option>
                                                <option value="cash">Cash</option>
                                                <option value="card">Card</option>
                                                <option value="online">Online</option>
                                                <option value="store_credit">Store credit</option>
                                            </Select>
                                        </Field>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => {
                                                setRange(presetRange('today'));
                                                setStatusFilter('all');
                                                setMethodFilter('all');
                                            }}
                                        >
                                            Reset to today
                                        </Button>
                                        <Button size="xs" onClick={close}>
                                            Done
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Popover>
                    }
                    // only the dates narrowed → a plain "no bills on …" message, not "nothing matches"
                    isFiltered={!!searchQuery || statusFilter !== 'all' || methodFilter !== 'all'}
                    onClearFilters={() => {
                        setSearchQuery('');
                        setRange(presetRange('all'));
                        setStatusFilter('all');
                        setMethodFilter('all');
                    }}
                    empty={
                        activePreset === 'all'
                            ? { icon: FiFileText, title: 'No receipts yet', description: 'Bills appear here as soon as the first sale is made.' }
                            : {
                                  icon: FiFileText,
                                  title: `No bills ${singleDay ? 'on' : 'in'} ${rangeText}`,
                                  description: 'Pick other dates in the filter.',
                                  action: (
                                      <Button size="xs" variant="outline" onClick={() => setRange(presetRange('all'))}>
                                          Show all dates
                                      </Button>
                                  ),
                              }
                    }
                    onRowClick={(r) => setShowDetail(r)}
                    rowLabel={(r) => `Bill ${r.receiptNumber || r.billNumber || ''}, ${r.customerName || 'Walk-in'}`}
                    rowTone={(r) => (getReceiptType(r).hasReturns ? 'attention' : null)}
                    rowClassName={(r) => (getReceiptType(r).cancelled ? 'opacity-60 hover:opacity-100' : '')}
                    server={{
                        page,
                        pageSize,
                        total: totalReceipts,
                        onPageChange: setPage,
                        onPageSizeChange: (n) => {
                            setPageSize(n);
                            try {
                                localStorage.setItem('ds.table.receipts.pageSize', JSON.stringify(n));
                            } catch {
                                /* storage blocked */
                            }
                        },
                    }}
                />
            </div>

            {/* Bill details — side window (design Stage 7) */}
            {showDetail && (
                <BillDetailDrawer
                    receipt={showDetail}
                    onClose={closeDetail}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getReceiptType={getReceiptType}
                    accountsById={accountsById}
                    canViewProfit={canViewProfit}
                    onPrint={handlePrint}
                    onDownload={handleDownload}
                    cancelAllowed={cancelStateFor(showDetail).allowed}
                    onCancel={openCancel}
                    onReturn={(r) => navigate(`/returns?bill=${r.billNumber}`)}
                    onOpenCustomer={(r) => navigate(`/customers/${r.customer?._id || r.customer}/ledger`)}
                />
            )}

            {/* Cancel Bill Confirm */}
            {cancelTarget && (() => {
                const b = cancelTarget;
                const cash = estimateCashReversal(b);
                return (
                <DialogShell size="md" zIndex={60}>
                        <div className="p-6">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-destructive-chip flex items-center justify-center shrink-0">
                                    <FiAlertTriangle className="text-destructive" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-foreground">Cancel bill #{b.billNumber}?</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {b.customerName || 'Walk-in'} · {formatCurrency(b.total ?? b.totalBill)}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-destructive-chip border border-destructive/30 text-sm text-destructive space-y-1 mb-3">
                                <p>This bill will be removed from reports and the customer's balance, and its stock will come back.</p>
                                {cash > 0 && <p className="font-semibold">Cash {formatCurrency(cash)} will be taken out of the cash book.</p>}
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">
                                Use this only for bills created by mistake. If the customer returned goods, use <span className="font-semibold">Returns</span> instead.
                            </p>

                            <label className="block text-sm text-muted-foreground mb-1.5">
                                Reason <span className="text-destructive">*</span>
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                maxLength={300}
                                rows={2}
                                autoFocus
                                placeholder="e.g. Created by mistake, duplicate bill"
                                className="w-full px-3 py-2.5 bg-muted/40 border border-hairline rounded-xl text-sm text-foreground placeholder:text-placeholder resize-none focus:outline-none focus:border-destructive/30"
                            />
                            <p className="text-caption text-muted-foreground text-right">{cancelReason.length}/300</p>

                            {cancelError && (
                                <div className="mt-2 p-3 bg-destructive-chip border border-destructive rounded-xl text-destructive text-sm flex items-center gap-2">
                                    <FiAlertTriangle className="shrink-0" size={14} />
                                    {cancelError}
                                </div>
                            )}

                            <div className="flex gap-3 mt-4">
                                <button data-dialog-close
                                    onClick={() => setCancelTarget(null)}
                                    disabled={cancelling}
                                    className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors disabled:opacity-50"
                                >
                                    Keep bill
                                </button>
                                <button
                                    onClick={submitCancel}
                                    disabled={cancelling}
                                    className="flex-1 py-3 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {cancelling ? <FiRefreshCw className="animate-spin" size={16} /> : <FiSlash size={16} />}
                                    {cancelling ? 'Cancelling...' : 'Cancel bill'}
                                </button>
                            </div>
                        </div>
                    </DialogShell>
                );
            })()}

        </div>
    );
};

export default Receipts;
