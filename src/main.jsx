import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import { ThemeProvider } from './context/ThemeContext';
import NetworkStatus from './components/NetworkStatus';
import './index.css';

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
