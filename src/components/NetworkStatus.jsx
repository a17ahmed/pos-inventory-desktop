import React, { useState, useEffect, useRef } from 'react';
import { FiWifiOff, FiWifi } from 'react-icons/fi';
import { Dialog } from './ui/Dialog';
import { toast } from './ui/Toast';

const NetworkStatus = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const wasOffline = useRef(false);

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            if (wasOffline.current) {
                toast.success('Back online', { id: 'network', icon: FiWifi, duration: 3000 });
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

            {/* Offline: blocks the app until the connection is back */}
            <Dialog open={!isOnline} size="sm" zIndex={9999} labelledBy="offline-title">
                <div className="text-center pt-2">
                    <div className="w-14 h-14 rounded-2xl bg-destructive-chip text-destructive-chip-foreground inline-flex items-center justify-center mb-4">
                        <FiWifiOff className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <h2 id="offline-title" className="font-heading text-h3 text-foreground mb-1.5">
                        No Internet Connection
                    </h2>
                    <p className="text-body text-muted-foreground mb-5">
                        Please check your network connection. The app will reconnect automatically when the internet is back.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-body-sm text-muted-foreground">
                        <span className="w-2 h-2 bg-destructive rounded-full animate-ds-pulse" aria-hidden="true" />
                        Waiting for connection...
                    </div>
                </div>
            </Dialog>
        </>
    );
};

export default NetworkStatus;
