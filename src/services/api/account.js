import api from '../api';

// Works even while the business is blocked: { status, message, contact, paidUntil }
// silent: runs on a timer in the background — no top loading bar
export const getAccountStatus = () => api.get('/account/status', { silent: true });
