import api from '../api';

export const getMyAccess = () =>
    api.get('/access/me');

export const getAllAccess = () =>
    api.get('/access');

export const getEmployeeAccess = (employeeId) =>
    api.get(`/access/${employeeId}`);

export const updateEmployeeAccess = (employeeId, permissions) =>
    api.put(`/access/${employeeId}`, { permissions });

export const deleteEmployeeAccess = (employeeId) =>
    api.delete(`/access/${employeeId}`);
