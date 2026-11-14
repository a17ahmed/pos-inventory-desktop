import React, { Component, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import { EmptyState, Button } from './components/ui';
import { useAuth } from './context/AuthContext';

// Design Lab (design/ROADMAP.md Stage 3): dev builds only, loaded on demand so it never
// ships in the app shops install.
const DesignLab = import.meta.env.DEV ? lazy(() => import('./screens/DesignLab')) : null;

// Error Boundary to catch React errors
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('React Error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-destructive-chip p-8">
                    <div className="max-w-lg bg-card rounded-xl p-6 shadow-lg">
                        <h1 className="text-xl font-bold text-destructive mb-4">Something went wrong</h1>
                        <p className="text-muted-foreground mb-4">{this.state.error?.message}</p>
                        <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-48 mb-4 text-foreground">
                            {this.state.error?.stack}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90"
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// Screens
import Login from './screens/Login';
import Signup from './screens/Signup';
import Dashboard from './screens/Dashboard';
import Sales from './screens/Sales';
import Products from './screens/Products';
import Employees from './screens/Employees';
import Receipts from './screens/Receipts';
import Expenses from './screens/Expenses';
import Reports from './screens/Reports';
import Settings from './screens/Settings';
import Profile from './screens/Profile';
import Returns from './screens/Returns';
import Vendors from './screens/Vendors';
import Customers from './screens/Customers';
import CustomerLedger from './screens/CustomerLedger';
import VendorLedger from './screens/VendorLedger';
import CashBook from './screens/CashBook';
import MoneyBook from './screens/MoneyBook';
import { useMoneyBook } from './context/MoneyBookContext';
import Inventory from './screens/Inventory';
import EmployeeAnalytics from './screens/EmployeeAnalytics';
import Closing from './screens/Closing';
import ClosingDetail from './screens/ClosingDetail';

import { PageSkeleton } from './components/ui/PageSkeleton';
// Layout
import Layout from './components/Layout';

// Loading component
// While a page decides what to show (e.g. Money Book or Cash Book): the page's shape in grey
const Loading = () => <PageSkeleton cards={4} />;

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <Loading />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

// Permission-based route guard for employees
const PermissionRoute = ({ module, children }) => {
    const { isAdmin, permissions } = useAuth();
    if (isAdmin || !module) return children;
    // If permissions not loaded yet, allow (will filter once loaded)
    if (!permissions) return children;
    if (!permissions[module]?.view) {
        return (
            <Layout>
                <NoAccess module={module} />
            </Layout>
        );
    }
    return children;
};

// Shown instead of a page the signed-in staff member isn't allowed to open (was a silent jump
// to the home screen, which looked like the link was broken).
const MODULE_LABEL = {
    cashbook: 'the Money Book',
    closing: 'Closing',
    customers: 'Customers',
    dashboard: 'the Dashboard',
    employees: 'Staff',
    expenses: 'Expenses',
    pos: 'the till',
    products: 'Products',
    reports: 'Reports',
    returns: 'Returns',
    settings: 'Settings',
    vendors: 'Vendors',
};
const NoAccess = ({ module }) => {
    const navigate = useNavigate();
    return (
        <div className="h-full flex items-center justify-center p-6">
            <EmptyState
                icon={FiLock}
                title={`You can't open ${MODULE_LABEL[module] || 'this page'}`}
                actions={
                    <Button variant="outline" onClick={() => navigate('/dashboard')}>
                        Go to the home screen
                    </Button>
                }
            >
                Your account doesn't have this turned on. Ask the shop owner if you need it.
            </EmptyState>
        </div>
    );
};

// /cashbook: the Money Book once the shop has it, else the old Cash Book (unchanged)
const CashBookRoute = () => {
    const { mode, canViewBook } = useMoneyBook();
    if (mode === 'loading') return <Loading />;
    return mode === 'on' && canViewBook ? <MoneyBook /> : <CashBook />;
};

// Public route - redirect to dashboard if already logged in
const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <Loading />;
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

function AppContent() {
    const { loading } = useAuth();

    if (loading) {
        return <Loading />;
    }

    return (
        <Routes>
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                }
            />
            {import.meta.env.VITE_ENV === 'development' && (
                <Route
                    path="/signup"
                    element={
                        <PublicRoute>
                            <Signup />
                        </PublicRoute>
                    }
                />
            )}
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Dashboard />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Dashboard />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/sales"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="pos">
                            <Layout>
                                <Sales />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/products"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="products">
                            <Layout>
                                <Products />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/employees"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="employees">
                            <Layout>
                                <Employees />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/receipts"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="pos">
                            <Layout>
                                <Receipts />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/expenses"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="expenses">
                            <Layout>
                                <Expenses />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/reports"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="reports">
                            <Layout>
                                <Reports />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/settings"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="settings">
                            <Layout>
                                <Settings />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Profile />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/returns"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="returns">
                            <Layout>
                                <Returns />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/vendors"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="vendors">
                            <Layout>
                                <Vendors />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/customers"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="customers">
                            <Layout>
                                <Customers />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/inventory"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="products">
                            <Layout>
                                <Inventory />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/customers/:id/ledger"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="customers">
                            <Layout>
                                <CustomerLedger />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/vendors/:id/ledger"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="vendors">
                            <Layout>
                                <VendorLedger />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/cashbook"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="cashbook">
                            <Layout>
                                <CashBookRoute />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/analytics"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="dashboard">
                            <Layout>
                                <EmployeeAnalytics />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/closing"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="closing">
                            <Layout>
                                <Closing />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/closing/:id"
                element={
                    <ProtectedRoute>
                        <PermissionRoute module="closing">
                            <Layout>
                                <ClosingDetail />
                            </Layout>
                        </PermissionRoute>
                    </ProtectedRoute>
                }
            />
            {DesignLab && (
                <Route
                    path="/design-lab"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Suspense fallback={<Loading />}>
                                    <DesignLab />
                                </Suspense>
                            </Layout>
                        </ProtectedRoute>
                    }
                />
            )}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
    );
}

// For HMR compatibility
App.displayName = 'App';

export default App;
