import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiEye, FiEyeOff, FiUserPlus } from 'react-icons/fi';
import { AuthLayout, AuthCard, BrandMark } from '../components/shell/AuthLayout';
import { Button, IconButton, Field, Input, Alert, SegmentedControl } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { adminLogin, employeeLogin } from '../services/api/auth';
import { appAlert } from '../components/AppDialog';
import { isAccountBlocked } from '../services/accountStatus';

// Set by the API client when the owner ended every session (401 SESSION_REVOKED)
const readLogoutNotice = () => {
    try {
        return sessionStorage.getItem('logoutReason') === 'revoked'
            ? 'Your session was ended by the administrator. Please log in again.'
            : '';
    } catch (e) {
        return '';
    }
};

const Login = () => {
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const { loadBusiness } = useBusiness();

    // Login type: 'admin' or 'employee'
    const [loginType, setLoginType] = useState('admin');

    // Form fields
    const [email, setEmail] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice] = useState(readLogoutNotice);
    useEffect(() => {
        try { sessionStorage.removeItem('logoutReason'); } catch (e) { /* ignore */ }
    }, []);
    const isDev = import.meta.env.VITE_ENV === 'development';

    const handleAdminLogin = async () => {
        setError('');
        setLoading(true);

        try {
            const response = await adminLogin(email, password);

            if (response.data.token) {
                // Clear all old data
                localStorage.removeItem('admin');
                localStorage.removeItem('employee');
                localStorage.removeItem('counterUser');
                localStorage.removeItem('business');
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');

                // Store new session
                localStorage.setItem('token', response.data.token);
                if (response.data.refreshToken) {
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                }
                if (response.data.admin) {
                    localStorage.setItem('admin', JSON.stringify(response.data.admin));
                    localStorage.setItem('user', JSON.stringify(response.data.admin));
                }
                if (response.data.business) {
                    localStorage.setItem('business', JSON.stringify(response.data.business));
                }

                // Update auth and business contexts, then navigate
                checkAuth();
                loadBusiness();
                navigate('/dashboard', { replace: true });
            }
        } catch (err) {
            console.error('Login error:', err);
            // Blocked: the Account blocked dialog explains it
            if (!isAccountBlocked(err)) setError(err.response?.data?.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    const handleEmployeeLogin = async () => {
        setError('');
        setLoading(true);

        try {
            const response = await employeeLogin(employeeId.toLowerCase(), password);

            if (response.data.token) {
                // Clear all old data
                localStorage.removeItem('admin');
                localStorage.removeItem('employee');
                localStorage.removeItem('counterUser');
                localStorage.removeItem('business');
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');

                // Store new session
                localStorage.setItem('token', response.data.token);
                if (response.data.refreshToken) {
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                }
                if (response.data.employee) {
                    localStorage.setItem('employee', JSON.stringify(response.data.employee));
                    localStorage.setItem('user', JSON.stringify(response.data.employee));
                }
                if (response.data.counterUser) {
                    localStorage.setItem('counterUser', JSON.stringify(response.data.counterUser));
                }
                if (response.data.business) {
                    localStorage.setItem('business', JSON.stringify(response.data.business));
                }

                // Update auth and business contexts (checkAuth will also fetch permissions)
                checkAuth();
                loadBusiness();

                // Redirect to profile if password change required
                if (response.data.requirePasswordChange) {
                    appAlert('You must change your password before continuing.');
                    navigate('/profile', { replace: true });
                } else {
                    navigate('/dashboard', { replace: true });
                }
            }
        } catch (err) {
            console.error('Login error:', err);
            if (!isAccountBlocked(err)) setError(err.response?.data?.message || 'Invalid Employee ID or password');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (loginType === 'admin') {
            handleAdminLogin();
        } else {
            handleEmployeeLogin();
        }
    };

    const isAdminLogin = loginType === 'admin';
    const switchType = (t) => {
        setLoginType(t);
        setError('');
        setPassword('');
    };

    return (
        <AuthLayout
            footer={
                isDev ? (
                    <>
                        Developer build · <kbd className="font-mono">Ctrl+Shift+I</kbd> opens DevTools
                    </>
                ) : null
            }
        >
            <div className="mb-5 flex items-center gap-3">
                <BrandMark />
                <span className="font-heading text-h3 text-foreground">POS Desktop</span>
            </div>

            <AuthCard>
                <h1 className="font-heading text-h2 text-foreground">Sign in</h1>
                <p className="mt-1 text-body text-muted-foreground">
                    {isAdminLogin ? 'Shop owner or admin — use your email.' : 'Counter staff — use the sign-in ID your admin gave you.'}
                </p>

                <SegmentedControl
                    label="Who is signing in"
                    className="mt-5 w-full [&>button]:flex-1"
                    value={loginType}
                    onChange={switchType}
                    options={[
                        { value: 'admin', label: 'Owner / admin' },
                        { value: 'employee', label: 'Staff' },
                    ]}
                />

                <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                    {notice && !error ? <Alert tone="warning">{notice}</Alert> : null}
                    {error ? <Alert tone="destructive">{error}</Alert> : null}

                    {isAdminLogin ? (
                        <Field label="Email">
                            <Input
                                key="email"
                                type="email"
                                autoComplete="username"
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@yourshop.com"
                                required
                            />
                        </Field>
                    ) : (
                        <Field label="Sign-in ID" hint="Looks like shopname@yourname">
                            <Input
                                key="employeeId"
                                type="text"
                                autoComplete="username"
                                autoCapitalize="none"
                                autoFocus
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value.toLowerCase())}
                                placeholder="e.g. store@john"
                                required
                            />
                        </Field>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-password" className="text-body-sm font-medium text-foreground">
                            Password
                        </label>
                        <div className="relative">
                            <Input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pr-11"
                                required
                            />
                            <IconButton
                                size="2xs"
                                label={showPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                            >
                                {showPassword ? <FiEyeOff /> : <FiEye />}
                            </IconButton>
                        </div>
                    </div>

                    <Button type="submit" size="action" className="w-full mt-1" loading={loading}>
                        {loading ? 'Signing in…' : 'Sign in'}
                    </Button>
                </form>

                {isDev ? (
                    <div className="mt-5 pt-4 border-t border-hairline text-center">
                        <Link to="/signup" className="inline-flex items-center gap-2 text-body font-medium text-primary hover:underline">
                            <FiUserPlus aria-hidden="true" />
                            Create a new shop
                        </Link>
                    </div>
                ) : null}
            </AuthCard>
        </AuthLayout>
    );
};

export default Login;
