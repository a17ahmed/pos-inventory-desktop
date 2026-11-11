import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import * as Sentry from '@sentry/electron/renderer';
import * as SentryReact from '@sentry/react';
import { isDesktopApp } from './utils/platform';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import { MoneyBookProvider } from './context/MoneyBookContext';
import { ThemeProvider } from './context/ThemeContext';
import NetworkStatus from './components/NetworkStatus';
import AppDialogHost from './components/AppDialog';
import AccountStatusHost from './components/AccountStatus';
import './index.css';

// Sentry — production builds only. DSN is safe to embed in a client bundle
// (it's a public write-only identifier, not a secret).
if (import.meta.env.PROD) {
    if (isDesktopApp) {
        Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN }, SentryReact.init);
    } else {
        // Web app: the Electron renderer SDK needs the main process, so use the browser SDK.
        SentryReact.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: 'web' });
    }
}

// Use HashRouter for Electron (file:// protocol), BrowserRouter on the web
const Router = isDesktopApp ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <NetworkStatus>
                <Router>
                    <AuthProvider>
                        <BusinessProvider>
                            <MoneyBookProvider>
                                <App />
                                <AccountStatusHost />
                            </MoneyBookProvider>
                        </BusinessProvider>
                    </AuthProvider>
                </Router>
                <AppDialogHost />
            </NetworkStatus>
        </ThemeProvider>
    </React.StrictMode>
);
