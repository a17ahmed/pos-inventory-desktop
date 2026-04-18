import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getPendingBills, resumePendingBill, cancelPendingBill } from '../services/api/pendingBills';
import {
    FiClock,
    FiUser,
    FiPhone,
    FiDollarSign,
    FiCheck,
    FiTrash2,
    FiRefreshCw,
    FiShoppingCart,
    FiArrowRight,
    FiAlertCircle,
} from 'react-icons/fi';

const Pending = () => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    const { user } = useAuth();
    const [pendingBills, setPendingBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPendingBills();
    }, []);

    const fetchPendingBills = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getPendingBills();
            const data = res.data;
            if (Array.isArray(data)) {
                setPendingBills(data);
            } else if (data && Array.isArray(data.bills)) {
                setPendingBills(data.bills);
            } else {
                setPendingBills([]);
            }
        } catch (err) {
            console.error('Error fetching pending bills:', err);
            setError(err.response?.data?.message || 'Failed to load pending bills');
            setPendingBills([]);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadBill = async (bill) => {
        try {
            await resumePendingBill(bill._id);

            localStorage.setItem('pendingBillToLoad', JSON.stringify({
                billName: bill.billName,
                items: bill.items,
                customerName: bill.customerName,
                customerPhone: bill.customerPhone,
                amountPaid: bill.amountPaid || 0,
                remainingAmount: bill.remainingAmount || bill.total,
                total: bill.total,
                subtotal: bill.subtotal,
                tax: bill.tax,
            }));

            navigate('/');
        } catch (error) {
            console.error('Error loading bill:', error);
            alert(error.response?.data?.message || 'Failed to load bill');
        }
    };

    const handleCancelBill = async (billId) => {
        if (!window.confirm('Are you sure you want to cancel this pending bill?')) return;

        try {
            await cancelPendingBill(billId);
            fetchPendingBills();
        } catch (error) {
            console.error('Error cancelling pending bill:', error);
            alert('Failed to cancel pending bill');
        }
    };

    const currency = business?.currency || 'Rs.';
    const formatCurrency = (amount) => `${currency} ${(amount || 0).toLocaleString()}`;

    const totalPendingAmount = pendingBills.reduce((sum, bill) => sum + (bill.total || 0), 0);
    const totalPaidAmount = pendingBills.reduce((sum, bill) => sum + (bill.amountPaid || 0), 0);

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading pending bills...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 bg-[rgba(255,107,107,0.1)] rounded-full flex items-center justify-center">
                        <FiAlertCircle size={32} className="text-d-red" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-d-heading">Failed to load pending bills</h2>
                    <p className="text-slate-500 dark:text-d-muted">{error}</p>
                    <button
                        onClick={fetchPendingBills}
                        className="px-6 py-3 bg-gradient-to-r from-d-accent to-d-accent-s text-d-card rounded-xl font-semibold hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-auto">
            <div className="p-6 animate-fade-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Pending Bills</h1>
                        <p className="text-slate-500 dark:text-d-muted">{pendingBills.length} bills on hold</p>
                    </div>
                    <button
                        onClick={fetchPendingBills}
                        className="flex items-center gap-2 px-4 py-2.5 text-slate-500 dark:text-d-muted hover:text-slate-700 dark:text-d-text hover:bg-d-glass rounded-xl transition-all"
                    >
                        <FiRefreshCw size={18} />
                        Refresh
                    </button>
                </div>

                {/* Stats Cards */}
                {pendingBills.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-[rgba(255,210,100,0.1)] rounded-xl flex items-center justify-center">
                                    <FiClock className="text-amber-600 dark:text-d-accent" size={20} />
                                </div>
                                <span className="text-slate-500 dark:text-d-muted text-sm">Total Bills</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-d-heading">{pendingBills.length}</p>
                        </div>
                        <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-[rgba(255,107,107,0.1)] rounded-xl flex items-center justify-center">
                                    <FiDollarSign className="text-d-red" size={20} />
                                </div>
                                <span className="text-slate-500 dark:text-d-muted text-sm">Total Pending</span>
                            </div>
                            <p className="text-2xl font-bold text-d-red">{formatCurrency(totalPendingAmount)}</p>
                        </div>
                        <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-[rgba(52,232,161,0.1)] rounded-xl flex items-center justify-center">
                                    <FiCheck className="text-emerald-500 dark:text-d-green" size={20} />
                                </div>
                                <span className="text-slate-500 dark:text-d-muted text-sm">Partial Payments</span>
                            </div>
                            <p className="text-2xl font-bold text-emerald-500 dark:text-d-green">{formatCurrency(totalPaidAmount)}</p>
                        </div>
                    </div>
                )}

                {/* Bills Grid */}
                {pendingBills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-24 h-24 bg-d-glass rounded-full flex items-center justify-center mb-6">
                            <FiClock size={48} className="text-slate-400 dark:text-d-faint" />
                        </div>
                        <p className="text-xl font-medium text-slate-500 dark:text-d-muted">No pending bills</p>
                        <p className="text-sm mt-2 text-slate-400 dark:text-d-faint">Bills you put on hold will appear here</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingBills.map((bill) => (
                            <div
                                key={bill._id}
                                className="group bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border p-6 hover:border-d-border-hover hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-d-heading">{bill.billName || 'Bill'}</h3>
                                        <p className="text-sm text-slate-400 dark:text-d-faint">
                                            {new Date(bill.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 px-2.5 py-1 bg-[rgba(255,210,100,0.1)] text-amber-600 dark:text-d-accent rounded-lg text-xs font-semibold">
                                        <FiClock size={12} />
                                        Pending
                                    </div>
                                </div>

                                {/* Customer Info */}
                                {(bill.customerName || bill.customerPhone) && (
                                    <div className="mb-4 p-3 bg-[rgba(255,255,255,0.02)] rounded-xl border border-[rgba(255,255,255,0.05)]">
                                        {bill.customerName && (
                                            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-d-text">
                                                <FiUser size={14} className="text-slate-500 dark:text-d-muted" />
                                                {bill.customerName}
                                            </div>
                                        )}
                                        {bill.customerPhone && (
                                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted mt-1">
                                                <FiPhone size={14} />
                                                {bill.customerPhone}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Items Summary */}
                                <div className="mb-4">
                                    <p className="text-sm text-slate-500 dark:text-d-muted mb-2 flex items-center gap-2">
                                        <FiShoppingCart size={14} />
                                        {bill.items?.length || 0} items
                                    </p>
                                    <div className="space-y-1.5">
                                        {bill.items?.slice(0, 3).map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span className="text-slate-700 dark:text-d-text truncate flex-1">{item.name}</span>
                                                <span className="text-slate-500 dark:text-d-muted ml-2">x{item.qty}</span>
                                            </div>
                                        ))}
                                        {bill.items?.length > 3 && (
                                            <p className="text-sm text-slate-400 dark:text-d-faint">
                                                +{bill.items.length - 3} more items
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Amount Info */}
                                <div className="flex items-center justify-between mb-4 pt-4 border-t border-slate-200 dark:border-d-border">
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-d-muted">Total</p>
                                        <p className="text-xl font-bold text-slate-800 dark:text-d-heading font-display">{formatCurrency(bill.total)}</p>
                                    </div>
                                    {bill.amountPaid > 0 && (
                                        <div className="text-right">
                                            <p className="text-sm text-emerald-500 dark:text-d-green">Paid: {formatCurrency(bill.amountPaid)}</p>
                                            <p className="text-sm text-amber-600 dark:text-d-accent font-semibold">
                                                Due: {formatCurrency(bill.total - bill.amountPaid)}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleLoadBill(bill)}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-400 to-emerald-500 dark:from-d-green dark:to-[#2bc88a] text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(52,232,161,0.4)] transition-all"
                                    >
                                        <FiArrowRight size={18} />
                                        Load & Pay
                                    </button>
                                    <button
                                        onClick={() => handleCancelBill(bill._id)}
                                        className="p-3 text-d-red hover:bg-[rgba(255,107,107,0.1)] rounded-xl transition-colors"
                                        title="Cancel Bill"
                                    >
                                        <FiTrash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Pending;
