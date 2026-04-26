import React, { useState, useEffect } from 'react';
import { todayLocalDate, toLocalDateStr } from '../utils/date';
import { useBusiness } from '../context/BusinessContext';
import { getEmployees, getEmployeePrefix, createEmployee, updateEmployee, deleteEmployee, reactivateEmployee } from '../services/api/employees';
import { getEmployeeAccess, updateEmployeeAccess } from '../services/api/access';
import {
    FiPlus,
    FiSearch,
    FiEdit2,
    FiTrash2,
    FiUsers,
    FiX,
    FiSave,
    FiMail,
    FiPhone,
    FiPercent,
    FiHash,
    FiShield,
    FiDollarSign,
    FiClock,
    FiCalendar,
    FiCheck,
    FiRefreshCw,
    FiFilter,
} from 'react-icons/fi';

// Business type detection
const getBusinessType = (config) => {
    const code = config?.type?.toLowerCase() || '';
    if (['salon', 'spa', 'clinic', 'service', 'ser', 'sal', 'cli'].some(t => code.includes(t))) return 'service';
    if (['restaurant', 'food', 'cafe', 'kitchen', 'res', 'caf'].some(t => code.includes(t))) return 'restaurant';
    return 'retail';
};

const STATUS_OPTIONS = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'On Leave', value: 'on_leave' },
];

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Access control module definitions
const ACCESS_MODULES = [
    { key: 'pos', label: 'POS / Sales', actions: ['view', 'create'] },
    { key: 'returns', label: 'Returns', actions: ['view', 'create', 'standalone', 'cancel'] },
    { key: 'products', label: 'Products', actions: ['view', 'create', 'edit', 'delete', 'updateStock'] },
    { key: 'vendors', label: 'Vendors', actions: ['view', 'create', 'edit', 'delete', 'pay'] },
    { key: 'supplies', label: 'Supplies', actions: ['view', 'create', 'edit', 'delete', 'recordPayment', 'processReturn'] },
    { key: 'expenses', label: 'Expenses', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { key: 'customers', label: 'Customers', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'employees', label: 'Employees', actions: ['view', 'create', 'edit', 'delete', 'resetPassword'] },
    { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
    { key: 'reports', label: 'Reports', actions: ['view'] },
    { key: 'settings', label: 'Settings', actions: ['view', 'edit'] },
];

const ACTION_LABELS = {
    view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
    standalone: 'Standalone', updateStock: 'Update Stock', pay: 'Pay', recordPayment: 'Record Payment',
    processReturn: 'Process Return', approve: 'Approve', resetPassword: 'Reset Password',
    resume: 'Resume', cancel: 'Cancel',
};

const Employees = () => {
    const { config } = useBusiness();
    const businessType = getBusinessType(config);
    const isService = businessType === 'service';

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [prefix, setPrefix] = useState('emp@');
    const [generatedId, setGeneratedId] = useState('');

    // Access control state
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [accessEmployee, setAccessEmployee] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [loadingAccess, setLoadingAccess] = useState(false);
    const [savingAccess, setSavingAccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        requirePasswordChange: true,
        status: 'active',
        isManager: false,
        salary: '',
        joiningDate: todayLocalDate(),
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
        daysOff: [],
        commissionRate: '',
        specializations: '',
    });

    useEffect(() => {
        fetchEmployees();
        fetchPrefix();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await getEmployees();
            setEmployees(res.data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPrefix = async () => {
        try {
            const res = await getEmployeePrefix();
            setPrefix(res.data?.prefix || 'emp@');
        } catch (error) {
            // fallback handled by default state
        }
    };

    const updateName = (name) => {
        setFormData(prev => ({ ...prev, name }));
        if (!editingEmployee) {
            const username = name.toLowerCase().replace(/\s+/g, '');
            setGeneratedId(username ? `${prefix}${username}` : '');
        }
    };

    const toggleDayOff = (day) => {
        setFormData(prev => ({
            ...prev,
            daysOff: prev.daysOff.includes(day)
                ? prev.daysOff.filter(d => d !== day)
                : [...prev.daysOff, day]
        }));
    };

    const filteredEmployees = employees.filter((e) => {
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            e.name?.toLowerCase().includes(q) ||
            e.employeeId?.toLowerCase().includes(q) ||
            e.email?.toLowerCase().includes(q) ||
            e.phone?.includes(searchQuery)
        );
    });

    const openModal = (employee = null) => {
        if (employee) {
            setEditingEmployee(employee);
            setGeneratedId(employee.employeeId || '');
            setFormData({
                name: employee.name || '',
                email: employee.email || '',
                phone: employee.phone || '',
                password: '',
                requirePasswordChange: false,
                status: employee.status || 'active',
                isManager: employee.role === 'manager',
                salary: employee.salary || '',
                joiningDate: employee.joiningDate
                    ? toLocalDateStr(employee.joiningDate)
                    : '',
                workingHoursStart: employee.workingHours?.start || '09:00',
                workingHoursEnd: employee.workingHours?.end || '18:00',
                daysOff: employee.daysOff || [],
                commissionRate: employee.commissionRate || '',
                specializations: (employee.specializations || []).join(', '),
            });
        } else {
            setEditingEmployee(null);
            setGeneratedId('');
            setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                requirePasswordChange: true,
                status: 'active',
                isManager: false,
                salary: '',
                joiningDate: todayLocalDate(),
                workingHoursStart: '09:00',
                workingHoursEnd: '18:00',
                daysOff: [],
                commissionRate: '',
                specializations: '',
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const data = {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                status: formData.status,
                role: formData.isManager ? 'manager' : 'employee',
                salary: Number(formData.salary) || 0,
                joiningDate: formData.joiningDate || undefined,
                workingHours: {
                    start: formData.workingHoursStart,
                    end: formData.workingHoursEnd,
                },
                daysOff: formData.daysOff,
            };

            if (formData.password) data.password = formData.password;

            if (!editingEmployee) {
                data.username = formData.name.toLowerCase().replace(/\s+/g, '');
                data.requirePasswordChange = formData.requirePasswordChange;
                if (!data.password) {
                    alert('Password is required');
                    return;
                }
            }

            if (isService) {
                data.commissionRate = parseInt(formData.commissionRate) || 0;
                data.specializations = formData.specializations
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
            }

            if (editingEmployee) {
                await updateEmployee(editingEmployee._id, data);
            } else {
                await createEmployee(data);
            }

            setShowModal(false);
            fetchEmployees();
        } catch (error) {
            console.error('Error saving employee:', error);
            alert(error.response?.data?.message || 'Failed to save employee');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (employeeId) => {
        if (!window.confirm('Are you sure you want to deactivate this employee? They will not be able to login.')) return;
        try {
            await deleteEmployee(employeeId);
            fetchEmployees();
        } catch (error) {
            console.error('Error deactivating employee:', error);
            alert(error.response?.data?.message || 'Failed to deactivate employee');
        }
    };

    const handleReactivate = async (employeeId) => {
        if (!window.confirm('Reactivate this employee? They will be able to login again.')) return;
        try {
            await reactivateEmployee(employeeId);
            fetchEmployees();
        } catch (error) {
            console.error('Error reactivating employee:', error);
            alert(error.response?.data?.message || 'Failed to reactivate employee');
        }
    };

    // Access control handlers
    const openAccessModal = async (employee) => {
        setAccessEmployee(employee);
        setShowAccessModal(true);
        setLoadingAccess(true);
        try {
            const res = await getEmployeeAccess(employee._id);
            setPermissions(res.data?.access?.permissions || {});
        } catch (error) {
            console.error('Error fetching access:', error);
            setPermissions({});
        } finally {
            setLoadingAccess(false);
        }
    };

    const togglePermission = (module, action) => {
        setPermissions(prev => ({
            ...prev,
            [module]: {
                ...prev[module],
                [action]: !prev[module]?.[action]
            }
        }));
    };

    const toggleAllModule = (moduleKey, actions) => {
        const allEnabled = actions.every(a => permissions[moduleKey]?.[a]);
        setPermissions(prev => ({
            ...prev,
            [moduleKey]: Object.fromEntries(actions.map(a => [a, !allEnabled]))
        }));
    };

    const handleSaveAccess = async () => {
        setSavingAccess(true);
        try {
            await updateEmployeeAccess(accessEmployee._id, permissions);
            setShowAccessModal(false);
        } catch (error) {
            console.error('Error saving access:', error);
            alert('Failed to save permissions');
        } finally {
            setSavingAccess(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-600 dark:bg-[rgba(52,232,161,0.15)] dark:text-d-green';
            case 'inactive':
                return 'bg-red-100 text-red-600 dark:bg-[rgba(255,107,107,0.15)] dark:text-d-red';
            case 'on_leave':
                return 'bg-yellow-100 text-yellow-600 dark:bg-[rgba(255,210,100,0.15)] dark:text-d-accent';
            default:
                return 'bg-slate-100 text-slate-600 dark:bg-d-glass-hover dark:text-d-muted';
        }
    };

    const inputClass = "w-full px-4 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-d-muted mb-1";

    return (
        <div className="p-6 animate-fadeIn bg-slate-50 dark:bg-d-bg min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Employees</h1>
                    <p className="text-slate-500 dark:text-d-muted">{employees.length} team members</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-semibold hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all"
                >
                    <FiPlus />
                    Add Employee
                </button>
            </div>

            {/* Search + Status Filter */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-md">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-d-faint" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, ID, email or phone..."
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-800 dark:text-d-text placeholder-slate-400 dark:placeholder-d-faint focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover transition-colors"
                    />
                </div>
                <div className="flex rounded-xl border border-slate-200 dark:border-d-border overflow-hidden">
                    {[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                        { value: 'all', label: 'All' },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setStatusFilter(opt.value)}
                            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                                statusFilter === opt.value
                                    ? 'bg-amber-500 dark:bg-d-accent text-white dark:text-d-card'
                                    : 'bg-white dark:bg-d-card text-slate-500 dark:text-d-muted hover:bg-slate-50 dark:hover:bg-d-glass'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Employees Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map((employee) => (
                    <div
                        key={employee._id}
                        className="bg-white dark:bg-d-card rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-d-border hover:border-amber-300 dark:hover:border-d-border-hover transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-primary-100 dark:bg-[rgba(255,210,100,0.1)] rounded-xl flex items-center justify-center">
                                    <span className="text-xl font-bold text-primary-600 dark:text-d-accent">
                                        {employee.name?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-d-text">{employee.name}</h3>
                                    {employee.employeeId && (
                                        <p className="text-xs text-slate-400 dark:text-d-faint font-mono">{employee.employeeId}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        {employee.role === 'manager' && (
                                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-600 dark:bg-[rgba(139,92,246,0.15)] dark:text-[#a78bfa]">
                                                Manager
                                            </span>
                                        )}
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(employee.status)}`}>
                                            {employee.status || 'active'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                {employee.status === 'inactive' ? (
                                    <button
                                        onClick={() => handleReactivate(employee._id)}
                                        className="p-2 text-slate-400 dark:text-d-faint hover:text-green-500 dark:hover:text-d-green hover:bg-green-50 dark:hover:bg-[rgba(52,232,161,0.1)] rounded-lg transition-colors"
                                        title="Reactivate"
                                    >
                                        <FiRefreshCw size={18} />
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => openAccessModal(employee)}
                                            className="p-2 text-slate-400 dark:text-d-faint hover:text-purple-500 dark:hover:text-[#a78bfa] hover:bg-purple-50 dark:hover:bg-[rgba(139,92,246,0.1)] rounded-lg transition-colors"
                                            title="Access Control"
                                        >
                                            <FiShield size={18} />
                                        </button>
                                        <button
                                            onClick={() => openModal(employee)}
                                            className="p-2 text-slate-400 dark:text-d-faint hover:text-primary-500 dark:hover:text-d-accent hover:bg-primary-50 dark:hover:bg-[rgba(255,210,100,0.1)] rounded-lg transition-colors"
                                        >
                                            <FiEdit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(employee._id)}
                                            className="p-2 text-slate-400 dark:text-d-faint hover:text-red-500 dark:hover:text-d-red hover:bg-red-50 dark:hover:bg-[rgba(255,107,107,0.1)] rounded-lg transition-colors"
                                            title="Deactivate"
                                        >
                                            <FiTrash2 size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {employee.email && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted">
                                    <FiMail size={14} />
                                    <span>{employee.email}</span>
                                </div>
                            )}
                            {employee.phone && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted">
                                    <FiPhone size={14} />
                                    <span>{employee.phone}</span>
                                </div>
                            )}
                            {employee.salary > 0 && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted">
                                    <FiDollarSign size={14} />
                                    <span>{employee.salary?.toLocaleString()} /month</span>
                                </div>
                            )}
                            {employee.workingHours && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted">
                                    <FiClock size={14} />
                                    <span>{employee.workingHours.start} - {employee.workingHours.end}</span>
                                </div>
                            )}
                            {isService && employee.commissionRate > 0 && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-d-muted">
                                    <FiPercent size={14} />
                                    <span>{employee.commissionRate}% commission</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredEmployees.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-d-faint">
                    <FiUsers size={48} />
                    <p className="mt-4 dark:text-d-muted">No employees found</p>
                </div>
            )}

            {/* Add/Edit Employee Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border sticky top-0 bg-white dark:bg-d-card rounded-t-2xl z-10">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading">
                                {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-600 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className={labelClass}>Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => updateName(e.target.value)}
                                    className={inputClass}
                                    required
                                    placeholder="Full name"
                                />
                            </div>

                            {/* Employee ID */}
                            <div>
                                <label className={labelClass}>Employee ID</label>
                                <div className={`${inputClass} bg-slate-50 dark:bg-d-elevated flex items-center gap-2`}>
                                    <FiHash size={14} className="text-slate-400 dark:text-d-faint" />
                                    <span className={generatedId || editingEmployee?.employeeId ? 'text-slate-800 dark:text-d-text' : 'text-slate-400 dark:text-d-faint'}>
                                        {editingEmployee ? editingEmployee.employeeId : (generatedId || 'Auto-generated from name')}
                                    </span>
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className={labelClass}>
                                    {editingEmployee ? 'New Password (leave empty to keep)' : 'Password *'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={inputClass}
                                    required={!editingEmployee}
                                    placeholder={editingEmployee ? 'Leave empty to keep current' : 'Min 4 characters'}
                                    minLength={formData.password ? 4 : undefined}
                                />
                            </div>

                            {/* Require Password Change */}
                            {!editingEmployee && (
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.requirePasswordChange}
                                        onChange={(e) => setFormData({ ...formData, requirePasswordChange: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-d-text">
                                        Require password change on first login
                                    </span>
                                </label>
                            )}

                            {/* Phone & Email */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className={inputClass}
                                        placeholder="Phone number"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={inputClass}
                                        placeholder="Email address"
                                    />
                                </div>
                            </div>

                            {/* Status & Salary */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className={inputClass}
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Salary</label>
                                    <input
                                        type="number"
                                        value={formData.salary}
                                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                                        className={inputClass}
                                        placeholder="Monthly salary"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Manager toggle */}
                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-purple-50 dark:bg-[rgba(139,92,246,0.1)] rounded-xl border border-purple-200 dark:border-[rgba(139,92,246,0.2)]">
                                <input
                                    type="checkbox"
                                    checked={formData.isManager}
                                    onChange={(e) => setFormData({ ...formData, isManager: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-purple-500 focus:ring-purple-400"
                                />
                                <div>
                                    <span className="text-sm font-medium text-purple-700 dark:text-[#a78bfa]">Manager Access</span>
                                    <p className="text-xs text-purple-500 dark:text-[#a78bfa]/70">Can manage other employees and their permissions</p>
                                </div>
                            </label>

                            {/* Working Hours & Joining Date */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>Start Time</label>
                                    <input
                                        type="time"
                                        value={formData.workingHoursStart}
                                        onChange={(e) => setFormData({ ...formData, workingHoursStart: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>End Time</label>
                                    <input
                                        type="time"
                                        value={formData.workingHoursEnd}
                                        onChange={(e) => setFormData({ ...formData, workingHoursEnd: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Joining Date</label>
                                    <input
                                        type="date"
                                        value={formData.joiningDate}
                                        onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            {/* Days Off */}
                            <div>
                                <label className={labelClass}>Days Off</label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map(day => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleDayOff(day)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                formData.daysOff.includes(day)
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-[rgba(255,210,100,0.2)] dark:text-d-accent border border-amber-300 dark:border-d-accent'
                                                    : 'bg-slate-100 text-slate-500 dark:bg-d-glass dark:text-d-muted border border-transparent hover:border-slate-300 dark:hover:border-d-border'
                                            }`}
                                        >
                                            {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Service-only fields */}
                            {isService && (
                                <>
                                    <div>
                                        <label className={labelClass}>Specializations</label>
                                        <input
                                            type="text"
                                            value={formData.specializations}
                                            onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                                            className={inputClass}
                                            placeholder="e.g. Haircut, Coloring, Styling"
                                        />
                                        <p className="text-xs text-slate-400 dark:text-d-faint mt-1">Comma-separated</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Commission Rate (%)</label>
                                        <input
                                            type="number"
                                            value={formData.commissionRate}
                                            onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                                            className={inputClass}
                                            min="0" max="100" placeholder="0"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-muted hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-d-accent dark:to-d-accent-s text-white dark:text-d-card rounded-xl font-medium hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,210,100,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <FiSave /> {submitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Access Control Modal */}
            {showAccessModal && accessEmployee && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-d-card dark:border dark:border-d-border rounded-2xl w-full max-w-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-d-border sticky top-0 bg-white dark:bg-d-card rounded-t-2xl z-10">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-800 dark:text-d-heading flex items-center gap-2">
                                    <FiShield className="text-purple-500" />
                                    Access Control
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-d-muted mt-1">
                                    {accessEmployee.name} ({accessEmployee.employeeId})
                                </p>
                            </div>
                            <button
                                onClick={() => setShowAccessModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-d-glass-hover rounded-lg transition-colors text-slate-600 dark:text-d-muted"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="p-6">
                            {loadingAccess ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {ACCESS_MODULES.map(mod => {
                                        const allEnabled = mod.actions.every(a => permissions[mod.key]?.[a]);
                                        const someEnabled = mod.actions.some(a => permissions[mod.key]?.[a]);

                                        return (
                                            <div key={mod.key} className="border border-slate-200 dark:border-d-border rounded-xl overflow-hidden">
                                                {/* Module header */}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAllModule(mod.key, mod.actions)}
                                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-d-elevated hover:bg-slate-100 dark:hover:bg-d-glass-hover transition-colors"
                                                >
                                                    <span className="font-medium text-slate-700 dark:text-d-text text-sm">{mod.label}</span>
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center text-white text-xs ${
                                                        allEnabled ? 'bg-purple-500' : someEnabled ? 'bg-purple-300 dark:bg-purple-500/50' : 'bg-slate-300 dark:bg-d-border'
                                                    }`}>
                                                        {allEnabled && <FiCheck size={12} />}
                                                        {someEnabled && !allEnabled && <span className="w-2 h-0.5 bg-white rounded" />}
                                                    </div>
                                                </button>

                                                {/* Actions */}
                                                <div className="px-4 py-3 flex flex-wrap gap-2">
                                                    {mod.actions.map(action => (
                                                        <button
                                                            key={action}
                                                            type="button"
                                                            onClick={() => togglePermission(mod.key, action)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                                permissions[mod.key]?.[action]
                                                                    ? 'bg-purple-100 text-purple-700 dark:bg-[rgba(139,92,246,0.2)] dark:text-[#a78bfa] border border-purple-300 dark:border-[rgba(139,92,246,0.3)]'
                                                                    : 'bg-slate-100 text-slate-500 dark:bg-d-glass dark:text-d-muted border border-transparent hover:border-slate-300 dark:hover:border-d-border'
                                                            }`}
                                                        >
                                                            {ACTION_LABELS[action] || action}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAccessModal(false)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-d-border rounded-xl font-medium text-slate-600 dark:text-d-muted hover:bg-slate-50 dark:hover:bg-d-glass transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveAccess}
                                    disabled={savingAccess || loadingAccess}
                                    className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingAccess ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiShield />
                                    )}
                                    Save Permissions
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Employees;
