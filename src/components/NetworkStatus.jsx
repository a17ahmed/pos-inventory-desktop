import React, { useState, useEffect, useRef } from 'react';
import { FiWifiOff, FiWifi } from 'react-icons/fi';

const NetworkStatus = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showReconnected, setShowReconnected] = useState(false);
    const wasOffline = useRef(false);

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            if (wasOffline.current) {
                setShowReconnected(true);
                setTimeout(() => setShowReconnected(false), 3000);
                wasOffline.current = false;
            }
        };

        const goOffline = () => {
            setIsOnline(false);
            wasOffline.current = true;
        };

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return (
        <>
            {children}

            {/* Offline overlay */}
            {!isOnline && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white dark:bg-d-card rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-200 dark:border-d-border text-center">
                        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-[rgba(255,107,107,0.1)] flex items-center justify-center mx-auto mb-5">
                            <FiWifiOff size={36} className="text-red-500 dark:text-d-red" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-d-heading mb-2">
                            No Internet Connection
                        </h2>
                        <p className="text-slate-500 dark:text-d-muted text-sm mb-6">
                            Please check your network connection. The app will reconnect automatically when the internet is back.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-d-faint">
                            <div className="w-2 h-2 bg-red-400 dark:bg-d-red rounded-full animate-pulse" />
                            Waiting for connection...
                        </div>
                    </div>
                </div>
            )}

            {/* Reconnected toast */}
            {showReconnected && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-fade-slide-up">
                    <div className="flex items-center gap-3 px-5 py-3 bg-green-500 dark:bg-d-green text-white rounded-xl shadow-lg">
                        <FiWifi size={18} />
                        <span className="font-medium text-sm">Back online</span>
                    </div>
                </div>
            )}
        </>
    );
};

export default NetworkStatus;
