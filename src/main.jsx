import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import * as Sentry from '@sentry/electron/renderer';
import { init as sentryReactInit } from '@sentry/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import { ThemeProvider } from './context/ThemeContext';
import NetworkStatus from './components/NetworkStatus';
import './index.css';

// Sentry — production builds only. DSN is safe to embed in a client bundle
// (it's a public write-only identifier, not a secret).
if (import.meta.env.PROD) {
    Sentry.init(
        { dsn: import.meta.env.VITE_SENTRY_DSN },
        sentryReactInit
    );
}

// Use HashRouter for Electron (file:// protocol)
const Router = window.electronAPI ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <NetworkStatus>
                <Router>
                    <AuthProvider>
                        <BusinessProvider>
                            <App />
                        </BusinessProvider>
                    </AuthProvider>
                </Router>
            </NetworkStatus>
        </ThemeProvider>
    </React.StrictMode>
);
