import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { PageHeader, StatusChip, SectionCard, KpiStrip, KpiCard, Button, IconButton, Field, Input, Alert, StateCard } from '../components/ui';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { getReceiptStats } from '../services/api/receipts';
import { employeeChangePassword } from '../services/api/auth';
import { appConfirm } from '../components/AppDialog';
import { formatAmount } from '../utils/money';

// The signed-in staff member's own page: who they are, how the shop is doing, change password.
const Profile = () => {
    const navigate = useNavigate();
    const { business } = useBusiness();
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({ todaySales: 0, todayOrders: 0, monthSales: 0, monthOrders: 0 });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoadError(null);
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
            setLoadError(error.response?.data?.message || (!navigator.onLine ? 'You seem to be offline.' : "The server didn't answer."));
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
        if (await appConfirm('You will need your password to sign in again.', { title: 'Sign out?', confirmText: 'Sign out', danger: true })) {
            await logout();
            navigate('/login');
        }
    };

    const handleChangePassword = async () => {
        setPasswordError('');
        setPasswordSuccess('');
        const { currentPassword, newPassword, confirmPassword } = passwordForm;
        if (!currentPassword || !newPassword || !confirmPassword) return setPasswordError('Fill in all three boxes.');
        if (newPassword.length < 8) return setPasswordError('The new password needs at least 8 characters.');
        if (newPassword !== confirmPassword) return setPasswordError("The two new passwords don't match.");

        setChangingPassword(true);
        try {
            await employeeChangePassword({ employeeId: user?.employeeId, currentPassword, newPassword });
            setPasswordSuccess('Password changed. Signing you out so you can sign in with the new one…');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                logout();
                navigate('/login');
            }, 2000);
        } catch (err) {
            setPasswordError(err.response?.data?.message || "Couldn't change the password.");
        } finally {
            setChangingPassword(false);
        }
    };

    const money = (n) => formatAmount(n || 0, { currency: business?.currency || 'PKR' });
    const setPw = (k) => (e) => setPasswordForm((p) => ({ ...p, [k]: e.target.value }));

    if (loading) return <PageSkeleton variant="detail" cards={2} />;

    return (
        <div className="h-full overflow-auto">
            <div className="p-6 max-w-3xl mx-auto animate-fade-slide-up">
                <PageHeader
                    eyebrow="My profile"
                    meta={<StatusChip tone="success" shape="dot" label="Signed in" />}
                    title={user?.name || 'Staff'}
                    subtitle={`Signs in as ${user?.employeeId || '—'}${business?.name ? ` · ${business.name}` : ''}`}
                    actions={
                        <Button variant="outline" onClick={handleLogout}>
                            <span className="inline-flex items-center gap-2 text-destructive">
                                <FiLogOut aria-hidden="true" />
                                Sign out
                            </span>
                        </Button>
                    }
                />

                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-heading text-h4 text-foreground">Shop sales</h2>
                    <IconButton label="Refresh" onClick={handleRefresh} loading={refreshing}>
                        <FiRefreshCw />
                    </IconButton>
                </div>
                {loadError ? (
                    <StateCard kind="error" className="mb-3" title="Couldn't load the sales figures" onRetry={handleRefresh}>
                        {loadError}
                    </StateCard>
                ) : null}
                <KpiStrip cols={4} className="mb-5">
                    <KpiCard size="sm" label="Today" value={money(stats.todaySales)} note="all counters" />
                    <KpiCard size="sm" label="Bills today" value={String(stats.todayOrders)} />
                    <KpiCard size="sm" label="This month" value={money(stats.monthSales)} note="all counters" />
                    <KpiCard size="sm" label="Bills this month" value={String(stats.monthOrders)} />
                </KpiStrip>

                <div className="flex flex-col gap-4">
                    <SectionCard title="My details" description="Ask the shop admin to change these.">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                            {[
                                ['Name', user?.name],
                                ['Sign-in ID', user?.employeeId],
                                ['Shop', business?.name],
                                ['Phone', user?.phone],
                                ...(user?.email ? [['Email', user.email]] : []),
                            ].map(([label, value]) => (
                                <div key={label} className="min-w-0">
                                    <dt className="text-caption text-muted-foreground">{label}</dt>
                                    <dd className={`mt-0.5 text-body break-words ${value ? 'text-foreground' : 'text-muted-foreground'}`}>{value || 'Not set'}</dd>
                                </div>
                            ))}
                        </dl>
                    </SectionCard>

                    <SectionCard
                        title="Change password"
                        description="You'll be signed out afterwards so you can sign in with the new one."
                        footer={
                            <Button onClick={handleChangePassword} loading={changingPassword} disabled={!!passwordSuccess}>
                                Change password
                            </Button>
                        }
                    >
                        <form
                            className="flex flex-col gap-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleChangePassword();
                            }}
                        >
                            {passwordError ? <Alert tone="destructive">{passwordError}</Alert> : null}
                            {passwordSuccess ? <Alert tone="success">{passwordSuccess}</Alert> : null}
                            <Field label="Current password">
                                <Input
                                    type={showPasswords ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={passwordForm.currentPassword}
                                    onChange={setPw('currentPassword')}
                                />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="New password" hint="At least 8 characters.">
                                    <Input
                                        type={showPasswords ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        value={passwordForm.newPassword}
                                        onChange={setPw('newPassword')}
                                    />
                                </Field>
                                <Field label="New password again">
                                    <Input
                                        type={showPasswords ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        value={passwordForm.confirmPassword}
                                        onChange={setPw('confirmPassword')}
                                    />
                                </Field>
                            </div>
                            <Button variant="link" className="self-start" onClick={() => setShowPasswords((v) => !v)}>
                                {showPasswords ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                                {showPasswords ? 'Hide passwords' : 'Show passwords'}
                            </Button>
                            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
                        </form>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};

export default Profile;
