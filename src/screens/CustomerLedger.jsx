import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { useBusiness } from '../context/BusinessContext';
import { getCustomer, getCustomerLedger, collectFromCustomer } from '../services/api/customers';
import { addBillPayment } from '../services/api/bills';
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
    FiFilter,
    FiPlus,
    FiX,
    FiSearch,
    FiChevronDown,
    FiChevronRight,
    FiRefreshCw,
    FiFileText,
} from 'react-icons/fi';

const CustomerLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { business } = useBusiness();

    const [customer, setCustomer] = useState(null);
    const [ledgerData, setLedgerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all'); // all | bill | payment | return

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
    const formatCurrency = (amount) =>
        `${currency} ${Math.abs(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    // =========================================================================
    // Data
    // =========================================================================

    const fetchLedger = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const [ledgerRes, customerRes] = await Promise.all([
                getCustomerLedger(id, params),
                getCustomer(id),
            ]);

            setLedgerData(ledgerRes.data);
            setCustomer(customerRes.data);
        } catch (err) {
            console.error('Error fetching ledger:', err);
            setError(err.response?.data?.message || 'Failed to load ledger');
        } finally {
            setLoading(false);
        }
    }, [id, startDate, endDate]);

    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    // =========================================================================
    // Derived — filtered entries
    // =========================================================================

    const filteredEntries = useMemo(() => {
        if (!ledgerData?.ledger) return [];
        let entries = ledgerData.ledger;

        if (typeFilter !== 'all') {
            entries = entries.filter((e) => e.type === typeFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            entries = entries.filter((e) =>
                (e.description || '').toLowerCase().includes(q) ||
                (e.notes || '').toLowerCase().includes(q) ||
                (e.method || '').toLowerCase().includes(q) ||
                String(e.billNumber || '').includes(q)
            );
        }

        return entries;
    }, [ledgerData, typeFilter, searchQuery]);

    // Outstanding bills (for payment modal dropdown)
    const outstandingBills = useMemo(() => {
        if (!ledgerData?.ledger) return [];
        // Aggregate per bill: how much was billed vs paid/returned
        const billMap = new Map();
        for (const e of ledgerData.ledger) {
            if (!e.billId) continue;
            const key = String(e.billId);
            if (!billMap.has(key)) {
                billMap.set(key, {
                    billId: e.billId,
                    billNumber: e.billNumber,
                    total: 0,
                    credited: 0,
                });
            }
            const entry = billMap.get(key);
            if (e.type === 'bill' || e.type === 'opening_balance') entry.total += e.debit || 0;
            else entry.credited += e.credit || 0;
        }
        return Array.from(billMap.values())
            .map((b) => ({ ...b, due: b.total - b.credited }))
            .filter((b) => b.due > 0);
    }, [ledgerData]);

    // =========================================================================
    // Handlers
    // =========================================================================

    const totalOutstanding = useMemo(
        () => outstandingBills.reduce((sum, b) => sum + b.due, 0),
        [outstandingBills]
    );

    const openPaymentModal = () => {
        setPaymentMode('fifo');
        setPaymentForm({
            billId: outstandingBills[0]?.billId || '',
            amount: String(totalOutstanding || ''),
            method: 'cash',
            note: '',
        });
        setShowPaymentModal(true);
    };

    const submitPayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentForm.amount);
        if (!amount || amount <= 0) {
            alert('Enter a valid amount');
            return;
        }

        setSubmittingPayment(true);
        try {
            if (paymentMode === 'fifo') {
                if (amount > totalOutstanding + 0.01) {
                    alert(`Amount exceeds total outstanding (${formatCurrency(totalOutstanding)})`);
                    setSubmittingPayment(false);
                    return;
                }
                await collectFromCustomer(id, {
                    amount,
                    method: paymentForm.method,
                    note: paymentForm.note,
                });
            } else {
                if (!paymentForm.billId) {
                    alert('Select a bill');
                    setSubmittingPayment(false);
                    return;
                }
                await addBillPayment(paymentForm.billId, {
                    amount,
                    method: paymentForm.method,
                    note: paymentForm.note,
                });
            }
            setShowPaymentModal(false);
            fetchLedger();
        } catch (err) {
            console.error('Payment error:', err);
            alert(err.response?.data?.message || 'Failed to record payment');
        } finally {
            setSubmittingPayment(false);
        }
    };

    const downloadPdf = () => {
        if (!ledgerData) return;
        const { summary } = ledgerData;
        const currency = business?.currency || 'PKR';
        const fmt = (v) => Number(v || 0).toLocaleString();

        const dateRange = startDate || endDate
            ? `${startDate || 'Start'} — ${endDate || 'Today'}`
            : 'All Time';

        const balanceLabel = (summary.currentBalance || 0) < 0 ? 'Store Credit' : 'Balance Due';
        const balanceColor = (summary.currentBalance || 0) < 0 ? '#3b82f6' : '#ef4444';

        const entryRows = filteredEntries.map((e) => {
            const d = new Date(e.date);
            const typeLabel = e.type === 'bill' ? 'BILL' : e.type === 'payment' ? 'PAID' : e.type === 'return' ? 'RETURN' : e.type === 'opening_balance' ? 'OPENING' : e.type?.toUpperCase() || '';
            const typeColor = e.type === 'bill' ? '#f59e0b' : e.type === 'payment' ? '#10b981' : e.type === 'return' ? '#3b82f6' : '#64748b';
            return `<tr>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">${e.billNumber ? '#' + e.billNumber : '—'}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;"><span style="color:${typeColor};font-size:10px;font-weight:700;margin-right:6px;">${typeLabel}</span>${e.description}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">${[e.method?.toUpperCase(), e.receivedBy].filter(Boolean).join(' / ') || '—'}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;color:#ef4444;font-weight:600;">${e.debit ? currency + ' ' + fmt(e.debit) : '—'}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;color:#10b981;font-weight:600;">${e.credit ? currency + ' ' + fmt(e.credit) : '—'}</td>
                <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${currency} ${fmt(e.balance)}</td>
            </tr>`;
        }).join('');

        const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;padding:20px 24px;color:#1e293b;background:#fff;width:100%;">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                <div>
                    <h1 style="margin:0;font-size:22px;font-weight:700;">Customer Ledger Report</h1>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Generated: ${new Date().toLocaleString()} | Period: ${dateRange}</p>
                </div>
                ${business?.name ? `<div style="text-align:right;"><div style="font-size:14px;font-weight:700;">${business.name}</div>${business.phone ? `<div style="font-size:11px;color:#64748b;">${business.phone}</div>` : ''}</div>` : ''}
            </div>

            <!-- Customer Info -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
                <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${customer?.name || 'Customer'}</div>
                <div style="display:flex;gap:24px;font-size:11px;color:#64748b;">
                    ${customer?.phone ? `<span>Phone: ${customer.phone}</span>` : ''}
                    ${customer?.email ? `<span>Email: ${customer.email}</span>` : ''}
                    ${customer?.address ? `<span>Address: ${customer.address}</span>` : ''}
                </div>
                <div style="display:flex;gap:24px;font-size:10px;color:#94a3b8;margin-top:2px;">
                    ${customer?.creditLimit ? `<span>Credit Limit: ${currency} ${fmt(customer.creditLimit)}</span>` : ''}
                    ${customer?.creditDays ? `<span>Credit Days: ${customer.creditDays}</span>` : ''}
                </div>
            </div>

            <!-- Summary Cards -->
            <div style="display:flex;gap:10px;margin-bottom:16px;">
                <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;">Total Billed</div>
                    <div style="font-size:16px;font-weight:700;margin-top:2px;">${currency} ${fmt(summary.totalBilled)}</div>
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
                    <div style="font-size:10px;color:${balanceColor};text-transform:uppercase;font-weight:600;">${balanceLabel}</div>
                    <div style="font-size:16px;font-weight:700;margin-top:2px;color:${balanceColor};">${currency} ${fmt(Math.abs(summary.currentBalance || 0))}</div>
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
            </table>

            <!-- Footer -->
            <div style="margin-top:12px;font-size:10px;color:#94a3b8;text-align:center;">
                Entries: ${filteredEntries.length} | Bills: ${summary.billCount || 0}
            </div>
        </div>`;

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
        container.innerHTML = html;
        document.body.appendChild(container);

        html2pdf()
            .set({
                margin: [8, 6, 8, 6],
                filename: `ledger-${(customer?.name || 'customer').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            })
            .from(container.firstElementChild)
            .save()
            .then(() => document.body.removeChild(container))
            .catch((err) => {
                console.error('PDF download error:', err);
                document.body.removeChild(container);
            });
    };

    const handlePrint = () => {
        window.print();
    };

    // =========================================================================
    // Render
    // =========================================================================

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading ledger...</p>
                </div>
            </div>
        );
    }

    if (error) {
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

    const summary = ledgerData?.summary || {};

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-d-bg print:bg-white">
            <div className="max-w-[1400px] mx-auto p-6 print:p-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 print:hidden">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/customers')}
                            className="p-2 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-lg transition-colors"
                            title="Back"
                        >
                            <FiArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                                Customer Ledger
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-d-muted">
                                Complete account statement and transaction history
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchLedger}
                            className="p-2.5 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl transition-colors"
                            title="Refresh"
                        >
                            <FiRefreshCw size={17} />
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border text-slate-700 dark:text-d-text rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                        >
                            <FiPrinter size={15} />
                            Print
                        </button>
                        <button
                            onClick={downloadPdf}
                            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border text-slate-700 dark:text-d-text rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                        >
                            <FiDownload size={15} />
                            Download PDF
                        </button>
                        <button
                            onClick={openPaymentModal}
                            disabled={outstandingBills.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 dark:bg-d-green text-white dark:text-d-card rounded-xl text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FiPlus size={15} />
                            Record Payment
                        </button>
                    </div>
                </div>

                {/* Customer Info Card */}
                <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-6 mb-4 shadow-sm">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 dark:from-d-accent dark:to-d-accent-s flex items-center justify-center text-white dark:text-d-card text-2xl font-bold">
                                {(customer?.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                                    {customer?.name}
                                </h2>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500 dark:text-d-muted">
                                    {customer?.phone && (
                                        <span className="flex items-center gap-1.5">
                                            <FiPhone size={13} /> {customer.phone}
                                        </span>
                                    )}
                                    {customer?.email && (
                                        <span className="flex items-center gap-1.5">
                                            <FiMail size={13} /> {customer.email}
                                        </span>
                                    )}
                                    {customer?.address && (
                                        <span className="flex items-center gap-1.5">
                                            <FiMapPin size={13} /> {customer.address}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400 dark:text-d-faint">
                                    {!!customer?.creditLimit && (
                                        <span>Credit limit: {formatCurrency(customer.creditLimit)}</span>
                                    )}
                                    {!!customer?.creditDays && (
                                        <span>Credit days: {customer.creditDays}</span>
                                    )}
                                    {customer?.lastPurchase && (
                                        <span>Last purchase: {new Date(customer.lastPurchase).toLocaleDateString()}</span>
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
                        label="Total Billed"
                        value={formatCurrency(summary.totalBilled || 0)}
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
                        label="Total Bills"
                        value={summary.billCount || 0}
                        tone="slate"
                    />
                    <SummaryCard
                        icon={<FiAlertCircle />}
                        label={
                            (summary.currentBalance || 0) < 0
                                ? 'Store Credit'
                                : (summary.currentBalance || 0) > 0
                                    ? 'Amount Due'
                                    : 'Current Balance'
                        }
                        value={formatCurrency(summary.currentBalance || 0)}
                        tone={(summary.currentBalance || 0) > 0 ? 'red' : 'emerald'}
                        highlight
                    />
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-4 mb-4 shadow-sm print:hidden">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-d-bg rounded-xl px-3 py-2 border border-slate-200 dark:border-d-border">
                            <FiCalendar size={14} className="text-slate-400 dark:text-d-faint" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-sm text-slate-700 dark:text-d-text focus:outline-none"
                            />
                            <span className="text-slate-400 dark:text-d-faint text-xs">to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-sm text-slate-700 dark:text-d-text focus:outline-none"
                            />
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); }}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <FiX size={14} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-d-bg rounded-xl p-1 border border-slate-200 dark:border-d-border">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'bill', label: 'Bills' },
                                { id: 'payment', label: 'Payments' },
                                { id: 'return', label: 'Returns' },
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setTypeFilter(f.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        typeFilter === f.id
                                            ? 'bg-primary-500 dark:bg-d-accent text-white dark:text-d-card'
                                            : 'text-slate-600 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative flex-1 min-w-[200px]">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" size={14} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by bill #, description, method, note..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-700 dark:text-d-text placeholder-slate-400 focus:outline-none focus:border-primary-300"
                            />
                        </div>

                        <div className="text-xs text-slate-500 dark:text-d-muted ml-auto">
                            {filteredEntries.length} of {ledgerData?.ledger?.length || 0} entries
                        </div>
                    </div>
                </div>

                {/* Ledger Table */}
                <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl shadow-sm overflow-hidden">
                    {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-d-faint">
                            <FiFileText size={48} />
                            <p className="mt-4 text-base">No entries found</p>
                            <p className="text-xs mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-d-glass">
                                    <tr>
                                        <th className="w-8"></th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-d-muted whitespace-nowrap">Date</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-d-muted whitespace-nowrap">Voucher</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-d-muted">Description</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-d-muted whitespace-nowrap">Method / By</th>
                                        <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-d-muted whitespace-nowrap">Debit</th>
                                        <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-d-muted whitespace-nowrap">Credit</th>
                                        <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-d-muted whitespace-nowrap">Balance</th>
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
                                                    className={`border-t border-slate-100 dark:border-d-border hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors ${
                                                        hasDetails ? 'cursor-pointer' : ''
                                                    }`}
                                                >
                                                    <td className="py-3 px-2 text-center">
                                                        {hasDetails &&
                                                            (isExpanded ? (
                                                                <FiChevronDown size={14} className="text-slate-400 mx-auto" />
                                                            ) : (
                                                                <FiChevronRight size={14} className="text-slate-400 mx-auto" />
                                                            ))}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-600 dark:text-d-text whitespace-nowrap">
                                                        <div className="font-medium">{d.toLocaleDateString()}</div>
                                                        <div className="text-[10px] text-slate-400 dark:text-d-faint">
                                                            {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        {entry.billNumber && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 dark:bg-d-glass text-slate-600 dark:text-d-muted">
                                                                #{entry.billNumber}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <TypeBadge type={entry.type} />
                                                            <span className="text-slate-700 dark:text-d-text">{entry.description}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                                                        {entry.method && (
                                                            <div className="uppercase text-slate-600 dark:text-d-text font-medium">{entry.method}</div>
                                                        )}
                                                        {entry.receivedBy && (
                                                            <div className="text-slate-400 dark:text-d-faint">{entry.receivedBy}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-medium text-red-600 dark:text-d-red whitespace-nowrap">
                                                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-d-green whitespace-nowrap">
                                                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${(entry.balance || 0) < 0 ? 'text-emerald-600 dark:text-d-green' : 'text-slate-800 dark:text-d-heading'}`}>
                                                        {(entry.balance || 0) < 0 ? 'Cr ' : ''}{formatCurrency(entry.balance || 0)}
                                                    </td>
                                                </tr>
                                                {isExpanded && hasDetails && (
                                                    <tr className="bg-slate-50/70 dark:bg-d-glass">
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
                                                                                <span>{it.name} <span className="text-slate-400 dark:text-d-faint">× {it.qty}</span></span>
                                                                                <span className="font-medium text-red-600 dark:text-d-red tabular-nums">
                                                                                    {formatCurrency(it.refundAmount || (it.price * it.qty))}
                                                                                </span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {entry.notes && (
                                                                <div className="mt-3 px-4 py-2.5 bg-blue-50 dark:bg-[rgba(59,130,246,0.08)] border-l-2 border-blue-400 dark:border-blue-500 rounded-r-lg">
                                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-0.5">Note</div>
                                                                    <div className="text-xs text-slate-700 dark:text-d-text italic">{entry.notes}</div>
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
                                <tfoot className="bg-slate-50 dark:bg-d-glass border-t-2 border-slate-200 dark:border-d-border">
                                    <tr>
                                        <td colSpan={5} className="py-3 px-4 text-right font-semibold text-slate-600 dark:text-d-muted">Totals</td>
                                        <td className="py-3 px-4 text-right font-bold text-red-600 dark:text-d-red">
                                            {formatCurrency(filteredEntries.reduce((s, e) => s + (e.debit || 0), 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-d-green">
                                            {formatCurrency(filteredEntries.reduce((s, e) => s + (e.credit || 0), 0))}
                                        </td>
                                        <td className={`py-3 px-4 text-right font-bold ${(summary.currentBalance || 0) < 0 ? 'text-emerald-600 dark:text-d-green' : 'text-slate-800 dark:text-d-heading'}`}>
                                            {(summary.currentBalance || 0) < 0 ? 'Credit: ' : ''}{formatCurrency(summary.currentBalance || 0)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

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
                        <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl w-full max-w-md animate-pop-in overflow-hidden">
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
                                            setPaymentForm((p) => ({ ...p, amount: String(totalOutstanding || '') }));
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
                                                amount: first ? String(first.due) : '',
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
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { id: 'cash', label: 'Cash' },
                                            { id: 'card', label: 'Card' },
                                            { id: 'online', label: 'Online' },
                                            { id: 'store_credit', label: 'Credit' },
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

const SummaryCard = ({ icon, label, value, tone = 'slate', highlight = false }) => {
    const toneClasses = {
        slate: 'text-slate-700 dark:text-d-heading',
        emerald: 'text-emerald-600 dark:text-d-green',
        red: 'text-red-600 dark:text-d-red',
        amber: 'text-amber-600 dark:text-d-accent',
    };
    return (
        <div className={`bg-white dark:bg-d-card border rounded-2xl p-4 shadow-sm ${
            highlight
                ? 'border-primary-300 dark:border-d-accent/40 ring-1 ring-primary-100 dark:ring-d-accent/10'
                : 'border-slate-100 dark:border-d-border'
        }`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className={`${toneClasses[tone]}`}>{icon}</span>
                <p className="text-xs text-slate-500 dark:text-d-muted">{label}</p>
            </div>
            <p className={`text-lg font-bold ${toneClasses[tone]}`}>{value}</p>
        </div>
    );
};

const TypeBadge = ({ type }) => {
    const config = {
        bill: { label: 'SALE', cls: 'bg-red-50 dark:bg-[rgba(255,107,107,0.1)] text-red-600 dark:text-d-red' },
        payment: { label: 'PAID', cls: 'bg-emerald-50 dark:bg-[rgba(52,232,161,0.1)] text-emerald-600 dark:text-d-green' },
        return: { label: 'RETURN', cls: 'bg-amber-50 dark:bg-[rgba(255,185,50,0.1)] text-amber-600 dark:text-d-accent' },
    };
    const c = config[type] || { label: type, cls: 'bg-slate-100 text-slate-600' };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${c.cls}`}>
            {c.label}
        </span>
    );
};

export default CustomerLedger;
