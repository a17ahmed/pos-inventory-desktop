import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { PageHeader, Button, IconButton, TableScroll } from '../components/ui';
import { DialogShell } from '../components/ui/Dialog';
import { toast } from '../components/ui/Toast';
import { useParams, useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { todayLocalDate, toLocalDateStr } from '../utils/date';
import { getVendor, getVendorLedger, payVendor } from '../services/api/vendors';
import { paySupply, getSupplies } from '../services/api/supplies';
import { getCashBalance } from '../services/api/cashbook';
import html2pdf from 'html2pdf.js';
import AccountPicker from '../components/AccountPicker';
import ChequeFields from '../components/moneybook/ChequeFields';
import { useMoneyBook } from '../context/MoneyBookContext';
import { apiErrorMessage, round2 } from '../utils/moneyBook';
import {
    FiArrowLeft,
    FiDownload,
    FiPrinter,
    FiDollarSign,
    FiTrendingUp,
    FiTrendingDown,
    FiAlertCircle,
    FiPhone,
    FiMapPin,
    FiCalendar,
    FiFilter,
    FiPlus,
    FiX,
    FiSearch,
    FiChevronDown,
    FiChevronRight,
    FiRefreshCw,
    FiFileText,
    FiPackage,
} from 'react-icons/fi';

// Method text for a ledger payment. Vendor credit is credit moved from another
// supply (after a return), not money paid.
const methodLabel = (e) =>
    e.method === 'vendor_credit' || e.fromCredit
        ? `Vendor credit (from Supply #${e.creditFromSupplyNumber ?? '?'})`
        : e.method === 'bank_transfer' ? 'Bank' : e.method;

const creditMovesText = (moves = [], fmt) =>
    moves.map((m) => `${fmt(m.amount)} credit used on Supply #${m.toNumber}`).join(' · ');

const VendorLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { business } = useBusiness();

    const [vendor, setVendor] = useState(null);
    const [ledgerData, setLedgerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters — applied values that actually drive the API call
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all'); // all | supply | payment | return

    // Filter modal — draft values, only committed to the state above via a preset or Apply.
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [draftStartDate, setDraftStartDate] = useState('');
    const [draftEndDate, setDraftEndDate] = useState('');
    const [draftStartTime, setDraftStartTime] = useState('');
    const [draftEndTime, setDraftEndTime] = useState('');

    // Row expansion
    const [expandedRow, setExpandedRow] = useState(null);

    // Record payment modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMode, setPaymentMode] = useState('fifo'); // 'fifo' | 'specific'
    const [paymentForm, setPaymentForm] = useState({
        supplyId: '',
        amount: '',
        method: 'cash',
        note: '',
        reference: '',
    });
    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [cashInHand, setCashInHand] = useState(null);
    const [paymentError, setPaymentError] = useState('');
    // Money Book (only when the shop has it on): account paid from, cheque details
    const { isOn: moneyBookOn, chequeTracking, moneyFields, handleMoneyError } = useMoneyBook();
    const [payMoney, setPayMoney] = useState({ accountId: null, chequeNumber: '', chequeDate: '' });
    const [payShort, setPayShort] = useState(false);
    const [pendingSupplies, setPendingSupplies] = useState([]); // [{ supplyId, supplyNumber, due }]

    const currency = business?.currency || 'Rs.';
    const formatCurrency = (amount) => {
        const v = amount || 0;
        return `${v < 0 ? '-' : ''}${currency} ${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    };
    // Running balance: negative = the vendor owes us (credit)
    const formatBalance = (v) => ((v || 0) < -0.005 ? `Cr ${formatCurrency(-v)}` : formatCurrency(v));

    const showToast = (message) => toast.success(message, { id: 'vendor-ledger', duration: 4000 });

    // =========================================================================
    // Data
    // =========================================================================

    const fetchLedger = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (startDate) params.startDate = startTime ? `${startDate}T${startTime}:00` : startDate;
            if (endDate) params.endDate = endTime ? `${endDate}T${endTime}:00` : endDate;

            const [ledgerRes, vendorRes] = await Promise.all([
                getVendorLedger(id, params),
                getVendor(id),
            ]);

            setLedgerData(ledgerRes.data);
            setVendor(vendorRes.data);
        } catch (err) {
            console.error('Error fetching vendor ledger:', err);
            setError(err.response?.data?.message || 'Failed to load ledger');
        } finally {
            setLoading(false);
        }
    }, [id, startDate, endDate, startTime, endTime]);

    // Filters only change via an explicit preset click or the modal's Apply
    // button now (never live-as-you-type), so a plain effect is enough.
    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    // =========================================================================
    // Filter modal handlers
    // =========================================================================

    const openFilterModal = () => {
        setDraftStartDate(startDate);
        setDraftEndDate(endDate);
        setDraftStartTime(startTime);
        setDraftEndTime(endTime);
        setShowFilterModal(true);
    };

    const applyPreset = (preset) => {
        const today = todayLocalDate();
        if (preset === 'today') {
            setStartDate(today);
            setEndDate(today);
        } else if (preset === 'week') {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const monday = new Date(now);
            monday.setDate(now.getDate() - diffToMonday);
            setStartDate(toLocalDateStr(monday));
            setEndDate(today);
        } else if (preset === 'month') {
            const now = new Date();
            setStartDate(toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
            setEndDate(today);
        } else {
            setStartDate('');
            setEndDate('');
        }
        setStartTime('');
        setEndTime('');
        setShowFilterModal(false);
    };

    const applyCustomRange = () => {
        setStartDate(draftStartDate);
        setEndDate(draftEndDate);
        setStartTime(draftStartDate ? draftStartTime : '');
        setEndTime(draftEndDate ? draftEndTime : '');
        setShowFilterModal(false);
    };

    const clearDateFilter = () => {
        setStartDate('');
        setEndDate('');
        setStartTime('');
        setEndTime('');
    };

    const activeFilterLabel = useMemo(() => {
        if (!startDate && !endDate) return null;
        const today = todayLocalDate();
        if (startDate === today && endDate === today && !startTime && !endTime) return 'Today';
        const part = (d, t) => (d ? `${d}${t ? ' ' + t : ''}` : '…');
        return `${part(startDate, startTime)} → ${part(endDate, endTime)}`;
    }, [startDate, endDate, startTime, endTime]);

    // =========================================================================
    // Derived — filtered entries
    // =========================================================================

    const filteredEntries = useMemo(() => {
        if (!ledgerData?.ledger) return [];
        let entries = ledgerData.ledger;

        if (typeFilter !== 'all') {
            entries = entries.filter((e) =>
                typeFilter === 'payment' ? e.type === 'payment' || e.type === 'credit_transfer' : e.type === typeFilter
            );
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            entries = entries.filter((e) =>
                (e.description || '').toLowerCase().includes(q) ||
                (e.notes || '').toLowerCase().includes(q) ||
                (e.method || '').toLowerCase().includes(q) ||
                String(e.supplyNumber || '').includes(q)
            );
        }

        return entries;
    }, [ledgerData, typeFilter, searchQuery]);

    // What we owe this vendor, all-time (ignores the date filter). Vendor credit
    // is already netted off on the server, so this is the most we can pay.
    const summaryAll = ledgerData?.summary || {};
    const amountDue = summaryAll.amountDue ?? Math.max(0, summaryAll.currentBalance || 0);

    // Unpaid supplies for the payment modal, oldest bill first — loaded from the
    // server (remainingAmount) so returns, credit and date filters can't skew it.
    const outstandingSupplies = pendingSupplies;
    const totalOutstanding = useMemo(
        () => Math.round(outstandingSupplies.reduce((sum, s) => sum + s.due, 0) * 100) / 100,
        [outstandingSupplies]
    );

    const loadPendingSupplies = async () => {
        const list = [];
        for (const status of ['unpaid', 'partial']) {
            const res = await getSupplies({ vendor: id, paymentStatus: status, limit: 100 });
            list.push(...(res.data?.supplies || []));
        }
        return list
            .filter((s) => (s.remainingAmount || 0) > 0.005)
            .sort((a, b) => new Date(a.billDate || a.createdAt) - new Date(b.billDate || b.createdAt) || a.supplyNumber - b.supplyNumber)
            .map((s) => ({ supplyId: s._id, supplyNumber: s.supplyNumber, due: s.remainingAmount }));
    };

    const openPaymentModal = async () => {
        let pending = [];
        try {
            pending = await loadPendingSupplies();
        } catch (err) {
            console.error('Error loading pending supplies:', err);
        }
        const due = Math.min(amountDue, pending.reduce((sum, s) => sum + s.due, 0));
        setPendingSupplies(pending);
        setPaymentMode('fifo');
        setPaymentForm({
            supplyId: pending[0]?.supplyId || '',
            amount: due > 0 ? String(Math.round(due * 100) / 100) : '',
            method: 'cash',
            note: '',
            reference: '',
        });
        setPaymentError('');
        setPayMoney({ accountId: null, chequeNumber: '', chequeDate: '' });
        setPayShort(false);
        setShowPaymentModal(true);
        if (moneyBookOn) {
            setCashInHand(null); // the picker shows the chosen account's balance
            return;
        }
        try {
            const res = await getCashBalance();
            setCashInHand(res.data?.balance ?? null);
        } catch {
            setCashInHand(null);
        }
    };

    const submitPayment = async (e) => {
        e.preventDefault();
        setPaymentError('');
        const amount = parseFloat(paymentForm.amount);
        if (!amount || amount <= 0) {
            setPaymentError('Enter a valid amount');
            return;
        }

        if (!moneyBookOn && paymentForm.method === 'cash' && cashInHand != null && amount > cashInHand) {
            setPaymentError(`Insufficient cash. Available: ${formatCurrency(cashInHand)}`);
            return;
        }
        if (moneyBookOn && payShort) {
            setPaymentError('Not enough money in the selected account. Choose another account.');
            return;
        }
        const moneyExtra = moneyFields({
            accountId: payMoney.accountId,
            ...(paymentForm.method === 'cheque' && chequeTracking
                ? { chequeNumber: payMoney.chequeNumber.trim(), chequeDate: payMoney.chequeDate }
                : {}),
        });

        setSubmittingPayment(true);
        try {
            if (paymentMode === 'fifo') {
                const maxPay = Math.min(amountDue, totalOutstanding);
                if (amount > maxPay + 0.01) {
                    setPaymentError(`Amount exceeds total outstanding (${formatCurrency(maxPay)})`);
                    setSubmittingPayment(false);
                    return;
                }
                const res = await payVendor(id, {
                    amount,
                    method: paymentForm.method,
                    note: paymentForm.note,
                    reference: paymentForm.reference,
                    ...moneyExtra,
                });
                // Vendor credit (from returns) is used before the cash
                const moves = res.data?.creditApplied || [];
                if (moves.length > 0) showToast(`Vendor credit used first: ${creditMovesText(moves, formatCurrency)}`);
            } else {
                if (!paymentForm.supplyId) {
                    setPaymentError('Select a supply');
                    setSubmittingPayment(false);
                    return;
                }
                await paySupply(paymentForm.supplyId, {
                    amount,
                    method: paymentForm.method,
                    note: paymentForm.note,
                    reference: paymentForm.reference,
                    ...moneyExtra,
                });
            }
            setShowPaymentModal(false);
            fetchLedger();
        } catch (err) {
            console.error('Payment error:', err);
            handleMoneyError(err);
            setPaymentError(apiErrorMessage(err, 'Failed to record payment'));
        } finally {
            setSubmittingPayment(false);
        }
    };

    // design-check: print-start — PDF HTML, always printed black on white
    const downloadPdf = () => {
        if (!ledgerData) return;
        const { summary } = ledgerData;
        const currency = business?.currency || 'PKR';
        const fmt = (v) => Number(v || 0).toLocaleString();

        const dateRange = startDate || endDate
            ? `${startDate ? startDate + (startTime ? ' ' + startTime : '') : 'Start'} — ${endDate ? endDate + (endTime ? ' ' + endTime : '') : 'Today'}`
            : 'All Time';

        const entryRows = filteredEntries.map((e) => {
            const d = new Date(e.date);
            const typeLabel = e.type === 'supply' ? 'SUPPLY' : e.type === 'payment' ? 'PAID' : e.type === 'return' ? 'RETURN' : e.type === 'opening_balance' ? 'OPENING' : e.type === 'credit_transfer' ? 'CREDIT MOVED' : e.type?.toUpperCase() || '';
            const typeColor = e.type === 'supply' ? '#f59e0b' : e.type === 'payment' ? '#10b981' : e.type === 'return' ? '#3b82f6' : '#64748b';
            return `<tr>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">${e.supplyNumber ? '#' + e.supplyNumber : '—'}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;"><span style="color:${typeColor};font-size:10px;font-weight:700;margin-right:6px;">${typeLabel}</span>${e.description}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">${[e.method ? methodLabel(e).toUpperCase() : '', e.paidBy].filter(Boolean).join(' / ') || '—'}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;color:#ef4444;font-weight:600;">${e.debit ? currency + ' ' + fmt(e.debit) : '—'}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;color:#10b981;font-weight:600;">${e.credit ? currency + ' ' + fmt(e.credit) : '—'}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${(e.balance || 0) < -0.005 ? 'Cr ' : ''}${currency} ${fmt(Math.abs(e.balance || 0))}</td>
            </tr>`;
        }).join('');

        // Per-supply line-item breakdown, shown after the main ledger table.
        const suppliesWithItems = filteredEntries.filter((e) => e.type === 'supply' && e.items && e.items.length > 0);
        const supplyDetailsHtml = suppliesWithItems.map((e) => {
            const d = new Date(e.date);
            const itemRows = e.items.map((it, i) => {
                const unitPrice = it.unitCost || it.unitPrice || it.price || 0;
                const qty = it.quantity || it.qty || 0;
                const gstAmount = it.gstAmount || 0;
                const lineTotal = it.totalPrice != null ? it.totalPrice : unitPrice * qty + gstAmount;
                return `<tr>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;">${i + 1}. ${it.productName || it.name}</td>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:center;">× ${qty}</td>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:right;">${currency} ${fmt(unitPrice)}</td>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:right;">${gstAmount > 0 ? currency + ' ' + fmt(gstAmount) + (it.gstPercent ? ` (${it.gstPercent}%)` : '') : '—'}</td>
                    <td style="padding:5px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;">${currency} ${fmt(lineTotal)}</td>
                </tr>`;
            }).join('');

            return `
            <div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid;">
                <div style="background:#f8fafc;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:11px;font-weight:700;">Supply #${e.supplyNumber} <span style="font-weight:400;color:#64748b;">— ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                    <div style="font-size:11px;font-weight:700;">${currency} ${fmt(e.debit)}</div>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#fff;">
                            <th style="padding:5px 8px;font-size:9px;text-align:left;font-weight:700;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Item</th>
                            <th style="padding:5px 8px;font-size:9px;text-align:center;font-weight:700;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Qty</th>
                            <th style="padding:5px 8px;font-size:9px;text-align:right;font-weight:700;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Unit Price</th>
                            <th style="padding:5px 8px;font-size:9px;text-align:right;font-weight:700;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">GST</th>
                            <th style="padding:5px 8px;font-size:9px;text-align:right;font-weight:700;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                </table>
            </div>`;
        }).join('');

        const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;padding:20px 24px;color:#1e293b;background:#fff;width:100%;">
            <!-- App Branding -->
            <div style="text-align:center;margin-bottom:12px;">
                <div style="font-size:13px;font-weight:800;letter-spacing:0.08em;color:#0f172a;">DESKTOP POS</div>
                <div style="font-size:9px;color:#94a3b8;margin-top:2px;">
                    Software by Ahmed Irfan &nbsp;•&nbsp; Phone: +923070019031 &nbsp;•&nbsp; WhatsApp: https://wa.me/923070019031
                </div>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:14px;" />

            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                <div>
                    <h1 style="margin:0;font-size:22px;font-weight:700;">Vendor Ledger Report</h1>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Generated: ${new Date().toLocaleString()} | Period: ${dateRange}</p>
                </div>
                ${business?.name ? `<div style="text-align:right;"><div style="font-size:14px;font-weight:700;">${business.name}</div>${business.phone ? `<div style="font-size:11px;color:#64748b;">${business.phone}</div>` : ''}</div>` : ''}
            </div>

            <!-- Vendor Info -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
                <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${vendor?.name || 'Vendor'}</div>
                <div style="display:flex;gap:24px;font-size:11px;color:#64748b;">
                    ${vendor?.phone ? `<span>Phone: ${vendor.phone}</span>` : ''}
                    ${vendor?.company ? `<span>Company: ${vendor.company}</span>` : ''}
                    ${vendor?.address ? `<span>Address: ${vendor.address}</span>` : ''}
                </div>
            </div>

            <!-- Summary Cards -->
            <div style="display:flex;gap:10px;margin-bottom:16px;">
                <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;">Total Supplies</div>
                    <div style="font-size:16px;font-weight:700;margin-top:2px;">${currency} ${fmt(summary.totalSupplies)}</div>
                </div>
                <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;">Total Paid</div>
                    <div style="font-size:16px;font-weight:700;margin-top:2px;color:#10b981;">${currency} ${fmt(summary.totalPaid)}</div>
                </div>
                <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;">Returns</div>
                    <div style="font-size:16px;font-weight:700;margin-top:2px;">${currency} ${fmt(summary.totalReturns)}</div>
                </div>
                <div style="flex:1;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;">
                    <div style="font-size:10px;color:#ef4444;text-transform:uppercase;font-weight:600;">Amount Due (all time)</div>
                    <div style="font-size:16px;font-weight:700;margin-top:2px;color:#ef4444;">${currency} ${fmt(summary.amountDue ?? summary.currentBalance)}</div>
                    ${summary.vendorCredit > 0 ? `<div style="font-size:10px;color:#10b981;margin-top:2px;">Vendor owes you ${currency} ${fmt(summary.vendorCredit)}</div>` : ''}
                </div>
            </div>

            <!-- Ledger Table -->
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Date</th>
                        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Voucher</th>
                        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Description</th>
                        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Method / By</th>
                        <th style="padding:8px;font-size:10px;text-align:right;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Debit</th>
                        <th style="padding:8px;font-size:10px;text-align:right;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Credit</th>
                        <th style="padding:8px;font-size:10px;text-align:right;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${entryRows}
                </tbody>
                <tfoot>
                    <tr style="background:#f1f5f9;font-weight:700;">
                        <td colspan="4" style="padding:8px;font-size:12px;border-top:2px solid #e2e8f0;">Totals</td>
                        <td style="padding:8px;font-size:12px;text-align:right;color:#ef4444;border-top:2px solid #e2e8f0;">${currency} ${fmt(summary.totalSupplies)}</td>
                        <td style="padding:8px;font-size:12px;text-align:right;color:#10b981;border-top:2px solid #e2e8f0;">${currency} ${fmt(summary.totalPaid)}</td>
                        <td style="padding:8px;font-size:12px;text-align:right;border-top:2px solid #e2e8f0;">${currency} ${fmt(summary.currentBalance)}</td>
                    </tr>
                </tfoot>
            </table>

            ${supplyDetailsHtml ? `
            <!-- Supply Details -->
            <div style="margin-top:20px;">
                <h2 style="margin:0 0 8px;font-size:14px;font-weight:700;">Supply Details</h2>
                ${supplyDetailsHtml}
            </div>` : ''}

            <!-- Footer -->
            <div style="margin-top:16px;text-align:center;font-size:10px;color:#94a3b8;">
                ${filteredEntries.length} entries | Supply Count: ${summary.supplyCount}
            </div>
        </div>`;

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
        container.innerHTML = html;
        document.body.appendChild(container);

        const element = container.firstElementChild;
        html2pdf()
            .set({
                margin: [10, 10, 10, 10],
                filename: `Vendor-Ledger-${(vendor?.name || 'vendor').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak: { mode: ['css', 'avoid-all'] },
            })
            .from(element)
            .save()
            .then(() => document.body.removeChild(container))
            .catch((err) => {
                console.error('PDF download error:', err);
                document.body.removeChild(container);
            });
    };
    // design-check: print-end

    const handlePrint = () => {
        window.print();
    };

    // =========================================================================
    // Render
    // =========================================================================

    if (loading && !ledgerData) {
        return (
            <PageSkeleton variant="ledger" columns={7} />
        );
    }

    if (error && !ledgerData) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <FiAlertCircle size={48} className="text-destructive" />
                    <p className="text-foreground">{error}</p>
                    <button
                        onClick={() => navigate('/vendors')}
                        className="px-4 py-2 bg-primary text-white rounded-xl"
                    >
                        Back to Vendors
                    </button>
                </div>
            </div>
        );
    }

    const summary = ledgerData?.summary || {};

    return (
        <div className="h-full overflow-y-auto print:bg-card">
            <div className="max-w-[1400px] mx-auto p-6 print:p-0">
                {/* Header */}
                <PageHeader
                    className="print:hidden"
                    back={{ to: '/vendors', label: 'Vendors' }}
                    title="Vendor Ledger"
                    subtitle="Complete account statement and transaction history"
                    actions={
                        <>
                            <IconButton label="Refresh" variant="outline" onClick={fetchLedger}>
                                <FiRefreshCw />
                            </IconButton>
                            <Button variant="outline" onClick={handlePrint}>
                                <FiPrinter aria-hidden="true" />
                                Print
                            </Button>
                            <Button variant="outline" onClick={downloadPdf}>
                                <FiDownload aria-hidden="true" />
                                Download PDF
                            </Button>
                            <Button onClick={openPaymentModal} disabled={amountDue <= 0}>
                                <FiPlus aria-hidden="true" />
                                Pay Vendor
                            </Button>
                        </>
                    }
                />

                {/* Vendor Info Card */}
                <div className="bg-card border border-hairline rounded-2xl p-6 mb-4 shadow-sm">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-2xl font-bold">
                                {(vendor?.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">
                                    {vendor?.name}
                                </h2>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                                    {vendor?.phone && (
                                        <span className="flex items-center gap-1.5">
                                            <FiPhone size={13} /> {vendor.phone}
                                        </span>
                                    )}
                                    {vendor?.company && (
                                        <span className="flex items-center gap-1.5">
                                            <FiPackage size={13} /> {vendor.company}
                                        </span>
                                    )}
                                    {vendor?.address && (
                                        <span className="flex items-center gap-1.5">
                                            <FiMapPin size={13} /> {vendor.address}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                                    {!!vendor?.creditLimit && (
                                        <span>Credit limit: {formatCurrency(vendor.creditLimit)}</span>
                                    )}
                                    {!!vendor?.creditDays && (
                                        <span>Credit days: {vendor.creditDays}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Strip */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    <SummaryCard
                        icon={<FiTrendingUp />}
                        label="Total Supplies"
                        value={formatCurrency(summary.totalSupplies || 0)}
                        tone="slate"
                    />
                    <SummaryCard
                        icon={<FiTrendingDown />}
                        label="Total Paid"
                        value={formatCurrency(summary.totalPaid || 0)}
                        tone="emerald"
                    />
                    <SummaryCard
                        icon={<FiRefreshCw />}
                        label="Returns"
                        value={formatCurrency(summary.totalReturns || 0)}
                        tone="amber"
                    />
                    <SummaryCard
                        icon={<FiFileText />}
                        label="Supply Count"
                        value={summary.supplyCount || 0}
                        tone="slate"
                    />
                    {(summary.vendorCredit || 0) > 0 && amountDue <= 0 ? (
                        <SummaryCard
                            icon={<FiAlertCircle />}
                            label="Vendor Credit"
                            value={formatCurrency(summary.vendorCredit)}
                            tone="emerald"
                            hint="Vendor owes you"
                            highlight
                        />
                    ) : (
                        <SummaryCard
                            icon={<FiAlertCircle />}
                            label={amountDue > 0 ? 'Amount Due' : 'Current Balance'}
                            value={formatCurrency(amountDue)}
                            tone={amountDue > 0 ? 'red' : 'emerald'}
                            hint={(summary.vendorCredit || 0) > 0 ? `Vendor owes you ${formatCurrency(summary.vendorCredit)}` : undefined}
                            highlight
                        />
                    )}
                </div>

                {/* Filters */}
                <div className="bg-card border border-hairline rounded-2xl p-4 mb-4 shadow-sm print:hidden">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={openFilterModal}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                                    activeFilterLabel
                                        ? 'bg-accent border-primary/30 text-primary'
                                        : 'bg-muted/40 border-hairline text-muted-foreground hover:bg-[var(--hover-overlay)]'
                                }`}
                            >
                                <FiFilter size={14} />
                                Filter
                            </button>

                            {activeFilterLabel && (
                                <div className="flex items-center gap-1.5 pl-3 pr-2 py-2 bg-muted/40 border border-hairline rounded-xl text-xs text-muted-foreground">
                                    <FiCalendar size={12} className="text-muted-foreground shrink-0" />
                                    {activeFilterLabel}
                                    <button
                                        onClick={clearDateFilter}
                                        className="text-muted-foreground hover:text-foreground"
                                        title="Clear date filter"
                                    >
                                        <FiX size={13} />
                                    </button>
                                </div>
                            )}

                            {loading && ledgerData && (
                                <FiRefreshCw size={14} className="text-muted-foreground animate-spin" />
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border border-hairline">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'supply', label: 'Supplies' },
                                { id: 'payment', label: 'Payments' },
                                { id: 'return', label: 'Returns' },
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setTypeFilter(f.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        typeFilter === f.id
                                            ? 'bg-primary text-white'
                                            : 'text-muted-foreground hover:bg-[var(--hover-overlay)]'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative flex-1 min-w-[200px]">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by supply #, description, method, note..."
                                className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-hairline rounded-xl text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary/30"
                            />
                        </div>

                        <div className="text-xs text-muted-foreground ml-auto">
                            {filteredEntries.length} of {ledgerData?.ledger?.length || 0} entries
                        </div>
                    </div>
                </div>

                {/* Ledger Table */}
                <div className="bg-card text-card-foreground border border-hairline rounded-2xl shadow-1 overflow-hidden">
                    {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <FiFileText size={48} />
                            <p className="mt-4 text-base">No entries found</p>
                            <p className="text-xs mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <TableScroll>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr>
                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] w-8"></th>
                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-left font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Date</th>
                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-left font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Voucher</th>
                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-left font-mono text-th uppercase font-medium text-muted-foreground">Description</th>
                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-left font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Method / By</th>
                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Debit</th>
                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Credit</th>
                                        <th className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] h-[var(--head-h)] px-4 text-right font-mono text-th uppercase font-medium text-muted-foreground whitespace-nowrap">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEntries.map((entry, idx) => {
                                        const isExpanded = expandedRow === idx;
                                        const hasDetails =
                                            (entry.items && entry.items.length > 0) ||
                                            (entry.returnItems && entry.returnItems.length > 0) ||
                                            entry.notes;
                                        const d = new Date(entry.date);
                                        return (
                                            <React.Fragment key={idx}>
                                                <tr
                                                    onClick={() => hasDetails && setExpandedRow(isExpanded ? null : idx)}
                                                    className={`h-[var(--row-h)] shadow-[inset_0_1px_0_var(--hairline)] hover:bg-[var(--hover-overlay)] ${
                                                        hasDetails ? 'cursor-pointer' : ''
                                                    }`}
                                                >
                                                    <td className="py-3 px-2 text-center">
                                                        {hasDetails &&
                                                            (isExpanded ? (
                                                                <FiChevronDown size={14} className="text-muted-foreground mx-auto" />
                                                            ) : (
                                                                <FiChevronRight size={14} className="text-muted-foreground mx-auto" />
                                                            ))}
                                                    </td>
                                                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                                                        <div className="font-medium">{d.toLocaleDateString()}</div>
                                                        <div className="text-micro text-muted-foreground">
                                                            {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        {entry.supplyNumber && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-caption font-mono bg-muted text-muted-foreground">
                                                                #{entry.supplyNumber}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <TypeBadge type={entry.type} />
                                                            <span className={entry.fromCredit ? 'italic text-muted-foreground' : 'text-foreground'}>
                                                                {entry.description}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                                                        {entry.method && (
                                                            <div className={entry.fromCredit || entry.method === 'vendor_credit'
                                                                ? 'italic text-muted-foreground'
                                                                : 'uppercase text-muted-foreground font-medium'}
                                                            >
                                                                {methodLabel(entry)}
                                                            </div>
                                                        )}
                                                        {entry.paidBy && (
                                                            <div className="text-muted-foreground">{entry.paidBy}</div>
                                                        )}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-medium whitespace-nowrap ${entry.type === 'credit_transfer' ? 'text-muted-foreground' : 'text-destructive'}`}>
                                                        {entry.debit > 0 ? formatCurrency(entry.debit) : '\u2014'}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-medium whitespace-nowrap ${entry.fromCredit ? 'italic text-muted-foreground' : 'text-success'}`}>
                                                        {entry.credit > 0 ? formatCurrency(entry.credit) : '\u2014'}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${(entry.balance || 0) < -0.005 ? 'text-success' : 'text-foreground'}`}>
                                                        {formatBalance(entry.balance)}
                                                    </td>
                                                </tr>
                                                {isExpanded && hasDetails && (
                                                    <tr className="bg-muted/40">
                                                        <td></td>
                                                        <td colSpan={7} className="py-5 px-5">
                                                            {entry.items && entry.items.length > 0 && (
                                                                <div className="bg-card border border-hairline rounded-2xl overflow-hidden">
                                                                    {/* Gradient Header */}
                                                                    <div className="relative px-6 py-4 bg-muted/40 border-b border-hairline">
                                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary " />
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                                                                                    <FiPackage size={16} className="text-white" />
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-sm font-bold text-foreground">
                                                                                            Supply #{entry.supplyNumber}
                                                                                        </span>
                                                                                        <span className="text-micro font-bold px-2 py-0.5 rounded-full bg-foreground text-white">
                                                                                            {entry.items.length} {entry.items.length === 1 ? 'item' : 'items'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 text-caption text-muted-foreground mt-0.5 font-medium">
                                                                                        <FiCalendar size={10} />
                                                                                        <span>{new Date(entry.date).toLocaleString()}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Items table */}
                                                                    <div className="px-6 py-2">
                                                                        <table className="w-full text-sm">
                                                                            <thead>
                                                                                <tr className="text-caption font-bold uppercase tracking-[0.08em] text-muted-foreground border-b border-hairline">
                                                                                    <th className="text-left py-3">Item</th>
                                                                                    <th className="text-center py-3 w-20">Qty</th>
                                                                                    <th className="text-right py-3 w-32">Unit Price</th>
                                                                                    <th className="text-right py-3 w-32">GST</th>
                                                                                    <th className="text-right py-3 w-32">Line Total</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[var(--hairline)]">
                                                                                {entry.items.map((it, i) => {
                                                                                    const lineGross = (it.unitCost || it.unitPrice || it.price || 0) * (it.quantity || it.qty || 0);
                                                                                    const gstAmount = it.gstAmount || 0;
                                                                                    const lineTotal = it.totalPrice != null ? it.totalPrice : lineGross + gstAmount;
                                                                                    return (
                                                                                        <tr key={i} className="text-foreground hover:bg-[var(--hover-overlay)] transition-colors">
                                                                                            <td className="py-4">
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-body-sm font-bold text-foreground">
                                                                                                        {i + 1}
                                                                                                    </div>
                                                                                                    <div className="font-semibold text-foreground">{it.productName || it.name}</div>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="py-4 text-center">
                                                                                                <span className="inline-flex items-center justify-center min-w-[40px] px-3 py-1 rounded-lg bg-primary text-xs font-bold text-white shadow-sm">
                                                                                                    &times; {it.quantity || it.qty}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-4 text-right text-muted-foreground tabular-nums font-medium">
                                                                                                {formatCurrency(it.unitCost || it.unitPrice || it.price)}
                                                                                            </td>
                                                                                            <td className="py-4 text-right tabular-nums">
                                                                                                {gstAmount > 0 ? (
                                                                                                    <span className="text-muted-foreground font-medium">
                                                                                                        {formatCurrency(gstAmount)}
                                                                                                        {it.gstPercent ? ` (${it.gstPercent}%)` : ''}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-muted-foreground">&mdash;</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-4 text-right font-bold text-foreground tabular-nums text-lead">
                                                                                                {formatCurrency(lineTotal)}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>

                                                                    {/* Totals block */}
                                                                    <div className="px-6 py-5 bg-muted/40 border-t border-hairline">
                                                                        <div className="ml-auto max-w-sm space-y-2.5">
                                                                            <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-border">
                                                                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.1em]">
                                                                                    Grand Total
                                                                                </span>
                                                                                <span className="text-2xl font-extrabold text-foreground tabular-nums">
                                                                                    {formatCurrency(entry.debit || 0)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {entry.returnItems && entry.returnItems.length > 0 && (
                                                                <div className="mt-4 bg-card border border-hairline rounded-xl overflow-hidden shadow-sm">
                                                                    <div className="flex items-center gap-2 px-5 py-3 bg-destructive-chip border-b border-destructive/30">
                                                                        <FiRefreshCw size={14} className="text-destructive" />
                                                                        <span className="text-xs font-bold text-destructive uppercase tracking-wider">
                                                                            Returned Items
                                                                        </span>
                                                                    </div>
                                                                    <ul className="px-5 py-3 text-sm text-foreground space-y-1.5">
                                                                        {entry.returnItems.map((it, i) => (
                                                                            <li key={i} className="flex justify-between">
                                                                                <span>{it.productName || it.name} <span className="text-muted-foreground">&times; {it.quantity || it.qty}</span></span>
                                                                                <span className="font-medium text-destructive tabular-nums">
                                                                                    {formatCurrency(it.refundAmount || ((it.unitCost || it.price || 0) * (it.quantity || it.qty || 0)))}
                                                                                </span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {entry.notes && (
                                                                <div className="mt-3 px-4 py-2.5 bg-info-chip border-l-2 border-info rounded-r-lg">
                                                                    <div className="text-micro font-semibold uppercase tracking-wide text-info mb-0.5">Note</div>
                                                                    <div className="text-xs text-foreground italic">{entry.notes}</div>
                                                                </div>
                                                            )}
                                                            {entry.reference && (
                                                                <div className="mt-2 text-xs text-muted-foreground">
                                                                    Reference: <span className="font-medium">{entry.reference}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                {/* Footer totals */}
                                <tfoot className="bg-muted/40 border-t-2 border-hairline">
                                    <tr>
                                        <td colSpan={5} className="py-3 px-4 text-right font-semibold text-muted-foreground">Totals</td>
                                        <td className="py-3 px-4 text-right font-bold text-destructive">
                                            {formatCurrency(filteredEntries.reduce((s, e) => s + (e.debit || 0), 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-success">
                                            {formatCurrency(filteredEntries.reduce((s, e) => s + (e.credit || 0), 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-foreground">
                                            {formatBalance(summary.currentBalance || 0)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </TableScroll>
                    )}
                </div>
            </div>

            {/* Record Payment Modal */}
            {showPaymentModal && (() => {
                const selectedSupply = outstandingSupplies.find((s) => String(s.supplyId) === String(paymentForm.supplyId));
                const dueAmount = paymentMode === 'fifo' ? Math.min(amountDue, totalOutstanding) : (selectedSupply?.due || 0);
                const enteredAmount = parseFloat(paymentForm.amount) || 0;
                const remaining = Math.max(0, dueAmount - enteredAmount);
                const isOverpay = enteredAmount > dueAmount + 0.01;

                // FIFO allocation preview — walk outstanding supplies oldest-first
                let remainingToAllocate = enteredAmount;
                const allocationPreview = [];
                if (paymentMode === 'fifo') {
                    for (const s of outstandingSupplies) {
                        if (remainingToAllocate <= 0.0001) break;
                        const apply = Math.min(s.due, remainingToAllocate);
                        allocationPreview.push({
                            supplyNumber: s.supplyNumber,
                            due: s.due,
                            apply,
                            remainingDue: s.due - apply,
                            fullyPaid: s.due - apply <= 0.0001,
                        });
                        remainingToAllocate -= apply;
                    }
                }
                return (
                    <DialogShell size="md" className="overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-success-chip flex items-center justify-center">
                                        <FiDollarSign className="text-success" size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-foreground">Pay Vendor</h2>
                                        <p className="text-caption text-muted-foreground">Payment to {vendor?.name}</p>
                                    </div>
                                </div>
                                <button data-dialog-close
                                    onClick={() => setShowPaymentModal(false)}
                                    className="p-2 text-muted-foreground hover:bg-[var(--hover-overlay)] hover:text-foreground rounded-lg transition-colors"
                                >
                                    <FiX size={18} />
                                </button>
                            </div>

                            <form onSubmit={submitPayment} className="flex flex-col min-h-0 flex-1">
                            <div className="p-6 space-y-5 overflow-y-auto flex-1">
                                {/* Cash in hand info */}
                                {cashInHand != null && (
                                    <div className={`flex items-center justify-between p-3 rounded-xl border ${
                                        paymentForm.method === 'cash' && (parseFloat(paymentForm.amount) || 0) > cashInHand
                                            ? 'bg-destructive-chip border-destructive/30'
                                            : 'bg-muted/40 border-hairline'
                                    }`}>
                                        <span className="text-xs font-medium text-muted-foreground">Cash in Hand</span>
                                        <span className={`text-sm font-bold ${
                                            paymentForm.method === 'cash' && (parseFloat(paymentForm.amount) || 0) > cashInHand
                                                ? 'text-destructive'
                                                : 'text-foreground'
                                        }`}>{formatCurrency(cashInHand)}</span>
                                    </div>
                                )}

                                {/* Payment error */}
                                {paymentError && (
                                    <div className="flex items-center gap-2 p-3 bg-destructive-chip border border-destructive/30 rounded-xl">
                                        <FiAlertCircle className="text-destructive flex-shrink-0" size={14} />
                                        <span className="text-xs text-destructive font-medium">{paymentError}</span>
                                    </div>
                                )}

                                {/* Mode toggle */}
                                <div className="grid grid-cols-2 gap-1 p-1 bg-muted border border-hairline rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentMode('fifo');
                                            const due = Math.min(amountDue, totalOutstanding);
                                            setPaymentForm((p) => ({ ...p, amount: due > 0 ? String(due) : '' }));
                                        }}
                                        className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                                            paymentMode === 'fifo'
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Auto (FIFO)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentMode('specific');
                                            const first = outstandingSupplies[0];
                                            setPaymentForm((p) => ({
                                                ...p,
                                                supplyId: first?.supplyId || '',
                                                amount: first ? String(first.due) : '',
                                            }));
                                        }}
                                        className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                                            paymentMode === 'specific'
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Specific Supply
                                    </button>
                                </div>

                                {/* FIFO info banner */}
                                {paymentMode === 'fifo' && (
                                    <div className="flex items-start gap-2 p-3 bg-info-chip border border-info/30 rounded-xl">
                                        <FiAlertCircle className="text-info mt-0.5 flex-shrink-0" size={14} />
                                        <div className="text-caption text-info leading-relaxed">
                                            Amount will be auto-applied to <strong>{outstandingSupplies.length} outstanding supply{outstandingSupplies.length === 1 ? '' : ' orders'}</strong>, oldest first (FIFO). Total due: <strong>{formatCurrency(dueAmount)}</strong>
                                        </div>
                                    </div>
                                )}

                                {/* Supply selector — only in specific mode */}
                                {paymentMode === 'specific' && (
                                    <div>
                                        <label className="block text-caption font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                            Supply to settle
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={paymentForm.supplyId}
                                                onChange={(e) => {
                                                    const supply = outstandingSupplies.find((s) => String(s.supplyId) === e.target.value);
                                                    setPaymentForm((p) => ({
                                                        ...p,
                                                        supplyId: e.target.value,
                                                        amount: supply ? String(supply.due) : p.amount,
                                                    }));
                                                }}
                                                className="w-full appearance-none pl-4 pr-10 py-3 bg-muted/40 border border-hairline rounded-xl text-sm text-foreground focus:outline-none focus:border-primary cursor-pointer"
                                            >
                                                {outstandingSupplies.map((s) => (
                                                    <option key={s.supplyId} value={s.supplyId}>
                                                        #{s.supplyNumber} — Due {formatCurrency(s.due)}
                                                    </option>
                                                ))}
                                            </select>
                                            <FiChevronDown
                                                size={15}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Amount */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                                            Amount
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentForm((p) => ({ ...p, amount: String(dueAmount) }))}
                                            className="text-caption font-medium text-primary hover:underline"
                                        >
                                            Pay full ({formatCurrency(dueAmount)})
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                                            {currency}
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={paymentForm.amount}
                                            onChange={(e) => {
                                                const v = e.target.value.replace(/[^0-9.]/g, '');
                                                setPaymentForm((p) => ({ ...p, amount: v }));
                                                setPaymentError('');
                                            }}
                                            placeholder="0"
                                            className={`w-full pl-14 pr-4 py-4 bg-muted/40 border rounded-xl text-2xl font-bold text-foreground focus:outline-none transition-colors ${
                                                isOverpay
                                                    ? 'border-destructive/30 focus:border-destructive'
                                                    : 'border-hairline focus:border-primary'
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
                                                className="flex-1 py-1.5 bg-muted text-muted-foreground text-caption font-medium rounded-lg hover:bg-[var(--hover-overlay)] transition-colors"
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                    </div>
                                    {isOverpay && (
                                        <p className="mt-2 text-caption text-destructive flex items-center gap-1">
                                            <FiAlertCircle size={11} />
                                            Amount exceeds outstanding due
                                        </p>
                                    )}
                                </div>

                                {/* Method — icon pills */}
                                <div>
                                    <label className="block text-caption font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                        Payment Method
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {[
                                            { id: 'cash', label: 'Cash' },
                                            { id: 'bank_transfer', label: 'Bank' },
                                            { id: 'online', label: 'Online' },
                                            { id: 'cheque', label: 'Cheque' },
                                            { id: 'card', label: 'Card' },
                                        ].filter((m) => m.id !== 'cheque' || !moneyBookOn || chequeTracking).map((m) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setPaymentForm((p) => ({ ...p, method: m.id }))}
                                                className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                                                    paymentForm.method === m.id
                                                        ? 'bg-primary text-white shadow-sm'
                                                        : 'bg-muted/40 border border-hairline text-muted-foreground hover:border-border'
                                                }`}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                    <AccountPicker
                                        method={paymentForm.method}
                                        value={payMoney.accountId}
                                        onChange={(accId) => setPayMoney((p) => ({ ...p, accountId: accId }))}
                                        amount={round2(paymentForm.amount)}
                                        direction="out"
                                        pending={paymentForm.method === 'cheque' && chequeTracking}
                                        onInsufficientChange={setPayShort}
                                        compact
                                        className="mt-3"
                                    />
                                    {moneyBookOn && paymentForm.method === 'cheque' && chequeTracking && (
                                        <ChequeFields
                                            className="mt-3"
                                            number={payMoney.chequeNumber}
                                            date={payMoney.chequeDate}
                                            onChange={({ number, date }) => setPayMoney((p) => ({ ...p, chequeNumber: number, chequeDate: date }))}
                                        />
                                    )}
                                </div>

                                {/* Reference */}
                                <div>
                                    <label className="block text-caption font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                        Reference (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={paymentForm.reference}
                                        onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                                        placeholder="Cheque #, transaction ID..."
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-hairline rounded-xl text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary"
                                    />
                                </div>

                                {/* Note */}
                                <div>
                                    <label className="block text-caption font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                        Note (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={paymentForm.note}
                                        onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))}
                                        placeholder="Payment note..."
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-hairline rounded-xl text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:border-primary"
                                    />
                                </div>

                                {/* Specific-supply summary preview */}
                                {paymentMode === 'specific' && selectedSupply && enteredAmount > 0 && !isOverpay && (
                                    <div className="p-3 bg-success-chip border border-success/30 rounded-xl space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Outstanding on #{selectedSupply.supplyNumber}</span>
                                            <span>{formatCurrency(dueAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-success font-medium">
                                            <span>Paying now</span>
                                            <span>&minus; {formatCurrency(enteredAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t border-success/30">
                                            <span>Remaining after</span>
                                            <span>{formatCurrency(remaining)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* FIFO allocation preview */}
                                {paymentMode === 'fifo' && enteredAmount > 0 && !isOverpay && allocationPreview.length > 0 && (
                                    <div className="p-3 bg-success-chip border border-success/30 rounded-xl space-y-2">
                                        <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                                            Will be applied to
                                        </div>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {allocationPreview.map((a) => (
                                                <div key={a.supplyNumber} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-foreground">#{a.supplyNumber}</span>
                                                        <span className={`text-micro font-medium px-1.5 py-0.5 rounded ${
                                                            a.fullyPaid
                                                                ? 'bg-success/20 text-success'
                                                                : 'bg-primary/25 text-primary'
                                                        }`}>
                                                            {a.fullyPaid ? 'PAID' : 'PARTIAL'}
                                                        </span>
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        <span className="text-success font-semibold">{formatCurrency(a.apply)}</span>
                                                        <span className="text-muted-foreground"> / {formatCurrency(a.due)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-success/30">
                                            <span>Balance after</span>
                                            <span>{formatCurrency(remaining)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* spacer closes scrollable body */}
                                </div>

                                {/* Actions — pinned to bottom */}
                                <div className="flex items-center gap-2 px-6 py-4 border-t border-hairline shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowPaymentModal(false)}
                                        className="flex-1 py-3 text-muted-foreground hover:bg-[var(--hover-overlay)] rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingPayment || isOverpay || enteredAmount <= 0}
                                        className="flex-[2] py-3 bg-success text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                    >
                                        {submittingPayment ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-hairline border-t-transparent rounded-full animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <FiDollarSign size={15} />
                                                Pay {enteredAmount > 0 ? formatCurrency(enteredAmount) : 'Vendor'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </DialogShell>
                );
            })()}

            {/* ================================================================
                MODAL: Filter Ledger
            ================================================================ */}
            {showFilterModal && (
                <DialogShell size="md" className="max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-hairline">
                            <h3 className="text-xl font-semibold text-foreground">Filter Ledger</h3>
                            <button data-dialog-close
                                onClick={() => setShowFilterModal(false)}
                                className="p-2 hover:bg-[var(--hover-overlay)] rounded-lg transition-colors text-muted-foreground"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Quick Ranges
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'today', label: 'Today' },
                                        { id: 'week', label: 'This Week' },
                                        { id: 'month', label: 'This Month' },
                                        { id: 'all', label: 'All Time' },
                                    ].map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => applyPreset(p.id)}
                                            className="px-4 py-2.5 rounded-xl border border-hairline text-sm font-medium text-foreground hover:bg-[var(--hover-overlay)] hover:border-primary/30 transition-colors"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-hairline pt-5">
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Custom Range
                                </label>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 bg-muted/40 rounded-xl pl-3 pr-2 py-2 border border-hairline">
                                        <span className="text-xs text-muted-foreground w-9 shrink-0">From</span>
                                        <input
                                            type="date"
                                            value={draftStartDate}
                                            onChange={(e) => { setDraftStartDate(e.target.value); if (!e.target.value) setDraftStartTime(''); }}
                                            className="bg-transparent text-sm text-foreground focus:outline-none flex-1"
                                        />
                                        <div className="w-px h-4 bg-muted shrink-0" />
                                        <input
                                            type="time"
                                            value={draftStartTime}
                                            onChange={(e) => setDraftStartTime(e.target.value)}
                                            disabled={!draftStartDate}
                                            title={draftStartDate ? 'Start time (optional)' : 'Pick a start date first'}
                                            className="bg-transparent text-sm text-foreground focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed w-[90px]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-muted/40 rounded-xl pl-3 pr-2 py-2 border border-hairline">
                                        <span className="text-xs text-muted-foreground w-9 shrink-0">To</span>
                                        <input
                                            type="date"
                                            value={draftEndDate}
                                            onChange={(e) => { setDraftEndDate(e.target.value); if (!e.target.value) setDraftEndTime(''); }}
                                            className="bg-transparent text-sm text-foreground focus:outline-none flex-1"
                                        />
                                        <div className="w-px h-4 bg-muted shrink-0" />
                                        <input
                                            type="time"
                                            value={draftEndTime}
                                            onChange={(e) => setDraftEndTime(e.target.value)}
                                            disabled={!draftEndDate}
                                            title={draftEndDate ? 'End time (optional)' : 'Pick an end date first'}
                                            className="bg-transparent text-sm text-foreground focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed w-[90px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                type="button"
                                onClick={() => setShowFilterModal(false)}
                                className="flex-1 py-3 border border-hairline rounded-xl font-medium text-muted-foreground hover:bg-[var(--hover-overlay)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={applyCustomRange}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
                            >
                                Apply
                            </button>
                        </div>
                    </DialogShell>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

const SummaryCard = ({ icon, label, value, tone = 'slate', highlight = false, hint }) => {
    const toneClasses = {
        slate: 'text-foreground',
        emerald: 'text-success',
        red: 'text-destructive',
        amber: 'text-primary',
    };
    return (
        <div className={`bg-card border rounded-2xl p-4 shadow-sm ${
            highlight
                ? 'border-primary/30 ring-1 ring-ring'
                : 'border-hairline'
        }`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className={`${toneClasses[tone]}`}>{icon}</span>
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className={`text-lg font-bold ${toneClasses[tone]}`}>{value}</p>
            {hint && <p className="text-caption text-success mt-0.5">{hint}</p>}
        </div>
    );
};

const TypeBadge = ({ type }) => {
    const config = {
        supply: { label: 'SUPPLY', cls: 'bg-info-chip text-info' },
        payment: { label: 'PAID', cls: 'bg-success-chip text-success' },
        return: { label: 'RETURN', cls: 'bg-accent text-primary' },
        opening_balance: { label: 'OPENING', cls: 'bg-accent text-primary' },
        credit_transfer: { label: 'CREDIT MOVED', cls: 'bg-muted text-muted-foreground' },
    };
    const c = config[type] || { label: type, cls: 'bg-muted text-muted-foreground' };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-micro font-bold tracking-wide ${c.cls}`}>
            {c.label}
        </span>
    );
};

export default VendorLedger;
