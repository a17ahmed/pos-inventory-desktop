import axios from 'axios';
import { isAccountBlocked, reportBlocked, noteWarningHeader } from './accountStatus';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Refresh token queue to prevent race conditions
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
    refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
    refreshSubscribers.forEach((callback) => callback(token));
    refreshSubscribers = [];
};

const onRefreshFailed = (error) => {
    refreshSubscribers.forEach((callback) => callback(null, error));
    refreshSubscribers = [];
};

const SESSION_KEYS = ['token', 'refreshToken', 'user', 'admin', 'employee', 'counterUser', 'business', 'permissions'];

// Log out and open the login screen. Uses the hash + reload, not
// location.href = '/#/login': the packaged app runs from file://, where that
// path points outside the app and leaves a blank window.
const endSession = (reason) => {
    SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
    if (reason) {
        try { sessionStorage.setItem('logoutReason', reason); } catch (e) { /* ignore */ }
    }
    window.location.hash = '#/login';
    window.location.reload();
};

const isLoginRequest = (url = '') => url.includes('/adminAuth/login') || url.includes('/employeeAuth/login');

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - account status, then token refresh
api.interceptors.response.use(
    (response) => {
        if (String(response.headers?.['x-account-status'] || '').toLowerCase() === 'warning') noteWarningHeader();
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Business blocked by the software owner: show the Account blocked dialog
        // (once). Tokens and saved data stay — the same login works after unblock.
        if (isAccountBlocked(error)) {
            const url = originalRequest?.url || '';
            if (!url.includes('/auth/logout')) reportBlocked(error.response.data, { onLogin: isLoginRequest(url) });
            return Promise.reject(error);
        }
        const revoked = error.response?.data?.code === 'SESSION_REVOKED';

        // Skip token refresh for auth endpoints (login, register, etc.)
        const isAuthEndpoint = originalRequest?.url?.includes('/adminAuth/') ||
                               originalRequest?.url?.includes('/employeeAuth/') ||
                               originalRequest?.url?.includes('/auth/');

        // If 401 and not already retrying and not an auth endpoint
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            originalRequest._retry = true;

            // Check if we have a refresh token before attempting refresh
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                // No refresh token - full cleanup and redirect to login
                endSession(revoked ? 'revoked' : '');
                return Promise.reject(error);
            }

            // If already refreshing, queue this request
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh((token, err) => {
                        if (err) {
                            reject(err);
                        } else {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            resolve(api(originalRequest));
                        }
                    });
                });
            }

            isRefreshing = true;

            try {
                const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                    refreshToken,
                });

                const { token, accessToken, refreshToken: newRefreshToken } = response.data;
                const newToken = token || accessToken; // Backend returns "token", handle both
                localStorage.setItem('token', newToken);
                if (newRefreshToken) {
                    localStorage.setItem('refreshToken', newRefreshToken);
                }

                isRefreshing = false;
                onRefreshed(newToken);

                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                isRefreshing = false;
                onRefreshFailed(refreshError);

                // Blocked: the dialog, no logout — tokens are kept for after unblock
                if (isAccountBlocked(refreshError)) {
                    reportBlocked(refreshError.response.data);
                    return Promise.reject(refreshError);
                }
                // The server turned the refresh token down → log out. No answer
                // (offline) or a server error keeps the session for the next try.
                const status = refreshError.response?.status;
                if (status && status < 500) {
                    const refreshRevoked = refreshError.response?.data?.code === 'SESSION_REVOKED';
                    endSession(revoked || refreshRevoked ? 'revoked' : '');
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
