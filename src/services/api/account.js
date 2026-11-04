import api from '../api';

// Works even while the business is blocked: { status, message, contact, paidUntil }
export const getAccountStatus = () => api.get('/account/status');
