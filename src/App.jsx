import React, { Component } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

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
                <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-d-bg p-8">
                    <div className="max-w-lg bg-white dark:bg-d-card rounded-xl p-6 shadow-lg">
                        <h1 className="text-xl font-bold text-red-600 dark:text-d-red mb-4">Something went wrong</h1>
                        <p className="text-slate-600 dark:text-d-text mb-4">{this.state.error?.message}</p>
                        <pre className="bg-slate-100 dark:bg-d-elevated p-4 rounded text-xs overflow-auto max-h-48 mb-4 text-slate-800 dark:text-d-text">
                            {this.state.error?.stack}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
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
import Inventory from './screens/Inventory';
import EmployeeAnalytics from './screens/EmployeeAnalytics';

// Layout
import Layout from './components/Layout';

// Loading component
const Loading = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-d-bg">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 dark:text-d-muted">Loading...</p>
        </div>
    </div>
);

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
        return <Navigate to="/dashboard" replace />;
    }
    return children;
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
                                <CashBook />
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
