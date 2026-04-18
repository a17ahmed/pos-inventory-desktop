import api from '../api';

export const getEmployees = () =>
    api.get('/employee');

export const getEmployeePrefix = () =>
    api.get('/employee/prefix');

export const createEmployee = (data) =>
    api.post('/employee', data);

export const updateEmployee = (id, data) =>
    api.patch(`/employee/${id}`, data);

export const deleteEmployee = (id) =>
    api.delete(`/employee/${id}`);

export const reactivateEmployee = (id) =>
    api.patch(`/employee/${id}/reactivate`);
