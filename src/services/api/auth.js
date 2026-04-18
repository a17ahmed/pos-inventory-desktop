import api from '../api';

export const adminLogin = (email, password) =>
    api.post('/adminAuth/login', { email, password });

export const employeeLogin = (employeeId, password) =>
    api.post('/employeeAuth/login', { employeeId, password });

export const logout = (refreshToken) =>
    api.post('/auth/logout', { refreshToken });

export const refreshToken = (token) =>
    api.post('/auth/refresh', { refreshToken: token });

export const employeeChangePassword = (data) =>
    api.post('/employeeAuth/change-password', data);
