import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getReceiptStats } from '../services/api/receipts';
import { employeeChangePassword } from '../services/api/auth';
import {
    FiUser,
    FiMail,
    FiPhone,
    FiBriefcase,
    FiClock,
    FiDollarSign,
    FiShoppingCart,
    FiLogOut,
    FiRefreshCw,
    FiTrendingUp,
    FiCalendar,
    FiAward,
    FiLock,
    FiEye,
    FiEyeOff,
} from 'react-icons/fi';

const Profile = () => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({
        todaySales: 0,
        todayOrders: 0,
        monthSales: 0,
        monthOrders: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Change password state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const res = await getReceiptStats();
            setStats({
                todaySales: res.data.todaySales || 0,
                todayOrders: res.data.todayOrders || 0,
                monthSales: res.data.monthSales || 0,
                monthOrders: res.data.monthOrders || 0,
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadStats();
        setRefreshing(false);
    };

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to sign out?')) {
            await logout();
            navigate('/login');
        }
    };

    const handleChangePassword = async () => {
        setPasswordError('');
        setPasswordSuccess('');

        const { currentPassword, newPassword, confirmPassword } = passwordForm;
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('All fields are required');
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError('New password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }

        setChangingPassword(true);
        try {
            await employeeChangePassword({
                employeeId: user?.employeeId,
                currentPassword,
                newPassword,
            });
            setPasswordSuccess('Password changed successfully. Please log in again.');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                logout();
                navigate('/login');
            }, 2000);
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'Failed to change password');
        } finally {
            setChangingPassword(false);
        }
    };

    const formatCurrency = (amount) => `${business?.currency || 'Rs.'} ${(amount || 0).toLocaleString()}`;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-d-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-d-muted">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 dark:bg-d-bg overflow-auto">
            <div className="p-6 max-w-4xl mx-auto animate-fade-slide-up">
                {/* Header Card */}
                <div className="bg-gradient-to-br from-slate-100 to-white dark:from-d-elevated dark:to-d-card rounded-2xl p-8 border border-slate-200 dark:border-d-border mb-6 relative overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[rgba(255,210,100,0.1)] to-transparent rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[rgba(91,156,246,0.08)] to-transparent rounded-full blur-2xl" />

                    <div className="relative flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 dark:from-d-accent dark:to-d-accent-s flex items-center justify-center shadow-lg">
                            <span className="text-3xl font-bold text-white">
                                {user?.name?.charAt(0) || 'E'}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">{user?.name || 'Employee'}</h1>
                            <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-d-muted">
                                <FiBriefcase size={16} />
                                <span>Sales Associate</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="w-2 h-2 bg-green-500 dark:bg-d-green rounded-full animate-pulse" />
                                <span className="text-sm text-green-600 dark:text-green-600 dark:text-d-green">Active</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Today's Performance */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading">Today's Performance</h2>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-[rgba(255,210,100,0.1)] text-amber-500 dark:text-d-accent rounded-xl text-sm font-medium hover:bg-[rgba(255,210,100,0.15)] transition-colors disabled:opacity-50"
                        >
                            <FiRefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(52,232,161,0.1)] flex items-center justify-center mb-4">
                                <FiDollarSign size={24} className="text-green-600 dark:text-d-green" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Today's Sales</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-d-green mt-1 font-display">{formatCurrency(stats.todaySales)}</p>
                        </div>
                        <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(91,156,246,0.1)] flex items-center justify-center mb-4">
                                <FiShoppingCart size={24} className="text-blue-500 dark:text-d-blue" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Today's Orders</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-d-heading mt-1">{stats.todayOrders}</p>
                        </div>
                    </div>
                </div>

                {/* This Month */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">This Month</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(255,210,100,0.1)] flex items-center justify-center mb-4">
                                <FiTrendingUp size={24} className="text-amber-500 dark:text-d-accent" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Month Sales</p>
                            <p className="text-2xl font-bold text-amber-500 dark:text-d-accent mt-1 font-display">{formatCurrency(stats.monthSales)}</p>
                        </div>
                        <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center mb-4">
                                <FiCalendar size={24} className="text-[#f59e0b]" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Month Orders</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-d-heading mt-1">{stats.monthOrders}</p>
                        </div>
                    </div>
                </div>

                {/* Profile Details */}
                <div className="bg-white dark:bg-d-card rounded-2xl p-6 border border-slate-200 dark:border-d-border mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-d-heading mb-4">Profile Details</h2>

                    <div className="space-y-1">
                        <div className="flex items-center gap-4 py-4 border-b border-slate-200 dark:border-d-border">
                            <div className="w-10 h-10 rounded-xl bg-[rgba(91,156,246,0.1)] flex items-center justify-center">
                                <FiUser size={20} className="text-blue-500 dark:text-d-blue" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-d-muted">Employee ID</p>
                                <p className="font-medium text-slate-700 dark:text-d-text">{user?.employeeId || '-'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 py-4 border-b border-slate-200 dark:border-d-border">
                            <div className="w-10 h-10 rounded-xl bg-[rgba(255,210,100,0.1)] flex items-center justify-center">
                                <FiBriefcase size={20} className="text-amber-500 dark:text-d-accent" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-d-muted">Business</p>
                                <p className="font-medium text-slate-700 dark:text-d-text">{business?.name || '-'}</p>
                            </div>
                        </div>

                        {user?.phone && (
                            <div className="flex items-center gap-4 py-4 border-b border-slate-200 dark:border-d-border">
                                <div className="w-10 h-10 rounded-xl bg-[rgba(52,232,161,0.1)] flex items-center justify-center">
                                    <FiPhone size={20} className="text-green-600 dark:text-d-green" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Phone</p>
                                    <p className="font-medium text-slate-700 dark:text-d-text">{user.phone}</p>
                                </div>
                            </div>
                        )}

                        {user?.email && (
                            <div className="flex items-center gap-4 py-4">
                                <div className="w-10 h-10 rounded-xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center">
                                    <FiMail size={20} className="text-[#f59e0b]" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-d-muted">Email</p>
                                    <p className="font-medium text-slate-700 dark:text-d-text">{user.email}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Change Password */}
                <div className="bg-white dark:bg-d-card rounded-2xl border border-slate-200 dark:border-d-border mb-6 overflow-hidden">
                    <button
                        onClick={() => { setShowPasswordForm(!showPasswordForm); setPasswordError(''); setPasswordSuccess(''); }}
                        className="w-full flex items-center gap-4 p-6 hover:bg-slate-50 dark:hover:bg-d-elevated transition-colors"
                    >
                        <div className="w-10 h-10 rounded-xl bg-[rgba(91,156,246,0.1)] flex items-center justify-center">
                            <FiLock size={20} className="text-blue-500 dark:text-d-blue" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="font-semibold text-slate-800 dark:text-d-heading">Change Password</p>
                            <p className="text-sm text-slate-500 dark:text-d-muted">Update your login password</p>
                        </div>
                    </button>

                    {showPasswordForm && (
                        <div className="px-6 pb-6 space-y-4 border-t border-slate-100 dark:border-d-border pt-4">
                            {passwordError && (
                                <div className="bg-red-50 dark:bg-[rgba(255,107,107,0.1)] border border-red-200 dark:border-[rgba(255,107,107,0.2)] text-red-600 dark:text-d-red px-4 py-3 rounded-xl text-sm">
                                    {passwordError}
                                </div>
                            )}
                            {passwordSuccess && (
                                <div className="bg-green-50 dark:bg-[rgba(52,232,161,0.1)] border border-green-200 dark:border-[rgba(52,232,161,0.2)] text-green-600 dark:text-d-green px-4 py-3 rounded-xl text-sm">
                                    {passwordSuccess}
                                </div>
                            )}

                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    placeholder="Current Password"
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                                    className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-muted">
                                    {showCurrent ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                </button>
                            </div>

                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    placeholder="New Password (min 8 chars)"
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                                    className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-muted">
                                    {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                </button>
                            </div>

                            <input
                                type="password"
                                placeholder="Confirm New Password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />

                            <button
                                onClick={handleChangePassword}
                                disabled={changingPassword}
                                className="w-full py-3 bg-blue-500 dark:bg-d-blue text-white font-semibold rounded-xl hover:bg-blue-600 dark:hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {changingPassword ? 'Changing...' : 'Change Password'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Sign Out */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 dark:bg-[rgba(255,107,107,0.1)] text-red-500 dark:text-d-red rounded-xl font-semibold hover:bg-red-100 dark:hover:bg-[rgba(255,107,107,0.15)] transition-colors border border-red-200 dark:border-[rgba(255,107,107,0.2)]"
                >
                    <FiLogOut size={20} />
                    Sign Out
                </button>
            </div>
        </div>
    );
};

export default Profile;
