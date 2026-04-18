import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { getVendor, getVendorLedger, payVendor } from '../services/api/vendors';
import { paySupply } from '../services/api/supplies';
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
    FiPlus,
    FiX,
    FiSearch,
    FiChevronDown,
    FiChevronRight,
    FiRefreshCw,
    FiFileText,
    FiPackage,
} from 'react-icons/fi';

const VendorLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { business } = useBusiness();

    const [vendor, setVendor] = useState(null);
    const [ledgerData, setLedgerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all'); // all | supply | payment | return

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
                String(e.supplyNumber || '').includes(q)
            );
        }

        return entries;
    }, [ledgerData, typeFilter, searchQuery]);

    // Outstanding supplies (for payment modal dropdown)
    const outstandingSupplies = useMemo(() => {
        if (!ledgerData?.ledger) return [];
        const supplyMap = new Map();
        for (const e of ledgerData.ledger) {
            if (!e.supplyId) continue;
            const key = String(e.supplyId);
            if (!supplyMap.has(key)) {
                supplyMap.set(key, {
                    supplyId: e.supplyId,
                    supplyNumber: e.supplyNumber,
                    total: 0,
                    credited: 0,
                });
            }
            const entry = supplyMap.get(key);
            if (e.type === 'supply' || e.type === 'opening_balance') entry.total += e.debit || 0;
            else entry.credited += e.credit || 0;
        }
        return Array.from(supplyMap.values())
            .map((s) => ({ ...s, due: s.total - s.credited }))
            .filter((s) => s.due > 0);
    }, [ledgerData]);

    // =========================================================================
    // Handlers
    // =========================================================================

    const totalOutstanding = useMemo(
        () => outstandingSupplies.reduce((sum, s) => sum + s.due, 0),
        [outstandingSupplies]
    );

    const openPaymentModal = () => {
        setPaymentMode('fifo');
        setPaymentForm({
            supplyId: outstandingSupplies[0]?.supplyId || '',
            amount: String(totalOutstanding || ''),
            method: 'cash',
            note: '',
            reference: '',
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
                await payVendor(id, {
                    amount,
                    method: paymentForm.method,
                    note: paymentForm.note,
                    reference: paymentForm.reference,
                });
            } else {
                if (!paymentForm.supplyId) {
                    alert('Select a supply');
                    setSubmittingPayment(false);
                    return;
                }
                await paySupply(paymentForm.supplyId, {
                    amount,
                    method: paymentForm.method,
                    note: paymentForm.note,
                    reference: paymentForm.reference,
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

    const downloadCsv = () => {
        if (!ledgerData) return;
        const { summary } = ledgerData;

        const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
        const lines = [
            ['Vendor Ledger Report'],
            ['Generated', new Date().toLocaleString()],
            [],
            ['Vendor', vendor?.name || ''],
            ['Phone', vendor?.phone || ''],
            ['Company', vendor?.company || ''],
            ['Address', vendor?.address || ''],
            ['Credit Limit', vendor?.creditLimit || 0],
            ['Credit Days', vendor?.creditDays || 0],
            [],
            ['Summary'],
            ['Total Supplies', summary.totalSupplies],
            ['Total Paid', summary.totalPaid],
            ['Total Returns', summary.totalReturns],
            ['Current Balance', summary.currentBalance],
            ['Total Supplies Count', summary.supplyCount],
            ['Total Entries', summary.totalEntries],
            [],
            ['Ledger Entries'],
            ['Date', 'Time', 'Voucher', 'Type', 'Description', 'Method / By', 'Debit', 'Credit', 'Balance', 'Notes'],
            ...filteredEntries.map((e) => {
                const d = new Date(e.date);
                return [
                    d.toLocaleDateString(),
                    d.toLocaleTimeString(),
                    e.supplyNumber ? `#${e.supplyNumber}` : '',
                    e.type,
                    e.description,
                    [e.method, e.paidBy].filter(Boolean).join(' / '),
                    e.debit || 0,
                    e.credit || 0,
                    e.balance || 0,
                    e.notes || '',
                ];
            }),
        ];

        const csv = lines.map((r) => r.map((c) => `"${esc(c)}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vendor-ledger-${(vendor?.name || 'vendor').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                        onClick={() => navigate('/vendors')}
                        className="px-4 py-2 bg-primary-500 dark:bg-d-accent text-white dark:text-d-card rounded-xl"
                    >
                        Back to Vendors
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
                            onClick={() => navigate('/vendors')}
                            className="p-2 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-lg transition-colors"
                            title="Back"
                        >
                            <FiArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                                Vendor Ledger
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
                            onClick={downloadCsv}
                            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border text-slate-700 dark:text-d-text rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                        >
                            <FiDownload size={15} />
                            Download CSV
                        </button>
                        <button
                            onClick={openPaymentModal}
                            disabled={outstandingSupplies.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 dark:bg-d-green text-white dark:text-d-card rounded-xl text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FiPlus size={15} />
                            Pay Vendor
                        </button>
                    </div>
                </div>

                {/* Vendor Info Card */}
                <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl p-6 mb-4 shadow-sm">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 dark:from-d-accent dark:to-d-accent-s flex items-center justify-center text-white dark:text-d-card text-2xl font-bold">
                                {(vendor?.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-d-heading">
                                    {vendor?.name}
                                </h2>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500 dark:text-d-muted">
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
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400 dark:text-d-faint">
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
                    <SummaryCard
                        icon={<FiAlertCircle />}
                        label={(summary.currentBalance || 0) > 0 ? 'Balance Due' : 'Current Balance'}
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
                                { id: 'supply', label: 'Supplies' },
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
                                placeholder="Search by supply #, description, method, note..."
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
                                                        {entry.supplyNumber && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 dark:bg-d-glass text-slate-600 dark:text-d-muted">
                                                                #{entry.supplyNumber}
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
                                                        {entry.paidBy && (
                                                            <div className="text-slate-400 dark:text-d-faint">{entry.paidBy}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-medium text-red-600 dark:text-d-red whitespace-nowrap">
                                                        {entry.debit > 0 ? formatCurrency(entry.debit) : '\u2014'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-d-green whitespace-nowrap">
                                                        {entry.credit > 0 ? formatCurrency(entry.credit) : '\u2014'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-bold whitespace-nowrap text-slate-800 dark:text-d-heading">
                                                        {formatCurrency(entry.balance || 0)}
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
                                                                                    <FiPackage size={16} className="text-white dark:text-d-card" />
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-sm font-bold text-slate-800 dark:text-d-heading">
                                                                                            Supply #{entry.supplyNumber}
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
                                                                                    <th className="text-right py-3 w-32">GST</th>
                                                                                    <th className="text-right py-3 w-32">Line Total</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 dark:divide-d-border">
                                                                                {entry.items.map((it, i) => {
                                                                                    const lineGross = (it.unitCost || it.price || 0) * (it.quantity || it.qty || 0);
                                                                                    const gstAmount = it.gstAmount || 0;
                                                                                    const lineTotal = it.totalPrice != null ? it.totalPrice : lineGross + gstAmount;
                                                                                    return (
                                                                                        <tr key={i} className="text-slate-700 dark:text-d-text hover:bg-slate-50/50 dark:hover:bg-d-elevated/50 transition-colors">
                                                                                            <td className="py-4">
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-d-border flex items-center justify-center text-[12px] font-bold text-slate-700 dark:text-d-heading">
                                                                                                        {i + 1}
                                                                                                    </div>
                                                                                                    <div className="font-semibold text-slate-800 dark:text-d-heading">{it.productName || it.name}</div>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="py-4 text-center">
                                                                                                <span className="inline-flex items-center justify-center min-w-[40px] px-3 py-1 rounded-lg bg-primary-500 dark:bg-d-accent text-xs font-bold text-white dark:text-d-card shadow-sm">
                                                                                                    &times; {it.quantity || it.qty}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-4 text-right text-slate-600 dark:text-d-muted tabular-nums font-medium">
                                                                                                {formatCurrency(it.unitCost || it.price)}
                                                                                            </td>
                                                                                            <td className="py-4 text-right tabular-nums">
                                                                                                {gstAmount > 0 ? (
                                                                                                    <span className="text-slate-600 dark:text-d-muted font-medium">
                                                                                                        {formatCurrency(gstAmount)}
                                                                                                        {it.gstPercent ? ` (${it.gstPercent}%)` : ''}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-slate-400 dark:text-d-muted">&mdash;</span>
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
                                                                                <span>{it.productName || it.name} <span className="text-slate-400 dark:text-d-faint">&times; {it.quantity || it.qty}</span></span>
                                                                                <span className="font-medium text-red-600 dark:text-d-red tabular-nums">
                                                                                    {formatCurrency(it.refundAmount || ((it.unitCost || it.price || 0) * (it.quantity || it.qty || 0)))}
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
                                                            {entry.reference && (
                                                                <div className="mt-2 text-xs text-slate-500 dark:text-d-muted">
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
                                <tfoot className="bg-slate-50 dark:bg-d-glass border-t-2 border-slate-200 dark:border-d-border">
                                    <tr>
                                        <td colSpan={5} className="py-3 px-4 text-right font-semibold text-slate-600 dark:text-d-muted">Totals</td>
                                        <td className="py-3 px-4 text-right font-bold text-red-600 dark:text-d-red">
                                            {formatCurrency(filteredEntries.reduce((s, e) => s + (e.debit || 0), 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-d-green">
                                            {formatCurrency(filteredEntries.reduce((s, e) => s + (e.credit || 0), 0))}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-d-heading">
                                            {formatCurrency(summary.currentBalance || 0)}
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
                const selectedSupply = outstandingSupplies.find((s) => String(s.supplyId) === String(paymentForm.supplyId));
                const dueAmount = paymentMode === 'fifo' ? totalOutstanding : (selectedSupply?.due || 0);
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
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-d-elevated border border-slate-200 dark:border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl w-full max-w-md animate-pop-in overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-d-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-[rgba(52,232,161,0.12)] flex items-center justify-center">
                                        <FiDollarSign className="text-emerald-600 dark:text-d-green" size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-d-heading">Pay Vendor</h2>
                                        <p className="text-[11px] text-slate-500 dark:text-d-muted">Payment to {vendor?.name}</p>
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
                                            const first = outstandingSupplies[0];
                                            setPaymentForm((p) => ({
                                                ...p,
                                                supplyId: first?.supplyId || '',
                                                amount: first ? String(first.due) : '',
                                            }));
                                        }}
                                        className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                                            paymentMode === 'specific'
                                                ? 'bg-white dark:bg-d-elevated text-slate-800 dark:text-d-heading shadow-sm'
                                                : 'text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text'
                                        }`}
                                    >
                                        Specific Supply
                                    </button>
                                </div>

                                {/* FIFO info banner */}
                                {paymentMode === 'fifo' && (
                                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-[rgba(59,130,246,0.08)] border border-blue-200 dark:border-[rgba(59,130,246,0.2)] rounded-xl">
                                        <FiAlertCircle className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" size={14} />
                                        <div className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                                            Amount will be auto-applied to <strong>{outstandingSupplies.length} outstanding supply{outstandingSupplies.length === 1 ? '' : ' orders'}</strong>, oldest first (FIFO). Total due: <strong>{formatCurrency(totalOutstanding)}</strong>
                                        </div>
                                    </div>
                                )}

                                {/* Supply selector — only in specific mode */}
                                {paymentMode === 'specific' && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-d-muted mb-2 uppercase tracking-wide">
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
                                                className="w-full appearance-none pl-4 pr-10 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text focus:outline-none focus:border-primary-400 dark:focus:border-d-border-hover cursor-pointer"
                                            >
                                                {outstandingSupplies.map((s) => (
                                                    <option key={s.supplyId} value={s.supplyId}>
                                                        #{s.supplyNumber} — Due {formatCurrency(s.due)}
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
                                            { id: 'bank_transfer', label: 'Bank' },
                                            { id: 'cheque', label: 'Cheque' },
                                            { id: 'card', label: 'Card' },
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

                                {/* Reference */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-d-muted mb-2 uppercase tracking-wide">
                                        Reference (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={paymentForm.reference}
                                        onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                                        placeholder="Cheque #, transaction ID..."
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-primary-400 dark:focus:border-d-border-hover"
                                    />
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
                                        placeholder="Payment note..."
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-primary-400 dark:focus:border-d-border-hover"
                                    />
                                </div>

                                {/* Specific-supply summary preview */}
                                {paymentMode === 'specific' && selectedSupply && enteredAmount > 0 && !isOverpay && (
                                    <div className="p-3 bg-emerald-50 dark:bg-[rgba(52,232,161,0.08)] border border-emerald-200 dark:border-[rgba(52,232,161,0.2)] rounded-xl space-y-1">
                                        <div className="flex justify-between text-xs text-slate-600 dark:text-d-muted">
                                            <span>Outstanding on #{selectedSupply.supplyNumber}</span>
                                            <span>{formatCurrency(dueAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-emerald-700 dark:text-d-green font-medium">
                                            <span>Paying now</span>
                                            <span>&minus; {formatCurrency(enteredAmount)}</span>
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
                                                <div key={a.supplyNumber} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-700 dark:text-d-text">#{a.supplyNumber}</span>
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
        supply: { label: 'SUPPLY', cls: 'bg-blue-50 dark:bg-[rgba(91,156,246,0.1)] text-blue-600 dark:text-d-blue' },
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

export default VendorLedger;
